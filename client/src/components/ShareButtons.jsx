'use client'

import { createToast } from 'customizable-toast-notification'
import { useState } from 'react'
import { trackShare } from '@/services/roastService'

export default function ShareButtons({ username, roastId, roastText, isPro, onProClick }) {
    const [copied, setCopied] = useState(false)
    const [copiedText, setCopiedText] = useState(false)
    const [downloading, setDownloading] = useState(false)

    function handleShare() {
        const url = `${window.location.origin}/roast/${username}`
        navigator.clipboard.writeText(url)
            .then(() => {
                setCopied(true)
                trackShare(roastId)
                createToast({
                    type: 'success',
                    message: '🔥 Roast link copied! Go share your shame.',
                    position: 'top-center',
                    showProgressBar: true,
                    duration: 3000,
                })
                setTimeout(() => setCopied(false), 2500)
            })
            .catch(() => {
                createToast({
                    type: 'error',
                    message: 'Could not copy link. Try manually.',
                    position: 'top-center',
                    duration: 5000,
                    showCloseButton: true,
                })
            })
    }

    function handleCopyText() {
        if (!roastText) return
        const textToCopy = `"${roastText}" — gitroast.dev/roast/${username}`
        navigator.clipboard.writeText(textToCopy)
            .then(() => {
                setCopiedText(true)
                createToast({
                    type: 'success',
                    message: '📋 Roast text copied! Paste it anywhere.',
                    position: 'top-center',
                    showProgressBar: true,
                    duration: 3000,
                })
                setTimeout(() => setCopiedText(false), 2500)
            })
            .catch(() => {
                createToast({
                    type: 'error',
                    message: 'Could not copy text. Try manually.',
                    position: 'top-center',
                    duration: 5000,
                    showCloseButton: true,
                })
            })
    }

    function handleTwitterShare() {
        const url = `${window.location.origin}/roast/${username}`
        const snippet = roastText
            ? `"${roastText.slice(0, 120)}${roastText.length > 120 ? '...' : ''}"`
            : `I just got my GitHub brutally roasted 🔥`
        const tweet = `${snippet}\n\nGet roasted at ${url} 🔥 #GitRoast #GitHub`
        window.open(
            `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}`,
            '_blank', 'noopener,noreferrer'
        )
        trackShare(roastId)
        createToast({
            type: 'success',
            message: '🐦 Twitter opened! Share your shame.',
            position: 'top-center',
            duration: 3000,
        })
    }

    async function handleDownload() {
        setDownloading(true)

        try {
            const html2canvas = (await import('html2canvas')).default

            const element = document.getElementById('roast-card-capture')
            if (!element) throw new Error('Card element not found')

            const scale = isPro ? 2 : 1.5

            const canvas = await html2canvas(element, {
                scale,
                useCORS: true,
                backgroundColor: '#0F0F0F',
                logging: false,
                windowWidth: element.scrollWidth,
                windowHeight: element.scrollHeight,
            })

            if (!isPro) {
                const ctx = canvas.getContext('2d')

                ctx.fillStyle = 'rgba(0, 0, 0, 0.65)'
                ctx.fillRect(0, canvas.height - 36, canvas.width, 36)

                ctx.fillStyle = 'rgba(255, 69, 0, 0.9)'
                ctx.font = `bold ${14 * scale}px Courier New, monospace`
                ctx.textAlign = 'center'
                ctx.textBaseline = 'middle'
                ctx.fillText(
                    'gitroast.dev — Upgrade to Pro for HD card',
                    canvas.width / 2,
                    canvas.height - 18
                )
            }

            const link = document.createElement('a')
            link.download = `gitroast-${username}-${Date.now()}.png`
            link.href = canvas.toDataURL('image/png', 1.0)
            link.click()

            createToast({
                type: 'success',
                message: isPro
                    ? '🔥 HD roast card downloaded!'
                    : '🔥 Roast card downloaded! Go Pro for HD version.',
                position: 'top-center',
                showProgressBar: true,
                duration: 4000,
            })

            trackShare(roastId)

        } catch (err) {
            console.error('[Download] Failed:', err)
            createToast({
                type: 'error',
                message: 'Download failed. Try again.',
                position: 'top-center',
                duration: 4000,
                showCloseButton: true,
            })
        } finally {
            setDownloading(false)
        }
    }

    function handlePro() {
        createToast({
            type: 'info',
            message: '⚡ Unlock AI roasts, private repos + HD card.',
            position: 'top-center',
            duration: 6000,
            showCloseButton: true,
            showProgressBar: true,
            cta: {
                label: 'See Plans ⚡',
                onClick: onProClick,
                autoClose: true,
            },
        })
    }

    return (
        <div className="share-section">

            {}
            <div className="watermark-row">
                <span className="font-mono watermark-url">gitroast.dev</span>
                <span className="font-mono watermark-badge">
                    {isPro ? 'PRO ⚡ · HD CARD' : 'FREE TIER · WATERMARKED'}
                </span>
            </div>

            {}
            <div className="share-buttons">
                <button
                    className="btn btn-primary share-btn"
                    onClick={handleShare}
                >
                    {copied ? '✓ Copied!' : '🔥 Share Roast'}
                </button>

                <button
                    className="btn btn-twitter share-btn"
                    onClick={handleTwitterShare}
                    title="Share on Twitter / X"
                >
                    𝕏 Tweet This
                </button>
            </div>

            {}
            <div className="secondary-buttons">

                {}
                <button
                    className={`btn download-btn ${isPro ? 'download-btn--pro' : 'download-btn--free'}`}
                    onClick={handleDownload}
                    disabled={downloading}
                >
                    {downloading ? (
                        <>⏳ Generating...</>
                    ) : isPro ? (
                        <>⬇️ Download HD Card</>
                    ) : (
                        <>⬇️ Download Card</>
                    )}
                </button>

            </div>

            {}
            <div className="tertiary-buttons">
                <button
                    className="btn btn-ghost copy-text-btn"
                    onClick={handleCopyText}
                >
                    {copiedText ? '✓ Copied!' : '📋 Copy Roast Text'}
                </button>

                {!isPro && (
                    <button
                        className="btn btn-outline pro-btn"
                        onClick={handlePro}
                    >
                        ⚡ Go Pro — ₹199
                    </button>
                )}
            </div>

            {}
            {!isPro && (
                <p className="pro-hint font-mono">
                    ⚡ Pro = HD card · No watermark · AI roast · Private repos
                </p>
            )}

            <style jsx>{`
        .share-section {
          padding:        1.25rem 1.5rem;
          display:        flex;
          flex-direction: column;
          gap:            10px;
        }
        .watermark-row {
          display:         flex;
          justify-content: space-between;
          align-items:     center;
        }
        .watermark-url   { color: var(--text-ghost); font-size: 11px; }
        .watermark-badge {
          font-size:     10px;
          padding:       2px 8px;
          border-radius: var(--radius-sm);
          background:    #111;
          border:        1px dashed #222;
          color:         #2E2E2E;
        }

        /* Primary row */
        .share-buttons { display: flex; gap: 8px; }
        .share-btn {
          flex:          1;
          padding:       12px;
          border-radius: var(--radius-md);
          font-size:     14px;
        }
        .btn-twitter {
          background:  #000;
          color:       #fff;
          border:      1px solid #333;
          transition:  var(--ease);
        }
        .btn-twitter:hover { background: #111; border-color: #555; }

        /* Download button — full width, prominent */
        .secondary-buttons { display: flex; }
        .download-btn {
          width:         100%;
          padding:       13px;
          border-radius: var(--radius-md);
          font-size:     15px;
          font-weight:   700;
          letter-spacing: 0.3px;
          transition:    var(--ease);
        }
        /* Free: subtle style, nudge toward Pro */
        .download-btn--free {
          background: var(--bg-elevated);
          color:      var(--text-primary);
          border:     1px solid var(--border-hover);
        }
        .download-btn--free:hover:not(:disabled) {
          border-color: var(--fire);
          color:        var(--fire);
        }
        /* Pro: fire gradient — premium feel */
        .download-btn--pro {
          background: var(--fire-grad);
          color:      #fff;
          border:     none;
          box-shadow: 0 4px 20px rgba(255, 69, 0, 0.25);
        }
        .download-btn--pro:hover:not(:disabled) {
          opacity:   0.92;
          transform: translateY(-1px);
          box-shadow: 0 6px 28px rgba(255, 69, 0, 0.4);
        }
        .download-btn:disabled {
          opacity: 0.6;
          cursor:  not-allowed;
        }

        /* Tertiary row */
        .tertiary-buttons { display: flex; gap: 8px; }
        .copy-text-btn {
          flex:      1;
          padding:   9px 12px;
          font-size: 13px;
        }
        .pro-btn {
          flex:      1;
          padding:   9px 12px;
          font-size: 13px;
        }
        .pro-hint {
          color:      var(--text-muted);
          font-size:  11px;
          text-align: center;
        }

        @media (max-width: 380px) {
          .share-buttons,
          .tertiary-buttons { flex-direction: column; }
        }
      `}</style>
        </div>
    )
}
