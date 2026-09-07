import mongoose from "mongoose";

let listenersRegistered = false;
let connectionPromise = null;

function registerDatabaseListeners() {
  if (listenersRegistered) {
    return;
  }

  listenersRegistered = true;

  mongoose.connection.on("connected", () => {
    console.log(
      `MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`
    );
  });

  mongoose.connection.on("error", (error) => {
    console.error(
      "MongoDB connection error:",
      error?.message || error
    );
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("MongoDB disconnected.");
  });

  mongoose.connection.on("reconnected", () => {
    console.log("MongoDB reconnected.");
  });
}

export async function connectDatabase() {
  const mongoUri = String(
    process.env.MONGODB_URI || ""
  ).trim();

  if (!mongoUri) {
    throw new Error(
      "MONGODB_URI is not configured in environment variables."
    );
  }

  registerDatabaseListeners();

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = mongoose
    .connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 0,
      autoIndex:
        process.env.NODE_ENV !== "production"
    })
    .then(() => {
      return mongoose.connection;
    })
    .finally(() => {
      connectionPromise = null;
    });

  return connectionPromise;
}

export function getDatabaseStatus() {
  const states = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting"
  };

  const readyState =
    mongoose.connection.readyState;

  return {
    status:
      states[readyState] || "unknown",

    readyState,

    host:
      mongoose.connection.host || null,

    name:
      mongoose.connection.name || null
  };
}

export async function disconnectDatabase() {
  if (
    mongoose.connection.readyState === 0
  ) {
    return;
  }

  try {
    await mongoose.connection.close();

    console.log(
      "MongoDB connection closed."
    );
  } catch (error) {
    console.error(
      "MongoDB shutdown error:",
      error?.message || error
    );

    throw error;
  }
}
