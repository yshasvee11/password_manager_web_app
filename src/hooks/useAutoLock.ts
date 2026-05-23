/**
 * src/hooks/useAutoLock.js
 * 
 * Custom hook that auto-locks the vault after a period of inactivity.
 * Tracks user activity (mouse, keyboard, clicks, scrolls, touch).
 * Shows a warning 60 seconds before locking.
 */

import { useEffect, useRef, useCallback, useState } from 'react';

const LOCK_TIMEOUT_MS = 5 * 60 * 1000;    // 5 minutes
const WARNING_BEFORE_MS = 60 * 1000;       // warn 60s before lock

export default function useAutoLock(onLock: () => void) {
    const timerRef = useRef<any>(null);
    const warningTimerRef = useRef<any>(null);
    const [showWarning, setShowWarning] = useState(false);
    const [secondsLeft, setSecondsLeft] = useState(60);
    const countdownRef = useRef<any>(null);

    const clearAllTimers = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
        if (countdownRef.current) clearInterval(countdownRef.current);
        setShowWarning(false);
        setSecondsLeft(60);
    }, []);

    const resetTimer = useCallback(() => {
        clearAllTimers();

        // Set warning timer (fires 60s before lock)
        warningTimerRef.current = setTimeout(() => {
            setShowWarning(true);
            setSecondsLeft(60);
            countdownRef.current = setInterval(() => {
                setSecondsLeft(prev => {
                    if (prev <= 1) {
                        clearInterval(countdownRef.current);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }, LOCK_TIMEOUT_MS - WARNING_BEFORE_MS);

        // Set lock timer
        timerRef.current = setTimeout(() => {
            clearAllTimers();
            onLock();
        }, LOCK_TIMEOUT_MS);
    }, [onLock, clearAllTimers]);

    const handleActivity = useCallback(() => {
        resetTimer();
    }, [resetTimer]);

    useEffect(() => {
        const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
        events.forEach(event => window.addEventListener(event, handleActivity, { passive: true }));
        resetTimer();

        return () => {
            events.forEach(event => window.removeEventListener(event, handleActivity));
            clearAllTimers();
        };
    }, [handleActivity, resetTimer, clearAllTimers]);

    return { showWarning, secondsLeft };
}
