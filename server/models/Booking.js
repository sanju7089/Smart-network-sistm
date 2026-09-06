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


/*
========================================
INDEXES
========================================
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

bookingSchema.index({
  date: 1,
  status: 1
});


/*
========================================
SAVE NOTIFICATION TRIGGER STATE
========================================
*/

bookingSchema.pre(
  "save",
  function (next) {
    this.$notificationIsNew =
      this.isNew;

    this.$notificationStatusChanged =
      this.isModified("status");

    next();
  }
);


/*
========================================
SAVE NOTIFICATION
========================================
*/

bookingSchema.post(
  "save",
  async function (booking) {
    try {
      if (
        booking.$notificationIsNew ||
        booking.$notificationStatusChanged
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


/*
========================================
FIND ONE AND UPDATE
NOTIFICATION TRIGGER
========================================

This is important because some payment
and administrative flows update booking
status using findOneAndUpdate().

Without this hook, those status changes
would bypass the save notification hook.
========================================
*/

bookingSchema.pre(
  "findOneAndUpdate",
  async function () {
    try {
      const update =
        this.getUpdate() || {};

      const nextStatus =
        update?.$set?.status ??
        update?.status;

      this.$notificationStatusChanged =
        nextStatus !== undefined;

      this.$notificationPreviousStatus =
        undefined;

      if (
        !this.$notificationStatusChanged
      ) {
        return;
      }

      const existingBooking =
        await this.model
          .findOne(
            this.getQuery()
          )
          .select("status")
          .lean();

      if (!existingBooking) {
        this.$notificationStatusChanged =
          false;

        return;
      }

      this.$notificationPreviousStatus =
        existingBooking.status;

      if (
        String(
          existingBooking.status
        ) ===
        String(nextStatus)
      ) {
        this.$notificationStatusChanged =
          false;
      }
    } catch (error) {
      console.error(
        "BOOKING PRE-UPDATE NOTIFICATION ERROR:",
        error?.stack ||
          error?.message ||
          error
      );

      /*
        Do not block the actual booking
        update because notification
        preparation failed.
      */

      this.$notificationStatusChanged =
        false;
    }
  }
);


/*
========================================
FIND ONE AND UPDATE
POST NOTIFICATION
========================================
*/

bookingSchema.post(
  "findOneAndUpdate",
  async function (booking) {
    try {
      if (
        !booking ||
        !this.$notificationStatusChanged
      ) {
        return;
      }

      const previousStatus =
        this.$notificationPreviousStatus;

      const currentStatus =
        booking.status;

      if (
        !currentStatus ||
        previousStatus ===
          currentStatus
      ) {
        return;
      }

      await notifyBookingEvent(
        booking
      );
    } catch (error) {
      console.error(
        "BOOKING POST-UPDATE NOTIFICATION ERROR:",
        error?.stack ||
          error?.message ||
          error
      );
    }
  }
);


/*
========================================
MODEL
========================================
*/

const Booking =
  mongoose.models.Booking ||
  mongoose.model(
    "Booking",
    bookingSchema
  );

export default Booking;
