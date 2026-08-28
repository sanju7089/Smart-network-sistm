import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";

import { connectDatabase } from "./config/database.js";

import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import bookingRoutes from "./routes/bookings.js";
import jobRoutes from "./routes/jobs.js";
import paymentRoutes from "./routes/payments.js";
import userRoutes from "./routes/users.js";
import workerRoutes from "./routes/workers.js";

dotenv.config();

const app = express();

const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === "production";

const allowedOrigins = String(
  process.env.ALLOWED_ORIGINS || ""
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (isProduction && allowedOrigins.length === 0) {
  throw new Error(
    "ALLOWED_ORIGINS must be configured in production."
  );
}

app.disable("x-powered-by");

app.use(
  helmet({
    crossOriginResourcePolicy: false
  })
);

app.use(
  cors({
    origin(origin, callback) {
      // Server-to-server requests / health checks
      if (!origin) {
        return callback(null, true);
      }

      if (!isProduction && allowedOrigins.length === 0) {
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

app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Smart Work Network API is running",
    version: "2.0.0"
  });
});

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "healthy",
    environment:
      process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString()
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/users", userRoutes);
app.use("/api/workers", workerRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found."
  });
});

app.use((error, req, res, next) => {
  console.error("SERVER ERROR:", error);

  if (error.name === "SyntaxError") {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON request."
    });
  }

  return res.status(error.status || 500).json({
    success: false,
    message:
      error.status && error.status < 500
        ? error.message
        : "Internal server error."
  });
});

async function startServer() {
  try {
    await connectDatabase();

    app.listen(PORT, () => {
      console.log(
        `Smart Work Network API running on port ${PORT}`
      );
    });
  } catch (error) {
    console.error(
      "Failed to start server:",
      error.message
    );

    process.exit(1);
  }
}

startServer();
