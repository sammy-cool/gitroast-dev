const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const User = require("../models/User");
const Roast = require("../models/Roast");
const {
  createToken,
  extractToken,
  verifyToken,
} = require("../services/tokenService");
const { requireAuth } = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimiter");
const { logger } = require("../utils/logger");

const rawClientUrl = process.env.CLIENT_URL || "http://localhost:3000";
const CLIENT_URL = rawClientUrl.split(",")[0].trim().replace(/\/$/, "");

router.get("/github", authLimiter, (req, res) => {
  const state = crypto.randomBytes(16).toString("hex");

  res.cookie("oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60 * 1000,
  });

  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    redirect_uri: process.env.GITHUB_CALLBACK_URL,
    scope: "read:user user:email repo",
    state,
  });

  const githubAuthUrl = `https://github.com/login/oauth/authorize?${params}`;
  res.redirect(githubAuthUrl);
});

router.get("/github/callback", authLimiter, async (req, res) => {
  const { code, error, state } = req.query;
  const savedState = req.cookies?.oauth_state;

  res.clearCookie("oauth_state");

  if (!state || !savedState || state !== savedState) {
    logger.warn("Auth", "OAuth CSRF state mismatch or missing", {
      hasQueryState: Boolean(state),
      hasSavedState: Boolean(savedState),
    });
    return res.redirect(`${CLIENT_URL}/auth/callback?auth_error=csrf_detected`);
  }

  if (error || !code) {
    return res.redirect(`${CLIENT_URL}/auth/callback?auth_error=access_denied`);
  }

  try {
    const tokenRes = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
        }),
      },
    );

    const tokenData = await tokenRes.json();

    if (tokenData.error || !tokenData.access_token) {
      logger.error("Auth", "Token exchange failed", { data: tokenData });
      return res.redirect(`${CLIENT_URL}/auth/callback?auth_error=token_failed`);
    }

    const accessToken = tokenData.access_token;

    const profileRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `token ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "GitRoast-App",
      },
    });
    const profile = await profileRes.json();

    if (!profileRes.ok || !profile || !profile.id || !profile.login) {
      logger.error("Auth", "Invalid or missing GitHub profile payload", {
        status: profileRes.status,
        profile,
      });
      return res.redirect(`${CLIENT_URL}/auth/callback?auth_error=profile_failed`);
    }

    let email = profile.email;
    if (!email) {
      try {
        const emailRes = await fetch("https://api.github.com/user/emails", {
          headers: {
            Authorization: `token ${accessToken}`,
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "GitRoast-App",
          },
        });
        const emails = await emailRes.json();
        const primary = Array.isArray(emails)
          ? emails.find((e) => e.primary && e.verified)
          : null;
        email = primary?.email || null;
      } catch {
      }
    }

    const user = await User.findOneAndUpdate(
      { githubId: String(profile.id) },
      {
        $set: {
          username: profile.login,
          email: email,
          avatarUrl: profile.avatar_url,
          githubAccessToken: accessToken,
        },
        $setOnInsert: {
          isPro: false,
          roastCount: 0,
        },
      },
      { upsert: true, returnDocument: "after", runValidators: true },
    );

    const jwt = createToken({
      userId: user._id,
      githubId: user.githubId,
      username: user.username,
    });

    res.redirect(`${CLIENT_URL}/auth/callback?token=${jwt}`);
  } catch (err) {
    logger.error("Auth", "Callback error", { message: err.message });
    res.redirect(`${CLIENT_URL}/auth/callback?auth_error=server_error`);
  }
});

router.get("/me", requireAuth, (req, res) => {
  res.json({
    success: true,
    user: req.user.toSafeObject(),
  });
});

router.patch("/preferences", requireAuth, async (req, res) => {
  try {
    const { defaultIntensity, defaultPersona, cardTheme, hideFromLeaderboard } = req.body || {};

    const updates = {};
    const VALID_INTENSITIES = new Set(["mild", "savage", "nuclear"]);
    const VALID_PERSONAS = new Set(["classic", "hinglish", "techbro", "ramsay", "shakespearean"]);

    if (defaultIntensity && VALID_INTENSITIES.has(defaultIntensity)) {
      if (defaultIntensity === "nuclear" && !req.user.isPro) {
        return res.status(403).json({
          error: "PRO_REQUIRED",
          message: "Nuclear intensity preference is reserved for Pro members.",
        });
      }
      updates["customPreferences.defaultIntensity"] = defaultIntensity;
    }
    if (defaultPersona && VALID_PERSONAS.has(defaultPersona)) {
      updates["customPreferences.defaultPersona"] = defaultPersona;
    }
    if (typeof cardTheme === "string" && cardTheme.trim()) {
      updates["customPreferences.cardTheme"] = cardTheme.trim().slice(0, 30);
    }
    if (typeof hideFromLeaderboard === "boolean") {
      updates["customPreferences.hideFromLeaderboard"] = hideFromLeaderboard;
      const safeUsername = (req.user.username || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      await Roast.updateMany(
        { username: new RegExp(`^${safeUsername}$`, "i") },
        { $set: { isPrivate: hideFromLeaderboard } }
      ).catch((err) => logger.warn("Auth", "Failed updating past roasts privacy", { error: err.message }));
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "INVALID_PREFERENCES", message: "No valid preferences provided." });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { returnDocument: "after", runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: "Preferences updated successfully.",
      user: updatedUser.toSafeObject(),
    });
  } catch (err) {
    logger.error("Auth", "Preferences update failed", { message: err.message });
    return res.status(500).json({ error: "SERVER_ERROR", message: "Failed to update preferences." });
  }
});

router.post("/logout", (req, res) => {
  res.json({ success: true, message: "Logged out." });
});

module.exports = router;
