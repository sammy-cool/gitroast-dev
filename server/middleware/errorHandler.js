const { logger } = require("../utils/logger");

const ERROR_MAP = {
  ValidationError: (err) => ({
    status: 400,
    error: "VALIDATION_ERROR",
    message: Object.values(err.errors)
      .map((e) => e.message)
      .join(", "),
  }),

  CastError: () => ({
    status: 400,
    error: "INVALID_ID",
    message: "Invalid ID format.",
  }),

  JsonWebTokenError: () => ({
    status: 401,
    error: "TOKEN_INVALID",
    message: "Invalid token. Please login again.",
  }),

  TokenExpiredError: () => ({
    status: 401,
    error: "TOKEN_EXPIRED",
    message: "Session expired. Please login again.",
  }),
};

function errorHandler(err, req, res, next) {
  logger.error("ErrorHandler", `${req.method} ${req.path}`, {
    name: err.name,
    message: err.message,
    code: err.code,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });

  const knownHandler = ERROR_MAP[err.name];
  if (knownHandler) {
    const { status, error, message } = knownHandler(err);
    return res.status(status).json({ error, message });
  }

  if (err.code === 11000) {
    return res.status(409).json({
      error: "DUPLICATE_ENTRY",
      message: "This record already exists.",
    });
  }

  const statusCode = err.statusCode || err.status || 500;

  const message =
    process.env.NODE_ENV === "production"
      ? "Something went wrong. Please try again."
      : err.message;

  res.status(statusCode).json({ error: "SERVER_ERROR", message });
}

function notFoundHandler(req, res) {
  logger.warn("404", `Route not found: ${req.method} ${req.path}`);
  res.status(404).json({
    error: "NOT_FOUND",
    message: `Route ${req.method} ${req.path} does not exist.`,
  });
}

module.exports = { errorHandler, notFoundHandler };
