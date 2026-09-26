const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Payment = require("../models/Payment");
const User = require("../models/User");
const { requireAuth } = require("../middleware/auth");
const {
  PLANS,
  createOrder,
  verifyPayment,
  verifyWebhookSignature,
} = require("../services/paymentService");
const { logger } = require("../utils/logger");

router.get("/plans", (req, res) => {
  const publicPlans = Object.values(PLANS).map((plan) => ({
    id: plan.id,
    name: plan.name,
    amount: plan.amount,
    currency: plan.currency,
  }));
  res.json({ success: true, plans: publicPlans });
});

router.post("/create-order", requireAuth, async (req, res) => {
  logger.debug("Payment", "create-order body", { body: req.body });
  const { planId } = req.body;

  if (!planId) {
    return res.status(400).json({
      error: "MISSING_PLAN",
      message: "planId is required.",
    });
  }

  if (!PLANS[planId]) {
    return res.status(400).json({
      error: "INVALID_PLAN",
      message: `Unknown plan: ${planId}. Valid plans: ${Object.keys(PLANS).join(", ")}`,
    });
  }

  try {
    const { order, plan } = await createOrder(planId, req.user._id);

    return res.status(200).json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      planName: plan.name,
      planId: plan.id,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      error: "ORDER_FAILED",
      message: err.message || "Could not create payment order.",
    });
  }
});

router.post("/verify", requireAuth, async (req, res) => {
  const { orderId, paymentId, signature, planId } = req.body;

  if (!orderId || !paymentId || !signature || !planId) {
    return res.status(400).json({
      error: "MISSING_FIELDS",
      message: "orderId, paymentId, signature and planId are all required.",
    });
  }

  const isValid = verifyPayment({ orderId, paymentId, signature });

  if (!isValid) {
    return res.status(400).json({
      error: "INVALID_SIGNATURE",
      message:
        "Payment verification failed. Contact support if money was deducted.",
    });
  }

  try {
    const existing = await Payment.findOne({ razorpayPaymentId: paymentId });
    if (existing) {
      return res
        .status(200)
        .json({ success: true, message: "Already processed.", isPro: true });
    }

    try {
      await Payment.create({
        userId: req.user._id,
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        planId,
        amount: PLANS[planId]?.amount || 0,
        status: "captured",
      });
    } catch (paymentErr) {
      logger.error("Payment", "Verify failed", { message: paymentErr.message });
    }

    req.user.isPro = true;
    req.user.proPlan = planId;
    req.user.proSince = new Date();
    await req.user.save();

    return res.status(200).json({
      success: true,
      message: "⚡ Pro unlocked! Enjoy the nuclear roasts.",
      isPro: true,
    });
  } catch (err) {
    logger.error("Payment", "Verify DB error", { message: err.message });
    return res.status(500).json({
      error: "DB_ERROR",
      message:
        "Payment verified but account upgrade failed. Contact support with your payment ID.",
    });
  }
});

router.post("/webhook", async (req, res) => {
  const signature = req.headers["x-razorpay-signature"];
  const secret =
    process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;

  if (!signature || !secret) {
    logger.warn("Payment", "Webhook rejected — missing signature or secret");
    return res.status(400).json({ error: "MISSING_SIGNATURE_OR_SECRET" });
  }

  const isValid = verifyWebhookSignature(req.rawBody, signature, secret);
  if (!isValid) {
    logger.warn("Payment", "Webhook invalid signature");
    return res.status(400).json({ error: "INVALID_SIGNATURE" });
  }

  const event = req.body;
  const eventType = event?.event;
  logger.info("Payment", `Webhook received: ${eventType}`);

  try {
    if (eventType === "payment.captured" || eventType === "order.paid") {
      const paymentEntity = event?.payload?.payment?.entity;
      const orderEntity = event?.payload?.order?.entity;

      const paymentId = paymentEntity?.id;
      const orderId = paymentEntity?.order_id || orderEntity?.id;
      const notes = paymentEntity?.notes || orderEntity?.notes || {};
      const planId = notes.planId;
      const userId = notes.userId;
      const amount = paymentEntity?.amount || orderEntity?.amount || 0;

      const isValidUserId = userId && mongoose.Types.ObjectId.isValid(userId);

      if (paymentId) {
        let paymentDoc = await Payment.findOne({
          razorpayPaymentId: paymentId,
        });

        if (!paymentDoc) {
          if (isValidUserId) {
            await Payment.create({
              userId,
              razorpayOrderId: orderId || "webhook_captured",
              razorpayPaymentId: paymentId,
              planId: planId || "roaster",
              amount,
              status: "captured",
            });
          } else {
            const existingOrderByOrder = orderId
              ? await Payment.findOne({ razorpayOrderId: orderId })
              : null;

            if (existingOrderByOrder) {
              existingOrderByOrder.razorpayPaymentId = paymentId;
              existingOrderByOrder.status = "captured";
              await existingOrderByOrder.save();
            } else {
              logger.warn("Payment", "Webhook payment received without valid userId or pre-existing order", {
                paymentId,
                orderId,
                userId,
              });
            }
          }
        } else if (paymentDoc.status !== "captured") {
          paymentDoc.status = "captured";
          await paymentDoc.save();
        }
      }

      if (isValidUserId) {
        const user = await User.findById(userId);
        if (user && !user.isPro) {
          user.isPro = true;
          user.proPlan = (paymentDoc && paymentDoc.planId) || "roaster";
          user.proSince = new Date();
          await user.save();
          logger.info("Payment", `Pro unlocked via webhook for user ${userId}`);
        }
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    logger.error("Payment", "Webhook processing error", {
      message: err.message,
    });
    return res.status(500).json({ error: "WEBHOOK_PROCESSING_FAILED" });
  }
});

module.exports = router;
