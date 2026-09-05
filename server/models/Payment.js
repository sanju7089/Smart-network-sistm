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
    ========================================
    RAZORPAY ORDER ID
    ========================================
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
    ========================================
    RAZORPAY WEBHOOK IDEMPOTENCY
    ========================================
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

/*
========================================
NORMAL INDEXES
========================================
*/

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

/*
========================================
IMPORTANT:
ONLY ONE ACTIVE RAZORPAY PAYMENT
PER BOOKING

This protects against two simultaneous
order-creation requests creating multiple
active payment records for the same booking.

Terminal states:
paid / failed / cancelled / refunded

can have historical records.

Active states:
created / pending / processing

allow only one record.
========================================
*/

paymentSchema.index(
  {
    bookingId: 1,
    method: 1
  },
  {
    unique: true,
    partialFilterExpression: {
      method: "razorpay",
      status: {
        $in: [
          "created",
          "pending",
          "processing"
        ]
      }
    }
  }
);

const Payment = mongoose.model(
  "Payment",
  paymentSchema
);

export default Payment;
