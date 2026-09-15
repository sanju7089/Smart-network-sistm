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
      default: false,
      index: true
    },

    emailVerified: {
      type: Boolean,
      default: false,
      index: true
    },

    tokenVersion: {
      type: Number,
      default: 0,
      min: 0
    },

    /* ================================
       SIGNUP EMAIL OTP
    ================================= */

    emailVerificationOtpHash: {
      type: String,
      default: null,
      select: false
    },

    emailVerificationOtpExpiresAt: {
      type: Date,
      default: null,
      select: false
    },

    emailVerificationOtpAttempts: {
      type: Number,
      default: 0,
      min: 0,
      select: false
    },

    emailVerificationOtpLastSentAt: {
      type: Date,
      default: null,
      select: false
    },

    /* ================================
       LOGIN EMAIL OTP
    ================================= */

    loginOtpHash: {
      type: String,
      default: null,
      select: false
    },

    loginOtpExpiresAt: {
      type: Date,
      default: null,
      select: false
    },

    loginOtpAttempts: {
      type: Number,
      default: 0,
      min: 0,
      select: false
    },

    loginOtpLastSentAt: {
      type: Date,
      default: null,
      select: false
    },

    /* ================================
       PASSWORD RESET OTP
    ================================= */

    passwordResetOtpHash: {
      type: String,
      default: null,
      select: false
    },

    passwordResetOtpExpiresAt: {
      type: Date,
      default: null,
      select: false
    },

    passwordResetOtpAttempts: {
      type: Number,
      default: 0,
      min: 0,
      select: false
    },

    passwordResetOtpLastSentAt: {
      type: Date,
      default: null,
      select: false
    },

    /* ================================
       PASSWORD RESET AUTH TOKEN
    ================================= */

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

userSchema.index(
  {
    emailVerificationOtpExpiresAt: 1
  },
  {
    sparse: true
  }
);

userSchema.index(
  {
    loginOtpExpiresAt: 1
  },
  {
    sparse: true
  }
);

userSchema.index(
  {
    passwordResetOtpExpiresAt: 1
  },
  {
    sparse: true
  }
);

const User =
  mongoose.model(
    "User",
    userSchema
  );

export default User;
