import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";

import User from "../models/User.js";
import Worker from "../models/Worker.js";
import {
  sendPasswordResetEmail
} from "../services/emailService.js";

const COOKIE_NAME = "swn_auth";

const JWT_ISSUER =
  "smart-work-network";

const JWT_AUDIENCE =
  "smart-work-network-users";

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

export function clearAuthCookie(
  res
) {
  const isProduction =
    process.env.NODE_ENV ===
    "production";

  res.clearCookie(
    COOKIE_NAME,
    {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction
        ? "none"
        : "lax",
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

function getFrontendUrl() {
  return String(
    process.env.FRONTEND_URL || ""
  )
    .trim()
    .replace(/\/+$/, "");
}

function getResetExpiryMinutes() {
  const value =
    Number(
      process.env.PASSWORD_RESET_EXPIRES_MINUTES ||
        15
    );

  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return 15;
  }

  return Math.min(
    Math.floor(value),
    60
  );
}

function generateResetToken() {
  return crypto
    .randomBytes(32)
    .toString("hex");
}

function hashResetToken(
  token
) {
  return crypto
    .createHash("sha256")
    .update(
      String(token),
      "utf8"
    )
    .digest("hex");
}

function genericForgotPasswordResponse(
  res
) {
  return res.status(200).json({
    success: true,
    message:
      "If an account with that email exists, a password reset link has been sent."
  });
}

/* =========================================================
   SIGNUP
========================================================= */

export async function signup(
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
      cleanName.length < 2
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Name must be at least 2 characters."
      });
    }

    if (
      cleanName.length > 100
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Name must not exceed 100 characters."
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

    const existingUser =
      await User.findOne({
        email: normalizedEmail
      });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message:
          "An account with this email already exists."
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

    const cleanPhone = phone
      ? String(phone).trim()
      : "";

    const cleanLocation =
      location
        ? String(location).trim()
        : "";

    const hashedPassword =
      await bcrypt.hash(
        String(password),
        12
      );

    const user =
      await User.create({
        name: cleanName,
        email: normalizedEmail,
        password:
          hashedPassword,
        role: safeRole,
        phone: cleanPhone,
        location:
          cleanLocation,
        isActive: true,
        tokenVersion: 0
      });

    let workerProfile = null;

    if (
      safeRole === "worker"
    ) {
      try {
        workerProfile =
          await Worker.create({
            userId: user._id,
            name: cleanName,
            service:
              "Not specified",
            location:
              cleanLocation,
            phone: cleanPhone,
            experience: "",
            bio: "",
            verified: false,
            isActive: true
          });
      } catch (workerError) {
        await User.findByIdAndDelete(
          user._id
        );

        console.error(
          "AUTO WORKER PROFILE ERROR:",
          workerError
        );

        return res.status(500).json({
          success: false,
          message:
            "Unable to create worker profile. Account was not created."
        });
      }
    }

    const token =
      createToken(user);

    setAuthCookie(
      res,
      token
    );

    return res.status(201).json({
      success: true,
      message:
        safeRole === "worker"
          ? "Worker account and profile created successfully."
          : "Account created successfully.",
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
    if (
      error?.code === 11000
    ) {
      return res.status(409).json({
        success: false,
        message:
          "An account with this email already exists."
      });
    }

    console.error(
      "SIGNUP ERROR:",
      error.message
    );

    return res.status(
      error.statusCode || 500
    ).json({
      success: false,
      message:
        error.statusCode
          ? error.message
          : "Unable to create account."
    });
  }
}

/* =========================================================
   LOGIN
========================================================= */

export async function login(
  req,
  res
) {
  try {
    const {
      email,
      password
    } = req.body || {};

    if (
      !email ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Email and password are required."
      });
    }

    const normalizedEmail =
      normalizeEmail(email);

    const user =
      await User.findOne({
        email: normalizedEmail
      }).select(
        "+password"
      );

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

    if (
      typeof user.tokenVersion !==
      "number"
    ) {
      user.tokenVersion = 0;
      await user.save();
    }

    const token =
      createToken(user);

    setAuthCookie(
      res,
      token
    );

    return res.status(200).json({
      success: true,
      message:
        "Login successful.",
      user:
        createUserResponse(
          user
        )
    });
  } catch (error) {
    console.error(
      "LOGIN ERROR:",
      error.message
    );

    return res.status(
      error.statusCode || 500
    ).json({
      success: false,
      message:
        error.statusCode
          ? error.message
          : "Unable to login."
    });
  }
}

/* =========================================================
   LOGOUT
========================================================= */

export async function logout(
  req,
  res
) {
  clearAuthCookie(res);

  return res.status(200).json({
    success: true,
    message:
      "Logout successful."
  });
}

/* =========================================================
   CURRENT USER
========================================================= */

export async function getCurrentUser(
  req,
  res
) {
  try {
    const user =
      req.authUser ||
      await User.findById(
        req.user.id
      );

    if (!user) {
      return res.status(404).json({
        success: false,
        message:
          "User not found."
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message:
          "This account is inactive."
      });
    }

    return res.status(200).json({
      success: true,
      user:
        createUserResponse(
          user
        )
    });
  } catch (error) {
    console.error(
      "CURRENT USER ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to get user information."
    });
  }
}

/* =========================================================
   CHANGE PASSWORD
========================================================= */

export async function changePassword(
  req,
  res
) {
  try {
    const {
      currentPassword,
      newPassword,
      confirmPassword
    } = req.body || {};

    if (
      !currentPassword ||
      !newPassword ||
      !confirmPassword
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Current password, new password and confirmation are required."
      });
    }

    const cleanCurrentPassword =
      String(currentPassword);

    const cleanNewPassword =
      String(newPassword);

    const cleanConfirmPassword =
      String(confirmPassword);

    const validation =
      validatePassword(
        cleanNewPassword
      );

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message:
          validation.message.replace(
            "Password",
            "New password"
          )
      });
    }

    if (
      cleanNewPassword !==
      cleanConfirmPassword
    ) {
      return res.status(400).json({
        success: false,
        message:
          "New password and confirmation password do not match."
      });
    }

    const user =
      await User.findById(
        req.user.id
      ).select(
        "+password"
      );

    if (!user) {
      return res.status(404).json({
        success: false,
        message:
          "User not found."
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message:
          "This account is inactive."
      });
    }

    const currentPasswordMatched =
      await bcrypt.compare(
        cleanCurrentPassword,
        user.password
      );

    if (
      !currentPasswordMatched
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Current password is incorrect."
      });
    }

    const samePassword =
      await bcrypt.compare(
        cleanNewPassword,
        user.password
      );

    if (samePassword) {
      return res.status(400).json({
        success: false,
        message:
          "New password must be different from the current password."
      });
    }

    user.password =
      await bcrypt.hash(
        cleanNewPassword,
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
        "Password changed successfully."
    });
  } catch (error) {
    console.error(
      "CHANGE PASSWORD ERROR:",
      error.message
    );

    return res.status(
      error.statusCode || 500
    ).json({
      success: false,
      message:
        error.statusCode
          ? error.message
          : "Unable to change password."
    });
  }
}

/* =========================================================
   FORGOT PASSWORD
========================================================= */

export async function forgotPassword(
  req,
  res
) {
  try {
    const normalizedEmail =
      normalizeEmail(
        req.body?.email
      );

    /*
     * Always return the same response for
     * invalid/non-existing accounts.
     *
     * This prevents email enumeration.
     */
    if (
      !normalizedEmail ||
      !validateEmail(
        normalizedEmail
      )
    ) {
      return genericForgotPasswordResponse(
        res
      );
    }

    const user =
      await User.findOne({
        email: normalizedEmail
      });

    if (
      !user ||
      !user.isActive
    ) {
      return genericForgotPasswordResponse(
        res
      );
    }

    const rawToken =
      generateResetToken();

    const tokenHash =
      hashResetToken(
        rawToken
      );

    const expiresMinutes =
      getResetExpiryMinutes();

    const expiresAt =
      new Date(
        Date.now() +
          expiresMinutes *
            60 *
            1000
      );

    user.passwordResetTokenHash =
      tokenHash;

    user.passwordResetExpiresAt =
      expiresAt;

    await user.save();

    const frontendUrl =
      getFrontendUrl();

    if (!frontendUrl) {
      console.error(
        "FORGOT PASSWORD ERROR: FRONTEND_URL is not configured."
      );

      return res.status(500).json({
        success: false,
        message:
          "Password reset service is not configured."
      });
    }

    const resetUrl =
      `${frontendUrl}/reset-password.html?token=${encodeURIComponent(
        rawToken
      )}`;

    try {
      await sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        resetUrl,
        expiresMinutes
      });
    } catch (emailError) {
      /*
       * Do not leave a usable reset token
       * in the database if email delivery fails.
       */
      user.passwordResetTokenHash =
        null;

      user.passwordResetExpiresAt =
        null;

      await user.save();

      console.error(
        "PASSWORD RESET EMAIL ERROR:",
        emailError.message
      );

      return res.status(
        emailError.statusCode || 502
      ).json({
        success: false,
        message:
          "Unable to send password reset email. Please try again later."
      });
    }

    return genericForgotPasswordResponse(
      res
    );
  } catch (error) {
    console.error(
      "FORGOT PASSWORD ERROR:",
      error.message
    );

    return res.status(
      error.statusCode || 500
    ).json({
      success: false,
      message:
        error.statusCode
          ? error.message
          : "Unable to process password reset request."
    });
  }
}

/* =========================================================
   RESET PASSWORD
========================================================= */

export async function resetPassword(
  req,
  res
) {
  try {
    const rawToken =
      String(
        req.body?.token ||
        req.query?.token ||
        ""
      ).trim();

    const {
      newPassword,
      confirmPassword
    } = req.body || {};

    if (
      !rawToken ||
      !newPassword ||
      !confirmPassword
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Reset token, new password and confirmation are required."
      });
    }

    /*
     * Tokens generated by this system are
     * exactly 64 hexadecimal characters.
     */
    if (
      !/^[a-f0-9]{64}$/i.test(
        rawToken
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid or expired password reset token."
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
          validation.message.replace(
            "Password",
            "New password"
          )
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
      hashResetToken(
        rawToken
      );

    const user =
      await User.findOne({
        passwordResetTokenHash:
          tokenHash,
        passwordResetExpiresAt: {
          $gt: new Date()
        }
      }).select(
        "+password +passwordResetTokenHash +passwordResetExpiresAt"
      );

    if (!user) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid or expired password reset token."
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message:
          "This account is inactive."
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

    /*
     * Invalidate all previous JWTs.
     */
    user.tokenVersion =
      Number(
        user.tokenVersion || 0
      ) + 1;

    /*
     * One-time reset token:
     * delete it immediately after successful use.
     */
    user.passwordResetTokenHash =
      null;

    user.passwordResetExpiresAt =
      null;

    await user.save();

    /*
     * Create a fresh login session so the user
     * does not have to log in again.
     */
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
      "RESET PASSWORD ERROR:",
      error.message
    );

    return res.status(
      error.statusCode || 500
    ).json({
      success: false,
      message:
        error.statusCode
          ? error.message
          : "Unable to reset password."
    });
  }
}
