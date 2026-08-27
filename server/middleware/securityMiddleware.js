export function securityHeaders(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");

  next();
}

export function requestLogger(req, res, next) {
  console.log(
    `${new Date().toISOString()} ${req.method} ${req.originalUrl}`
  );

  next();
}

export function notFound(req, res) {
  res.status(404).json({
    success: false,
    message: "API route not found."
  });
}

export function errorHandler(error, req, res, next) {
  console.error("SERVER ERROR:", error);

  const statusCode =
    Number(error.statusCode) ||
    Number(error.status) ||
    500;

  res.status(statusCode).json({
    success: false,
    message:
      statusCode === 500
        ? "Internal server error."
        : error.message || "Request failed."
  });
                }
