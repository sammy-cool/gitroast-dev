require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");
const {
  roastLimiter,
  authLimiter,
  battleLimiter,
  generalLimiter,
} = require("./middleware/rateLimiter");
const { logger, logRequest, attachProcessHandlers } = require("./utils/logger");

attachProcessHandlers();

const app = express();
const PORT = process.env.PORT || 5000;

app.use((req, res, next) => {
  res.setHeader("X-Frame-Options", "DENY");

  res.setHeader("X-Content-Type-Options", "nosniff");

  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000");
  }

  next();
});

app.use(
  cors({
    origin: [process.env.CLIENT_URL || "http://localhost:3000"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Idempotency-Key"],
  }),
);

app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(cookieParser());

app.use(logRequest);

app.use("/api", generalLimiter);

app.use("/api/roast", roastLimiter, require("./routes/roast"));
app.use("/api/auth", authLimiter, require("./routes/auth"));
app.use("/api/history", require("./routes/history"));
app.use("/api/payment", require("./routes/payment"));
app.use("/api/battle", battleLimiter, require("./routes/battle"));

app.get("/health", generalLimiter, (req, res) => {
  res.json({
    status: "🔥 GitRoast server is alive",
    time: new Date().toISOString(),
    mongoDb:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    env: process.env.NODE_ENV || "development",
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

mongoose
  .connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
  })
  .then(() => {
    logger.info("MongoDB", "✅ Connected to Atlas");
    app.listen(PORT, () => {
      logger.info("Server", `🚀 Running on port ${PORT}`, {
        env: process.env.NODE_ENV || "development",
        port: PORT,
      });
    });
  })
  .catch((err) => {
    logger.error("MongoDB", "❌ Connection failed — server cannot start", {
      message: err.message,
    });
    process.exit(1);
  });
