import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { OAuth2Client } from "google-auth-library";

import User from "../models/User.js";

const COOKIE_NAME = "swn_auth";

const JWT_ISSUER =
  "smart-work-network";

const JWT_AUDIENCE =
  "smart-work-network-users";

const googleClientId =
  String(
    process.env.GOOGLE_CLIENT_ID || ""
  ).trim();

const googleClient =
  new OAuth2Client(
    googleClientId
  );

function getJwtSecret() {
  const secret =
    String(
      process.env.JWT_SECRET || ""
    ).trim();

  if (!secret) {
    const error =
      new Error(
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
      process.env.JWT_EXPIRES_IN ||
        "7d"
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
        Number(
          user.tokenVersion || 0
        )
    },
    getJwtSecret(),
    {
      expiresIn:
        getJwtExpiresIn(),
      issuer:
        JWT_ISSUER,
      audience:
        JWT_AUDIENCE
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
      sameSite:
        isProduction
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
  return String(
    email || ""
  )
    .trim()
    .toLowerCase();
}

export function getGoogleConfig(
  req,
  res
) {
  const clientId =
    String(
      process.env.GOOGLE_CLIENT_ID ||
        ""
    ).trim();

  if (!clientId) {
    return res.status(500).json({
      success: false,
      message:
        "Google Login is not configured on the server."
    });
  }

  return res.status(200).json({
    success: true,
    clientId
  });
}

export async function googleLogin(
  req,
  res
) {
  try {
    const credential =
      String(
        req.body?.credential ||
          ""
      ).trim();

    if (!credential) {
      return res.status(400).json({
        success: false,
        message:
          "Google credential is required."
      });
    }

    const clientId =
      String(
        process.env.GOOGLE_CLIENT_ID ||
          ""
      ).trim();

    if (!clientId) {
      return res.status(500).json({
        success: false,
        message:
          "Google Login is not configured."
      });
    }

    const ticket =
      await googleClient.verifyIdToken(
        {
          idToken:
            credential,
          audience:
            clientId
        }
      );

    const payload =
      ticket.getPayload();

    if (!payload) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid Google account."
      });
    }

    const googleId =
      String(
        payload.sub || ""
      ).trim();

    const email =
      normalizeEmail(
        payload.email
      );

    const name =
      String(
        payload.name ||
          payload.given_name ||
          "Google User"
      )
        .trim()
        .slice(0, 100);

    const emailVerified =
      payload.email_verified ===
      true;

    if (!googleId) {
      return res.status(401).json({
        success: false,
        message:
          "Google account ID is missing."
      });
    }

    if (!email) {
      return res.status(401).json({
        success: false,
        message:
          "Google account email is missing."
      });
    }

    if (!emailVerified) {
      return res.status(403).json({
        success: false,
        message:
          "Google email is not verified."
      });
    }

    let user =
      await User.findOne({
        googleId
      });

    if (user) {
      if (
        user.email !== email
      ) {
        user.email = email;
      }

      user.emailVerified =
        true;

      user.isActive =
        true;

      user.authProvider =
        "google";

      await user.save();
    } else {
      user =
        await User.findOne({
          email
        });

      if (user) {
        if (
          user.role === "admin"
        ) {
          return res.status(403).json({
            success: false,
            message:
              "This administrator account cannot be linked through Google Login."
          });
        }

        user.googleId =
          googleId;

        user.authProvider =
          "google";

        user.emailVerified =
          true;

        user.isActive =
          true;

        if (
          !user.name ||
          user.name.trim()
            .length < 2
        ) {
          user.name =
            name;
        }

        await user.save();
      } else {
        const randomPassword =
          crypto.randomBytes(32)
            .toString("hex");

        const hashedPassword =
          await bcrypt.hash(
            randomPassword,
            12
          );

        user =
          await User.create({
            name:
              name ||
              "Google User",
            email,
            password:
              hashedPassword,
            googleId,
            authProvider:
              "google",
            role: "customer",
            phone: "",
            location: "",
            isActive: true,
            emailVerified: true,
            tokenVersion: 0
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
      googleLogin: true,
      message:
        "Google Login successful.",
      user:
        createUserResponse(
          user
        )
    });
  } catch (error) {
    console.error(
      "GOOGLE LOGIN ERROR:",
      error
    );

    if (
      error?.code === 11000
    ) {
      return res.status(409).json({
        success: false,
        message:
          "This Google account is already linked to another account."
      });
    }

    return res.status(401).json({
      success: false,
      message:
        "Google Login failed. Please try again."
    });
  }
}
