import React, { useState, useEffect } from 'react';
import { FaDownload, FaTimes } from 'react-icons/fa';
import { useInstallPrompt } from '../context/InstallPromptContext';

/**
 * PWA Install Banner — משותף עם InstallPromptProvider (כפתור מפורש בהגדרות משתמש).
 */

const DISMISS_KEY = 'pwa_install_dismissed_count';
const MAX_DISMISSALS = 3;

export default function PWAInstallBanner() {
    const { canInstall, isIos, promptInstall } = useInstallPrompt();
    const [showBanner, setShowBanner] = useState(false);

    useEffect(() => {
        if (!canInstall || isIos) return;

        const dismissed = parseInt(localStorage.getItem(DISMISS_KEY) || '0', 10);
        if (dismissed >= MAX_DISMISSALS) return;

        const t = setTimeout(() => setShowBanner(true), 2000);
        return () => clearTimeout(t);
    }, [canInstall, isIos]);

    const handleInstall = async () => {
        const { outcome } = await promptInstall();
        if (outcome === 'accepted') {
            setShowBanner(false);
        }
    };

    const handleDismiss = () => {
        setShowBanner(false);
        const current = parseInt(localStorage.getItem(DISMISS_KEY) || '0', 10);
        localStorage.setItem(DISMISS_KEY, (current + 1).toString());
    };

    if (!showBanner || !canInstall || isIos) return null;

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
                        type="button"
                        onClick={handleInstall}
                        className="bg-brand-primary text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-brand-secondary transition"
                    >
                        התקן
                    </button>
                    <button
                        type="button"
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
