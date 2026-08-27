import mongoose from "mongoose";

const workerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },

    service: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },

    location: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200
    },

    phone: {
      type: String,
      default: "",
      trim: true,
      maxlength: 30
    },

    experience: {
      type: String,
      default: "",
      trim: true,
      maxlength: 100
    },

    bio: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000
    },

    verified: {
      type: Boolean,
      default: false
    },

    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

workerSchema.index({
  service: 1,
  location: 1,
  verified: 1,
  isActive: 1
});

const Worker = mongoose.model("Worker", workerSchema);

export default Worker;
