import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "url";
import path from "path";

import { loadEnvironment } from "./config/environment.js";
import {
  connectDatabase,
  getDatabaseStatus,
  disconnectDatabase
} from "./config/database.js";

import {
  securityHeaders,
  requestLogger,
  notFound,
  errorHandler
} from "./middleware/securityMiddleware.js";

import { razorpayWebhook } from "./controllers/paymentController.js";

import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import bookingRoutes from "./routes/bookings.js";
import jobRoutes from "./routes/jobs.js";
import paymentRoutes from "./routes/payments.js";
import userRoutes from "./routes/users.js";
import workerRoutes from "./routes/workers.js";
import supportRoutes from "./routes/support.js";
import earningsRoutes from "./routes/earnings.js";
import notificationRoutes from "./routes/notifications.js";
import liveLocationRoutes from "./routes/liveLocation.js";

dotenv.config();

const ENV = loadEnvironment();

const {
  port: PORT,
  nodeEnv: NODE_ENV,
  isProduction,
  allowedOrigins
} = ENV;

const app = express();

/* ================================
   PATHS
================================ */

const CURRENT_FILE = fileURLToPath(import.meta.url);
const SERVER_DIR = path.dirname(CURRENT_FILE);
const PROJECT_ROOT = path.resolve(SERVER_DIR, "..");

/* ================================
   TRUST PROXY
================================ */

if (isProduction) {
  app.set("trust proxy", 1);
}

/* ================================
   SECURITY
================================ */

app.disable("x-powered-by");

app.use(
  helmet({
    crossOriginResourcePolicy: false
  })
);

app.use(securityHeaders);

/* ================================
   CORS
================================ */

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (
        !isProduction &&
        allowedOrigins.length === 0
      ) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      const error = new Error(
        "Origin not allowed by CORS."
      );

      error.status = 403;

      return callback(error);
    },

    credentials: true,

    methods: [
      "GET",
      "POST",
      "PATCH",
      "PUT",
      "DELETE",
      "OPTIONS"
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization"
    ],

    optionsSuccessStatus: 204
  })
);

/* ================================
   API RATE LIMIT
================================ */

const globalApiLimiter =
  rateLimit({
    windowMs: 15 * 60 * 1000,

    limit: 300,

    standardHeaders: "draft-7",

    legacyHeaders: false,

    skip(req) {
      return req.path === "/health";
    },

    message: {
      success: false,
      message:
        "Too many requests. Please try again later."
    }
  });

app.use(
  "/api",
  globalApiLimiter
);

/* ================================
   RAZORPAY WEBHOOK
   RAW BODY BEFORE JSON
================================ */

app.post(
  "/api/payments/razorpay/webhook",

  express.raw({
    type: "application/json",
    limit: "1mb"
  }),

  razorpayWebhook
);

/* ================================
   BODY PARSERS
================================ */

app.use(
  express.json({
    limit: "1mb"
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb"
  })
);

app.use(cookieParser());

app.use(requestLogger);

/* ================================
   FRONTEND SECURITY
================================ */

/*
Render currently uses:

Root Directory = server

Therefore PROJECT_ROOT points to
the actual repository root.

Frontend files such as:

index.html
css/
js/
*.html

are served from PROJECT_ROOT.

Backend source under /server
is never served publicly.
*/

app.use(
  (req, res, next) => {
    const requestPath =
      req.path.toLowerCase();

    if (
      requestPath === "/server" ||
      requestPath.startsWith("/server/") ||

      requestPath === "/.git" ||
      requestPath.startsWith("/.git/") ||

      requestPath === "/package.json" ||
      requestPath === "/package-lock.json"
    ) {
      return res.status(404).end();
    }

    next();
  }
);

/* ================================
   STATIC FRONTEND
================================ */

app.use(
  express.static(
    PROJECT_ROOT,
    {
      index: false,
      dotfiles: "ignore",
      redirect: false
    }
  )
);

/* ================================
   WEBSITE HOME
================================ */

app.get(
  "/",
  (req, res) => {
    return res.sendFile(
      path.join(
        PROJECT_ROOT,
        "index.html"
      )
    );
  }
);

/* ================================
   API ROOT
================================ */

app.get(
  "/api",
  (req, res) => {
    return res.status(200).json({
      success: true,

      message:
        "Smart Work Network API is running",

      version: "2.0.0",

      environment: NODE_ENV,

      timestamp:
        new Date().toISOString()
    });
  }
);

/* ================================
   HEALTH CHECK
================================ */

app.get(
  "/api/health",
  (req, res) => {
    const database =
      getDatabaseStatus();

    const healthy =
      database.status ===
      "connected";

    return res
      .status(
        healthy
          ? 200
          : 503
      )
      .json({
        success: healthy,

        status:
          healthy
            ? "healthy"
            : "unhealthy",

        application:
          "Smart Work Network API",

        environment:
          NODE_ENV,

        database,

        uptime:
          Math.floor(
            process.uptime()
          ),

        timestamp:
          new Date().toISOString()
      });
  }
);

/* ================================
   AUTH
================================ */

app.use(
  "/api/auth",
  authRoutes
);

/* ================================
   ADMIN
================================ */

app.use(
  "/api/admin",
  adminRoutes
);

/* ================================
   BOOKINGS
================================ */

app.use(
  "/api/bookings",
  bookingRoutes
);

/* ================================
   JOBS
================================ */

app.use(
  "/api/jobs",
  jobRoutes
);

/* ================================
   PAYMENTS
================================ */

app.use(
  "/api/payments",
  paymentRoutes
);

/* ================================
   USERS
================================ */

app.use(
  "/api/users",
  userRoutes
);

/* ================================
   WORKERS
================================ */

app.use(
  "/api/workers",
  workerRoutes
);

/* ================================
   SUPPORT
================================ */

app.use(
  "/api/support",
  supportRoutes
);

/* ================================
   EARNINGS
================================ */

app.use(
  "/api/earnings",
  earningsRoutes
);

/* ================================
   NOTIFICATIONS
================================ */

app.use(
  "/api/notifications",
  notificationRoutes
);

/* ================================
   LIVE LOCATION
================================ */

app.use(
  "/api/live-location",
  liveLocationRoutes
);

/* ================================
   404 + ERROR
================================ */

app.use(notFound);

app.use(errorHandler);

/* ================================
   SERVER
================================ */

let server = null;

let shuttingDown = false;

async function startServer() {
  try {
    await connectDatabase();

    server =
      app.listen(
        PORT,
        () => {
          console.log(
            `Smart Work Network running on port ${PORT}`
          );

          console.log(
            `Environment: ${NODE_ENV}`
          );

          console.log(
            "Frontend: /"
          );

          console.log(
            "Health: /api/health"
          );
        }
      );

    return server;

  } catch (error) {
    console.error(
      "Failed to start server:",
      error?.stack ||
        error?.message ||
        error
    );

    process.exit(1);
  }
}

/* ================================
   GRACEFUL SHUTDOWN
================================ */

async function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  console.log(
    `\n${signal} received. Starting graceful shutdown...`
  );

  try {
    if (server) {
      await new Promise(
        (resolve, reject) => {
          server.close(
            (error) => {
              if (error) {
                return reject(error);
              }

              resolve();
            }
          );
        }
      );
    }

    await disconnectDatabase();

    console.log(
      "Graceful shutdown completed."
    );

    process.exit(0);

  } catch (error) {
    console.error(
      "Graceful shutdown failed:",
      error?.stack ||
        error?.message ||
        error
    );

    process.exit(1);
  }
}

/* ================================
   PROCESS SIGNALS
================================ */

process.on(
  "SIGTERM",
  () => {
    shutdown("SIGTERM");
  }
);

process.on(
  "SIGINT",
  () => {
    shutdown("SIGINT");
  }
);

process.on(
  "unhandledRejection",
  (reason) => {
    console.error(
      "Unhandled Promise Rejection:",
      reason
    );

    shutdown(
      "UNHANDLED_REJECTION"
    );
  }
);

process.on(
  "uncaughtException",
  (error) => {
    console.error(
      "Uncaught Exception:",
      error?.stack ||
        error?.message ||
        error
    );

    shutdown(
      "UNCAUGHT_EXCEPTION"
    );
  }
);

/* ================================
   START
================================ */

if (
  process.argv[1] &&
  path.resolve(
    process.argv[1]
  ) ===
    path.resolve(
      CURRENT_FILE
    )
) {
  startServer();
}

/* ================================
   EXPORTS
================================ */

export {
  app,
  startServer,
  shutdown
};

export default app;
