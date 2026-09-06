import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "url";
import path from "path";

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

import {
razorpayWebhook
} from "./controllers/paymentController.js";

import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import bookingRoutes from "./routes/bookings.js";
import jobRoutes from "./routes/jobs.js";
import paymentRoutes from "./routes/payments.js";
import userRoutes from "./routes/users.js";
import workerRoutes from "./routes/workers.js";
import supportRoutes from "./routes/support.js";
import earningsRoutes from "./routes/earnings.js";

dotenv.config();

const app = express();

const PORT =
Number(process.env.PORT) || 3000;

const isProduction =
process.env.NODE_ENV === "production";

const allowedOrigins =
String(process.env.ALLOWED_ORIGINS || "")
.split(",")
.map((origin) => origin.trim())
.filter(Boolean);

if (
isProduction &&
allowedOrigins.length === 0
) {
throw new Error(
"ALLOWED_ORIGINS must be configured in production."
);
}

if (isProduction) {
app.set("trust proxy", 1);
}

app.disable("x-powered-by");

app.use(
helmet({
crossOriginResourcePolicy: false
})
);

app.use(securityHeaders);

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

app.post(
"/api/payments/razorpay/webhook",
express.raw({
type: "application/json",
limit: "1mb"
}),
razorpayWebhook
);

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

app.get(
"/",
(req, res) => {
return res.status(200).json({
success: true,
message:
"Smart Work Network API is running",
version: "2.0.0",
timestamp:
new Date().toISOString()
});
}
);

app.get(
"/api/health",
(req, res) => {
const database =
getDatabaseStatus();

const healthy =
  database.status === "connected";

return res
  .status(healthy ? 200 : 503)
  .json({
    success: healthy,

    status:
      healthy
        ? "healthy"
        : "unhealthy",

    application:
      "Smart Work Network API",

    environment:
      process.env.NODE_ENV ||
      "development",

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

app.use(
"/api/auth",
authRoutes
);

app.use(
"/api/admin",
adminRoutes
);

app.use(
"/api/bookings",
bookingRoutes
);

app.use(
"/api/jobs",
jobRoutes
);

app.use(
"/api/payments",
paymentRoutes
);

app.use(
"/api/users",
userRoutes
);

app.use(
"/api/workers",
workerRoutes
);

app.use(
"/api/support",
supportRoutes
);

app.use(
"/api/earnings",
earningsRoutes
);

app.use(notFound);

app.use(errorHandler);

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
        `Smart Work Network API running on port ${PORT}`
      );

      console.log(
        `Environment: ${
          process.env.NODE_ENV ||
          "development"
        }`
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

async function shutdown(signal) {
if (shuttingDown) {
return;
}

shuttingDown = true;

console.log(
"\n${signal} received. Starting graceful shutdown..."
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

const currentFile =
fileURLToPath(import.meta.url);

const executedFile =
process.argv[1]
? path.resolve(process.argv[1])
: "";

if (
executedFile ===
path.resolve(currentFile)
) {
startServer();
}

export {
app,
startServer,
shutdown
};

export default app;
