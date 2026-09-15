import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";

import User from "../models/User.js";
import Worker from "../models/Worker.js";

import {
  sendOtpEmail
} from "../services/emailService.js";

const COOKIE_NAME = "swn_auth";

const JWT_ISSUER =
  "smart-work-network";

const JWT_AUDIENCE =
  "smart-work-network-users";

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

const OTP_LENGTH = 6;
const OTP_EXPIRES_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_SECONDS = 60;

const RESET_TOKEN_EXPIRES_MINUTES = 10;

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
    return {
      valid: false,
      message:
        "Password must be at least 8 characters."
    };
  }

  if (
    value.length >
    MAX_PASSWORD_LENGTH
  ) {
    return {
      valid: false,
      message:
        "Password must not exceed 128 characters."
    };
  }

  return {
    valid: true,
    message: ""
  };
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

function getResetTokenExpiry() {
  return new Date(
    Date.now() +
      RESET_TOKEN_EXPIRES_MINUTES *
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
    OTP_RESEND_SECONDS * 1000 -
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

async function sendOtp(
  user,
  purpose
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
    purpose,
    expiresMinutes:
      OTP_EXPIRES_MINUTES
  });

  return {
    otpHash,
    expiresAt
  };
}

/* =========================================
   SIGNUP
========================================= */

export async function signupWithOtp(
  req,
  res
) {
  try {
    const {
      name,
      email,
      password,
      role,
      phone,
      location
    } = req.body || {};

    if (
      !name ||
      !email ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Name, email and password are required."
      });
    }

    const cleanName =
      String(name).trim();

    if (
      cleanName.length < 2 ||
      cleanName.length > 100
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Name must be between 2 and 100 characters."
      });
    }

    const normalizedEmail =
      normalizeEmail(email);

    if (
      !validateEmail(
        normalizedEmail
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "A valid email is required."
      });
    }

    const passwordValidation =
      validatePassword(password);

    if (
      !passwordValidation.valid
    ) {
      return res.status(400).json({
        success: false,
        message:
          passwordValidation.message
      });
    }

    const allowedRoles = [
      "customer",
      "worker"
    ];

    const requestedRole =
      String(role || "")
        .trim()
        .toLowerCase();

    const safeRole =
      allowedRoles.includes(
        requestedRole
      )
        ? requestedRole
        : "customer";

    const cleanPhone =
      String(phone || "").trim();

    const cleanLocation =
      String(
        location || ""
      ).trim();

    let user =
      await User.findOne({
        email: normalizedEmail
      }).select(
        "+password " +
        "+emailVerificationOtpHash " +
        "+emailVerificationOtpExpiresAt " +
        "+emailVerificationOtpAttempts " +
        "+emailVerificationOtpLastSentAt"
      );

    if (
      user &&
      user.emailVerified &&
      user.isActive
    ) {
      return res.status(409).json({
        success: false,
        message:
          "An account with this email already exists."
      });
    }

    if (user) {
      const resend =
        checkResendAllowed(
          user.emailVerificationOtpLastSentAt
        );

      if (!resend.allowed) {
        return res.status(429).json({
          success: false,
          message:
            `Please wait ${resend.remainingSeconds} seconds before requesting another OTP.`
        });
      }

      user.name =
        cleanName;

      user.password =
        await bcrypt.hash(
          String(password),
          12
        );

      user.role =
        safeRole;

      user.phone =
        cleanPhone;

      user.location =
        cleanLocation;

      user.isActive =
        false;

      user.emailVerified =
        false;

      const otpData =
        await sendOtp(
          user,
          "signup"
        );

      user.emailVerificationOtpHash =
        otpData.otpHash;

      user.emailVerificationOtpExpiresAt =
        otpData.expiresAt;

      user.emailVerificationOtpAttempts =
        0;

      user.emailVerificationOtpLastSentAt =
        new Date();

      await user.save();

      return res.status(200).json({
        success: true,
        otpRequired: true,
        email: user.email,
        message:
          "A 6-digit verification OTP has been sent to your email."
      });
    }

    const hashedPassword =
      await bcrypt.hash(
        String(password),
        12
      );

    user =
      new User({
        name: cleanName,
        email: normalizedEmail,
        password:
          hashedPassword,
        role: safeRole,
        phone: cleanPhone,
        location:
          cleanLocation,
        isActive: false,
        emailVerified: false,
        tokenVersion: 0
      });

    const otpData =
      await sendOtp(
        user,
        "signup"
      );

    user.emailVerificationOtpHash =
      otpData.otpHash;

    user.emailVerificationOtpExpiresAt =
      otpData.expiresAt;

    user.emailVerificationOtpAttempts =
      0;

    user.emailVerificationOtpLastSentAt =
      new Date();

    await user.save();

    return res.status(201).json({
      success: true,
      otpRequired: true,
      email: user.email,
      message:
        "Account information saved. A 6-digit verification OTP has been sent to your email."
    });
  } catch (error) {
    console.error(
      "SIGNUP OTP ERROR:",
      error
    );

    if (
      error?.code === 11000
    ) {
      return res.status(409).json({
        success: false,
        message:
          "An account with this email already exists."
      });
    }

    return res.status(
      error.statusCode || 500
    ).json({
      success: false,
      message:
        error.statusCode
          ? error.message
          : "Unable to start signup."
    });
  }
}

/* =========================================
   VERIFY SIGNUP OTP
========================================= */

export async function verifySignupOtp(
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
        "+emailVerificationOtpHash " +
        "+emailVerificationOtpExpiresAt " +
        "+emailVerificationOtpAttempts"
      );

    if (!user) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid or expired OTP."
      });
    }

    if (
      user.emailVerified &&
      user.isActive
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Email is already verified."
      });
    }

    if (
      Number(
        user.emailVerificationOtpAttempts || 0
      ) >= OTP_MAX_ATTEMPTS
    ) {
      return res.status(429).json({
        success: false,
        message:
          "Too many incorrect OTP attempts. Please request a new OTP."
      });
    }

    if (
      !user.emailVerificationOtpExpiresAt ||
      new Date(
        user.emailVerificationOtpExpiresAt
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
      user.emailVerificationOtpHash
    ) {
      user.emailVerificationOtpAttempts =
        Number(
          user.emailVerificationOtpAttempts || 0
        ) + 1;

      await user.save();

      return res.status(400).json({
        success: false,
        message:
          "Incorrect OTP."
      });
    }

    user.emailVerified =
      true;

    user.isActive =
      true;

    user.emailVerificationOtpHash =
      null;

    user.emailVerificationOtpExpiresAt =
      null;

    user.emailVerificationOtpAttempts =
      0;

    user.emailVerificationOtpLastSentAt =
      null;

    await user.save();

    let workerProfile =
      null;

    if (
      user.role === "worker"
    ) {
      workerProfile =
        await Worker.findOne({
          userId: user._id
        });

      if (!workerProfile) {
        workerProfile =
          await Worker.create({
            userId: user._id,
            name: user.name,
            service:
              "Not specified",
            location:
              user.location,
            phone:
              user.phone,
            experience: "",
            bio: "",
            verified: false,
            isActive: true
          });
      }
    }

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
        user.role === "worker"
          ? "Email verified. Worker account and profile are ready."
          : "Email verified. Account created successfully.",
      user:
        createUserResponse(
          user
        ),
      workerProfile:
        workerProfile
          ? {
              id:
                workerProfile._id,
              service:
                workerProfile.service,
              verified:
                workerProfile.verified,
              isActive:
                workerProfile.isActive
            }
          : null
    });
  } catch (error) {
    console.error(
      "VERIFY SIGNUP OTP ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to verify signup OTP."
    });
  }
}

/* =========================================
   RESEND SIGNUP OTP
========================================= */

export async function resendSignupOtp(
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
        "+emailVerificationOtpHash " +
        "+emailVerificationOtpExpiresAt " +
        "+emailVerificationOtpAttempts " +
        "+emailVerificationOtpLastSentAt"
      );

    if (
      !user ||
      user.emailVerified
    ) {
      return res.status(200).json({
        success: true,
        message:
          "If this signup can be verified, a new OTP has been sent."
      });
    }

    const resend =
      checkResendAllowed(
        user.emailVerificationOtpLastSentAt
      );

    if (!resend.allowed) {
      return res.status(429).json({
        success: false,
        message:
          `Please wait ${resend.remainingSeconds} seconds before requesting another OTP.`
      });
    }

    const otpData =
      await sendOtp(
        user,
        "signup"
      );

    user.emailVerificationOtpHash =
      otpData.otpHash;

    user.emailVerificationOtpExpiresAt =
      otpData.expiresAt;

    user.emailVerificationOtpAttempts =
      0;

    user.emailVerificationOtpLastSentAt =
      new Date();

    await user.save();

    return res.status(200).json({
      success: true,
      message:
        "A new verification OTP has been sent."
    });
  } catch (error) {
    console.error(
      "RESEND SIGNUP OTP ERROR:",
      error
    );

    return res.status(502).json({
      success: false,
      message:
        "Unable to send a new OTP."
    });
  }
}

/* =========================================
   FORGOT PASSWORD
========================================= */

export async function forgotPasswordWithOtp(
  req,
  res
) {
  const genericMessage =
    "If an account with that email exists, a password reset OTP has been sent.";

  try {
    const email =
      normalizeEmail(
        req.body?.email
      );

    if (
      !validateEmail(email)
    ) {
      return res.status(200).json({
        success: true,
        otpRequired: true,
        message:
          genericMessage
      });
    }

    const user =
      await User.findOne({
        email
      }).select(
        "+passwordResetOtpHash " +
        "+passwordResetOtpExpiresAt " +
        "+passwordResetOtpAttempts " +
        "+passwordResetOtpLastSentAt"
      );

    if (
      !user ||
      !user.isActive ||
      !user.emailVerified
    ) {
      return res.status(200).json({
        success: true,
        otpRequired: true,
        message:
          genericMessage
      });
    }

    const resend =
      checkResendAllowed(
        user.passwordResetOtpLastSentAt
      );

    if (!resend.allowed) {
      return res.status(429).json({
        success: false,
        message:
          `Please wait ${resend.remainingSeconds} seconds before requesting another OTP.`
      });
    }

    const otpData =
      await sendOtp(
        user,
        "reset"
      );

    user.passwordResetOtpHash =
      otpData.otpHash;

    user.passwordResetOtpExpiresAt =
      otpData.expiresAt;

    user.passwordResetOtpAttempts =
      0;

    user.passwordResetOtpLastSentAt =
      new Date();

    user.passwordResetTokenHash =
      null;

    user.passwordResetExpiresAt =
      null;

    await user.save();

    return res.status(200).json({
      success: true,
      otpRequired: true,
      message:
        genericMessage
    });
  } catch (error) {
    console.error(
      "FORGOT PASSWORD OTP ERROR:",
      error
    );

    return res.status(502).json({
      success: false,
      message:
        "Unable to send password reset OTP."
    });
  }
}

/* =========================================
   VERIFY RESET OTP
========================================= */

export async function verifyResetOtp(
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
        "+passwordResetOtpHash " +
        "+passwordResetOtpExpiresAt " +
        "+passwordResetOtpAttempts"
      );

    if (!user) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid or expired OTP."
      });
    }

    if (
      Number(
        user.passwordResetOtpAttempts || 0
      ) >= OTP_MAX_ATTEMPTS
    ) {
      return res.status(429).json({
        success: false,
        message:
          "Too many incorrect OTP attempts. Please request a new OTP."
      });
    }

    if (
      !user.passwordResetOtpExpiresAt ||
      new Date(
        user.passwordResetOtpExpiresAt
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
      user.passwordResetOtpHash
    ) {
      user.passwordResetOtpAttempts =
        Number(
          user.passwordResetOtpAttempts || 0
        ) + 1;

      await user.save();

      return res.status(400).json({
        success: false,
        message:
          "Incorrect OTP."
      });
    }

    const resetToken =
      crypto
        .randomBytes(32)
        .toString("hex");

    user.passwordResetTokenHash =
      hashValue(resetToken);

    user.passwordResetExpiresAt =
      getResetTokenExpiry();

    user.passwordResetOtpHash =
      null;

    user.passwordResetOtpExpiresAt =
      null;

    user.passwordResetOtpAttempts =
      0;

    user.passwordResetOtpLastSentAt =
      null;

    await user.save();

    return res.status(200).json({
      success: true,
      verified: true,
      resetToken,
      expiresInMinutes:
        RESET_TOKEN_EXPIRES_MINUTES,
      message:
        "OTP verified. You can now create a new password."
    });
  } catch (error) {
    console.error(
      "VERIFY RESET OTP ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to verify password reset OTP."
    });
  }
}

/* =========================================
   RESEND RESET OTP
========================================= */

export async function resendResetOtp(
  req,
  res
) {
  try {
    const email =
      normalizeEmail(
        req.body?.email
      );

    const genericMessage =
      "If an account with that email exists, a new password reset OTP has been sent.";

    if (
      !validateEmail(email)
    ) {
      return res.status(200).json({
        success: true,
        message:
          genericMessage
      });
    }

    const user =
      await User.findOne({
        email
      }).select(
        "+passwordResetOtpHash " +
        "+passwordResetOtpExpiresAt " +
        "+passwordResetOtpAttempts " +
        "+passwordResetOtpLastSentAt"
      );

    if (
      !user ||
      !user.isActive ||
      !user.emailVerified
    ) {
      return res.status(200).json({
        success: true,
        message:
          genericMessage
      });
    }

    const resend =
      checkResendAllowed(
        user.passwordResetOtpLastSentAt
      );

    if (!resend.allowed) {
      return res.status(429).json({
        success: false,
        message:
          `Please wait ${resend.remainingSeconds} seconds before requesting another OTP.`
      });
    }

    const otpData =
      await sendOtp(
        user,
        "reset"
      );

    user.passwordResetOtpHash =
      otpData.otpHash;

    user.passwordResetOtpExpiresAt =
      otpData.expiresAt;

    user.passwordResetOtpAttempts =
      0;

    user.passwordResetOtpLastSentAt =
      new Date();

    user.passwordResetTokenHash =
      null;

    user.passwordResetExpiresAt =
      null;

    await user.save();

    return res.status(200).json({
      success: true,
      message:
        "A new password reset OTP has been sent."
    });
  } catch (error) {
    console.error(
      "RESEND RESET OTP ERROR:",
      error
    );

    return res.status(502).json({
      success: false,
      message:
        "Unable to send a new OTP."
    });
  }
}

/* =========================================
   RESET PASSWORD AFTER OTP
========================================= */

export async function resetPasswordWithOtp(
  req,
  res
) {
  try {
    const {
      resetToken,
      newPassword,
      confirmPassword
    } = req.body || {};

    if (
      !resetToken ||
      !newPassword ||
      !confirmPassword
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Reset token, new password and confirmation are required."
      });
    }

    if (
      !/^[a-f0-9]{64}$/i.test(
        String(resetToken)
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid password reset token."
      });
    }

    const validation =
      validatePassword(
        newPassword
      );

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message:
          validation.message
      });
    }

    if (
      String(newPassword) !==
      String(confirmPassword)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "New password and confirmation password do not match."
      });
    }

    const tokenHash =
      hashValue(
        resetToken
      );

    const user =
      await User.findOne({
        passwordResetTokenHash:
          tokenHash
      }).select(
        "+password " +
        "+passwordResetTokenHash " +
        "+passwordResetExpiresAt"
      );

    if (!user) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid or expired password reset token."
      });
    }

    if (
      !user.passwordResetExpiresAt ||
      new Date(
        user.passwordResetExpiresAt
      ).getTime() <
        Date.now()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Password reset authorization has expired. Please request a new OTP."
      });
    }

    const samePassword =
      await bcrypt.compare(
        String(newPassword),
        user.password
      );

    if (samePassword) {
      return res.status(400).json({
        success: false,
        message:
          "New password must be different from the previous password."
      });
    }

    user.password =
      await bcrypt.hash(
        String(newPassword),
        12
      );

    user.tokenVersion =
      Number(
        user.tokenVersion || 0
      ) + 1;

    user.passwordResetTokenHash =
      null;

    user.passwordResetExpiresAt =
      null;

    await user.save();

    const token =
      createToken(user);

    setAuthCookie(
      res,
      token
    );

    return res.status(200).json({
      success: true,
      message:
        "Password reset successfully.",
      user:
        createUserResponse(
          user
        )
    });
  } catch (error) {
    console.error(
      "RESET PASSWORD OTP ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to reset password."
    });
  }
}
