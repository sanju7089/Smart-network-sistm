export function securityHeaders(req, res, next) {
  res.setHeader(
    "X-Content-Type-Options",
    "nosniff"
  );

  res.setHeader(
    "X-Frame-Options",
    "DENY"
  );

  res.setHeader(
    "Referrer-Policy",
    "strict-origin-when-cross-origin"
  );

  next();
}

export function requestLogger(req, res, next) {
  const startedAt = Date.now();

  res.on("finish", () => {
    const duration =
      Date.now() - startedAt;

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

function isValidHttpStatus(status) {
  return (
    Number.isInteger(status) &&
    status >= 400 &&
    status <= 599
  );
}

function getErrorStatus(error) {
  const statusCode =
    Number(error?.statusCode);

  const status =
    Number(error?.status);

  if (isValidHttpStatus(statusCode)) {
    return statusCode;
  }

  if (isValidHttpStatus(status)) {
    return status;
  }

  return 500;
}

function isDuplicateKeyError(error) {
  return (
    error &&
    error.code === 11000
  );
}

function getDuplicateField(error) {
  if (
    error &&
    error.keyPattern
  ) {
    const fields =
      Object.keys(error.keyPattern);

    if (fields.length > 0) {
      return fields[0];
    }
  }

  if (
    error &&
    error.keyValue
  ) {
    const fields =
      Object.keys(error.keyValue);

    if (fields.length > 0) {
      return fields[0];
    }
  }

  return null;
}

function isValidationError(error) {
  return (
    error &&
    error.name ===
      "ValidationError"
  );
}

function isCastError(error) {
  return (
    error &&
    error.name ===
      "CastError"
  );
}

function isRateLimitError(error) {
  return (
    error &&
    (
      error.statusCode === 429 ||
      error.status === 429
    )
  );
}

function isJsonSyntaxError(error) {
  return (
    error instanceof SyntaxError &&
    error.status === 400 &&
    "body" in error
  );
}

export function errorHandler(
  error,
  req,
  res,
  next
) {
  console.error(
    "SERVER ERROR:",
    error?.stack ||
      error?.message ||
      error
  );

  if (res.headersSent) {
    return next(error);
  }

  /*
   * INVALID JSON
   */
  if (
    isJsonSyntaxError(error)
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Invalid JSON request."
    });
  }

  /*
   * MONGOOSE DUPLICATE KEY
   */
  if (
    isDuplicateKeyError(error)
  ) {
    const field =
      getDuplicateField(error);

    return res.status(409).json({
      success: false,
      message: field
        ? `A record with this ${field} already exists.`
        : "A record with the same value already exists."
    });
  }

  /*
   * MONGOOSE VALIDATION
   */
  if (
    isValidationError(error)
  ) {
    const validationErrors =
      {};

    for (
      const [
        field,
        details
      ] of Object.entries(
        error.errors || {}
      )
    ) {
      validationErrors[field] =
        details.message;
    }

    return res.status(400).json({
      success: false,
      message:
        "Validation failed.",
      errors:
        validationErrors
    });
  }

  /*
   * INVALID OBJECT ID / CAST
   */
  if (
    isCastError(error)
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Invalid resource identifier."
    });
  }

  /*
   * RATE LIMIT
   */
  if (
    isRateLimitError(error)
  ) {
    return res.status(429).json({
      success: false,
      message:
        "Too many requests. Please try again later."
    });
  }

  /*
   * NORMAL APPLICATION ERROR
   */
  const statusCode =
    getErrorStatus(error);

  /*
   * NEVER expose internal
   * server/database/payment
   * details for 5xx errors.
   */
  if (
    statusCode >= 500
  ) {
    return res.status(500).json({
      success: false,
      message:
        "Internal server error."
    });
  }

  return res
    .status(statusCode)
    .json({
      success: false,
      message:
        error?.message ||
        "Request failed."
    });
  }
