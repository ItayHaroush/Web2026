import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext();

function getTimeBasedTheme() {
    const hour = new Date().getHours();
    return (hour >= 6 && hour < 19) ? 'light' : 'dark';
}

export function ThemeProvider({ children }) {
    const [themePreference, setThemePreference] = useState(() => {
        return localStorage.getItem('takeeat-theme') || 'light';
    });

    const resolvedTheme = themePreference === 'auto'
        ? getTimeBasedTheme()
        : themePreference;

    const applyTheme = useCallback((theme) => {
        const root = document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
            document.body.style.backgroundColor = '#111827';
        } else {
            root.classList.remove('dark');
            document.body.style.backgroundColor = '#FFF7ED';
        }
    }, []);

    useEffect(() => {
        applyTheme(resolvedTheme);
    }, [resolvedTheme, applyTheme]);

    useEffect(() => {
        localStorage.setItem('takeeat-theme', themePreference);
    }, [themePreference]);

    // Auto mode: re-check every 60 seconds
    useEffect(() => {
        if (themePreference !== 'auto') return;
        const interval = setInterval(() => {
            applyTheme(getTimeBasedTheme());
        }, 60000);
        return () => clearInterval(interval);
    }, [themePreference, applyTheme]);

    return (
        <ThemeContext.Provider value={{ themePreference, resolvedTheme, setThemePreference }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
    return ctx;
}
