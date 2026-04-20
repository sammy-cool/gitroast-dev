const mongoose = require('mongoose')

const paymentSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },

        plan: {
            type: String,
            required: true,
            enum: ['pro_one_time', 'pro_monthly', 'teams_monthly'],
        },

        amountINR: {
            type: Number,
            required: true,
        },

        razorPayOrderId: {
            type: String,
            index: true,
        },

        payerEmail: {
            type: String,
            default: null,
        },

        status: {
            type: String,
            enum: ['pending', 'confirmed', 'failed', 'refunded'],
            default: 'pending',
            index: true,
        },

        confirmedAt: {
            type: Date,
            default: null,
        },

        subscriptionEndsAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
)

roastSchema = paymentSchema
paymentSchema.index({ userId: 1, createdAt: -1 })

module.exports = mongoose.model('Payment', paymentSchema)
