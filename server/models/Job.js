import mongoose from "mongoose";
import { notifyJobEvent } from "../services/notificationService.js";

export const JOB_STATUSES = [
  "open",
  "assigned",
  "in_progress",
  "completed",
  "cancelled"
];

const jobSchema = new mongoose.Schema(
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

/* ==================================================
   INDEXES
================================================== */

jobSchema.index({
  status: 1,
  createdAt: -1
});

jobSchema.index({
  customerId: 1,
  createdAt: -1
});

jobSchema.index({
  workerId: 1,
  createdAt: -1
});

jobSchema.index({
  category: 1,
  location: 1,
  createdAt: -1
});

jobSchema.index({
  title: "text",
  description: "text",
  category: "text",
  service: "text",
  location: "text"
});

/* ==================================================
   SAVE NOTIFICATION
================================================== */

jobSchema.pre("save", async function (next) {
  try {
    this.$notificationShouldRun =
      this.isNew ||
      this.isModified("status") ||
      this.isModified("workerId");

    /*
     * New job:
     * There is no previous status.
     */
    if (this.isNew) {
      this.$notificationPreviousStatus = null;
      return next();
    }

    /*
     * If neither status nor worker changed,
     * notification is not required.
     */
    if (!this.$notificationShouldRun) {
      this.$notificationPreviousStatus = null;
      return next();
    }

    /*
     * IMPORTANT:
     * get("status") gives the CURRENT document value.
     * Therefore we must read the existing database document
     * to obtain the real previous status.
     */
    const oldJobQuery = this.constructor
      .findById(this._id)
      .select("status")
      .lean();

    /*
     * Preserve the current mongoose session when
     * the save is running inside a transaction.
     */
    const session =
      typeof this.$session === "function"
        ? this.$session()
        : null;

    if (session) {
      oldJobQuery.session(session);
    }

    const oldJob = await oldJobQuery;

    this.$notificationPreviousStatus =
      oldJob?.status ?? null;

    next();
  } catch (error) {
    /*
     * Notification preparation must never
     * block the actual job save.
     */
    console.error(
      "JOB SAVE NOTIFICATION PRE ERROR:",
      error?.stack ||
        error?.message ||
        error
    );

    this.$notificationPreviousStatus = null;

    next();
  }
});

jobSchema.post("save", async function (job) {
  try {
    if (!this.$notificationShouldRun) {
      return;
    }

    await notifyJobEvent(
      job,
      this.$notificationPreviousStatus
    );
  } catch (error) {
    /*
     * Notification failure must never
     * break a successful job save.
     */
    console.error(
      "JOB SAVE NOTIFICATION ERROR:",
      error?.stack ||
        error?.message ||
        error
    );
  }
});

/* ==================================================
   FIND ONE AND UPDATE NOTIFICATION
==================================================

   Covers:

   findOneAndUpdate()
   findByIdAndUpdate()

================================================== */

jobSchema.pre(
  "findOneAndUpdate",
  async function (next) {
    try {
      const update = this.getUpdate() || {};

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

      if (!this.$notificationShouldRun) {
        return next();
      }

      /*
       * Read the OLD job before MongoDB updates it.
       */
      const oldJobQuery = this.model
        .findOne(this.getQuery())
        .select("status")
        .lean();

      /*
       * Preserve query session when available.
       */
      const session =
        typeof this.getOptions === "function"
          ? this.getOptions()?.session
          : null;

      if (session) {
        oldJobQuery.session(session);
      }

      const oldJob = await oldJobQuery;

      this.$notificationPreviousStatus =
        oldJob?.status ?? null;

      /*
       * Store the old document ID so post middleware
       * can always fetch the actual updated document.
       */
      this.$notificationJobId =
        oldJob?._id || null;

      next();
    } catch (error) {
      console.error(
        "JOB UPDATE NOTIFICATION PRE ERROR:",
        error?.stack ||
          error?.message ||
          error
      );

      /*
       * Never block the actual database update
       * because notification preparation failed.
       */
      this.$notificationShouldRun = false;

      next();
    }
  }
);

jobSchema.post(
  "findOneAndUpdate",
  async function (job) {
    try {
      if (!this.$notificationShouldRun) {
        return;
      }

      /*
       * Always fetch the CURRENT database document.
       *
       * This avoids depending on whether the caller used:
       * { new: true }
       * or
       * { new: false }
       */
      const jobId =
        this.$notificationJobId ||
        job?._id;

      if (!jobId) {
        return;
      }

      const currentJob =
        await this.model
          .findById(jobId)
          .lean();

      if (!currentJob) {
        return;
      }

      await notifyJobEvent(
        currentJob,
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

/* ==================================================
   MODEL
================================================== */

const Job =
  mongoose.models.Job ||
  mongoose.model("Job", jobSchema);

export default Job;
