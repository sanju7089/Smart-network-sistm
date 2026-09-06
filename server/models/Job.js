import mongoose from "mongoose";
import { notifyJobEvent } from "../services/notificationService.js";

export const JOB_STATUSES = [
  "open",
  "assigned",
  "in_progress",
  "completed",
  "cancelled"
];

const jobSchema =
  new mongoose.Schema(
    {
      title: {
        type: String,
        required: true,
        trim: true,
        minlength: 3,
        maxlength: 200
      },

      description: {
        type: String,
        required: true,
        trim: true,
        minlength: 3,
        maxlength: 5000
      },

      category: {
        type: String,
        default: "",
        trim: true,
        maxlength: 100
      },

      service: {
        type: String,
        default: "",
        trim: true,
        maxlength: 150
      },

      location: {
        type: String,
        default: "",
        trim: true,
        maxlength: 200
      },

      budget: {
        type: Number,
        default: null,
        min: 0
      },

      customerId: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
      },

      /*
       * Optional worker assignment.
       *
       * Existing jobs without workerId
       * continue to work normally.
       */
      workerId: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "Worker",
        default: null,
        index: true
      },

      status: {
        type: String,
        enum: JOB_STATUSES,
        default: "open",
        index: true
      }
    },
    {
      timestamps: true
    }
  );

/*
 * Public jobs:
 * status=open + newest first.
 */
jobSchema.index({
  status: 1,
  createdAt: -1
});

/*
 * Customer dashboard:
 * customer's jobs + newest first.
 */
jobSchema.index({
  customerId: 1,
  createdAt: -1
});

/*
 * Worker dashboard:
 * worker's assigned jobs + newest first.
 */
jobSchema.index({
  workerId: 1,
  createdAt: -1
});

/*
 * Category/location filtering.
 */
jobSchema.index({
  category: 1,
  location: 1,
  createdAt: -1
});

/*
 * Text search.
 */
jobSchema.index({
  title: "text",
  description: "text",
  category: "text",
  service: "text",
  location: "text"
});

/*
 * --------------------------------------------------
 * SAVE NOTIFICATION
 * --------------------------------------------------
 *
 * Handles:
 * - Job creation
 * - Job status changes
 */
jobSchema.pre("save", function (next) {
  this.$notificationPreviousStatus =
    this.isNew
      ? null
      : this.get("status");

  this.$notificationStatusChanged =
    this.isNew ||
    this.isModified("status") ||
    this.isModified("workerId");

  next();
});

jobSchema.post(
  "save",
  async function (job) {
    try {
      if (
        !this.$notificationStatusChanged
      ) {
        return;
      }

      await notifyJobEvent(
        job,
        this.$notificationPreviousStatus
      );
    } catch (error) {
      console.error(
        "JOB SAVE NOTIFICATION ERROR:",
        error?.stack ||
          error?.message ||
          error
      );
    }
  }
);

/*
 * --------------------------------------------------
 * FIND ONE AND UPDATE NOTIFICATION
 * --------------------------------------------------
 *
 * Important because many controllers use:
 *
 * findOneAndUpdate()
 * findByIdAndUpdate()
 *
 * Normal save() middleware does NOT catch those.
 */

jobSchema.pre(
  "findOneAndUpdate",
  async function (next) {
    try {
      const update =
        this.getUpdate() || {};

      const $set =
        update.$set || {};

      const newStatus =
        Object.prototype.hasOwnProperty.call(
          $set,
          "status"
        )
          ? $set.status
          : update.status;

      const newWorkerId =
        Object.prototype.hasOwnProperty.call(
          $set,
          "workerId"
        )
          ? $set.workerId
          : update.workerId;

      const statusChanging =
        newStatus !== undefined;

      const workerChanging =
        newWorkerId !== undefined;

      this.$notificationShouldRun =
        statusChanging ||
        workerChanging;

      if (
        !this.$notificationShouldRun
      ) {
        return next();
      }

      const currentJob =
        await this.model
          .findOne(
            this.getQuery()
          )
          .lean();

      this.$notificationPreviousStatus =
        currentJob?.status ?? null;

      next();
    } catch (error) {
      console.error(
        "JOB UPDATE NOTIFICATION PRE ERROR:",
        error?.stack ||
          error?.message ||
          error
      );

      /*
       * Notification failure must never
       * break the actual job update.
       */
      next();
    }
  }
);

jobSchema.post(
  "findOneAndUpdate",
  async function (job) {
    try {
      if (
        !this.$notificationShouldRun ||
        !job
      ) {
        return;
      }

      await notifyJobEvent(
        job,
        this.$notificationPreviousStatus
      );
    } catch (error) {
      console.error(
        "JOB UPDATE NOTIFICATION ERROR:",
        error?.stack ||
          error?.message ||
          error
      );
    }
  }
);

const Job =
  mongoose.model(
    "Job",
    jobSchema
  );

export default Job;
