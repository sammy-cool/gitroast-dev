'use client'


import { useEffect } from 'react'
import {
    setDefaultColors,
    setDefaultMessages,
} from 'customizable-toast-notification'

export default function ToastConfig() {
    useEffect(() => {

        setDefaultColors({
            success: '#00E676',
            error: '#FF3D3D',
            warning: '#FFB700',
            info: '#FF6B00',
        })

        setDefaultMessages({
            success: 'Done! 🔥',
            error: 'Something went wrong. Try again.',
            warning: 'Hold on a second.',
            info: 'Heads up!',
        })
    }, [])
    return null
}
