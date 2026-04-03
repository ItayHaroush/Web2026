import { useState } from 'react';
import { FaChair, FaPercent, FaShekelSign, FaCheck, FaSpinner, FaUndo, FaChevronDown, FaChevronUp, FaTimes } from 'react-icons/fa';
import apiClient from '../services/apiClient';
import AiDineInRecommender from './AiDineInRecommender';

/**
 * פאנל תמחור ישיבה גורף
 * בחירת אחוז או סכום קבוע, לפי קטגוריה או לכל התפריט
 * + אפשרות AI בעלות קרדיטים
 */
export default function DineInPricerPanel({
    categories,
    enableDineInPricing,
    onToggleDineIn,
    onApplyAdjustments,
    onRefresh,
    getAuthHeaders,
    onOpenChange,
    hideFab = false,
    mobileOnly = false,
}) {
    const [open, setOpen] = useState(false);

    const toggleOpen = (val) => {
        setOpen(val);
        onOpenChange?.(val);
    };
    const [mode, setMode] = useState('percent'); // 'percent' | 'flat'
    const [value, setValue] = useState('');
    const [categoryId, setCategoryId] = useState(''); // '' = all
    const [applying, setApplying] = useState(false);
    const [resetting, setResetting] = useState(false);
    const [result, setResult] = useState(null);

    const handleApply = async () => {
        const num = parseFloat(value);
        if (isNaN(num) || num <= 0) return;

        setApplying(true);
        setResult(null);
        try {
            const res = await apiClient.post('/admin/restaurant/bulk-dine-in-adjust', {
                mode,
                value: num,
                category_id: categoryId || null,
            }, { headers: getAuthHeaders() });

            if (res.data.success) {
                setResult({ type: 'success', text: res.data.message });
                onRefresh?.();
            }
        } catch (err) {
            setResult({ type: 'error', text: err.response?.data?.message || 'שגיאה בהחלת תמחור' });
        } finally {
            setApplying(false);
        }
    };

    const handleReset = async () => {
        if (!confirm('האם לאפס את כל תוספות הישיבה?')) return;
        setResetting(true);
        setResult(null);
        try {
            await apiClient.post('/admin/restaurant/reset-dine-in-adjustments', {}, { headers: getAuthHeaders() });
            setResult({ type: 'success', text: 'כל ההתאמות אופסו' });
            onRefresh?.();
        } catch {
            setResult({ type: 'error', text: 'שגיאה באיפוס' });
        } finally {
            setResetting(false);
        }
    };

    return (
        <div className={mobileOnly ? '' : 'relative'}>
            {/* Desktop toggle button — hidden on mobile, hidden when mobileOnly */}
            {!mobileOnly && (
            <button
                type="button"
                onClick={() => toggleOpen(!open)}
                className={`hidden md:flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-xs transition-all border ${enableDineInPricing
                    ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                    : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'
                    }`}
                title="תמחור ישיבה במקום"
            >
                <FaChair size={14} />
                <span>תמחור ישיבה</span>
                <span className={`w-2 h-2 rounded-full ${enableDineInPricing ? 'bg-amber-500' : 'bg-gray-300'}`} />
                {open ? <FaChevronUp size={10} /> : <FaChevronDown size={10} />}
            </button>
            )}

            {/* Mobile FAB — above "הוסף פריט" FAB */}
            {!open && !hideFab && (
                <button
                    type="button"
                    onClick={() => toggleOpen(true)}
                    className={`fixed z-40 flex md:hidden items-center gap-2 rounded-full shadow-xl px-4 py-3.5 font-black text-sm active:scale-[0.98] transition-transform bottom-[5.5rem] right-4 ${enableDineInPricing
                        ? 'bg-amber-500 text-white shadow-amber-500/30'
                        : 'bg-white text-gray-600 border border-gray-200 shadow-gray-200/50'
                        }`}
                    style={{ paddingBottom: 'max(0.875rem, env(safe-area-inset-bottom))' }}
                >
                    <FaChair className="text-lg shrink-0" />
                    <span className="truncate text-right leading-tight">תמחור ישיבה</span>
                </button>
            )}

            {/* Mobile: full-screen bottom sheet / Desktop: popover */}
            {open && (
                <>
                    {/* Backdrop — mobile only */}
                    <div
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] sm:hidden"
                        onClick={() => toggleOpen(false)}
                    />

                    {/* Panel */}
                    <div className="fixed inset-x-0 bottom-0 z-[70] sm:absolute sm:inset-auto sm:left-0 sm:top-full sm:mt-2 sm:w-[340px] bg-white rounded-t-2xl sm:rounded-2xl border border-gray-200 shadow-xl p-4 space-y-4 max-h-[85vh] sm:max-h-none overflow-y-auto">
                        {/* Drag handle — mobile */}
                        <div className="sm:hidden flex justify-center pb-1">
                            <div className="w-10 h-1 rounded-full bg-gray-300" />
                        </div>

                        {/* Header with close — mobile */}
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-black text-gray-700">תמחור ישיבה</span>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={onToggleDineIn}
                                    className={`w-12 h-7 rounded-full transition-all relative ${enableDineInPricing ? 'bg-amber-500' : 'bg-gray-300'}`}
                                >
                                    <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all ${enableDineInPricing ? 'right-1' : 'left-1'}`} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => toggleOpen(false)}
                                    className="sm:hidden p-1.5 text-gray-400 hover:text-gray-600"
                                >
                                    <FaTimes size={16} />
                                </button>
                            </div>
                        </div>

                        <hr className="border-gray-100" />

                        {/* Mode selector */}
                        <div>
                            <p className="text-xs font-bold text-gray-500 mb-2">סוג תוספת</p>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setMode('percent')}
                                    className={`flex-1 flex items-center justify-center gap-1.5 py-3 sm:py-2.5 rounded-xl text-xs font-black border transition-all ${mode === 'percent'
                                        ? 'bg-amber-50 text-amber-700 border-amber-300'
                                        : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                                        }`}
                                >
                                    <FaPercent size={10} />
                                    אחוז
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMode('flat')}
                                    className={`flex-1 flex items-center justify-center gap-1.5 py-3 sm:py-2.5 rounded-xl text-xs font-black border transition-all ${mode === 'flat'
                                        ? 'bg-amber-50 text-amber-700 border-amber-300'
                                        : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                                        }`}
                                >
                                    <FaShekelSign size={10} />
                                    סכום קבוע
                                </button>
                            </div>
                        </div>

                        {/* Value input */}
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                min="0"
                                step={mode === 'percent' ? '1' : '0.5'}
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                placeholder={mode === 'percent' ? 'לדוגמה: 15' : 'לדוגמה: 5'}
                                className="flex-1 px-3 py-3 sm:py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-amber-200 focus:border-amber-300 outline-none transition-all"
                            />
                            <span className="text-gray-400 font-black text-sm">
                                {mode === 'percent' ? '%' : '₪'}
                            </span>
                        </div>

                        {/* Category selector */}
                        <div>
                            <p className="text-xs font-bold text-gray-500 mb-2">לפי קטגוריה</p>
                            <select
                                value={categoryId}
                                onChange={(e) => setCategoryId(e.target.value)}
                                className="w-full px-3 py-3 sm:py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-amber-200 focus:border-amber-300 outline-none transition-all"
                            >
                                <option value="">כל התפריט</option>
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Apply button */}
                        <button
                            type="button"
                            onClick={handleApply}
                            disabled={applying || !value || parseFloat(value) <= 0}
                            className="w-full flex items-center justify-center gap-2 py-3 sm:py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
                        >
                            {applying ? <FaSpinner className="animate-spin" size={12} /> : <FaCheck size={12} />}
                            {applying ? 'מחיל...' : 'החל תמחור ישיבה'}
                        </button>

                        {/* AI + Reset row */}
                        <div className="flex gap-2">
                            <AiDineInRecommender onApplyAdjustments={onApplyAdjustments} />
                            <button
                                type="button"
                                onClick={handleReset}
                                disabled={resetting}
                                className="flex items-center gap-1.5 px-3 py-2.5 sm:py-2 rounded-xl text-xs font-bold border border-red-200 text-red-500 hover:bg-red-50 transition-all disabled:opacity-40"
                            >
                                {resetting ? <FaSpinner className="animate-spin" size={10} /> : <FaUndo size={10} />}
                                איפוס
                            </button>
                        </div>

                        {/* Result message */}
                        {result && (
                            <div className={`text-xs font-bold text-center py-2 px-3 rounded-lg ${result.type === 'success'
                                ? 'bg-green-50 text-green-700'
                                : 'bg-red-50 text-red-600'
                                }`}>
                                {result.text}
                            </div>
                        )}

                        <p className="text-[10px] text-gray-400 leading-relaxed">
                            {mode === 'percent'
                                ? 'יוסיף אחוז ממחיר כל מנה כתוספת ישיבה'
                                : 'יוסיף סכום קבוע לכל מנה כתוספת ישיבה'}
                        </p>
                    </div>
                </>
            )}
        </div>
    );
}
