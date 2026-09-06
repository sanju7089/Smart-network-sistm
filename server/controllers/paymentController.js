import crypto from "crypto";
import Razorpay from "razorpay";
import mongoose from "mongoose";

import Payment from "../models/Payment.js";
import Booking from "../models/Booking.js";

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function getRequiredEnv(name) {
  const value = String(process.env[name] || "").trim();

  if (!value) {
    const error = new Error(`${name} is not configured.`);
    error.statusCode = 500;
    throw error;
  }

  return value;
}

function getCurrency() {
  const currency = String(
    process.env.PAYMENT_CURRENCY || "INR"
  )
    .trim()
    .toUpperCase();

  if (!/^[A-Z]{3}$/.test(currency)) {
    const error = new Error(
      "PAYMENT_CURRENCY must be a valid 3-letter currency code."
    );
    error.statusCode = 500;
    throw error;
  }

  return currency;
}

function getRazorpayClient() {
  return new Razorpay({
    key_id: getRequiredEnv("RAZORPAY_KEY_ID"),
    key_secret: getRequiredEnv("RAZORPAY_KEY_SECRET")
  });
}

function normalizeText(value, maxLength = 2000) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function safeTimingCompare(received, expected) {
  const receivedBuffer = Buffer.from(
    String(received || ""),
    "utf8"
  );

  const expectedBuffer = Buffer.from(
    String(expected || ""),
    "utf8"
  );

  if (receivedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    receivedBuffer,
    expectedBuffer
  );
}

function isAdmin(req) {
  return req.user?.role === "admin";
}

function isCustomer(req, booking) {
  return (
    req.user?.role === "customer" &&
    String(booking.customerId) === String(req.user.id)
  );
}

function canAccessBooking(req, booking) {
  return isAdmin(req) || isCustomer(req, booking);
}

function toPaise(amount) {
  const numericAmount = Number(amount);

  if (
    !Number.isFinite(numericAmount) ||
    numericAmount <= 0
  ) {
    return null;
  }

  const paise = Math.round(numericAmount * 100);

  if (
    !Number.isSafeInteger(paise) ||
    paise < 100
  ) {
    return null;
  }

  return paise;
}

function makeReceipt(bookingId) {
  const clean = String(bookingId || "").replace(
    /[^a-zA-Z0-9_-]/g,
    ""
  );

  return `SWN-${clean}-${Date.now().toString(36)}`.slice(0, 40);
}

function sanitizePayment(payment) {
  if (!payment) {
    return payment;
  }

  const data = payment.toObject
    ? payment.toObject()
    : { ...payment };

  delete data.gatewaySignature;
  delete data.processedWebhookEvents;

  return data;
}

async function populatePayment(payment) {
  return Payment.findById(payment._id)
    .populate(
      "bookingId",
      "jobId customerId workerId status date notes customerMessage workerMessage"
    )
    .populate(
      "userId",
      "name email phone"
    );
}

function isDuplicateKeyError(error) {
  return error?.code === 11000;
}

function isValidationError(error) {
  return error?.name === "ValidationError";
}

function isCastError(error) {
  return error?.name === "CastError";
}

function getValidationErrors(error) {
  const errors = {};

  for (const [field, value] of Object.entries(
    error?.errors || {}
  )) {
    errors[field] = value?.message || "Invalid value.";
  }

  return errors;
}

async function findActiveRazorpayPayment(booking) {
  return Payment.findOne({
    bookingId: booking._id,
    userId: booking.customerId,
    method: "razorpay",
    status: {
      $in: ["created", "pending", "processing"]
    }
  }).sort({
    createdAt: -1
  });
}

/*
==================================================
CREATE RAZORPAY ORDER
==================================================
*/

export async function createRazorpayOrder(req, res) {
  let reservation = null;
  let razorpayOrderCreated = false;
  let razorpayOrderId = null;

  try {
    const { bookingId } = req.body || {};

    if (!isValidId(bookingId)) {
      return res.status(400).json({
        success: false,
        message: "Valid booking ID is required."
      });
    }

    const booking = await Booking.findById(bookingId).populate(
      "jobId",
      "title budget customerId status"
    );

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found."
      });
    }

    if (!canAccessBooking(req, booking)) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to pay for this booking."
      });
    }

    if (!["accepted", "confirmed"].includes(booking.status)) {
      return res.status(409).json({
        success: false,
        message:
          "Payment is available only after the worker accepts the booking."
      });
    }

    if (!booking.jobId) {
      return res.status(409).json({
        success: false,
        message:
          "The job associated with this booking was not found."
      });
    }

    const amount = toPaise(Number(booking.jobId.budget));

    if (amount === null) {
      return res.status(409).json({
        success: false,
        message:
          "This booking does not have a valid payable amount."
      });
    }

    const currency = getCurrency();

    const existingPayment =
      await findActiveRazorpayPayment(booking);

    if (existingPayment) {
      if (!existingPayment.razorpayOrderId) {
        return res.status(409).json({
          success: false,
          message:
            "A payment order is currently being created. Please try again shortly."
        });
      }

      if (
        Number(existingPayment.amount) !== amount ||
        String(existingPayment.currency).toUpperCase() !==
          currency
      ) {
        return res.status(409).json({
          success: false,
          message:
            "An active payment order exists with different payment details. Please contact support."
        });
      }

      return res.status(200).json({
        success: true,
        message: "Existing Razorpay order returned.",
        data: {
          payment: sanitizePayment(existingPayment),
          order: {
            id: existingPayment.razorpayOrderId,
            amount: existingPayment.amount,
            currency: existingPayment.currency
          }
        }
      });
    }

    try {
      reservation = await Payment.create({
        userId: booking.customerId,
        bookingId: booking._id,
        amount,
        currency,
        method: "razorpay",
        status: "processing",
        razorpayOrderId: null,
        notes: "Smart Work Network Razorpay payment"
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        const duplicate =
          await findActiveRazorpayPayment(booking);

        if (duplicate?.razorpayOrderId) {
          return res.status(200).json({
            success: true,
            message:
              "Existing Razorpay order returned.",
            data: {
              payment: sanitizePayment(duplicate),
              order: {
                id: duplicate.razorpayOrderId,
                amount: duplicate.amount,
                currency: duplicate.currency
              }
            }
          });
        }

        return res.status(409).json({
          success: false,
          message:
            "A payment order is already being created. Please try again shortly."
        });
      }

      if (isValidationError(error)) {
        return res.status(400).json({
          success: false,
          message: "Invalid payment data.",
          errors: getValidationErrors(error)
        });
      }

      throw error;
    }

    const razorpay = getRazorpayClient();

    let order;

    try {
      order = await razorpay.orders.create({
        amount,
        currency,
        receipt: makeReceipt(booking._id),
        notes: {
          bookingId: String(booking._id),
          customerId: String(booking.customerId)
        }
      });
    } catch (gatewayError) {
      console.error(
        "RAZORPAY ORDER CREATE ERROR:",
        gatewayError
      );

      throw Object.assign(
        new Error(
          "Unable to create Razorpay order. Please try again."
        ),
        {
          statusCode: 502
        }
      );
    }

    if (!order?.id) {
      throw Object.assign(
        new Error(
          "Razorpay did not return an order ID."
        ),
        {
          statusCode: 502
        }
      );
    }

    razorpayOrderCreated = true;
    razorpayOrderId = String(order.id);

    reservation.razorpayOrderId = razorpayOrderId;
    reservation.status = "created";

    try {
      await reservation.save();
    } catch (saveError) {
      /*
      IMPORTANT:

      Razorpay order already exists, but local database
      save failed. The reservation MUST still be marked
      failed. Otherwise it remains processing with a null
      order ID and blocks future payment attempts.
      */

      console.error(
        "PAYMENT RESERVATION SAVE ERROR:",
        saveError
      );

      try {
        await Payment.findOneAndUpdate(
          {
            _id: reservation._id
          },
          {
            $set: {
              status: "failed",
              failedAt: new Date(),
              razorpayOrderId: razorpayOrderId
            }
          },
          {
            new: true
          }
        );
      } catch (rollbackError) {
        console.error(
          "PAYMENT RESERVATION SAVE ROLLBACK ERROR:",
          rollbackError
        );
      }

      if (isDuplicateKeyError(saveError)) {
        return res.status(409).json({
          success: false,
          message:
            "This payment could not be safely saved. Please try again."
        });
      }

      if (isValidationError(saveError)) {
        return res.status(400).json({
          success: false,
          message:
            "Payment data could not be saved.",
          errors: getValidationErrors(saveError)
        });
      }

      throw Object.assign(
        new Error(
          "Payment order was created but could not be saved safely. Please try again."
        ),
        {
          statusCode: 500
        }
      );
    }

    return res.status(201).json({
      success: true,
      message:
        "Razorpay order created successfully.",
      data: {
        payment: sanitizePayment(reservation),
        order: {
          id: order.id,
          amount: order.amount,
          currency: order.currency
        }
      }
    });
  } catch (error) {
    console.error(
      "CREATE RAZORPAY ORDER ERROR:",
      error
    );

    /*
    If a reservation exists and Razorpay order creation
    itself failed, release the processing reservation.

    If Razorpay order was successfully created, do not
    pretend it was never created. Keep the local order ID
    when possible and mark the payment failed.
    */

    if (reservation?._id) {
      try {
        await Payment.findOneAndUpdate(
          {
            _id: reservation._id,
            status: "processing"
          },
          {
            $set: {
              status: "failed",
              failedAt: new Date(),
              ...(razorpayOrderId
                ? {
                    razorpayOrderId:
                      razorpayOrderId
                  }
                : {})
            }
          }
        );
      } catch (rollbackError) {
        console.error(
          "PAYMENT RESERVATION ROLLBACK ERROR:",
          rollbackError
        );
      }
    }

    if (isDuplicateKeyError(error)) {
      return res.status(409).json({
        success: false,
        message:
          "This payment already exists."
      });
    }

    if (isValidationError(error)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment data.",
        errors: getValidationErrors(error)
      });
    }

    if (isCastError(error)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment data."
      });
    }

    const status =
      Number.isInteger(error?.statusCode) &&
      error.statusCode >= 400 &&
      error.statusCode <= 599
        ? error.statusCode
        : 500;

    return res.status(status).json({
      success: false,
      message:
        status >= 500
          ? "Unable to create Razorpay order."
          : error.message
    });
  }
}

/*
==================================================
VERIFY RAZORPAY PAYMENT
==================================================
*/

export async function verifyRazorpayPayment(req, res) {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body || {};

    const orderId = String(
      razorpay_order_id || ""
    ).trim();

    const paymentId = String(
      razorpay_payment_id || ""
    ).trim();

    const signature = String(
      razorpay_signature || ""
    ).trim();

    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({
        success: false,
        message:
          "Razorpay payment verification details are required."
      });
    }

    if (
      orderId.length > 100 ||
      paymentId.length > 100 ||
      signature.length > 200
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid Razorpay payment verification data."
      });
    }

    const payment = await Payment.findOne({
      razorpayOrderId: orderId
    }).select("+gatewaySignature");

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment order not found."
      });
    }

    const booking = await Booking.findById(
      payment.bookingId
    );

    if (!booking) {
      return res.status(404).json({
        success: false,
        message:
          "Booking associated with payment was not found."
      });
    }

    if (!canAccessBooking(req, booking)) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to verify this payment."
      });
    }

    if (payment.status === "paid") {
      if (
        String(payment.gatewayPaymentId) ===
        paymentId
      ) {
        return res.status(200).json({
          success: true,
          message:
            "Payment was already verified.",
          data: {
            payment:
              sanitizePayment(payment),
            booking: {
              id: booking._id,
              status: booking.status,
              confirmedAt:
                booking.confirmedAt
            }
          }
        });
      }

      return res.status(409).json({
        success: false,
        message:
          "This payment order has already been completed with a different payment."
      });
    }

    if (
      ["failed", "cancelled", "refunded"].includes(
        payment.status
      )
    ) {
      return res.status(409).json({
        success: false,
        message:
          "This payment is no longer available for verification."
      });
    }

    const secret = getRequiredEnv(
      "RAZORPAY_KEY_SECRET"
    );

    const generatedSignature =
      crypto
        .createHmac("sha256", secret)
        .update(
          `${orderId}|${paymentId}`,
          "utf8"
        )
        .digest("hex");

    if (
      !safeTimingCompare(
        signature,
        generatedSignature
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid Razorpay payment signature."
      });
    }

    if (
      String(payment.razorpayOrderId) !==
      orderId
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Razorpay order mismatch."
      });
    }

    const razorpay = getRazorpayClient();

    let gatewayPayment;

    try {
      gatewayPayment =
        await razorpay.payments.fetch(
          paymentId
        );
    } catch (gatewayError) {
      console.error(
        "RAZORPAY PAYMENT FETCH ERROR:",
        gatewayError
      );

      return res.status(502).json({
        success: false,
        message:
          "Unable to verify payment with Razorpay. Please try again."
      });
    }

    if (!gatewayPayment?.id) {
      return res.status(400).json({
        success: false,
        message:
          "Razorpay returned an invalid payment record."
      });
    }

    if (
      String(gatewayPayment.id) !==
      paymentId
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Razorpay payment ID mismatch."
      });
    }

    if (
      String(
        gatewayPayment.order_id || ""
      ) !== orderId
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Razorpay payment does not belong to this order."
      });
    }

    const gatewayAmount =
      Number(gatewayPayment.amount);

    const databaseAmount =
      Number(payment.amount);

    if (
      !Number.isSafeInteger(gatewayAmount) ||
      gatewayAmount <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Razorpay returned an invalid payment amount."
      });
    }

    if (gatewayAmount !== databaseAmount) {
      return res.status(400).json({
        success: false,
        message:
          "Payment amount verification failed."
      });
    }

    const databaseCurrency =
      String(payment.currency || "")
        .trim()
        .toUpperCase();

    const gatewayCurrency =
      String(
        gatewayPayment.currency || ""
      )
        .trim()
        .toUpperCase();

    if (
      !databaseCurrency ||
      !gatewayCurrency ||
      databaseCurrency !== gatewayCurrency
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Payment currency verification failed."
      });
    }

    const gatewayStatus =
      String(
        gatewayPayment.status || ""
      )
        .trim()
        .toLowerCase();

    if (gatewayStatus !== "captured") {
      return res.status(409).json({
        success: false,
        message:
          "Payment has not been captured by Razorpay yet."
      });
    }

    const paymentAlreadyUsed =
      await Payment.findOne({
        gatewayPaymentId: paymentId,
        _id: {
          $ne: payment._id
        }
      }).select(
        "_id bookingId status"
      );

    if (paymentAlreadyUsed) {
      return res.status(409).json({
        success: false,
        message:
          "This Razorpay payment has already been associated with another payment."
      });
    }

    const now = new Date();

    const claimedPayment =
      await Payment.findOneAndUpdate(
        {
          _id: payment._id,
          status: {
            $in: [
              "created",
              "pending",
              "processing"
            ]
          },
          $or: [
            {
              gatewayPaymentId: {
                $exists: false
              }
            },
            {
              gatewayPaymentId: null
            },
            {
              gatewayPaymentId: ""
            }
          ]
        },
        {
          $set: {
            gatewayPaymentId: paymentId,
            gatewaySignature: signature,
            transactionId: paymentId,
            status: "paid",
            paidAt:
              payment.paidAt || now
          }
        },
        {
          new: true
        }
      );

    if (!claimedPayment) {
      const latestPayment =
        await Payment.findById(
          payment._id
        );

      if (
        latestPayment?.status === "paid" &&
        String(
          latestPayment.gatewayPaymentId
        ) === paymentId
      ) {
        return res.status(200).json({
          success: true,
          message:
            "Payment was already verified.",
          data: {
            payment:
              sanitizePayment(
                latestPayment
              ),
            booking: {
              id: booking._id,
              status:
                booking.status,
              confirmedAt:
                booking.confirmedAt
            }
          }
        });
      }

      if (
        latestPayment?.status === "paid" &&
        String(
          latestPayment.gatewayPaymentId
        ) !== paymentId
      ) {
        return res.status(409).json({
          success: false,
          message:
            "This payment order has already been completed with a different payment."
        });
      }

      return res.status(409).json({
        success: false,
        message:
          "Payment verification is already being processed. Please try again shortly."
      });
    }

    let finalBooking = booking;

    if (booking.status === "accepted") {
      const updatedBooking =
        await Booking.findOneAndUpdate(
          {
            _id: booking._id,
            status: "accepted"
          },
          {
            $set: {
              status: "confirmed",
              confirmedAt:
                booking.confirmedAt ||
                now
            }
          },
          {
            new: true
          }
        );

      if (updatedBooking) {
        finalBooking =
          updatedBooking;
      } else {
        const currentBooking =
          await Booking.findById(
            booking._id
          );

        if (currentBooking) {
          finalBooking =
            currentBooking;
        }
      }
    }

    return res.status(200).json({
      success: true,
      message:
        "Payment verified successfully.",
      data: {
        payment:
          sanitizePayment(
            claimedPayment
          ),
        booking: {
          id:
            finalBooking._id,
          status:
            finalBooking.status,
          confirmedAt:
            finalBooking.confirmedAt
        }
      }
    });
  } catch (error) {
    console.error(
      "VERIFY RAZORPAY PAYMENT ERROR:",
      error
    );

    if (isDuplicateKeyError(error)) {
      return res.status(409).json({
        success: false,
        message:
          "This Razorpay payment has already been processed."
      });
    }

    if (isValidationError(error)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid payment data.",
        errors:
          getValidationErrors(error)
      });
    }

    if (isCastError(error)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid payment data."
      });
    }

    const status =
      Number.isInteger(error?.statusCode) &&
      error.statusCode >= 400 &&
      error.statusCode <= 599
        ? error.statusCode
        : 500;

    return res.status(status).json({
      success: false,
      message:
        status >= 500
          ? "Unable to verify payment."
          : error.message
    });
  }
}

/*
==================================================
GET MY PAYMENTS
==================================================
*/

export async function getMyPayments(req, res) {
  try {
    const page = Math.max(
      1,
      Math.min(
        Number.parseInt(req.query.page, 10) || 1,
        100000
      )
    );

    const limit = Math.max(
      1,
      Math.min(
        Number.parseInt(req.query.limit, 10) || 20,
        100
      )
    );

    const skip = (page - 1) * limit;

    const filter = isAdmin(req)
      ? {}
      : {
          userId: req.user.id
        };

    const [payments, total] =
      await Promise.all([
        Payment.find(filter)
          .sort({
            createdAt: -1
          })
          .skip(skip)
          .limit(limit)
          .populate(
            "bookingId",
            "jobId customerId workerId status date notes"
          )
          .populate(
            "userId",
            "name email phone"
          ),

        Payment.countDocuments(filter)
      ]);

    return res.status(200).json({
      success: true,
      pagination: {
        page,
        limit,
        total,
        totalPages:
          Math.max(
            1,
            Math.ceil(total / limit)
          )
      },
      count: payments.length,
      data: payments.map(
        sanitizePayment
      )
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
==================================================
GET PAYMENT BY ID
==================================================
*/

export async function getPaymentById(req, res) {
  try {
    const { id } = req.params;

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
          "jobId customerId workerId status date notes"
        )
        .populate(
          "userId",
          "name email phone"
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
      String(
        payment.userId?._id ||
          payment.userId
      ) !==
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
      data:
        sanitizePayment(payment)
    });
  } catch (error) {
    console.error(
      "GET PAYMENT ERROR:",
      error
    );

    if (isCastError(error)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid payment ID."
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Unable to fetch payment."
    });
  }
}

/*
==================================================
GET ALL PAYMENTS
==================================================
*/

export async function getAllPayments(req, res) {
  try {
    const page = Math.max(
      1,
      Math.min(
        Number.parseInt(
          req.query.page,
          10
        ) || 1,
        100000
      )
    );

    const limit = Math.max(
      1,
      Math.min(
        Number.parseInt(
          req.query.limit,
          10
        ) || 50,
        100
      )
    );

    const skip =
      (page - 1) * limit;

    const filter = {};

    if (req.query.status) {
      const status =
        normalizeText(
          req.query.status,
          50
        ).toLowerCase();

      const allowedStatuses = [
        "created",
        "pending",
        "processing",
        "paid",
        "failed",
        "cancelled",
        "refunded"
      ];

      if (
        !allowedStatuses.includes(
          status
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid payment status."
        });
      }

      filter.status = status;
    }

    const [payments, total] =
      await Promise.all([
        Payment.find(filter)
          .sort({
            createdAt: -1
          })
          .skip(skip)
          .limit(limit)
          .populate(
            "bookingId",
            "jobId customerId workerId status date notes"
          )
          .populate(
            "userId",
            "name email phone"
          ),

        Payment.countDocuments(
          filter
        )
      ]);

    return res.status(200).json({
      success: true,
      pagination: {
        page,
        limit,
        total,
        totalPages:
          Math.max(
            1,
            Math.ceil(
              total / limit
            )
          )
      },
      count: payments.length,
      data: payments.map(
        sanitizePayment
      )
    });
  } catch (error) {
    console.error(
      "GET ALL PAYMENTS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to fetch all payments."
    });
  }
}

/*
==================================================
RAZORPAY WEBHOOK
==================================================
*/

export async function razorpayWebhook(req, res) {
  try {
    const signature =
      String(
        req.headers[
          "x-razorpay-signature"
        ] || ""
      ).trim();

    if (!signature) {
      return res.status(400).json({
        success: false,
        message:
          "Razorpay webhook signature is required."
      });
    }

    const secret =
      getRequiredEnv(
        "RAZORPAY_WEBHOOK_SECRET"
      );

    const rawBody =
      Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(
            String(
              req.body || ""
            ),
            "utf8"
          );

    if (!rawBody.length) {
      return res.status(400).json({
        success: false,
        message:
          "Empty webhook payload."
      });
    }

    const expectedSignature =
      crypto
        .createHmac(
          "sha256",
          secret
        )
        .update(rawBody)
        .digest("hex");

    if (
      !safeTimingCompare(
        signature,
        expectedSignature
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid webhook signature."
      });
    }

    let payload;

    try {
      payload =
        JSON.parse(
          rawBody.toString("utf8")
        );
    } catch {
      return res.status(400).json({
        success: false,
        message:
          "Invalid webhook payload."
      });
    }

    const event =
      String(
        payload?.event || ""
      ).trim();

    const eventId =
      String(
        req.headers[
          "x-razorpay-event-id"
        ] ||
          payload?.event_id ||
          ""
      ).trim();

    if (!event) {
      return res.status(400).json({
        success: false,
        message:
          "Webhook event is required."
      });
    }

    if (!eventId) {
      return res.status(400).json({
        success: false,
        message:
          "Razorpay webhook event ID is required."
      });
    }

    if (eventId.length > 200) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid Razorpay webhook event ID."
      });
    }

    const paymentEntity =
      payload?.payload?.payment
        ?.entity;

    const orderId =
      paymentEntity?.order_id
        ? String(
            paymentEntity.order_id
          )
        : null;

    const paymentId =
      paymentEntity?.id
        ? String(
            paymentEntity.id
          )
        : null;

    const refundEntity =
      payload?.payload?.refund
        ?.entity;

    const refundPaymentId =
      refundEntity?.payment_id
        ? String(
            refundEntity.payment_id
          )
        : null;

    if (
      !orderId &&
      !refundPaymentId
    ) {
      return res.status(200).json({
        success: true,
        message:
          "Webhook received without a payment reference."
      });
    }

    let payment = null;

    if (orderId) {
      payment =
        await Payment.findOne({
          razorpayOrderId:
            orderId
        }).select(
          "+processedWebhookEvents +gatewaySignature"
        );
    }

    if (
      !payment &&
      refundPaymentId
    ) {
      payment =
        await Payment.findOne({
          gatewayPaymentId:
            refundPaymentId
        }).select(
          "+processedWebhookEvents +gatewaySignature"
        );
    }

    if (!payment) {
      return res.status(200).json({
        success: true,
        message:
          "Webhook received for an unknown payment."
      });
    }

    if (event === "payment.captured") {
      if (
        !paymentEntity ||
        !paymentId ||
        !orderId
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Captured payment webhook is missing required payment data."
        });
      }

      const gatewayAmount =
        Number(
          paymentEntity.amount
        );

      const localAmount =
        Number(payment.amount);

      if (
        !Number.isSafeInteger(
          gatewayAmount
        ) ||
        gatewayAmount <= 0 ||
        gatewayAmount !==
          localAmount
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Webhook payment amount verification failed."
        });
      }

      const gatewayCurrency =
        String(
          paymentEntity.currency ||
            ""
        )
          .trim()
          .toUpperCase();

      const localCurrency =
        String(
          payment.currency ||
            ""
        )
          .trim()
          .toUpperCase();

      if (
        !gatewayCurrency ||
        !localCurrency ||
        gatewayCurrency !==
          localCurrency
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Webhook payment currency verification failed."
        });
      }

      if (
        String(
          paymentEntity.order_id
        ) !==
        String(
          payment.razorpayOrderId
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Webhook order does not match the stored payment."
        });
      }

      if (
        String(
          paymentEntity.id
        ) !==
        paymentId
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Webhook payment ID mismatch."
        });
      }

      const paymentAlreadyUsed =
        await Payment.findOne({
          gatewayPaymentId:
            paymentId,
          _id: {
            $ne:
              payment._id
          }
        }).select(
          "_id bookingId status"
        );

      if (
        paymentAlreadyUsed
      ) {
        return res.status(409).json({
          success: false,
          message:
            "This Razorpay payment has already been associated with another payment."
        });
      }

      const now =
        new Date();

      const updatedPayment =
        await Payment.findOneAndUpdate(
          {
            _id:
              payment._id,

            processedWebhookEvents: {
              $ne:
                eventId
            },

            status: {
              $nin: [
                "refunded"
              ]
            }
          },
          {
            $set: {
              status:
                "paid",

              paidAt:
                payment.paidAt ||
                now,

              gatewayPaymentId:
                paymentId,

              transactionId:
                paymentId
            },

            $addToSet: {
              processedWebhookEvents:
                eventId
            }
          },
          {
            new: true
          }
        );

      let currentPayment =
        updatedPayment;

      if (!currentPayment) {
        currentPayment =
          await Payment.findById(
            payment._id
          );

        if (!currentPayment) {
          return res.status(500).json({
            success: false,
            message:
              "Payment record disappeared while processing the webhook."
          });
        }

        if (
          currentPayment.status ===
          "refunded"
        ) {
          return res.status(200).json({
            success: true,
            message:
              "Captured event ignored because the payment is already refunded."
          });
        }

        if (
          currentPayment.status !==
          "paid"
        ) {
          return res.status(500).json({
            success: false,
            message:
              "Payment webhook state could not be reconciled safely."
          });
        }

        if (
          String(
            currentPayment.gatewayPaymentId
          ) !==
          paymentId
        ) {
          return res.status(409).json({
            success: false,
            message:
              "Stored payment ID does not match the captured Razorpay payment."
          });
        }
      }

      const bookingUpdate =
        await Booking.findOneAndUpdate(
          {
            _id:
              currentPayment.bookingId,

            status:
              "accepted"
          },
          {
            $set: {
              status:
                "confirmed",

              confirmedAt:
                now
            }
          },
          {
            new: true
          }
        );

      if (!bookingUpdate) {
        const currentBooking =
          await Booking.findById(
            currentPayment.bookingId
          );

        if (!currentBooking) {
          throw new Error(
            "Booking associated with captured payment was not found."
          );
        }

        if (
          currentBooking.status !==
          "confirmed"
        ) {
          throw new Error(
            `Captured payment could not confirm booking. Current booking status: ${currentBooking.status}`
          );
        }
      }
    } else if (
      event ===
      "payment.authorized"
    ) {
      const recorded =
        await Payment.findOneAndUpdate(
          {
            _id:
              payment._id,

            processedWebhookEvents: {
              $ne:
                eventId
            }
          },
          {
            $addToSet: {
              processedWebhookEvents:
                eventId
            }
          },
          {
            new: true
          }
        );

      if (!recorded) {
        return res.status(200).json({
          success: true,
          message:
            "Webhook already processed."
        });
      }
    } else if (
      event ===
      "payment.failed"
    ) {
      const failedPayment =
        await Payment.findOneAndUpdate(
          {
            _id:
              payment._id,

            processedWebhookEvents: {
              $ne:
                eventId
            },

            status: {
              $nin: [
                "paid",
                "refunded"
              ]
            }
          },
          {
            $set: {
              status:
                "failed",

              failedAt:
                payment.failedAt ||
                new Date(),

              ...(paymentId
                ? {
                    gatewayPaymentId:
                      paymentId
                  }
                : {})
            },

            $addToSet: {
              processedWebhookEvents:
                eventId
            }
          },
          {
            new: true
          }
        );

      if (!failedPayment) {
        const currentPayment =
          await Payment.findById(
            payment._id
          ).select(
            "+processedWebhookEvents"
          );

        if (
          currentPayment?.processedWebhookEvents?.includes(
            eventId
          )
        ) {
          return res.status(200).json({
            success: true,
            message:
              "Webhook already processed."
          });
        }

        if (
          [
            "paid",
            "refunded"
          ].includes(
            currentPayment?.status
          )
        ) {
          return res.status(200).json({
            success: true,
            message:
              "Late payment failure ignored because the payment is already settled."
          });
        }

        throw new Error(
          "Payment failure webhook could not be processed safely."
        );
      }
    } else if (
      event ===
      "refund.processed"
    ) {
      if (!refundEntity) {
        return res.status(400).json({
          success: false,
          message:
            "Refund webhook data is missing."
        });
      }

      if (
        refundPaymentId &&
        String(
          refundPaymentId
        ) !==
          String(
            payment.gatewayPaymentId
          )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Refund payment does not match the stored payment."
        });
      }

      const refundCurrency =
        String(
          refundEntity.currency ||
            ""
        )
          .trim()
          .toUpperCase();

      const localCurrency =
        String(
          payment.currency ||
            ""
        )
          .trim()
          .toUpperCase();

      if (
        refundCurrency &&
        refundCurrency !==
          localCurrency
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Refund currency does not match the payment currency."
        });
      }

      let refundAmount = null;

      if (
        refundEntity.amount !==
        undefined
      ) {
        refundAmount =
          Number(
            refundEntity.amount
          );

        if (
          !Number.isSafeInteger(
            refundAmount
          ) ||
          refundAmount <= 0 ||
          refundAmount >
            Number(payment.amount)
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid refund amount."
          });
        }
      }

      const refundedPayment =
        await Payment.findOneAndUpdate(
          {
            _id:
              payment._id,

            processedWebhookEvents: {
              $ne:
                eventId
            }
          },
          {
            $set: {
              status:
                "refunded",

              refundedAt:
                payment.refundedAt ||
                new Date(),

              ...(refundEntity?.id
                ? {
                    refundId:
                      String(
                        refundEntity.id
                      )
                  }
                : {}),

              ...(refundAmount !==
              null
                ? {
                    refundAmount
                  }
                : {})
            },

            $addToSet: {
              processedWebhookEvents:
                eventId
            }
          },
          {
            new: true
          }
        );

      if (!refundedPayment) {
        return res.status(200).json({
          success: true,
          message:
            "Webhook already processed."
        });
      }
    } else {
      const recorded =
        await Payment.findOneAndUpdate(
          {
            _id:
              payment._id,

            processedWebhookEvents: {
              $ne:
                eventId
            }
          },
          {
            $addToSet: {
              processedWebhookEvents:
                eventId
            }
          },
          {
            new: true
          }
        );

      if (!recorded) {
        return res.status(200).json({
          success: true,
          message:
            "Webhook already processed."
        });
      }
    }

    return res.status(200).json({
      success: true,
      message:
        "Razorpay webhook processed successfully."
    });
  } catch (error) {
    console.error(
      "RAZORPAY WEBHOOK ERROR:",
      error
    );

    if (isDuplicateKeyError(error)) {
      return res.status(409).json({
        success: false,
        message:
          "Payment webhook was already processed."
      });
    }

    if (isValidationError(error)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid payment webhook data.",
        errors:
          getValidationErrors(error)
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Unable to process Razorpay webhook."
    });
  }
}
