'use client'


import { useEffect } from 'react'

let deferredPrompt = null

export async function promptPWAInstall() {
  if (!deferredPrompt) return false
  try {
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    deferredPrompt = null
    return outcome === 'accepted'
  } catch {
    return false
  }
}

export function isPWAInstallable() {
  return Boolean(deferredPrompt)
}

export default function PWARegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    if (process.env.NODE_ENV !== 'production') return

    function handleLoad() {
      navigator.serviceWorker
        .register('/sw.js')
        .catch(() => {})
    }

    function handleInstallPrompt(e) {
      e.preventDefault()
      deferredPrompt = e
      window.dispatchEvent(new CustomEvent('gitroast-installable', { detail: { available: true } }))
    }

    if (document.readyState === 'complete') {
      handleLoad()
    } else {
      window.addEventListener('load', handleLoad)
    }
    window.addEventListener('beforeinstallprompt', handleInstallPrompt)

    return () => {
      window.removeEventListener('load', handleLoad)
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt)
    }
  }, [])

  return null
}
