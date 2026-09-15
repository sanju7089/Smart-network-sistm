import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";

import User from "../models/User.js";

import {
  sendOtpEmail
} from "../services/emailService.js";

const COOKIE_NAME = "swn_auth";

const JWT_ISSUER =
  "smart-work-network";

const JWT_AUDIENCE =
  "smart-work-network-users";

const OTP_LENGTH = 6;
const OTP_EXPIRES_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_SECONDS = 60;

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

function getJwtSecret() {
  const secret = String(
    process.env.JWT_SECRET || ""
  ).trim();

  if (!secret) {
    const error = new Error(
      "JWT_SECRET is not configured."
    );

    error.statusCode = 500;

    throw error;
  }

  return secret;
}

function getJwtExpiresIn() {
  return (
    String(
      process.env.JWT_EXPIRES_IN || "7d"
    ).trim() || "7d"
  );
}

function createToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      tokenVersion:
        Number(user.tokenVersion || 0)
    },
    getJwtSecret(),
    {
      expiresIn: getJwtExpiresIn(),
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE
    }
  );
}

function getCookieMaxAge() {
  const expiresIn =
    getJwtExpiresIn();

  const match = String(
    expiresIn
  ).match(
    /^(\d+)\s*(s|m|h|d|w)?$/i
  );

  if (!match) {
    return (
      7 *
      24 *
      60 *
      60 *
      1000
    );
  }

  const value =
    Number(match[1]);

  const unit =
    String(
      match[2] || "s"
    ).toLowerCase();

  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d:
      24 *
      60 *
      60 *
      1000,
    w:
      7 *
      24 *
      60 *
      60 *
      1000
  };

  return (
    value *
    multipliers[unit]
  );
}

function setAuthCookie(
  res,
  token
) {
  const isProduction =
    process.env.NODE_ENV ===
    "production";

  res.cookie(
    COOKIE_NAME,
    token,
    {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction
        ? "none"
        : "lax",
      maxAge:
        getCookieMaxAge(),
      path: "/"
    }
  );
}

function createUserResponse(
  user
) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    location: user.location
  };
}

function normalizeEmail(
  email
) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function validateEmail(
  email
) {
  return (
    email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email
    )
  );
}

function validatePassword(
  password
) {
  const value =
    String(password || "");

  if (
    value.length <
    MIN_PASSWORD_LENGTH
  ) {
    return false;
  }

  if (
    value.length >
    MAX_PASSWORD_LENGTH
  ) {
    return false;
  }

  return true;
}

function generateOtp() {
  return crypto
    .randomInt(
      0,
      1000000
    )
    .toString()
    .padStart(
      OTP_LENGTH,
      "0"
    );
}

function hashValue(value) {
  return crypto
    .createHash("sha256")
    .update(
      String(value),
      "utf8"
    )
    .digest("hex");
}

function getOtpExpiry() {
  return new Date(
    Date.now() +
      OTP_EXPIRES_MINUTES *
        60 *
        1000
  );
}

function checkResendAllowed(
  lastSentAt
) {
  if (!lastSentAt) {
    return {
      allowed: true,
      remainingSeconds: 0
    };
  }

  const elapsed =
    Date.now() -
    new Date(
      lastSentAt
    ).getTime();

  const remaining =
    OTP_RESEND_SECONDS *
      1000 -
    elapsed;

  if (remaining <= 0) {
    return {
      allowed: true,
      remainingSeconds: 0
    };
  }

  return {
    allowed: false,
    remainingSeconds:
      Math.ceil(
        remaining / 1000
      )
  };
}

/*
 * IMPORTANT:
 * The recipient is NEVER taken from
 * another email field.
 *
 * It is ALWAYS:
 *
 * user.email
 *
 * after finding the registered
 * account in MongoDB.
 */
async function sendLoginOtp(
  user
) {
  const otp =
    generateOtp();

  const otpHash =
    hashValue(otp);

  const expiresAt =
    getOtpExpiry();

  await sendOtpEmail({
    to: user.email,
    name: user.name,
    otp,
    purpose: "login",
    expiresMinutes:
      OTP_EXPIRES_MINUTES
  });

  return {
    otpHash,
    expiresAt
  };
}

/* =========================================
   LOGIN STEP 1
   EMAIL + PASSWORD
========================================= */

export async function loginWithOtp(
  req,
  res
) {
  try {
    const {
      email,
      password
    } = req.body || {};

    const normalizedEmail =
      normalizeEmail(email);

    if (
      !validateEmail(
        normalizedEmail
      ) ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Email and password are required."
      });
    }

    if (
      !validatePassword(password)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid email or password."
      });
    }

    /*
     * The ONLY account lookup is
     * by the email entered for login.
     */
    const user =
      await User.findOne({
        email:
          normalizedEmail
      }).select(
        "+password " +
        "+loginOtpHash " +
        "+loginOtpExpiresAt " +
        "+loginOtpAttempts " +
        "+loginOtpLastSentAt"
      );

    /*
     * Do not reveal whether the
     * email exists.
     */
    if (!user) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid email or password."
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message:
          "This account is inactive."
      });
    }

    if (
      user.emailVerified === false
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Please verify your email before logging in."
      });
    }

    const passwordMatched =
      await bcrypt.compare(
        String(password),
        user.password
      );

    if (!passwordMatched) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid email or password."
      });
    }

    const resend =
      checkResendAllowed(
        user.loginOtpLastSentAt
      );

    if (!resend.allowed) {
      return res.status(429).json({
        success: false,
        message:
          `Please wait ${resend.remainingSeconds} seconds before requesting another OTP.`
      });
    }

    /*
     * OTP recipient is user.email.
     * This is the registered email
     * found above.
     */
    const otpData =
      await sendLoginOtp(
        user
      );

    user.loginOtpHash =
      otpData.otpHash;

    user.loginOtpExpiresAt =
      otpData.expiresAt;

    user.loginOtpAttempts = 0;

    user.loginOtpLastSentAt =
      new Date();

    await user.save();

    return res.status(200).json({
      success: true,
      otpRequired: true,

      /*
       * This is the same normalized
       * registered email.
       */
      email: user.email,

      message:
        "Password verified. A 6-digit login OTP has been sent to your registered email."
    });
  } catch (error) {
    console.error(
      "LOGIN OTP START ERROR:",
      error
    );

    return res.status(
      error.statusCode || 500
    ).json({
      success: false,
      message:
        error.statusCode
          ? error.message
          : "Unable to start login."
    });
  }
}

/* =========================================
   LOGIN STEP 2
   VERIFY LOGIN OTP
========================================= */

export async function verifyLoginOtp(
  req,
  res
) {
  try {
    const email =
      normalizeEmail(
        req.body?.email
      );

    const otp =
      String(
        req.body?.otp || ""
      ).trim();

    if (
      !validateEmail(email) ||
      !/^\d{6}$/.test(otp)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Valid email and 6-digit OTP are required."
      });
    }

    const user =
      await User.findOne({
        email
      }).select(
        "+loginOtpHash " +
        "+loginOtpExpiresAt " +
        "+loginOtpAttempts"
      );

    if (!user) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid or expired OTP."
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message:
          "This account is inactive."
      });
    }

    if (
      user.emailVerified === false
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Please verify your email first."
      });
    }

    if (
      Number(
        user.loginOtpAttempts || 0
      ) >= OTP_MAX_ATTEMPTS
    ) {
      return res.status(429).json({
        success: false,
        message:
          "Too many incorrect OTP attempts. Please request a new OTP."
      });
    }

    if (
      !user.loginOtpExpiresAt ||
      new Date(
        user.loginOtpExpiresAt
      ).getTime() <
        Date.now()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "OTP has expired. Please request a new OTP."
      });
    }

    const submittedHash =
      hashValue(otp);

    if (
      submittedHash !==
      user.loginOtpHash
    ) {
      user.loginOtpAttempts =
        Number(
          user.loginOtpAttempts || 0
        ) + 1;

      await user.save();

      return res.status(400).json({
        success: false,
        message:
          "Incorrect OTP."
      });
    }

    /*
     * One-time use:
     * clear OTP immediately.
     */
    user.loginOtpHash = null;

    user.loginOtpExpiresAt = null;

    user.loginOtpAttempts = 0;

    user.loginOtpLastSentAt = null;

    await user.save();

    const token =
      createToken(user);

    setAuthCookie(
      res,
      token
    );

    return res.status(200).json({
      success: true,
      verified: true,
      message:
        "Login successful.",
      user:
        createUserResponse(
          user
        )
    });
  } catch (error) {
    console.error(
      "VERIFY LOGIN OTP ERROR:",
      error
    );

    return res.status(
      error.statusCode || 500
    ).json({
      success: false,
      message:
        error.statusCode
          ? error.message
          : "Unable to verify login OTP."
    });
  }
}

/* =========================================
   RESEND LOGIN OTP
========================================= */

export async function resendLoginOtp(
  req,
  res
) {
  try {
    const email =
      normalizeEmail(
        req.body?.email
      );

    if (
      !validateEmail(email)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Valid email is required."
      });
    }

    const user =
      await User.findOne({
        email
      }).select(
        "+loginOtpHash " +
        "+loginOtpExpiresAt " +
        "+loginOtpAttempts " +
        "+loginOtpLastSentAt"
      );

    /*
     * Never send an OTP if the
     * account does not exist.
     */
    if (
      !user ||
      !user.isActive ||
      user.emailVerified === false
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Unable to resend login OTP."
      });
    }

    const resend =
      checkResendAllowed(
        user.loginOtpLastSentAt
      );

    if (!resend.allowed) {
      return res.status(429).json({
        success: false,
        message:
          `Please wait ${resend.remainingSeconds} seconds before requesting another OTP.`
      });
    }

    /*
     * Again, recipient is exactly
     * user.email.
     */
    const otpData =
      await sendLoginOtp(
        user
      );

    user.loginOtpHash =
      otpData.otpHash;

    user.loginOtpExpiresAt =
      otpData.expiresAt;

    user.loginOtpAttempts = 0;

    user.loginOtpLastSentAt =
      new Date();

    await user.save();

    return res.status(200).json({
      success: true,
      message:
        "A new login OTP has been sent to your registered email."
    });
  } catch (error) {
    console.error(
      "RESEND LOGIN OTP ERROR:",
      error
    );

    return res.status(502).json({
      success: false,
      message:
        "Unable to resend login OTP."
    });
  }
}
