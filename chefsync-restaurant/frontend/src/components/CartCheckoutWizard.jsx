import React from 'react';
import { FaCheck } from 'react-icons/fa';

/**
 * אינדיקטור שלבי תשלום בסל — ניווט חכם בלי לשנות לוגיקת עסקה.
 * רק שלבים שכבר בוצעו או הפעיל — ניתן ללחיצה לחזרה.
 */
export default function CartCheckoutWizard({
    step,
    onStepChange,
    labels = ['הסל', 'פרטים ומשלוח', 'סיום והזמנה'],
}) {
    const count = labels.length;

    return (
        <nav
            className="rounded-2xl border border-gray-200 dark:border-brand-dark-border bg-gradient-to-br from-white to-orange-50/40 dark:from-brand-dark-surface dark:to-orange-950/20 px-2 py-3 sm:px-4 sm:py-4 shadow-sm"
            aria-label="שלבי ביצוע ההזמנה"
        >
            <ol className="flex items-start justify-between gap-1 sm:gap-3">
                {labels.map((label, i) => {
                    const n = i + 1;
                    const isActive = step === n;
                    const isDone = step > n;
                    const clickable = isDone || isActive;

                    return (
                        <li key={n} className="flex flex-1 min-w-0 items-start gap-1 sm:gap-2">
                            <button
                                type="button"
                                onClick={() => clickable && onStepChange(n)}
                                disabled={!clickable}
                                className={`flex flex-1 flex-col items-center gap-1 min-w-0 rounded-xl px-0.5 py-1 transition ${
                                    clickable ? 'cursor-pointer hover:bg-white/60 dark:hover:bg-brand-dark-bg/80' : 'cursor-default opacity-50'
                                } ${isActive ? 'ring-2 ring-brand-primary/40 ring-offset-1 ring-offset-transparent rounded-xl' : ''}`}
                            >
                                <span
                                    className={`flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full text-xs sm:text-sm font-black shrink-0 border-2 ${
                                        isActive
                                            ? 'border-brand-primary bg-brand-primary text-white shadow-md'
                                            : isDone
                                              ? 'border-emerald-500 bg-emerald-500 text-white'
                                              : 'border-gray-300 dark:border-brand-dark-border bg-gray-100 dark:bg-brand-dark-bg text-gray-500 dark:text-brand-dark-muted'
                                    }`}
                                >
                                    {isDone ? <FaCheck className="text-sm sm:text-base" aria-hidden /> : n}
                                </span>
                                <span
                                    className={`text-[9px] sm:text-xs font-bold text-center leading-snug line-clamp-2 px-0.5 ${
                                        isActive ? 'text-brand-primary' : isDone ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-500 dark:text-brand-dark-muted'
                                    }`}
                                >
                                    {label}
                                </span>
                            </button>
                            {i < count - 1 && (
                                <span
                                    className={`mt-4 sm:mt-5 hidden sm:inline-block w-2 sm:w-6 h-0.5 shrink-0 rounded-full self-center ${
                                        step > n ? 'bg-emerald-400' : 'bg-gray-200 dark:bg-brand-dark-border'
                                    }`}
                                    aria-hidden
                                />
                            )}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}
