const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Roast = require("../models/Roast");
const { logger } = require("../utils/logger");
const { getCompanyLeaderboard } = require("../services/companyRoastService");

router.get("/leaderboard/worst", async (req, res) => {
  res.setHeader(
    "Cache-Control",
    "public, max-age=60, stale-while-revalidate=120",
  );
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));

    const result = await Roast.getLeaderboard({ page, limit });
    return res.status(200).json({
      success: true,
      leaderboard: result.entries,
      pagination: result.pagination,
    });
  } catch (err) {
    logger.error("Leaderboard", "Fetch failed", { message: err.message });
    return res.status(500).json({
      error: "SERVER_ERROR",
      message: "Could not fetch leaderboard.",
    });
  }
});

router.get("/leaderboard/companies", (req, res) => {
  res.setHeader(
    "Cache-Control",
    "public, max-age=3600, stale-while-revalidate=7200",
  );
  try {
    const companies = getCompanyLeaderboard();
    return res.status(200).json({
      success: true,
      companies,
    });
  } catch (err) {
    logger.error("CompaniesLeaderboard", "Failed to fetch companies", { message: err.message });
    return res.status(500).json({
      error: "SERVER_ERROR",
      message: "Could not fetch company leaderboard.",
    });
  }
});

router.get("/leaderboard/search", async (req, res) => {
  res.setHeader(
    "Cache-Control",
    "public, max-age=30, stale-while-revalidate=60"
  );
  try {
    const q = (req.query.q || "").trim();
    if (!q || q.length < 2) {
      return res.status(200).json({ success: true, results: [], pagination: { total: 0, page: 1, totalPages: 0 } });
    }
    const safeQ = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const result = await Roast.aggregate([
      { $match: { username: { $regex: safeQ, $options: "i" } } },
      { $project: { username: 1, score: 1 } },
      { $group: { _id: "$username", bestScore: { $min: "$score" }, roastCount: { $sum: 1 } } },
      { $facet: {
          metadata: [{ $count: "total" }],
          data: [{ $sort: { bestScore: 1 } }, { $skip: skip }, { $limit: limit }],
      }},
    ]);

    const total = result[0]?.metadata?.[0]?.total || 0;
    const entries = result[0]?.data || [];
    return res.status(200).json({
      success: true,
      results: entries,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)), hasNext: page < Math.ceil(total / limit), hasPrev: page > 1 },
    });
  } catch (err) {
    logger.error("Leaderboard Search", "Search failed", { message: err.message });
    return res.status(500).json({
      error: "SERVER_ERROR",
      message: "Could not search leaderboard.",
    });
  }
});

router.get("/daily-burn", async (req, res) => {
  res.setHeader(
    "Cache-Control",
    "public, max-age=300, stale-while-revalidate=600",
  );
  try {
    const topRoast = await Roast.findOne({
      roastText: { $exists: true, $ne: "" },
    })
      .sort({ "reactions.savage": -1, "reactions.destroyed": -1, createdAt: -1 })
      .select("username score grade roastText reactions avatarUrl")
      .lean();

    if (topRoast) {
      return res.status(200).json({
        success: true,
        roast: {
          username: topRoast.username,
          score: topRoast.score,
          grade: topRoast.grade,
          roastText: topRoast.roastText,
          reactions: topRoast.reactions || { relatable: 0, destroyed: 0, savage: 0 },
          avatarUrl: topRoast.avatarUrl || `https://avatars.githubusercontent.com/${topRoast.username}?s=96`,
        },
      });
    }

    return res.status(200).json({
      success: true,
      roast: {
        username: "torvalds",
        score: 18,
        grade: "F",
        roastText: "Your git log reads like an anger management transcript. 30 years of C code and still not a single unit test in sight.",
        reactions: { relatable: 142, destroyed: 420, savage: 690 },
        avatarUrl: "https://avatars.githubusercontent.com/torvalds?s=96",
      },
    });
  } catch (err) {
    logger.warn("DailyBurn", "Fallback triggered", { message: err.message });
    return res.status(200).json({
      success: true,
      roast: {
        username: "torvalds",
        score: 18,
        grade: "F",
        roastText: "Your git log reads like an anger management transcript. 30 years of C code and still not a single unit test in sight.",
        reactions: { relatable: 142, destroyed: 420, savage: 690 },
        avatarUrl: "https://avatars.githubusercontent.com/torvalds?s=96",
      },
    });
  }
});

router.get("/:username", async (req, res) => {
  const { username } = req.params;

  if (!username || !/^[a-zA-Z0-9-]+$/.test(username)) {
    return res.status(400).json({
      error: "INVALID_USERNAME",
      message: "Invalid GitHub username.",
    });
  }

  try {
    const limit = parseInt(req.query.limit) || 10;
    const history = await Roast.getHistory(username, limit);

    return res.status(200).json({
      success: true,
      username,
      count: history.length,
      history,
    });
  } catch (err) {
    logger.error("History", "Fetch failed", { message: err.message });
    return res.status(500).json({
      error: "SERVER_ERROR",
      message: "Could not fetch history.",
    });
  }
});

router.post("/:id/share", async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      error: "INVALID_ID",
      message: "Invalid roast ID.",
    });
  }

  try {
    await Roast.incrementShare(id);
    return res.status(200).json({ success: true });
  } catch {
    return res.status(200).json({ success: true });
  }
});

const reactionCache = new Map();
setInterval(() => reactionCache.clear(), 24 * 60 * 60 * 1000).unref();

router.post("/:id/react", async (req, res) => {
  const { id } = req.params;
  const { type } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      error: "INVALID_ID",
      message: "Invalid roast ID.",
    });
  }

  const allowed = ["relatable", "destroyed", "savage"];
  if (!type || !allowed.includes(type)) {
    return res.status(400).json({
      error: "INVALID_REACTION",
      message: `type must be one of: ${allowed.join(", ")}`,
    });
  }

  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "unknown";

  const cacheKey = `${ip}:${id}:${type}`;
  if (reactionCache.has(cacheKey)) {
    return res.status(200).json({
      success: true,
      duplicate: true,
      message: "Already reacted.",
    });
  }

  try {
    const updated = await Roast.addReaction(id, type);

    if (!updated) {
      return res.status(404).json({
        error: "ROAST_NOT_FOUND",
        message: "Roast not found.",
      });
    }

    if (reactionCache.size >= 50000) reactionCache.clear();
    reactionCache.set(cacheKey, true);

    return res.status(200).json({
      success: true,
      reactions: updated.reactions,
    });
  } catch (err) {
    logger.error("React", "Save reaction failed", { message: err.message });
    return res.status(500).json({
      error: "SERVER_ERROR",
      message: "Could not save reaction.",
    });
  }
});

module.exports = router;
