'use client'

import {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    useMemo,
} from 'react'

const AuthContext = createContext(null)

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
const TOKEN_KEY = 'gitroast_token'

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)

    const fetchMe = useCallback(async (token) => {
        try {
            const res = await fetch(`${API_BASE}/api/auth/me`, {
                headers: { Authorization: `Bearer ${token}` },
            })

            if (!res.ok) {
                localStorage.removeItem(TOKEN_KEY)
                setUser(null)
                return
            }

            const json = await res.json()
            setUser(json.user)
        } catch {
            localStorage.removeItem(TOKEN_KEY)
            setUser(null)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        const token = localStorage.getItem(TOKEN_KEY)
        if (token) {
            fetchMe(token)
        } else {
            setLoading(false)
        }
    }, [fetchMe])

    const refreshUser = useCallback(async () => {
        const token = localStorage.getItem(TOKEN_KEY)
        if (token) {
            return await fetchMe(token)
        }
        return null
    }, [fetchMe])

    const loginWithToken = useCallback((token) => {
        localStorage.setItem(TOKEN_KEY, token)
        fetchMe(token)
    }, [fetchMe])

    const getToken = useCallback(() => {
        return localStorage.getItem(TOKEN_KEY)
    }, [])

    const logout = useCallback(async () => {
        const token = getToken()
        try {
            await fetch(`${API_BASE}/api/auth/logout`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            })
        } catch {
        }
        localStorage.removeItem(TOKEN_KEY)
        setUser(null)
    }, [getToken])

    const loginWithGitHub = useCallback(() => {
        window.location.href = `${API_BASE}/api/auth/github`
    }, [])

    const value = useMemo(() => ({
        user,
        loading,
        isLoggedIn: !!user,
        isPro: user?.isPro || false,
        loginWithGitHub,
        loginWithToken,
        getToken,
        logout,
        refreshUser,
    }), [user, loading, loginWithGitHub, loginWithToken, getToken, logout, refreshUser]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const ctx = useContext(AuthContext)
    if (!ctx) {
        throw new Error('useAuth must be used inside <AuthProvider>')
    }
    return ctx
}
