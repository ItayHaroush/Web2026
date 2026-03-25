import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { resolvePublicPageKey } from '../utils/pageViewMap';
import { sendPublicPageView } from '../services/analyticsBeacon';

/**
 * מעקב כניסות ציבוריות — בתוך Router
 */
export default function AnalyticsPublicTracker() {
    const location = useLocation();
    const lastSigRef = useRef('');

    useEffect(() => {
        const pageKey = resolvePublicPageKey(location.pathname);
        if (!pageKey) return;

        const sig = `${pageKey}|${location.pathname}|${location.search}`;
        if (lastSigRef.current === sig) return;
        lastSigRef.current = sig;

        sendPublicPageView(pageKey, {
            path: location.pathname + location.search,
        });
    }, [location.pathname, location.search]);

    return null;
}
