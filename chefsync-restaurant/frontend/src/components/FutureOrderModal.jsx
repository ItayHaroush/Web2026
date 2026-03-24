import React, { useState, useMemo } from 'react';
import { FaClock, FaTimes, FaCreditCard, FaCalendarAlt, FaCheckCircle } from 'react-icons/fa';

const ENGLISH_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

function localYmd(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/** מועד מוקדם ביותר: max(שעה, זמן_הכנה + 30 דקות) לפי משלוח/איסוף */
export function getMinimumScheduledDate(restaurant, deliveryMethod = 'delivery') {
    const prep = deliveryMethod === 'delivery'
        ? Number(restaurant?.delivery_time_minutes) || 0
        : Number(restaurant?.pickup_time_minutes) || 0;
    const minutes = Math.max(60, prep + 30);
    return new Date(Date.now() + minutes * 60 * 1000);
}

/**
 * מודל בחירת תאריך ושעה להזמנה עתידית
 * נפתח כשהמסעדה סגורה + allow_future_orders (+אשראי או משתמש רשום).
 * הודעת «תשלום באשראי מראש» מוצגת רק לאורחים.
 */
export default function FutureOrderModal({ isOpen, onClose, onConfirm, restaurant, isRegisteredCustomer = false, deliveryMethod = 'delivery' }) {
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedTime, setSelectedTime] = useState('');
    const [error, setError] = useState('');

    const operatingHours = restaurant?.operating_hours || {};
    const operatingDays = restaurant?.operating_days || {};

    const minScheduled = useMemo(
        () => getMinimumScheduledDate(restaurant, deliveryMethod),
        [restaurant, deliveryMethod]
    );

    const earliestTimeLabel = useMemo(
        () => minScheduled.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
        [minScheduled]
    );

    const earliestDateLabel = useMemo(
        () => minScheduled.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' }),
        [minScheduled]
    );

    // טווח תאריכים: מהמועד המוקדם המותר (כולל היום) עד 30 יום קדימה
    const dateRange = useMemo(() => {
        const max = new Date();
        max.setDate(max.getDate() + 30);
        return {
            min: localYmd(minScheduled),
            max: localYmd(max),
        };
    }, [minScheduled]);

    // שעות פעילות ליום שנבחר
    const hoursForSelectedDay = useMemo(() => {
        if (!selectedDate) return null;

        const date = new Date(selectedDate + 'T12:00:00');
        const dayOfWeek = date.getDay();
        const englishDay = ENGLISH_DAYS[dayOfWeek];
        const hebrewDay = HEBREW_DAYS[dayOfWeek];
        const dateStr = selectedDate; // YYYY-MM-DD

        const defaultHours = operatingHours.default || operatingHours;
        const specialDays = operatingHours.special_days || {};
        const perDayOverrides = operatingHours.days || {};

        // 1) יום מיוחד
        if (specialDays[dateStr]) {
            const special = specialDays[dateStr];
            if (special.closed) return { closed: true };
            return {
                open: special.open || defaultHours?.open || '00:00',
                close: special.close || defaultHours?.close || '23:59',
            };
        }

        // 2) override שבועי — תומך גם במפתחות באנגלית (Sunday) וגם בעברית (ראשון)
        const dayOverride = perDayOverrides[englishDay] || perDayOverrides[hebrewDay];
        if (dayOverride) {
            if (dayOverride.closed) return { closed: true };
            return {
                open: dayOverride.open || defaultHours?.open || '00:00',
                close: dayOverride.close || defaultHours?.close || '23:59',
            };
        }

        // 3) בדיקת operating_days (יום פתוח/סגור) — תומך גם באנגלית וגם בעברית
        if (operatingDays && Object.keys(operatingDays).length > 0) {
            const dayOpen = operatingDays[englishDay] ?? operatingDays[hebrewDay];
            if (dayOpen === false) return { closed: true };
        }

        // 4) ברירת מחדל
        if (!defaultHours || (!defaultHours.open && !defaultHours.close)) {
            return { open: '00:00', close: '23:59' };
        }

        return {
            open: defaultHours.open || '00:00',
            close: defaultHours.close || '23:59',
        };
    }, [selectedDate, operatingHours, operatingDays]);

    const isTimeValid = useMemo(() => {
        if (!selectedTime || !hoursForSelectedDay || hoursForSelectedDay.closed) return false;

        const { open, close } = hoursForSelectedDay;

        // בדיקת שעה מותרת
        if (close < open) {
            // פתוח בין לילה
            return selectedTime >= open || selectedTime <= close;
        }
        return selectedTime >= open && selectedTime <= close;
    }, [selectedTime, hoursForSelectedDay]);

    const timeInputMin = useMemo(() => {
        if (!selectedDate || !hoursForSelectedDay || hoursForSelectedDay.closed) return undefined;
        const minDay = localYmd(minScheduled);
        if (selectedDate < minDay) return '00:00';
        if (selectedDate > minDay) return undefined;
        const h = String(minScheduled.getHours()).padStart(2, '0');
        const mi = String(minScheduled.getMinutes()).padStart(2, '0');
        return `${h}:${mi}`;
    }, [selectedDate, minScheduled, hoursForSelectedDay]);

    const handleConfirm = () => {
        setError('');

        if (!selectedDate) {
            setError('נא לבחור תאריך');
            return;
        }
        if (!selectedTime) {
            setError('נא לבחור שעה');
            return;
        }

        if (hoursForSelectedDay?.closed) {
            setError('המסעדה סגורה ביום שנבחר. נא לבחור יום אחר.');
            return;
        }

        if (!isTimeValid) {
            setError(`השעה שנבחרה מחוץ לשעות הפעילות (${hoursForSelectedDay?.open} — ${hoursForSelectedDay?.close})`);
            return;
        }

        const scheduledDateTime = new Date(`${selectedDate}T${selectedTime}`);
        if (scheduledDateTime < minScheduled) {
            setError(`ניתן להזמין החל מ-${earliestTimeLabel} (לפחות ${Math.max(60, (deliveryMethod === 'delivery' ? Number(restaurant?.delivery_time_minutes) || 0 : Number(restaurant?.pickup_time_minutes) || 0) + 30)} דקות מראש)`);
            return;
        }

        // ISO string לשליחה לשרת
        const isoString = `${selectedDate}T${selectedTime}`;
        onConfirm(isoString);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
            <div
                className="relative bg-white dark:bg-brand-dark-surface rounded-t-[1.75rem] sm:rounded-3xl shadow-2xl w-full max-w-md max-h-[min(92dvh,92vh)] overflow-hidden flex flex-col min-h-0 animate-slideUp sm:m-0"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-5 text-white relative">
                    <button
                        onClick={onClose}
                        className="absolute top-4 left-4 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
                    >
                        <FaTimes className="text-sm" />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                            <FaClock className="text-2xl" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">הזמנה עתידית</h2>
                            <p className="text-white/80 text-sm">בחר מועד לקבלת ההזמנה</p>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 space-y-5 overflow-y-auto min-h-0 flex-1">
                    <p className="text-gray-600 dark:text-brand-dark-muted text-sm leading-relaxed">
                        בחר תאריך ושעה שבהם המסעדה פתוחה. ההזמנה תישמר במערכת ותועבר למטבח בזמן.
                    </p>
                    <p className="text-sm font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/25 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2">
                        הזמנה מוקדמת ביותר: {earliestTimeLabel}
                        {localYmd(minScheduled) !== localYmd(new Date()) ? ` (${earliestDateLabel})` : ''}
                    </p>

                    {/* אורחים: הזמנה עתידית דורשת אשראי מראש. משתמש רשום יכול גם במזומן — בלי הודעה */}
                    {!isRegisteredCustomer && (
                        <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl">
                            <FaCreditCard className="text-blue-500 shrink-0" />
                            <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                                התשלום יתבצע מראש באשראי בעת ביצוע ההזמנה
                            </p>
                        </div>
                    )}

                    {/* Date Picker */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-brand-dark-text mb-2">
                            <FaCalendarAlt className="inline ml-1 text-brand-primary" />
                            בחר תאריך
                        </label>
                        <input
                            type="date"
                            dir="ltr"
                            value={selectedDate}
                            onChange={(e) => {
                                setSelectedDate(e.target.value);
                                setSelectedTime('');
                                setError('');
                            }}
                            min={dateRange.min}
                            max={dateRange.max}
                            className="w-full min-w-0 max-w-full box-border px-4 py-3 border-2 border-gray-200 dark:border-brand-dark-border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all bg-white dark:bg-brand-dark-bg dark:text-brand-dark-text text-base"
                        />
                    </div>

                    {/* Operating hours hint */}
                    {selectedDate && hoursForSelectedDay && (
                        <div className={`p-3 rounded-xl text-sm font-medium ${hoursForSelectedDay.closed
                            ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-700'
                            : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-700'
                            }`}>
                            {hoursForSelectedDay.closed
                                ? <><FaTimes className="inline text-red-500 ml-1" size={12} /> המסעדה סגורה ביום זה</>
                                : <><FaCheckCircle className="inline text-green-500 ml-1" size={12} /> שעות פעילות: {hoursForSelectedDay.open} — {hoursForSelectedDay.close}</>
                            }
                        </div>
                    )}

                    {/* Time Picker */}
                    {selectedDate && !hoursForSelectedDay?.closed && (
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-brand-dark-text mb-2">
                                <FaClock className="inline ml-1 text-brand-primary" />
                                בחר שעה
                            </label>
                            <input
                                type="time"
                                dir="ltr"
                                value={selectedTime}
                                min={timeInputMin || undefined}
                                onChange={(e) => {
                                    setSelectedTime(e.target.value);
                                    setError('');
                                }}
                                className="w-full min-w-0 max-w-full box-border px-4 py-3 border-2 border-gray-200 dark:border-brand-dark-border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all bg-white dark:bg-brand-dark-bg dark:text-brand-dark-text text-base"
                            />
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <p className="text-red-600 dark:text-red-400 text-sm font-medium bg-red-50 dark:bg-red-900/20 p-3 rounded-xl">
                            {error}
                        </p>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2 flex gap-3 shrink-0 border-t border-gray-100 dark:border-brand-dark-border bg-white dark:bg-brand-dark-surface">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl border-2 border-gray-200 dark:border-brand-dark-border text-gray-600 dark:text-brand-dark-muted font-bold hover:bg-gray-50 dark:hover:bg-brand-dark-bg transition-colors"
                    >
                        ביטול
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!selectedDate || !selectedTime || hoursForSelectedDay?.closed}
                        className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        <FaCheckCircle />
                        <span>אישור</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
