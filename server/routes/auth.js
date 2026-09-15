import express from "express";
import rateLimit from "express-rate-limit";

import {
  logout,
  getCurrentUser,
  changePassword
} from "../controllers/authController.js";

import {
  signupWithOtp,
  verifySignupOtp,
  resendSignupOtp,
  forgotPasswordWithOtp,
  verifyResetOtp,
  resendResetOtp,
  resetPasswordWithOtp
} from "../controllers/otpAuthController.js";

import {
  loginWithOtp,
  verifyLoginOtp,
  resendLoginOtp
} from "../controllers/loginOtpController.js";

import {
  requireAuth
} from "../middleware/authMiddleware.js";

const router =
  express.Router();

const registerLimiter =
  rateLimit({
    windowMs:
      15 * 60 * 1000,
    limit: 10,
    standardHeaders:
      "draft-7",
    legacyHeaders: false,
    message: {
      success: false,
      message:
        "Too many signup attempts. Please try again later."
    }
  });

const loginLimiter =
  rateLimit({
    windowMs:
      15 * 60 * 1000,
    limit: 10,
    standardHeaders:
      "draft-7",
    legacyHeaders: false,
    message: {
      success: false,
      message:
        "Too many login attempts. Please try again later."
    }
  });

const otpLimiter =
  rateLimit({
    windowMs:
      15 * 60 * 1000,
    limit: 10,
    standardHeaders:
      "draft-7",
    legacyHeaders: false,
    message: {
      success: false,
      message:
        "Too many OTP requests. Please try again later."
    }
  });

const passwordLimiter =
  rateLimit({
    windowMs:
      15 * 60 * 1000,
    limit: 5,
    standardHeaders:
      "draft-7",
    legacyHeaders: false,
    message: {
      success: false,
      message:
        "Too many password change attempts. Please try again later."
    }
  });

const passwordResetLimiter =
  rateLimit({
    windowMs:
      15 * 60 * 1000,
    limit: 10,
    standardHeaders:
      "draft-7",
    legacyHeaders: false,
    message: {
      success: false,
      message:
        "Too many password reset attempts. Please try again later."
    }
  });

/* =========================================
   SIGNUP
========================================= */

router.post(
  "/register",
  registerLimiter,
  signupWithOtp
);

/* =========================================
   SIGNUP OTP
========================================= */

router.post(
  "/verify-signup-otp",
  otpLimiter,
  verifySignupOtp
);

router.post(
  "/resend-signup-otp",
  otpLimiter,
  resendSignupOtp
);

/* =========================================
   LOGIN
========================================= */

router.post(
  "/login",
  loginLimiter,
  loginWithOtp
);

/* =========================================
   LOGIN OTP
========================================= */

router.post(
  "/verify-login-otp",
  otpLimiter,
  verifyLoginOtp
);

router.post(
  "/resend-login-otp",
  otpLimiter,
  resendLoginOtp
);

/* =========================================
   LOGOUT
========================================= */

router.post(
  "/logout",
  logout
);

/* =========================================
   CURRENT USER
========================================= */

router.get(
  "/me",
  requireAuth,
  getCurrentUser
);

/* =========================================
   CHANGE PASSWORD
========================================= */

router.post(
  "/change-password",
  requireAuth,
  passwordLimiter,
  changePassword
);

/* =========================================
   FORGOT PASSWORD
========================================= */

router.post(
  "/forgot-password",
  passwordResetLimiter,
  forgotPasswordWithOtp
);

router.post(
  "/verify-reset-otp",
  passwordResetLimiter,
  verifyResetOtp
);

router.post(
  "/resend-reset-otp",
  passwordResetLimiter,
  resendResetOtp
);

/* =========================================
   RESET PASSWORD
========================================= */

router.post(
  "/reset-password",
  passwordResetLimiter,
  resetPasswordWithOtp
);

/* =========================================
   STATUS
========================================= */

router.get(
  "/status",
  (req, res) => {
    return res.status(200).json({
      success: true,
      message:
        "Auth route is working."
    });
  }
);

export default router;
