import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false
    },

    role: {
      type: String,
      enum: ["customer", "worker", "admin"],
      default: "customer"
    },

    phone: {
      type: String,
      default: "",
      trim: true
    },

    location: {
      type: String,
      default: "",
      trim: true
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

userSchema.index(
  { email: 1 },
  { unique: true }
);

const User = mongoose.model("User", userSchema);

export default User;
