const jwt = require('jsonwebtoken')

const SECRET = process.env.JWT_SECRET
const EXPIRES = process.env.JWT_EXPIRES_IN || '7d'

function createToken(payload) {
    return jwt.sign(payload, SECRET, { expiresIn: EXPIRES })
}

function verifyToken(token) {
    try {
        return jwt.verify(token, SECRET)
    } catch {
        return null
    }
}

function extractToken(req) {
    const authHeader = req.headers.authorization
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.split(' ')[1]
    }

    if (req.cookies && req.cookies.gitroast_token) {
        return req.cookies.gitroast_token
    }

    return null
}

module.exports = { createToken, verifyToken, extractToken }
