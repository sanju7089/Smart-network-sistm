import mongoose from "mongoose";

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
 * One worker can have only one
 * booking for a particular job.
 *
 * This is the database-level duplicate
 * protection, so two simultaneous
 * requests cannot create duplicates.
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

/*
 * Customer booking history.
 */
bookingSchema.index({
  customerId: 1,
  createdAt: -1
});

/*
 * Worker dashboard:
 * worker + status + newest first.
 */
bookingSchema.index({
  workerId: 1,
  status: 1,
  createdAt: -1
});

/*
 * Admin/status queries.
 */
bookingSchema.index({
  status: 1,
  createdAt: -1
});

/*
 * Date/status queries.
 */
bookingSchema.index({
  date: 1,
  status: 1
});

const Booking =
  mongoose.model(
    "Booking",
    bookingSchema
  );

export default Booking;
