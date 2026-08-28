import mongoose from "mongoose";

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
      trim: true
    },

    method: {
      type: String,
      enum: [
        "razorpay",
        "cash",
        "bank_transfer"
      ],
      default: "razorpay"
    },

    status: {
      type: String,
      enum: [
        "created",
        "pending",
        "processing",
        "paid",
        "failed",
        "cancelled",
        "refunded"
      ],
      default: "created",
      index: true
    },

    razorpayOrderId: {
      type: String,
      default: "",
      trim: true,
      unique: true,
      sparse: true
    },

    gatewayPaymentId: {
      type: String,
      default: "",
      trim: true,
      index: true
    },

    gatewaySignature: {
      type: String,
      default: "",
      trim: true,
      select: false
    },

    transactionId: {
      type: String,
      default: "",
      trim: true,
      index: true
    },

    notes: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000
    },

    paidAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

paymentSchema.index({
  userId: 1,
  status: 1,
  createdAt: -1
});

paymentSchema.index({
  bookingId: 1,
  status: 1
});

const Payment = mongoose.model(
  "Payment",
  paymentSchema
);

export default Payment;
