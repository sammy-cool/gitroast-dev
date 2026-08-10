'use client'


import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import PaymentFlow from './PaymentFlow'

export default function PaymentModal({ planId, onClose }) {

    useEffect(() => {
        const prev = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            document.body.style.overflow = prev
        }
    }, [])

    return createPortal(
        <div
            style={{
                position: 'fixed',
                inset: '0',
                background: 'rgba(0, 0, 0, 0.88)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1rem',
                backdropFilter: 'blur(6px)',
                zIndex: 9999,
                overflowY: 'auto',
            }}
            onClick={onClose}
        >
            <div
                style={{
                    width: '100%',
                    maxWidth: '560px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    overflow: 'hidden',
                    animation: 'fadeIn 0.2s ease forwards',
                    margin: 'auto',
                    maxHeight: '90dvh',
                    overflowY: 'auto',
                }}
                onClick={e => e.stopPropagation()}
            >
                <PaymentFlow planId={planId} onClose={onClose} />
            </div>
        </div>,
        document.body
    )
}
