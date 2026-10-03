const express = require("express");
const router = express.Router();
const { runBattle } = require("../services/battleService");
const { optionalAuth } = require("../middleware/auth");
const { verifyCaptcha } = require("../middleware/captcha");
const { logger } = require("../utils/logger");

const mongoose = require("mongoose");
const Battle = require("../models/Battle");
const User = require("../models/User");
const redisService = require("../services/redisService");

const battleReactionCache = new Map();
setInterval(() => battleReactionCache.clear(), 24 * 60 * 60 * 1000).unref();

router.get("/", async (req, res) => {
  res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const [battles, total] = await Promise.all([
      Battle.find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("user1 user2 score1 score2 grade1 grade2 winner loser battleRoast reactions rematchCount createdAt")
        .lean(),
      Battle.estimatedDocumentCount(),
    ]);

    return res.status(200).json({
      success: true,
      battles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    logger.error("Battle", "Failed to fetch battles list", { message: err.message });
    return res.status(500).json({ success: false, error: "SERVER_ERROR", battles: [] });
  }
});

router.get("/:user1/vs/:user2", optionalAuth, verifyCaptcha, async (req, res) => {
  const { user1, user2 } = req.params;

  const usernameRegex = /^[a-zA-Z0-9-]+$/;
  if (
    !user1 ||
    user1.length > 39 ||
    !usernameRegex.test(user1) ||
    !user2 ||
    user2.length > 39 ||
    !usernameRegex.test(user2)
  ) {
    return res.status(400).json({
      error: "INVALID_USERNAME",
      message: "Invalid GitHub username format.",
    });
  }

  if (user1.toLowerCase() === user2.toLowerCase()) {
    return res.status(400).json({
      error: "SAME_USER",
      message: "You cannot battle yourself. Even if you want to.",
    });
  }

  const norm1 = (user1 || "").toLowerCase();
  const norm2 = (user2 || "").toLowerCase();
  const battlePairKey = [norm1, norm2].sort().join("-vs-");
  const cacheKey = `cache:battle:${battlePairKey}`;

  const isRematchRequested = req.query.rematch === "true";
  if (redisService.isConfigured && !isRematchRequested) {
    const cached = await redisService.get(cacheKey).catch(() => null);
    if (cached) {
      return res.status(200).json(cached);
    }
  }

  try {
    const token = req.user?.githubAccessToken || null;
    const result = await runBattle(user1, user2, token);

    try {
      let battleDoc = await Battle.findOne({
        $or: [
          { user1: norm1, user2: norm2 },
          { user1: norm2, user2: norm1 },
        ],
      });
      const isNewBattle = !battleDoc;
      if (battleDoc) {
        const isReversed = battleDoc.user1 === norm2 && battleDoc.user2 === norm1;
        if (isReversed) {
          battleDoc.score1 = result.score2;
          battleDoc.score2 = result.score1;
          battleDoc.grade1 = result.grade2;
          battleDoc.grade2 = result.grade1;
          battleDoc.roast1 = result.roast2;
          battleDoc.roast2 = result.roast1;
          battleDoc.stats1 = result.stats2;
          battleDoc.stats2 = result.stats1;
        } else {
          battleDoc.score1 = result.score1;
          battleDoc.score2 = result.score2;
          battleDoc.grade1 = result.grade1;
          battleDoc.grade2 = result.grade2;
          battleDoc.roast1 = result.roast1;
          battleDoc.roast2 = result.roast2;
          battleDoc.stats1 = result.stats1;
          battleDoc.stats2 = result.stats2;
        }
        battleDoc.winner = result.winner;
        battleDoc.loser = result.loser;
        if (req.query.rematch === "true") {
          battleDoc.rematchCount = (battleDoc.rematchCount || 0) + 1;
        }
        await battleDoc.save();
      } else {
        battleDoc = await Battle.create({
          user1: norm1,
          user2: norm2,
          avatarUrl1: `https://avatars.githubusercontent.com/${norm1}?s=120`,
          avatarUrl2: `https://avatars.githubusercontent.com/${norm2}?s=120`,
          ...result,
        });
      }

      result._id = battleDoc._id;
      result.battleId = battleDoc._id;
      result.reactions = battleDoc.reactions || { relatable: 0, destroyed: 0, savage: 0 };

      if (isNewBattle && result.winner && result.winner !== "tie" && result.loser) {
        User.updateOne(
          { username: new RegExp(`^${result.winner}$`, "i") },
          { $inc: { "stats.battlesWon": 1 } }
        ).catch(() => {});
        User.updateOne(
          { username: new RegExp(`^${result.loser}$`, "i") },
          { $inc: { "stats.battlesLost": 1 } }
        ).catch(() => {});
      }
    } catch (dbErr) {
      logger.warn("Battle", "Failed to persist battle in DB", { message: dbErr.message });
      result.reactions = { relatable: 0, destroyed: 0, savage: 0 };
    }

    const responsePayload = { success: true, data: result };
    if (redisService.isConfigured) {
      redisService.set(cacheKey, responsePayload, 60).catch(() => {});
    }

    return res.status(200).json(responsePayload);
  } catch (err) {
    if (err.message === "ORGANIZATION_NOT_SUPPORTED" || err.code === "ORGANIZATION_NOT_SUPPORTED") {
      return res.status(400).json({
        error: "ORGANIZATION_NOT_SUPPORTED",
        message: "GitRoast battles are for individual developers, not organizations.",
      });
    }
    if (err.message === "USER_NOT_FOUND") {
      return res.status(404).json({
        error: "USER_NOT_FOUND",
        message: "One or both GitHub users not found. Check the usernames.",
      });
    }
    if (err.message === "RATE_LIMIT_EXCEEDED") {
      return res.status(429).json({
        error: "RATE_LIMIT_EXCEEDED",
        message: "GitHub rate limit hit. Try again in 60 seconds.",
      });
    }
    logger.error("Battle", "Route error", { message: err.message });
    return res.status(500).json({
      error: "SERVER_ERROR",
      message: "Battle failed. Both developers live to code another day.",
    });
  }
});

router.post("/:id/react", async (req, res) => {
  const { id } = req.params;
  const { type } = req.body;

  const allowed = ["relatable", "destroyed", "savage"];
  if (!type || !allowed.includes(type)) {
    return res.status(400).json({
      error: "INVALID_TYPE",
      message: `type must be one of: ${allowed.join(", ")}`,
    });
  }

  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.ip ||
    req.socket.remoteAddress ||
    "unknown";

  const normalizedId = id.includes("-vs-")
    ? id.split("-vs-").map((s) => (s || "").trim().toLowerCase()).sort().join("-vs-")
    : id;
  const cacheKey = `${ip}:${normalizedId}:${type}`;
  if (battleReactionCache.has(cacheKey)) {
    return res.status(200).json({
      success: true,
      duplicate: true,
      message: "Already reacted to this battle.",
    });
  }

  try {
    let updated = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      updated = await Battle.addReaction(id, type);
    } else if (id.includes("-vs-")) {
      const [u1, u2] = id.split("-vs-");
      const norm1 = (u1 || "").trim().toLowerCase();
      const norm2 = (u2 || "").trim().toLowerCase();
      const battle = await Battle.findOne({
        $or: [
          { user1: norm1, user2: norm2 },
          { user1: norm2, user2: norm1 },
        ],
      });
      if (battle) {
        updated = await Battle.addReaction(battle._id, type);
      }
    }

    if (!updated) {
      return res.status(404).json({
        error: "BATTLE_NOT_FOUND",
        message: "Battle not found.",
      });
    }

    if (battleReactionCache.size >= 50000) {
      const firstKey = battleReactionCache.keys().next().value;
      battleReactionCache.delete(firstKey);
    }
    battleReactionCache.set(cacheKey, true);

    return res.status(200).json({
      success: true,
      reactions: updated.reactions,
    });
  } catch (err) {
    logger.error("Battle", "Save reaction failed", { message: err.message });
    return res.status(500).json({
      error: "SERVER_ERROR",
      message: "Could not save reaction.",
    });
  }
});

router.post("/:user1/vs/:user2/react", async (req, res) => {
  const { user1, user2 } = req.params;
  const { type } = req.body;

  const allowed = ["relatable", "destroyed", "savage"];
  if (!type || !allowed.includes(type)) {
    return res.status(400).json({
      error: "INVALID_TYPE",
      message: `type must be one of: ${allowed.join(", ")}`,
    });
  }

  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.ip ||
    req.socket.remoteAddress ||
    "unknown";

  const norm1 = (user1 || "").toLowerCase();
  const norm2 = (user2 || "").toLowerCase();
  const pairKey = [norm1, norm2].sort().join("-vs-");
  const cacheKey = `${ip}:${pairKey}:${type}`;

  if (battleReactionCache.has(cacheKey)) {
    return res.status(200).json({
      success: true,
      duplicate: true,
      message: "Already reacted to this battle.",
    });
  }

  try {
    const battle = await Battle.findOne({
      $or: [
        { user1: norm1, user2: norm2 },
        { user1: norm2, user2: norm1 },
      ],
    });

    if (!battle) {
      return res.status(404).json({
        error: "BATTLE_NOT_FOUND",
        message: "Battle not found. Run the battle first before reacting.",
      });
    }

    const updated = await Battle.addReaction(battle._id, type);

    if (battleReactionCache.size >= 50000) {
      const firstKey = battleReactionCache.keys().next().value;
      battleReactionCache.delete(firstKey);
    }
    battleReactionCache.set(cacheKey, true);

    return res.status(200).json({
      success: true,
      reactions: updated.reactions,
    });
  } catch (err) {
    logger.error("Battle", "Save slug reaction failed", { message: err.message });
    return res.status(500).json({
      error: "SERVER_ERROR",
      message: "Could not save reaction.",
    });
  }
});

router.post("/:id/view", async (req, res) => {
  const { id } = req.params;
  try {
    if (mongoose.Types.ObjectId.isValid(id)) {
      await Battle.incrementView(id);
    } else if (id && id.includes("-vs-")) {
      const [u1, u2] = id.split("-vs-");
      if (u1 && u2) {
        const battle = await Battle.findOne({
          $or: [
            { user1: u1.trim().toLowerCase(), user2: u2.trim().toLowerCase() },
            { user1: u2.trim().toLowerCase(), user2: u1.trim().toLowerCase() },
          ],
        });
        if (battle) await Battle.incrementView(battle._id);
      }
    }
    return res.status(200).json({ success: true });
  } catch {
    return res.status(200).json({ success: true });
  }
});

router.post("/:id/share", async (req, res) => {
  const { id } = req.params;
  try {
    if (mongoose.Types.ObjectId.isValid(id)) {
      await Battle.incrementShare(id);
    } else if (id && id.includes("-vs-")) {
      const [u1, u2] = id.split("-vs-");
      if (u1 && u2) {
        const battle = await Battle.findOne({
          $or: [
            { user1: u1.trim().toLowerCase(), user2: u2.trim().toLowerCase() },
            { user1: u2.trim().toLowerCase(), user2: u1.trim().toLowerCase() },
          ],
        });
        if (battle) await Battle.incrementShare(battle._id);
      }
    }
    return res.status(200).json({ success: true });
  } catch {
    return res.status(200).json({ success: true });
  }
});

module.exports = router;
