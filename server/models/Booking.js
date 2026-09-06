import mongoose from "mongoose";

import {
  notifyBookingEvent
} from "../services/notificationService.js";

export const BOOKING_STATUSES = [
  "pending",
  "accepted",
  "rejected",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled"
];

const bookingSchema =
  new mongoose.Schema(
    {
      jobId: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "Job",
        required: true
      },

      customerId: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
      },

      workerId: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "Worker",
        required: true
      },

      status: {
        type: String,
        enum: BOOKING_STATUSES,
        default: "pending",
        index: true
      },

      date: {
        type: Date,
        default: null,
        index: true
      },

      notes: {
        type: String,
        default: "",
        trim: true,
        maxlength: 2000
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

      rejectedAt: {
        type: Date,
        default: null
      },

      rejectedBy: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "User",
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
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
      }
    },
    {
      timestamps: true
    }
  );

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

bookingSchema.index({
  date: 1,
  status: 1
});

/*
========================================
AUTOMATIC BOOKING NOTIFICATIONS
========================================

Every newly created booking and every
booking status change automatically
creates notifications.

Notification failures are isolated so
they never break the booking operation.
========================================
*/

bookingSchema.post(
  "save",
  async function (
    booking
  ) {
    try {
      if (
        booking?.isNew ||
        booking?.isModified("status")
      ) {
        await notifyBookingEvent(
          booking
        );
      }
    } catch (error) {
      console.error(
        "BOOKING POST-SAVE NOTIFICATION ERROR:",
        error?.stack ||
          error?.message ||
          error
      );
    }
  }
);

const Booking =
  mongoose.model(
    "Booking",
    bookingSchema
  );

export default Booking;
