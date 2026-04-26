const COLORS = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  grey: "\x1b[90m",
  white: "\x1b[37m",
};

const LEVELS = {
  INFO: { emoji: "✅", color: COLORS.green, label: "INFO" },
  WARN: { emoji: "⚠️", color: COLORS.yellow, label: "WARN" },
  ERROR: { emoji: "🔴", color: COLORS.red, label: "ERROR" },
  DEBUG: { emoji: "🔍", color: COLORS.cyan, label: "DEBUG" },
  HTTP: { emoji: "🌐", color: COLORS.magenta, label: "HTTP" },
};

function format(level, context, message, meta = {}) {
  const ts = new Date().toISOString();
  const isProd = process.env.NODE_ENV === "production";
  const levelData = LEVELS[level] || LEVELS.INFO;

  if (isProd) {
    return JSON.stringify({
      ts,
      level: levelData.label,
      context,
      message,
      ...meta,
    });
  }

  const color = levelData.color;
  const emoji = levelData.emoji;
  const reset = COLORS.reset;
  const grey = COLORS.grey;
  const metaStr = Object.keys(meta).length
    ? ` ${grey}${JSON.stringify(meta)}${reset}`
    : "";

  return `${grey}${ts}${reset} ${emoji} ${color}[${levelData.label}]${reset} ${color}[${context}]${reset} ${message}${metaStr}`;
}

function log(level, context, message, meta = {}) {
  const entry = format(level, context, message, meta);
  if (level === "ERROR") {
    process.stderr.write(entry + "\n");
  } else {
    process.stdout.write(entry + "\n");
  }
}

const logger = {
  info: (ctx, msg, meta) => log("INFO", ctx, msg, meta),
  warn: (ctx, msg, meta) => log("WARN", ctx, msg, meta),
  error: (ctx, msg, meta) => log("ERROR", ctx, msg, meta),
  debug: (ctx, msg, meta) => {
    if (process.env.NODE_ENV !== "production") {
      log("DEBUG", ctx, msg, meta);
    }
  },
};

function logRequest(req, res, next) {
  const start = Date.now();

  const originalJson = res.json.bind(res);
  res.json = function (body) {
    const duration = Date.now() - start;
    const status = res.statusCode;

    const level = status >= 500 ? "ERROR" : status >= 400 ? "WARN" : "HTTP";

    log(level, "HTTP", `${req.method} ${req.path}`, {
      status,
      ms: duration,
      ip:
        req.headers["x-forwarded-for"]?.split(",")[0] ||
        req.socket.remoteAddress,
    });

    return originalJson(body);
  };

  next();
}

function attachProcessHandlers() {
  process.on("uncaughtException", (err) => {
    logger.error("Process", "💥 UNCAUGHT EXCEPTION — process will exit", {
      name: err.name,
      message: err.message,
      stack: err.stack,
    });
    process.exit(1);
  });

  process.on("unhandledRejection", (reason, promise) => {
    logger.error("Process", "💥 UNHANDLED PROMISE REJECTION — check this!", {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });

  process.on("SIGTERM", () => {
    logger.info("Process", "🛑 SIGTERM received — shutting down gracefully");
    process.exit(0);
  });

  logger.info("Process", "✅ Process error handlers attached");
}

module.exports = { logger, logRequest, attachProcessHandlers };
