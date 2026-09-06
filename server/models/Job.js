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
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
      },

      workerId: {
        type: mongoose.Schema.Types.ObjectId,
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

/* Public jobs */
jobSchema.index({
  status: 1,
  createdAt: -1
});

/* Customer dashboard */
jobSchema.index({
  customerId: 1,
  createdAt: -1
});

/* Worker dashboard */
jobSchema.index({
  workerId: 1,
  createdAt: -1
});

/* Category/location filtering */
jobSchema.index({
  category: 1,
  location: 1,
  createdAt: -1
});

/* Text search */
jobSchema.index({
  title: "text",
  description: "text",
  category: "text",
  service: "text",
  location: "text"
});

/*
==================================================
SAVE NOTIFICATION
==================================================
*/

jobSchema.pre(
  "save",
  function (next) {
    /*
     * IMPORTANT:
     *
     * isModified() must be checked before save.
     * For existing documents, get("status")
     * is the OLD value at this point.
     */
    this.$notificationPreviousStatus =
      this.isNew
        ? null
        : this.get("status");

    this.$notificationShouldRun =
      this.isNew ||
      this.isModified("status") ||
      this.isModified("workerId");

    next();
  }
);

jobSchema.post(
  "save",
  async function (job) {
    try {
      if (
        !this.$notificationShouldRun
      ) {
        return;
      }

      await notifyJobEvent(
        job,
        this.$notificationPreviousStatus
      );
    } catch (error) {
      /*
       * Notification failure must never
       * break the successful job save.
       */
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
==================================================
FIND ONE AND UPDATE NOTIFICATION
==================================================

Covers controllers using:

findOneAndUpdate()
findByIdAndUpdate()

Normal save middleware does not run for
these query-based updates.
*/

jobSchema.pre(
  "findOneAndUpdate",
  async function (next) {
    try {
      const update =
        this.getUpdate() || {};

      const $set =
        update.$set || {};

      const statusProvided =
        Object.prototype.hasOwnProperty.call(
          $set,
          "status"
        ) ||
        Object.prototype.hasOwnProperty.call(
          update,
          "status"
        );

      const workerProvided =
        Object.prototype.hasOwnProperty.call(
          $set,
          "workerId"
        ) ||
        Object.prototype.hasOwnProperty.call(
          update,
          "workerId"
        );

      this.$notificationShouldRun =
        statusProvided ||
        workerProvided;

      if (
        !this.$notificationShouldRun
      ) {
        return next();
      }

      /*
       * Read the OLD job before MongoDB updates it.
       */
      const oldJob =
        await this.model
          .findOne(this.getQuery())
          .lean();

      this.$notificationPreviousStatus =
        oldJob?.status ?? null;

      next();
    } catch (error) {
      console.error(
        "JOB UPDATE NOTIFICATION PRE ERROR:",
        error?.stack ||
          error?.message ||
          error
      );

      /*
       * Notification middleware must never
       * block the actual database update.
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
