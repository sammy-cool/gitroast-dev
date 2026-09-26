const jwt = require("jsonwebtoken");

const SECRET =
  process.env.JWT_SECRET ||
  (process.env.NODE_ENV === "test" ? "gitroast-dev-fallback-secret-key-32chars" : "");
const EXPIRES = process.env.JWT_EXPIRES_IN || "7d";

function createToken(payload) {
  if (!SECRET) {
    throw new Error("JWT_SECRET environment variable is missing.");
  }
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES });
}

function verifyToken(token) {
  if (!token || !SECRET) return null;
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

function extractToken(req) {
  if (!req) return null;

  const authHeader = req.headers?.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1]?.trim() || null;
  }

  if (req.cookies && req.cookies.gitroast_token) {
    return req.cookies.gitroast_token;
  }

  return null;
}

module.exports = { createToken, verifyToken, extractToken };
