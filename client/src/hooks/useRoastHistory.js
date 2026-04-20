'use client'

import { useState, useEffect, useCallback } from 'react'
import { getRoastHistory } from '@/services/roastService'

export function useRoastHistory(username) {
    const [history, setHistory] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const fetchHistory = useCallback(async () => {
        if (!username) {
            setLoading(false)
            return
        }

        setLoading(true)
        setError(null)

        try {
            const res = await getRoastHistory(username)
            setHistory(res.history || [])
        } catch (err) {
            setError(err.message || 'Failed to load history')
            setHistory([])
        } finally {
            setLoading(false)
        }
    }, [username])

    useEffect(() => {
        fetchHistory()
    }, [fetchHistory])


    const scoreTrend = history.length >= 2
        ? history[0].score - history[1].score
        : null

    const bestScore = history.length > 0
        ? Math.min(...history.map(r => r.score))
        : null

    const worstScore = history.length > 0
        ? Math.max(...history.map(r => r.score))
        : null

    const avgScore = history.length > 0
        ? Math.round(history.reduce((s, r) => s + r.score, 0) / history.length)
        : null

    const byMonth = history.reduce((acc, roast) => {
        const month = new Date(roast.createdAt)
            .toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
        if (!acc[month]) acc[month] = []
        acc[month].push(roast)
        return acc
    }, {})

    return {
        history,
        loading,
        error,
        refetch: fetchHistory,
        scoreTrend,
        bestScore,
        worstScore,
        avgScore,
        byMonth,
        hasHistory: history.length > 0,
        roastCount: history.length,
    }
}
