import React, { useId } from 'react';
import { FaTimes, FaExclamationTriangle, FaMask } from 'react-icons/fa';

/** מראה אחיד — כמו פופ־אפ «ההזמנות שלי» (רקע שקוף, מסגרת מותג, פס עליון מותג) */
const CARD_LIKE_ORDERS_HINT = {
    bar: 'from-brand-primary via-orange-400 to-brand-secondary',
    iconWrap: 'bg-brand-primary/15 text-brand-primary dark:bg-orange-500/25 dark:text-orange-300',
    border: 'border-brand-primary/25 dark:border-slate-600',
    bg: 'bg-white/95 dark:bg-slate-900',
    title: 'text-gray-900 dark:text-white',
    body: 'text-gray-600 dark:text-slate-300',
};

const VARIANT_STYLES = {
    error: CARD_LIKE_ORDERS_HINT,
    demo: CARD_LIKE_ORDERS_HINT,
};

/**
 * הודעת עליון נסגרת (במקום טוסט) — ממורכז מתחת לראש המסך, עם כפתור סגירה.
 */
export default function TopDismissibleBanner({
    open,
    onClose,
    title,
    message,
    variant = 'error',
    icon: IconOverride,
}) {
    const titleId = useId();
    if (!open) return null;

    const s = VARIANT_STYLES[variant] || VARIANT_STYLES.error;
    const Icon = IconOverride || (variant === 'demo' ? FaMask : FaExclamationTriangle);
    const shellTone =
        'shadow-2xl shadow-brand-primary/15 dark:shadow-black/50 backdrop-blur-md dark:backdrop-blur-none ring-1 ring-black/5 dark:ring-slate-500/40';

    return (
        <div
            className="fixed top-0 left-0 right-0 z-[110] flex justify-center pt-[max(0.75rem,env(safe-area-inset-top,0px))] px-3 sm:px-4 pointer-events-none"
            role="alertdialog"
            aria-labelledby={titleId}
            dir="rtl"
        >
            <div
                className={`pointer-events-auto w-full max-w-md motion-reduce:animate-none animate-top-dismissible-in relative overflow-hidden rounded-2xl border ${shellTone} ${s.border} ${s.bg}`}
            >
                <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-l ${s.bar}`} aria-hidden />
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute top-2 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                    aria-label="סגור הודעה"
                >
                    <FaTimes className="h-3.5 w-3.5" />
                </button>
                <div className="flex items-start gap-3 p-4 pr-11 pt-5 sm:p-5 sm:pr-12 sm:pt-6">
                    <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${s.iconWrap}`} aria-hidden>
                        <Icon className="h-4 w-4 sm:h-[1.05rem] sm:w-[1.05rem]" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p id={titleId} className={`text-sm sm:text-base font-black leading-snug ${s.title}`}>
                            {title}
                        </p>
                        {message ? (
                            <p className={`mt-1 text-xs sm:text-sm font-medium leading-relaxed ${s.body}`}>
                                {message}
                            </p>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
}
