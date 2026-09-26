const mongoose = require("mongoose");

const contactMessageSchema = new mongoose.Schema(
  {
    ticketId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    category: {
      type: String,
      required: true,
      enum: ["feedback", "bug", "pro", "dispute", "general"],
      default: "general",
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "normal", "high", "urgent"],
      default: "normal",
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    username: {
      type: String,
      trim: true,
      default: null,
    },
    name: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "Anonymous Developer",
    },
    email: {
      type: String,
      trim: true,
      maxlength: 150,
      default: "",
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 3000,
    },
    adminNotes: {
      type: String,
      trim: true,
      default: "",
    },
    ip: {
      type: String,
      default: "",
    },
    userAgent: {
      type: String,
      default: "",
    },
    emailDelivered: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["unread", "investigating", "resolved"],
      default: "unread",
      index: true,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

contactMessageSchema.index({ status: 1, priority: -1, createdAt: -1 });
contactMessageSchema.index({ email: 1, createdAt: -1 });

module.exports = mongoose.model("ContactMessage", contactMessageSchema);
