import jwt from "jsonwebtoken";
import User from "../models/User.js";

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

function getToken(req) {
  const authorization =
    String(
      req.headers.authorization || ""
    ).trim();

  if (!authorization) {
    return null;
  }

  const parts =
    authorization.split(/\s+/);

  if (
    parts.length !== 2 ||
    parts[0].toLowerCase() !== "bearer" ||
    !parts[1]
  ) {
    return null;
  }

  return parts[1].trim();
}

export async function requireAuth(
  req,
  res,
  next
) {
  try {
    const token = getToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication token is required."
      });
    }

    const payload = jwt.verify(
      token,
      getJwtSecret(),
      {
        issuer: "smart-work-network",
        audience:
          "smart-work-network-users"
      }
    );

    if (!payload?.id) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid authentication token."
      });
    }

    /*
      Do not trust role/status from an
      old token forever.

      Check the current database user.
    */

    const user =
      await User.findById(payload.id)
        .select(
          "_id name email role phone location isActive"
        );

    if (!user) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication is no longer valid."
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message:
          "This account is inactive."
      });
    }

    req.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.role
    };

    /*
      Full current user for controllers
      that need profile information.
    */

    req.authUser = user;

    return next();

  } catch (error) {
    if (
      error?.name ===
      "TokenExpiredError"
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication token has expired."
      });
    }

    if (
      error?.name ===
      "JsonWebTokenError" ||
      error?.name ===
      "NotBeforeError"
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid authentication token."
      });
    }

    console.error(
      "AUTHENTICATION ERROR:",
      error.message
    );

    return res.status(
      error.statusCode || 500
    ).json({
      success: false,
      message:
        error.statusCode
          ? error.message
          : "Authentication failed."
    });
  }
}

export function requireRole(
  ...allowedRoles
) {
  const validRoles =
    allowedRoles
      .map((role) =>
        String(role)
          .trim()
          .toLowerCase()
      )
      .filter(Boolean);

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required."
      });
    }

    if (validRoles.length === 0) {
      return res.status(500).json({
        success: false,
        message:
          "Server role configuration error."
      });
    }

    const userRole =
      String(req.user.role || "")
        .trim()
        .toLowerCase();

    if (
      !validRoles.includes(userRole)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to perform this action."
      });
    }

    return next();
  };
}
