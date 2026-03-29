import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import posApi from '../api/posApi';
import { useAdminAuth } from '../../../context/AdminAuthContext';

const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const BYPASS_KEY = 'pos_bypass';

function getBypass() {
    try {
        const raw = localStorage.getItem(BYPASS_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (data.expiresAt && Date.now() < data.expiresAt) return data;
        localStorage.removeItem(BYPASS_KEY);
        return null;
    } catch {
        localStorage.removeItem(BYPASS_KEY);
        return null;
    }
}

function setBypass(pin, hours) {
    localStorage.setItem(BYPASS_KEY, JSON.stringify({
        pin,
        expiresAt: Date.now() + hours * 60 * 60 * 1000,
    }));
}

function clearBypass() {
    localStorage.removeItem(BYPASS_KEY);
}

export default function usePosSession() {
    const { token: adminBearerToken } = useAdminAuth();
    const [posToken, setPosToken] = useState(null);
    const [posUser, setPosUser] = useState(null);
    const [isLocked, setIsLocked] = useState(false);
    const [expiresAt, setExpiresAt] = useState(null);
    const inactivityTimer = useRef(null);
    const bearer =
        adminBearerToken ||
        (typeof localStorage !== 'undefined' &&
            (localStorage.getItem('authToken') || localStorage.getItem('admin_token'))) ||
        '';
    const headers = useMemo(() => (bearer ? { Authorization: `Bearer ${bearer}` } : {}), [bearer]);

    // Ref for async callbacks that need latest headers
    const headersRef = useRef(headers);
    headersRef.current = headers;

    const resetInactivityTimer = useCallback(() => {
        if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
        if (!posToken || isLocked) return;
        // "זכור אותי ל-4 שעות" — ללא נעילת מסך אוטומטית במהלך תוקף ה-bypass
        if (getBypass()) return;
        inactivityTimer.current = setTimeout(() => {
            lock();
        }, INACTIVITY_TIMEOUT);
    }, [posToken, isLocked, lock]);

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

    // Auto-login עם bypass — עם ביטול על unmount (חשוב ב-React Strict Mode: שני verifyPin מבטלים סשן קודם).
    useEffect(() => {
        if (posToken) return;
        const bypass = getBypass();
        if (!bypass?.pin) return;

        let cancelled = false;
        (async () => {
            try {
                const res = await posApi.verifyPin(bypass.pin, headersRef.current, null);
                if (cancelled) return;
                if (res.data.success) {
                    setPosToken(res.data.token);
                    setPosUser(res.data.user);
                    setExpiresAt(res.data.expires_at);
                    setIsLocked(false);
                }
            } catch {
                if (!cancelled) clearBypass();
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [posToken]);

    const login = useCallback(async (pin, bypassHours = 0, paymentTerminalId = null) => {
        const res = await posApi.verifyPin(pin, headersRef.current, paymentTerminalId);
        if (res.data.success) {
            setPosToken(res.data.token);
            setPosUser(res.data.user);
            setExpiresAt(res.data.expires_at);
            setIsLocked(false);
            if (bypassHours > 0) {
                setBypass(pin, bypassHours);
            }
            return res.data;
        }
        throw new Error(res.data.message);
    }, []);

    const lock = useCallback(async () => {
        if (posToken) {
            try {
                await posApi.lockSession(headersRef.current, posToken);
            } catch { }
        }
        setIsLocked(true);
    }, [posToken]);

    const unlock = useCallback(async (pin) => {
        const res = await posApi.unlockSession(pin, headersRef.current);
        if (res.data.success) {
            setIsLocked(false);
            resetInactivityTimer();
            return true;
        }
        throw new Error(res.data.message);
    }, [resetInactivityTimer]);

    const clearPosSessionState = useCallback(() => {
        setPosToken(null);
        setPosUser(null);
        setIsLocked(false);
        setExpiresAt(null);
        if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    }, []);

    const logout = useCallback(() => {
        clearPosSessionState();
        // Don't clear bypass — it should persist for re-entry within the bypass window
    }, [clearPosSessionState]);

    useEffect(() => {
        const onLost = () => clearPosSessionState();
        window.addEventListener('takeeat:pos-session-lost', onLost);
        return () => window.removeEventListener('takeeat:pos-session-lost', onLost);
    }, [clearPosSessionState]);

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
        hasBypass: !!getBypass(),
    };
}
