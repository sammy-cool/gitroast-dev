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
        let isCancelled = false

        async function load() {
            if (!username) {
                setLoading(false)
                return
            }

            setLoading(true)
            setError(null)

            try {
                const res = await getRoastHistory(username)
                if (!isCancelled) {
                    setHistory(res.history || [])
                }
            } catch (err) {
                if (!isCancelled) {
                    setError(err.message || 'Failed to load history')
                    setHistory([])
                }
            } finally {
                if (!isCancelled) {
                    setLoading(false)
                }
            }
        }

        load()

        return () => {
            isCancelled = true
        }
    }, [username])


    const validScores = history
        .map(r => Number(r?.score))
        .filter(s => !isNaN(s));

    const scoreTrend = validScores.length >= 2
        ? validScores[0] - validScores[1]
        : null

    const bestScore = validScores.length > 0
        ? Math.max(...validScores)
        : null

    const worstScore = validScores.length > 0
        ? Math.min(...validScores)
        : null

    const avgScore = validScores.length > 0
        ? Math.round(validScores.reduce((s, v) => s + v, 0) / validScores.length)
        : null

    const byMonth = history.reduce((acc, roast) => {
        if (!roast?.createdAt) return acc
        const parsed = new Date(roast.createdAt)
        if (isNaN(parsed.getTime())) return acc
        const month = parsed.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
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
