'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { createToast } from 'customizable-toast-notification'

export default function AuthCallbackPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { loginWithToken } = useAuth()

    useEffect(() => {
        const token = searchParams.get('token')
        const authError = searchParams.get('auth_error')

        if (authError || !token) {
            const messages = {
                access_denied: 'GitHub login was cancelled.',
                token_failed: 'Login failed. Please try again.',
                server_error: 'Something went wrong. Please try again.',
            }
            createToast({
                type: 'error',
                message: messages[authError] || 'Login failed.',
                position: 'top-center',
                duration: 5000,
                textColor: "snow"
            })
            router.replace('/')
            return
        }

        loginWithToken(token)

        createToast({
            type: 'success',
            message: '🔥 GitHub connected! Welcome to GitRoast Pro.',
            position: 'top-center',
            showProgressBar: true,
            duration: 4000,
            textColor: "snow"
        })

        router.replace('/')

    }, [searchParams, loginWithToken, router])

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: '1rem',
        }}>
            <p style={{
                fontFamily: 'var(--font-display)',
                fontSize: '32px',
                background: 'var(--fire-grad)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
            }}>
                GITROAST 🔥
            </p>
            <p style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '14px' }}>
                Connecting your GitHub...
            </p>
        </div>
    )
}
