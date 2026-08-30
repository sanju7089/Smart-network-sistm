import mongoose from "mongoose";

export const BOOKING_STATUSES = [
  "pending",
  "accepted",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled"
];

const bookingSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
      index: true
    },

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

    status: {
      type: String,
      enum: BOOKING_STATUSES,
      default: "pending",
      index: true
    },

    customerMessage: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000
    },

    workerMessage: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000
    },

    acceptedAt: {
      type: Date,
      default: null
    },

    confirmedAt: {
      type: Date,
      default: null
    },

    startedAt: {
      type: Date,
      default: null
    },

    completedAt: {
      type: Date,
      default: null
    },

    cancelledAt: {
      type: Date,
      default: null
    },

    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    }
  },
  {
    timestamps: true
  }
);

/*
  Prevent the same worker from having
  multiple active bookings for the same job.
*/

bookingSchema.index(
  {
    jobId: 1,
    workerId: 1
  },
  {
    unique: true
  }
);

bookingSchema.index({
  customerId: 1,
  createdAt: -1
});

bookingSchema.index({
  workerId: 1,
  status: 1,
  createdAt: -1
});

bookingSchema.index({
  status: 1,
  createdAt: -1
});

const Booking = mongoose.model(
  "Booking",
  bookingSchema
);

export default Booking;
