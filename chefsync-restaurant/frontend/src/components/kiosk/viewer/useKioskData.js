import { useState, useEffect, useCallback, useRef } from 'react';
import { getKioskMenu } from '../../../services/kioskService';
import { KIOSK_DEFAULTS } from '../shared/kioskDefaults';

export default function useKioskData(token) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const idleTimerRef = useRef(null);
    const [isIdle, setIsIdle] = useState(false);

    const fetchMenu = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const result = await getKioskMenu(token);
            if (result.success) {
                setData(result.data);
            } else {
                setError(result.message || 'שגיאה בטעינת התפריט');
            }
        } catch (err) {
            setError('שגיאה בטעינת התפריט');
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchMenu();
    }, [fetchMenu]);

    // Refresh menu every 5 minutes
    useEffect(() => {
        const interval = setInterval(fetchMenu, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [fetchMenu]);

    // Idle timer
    const resetIdleTimer = useCallback(() => {
        setIsIdle(false);
        if (idleTimerRef.current) {
            clearTimeout(idleTimerRef.current);
        }
        const timeout = (data?.kiosk?.design_options?.idle_timeout || KIOSK_DEFAULTS.idle_timeout) * 1000;
        idleTimerRef.current = setTimeout(() => {
            setIsIdle(true);
        }, timeout);
    }, [data?.kiosk?.design_options?.idle_timeout]);

    useEffect(() => {
        const events = ['touchstart', 'mousedown', 'mousemove', 'keydown', 'scroll'];
        const handleActivity = () => resetIdleTimer();

        events.forEach(event => window.addEventListener(event, handleActivity, { passive: true }));
        resetIdleTimer();

        return () => {
            events.forEach(event => window.removeEventListener(event, handleActivity));
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        };
    }, [resetIdleTimer]);

    return {
        data,
        loading,
        error,
        isIdle,
        setIsIdle,
        refetchMenu: fetchMenu,
        kiosk: data?.kiosk || null,
        restaurant: data?.restaurant || null,
        categories: data?.categories || [],
        items: data?.items || [],
    };
}
