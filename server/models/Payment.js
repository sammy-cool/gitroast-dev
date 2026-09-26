const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    planId: {
      type: String,
      required: true,
      enum: ["roaster", "historian"],
    },

    amount: {
      type: Number,
      required: true,
    },

    currency: {
      type: String,
      default: "INR",
    },

    razorpayOrderId: {
      type: String,
      index: true,
    },

    razorpayPaymentId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    customerEmail: {
      type: String,
      trim: true,
      default: null,
    },

    receipt: {
      type: String,
      default: null,
    },

    invoiceId: {
      type: String,
      default: null,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    refundReason: {
      type: String,
      default: null,
    },

    refundedAt: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ["pending", "captured", "failed", "refunded"],
      default: "pending",
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("Payment", paymentSchema);
