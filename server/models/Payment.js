import mongoose from "mongoose";

import {
  notifyPaymentEvent
} from "../services/notificationService.js";

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

const paymentSchema =
  new mongoose.Schema(
    {
      userId: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
      },

      bookingId: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "Booking",
        required: true
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

      razorpayOrderId: {
        type: String,
        default: null,
        trim: true,
        unique: true,
        sparse: true
      },

      gatewayPaymentId: {
        type: String,
        default: null,
        trim: true,
        unique: true,
        sparse: true
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
        sparse: true
      },

      notes: {
        type: String,
        default: "",
        trim: true,
        maxlength: 2000
      },

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
        sparse: true
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

paymentSchema.index(
  {
    transactionId: 1
  },
  {
    unique: true,
    sparse: true
  }
);

paymentSchema.index(
  {
    refundId: 1
  },
  {
    unique: true,
    sparse: true
  }
);

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

/*
========================================
NOTIFICATION TRIGGER STATE
========================================
*/

paymentSchema.pre(
  "save",
  function (next) {
    this.$notificationStatusChanged =
      this.isModified("status");

    next();
  }
);

/*
========================================
AUTOMATIC PAYMENT NOTIFICATIONS
========================================
*/

paymentSchema.post(
  "save",
  async function (payment) {
    try {
      if (
        payment.$notificationStatusChanged
      ) {
        await notifyPaymentEvent(
          payment
        );
      }
    } catch (error) {
      console.error(
        "PAYMENT POST-SAVE NOTIFICATION ERROR:",
        error?.stack ||
          error?.message ||
          error
      );
    }
  }
);

const Payment =
  mongoose.model(
    "Payment",
    paymentSchema
  );

export default Payment;
