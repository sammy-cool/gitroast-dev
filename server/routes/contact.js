const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const ContactMessage = require("../models/ContactMessage");
const { sendContactNotification } = require("../services/emailService");
const { enqueue } = require("../services/queueService");
const { evaluateContactTicket } = require("../services/typeSafeService");
const { verifyCaptcha } = require("../middleware/captcha");
const { optionalAuth } = require("../middleware/auth");
const { logger } = require("../utils/logger");

const VALID_CATEGORIES = ["feedback", "bug", "pro", "dispute", "general"];

router.post("/", optionalAuth, verifyCaptcha, async (req, res) => {
  try {
    const { category, name, email, message } = req.body || {};

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        error: "Message content is required.",
        code: "INVALID_MESSAGE",
      });
    }

    if (message.trim().length < 5) {
      return res.status(400).json({
        error: "Message must be at least 5 characters long.",
        code: "MESSAGE_TOO_SHORT",
      });
    }

    const safeCategory = VALID_CATEGORIES.includes(category)
      ? category
      : "general";

    const safeName = typeof name === "string" && name.trim()
      ? name.trim().slice(0, 100)
      : "Anonymous Developer";

    const safeEmail = typeof email === "string" && email.trim()
      ? email.trim().slice(0, 150)
      : "";

    if (safeEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail)) {
      return res.status(400).json({
        error: "Please provide a valid email address.",
        code: "INVALID_EMAIL",
      });
    }

    const safeMessage = message.trim().slice(0, 3000);

    const randomCode = Math.floor(100000 + Math.random() * 900000);
    let ticketId = `GR-${randomCode}`;

    const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
      req.socket.remoteAddress ||
      "";
    const userAgent = req.headers["user-agent"] || "";

    logger.info("Contact", `📨 New message received [#${ticketId}]`, {
      ticketId,
      category: safeCategory,
      name: safeName,
      email: safeEmail ? `${safeEmail.slice(0, 3)}...` : "(none)",
      messageLength: safeMessage.length,
    });

    let priority =
      safeCategory === "dispute" || safeCategory === "pro"
        ? "high"
        : safeCategory === "bug"
        ? "high"
        : "normal";

    const triage = await evaluateContactTicket(safeMessage);
    if (triage.isUrgent) {
      priority = "urgent";
    }

    let savedToDb = false;
    if (mongoose.connection.readyState === 1) {
      let attempts = 0;
      while (attempts < 3) {
        try {
          const doc = new ContactMessage({
            ticketId,
            userId: req.user?._id || null,
            username: req.user?.username || null,
            category: safeCategory,
            priority,
            name: safeName,
            email: safeEmail,
            message: safeMessage,
            ip,
            userAgent,
          });
          await doc.save();
          savedToDb = true;
          break;
        } catch (dbErr) {
          if (dbErr.code === 11000 && attempts < 2) {
            ticketId = `GR-${Math.floor(100000 + Math.random() * 900000)}`;
            attempts++;
          } else {
            logger.warn("Contact", "Failed to save message to MongoDB (falling back to audit log)", {
              ticketId,
              error: dbErr.message,
            });
            break;
          }
        }
      }
    } else {
      logger.info("Contact", "MongoDB disconnected — dispatched message logged to audit stream", {
        ticketId,
      });
    }

    enqueue(
      `contact-email-${ticketId}`,
      () =>
        sendContactNotification({
          ticketId,
          category: safeCategory,
          name: safeName,
          email: safeEmail,
          message: safeMessage,
          ip,
        }),
      { maxRetries: 2 },
    );

    return res.status(201).json({
      success: true,
      ticketId,
      category: safeCategory,
      message: "Your message has been dispatched to the GitRoast team.",
      saved: savedToDb,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.error("Contact", "Error processing contact message", {
      error: err.message,
    });
    return res.status(500).json({
      error: "Failed to dispatch contact message. Please try again or email directly.",
      code: "DISPATCH_FAILED",
    });
  }
});

module.exports = router;
