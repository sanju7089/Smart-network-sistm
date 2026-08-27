import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";

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

const allowedOrigins = String(
  process.env.ALLOWED_ORIGINS || ""
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(helmet());

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.length === 0) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(
        new Error("Origin not allowed by CORS")
      );
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
    ]
  })
);

app.use(express.json({ limit: "1mb" }));

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/users", userRoutes);
app.use("/api/workers", workerRoutes);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Smart Work Network API is running",
    version: "1.0.0"
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "healthy",
    timestamp: new Date().toISOString()
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found."
  });
});

app.use((error, req, res, next) => {
  console.error("SERVER ERROR:", error);

  res.status(
    error.status || 500
  ).json({
    success: false,
    message:
      error.message || "Internal server error."
  });
});

app.listen(PORT, () => {
  console.log(
    `Smart Work Network API running on port ${PORT}`
  );
});
