const { randomUUID } = require("crypto");
const os = require("os");

const SERVICE_META = {
  service: "gitroast-api",
  hostname: os.hostname(),
  pid: process.pid,
  nodeVersion: process.version,
};

const COLORS = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  grey: "\x1b[90m",
  white: "\x1b[37m",
  bold: "\x1b[1m",
};

const LEVELS = {
  ERROR: { severity: 3, emoji: "🔴", color: COLORS.red, label: "ERROR" },
  WARN: { severity: 4, emoji: "⚠️", color: COLORS.yellow, label: "WARN" },
  INFO: { severity: 6, emoji: "✅", color: COLORS.green, label: "INFO" },
  HTTP: { severity: 6, emoji: "🌐", color: COLORS.magenta, label: "HTTP" },
  DEBUG: { severity: 7, emoji: "🔍", color: COLORS.cyan, label: "DEBUG" },
};

const IS_PROD = process.env.NODE_ENV === "production";
const IS_TEST = process.env.NODE_ENV === "test";

function format(level, context, message, meta = {}) {
  const ts = new Date().toISOString();
  const levelData = LEVELS[level] || LEVELS.INFO;

  if (IS_PROD) {
    return JSON.stringify({
      ts,
      level: levelData.label,
      severity: levelData.severity,
      context,
      message,
      ...SERVICE_META,
      ...meta,
    });
  }

  const color = levelData.color;
  const emoji = levelData.emoji;
  const reset = COLORS.reset;
  const grey = COLORS.grey;
  const metaStr = Object.keys(meta).length
    ? " " + grey + JSON.stringify(meta) + reset
    : "";

  return grey + ts + reset + " " + emoji + " " + color + "[" + levelData.label + "]" + reset + " " + color + "[" + context + "]" + reset + " " + message + metaStr;
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
    if (!IS_PROD) {
      log("DEBUG", ctx, msg, meta);
    }
  },
  child: (defaults = {}) => ({
    info: (ctx, msg, meta) => log("INFO", ctx, msg, { ...defaults, ...meta }),
    warn: (ctx, msg, meta) => log("WARN", ctx, msg, { ...defaults, ...meta }),
    error: (ctx, msg, meta) => log("ERROR", ctx, msg, { ...defaults, ...meta }),
    debug: (ctx, msg, meta) => {
      if (!IS_PROD) {
        log("DEBUG", ctx, msg, { ...defaults, ...meta });
      }
    },
  }),
};


const SUPPRESSED_PATHS = new Set(["/health", "/api/health"]);
const healthPingTracker = { count: 0, since: Date.now() };

setInterval(() => {
  if (healthPingTracker.count > 0) {
    logger.info("Health", `🏥 Health check summary: ${healthPingTracker.count} pings received (all OK) in last 5m`);
    healthPingTracker.count = 0;
  }
  healthPingTracker.since = Date.now();
}, 5 * 60 * 1000).unref();

function logRequest(req, res, next) {
  if (SUPPRESSED_PATHS.has(req.path)) {
    healthPingTracker.count++;
    return next();
  }

  const start = Date.now();

  const requestId =
    req.headers["x-request-id"] || randomUUID();
  req.id = requestId;

  res.setHeader("X-Request-Id", requestId);

  res.on("finish", () => {
    const duration = Date.now() - start;
    const status = res.statusCode;

    const level = status >= 500 ? "ERROR" : status >= 400 ? "WARN" : "HTTP";

    const ip = req.ip || req.socket?.remoteAddress || "unknown";

    const contentLength = res.getHeader("content-length");

    log(level, "HTTP", `${req.method} ${req.originalUrl}`, {
      status,
      ms: duration,
      ip,
      requestId,
      route: req.route?.path || undefined,
      bytes: contentLength ? parseInt(contentLength, 10) : undefined,
      userAgent: IS_PROD
        ? (req.headers["user-agent"] || "").slice(0, 120) || undefined
        : undefined,
    });
  });

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

  logger.info("Process", "✅ Process error handlers attached", {
    ...SERVICE_META,
    env: process.env.NODE_ENV || "development",
    uptime: Math.round(process.uptime()) + "s",
  });
}

module.exports = { logger, logRequest, attachProcessHandlers };
