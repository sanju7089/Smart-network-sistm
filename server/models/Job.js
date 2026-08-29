import mongoose from "mongoose";

const JOB_STATUSES = [
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

jobSchema.index({
  status: 1,
  createdAt: -1
});

jobSchema.index({
  customerId: 1,
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

const Job = mongoose.model("Job", jobSchema);

export { JOB_STATUSES };

export default Job;
