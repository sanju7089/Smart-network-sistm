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
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
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
    },

    /*
     * Every time the password is changed/reset,
     * this number is increased.
     *
     * Existing JWTs contain the old version and
     * therefore become invalid automatically.
     */
    tokenVersion: {
      type: Number,
      default: 0,
      min: 0
    },

    /*
     * Password reset security.
     *
     * The raw reset token is NEVER stored.
     * Only its SHA-256 hash is stored.
     */
    passwordResetTokenHash: {
      type: String,
      default: null,
      select: false
    },

    passwordResetExpiresAt: {
      type: Date,
      default: null,
      select: false
    }
  },
  {
    timestamps: true
  }
);

userSchema.index({
  role: 1,
  isActive: 1,
  createdAt: -1
});

userSchema.index(
  {
    passwordResetTokenHash: 1
  },
  {
    sparse: true
  }
);

const User = mongoose.model("User", userSchema);

export default User;
