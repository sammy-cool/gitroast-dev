const mongoose = require("mongoose");

const roastSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    roastedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    score: {
      type: Number,
      required: true,
      min: 1,
      max: 99,
    },

    grade: {
      type: String,
      required: true,
      enum: ["A", "B", "C", "D", "F", "F-"],
    },

    roastText: {
      type: String,
      required: true,
    },

    roastSource: {
      type: String,
      enum: ["rules", "ai"],
      default: "rules",
    },

    intensity: {
      type: String,
      enum: ["mild", "savage", "nuclear"],
      default: "savage",
    },

    githubSnapshot: {
      totalRepos: { type: Number, default: 0 },
      joinYear: { type: Number, default: 0 },
      followers: { type: Number, default: 0 },
      topLanguage: { type: String, default: "" },
      abandonedCount: { type: Number, default: 0 },
      commitQuality: { type: Number, default: 0 },
      totalStars: { type: Number, default: 0 },
      hasReadme: { type: Boolean, default: false },
    },

    stats: [
      {
        label: String,
        value: String,
        bad: Boolean,
        note: String,
      },
    ],

    shameCommits: [String],

    isPro: {
      type: Boolean,
      default: false,
    },

    shareCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

roastSchema.index({ username: 1, createdAt: -1 });

roastSchema.index({ score: 1, createdAt: -1 });


roastSchema.statics.getHistory = function (username, limit = 10) {
  return this.find({ username }).sort({ createdAt: -1 }).limit(limit);
};

roastSchema.statics.getLeaderboard = function (limit = 10) {
  return this.aggregate([
    {
      $group: {
        _id: "$username",
        bestScore: { $min: "$score" },
        roastCount: { $sum: 1 },
      },
    },
    {
      $sort: { bestScore: 1 },
    },
    { $limit: limit },
  ]);
};

roastSchema.statics.incrementShare = function (id) {
  return this.findByIdAndUpdate(id, { $inc: { shareCount: 1 } });
};

module.exports = mongoose.model("Roast", roastSchema);
