import jwt from "jsonwebtoken";

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

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
    req.headers.authorization || "";

  const [type, token] =
    authorization.split(" ");

  if (
    type !== "Bearer" ||
    !token ||
    !token.trim()
  ) {
    return null;
  }

  return token.trim();
}

export function requireAuth(req, res, next) {
  try {
    const token = getToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication token is required."
      });
    }

    const secret = getJwtSecret();

    const payload = jwt.verify(
      token,
      secret
    );

    if (
      !payload ||
      !payload.id ||
      !payload.role
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid authentication token."
      });
    }

    req.user = {
      id: String(payload.id),
      email: payload.email || "",
      role: payload.role
    };

    return next();

  } catch (error) {
    if (
      error.name === "TokenExpiredError"
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication token has expired."
      });
    }

    if (
      error.name === "JsonWebTokenError"
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

export function requireRole(...allowedRoles) {
  const validRoles =
    allowedRoles
      .map((role) =>
        String(role).trim().toLowerCase()
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
