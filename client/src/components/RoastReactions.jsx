'use client'


import { useState } from 'react'
import { reactToRoast } from '@/services/roastService'

const REACTION_CONFIG = [
    { type: 'relatable', emoji: '😂', label: 'Relatable' },
    { type: 'destroyed', emoji: '💀', label: 'Destroyed' },
    { type: 'savage', emoji: '🔥', label: 'Savage' },
]

export default function RoastReactions({ roastId, initialReactions = {} }) {
    const [counts, setCounts] = useState({
        relatable: initialReactions.relatable || 0,
        destroyed: initialReactions.destroyed || 0,
        savage: initialReactions.savage || 0,
    })

    const [clicked, setClicked] = useState(new Set())
    const [loading, setLoading] = useState(null)

    async function handleReact(type) {
        if (clicked.has(type) || loading) return

        setLoading(type)

        const prev = counts[type]
        setCounts(c => ({ ...c, [type]: c[type] + 1 }))
        setClicked(s => new Set([...s, type]))

        const result = await reactToRoast(roastId, type)

        setLoading(null)

        if (!result) {
            setCounts(c => ({ ...c, [type]: prev }))
            setClicked(s => { const n = new Set(s); n.delete(type); return n })
            return
        }

        if (result.duplicate) {
            setCounts(c => ({ ...c, [type]: prev }))
            return
        }

        if (result.reactions) {
            setCounts({
                relatable: result.reactions.relatable || 0,
                destroyed: result.reactions.destroyed || 0,
                savage: result.reactions.savage || 0,
            })
        }
    }

    function formatCount(n) {
        if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
        return n.toString()
    }

    const total = counts.relatable + counts.destroyed + counts.savage

    return (
        <div className="reactions-wrap">

            {}
            <p className="reactions-total font-mono">
                {total > 0
                    ? `${total.toLocaleString()} reaction${total === 1 ? '' : 's'}`
                    : 'Be the first to react'}
            </p>

            <div className="reactions-row">
                {REACTION_CONFIG.map(({ type, emoji, label }) => {
                    const isClicked = clicked.has(type)
                    const isLoading = loading === type
                    const count = counts[type]

                    return (
                        <button
                            key={type}
                            className={`reaction-btn font-mono ${isClicked ? 'reaction-btn--active' : ''}`}
                            onClick={() => handleReact(type)}
                            disabled={isClicked || !!loading}
                            title={isClicked ? `You reacted ${emoji}` : label}
                        >
                            {}
                            <span
                                className="reaction-emoji"
                                style={{
                                    transform: isLoading ? 'scale(1.3)' : 'scale(1)',
                                    transition: 'transform 0.15s ease',
                                }}
                            >
                                {emoji}
                            </span>
                            <span className="reaction-count">
                                {formatCount(count)}
                            </span>
                        </button>
                    )
                })}
            </div>

            <style jsx>{`
        .reactions-wrap {
          padding:        0.875rem 1.5rem;
          display:        flex;
          flex-direction: column;
          gap:            8px;
          border-top:     1px solid var(--border);
          background:     var(--bg-card);
        }
        .reactions-total {
          font-size:  10px;
          color:      var(--text-muted);
          text-align: center;
          letter-spacing: 0.5px;
        }
        .reactions-row {
          display:         flex;
          justify-content: center;
          gap:             10px;
        }
        .reaction-btn {
          display:        flex;
          flex-direction: column;
          align-items:    center;
          gap:            4px;
          padding:        10px 20px;
          background:     var(--bg-elevated);
          border:         1px solid var(--border);
          border-radius:  var(--radius-md);
          cursor:         pointer;
          transition:     all 0.18s ease;
          min-width:      72px;
        }
        .reaction-btn:hover:not(:disabled) {
          border-color: var(--fire);
          background:   rgba(255, 69, 0, 0.06);
          transform:    translateY(-2px);
        }
        /* WHY fire border on active: shows user their reaction is locked in */
        .reaction-btn--active {
          border-color: var(--fire);
          background:   rgba(255, 69, 0, 0.08);
          cursor:       default;
        }
        .reaction-btn:disabled { cursor: not-allowed; }
        .reaction-emoji { font-size: 22px; line-height: 1; }
        .reaction-count {
          font-size:  12px;
          color:      var(--text-secondary);
          min-width:  24px;
          text-align: center;
        }
        /* WHY fire color on active count: reinforces the selected state */
        .reaction-btn--active .reaction-count { color: var(--fire); }

        @media (max-width: 380px) {
          .reaction-btn { padding: 8px 14px; min-width: 60px; }
          .reaction-emoji { font-size: 18px; }
        }
      `}</style>
        </div>
    )
}
