import { useEffect, useState } from 'react';
import { FaExternalLinkAlt, FaTimes, FaEllipsisH } from 'react-icons/fa';

/**
 * באנר עדין בתחתית המסך למשתמשים שפתחו את האתר בתוך אפליקציות סושיאל
 * (פייסבוק / אינסטגרם / מסנג'ר). מציע לפתוח בדפדפן חיצוני לחוויה מלאה,
 * אך לא חוסם את השימוש באתר.
 */

const IN_APP_RE = /FBAN|FBAV|FB_IAB|FB4A|Instagram|Messenger/i;

function isInAppBrowser() {
    try {
        return IN_APP_RE.test(navigator.userAgent || '');
    } catch {
        return false;
    }
}

export default function FacebookInAppWarning() {
    const [show, setShow] = useState(false);
    const [opening, setOpening] = useState(false);
    const [showHint, setShowHint] = useState(false);

    useEffect(() => {
        let wasDismissed = false;
        try {
            wasDismissed = !!sessionStorage.getItem('fb-warning-dismissed');
        } catch {
            /* sessionStorage לא זמין — נמשיך כרגיל */
        }
        if (isInAppBrowser() && !wasDismissed) {
            setShow(true);
        }
    }, []);

    const handleDismiss = () => {
        setShow(false);
        try {
            sessionStorage.setItem('fb-warning-dismissed', 'true');
        } catch {
            /* שמירה נכשלה — נמשיך כרגיל */
        }
    };

    const handleOpenInBrowser = () => {
        const url = window.location.href;
        const ua = navigator.userAgent || '';
        const isIOS = /iPhone|iPad|iPod/i.test(ua);
        const isAndroid = /Android/i.test(ua);

        setOpening(true);
        setShowHint(false);

        try {
            if (isAndroid) {
                // פתיחה ב-Chrome דרך Android Intent, עם נפילה חזרה לכתובת המקורית.
                const noScheme = url.replace(/^https?:\/\//, '');
                window.location.href =
                    `intent://${noScheme}#Intent;scheme=https;package=com.android.chrome;` +
                    `S.browser_fallback_url=${encodeURIComponent(url)};end`;
            } else if (isIOS) {
                // ב-iOS אין דרך ציבורית לכפות את Safari; מנסים לפתוח ב-Chrome אם מותקן.
                window.location.href = 'googlechrome://' + url.replace(/^https?:\/\//, '');
            } else {
                window.open(url, '_blank', 'noopener');
            }
        } catch {
            /* אם הניווט נכשל — ההוראות הידניות ייחשפו למטה */
        }

        // אם נשארנו כאן אחרי רגע, סימן שהדפדפן החיצוני לא נפתח — נציג הנחיה ידנית עדינה.
        window.setTimeout(() => {
            setOpening(false);
            setShowHint(true);
        }, 1600);
    };

    if (!show) {
        return null;
    }

    return (
        <div
            dir="rtl"
            role="dialog"
            aria-live="polite"
            aria-label="פתיחה בדפדפן חיצוני"
            className="fixed inset-x-0 bottom-0 z-[9999] p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pointer-events-none"
        >
            <div className="pointer-events-auto mx-auto w-full max-w-md overflow-hidden rounded-2xl bg-white text-brand-dark shadow-2xl ring-1 ring-black/5 animate-bottom-dismissible-in dark:bg-brand-dark-surface dark:text-brand-dark-text dark:ring-white/10">
                <div className="flex items-center gap-3 p-3">
                    {/* אייקון */}
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
                        <FaExternalLinkAlt size={15} />
                    </div>

                    {/* תוכן */}
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold leading-tight">
                            פתחו בדפדפן לחוויה מלאה
                        </p>
                        <p className="mt-0.5 truncate text-xs leading-tight text-gray-500 dark:text-brand-dark-muted">
                            פתחתם דרך פייסבוק / אינסטגרם
                        </p>
                    </div>

                    {/* פעולה ראשית — פתיחה בדפדפן חיצוני */}
                    <button
                        type="button"
                        onClick={handleOpenInBrowser}
                        disabled={opening}
                        className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-xl bg-brand-primary px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-brand-secondary active:scale-95 disabled:opacity-70"
                    >
                        {opening ? 'פותח…' : 'פתח בדפדפן'}
                    </button>

                    {/* סגירה / המשך כאן */}
                    <button
                        type="button"
                        onClick={handleDismiss}
                        aria-label="המשך בדפדפן הנוכחי"
                        className="-mr-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-black/5 hover:text-gray-600 dark:hover:bg-white/10 dark:hover:text-white"
                    >
                        <FaTimes size={14} />
                    </button>
                </div>

                {/* הנחיה ידנית — מופיעה רק אם הפתיחה האוטומטית לא עבדה */}
                {showHint && (
                    <div className="px-3 pb-3">
                        <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-white/5 dark:text-brand-dark-muted">
                            <FaEllipsisH size={14} className="flex-shrink-0 text-brand-primary" />
                            <span>
                                לא נפתח? הקישו על <strong>⋯</strong> בפינה ובחרו{' '}
                                <strong>"פתח בדפדפן"</strong>
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
