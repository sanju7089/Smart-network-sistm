import mongoose from "mongoose";

const workerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true
    },

    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100
    },

    service: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
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
      default: false,
      index: true
    },

    profileCompleted: {
      type: Boolean,
      default: false,
      index: true
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

workerSchema.index({
  isActive: 1,
  profileCompleted: 1,
  verified: -1,
  createdAt: -1
});

workerSchema.index({
  service: 1,
  location: 1,
  isActive: 1,
  profileCompleted: 1
});

workerSchema.index({
  name: "text",
  service: "text",
  location: "text",
  bio: "text"
});

const Worker = mongoose.model(
  "Worker",
  workerSchema
);

export default Worker;
