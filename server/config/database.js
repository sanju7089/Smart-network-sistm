import mongoose from "mongoose";

let listenersRegistered = false;

function registerDatabaseListeners() {
  if (listenersRegistered) return;

  listenersRegistered = true;

  mongoose.connection.on("connected", () => {
    console.log(
      `MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`
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
}

export async function connectDatabase() {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error(
      "MONGODB_URI is not configured in environment variables."
    );
  }

  registerDatabaseListeners();

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

  const readyState = mongoose.connection.readyState;

  return {
    status: states[readyState] || "unknown",
    readyState,
    host: mongoose.connection.host || null,
    name: mongoose.connection.name || null
  };
}

export async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();

    console.log("MongoDB connection closed.");
  }
}
