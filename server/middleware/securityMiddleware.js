export function securityHeaders(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader(
    "Referrer-Policy",
    "strict-origin-when-cross-origin"
  );

  next();
}

export function requestLogger(req, res, next) {
  const startedAt = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - startedAt;

    console.log(
      `${new Date().toISOString()} | ` +
      `${req.method} ${req.originalUrl} | ` +
      `${res.statusCode} | ${duration}ms`
    );
  });

  next();
}

export function notFound(req, res) {
  return res.status(404).json({
    success: false,
    message: "API route not found.",
    path: req.originalUrl
  });
}

export function errorHandler(error, req, res, next) {
  console.error(
    "SERVER ERROR:",
    error.stack || error.message
  );

  if (res.headersSent) {
    return next(error);
  }

  if (
    error instanceof SyntaxError &&
    error.status === 400 &&
    "body" in error
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON request."
    });
  }

  const statusCode =
    Number(error.statusCode) ||
    Number(error.status) ||
    500;

  return res.status(statusCode).json({
    success: false,
    message:
      statusCode >= 500
        ? "Internal server error."
        : error.message || "Request failed."
  });
}
