import { FaExclamationTriangle } from 'react-icons/fa';

/**
 * באנר אזהרה למצב פיתוח
 * מוצג רק במצב DEV (Vite) כדי להזהיר שבילינג ומנויים מבוטלים
 */
export default function DevModeBanner() {
    // מוצג רק בסביבת פיתוח של Vite
    let isDev = false;
    try {
        isDev = import.meta?.env?.DEV || false;
    } catch (e) {
        // import.meta not available in some environments
        isDev = false;
    }

    if (!isDev) return null;

    return (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black px-4 py-2.5 rounded-xl shadow-2xl z-[9999] flex items-center gap-3 animate-pulse border-2 border-yellow-700">
            <div className="bg-black/20 p-1.5 rounded-full">
                <FaExclamationTriangle className="text-white text-lg" />
            </div>
            <div>
                <p className="font-bold text-sm leading-tight">מצב פיתוח פעיל</p>
                <p className="text-xs opacity-90">בילינג ומנויים מבוטלים</p>
            </div>
        </div>
    );
}
