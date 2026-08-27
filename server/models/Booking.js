import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    workerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Worker",
      required: true,
      index: true
    },

    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      default: null
    },

    date: {
      type: Date,
      default: null
    },

    notes: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000
    },

    status: {
      type: String,
      enum: [
        "pending",
        "accepted",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
        "rejected"
      ],
      default: "pending",
      index: true
    }
  },
  {
    timestamps: true
  }
);

bookingSchema.index({
  customerId: 1,
  workerId: 1,
  status: 1,
  createdAt: -1
});

const Booking = mongoose.model("Booking", bookingSchema);

export default Booking;
