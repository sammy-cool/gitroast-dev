const mongoose = require('mongoose')

const userSchema = new mongoose.Schema(
    {
        githubId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },

        username: {
            type: String,
            required: true,
            trim: true,
        },

        email: {
            type: String,
            trim: true,
            default: null,
        },

        avatarUrl: {
            type: String,
            default: null,
        },

        githubAccessToken: {
            type: String,
            default: null,
        },

        isPro: {
            type: Boolean,
            default: false,
        },

        proSince: {
            type: Date,
            default: null,
        },

        roastCount: {
            type: Number,
            default: 0,
        },

        lastRoastDate: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
)

userSchema.methods.canRoastToday = function () {
    if (this.isPro) return true

    if (!this.lastRoastDate) return true

    const today = new Date()
    const lastRoast = new Date(this.lastRoastDate)

    return today.toDateString() !== lastRoast.toDateString()
}

userSchema.methods.toSafeObject = function () {
    return {
        id: this._id,
        githubId: this.githubId,
        username: this.username,
        email: this.email,
        avatarUrl: this.avatarUrl,
        isPro: this.isPro,
        proSince: this.proSince,
    }
}

module.exports = mongoose.model('User', userSchema)
