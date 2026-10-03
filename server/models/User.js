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
            index: true,
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
            index: true,
        },

        proPlan: {
            type: String,
            enum: ['none', 'roaster', 'historian'],
            default: 'none',
        },

        proSince: {
            type: Date,
            default: null,
        },

        proExpiresAt: {
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

        badges: {
            type: [String],
            default: [],
        },

        customPreferences: {
            defaultIntensity: {
                type: String,
                enum: ['mild', 'savage', 'nuclear'],
                default: 'savage',
            },
            defaultPersona: {
                type: String,
                enum: ['classic', 'hinglish', 'techbro', 'ramsay', 'shakespearean'],
                default: 'classic',
            },
            cardTheme: {
                type: String,
                default: 'fire',
            },
            hideFromLeaderboard: {
                type: Boolean,
                default: false,
            },
        },

        stats: {
            totalRoasts: { type: Number, default: 0 },
            battlesWon: { type: Number, default: 0 },
            battlesLost: { type: Number, default: 0 },
            reactionsReceived: { type: Number, default: 0 },
        },
    },
    {
        timestamps: true,
    }
)

userSchema.index({ isPro: 1, proSince: -1 });

userSchema.methods.canRoastToday = function () {
    if (this.isPro) return true

    if (!this.lastRoastDate) return true

    const todayUtc = new Date().toISOString().slice(0, 10)
    const lastRoastUtc = new Date(this.lastRoastDate).toISOString().slice(0, 10)

    return todayUtc !== lastRoastUtc
}

userSchema.methods.toSafeObject = function () {
    return {
        id: this._id,
        githubId: this.githubId,
        username: this.username,
        email: this.email,
        avatarUrl: this.avatarUrl,
        isPro: this.isPro,
        proPlan: this.isPro && (!this.proPlan || this.proPlan === 'none') ? 'roaster' : (this.proPlan || 'none'),
        proSince: this.proSince,
        badges: this.badges || [],
        customPreferences: {
            defaultIntensity: this.customPreferences?.defaultIntensity || 'savage',
            defaultPersona: this.customPreferences?.defaultPersona || 'classic',
            cardTheme: this.customPreferences?.cardTheme || 'fire',
            hideFromLeaderboard: Boolean(this.customPreferences?.hideFromLeaderboard),
        },
        stats: {
            totalRoasts: this.stats?.totalRoasts || this.roastCount || 0,
            battlesWon: this.stats?.battlesWon || 0,
            battlesLost: this.stats?.battlesLost || 0,
            reactionsReceived: this.stats?.reactionsReceived || 0,
        },
    }
}

module.exports = mongoose.model('User', userSchema)
