import crypto from "crypto";
import mongoose from "mongoose";
import Razorpay from "razorpay";

import Payment, {
  PAYMENT_STATUSES
} from "../models/Payment.js";

import Booking from "../models/Booking.js";

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function normalizeText(
  value,
  maxLength = 2000
) {
  return String(value ?? "")
    .trim()
    .slice(0, maxLength);
}

function parsePositiveInteger(
  value,
  fallback,
  maximum
) {
  const number = Number.parseInt(value, 10);

  if (
    !Number.isFinite(number) ||
    number < 1
  ) {
    return fallback;
  }

  return Math.min(number, maximum);
}

function isAdmin(req) {
  return req.user?.role === "admin";
}

function getRazorpayClient() {
  const keyId =
    process.env.RAZORPAY_KEY_ID;

  const keySecret =
    process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    const error = new Error(
      "Payment gateway is not configured."
    );

    error.status = 503;

    throw error;
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret
  });
}

function getCurrency() {
  return normalizeText(
    process.env.PAYMENT_CURRENCY || "INR",
    10
  ).toUpperCase();
}

function canCreatePayment(booking) {
  return ![
    "cancelled",
    "completed"
  ].includes(booking.status);
}

function isSafePaymentStatus(status) {
  return PAYMENT_STATUSES.includes(status);
}

/*
========================================
CREATE RAZORPAY ORDER
========================================
*/

export async function createRazorpayOrder(
  req,
  res
) {
  try {
    const { bookingId } =
      req.body || {};

    if (
      !bookingId ||
      !isValidId(bookingId)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Valid booking ID is required."
      });
    }

    const booking =
      await Booking.findById(bookingId)
        .populate(
          "jobId",
          "budget status title"
        );

    if (!booking) {
      return res.status(404).json({
        success: false,
        message:
          "Booking not found."
      });
    }

    if (
      !isAdmin(req) &&
      String(booking.customerId) !==
        String(req.user.id)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to pay for this booking."
      });
    }

    if (!canCreatePayment(booking)) {
      return res.status(409).json({
        success: false,
        message:
          "Payment cannot be created for this booking."
      });
    }

    const amount =
      Number(booking.jobId?.budget);

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "A valid job budget is required before payment."
      });
    }

    const paidPayment =
      await Payment.findOne({
        bookingId,
        status: "paid"
      });

    if (paidPayment) {
      return res.status(409).json({
        success: false,
        message:
          "This booking has already been paid."
      });
    }

    /*
      Existing unfinished payment can be
      reused by creating a fresh order.
    */

    const existingPayment =
      await Payment.findOne({
        bookingId,
        userId: booking.customerId,
        status: {
          $in: [
            "created",
            "pending",
            "processing"
          ]
        }
      }).sort({
        createdAt: -1
      });

    const razorpay =
      getRazorpayClient();

    const currency =
      getCurrency();

    const receipt =
      `booking_${String(
        booking._id
      ).slice(-12)}_${Date.now()}`;

    const order =
      await razorpay.orders.create({
        amount:
          Math.round(amount * 100),

        currency,

        receipt,

        notes: {
          bookingId:
            String(booking._id),

          customerId:
            String(booking.customerId)
        }
      });

    let payment;

    if (existingPayment) {
      existingPayment.amount =
        amount;

      existingPayment.currency =
        order.currency;

      existingPayment.method =
        "razorpay";

      existingPayment.status =
        "pending";

      existingPayment.razorpayOrderId =
        order.id;

      existingPayment.transactionId =
        receipt;

      await existingPayment.save();

      payment =
        existingPayment;

    } else {
      payment =
        await Payment.create({
          userId:
            booking.customerId,

          bookingId:
            booking._id,

          amount,

          currency:
            order.currency,

          method:
            "razorpay",

          status:
            "pending",

          razorpayOrderId:
            order.id,

          transactionId:
            receipt
        });
    }

    return res.status(201).json({
      success: true,

      message:
        "Payment order created successfully.",

      keyId:
        process.env.RAZORPAY_KEY_ID,

      order: {
        id:
          order.id,

        amount:
          order.amount,

        currency:
          order.currency
      },

      payment: {
        id:
          payment._id,

        bookingId:
          payment.bookingId,

        amount:
          payment.amount,

        currency:
          payment.currency,

        status:
          payment.status
      }
    });

  } catch (error) {
    console.error(
      "CREATE PAYMENT ORDER ERROR:",
      error
    );

    return res.status(
      error.status || 500
    ).json({
      success: false,

      message:
        error.status
          ? error.message
          : "Unable to create payment order."
    });
  }
}

/*
========================================
VERIFY RAZORPAY PAYMENT
========================================
*/

export async function verifyRazorpayPayment(
  req,
  res
) {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body || {};

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Complete payment verification data is required."
      });
    }

    const payment =
      await Payment.findOne({
        razorpayOrderId:
          razorpay_order_id
      }).select("+gatewaySignature");

    if (!payment) {
      return res.status(404).json({
        success: false,
        message:
          "Payment record not found."
      });
    }

    if (
      !isAdmin(req) &&
      String(payment.userId) !==
        String(req.user.id)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to verify this payment."
      });
    }

    if (
      payment.status === "paid"
    ) {
      return res.status(200).json({
        success: true,
        message:
          "Payment was already verified.",

        payment: {
          id: payment._id,
          bookingId:
            payment.bookingId,
          amount:
            payment.amount,
          currency:
            payment.currency,
          status:
            payment.status,
          paidAt:
            payment.paidAt
        }
      });
    }

    const secret =
      process.env.RAZORPAY_KEY_SECRET;

    if (!secret) {
      return res.status(503).json({
        success: false,
        message:
          "Payment gateway is not configured."
      });
    }

    const generatedSignature =
      crypto
        .createHmac(
          "sha256",
          secret
        )
        .update(
          `${razorpay_order_id}|${razorpay_payment_id}`
        )
        .digest("hex");

    const expected =
      Buffer.from(
        generatedSignature,
        "utf8"
      );

    const received =
      Buffer.from(
        razorpay_signature,
        "utf8"
      );

    const signatureValid =
      expected.length ===
        received.length &&
      crypto.timingSafeEqual(
        expected,
        received
      );

    if (!signatureValid) {
      payment.status =
        "failed";

      payment.failedAt =
        new Date();

      await payment.save();

      return res.status(400).json({
        success: false,
        message:
          "Payment signature verification failed."
      });
    }

    /*
      Prevent one gateway payment ID
      from being reused.
    */

    const duplicateGatewayPayment =
      await Payment.findOne({
        gatewayPaymentId:
          razorpay_payment_id,

        _id: {
          $ne: payment._id
        }
      });

    if (
      duplicateGatewayPayment
    ) {
      return res.status(409).json({
        success: false,
        message:
          "This gateway payment has already been used."
      });
    }

    payment.status =
      "paid";

    payment.gatewayPaymentId =
      razorpay_payment_id;

    payment.gatewaySignature =
      razorpay_signature;

    payment.paidAt =
      new Date();

    await payment.save();

    /*
      Payment is now successful.

      Booking confirmation should remain
      compatible with your booking workflow.
      Pending booking becomes confirmed.
    */

    const booking =
      await Booking.findById(
        payment.bookingId
      );

    if (
      booking &&
      booking.status === "pending"
    ) {
      booking.status =
        "confirmed";

      booking.confirmedAt =
        booking.confirmedAt ||
        new Date();

      await booking.save();
    }

    return res.status(200).json({
      success: true,

      message:
        "Payment verified successfully.",

      payment: {
        id:
          payment._id,

        bookingId:
          payment.bookingId,

        amount:
          payment.amount,

        currency:
          payment.currency,

        status:
          payment.status,

        paidAt:
          payment.paidAt
      }
    });

  } catch (error) {
    console.error(
      "VERIFY PAYMENT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to verify payment."
    });
  }
}

/*
========================================
GET MY PAYMENTS
========================================
*/

export async function getMyPayments(
  req,
  res
) {
  try {
    const {
      status,
      page,
      limit
    } = req.query;

    const filter = {
      userId: req.user.id
    };

    if (status) {
      const requestedStatus =
        normalizeText(
          status,
          50
        ).toLowerCase();

      if (
        !isSafePaymentStatus(
          requestedStatus
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid payment status."
        });
      }

      filter.status =
        requestedStatus;
    }

    const currentPage =
      parsePositiveInteger(
        page,
        1,
        100000
      );

    const pageLimit =
      parsePositiveInteger(
        limit,
        20,
        100
      );

    const skip =
      (currentPage - 1) *
      pageLimit;

    const [
      payments,
      total
    ] = await Promise.all([
      Payment.find(filter)
        .sort({
          createdAt: -1
        })
        .skip(skip)
        .limit(pageLimit)
        .populate(
          "bookingId",
          "status customerMessage workerMessage createdAt"
        ),

      Payment.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,

      pagination: {
        page:
          currentPage,

        limit:
          pageLimit,

        total,

        totalPages:
          Math.max(
            1,
            Math.ceil(
              total / pageLimit
            )
          ),

        hasNextPage:
          currentPage *
            pageLimit <
          total,

        hasPreviousPage:
          currentPage > 1
      },

      count:
        payments.length,

      data:
        payments
    });

  } catch (error) {
    console.error(
      "GET MY PAYMENTS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to fetch payments."
    });
  }
}

/*
========================================
GET SINGLE PAYMENT
========================================
*/

export async function getPaymentById(
  req,
  res
) {
  try {
    const { id } =
      req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid payment ID."
      });
    }

    const payment =
      await Payment.findById(id)
        .populate(
          "bookingId",
          "status customerId workerId"
        );

    if (!payment) {
      return res.status(404).json({
        success: false,
        message:
          "Payment not found."
      });
    }

    if (
      !isAdmin(req) &&
      String(payment.userId) !==
        String(req.user.id)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to view this payment."
      });
    }

    return res.status(200).json({
      success: true,
      data: payment
    });

  } catch (error) {
    console.error(
      "GET PAYMENT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to fetch payment."
    });
  }
}

/*
========================================
ADMIN: GET ALL PAYMENTS
========================================
*/

export async function getAllPayments(
  req,
  res
) {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({
        success: false,
        message:
          "Admin access required."
      });
    }

    const {
      status,
      page,
      limit
    } = req.query;

    const filter = {};

    if (status) {
      const requestedStatus =
        normalizeText(
          status,
          50
        ).toLowerCase();

      if (
        !isSafePaymentStatus(
          requestedStatus
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid payment status."
        });
      }

      filter.status =
        requestedStatus;
    }

    const currentPage =
      parsePositiveInteger(
        page,
        1,
        100000
      );

    const pageLimit =
      parsePositiveInteger(
        limit,
        20,
        100
      );

    const skip =
      (currentPage - 1) *
      pageLimit;

    const [
      payments,
      total
    ] = await Promise.all([
      Payment.find(filter)
        .sort({
          createdAt: -1
        })
        .skip(skip)
        .limit(pageLimit)
        .populate(
          "userId",
          "name email phone"
        )
        .populate(
          "bookingId",
          "status customerId workerId"
        ),

      Payment.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,

      pagination: {
        page:
          currentPage,

        limit:
          pageLimit,

        total,

        totalPages:
          Math.max(
            1,
            Math.ceil(
              total / pageLimit
            )
          )
      },

      count:
        payments.length,

      data:
        payments
    });

  } catch (error) {
    console.error(
      "GET ALL PAYMENTS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to fetch payments."
    });
  }
}
