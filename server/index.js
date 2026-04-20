require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");

const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");
const {
  roastLimiter,
  authLimiter,
  generalLimiter,
} = require("./middleware/rateLimiter");

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
  }),
);
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(cookieParser());

app.use("/api", generalLimiter);

app.use("/api/roast", roastLimiter, require("./routes/roast"));
app.use("/api/auth", authLimiter, require("./routes/auth"));
app.use("/api/history", require("./routes/history"));
app.use("/api/payment", require("./routes/payment"));
app.use("/api/battle", require("./routes/battle"));

app.get("/health", (req, res) => {
  res.json({
    status: "GitRoast server is alive 🔥",
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
    console.log("✅ MongoDB Atlas connected");
    app.listen(PORT, () => {
      console.log(`🔥 GitRoast server running on port ${PORT}`);
      console.log(`📡 Health: http://localhost:${PORT}/health`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });

process.on("SIGTERM", async () => {
  console.log("🛑 SIGTERM received — shutting down gracefully");
  await mongoose.connection.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("🛑 SIGINT received — shutting down gracefully");
  await mongoose.connection.close();
  process.exit(0);
});
