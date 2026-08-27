import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

function createToken(user) {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured.");
  }

  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role
    },
    JWT_SECRET,
    {
      expiresIn: "7d"
    }
  );
}

/*
  Temporary controller foundation.

  Database integration will be connected
  in the database step. These functions
  are kept ready for the route layer.
*/

export async function signup(req, res) {
  try {
    const {
      name,
      email,
      password,
      role
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message:
          "Name, email and password are required."
      });
    }

    if (String(password).length < 8) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 8 characters."
      });
    }

    return res.status(501).json({
      success: false,
      message:
        "Database setup is required before account creation."
    });
  } catch (error) {
    console.error("SIGNUP ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create account."
    });
  }
}

export async function login(req, res) {
  try {
    const {
      email,
      password
    } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message:
          "Email and password are required."
      });
    }

    return res.status(501).json({
      success: false,
      message:
        "Database setup is required before login."
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to login."
    });
  }
}

export async function getCurrentUser(req, res) {
  return res.json({
    success: true,
    user: req.user
  });
}
