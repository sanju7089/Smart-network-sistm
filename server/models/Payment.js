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
      default: null,
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
        "stripe",
        "cash",
        "bank_transfer",
        "other",
        "pending"
      ],
      default: "pending"
    },

    status: {
      type: String,
      enum: [
        "pending",
        "processing",
        "paid",
        "failed",
        "cancelled",
        "refunded"
      ],
      default: "pending",
      index: true
    },

    transactionId: {
      type: String,
      default: "",
      trim: true,
      index: true
    },

    gatewayPaymentId: {
      type: String,
      default: "",
      trim: true
    },

    notes: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000
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

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;
