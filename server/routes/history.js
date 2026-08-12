const express = require("express");
const router = express.Router();
const Roast = require("../models/Roast");
const { optionalAuth } = require("../middleware/auth");

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
    console.error("[History] Error:", err.message);
    return res.status(500).json({
      error: "SERVER_ERROR",
      message: "Could not fetch history.",
    });
  }
});

router.get("/leaderboard/worst", async (req, res) => {
  try {
    const leaderboard = await Roast.getLeaderboard(10);
    return res.status(200).json({ success: true, leaderboard });
  } catch (err) {
    console.error("[Leaderboard] Error:", err.message);
    return res.status(500).json({
      error: "SERVER_ERROR",
      message: "Could not fetch leaderboard.",
    });
  }
});

router.post("/:id/share", async (req, res) => {
  try {
    await Roast.incrementShare(req.params.id);
    return res.status(200).json({ success: true });
  } catch {
    return res.status(200).json({ success: true });
  }
});

const reactionCache = new Map();
setInterval(() => reactionCache.clear(), 24 * 60 * 60 * 1000);

router.post("/:id/react", async (req, res) => {
  const { id } = req.params;
  const { type } = req.body;

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

    reactionCache.set(cacheKey, true);

    return res.status(200).json({
      success: true,
      reactions: updated.reactions,
    });
  } catch (err) {
    console.error("[React] Error:", err.message);
    return res.status(500).json({
      error: "SERVER_ERROR",
      message: "Could not save reaction.",
    });
  }
});

module.exports = router;
