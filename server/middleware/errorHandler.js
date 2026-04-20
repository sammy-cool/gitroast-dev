function errorHandler(err, req, res, next) {
    console.error(`[Error] ${req.method} ${req.path}:`, {
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    })


    if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map(e => e.message)
        return res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: messages.join(', '),
        })
    }

    if (err.name === 'CastError') {
        return res.status(400).json({
            error: 'INVALID_ID',
            message: 'Invalid ID format.',
        })
    }

    if (err.code === 11000) {
        return res.status(409).json({
            error: 'DUPLICATE_ENTRY',
            message: 'This record already exists.',
        })
    }

    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            error: 'TOKEN_INVALID',
            message: 'Invalid token. Please login again.',
        })
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            error: 'TOKEN_EXPIRED',
            message: 'Session expired. Please login again.',
        })
    }

    const statusCode = err.statusCode || err.status || 500
    const message = process.env.NODE_ENV === 'production'
        ? 'Something went wrong. Please try again.'
        : err.message

    res.status(statusCode).json({
        error: 'SERVER_ERROR',
        message,
    })
}

function notFoundHandler(req, res) {
    res.status(404).json({
        error: 'NOT_FOUND',
        message: `Route ${req.method} ${req.path} does not exist.`,
    })
}

module.exports = { errorHandler, notFoundHandler }
