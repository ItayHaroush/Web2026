import { useState, useCallback, useRef, useEffect } from 'react';
import posApi from '../api/posApi';
import { useAdminAuth } from '../../../context/AdminAuthContext';

const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes

const getStableHeaders = () => {
    const token = localStorage.getItem('authToken') || localStorage.getItem('admin_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
};

export default function usePosSession() {
    const { user } = useAdminAuth();
    const [posToken, setPosToken] = useState(null);
    const [posUser, setPosUser] = useState(null);
    const [isLocked, setIsLocked] = useState(false);
    const [expiresAt, setExpiresAt] = useState(null);
    const inactivityTimer = useRef(null);

    const headers = getStableHeaders();

    const resetInactivityTimer = useCallback(() => {
        if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
        if (posToken && !isLocked) {
            inactivityTimer.current = setTimeout(() => {
                lock();
            }, INACTIVITY_TIMEOUT);
        }
    }, [posToken, isLocked]);

    useEffect(() => {
        if (!posToken) return;

        const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
        events.forEach(e => window.addEventListener(e, resetInactivityTimer));
        resetInactivityTimer();

        return () => {
            events.forEach(e => window.removeEventListener(e, resetInactivityTimer));
            if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
        };
    }, [posToken, resetInactivityTimer]);

    const login = useCallback(async (pin) => {
        const res = await posApi.verifyPin(pin, headers);
        if (res.data.success) {
            setPosToken(res.data.token);
            setPosUser(res.data.user);
            setExpiresAt(res.data.expires_at);
            setIsLocked(false);
            return res.data;
        }
        throw new Error(res.data.message);
    }, [headers]);

    const lock = useCallback(async () => {
        if (posToken) {
            try {
                await posApi.lockSession(headers, posToken);
            } catch {}
        }
        setIsLocked(true);
    }, [posToken, headers]);

    const unlock = useCallback(async (pin) => {
        const res = await posApi.unlockSession(pin, headers);
        if (res.data.success) {
            setIsLocked(false);
            resetInactivityTimer();
            return true;
        }
        throw new Error(res.data.message);
    }, [headers, resetInactivityTimer]);

    const logout = useCallback(() => {
        setPosToken(null);
        setPosUser(null);
        setIsLocked(false);
        setExpiresAt(null);
        if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    }, []);

    return {
        posToken,
        posUser,
        isLocked,
        isAuthenticated: !!posToken && !isLocked,
        login,
        lock,
        unlock,
        logout,
        headers,
    };
}
