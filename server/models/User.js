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
      trim: true,
      maxlength: 254,
      match:
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },

    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false
    },

    role: {
      type: String,
      enum: [
        "customer",
        "worker",
        "admin"
      ],
      default: "customer",
      index: true
    },

    phone: {
      type: String,
      default: "",
      trim: true,
      maxlength: 30
    },

    location: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200
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

/*
 * email: unique:true already creates
 * the unique index. No duplicate index
 * declaration is needed.
 */

userSchema.index({
  role: 1,
  isActive: 1,
  createdAt: -1
});

const User =
  mongoose.model(
    "User",
    userSchema
  );

export default User;
