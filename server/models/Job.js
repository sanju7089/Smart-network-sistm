import mongoose from "mongoose";

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
      trim: true
    },

    service: {
      type: String,
      default: "",
      trim: true
    },

    location: {
      type: String,
      default: "",
      trim: true
    },

    budget: {
      type: Number,
      default: null,
      min: 0
    },

    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    status: {
      type: String,
      enum: [
        "open",
        "assigned",
        "in_progress",
        "completed",
        "cancelled"
      ],
      default: "open"
    }
  },
  {
    timestamps: true
  }
);

jobSchema.index({
  status: 1,
  category: 1,
  location: 1,
  createdAt: -1
});

const Job = mongoose.model("Job", jobSchema);

export default Job;
