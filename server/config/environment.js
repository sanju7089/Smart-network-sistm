const DEFAULT_NODE_ENV = "development";

const ALLOWED_NODE_ENVS = new Set([
  "development",
  "test",
  "production"
]);

function parseAllowedOrigins(value) {
  return String(value || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => origin.replace(/\/$/, ""));
}

function parsePort(value) {
  const port = Number(value || 3000);

  if (
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new Error(
      "PORT must be an integer between 1 and 65535."
    );
  }

  return port;
}

function requireValue(name) {
  if (!String(process.env[name] || "").trim()) {
    throw new Error(
      `${name} is not configured in environment variables.`
    );
  }
}

export function loadEnvironment() {
  const nodeEnv = String(
    process.env.NODE_ENV ||
      DEFAULT_NODE_ENV
  )
    .trim()
    .toLowerCase();

  if (!ALLOWED_NODE_ENVS.has(nodeEnv)) {
    throw new Error(
      `NODE_ENV must be one of: ${[
        ...ALLOWED_NODE_ENVS
      ].join(", ")}.`
    );
  }

  process.env.NODE_ENV = nodeEnv;

  const isProduction =
    nodeEnv === "production";

  const isTest =
    nodeEnv === "test";

  const port =
    parsePort(process.env.PORT);

  const allowedOrigins =
    parseAllowedOrigins(
      process.env.ALLOWED_ORIGINS
    );

  if (
    allowedOrigins.includes("*")
  ) {
    throw new Error(
      "ALLOWED_ORIGINS cannot contain * because the API uses credentialed CORS."
    );
  }

  if (!isTest) {
    requireValue("MONGODB_URI");
    requireValue("JWT_SECRET");
  }

  if (isProduction) {
    if (
      allowedOrigins.length === 0
    ) {
      throw new Error(
        "ALLOWED_ORIGINS must be configured in production."
      );
    }

    if (
      process.env.JWT_SECRET.length < 32
    ) {
      throw new Error(
        "JWT_SECRET must contain at least 32 characters in production."
      );
    }
  }

  if (!process.env.JWT_EXPIRES_IN) {
    process.env.JWT_EXPIRES_IN = "7d";
  }

  if (!process.env.PAYMENT_CURRENCY) {
    process.env.PAYMENT_CURRENCY = "INR";
  }

  if (
    !isProduction &&
    !isTest &&
    allowedOrigins.length === 0
  ) {
    console.warn(
      "CORS: development mode is allowing requests from any origin."
    );
  }

  return Object.freeze({
    nodeEnv,
    isProduction,
    isTest,
    port,
    allowedOrigins
  });
}
