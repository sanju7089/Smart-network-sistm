import mongoose from "mongoose";
import Payment from "../models/Payment.js";
import Booking from "../models/Booking.js";

const VALID_METHODS = [
  "razorpay",
  "stripe",
  "cash",
  "bank_transfer",
  "other",
  "pending"
];

const VALID_STATUSES = [
  "pending",
  "processing",
  "paid",
  "failed",
  "cancelled",
  "refunded"
];

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function isAdmin(user) {
  return user?.role === "admin";
}

export async function getPayments(req, res) {
  try {
    const filter = isAdmin(req.user)
      ? {}
      : { userId: req.user.id };

    const payments = await Payment.find(filter)
      .sort({ createdAt: -1 })
      .populate("userId", "name email role")
      .populate("bookingId", "status date notes");

    return res.json({
      success: true,
      count: payments.length,
      data: payments
    });
  } catch (error) {
    console.error("GET PAYMENTS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch payments."
    });
  }
}

export async function getPaymentById(req, res) {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment ID."
      });
    }

    const payment = await Payment.findById(id)
      .populate("userId", "name email role")
      .populate("bookingId", "status date notes");

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found."
      });
    }

    if (
      !isAdmin(req.user) &&
      String(payment.userId._id) !== String(req.user.id)
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to view this payment."
      });
    }

    return res.json({
      success: true,
      data: payment
    });
  } catch (error) {
    console.error("GET PAYMENT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch payment."
    });
  }
}

export async function createPayment(req, res) {
  try {
    const {
      amount,
      bookingId,
      method,
      currency,
      notes
    } = req.body;

    const numericAmount = Number(amount);

    if (
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid payment amount is required."
      });
    }

    const selectedMethod = method || "pending";

    if (!VALID_METHODS.includes(selectedMethod)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method."
      });
    }

    let validBookingId = null;

    if (bookingId) {
      if (!isValidId(bookingId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid booking ID."
        });
      }

      const booking = await Booking.findById(bookingId);

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: "Booking not found."
        });
      }

      if (
        !isAdmin(req.user) &&
        String(booking.customerId) !== String(req.user.id)
      ) {
        return res.status(403).json({
          success: false,
          message: "You can only pay for your own booking."
        });
      }

      validBookingId = booking._id;
    }

    const payment = await Payment.create({
      userId: req.user.id,
      bookingId: validBookingId,
      amount: numericAmount,
      currency: currency
        ? String(currency).trim().toUpperCase()
        : "INR",
      method: selectedMethod,
      status: "pending",
      notes: notes ? String(notes).trim() : ""
    });

    return res.status(201).json({
      success: true,
      message: "Payment record created successfully.",
      data: payment
    });
  } catch (error) {
    console.error("CREATE PAYMENT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create payment."
    });
  }
}

export async function updatePaymentStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, transactionId, gatewayPaymentId } = req.body;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment ID."
      });
    }

    if (!isAdmin(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Only admins can update payment status."
      });
    }

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment status."
      });
    }

    const payment = await Payment.findById(id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found."
      });
    }

    payment.status = status;

    if (transactionId !== undefined) {
      payment.transactionId = String(transactionId).trim();
    }

    if (gatewayPaymentId !== undefined) {
      payment.gatewayPaymentId = String(gatewayPaymentId).trim();
    }

    await payment.save();

    return res.json({
      success: true,
      message: "Payment status updated successfully.",
      data: payment
    });
  } catch (error) {
    console.error("UPDATE PAYMENT STATUS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update payment."
    });
  }
  }
