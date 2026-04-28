import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const InstallPromptContext = createContext(null);

export function InstallPromptProvider({ children }) {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [isIos, setIsIos] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);

    useEffect(() => {
        try {
            setIsStandalone(window.matchMedia('(display-mode: standalone)').matches);
        } catch {
            /* */
        }
        const ua = navigator.userAgent;
        setIsIos(/iPad|iPhone|iPod/.test(ua) && !window.MSStream);

        const handler = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };

        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const promptInstall = useCallback(async () => {
        if (!deferredPrompt) return { outcome: 'unavailable' };
        try {
            await deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                setDeferredPrompt(null);
            }
            return { outcome };
        } catch {
            setDeferredPrompt(null);
            return { outcome: 'error' };
        }
    }, [deferredPrompt]);

    const canInstall = !!deferredPrompt && !isStandalone && !isIos;

    const value = useMemo(
        () => ({
            deferredPrompt,
            canInstall,
            isIos,
            isStandalone,
            promptInstall,
        }),
        [deferredPrompt, canInstall, isIos, isStandalone, promptInstall]
    );

    return <InstallPromptContext.Provider value={value}>{children}</InstallPromptContext.Provider>;
}

export function useInstallPrompt() {
    const ctx = useContext(InstallPromptContext);
    if (!ctx) {
        throw new Error('useInstallPrompt must be used within InstallPromptProvider');
    }
    return ctx;
}
