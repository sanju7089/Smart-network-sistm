import mongoose from "mongoose";

export const PAYMENT_STATUSES = [
  "created",
  "pending",
  "processing",
  "paid",
  "failed",
  "cancelled",
  "refunded"
];

export const PAYMENT_METHODS = [
  "razorpay",
  "cash",
  "bank_transfer"
];

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      index: true
    },

    amount: {
      type: Number,
      required: true,
      min: 1
    },

    currency: {
      type: String,
      default: "INR",
      uppercase: true,
      trim: true,
      maxlength: 10
    },

    method: {
      type: String,
      enum: PAYMENT_METHODS,
      default: "razorpay"
    },

    status: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: "created",
      index: true
    },

    /*
      IMPORTANT:
      null default is used instead of ""
      so sparse unique indexes work correctly.
    */

    razorpayOrderId: {
      type: String,
      default: null,
      trim: true,
      unique: true,
      sparse: true,
      index: true
    },

    gatewayPaymentId: {
      type: String,
      default: null,
      trim: true,
      unique: true,
      sparse: true,
      index: true
    },

    gatewaySignature: {
      type: String,
      default: null,
      trim: true,
      select: false
    },

    transactionId: {
      type: String,
      default: null,
      trim: true,
      sparse: true,
      index: true
    },

    notes: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000
    },

    /*
      Razorpay webhook event IDs.
      Used for idempotency protection.
    */

    processedWebhookEvents: {
      type: [String],
      default: [],
      select: false
    },

    paidAt: {
      type: Date,
      default: null
    },

    failedAt: {
      type: Date,
      default: null
    },

    cancelledAt: {
      type: Date,
      default: null
    },

    refundedAt: {
      type: Date,
      default: null
    },

    refundId: {
      type: String,
      default: null,
      trim: true,
      sparse: true,
      index: true
    },

    refundAmount: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  {
    timestamps: true
  }
);

paymentSchema.index({
  userId: 1,
  createdAt: -1
});

paymentSchema.index({
  bookingId: 1,
  status: 1,
  createdAt: -1
});

paymentSchema.index({
  status: 1,
  createdAt: -1
});

const Payment = mongoose.model(
  "Payment",
  paymentSchema
);

export default Payment;
