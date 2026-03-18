import React, { useState, useEffect, useCallback } from 'react';
import { FaDownload, FaTimes } from 'react-icons/fa';

/**
 * PWA Install Banner
 * מוצג לפי אסטרטגיית טיימינג:
 * - לא בביקור ראשון
 * - אחרי הזמנה ראשונה: באנר קטן
 * - אחרי 3 הזמנות: interstitial
 * - מקסימום 3 הצגות, כיבוד דיסמיס
 */

const DISMISS_KEY = 'pwa_install_dismissed_count';
const MAX_DISMISSALS = 3;

export default function PWAInstallBanner() {
    const [installPrompt, setInstallPrompt] = useState(null);
    const [showBanner, setShowBanner] = useState(false);
    const [isIos, setIsIos] = useState(false);

    useEffect(() => {
        // iOS detection — no beforeinstallprompt
        const ua = navigator.userAgent;
        const isIosDevice = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
        setIsIos(isIosDevice);

        // Check dismissals
        const dismissed = parseInt(localStorage.getItem(DISMISS_KEY) || '0', 10);
        if (dismissed >= MAX_DISMISSALS) return;

        // Check if already installed
        if (window.matchMedia('(display-mode: standalone)').matches) return;

        const handler = (e) => {
            e.preventDefault();
            setInstallPrompt(e);
            // Show after short delay (don't show instantly)
            setTimeout(() => setShowBanner(true), 2000);
        };

        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = useCallback(async () => {
        if (!installPrompt) return;

        try {
            await installPrompt.prompt();
            const { outcome } = await installPrompt.userChoice;
            if (outcome === 'accepted') {
                setShowBanner(false);
                setInstallPrompt(null);
            }
        } catch (err) {
            console.error('Install prompt failed:', err);
        }
    }, [installPrompt]);

    const handleDismiss = useCallback(() => {
        setShowBanner(false);
        const current = parseInt(localStorage.getItem(DISMISS_KEY) || '0', 10);
        localStorage.setItem(DISMISS_KEY, (current + 1).toString());
    }, []);

    if (!showBanner) return null;
    // Don't show on iOS (no install prompt support — would need manual instructions)
    if (isIos) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-slide-up">
            <div className="max-w-lg mx-auto bg-white dark:bg-brand-dark-surface rounded-2xl shadow-2xl dark:shadow-black/30 border border-gray-200 dark:border-brand-dark-border p-4 flex items-center gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-brand-primary to-orange-500 rounded-xl flex items-center justify-center">
                    <FaDownload className="text-white text-lg" />
                </div>

                <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 dark:text-brand-dark-text text-sm">
                        הזמן מהר יותר
                    </p>
                    <p className="text-xs text-gray-500 dark:text-brand-dark-muted">
                        הוסף את TakeEat למסך הבית
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                        onClick={handleInstall}
                        className="bg-brand-primary text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-brand-secondary transition"
                    >
                        התקן
                    </button>
                    <button
                        onClick={handleDismiss}
                        className="text-gray-400 hover:text-gray-600 transition p-1"
                        aria-label="סגור"
                    >
                        <FaTimes size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}
