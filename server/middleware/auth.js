const { verifyToken, extractToken } = require('../services/tokenService')
const User = require('../models/User')

async function requireAuth(req, res, next) {
    const token = extractToken(req)

    if (!token) {
        return res.status(401).json({
            error: 'UNAUTHORIZED',
            message: 'Login required.',
        })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
        return res.status(401).json({
            error: 'TOKEN_INVALID',
            message: 'Session expired. Please login again.',
        })
    }

    try {
        const user = await User.findById(decoded.userId)
        if (!user) {
            return res.status(401).json({
                error: 'USER_NOT_FOUND',
                message: 'Account not found.',
            })
        }
        req.user = user
        next()
    } catch {
        return res.status(500).json({
            error: 'SERVER_ERROR',
            message: 'Authentication check failed.',
        })
    }
}

async function optionalAuth(req, res, next) {
    const token = extractToken(req)
    req.user = null

    if (!token) return next()

    const decoded = verifyToken(token)
    if (!decoded) return next()

    try {
        const user = await User.findById(decoded.userId)
        if (user) req.user = user
    } catch {
    }

    next()
}

function requirePro(req, res, next) {
    if (!req.user?.isPro) {
        return res.status(403).json({
            error: 'PRO_REQUIRED',
            message: 'This feature requires a Pro account.',
        })
    }
    next()
}

module.exports = { requireAuth, optionalAuth, requirePro }
