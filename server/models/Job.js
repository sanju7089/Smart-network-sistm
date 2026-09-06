import mongoose from "mongoose";

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

const Job =
  mongoose.model(
    "Job",
    jobSchema
  );

export default Job;
