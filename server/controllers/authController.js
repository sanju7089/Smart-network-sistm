import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Worker from "../models/Worker.js";

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

function createUserResponse(user) {
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

export async function signup(req, res) {
  try {
    const {
      name,
      email,
      password,
      role,
      phone,
      location
    } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message:
          "Name, email and password are required."
      });
    }

    const cleanName = String(name).trim();

    if (cleanName.length < 2) {
      return res.status(400).json({
        success: false,
        message:
          "Name must be at least 2 characters."
      });
    }

    if (cleanName.length > 100) {
      return res.status(400).json({
        success: false,
        message:
          "Name must not exceed 100 characters."
      });
    }

    const normalizedEmail =
      normalizeEmail(email);

    if (!normalizedEmail) {
      return res.status(400).json({
        success: false,
        message:
          "A valid email is required."
      });
    }

    if (String(password).length < 8) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 8 characters."
      });
    }

    if (String(password).length > 128) {
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

    /*
      Public signup can only create
      customer or worker accounts.
      Admin accounts must never be
      created through public signup.
    */

    const allowedRoles = [
      "customer",
      "worker"
    ];

    const requestedRole =
      String(role || "")
        .trim()
        .toLowerCase();

    const safeRole =
      allowedRoles.includes(requestedRole)
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

    const user = await User.create({
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

    const token = createToken(user);

    return res.status(201).json({
      success: true,
      message:
        safeRole === "worker"
          ? "Worker account and profile created successfully."
          : "Account created successfully.",
      token,
      user: createUserResponse(user),
      workerProfile: workerProfile
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
    /*
      Handle duplicate email safely,
      including race conditions.
    */

    if (error?.code === 11000) {
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

export async function login(req, res) {
  try {
    const {
      email,
      password
    } = req.body || {};

    if (!email || !password) {
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

    /*
      Same response for unknown email
      and wrong password.
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

    const token = createToken(user);

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      user: createUserResponse(user)
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

export async function getCurrentUser(
  req,
  res
) {
  try {
    /*
      requireAuth already verifies
      the current user and stores it
      in req.user.
    */

    const user =
      req.authUser ||
      await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found."
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
      user: createUserResponse(user)
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
