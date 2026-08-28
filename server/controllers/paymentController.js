import crypto from "crypto";
import mongoose from "mongoose";
import Razorpay from "razorpay";

import Payment from "../models/Payment.js";
import Booking from "../models/Booking.js";

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function getRazorpayClient() {
  const keyId = process.env.RAZORPAY_KEY_ID;
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

export async function createRazorpayOrder(
  req,
  res
) {
  try {
    const { bookingId } = req.body;

    if (!bookingId || !isValidId(bookingId)) {
      return res.status(400).json({
        success: false,
        message: "Valid booking ID is required."
      });
    }

    const booking = await Booking.findById(
      bookingId
    ).populate("jobId");

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found."
      });
    }

    if (
      String(booking.customerId) !==
      String(req.user.id)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to pay for this booking."
      });
    }

    if (
      ["cancelled", "rejected"].includes(
        booking.status
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Payment cannot be created for this booking."
      });
    }

    const budget = Number(
      booking.jobId?.budget
    );

    if (
      !Number.isFinite(budget) ||
      budget <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "A valid job amount is required before payment."
      });
    }

    const existingPayment =
      await Payment.findOne({
        bookingId,
        userId: req.user.id,
        status: {
          $in: [
            "created",
            "pending",
            "processing",
            "paid"
          ]
        }
      }).sort({
        createdAt: -1
      });

    if (
      existingPayment &&
      existingPayment.status === "paid"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "This booking has already been paid."
      });
    }

    const razorpay = getRazorpayClient();

    const order = await razorpay.orders.create({
      amount: Math.round(budget * 100),
      currency:
        process.env.PAYMENT_CURRENCY || "INR",
      receipt: `booking_${String(
        booking._id
      ).slice(-12)}`,
      notes: {
        bookingId: String(booking._id),
        customerId: String(req.user.id)
      }
    });

    let payment = existingPayment;

    if (payment) {
      payment.amount = budget;
      payment.currency = order.currency;
      payment.method = "razorpay";
      payment.status = "pending";
      payment.razorpayOrderId = order.id;

      await payment.save();
    } else {
      payment = await Payment.create({
        userId: req.user.id,
        bookingId: booking._id,
        amount: budget,
        currency: order.currency,
        method: "razorpay",
        status: "pending",
        razorpayOrderId: order.id,
        transactionId: order.receipt
      });
    }

    return res.status(201).json({
      success: true,
      message:
        "Payment order created successfully.",
      keyId: process.env.RAZORPAY_KEY_ID,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency
      },
      payment: {
        id: payment._id,
        bookingId: payment.bookingId,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status
      }
    });
  } catch (error) {
    console.error(
      "CREATE PAYMENT ORDER ERROR:",
      error
    );

    return res.status(error.status || 500).json({
      success: false,
      message:
        error.status
          ? error.message
          : "Unable to create payment order."
    });
  }
}

export async function verifyRazorpayPayment(
  req,
  res
) {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body;

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

    const payment = await Payment.findOne({
      razorpayOrderId: razorpay_order_id
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment record not found."
      });
    }

    if (
      String(payment.userId) !==
      String(req.user.id)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to verify this payment."
      });
    }

    if (payment.status === "paid") {
      return res.json({
        success: true,
        message:
          "Payment was already verified.",
        payment
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

    const generatedSignature = crypto
      .createHmac("sha256", secret)
      .update(
        `${razorpay_order_id}|${razorpay_payment_id}`
      )
      .digest("hex");

    const expected = Buffer.from(
      generatedSignature,
      "utf8"
    );

    const received = Buffer.from(
      razorpay_signature,
      "utf8"
    );

    if (
      expected.length !== received.length ||
      !crypto.timingSafeEqual(
        expected,
        received
      )
    ) {
      payment.status = "failed";

      await payment.save();

      return res.status(400).json({
        success: false,
        message:
          "Payment signature verification failed."
      });
    }

    payment.status = "paid";
    payment.gatewayPaymentId =
      razorpay_payment_id;
    payment.gatewaySignature =
      razorpay_signature;
    payment.paidAt = new Date();

    await payment.save();

    const booking = await Booking.findById(
      payment.bookingId
    );

    if (
      booking &&
      booking.status === "pending"
    ) {
      booking.status = "confirmed";

      await booking.save();
    }

    return res.json({
      success: true,
      message:
        "Payment verified successfully.",
      payment: {
        id: payment._id,
        bookingId: payment.bookingId,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        paidAt: payment.paidAt
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

export async function getMyPayments(req, res) {
  try {
    const payments = await Payment.find({
      userId: req.user.id
    })
      .sort({ createdAt: -1 })
      .populate(
        "bookingId",
        "status date"
      );

    return res.json({
      success: true,
      count: payments.length,
      data: payments
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
