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
    parts[0].toLowerCase() !==
      "bearer" ||
    !parts[1]
  ) {
    return null;
  }

  return parts[1].trim();
}

async function authenticateRequest(
  req,
  res
) {
  const token = getToken(req);

  if (!token) {
    return {
      authenticated: false
    };
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
    const error = new Error(
      "Invalid authentication token."
    );

    error.statusCode = 401;

    throw error;
  }

  const user =
    await User.findById(
      payload.id
    ).select(
      "_id name email role phone location isActive"
    );

  if (!user) {
    const error = new Error(
      "Authentication is no longer valid."
    );

    error.statusCode = 401;

    throw error;
  }

  if (!user.isActive) {
    const error = new Error(
      "This account is inactive."
    );

    error.statusCode = 403;

    throw error;
  }

  req.user = {
    id: user._id.toString(),
    email: user.email,
    role: user.role
  };

  req.authUser = user;

  return {
    authenticated: true
  };
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

    await authenticateRequest(
      req,
      res
    );

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

/*
========================================
OPTIONAL AUTH
========================================

Public requests are allowed.

If a valid Bearer token is supplied,
req.user is populated.

Invalid supplied tokens are rejected
rather than silently treated as public.
*/

export async function optionalAuth(
  req,
  res,
  next
) {
  try {
    const token = getToken(req);

    if (!token) {
      return next();
    }

    await authenticateRequest(
      req,
      res
    );

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
      "OPTIONAL AUTH ERROR:",
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

  return (
    req,
    res,
    next
  ) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required."
      });
    }

    if (
      validRoles.length === 0
    ) {
      return res.status(500).json({
        success: false,
        message:
          "Server role configuration error."
      });
    }

    const userRole =
      String(
        req.user.role || ""
      )
        .trim()
        .toLowerCase();

    if (
      !validRoles.includes(
        userRole
      )
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
