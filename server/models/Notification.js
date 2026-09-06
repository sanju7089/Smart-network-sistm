import mongoose from "mongoose";

export const NOTIFICATION_TYPES = [
  "booking_created",
  "booking_accepted",
  "booking_rejected",
  "booking_confirmed",
  "booking_cancelled",

  "work_open",
  "work_assigned",
  "work_started",
  "work_completed",
  "work_cancelled",

  "payment_success",
  "payment_failure",
  "payment_refunded",

  "admin_update"
];

const notificationSchema =
  new mongoose.Schema(
    {
      recipientId: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
      },

      type: {
        type: String,
        enum: NOTIFICATION_TYPES,
        required: true,
        index: true
      },

      title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
      },

      message: {
        type: String,
        required: true,
        trim: true,
        maxlength: 1000
      },

      bookingId: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "Booking",
        default: null,
        index: true
      },

      paymentId: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "Payment",
        default: null,
        index: true
      },

      jobId: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "Job",
        default: null,
        index: true
      },

      read: {
        type: Boolean,
        default: false,
        index: true
      },

      readAt: {
        type: Date,
        default: null
      },

      eventKey: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        maxlength: 300
      }
    },
    {
      timestamps: true
    }
  );

/* ==================================================
   PERFORMANCE INDEXES
================================================== */

notificationSchema.index({
  recipientId: 1,
  read: 1,
  createdAt: -1
});

notificationSchema.index({
  recipientId: 1,
  createdAt: -1
});

notificationSchema.index({
  type: 1,
  createdAt: -1
});

notificationSchema.index({
  bookingId: 1,
  createdAt: -1
});

notificationSchema.index({
  paymentId: 1,
  createdAt: -1
});

notificationSchema.index({
  jobId: 1,
  createdAt: -1
});

/* ==================================================
   MODEL
================================================== */

const Notification =
  mongoose.models.Notification ||
  mongoose.model(
    "Notification",
    notificationSchema
  );

export default Notification;
