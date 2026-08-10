const express = require("express");
const router = express.Router();
const Payment = require("../models/Payment");
const { requireAuth } = require("../middleware/auth");
const {
  PLANS,
  createOrder,
  verifyPayment,
} = require("../services/paymentService");

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
  console.log("[Payment] create-order body:", req.body);
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
      console.error(
        "[Payment] Payment.create failed:",
        paymentErr.message,
        paymentErr,
      );
    }

    req.user.isPro = true;
    req.user.proSince = new Date();
    await req.user.save();

    return res.status(200).json({
      success: true,
      message: "⚡ Pro unlocked! Enjoy the nuclear roasts.",
      isPro: true,
    });
  } catch (err) {
    console.error("[Payment] verify DB error:", err.message, err);
    return res.status(500).json({
      error: "DB_ERROR",
      message:
        "Payment verified but account upgrade failed. Contact support with your payment ID.",
    });
  }
});

module.exports = router;
