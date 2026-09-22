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
    ip: {
      type: String,
      default: "",
    },
    userAgent: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["unread", "investigating", "resolved"],
      default: "unread",
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("ContactMessage", contactMessageSchema);
