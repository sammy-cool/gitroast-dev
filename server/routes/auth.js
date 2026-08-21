const express = require("express");
const router = express.Router();
const User = require("../models/User");
const {
  createToken,
  extractToken,
  verifyToken,
} = require("../services/tokenService");
const { requireAuth } = require("../middleware/auth");
const { logger } = require("../utils/logger");

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

router.get("/github", (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    redirect_uri: process.env.GITHUB_CALLBACK_URL,
    scope: "read:user user:email repo",
  });

  const githubAuthUrl = `https://github.com/login/oauth/authorize?${params}`;
  res.redirect(githubAuthUrl);
});

router.get("/github/callback", async (req, res) => {
  const { code, error } = req.query;

  if (error || !code) {
    return res.redirect(`${CLIENT_URL}?auth_error=access_denied`);
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
      return res.redirect(`${CLIENT_URL}?auth_error=token_failed`);
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
        const primary = emails.find((e) => e.primary && e.verified);
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
    res.redirect(`${CLIENT_URL}?auth_error=server_error`);
  }
});

router.get("/me", requireAuth, (req, res) => {
  res.json({
    success: true,
    user: req.user.toSafeObject(),
  });
});

router.post("/logout", (req, res) => {
  res.json({ success: true, message: "Logged out." });
});

module.exports = router;
