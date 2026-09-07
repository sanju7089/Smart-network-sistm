import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Worker from "../models/Worker.js";

const COOKIE_NAME = "swn_auth";

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
      role: user.role
    },
    getJwtSecret(),
    {
      expiresIn: getJwtExpiresIn(),
      issuer: "smart-work-network",
      audience: "smart-work-network-users"
    }
  );
}

function getCookieMaxAge() {
  const expiresIn =
    getJwtExpiresIn();

  const match =
    String(expiresIn).match(
      /^(\d+)\s*(s|m|h|d|w)?$/i
    );

  if (!match) {
    return 7 * 24 * 60 * 60 * 1000;
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
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000
  };

  return value * multipliers[unit];
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
      maxAge: getCookieMaxAge(),
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

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

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
      !normalizedEmail ||
      normalizedEmail.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        normalizedEmail
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "A valid email is required."
      });
    }

    if (
      String(password).length < 8
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 8 characters."
      });
    }

    if (
      String(password).length > 128
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Password is too long."
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

    const cleanLocation = location
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
        password: hashedPassword,
        role: safeRole,
        phone: cleanPhone,
        location: cleanLocation,
        isActive: true
      });

    let workerProfile = null;

    if (safeRole === "worker") {
      try {
        workerProfile =
          await Worker.create({
            userId: user._id,
            name: cleanName,
            service: "Not specified",
            location: cleanLocation,
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
        createUserResponse(user),
      workerProfile:
        workerProfile
          ? {
              id: workerProfile._id,
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
      }).select("+password");

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
        createUserResponse(user)
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
        createUserResponse(user)
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

/*
 * CHANGE PASSWORD
 *
 * Requires the currently logged-in user.
 * The current password must match before
 * the new password is accepted.
 */
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

    if (
      cleanNewPassword.length < 8
    ) {
      return res.status(400).json({
        success: false,
        message:
          "New password must be at least 8 characters."
      });
    }

    if (
      cleanNewPassword.length > 128
    ) {
      return res.status(400).json({
        success: false,
        message:
          "New password is too long."
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
      ).select("+password");

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

    await user.save();

    /*
     * Password has changed, so issue a fresh
     * authentication token and replace the
     * existing cookie.
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
