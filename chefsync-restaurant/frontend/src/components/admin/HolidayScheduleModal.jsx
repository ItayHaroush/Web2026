import { useState, useEffect, useCallback } from 'react';
import holidayService from '../../services/holidayService';
import { FaCalendarAlt, FaTimes, FaCheck, FaClock, FaStore, FaLock, FaArrowLeft, FaArrowRight } from 'react-icons/fa';

const STATUS_OPTIONS = [
    { value: 'closed', label: 'סגור', icon: <FaLock />, desc: 'המסעדה סגורה בחג', color: 'red' },
    { value: 'open', label: 'פתוח רגיל', icon: <FaStore />, desc: 'פתוח בשעות רגילות', color: 'green' },
    { value: 'special_hours', label: 'שעות מיוחדות', icon: <FaClock />, desc: 'פתוח בשעות מותאמות', color: 'blue' },
];

const CARD_COLORS = {
    red: { border: 'border-red-400', bg: 'bg-red-50', icon: 'text-red-500', ring: 'ring-red-200' },
    green: { border: 'border-green-400', bg: 'bg-green-50', icon: 'text-green-500', ring: 'ring-green-200' },
    blue: { border: 'border-blue-400', bg: 'bg-blue-50', icon: 'text-blue-500', ring: 'ring-blue-200' },
};

/**
 * וויזארד חגים למסעדן — עיצוב במערכת הצבעים של TakeEat
 */
export default function HolidayScheduleModal({ show, onClose, onResponded }) {
    const [holidays, setHolidays] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentIdx, setCurrentIdx] = useState(0);
    const [form, setForm] = useState({ status: 'closed', open_time: '', close_time: '', note: '' });
    const [saving, setSaving] = useState(false);
    const [completed, setCompleted] = useState(new Set());
    const [showSummary, setShowSummary] = useState(false);

    const fetchHolidays = useCallback(async () => {
        setLoading(true);
        try {
            const res = await holidayService.getUpcomingHolidays();
            const unanswered = (res.data || []).filter(h => !h.response);
            setHolidays(unanswered);
            setCurrentIdx(0);
            setCompleted(new Set());
            setShowSummary(false);
            if (unanswered.length === 0) onClose?.();
        } catch (e) {
            console.error('שגיאה בטעינת חגים:', e);
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (show) fetchHolidays();
    }, [show, fetchHolidays]);

    const currentHoliday = holidays[currentIdx];
    const progress = holidays.length > 0 ? ((completed.size) / holidays.length) * 100 : 0;

    const handleSubmit = async () => {
        if (!currentHoliday) return;
        setSaving(true);
        try {
            await holidayService.respondToHoliday(currentHoliday.id, {
                status: form.status,
                open_time: form.status === 'special_hours' ? form.open_time : null,
                close_time: form.status === 'special_hours' ? form.close_time : null,
                note: form.note || null,
            });
            onResponded?.(currentHoliday.id);
            setCompleted(prev => new Set([...prev, currentIdx]));

            if (currentIdx < holidays.length - 1) {
                setCurrentIdx(currentIdx + 1);
                setForm({ status: 'closed', open_time: '', close_time: '', note: '' });
            } else {
                setShowSummary(true);
            }
        } catch (e) {
            console.error(e);
            alert('שגיאה בשמירה');
        } finally {
            setSaving(false);
        }
    };

    const handleSkip = () => {
        if (currentIdx < holidays.length - 1) {
            setCurrentIdx(currentIdx + 1);
            setForm({ status: 'closed', open_time: '', close_time: '', note: '' });
        } else {
            setShowSummary(true);
        }
    };

    if (!show || loading) return null;
    if (holidays.length === 0 || (!currentHoliday && !showSummary)) return null;

    const selectedOpt = STATUS_OPTIONS.find(o => o.value === form.status);
    const selectedColor = selectedOpt ? CARD_COLORS[selectedOpt.color] : CARD_COLORS.red;

    // === SUMMARY SCREEN ===
    if (showSummary) {
        const skippedIndices = holidays.map((_, idx) => idx).filter(idx => !completed.has(idx));
        const hasSkipped = skippedIndices.length > 0;

        const handleFillSkipped = () => {
            setCurrentIdx(skippedIndices[0]);
            setForm({ status: 'closed', open_time: '', close_time: '', note: '' });
            setShowSummary(false);
        };

        return (
            <div className="fixed inset-0 bg-black/50 z-[999] flex items-end sm:items-center justify-center sm:p-4" dir="rtl">
                <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-[fadeIn_0.3s_ease-out] max-h-[90vh] flex flex-col">
                    <div className={`p-5 sm:p-6 text-center flex-shrink-0 ${hasSkipped ? 'bg-gradient-to-l from-amber-400 to-orange-500' : 'bg-gradient-to-l from-brand-primary to-brand-secondary'}`}>
                        <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3">
                            {hasSkipped ? (
                                <FaClock className="text-white" size={22} />
                            ) : (
                                <FaCheck className="text-white" size={22} />
                            )}
                        </div>
                        <h2 className="text-lg sm:text-xl font-black text-white">{hasSkipped ? 'כמעט סיימתם!' : 'הכל מעודכן!'}</h2>
                        <p className="text-white/80 text-xs sm:text-sm mt-1">עדכנתם {completed.size} מתוך {holidays.length} חגים</p>
                        {hasSkipped && <p className="text-white/90 text-[11px] sm:text-xs mt-1">דילגתם על {skippedIndices.length} חגים — אפשר למלא עכשיו</p>}
                    </div>
                    <div className="p-4 sm:p-6 flex flex-col min-h-0 flex-1">
                        <div className="space-y-2 mb-4 sm:mb-6 overflow-y-auto max-h-[40vh] min-h-0">
                            {holidays.map((h, idx) => (
                                <div key={h.id} className={`flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-xl ${completed.has(idx) ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
                                    {completed.has(idx) ? (
                                        <FaCheck className="text-green-500 flex-shrink-0" size={12} />
                                    ) : (
                                        <FaClock className="text-amber-500 flex-shrink-0" size={12} />
                                    )}
                                    <span className={`text-xs sm:text-sm font-bold flex-1 ${completed.has(idx) ? 'text-green-700' : 'text-amber-700'}`}>{h.name}</span>
                                    {!completed.has(idx) && <span className="text-[9px] sm:text-[10px] text-amber-500 font-bold">דולג</span>}
                                </div>
                            ))}
                        </div>
                        <div className="flex-shrink-0">
                            {hasSkipped && (
                                <button
                                    onClick={handleFillSkipped}
                                    className="w-full bg-amber-500 text-white rounded-2xl py-2.5 sm:py-3 font-black text-base sm:text-lg hover:bg-amber-600 transition-colors mb-2 sm:mb-3"
                                >
                                    מלא את מה שדילגתי ({skippedIndices.length})
                                </button>
                            )}
                            <button
                                onClick={onClose}
                                className={`w-full rounded-2xl py-2.5 sm:py-3 font-black text-base sm:text-lg transition-colors ${hasSkipped ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-brand-primary text-white hover:bg-brand-dark'}`}
                            >
                                {hasSkipped ? 'אמלא מאוחר יותר' : 'סיום'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // === WIZARD STEP ===
    return (
        <div className="fixed inset-0 bg-black/50 z-[999] flex items-center justify-center p-4" dir="rtl">
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-[fadeIn_0.3s_ease-out]">
                {/* Progress Bar */}
                <div className="h-1.5 bg-gray-100">
                    <div
                        className="h-full bg-gradient-to-l from-brand-primary to-brand-secondary rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                {/* Header */}
                <div className="bg-gradient-to-l from-brand-primary to-brand-secondary p-4 relative">
                    <button
                        onClick={onClose}
                        className="absolute top-3 left-3 p-2 hover:bg-white/20 rounded-xl transition-colors text-white/80 hover:text-white"
                    >
                        <FaTimes size={14} />
                    </button>

                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                            <FaCalendarAlt className="text-white" size={20} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-white/70 text-[11px] font-bold">
                                שלב {currentIdx + 1} מתוך {holidays.length}
                            </p>
                            <h2 className="text-lg font-black text-white leading-tight truncate">
                                {currentHoliday.name}
                            </h2>
                        </div>
                    </div>

                    {/* Step dots */}
                    {holidays.length > 1 && (
                        <div className="flex items-center gap-1.5 mt-3 justify-center">
                            {holidays.map((_, idx) => (
                                <div
                                    key={idx}
                                    className={`rounded-full transition-all duration-300 ${
                                        idx === currentIdx
                                            ? 'w-6 h-2 bg-white'
                                            : completed.has(idx)
                                            ? 'w-2 h-2 bg-white/80'
                                            : 'w-2 h-2 bg-white/30'
                                    }`}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Holiday details card */}
                <div className="mx-4 -mt-1 relative z-10">
                    <div className="bg-brand-light border border-brand-cream rounded-2xl p-3">
                        <div className="flex items-center justify-between">
                            <div>
                                {currentHoliday.hebrew_date_info && (
                                    <p className="text-xs font-bold text-brand-muted">{currentHoliday.hebrew_date_info}</p>
                                )}
                                <p className="text-[11px] text-gray-500 mt-0.5">
                                    {new Date(currentHoliday.start_date).toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'short' })}
                                    {currentHoliday.start_date !== currentHoliday.end_date &&
                                        ` — ${new Date(currentHoliday.end_date).toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'short' })}`
                                    }
                                </p>
                            </div>
                            <span className="text-2xl">🕎</span>
                        </div>
                        {currentHoliday.description && (
                            <p className="text-[11px] text-gray-600 mt-2 border-t border-brand-cream pt-2">{currentHoliday.description}</p>
                        )}
                    </div>
                </div>

                {/* Status Selection */}
                <div className="p-4 space-y-3">
                    <p className="text-sm font-black text-gray-800">מה הסטטוס שלכם בחג?</p>
                    <div className="space-y-2">
                        {STATUS_OPTIONS.map((opt) => {
                            const c = CARD_COLORS[opt.color];
                            const isSelected = form.status === opt.value;
                            return (
                                <button
                                    key={opt.value}
                                    onClick={() => setForm(p => ({ ...p, status: opt.value }))}
                                    className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all text-right ${
                                        isSelected
                                            ? `${c.border} ${c.bg} shadow-sm ring-2 ${c.ring}`
                                            : 'border-gray-200 hover:border-gray-300 bg-white'
                                    }`}
                                >
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isSelected ? c.bg : 'bg-gray-100'}`}>
                                        <span className={isSelected ? c.icon : 'text-gray-400'}>{opt.icon}</span>
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-black text-sm text-gray-900">{opt.label}</p>
                                        <p className="text-[11px] text-gray-500">{opt.desc}</p>
                                    </div>
                                    {isSelected && (
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${c.bg} border ${c.border}`}>
                                            <FaCheck className={c.icon} size={10} />
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Time Pickers for special_hours */}
                    {form.status === 'special_hours' && (
                        <div className="grid grid-cols-2 gap-3 bg-blue-50 rounded-2xl p-4 border border-blue-200 animate-[fadeIn_0.2s_ease-out]">
                            <div>
                                <label className="block text-xs font-black text-blue-800 mb-1.5">שעת פתיחה</label>
                                <input
                                    type="time"
                                    value={form.open_time}
                                    onChange={e => setForm(p => ({ ...p, open_time: e.target.value }))}
                                    required
                                    className="w-full border border-blue-300 rounded-xl px-3 py-2 text-sm font-bold bg-white focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-blue-800 mb-1.5">שעת סגירה</label>
                                <input
                                    type="time"
                                    value={form.close_time}
                                    onChange={e => setForm(p => ({ ...p, close_time: e.target.value }))}
                                    required
                                    className="w-full border border-blue-300 rounded-xl px-3 py-2 text-sm font-bold bg-white focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none"
                                />
                            </div>
                        </div>
                    )}

                    {/* Note */}
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">הערה (אופציונלי)</label>
                        <input
                            type="text"
                            value={form.note}
                            onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary outline-none"
                            placeholder="למשל: פתוח רק לאיסוף..."
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex gap-2">
                    <button
                        onClick={handleSubmit}
                        disabled={saving || (form.status === 'special_hours' && (!form.open_time || !form.close_time))}
                        className="flex-1 bg-brand-primary text-white rounded-2xl py-3 font-black hover:bg-brand-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-brand-primary/20"
                    >
                        <FaCheck size={12} />
                        {saving ? 'שומר...' : currentIdx < holidays.length - 1 ? 'שמור ← הבא' : 'שמור וסיים'}
                    </button>
                    <button
                        onClick={handleSkip}
                        className="px-5 py-3 border border-gray-200 rounded-2xl text-gray-500 text-sm font-bold hover:bg-gray-100 transition-colors"
                    >
                        דלג
                    </button>
                </div>
            </div>
        </div>
    );
}
