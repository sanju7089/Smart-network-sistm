import mongoose from "mongoose";

export async function connectDatabase() {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error(
      "MONGODB_URI is not configured in environment variables."
    );
  }

  mongoose.connection.on("connected", () => {
    console.log(
      `MongoDB connected: ${mongoose.connection.host}`
    );
  });

  mongoose.connection.on("error", (error) => {
    console.error(
      "MongoDB connection error:",
      error.message
    );
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("MongoDB disconnected.");
  });

  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000
  });

  return mongoose.connection;
}

export function getDatabaseStatus() {
  const states = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting"
  };

  return {
    status:
      states[mongoose.connection.readyState] ||
      "unknown",
    readyState: mongoose.connection.readyState,
    host: mongoose.connection.host || null,
    name: mongoose.connection.name || null
  };
}

export async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close(false);

    console.log("MongoDB connection closed.");
  }
    }
