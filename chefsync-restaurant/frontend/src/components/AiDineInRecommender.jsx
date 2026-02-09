import { useState } from 'react';
import { FaChair, FaSpinner, FaCheckCircle, FaInfoCircle, FaTimes, FaCheck } from 'react-icons/fa';
import apiClient from '../services/apiClient';

/**
 * AI Dine-In Recommender Component
 *
 * כפתור להמלצת AI על התאמות מחיר לישיבה במקום
 * מציג הצעות לפי קטגוריות ופריטים ספציפיים
 */
const AiDineInRecommender = ({ onApplyAdjustments }) => {
    const [loading, setLoading] = useState(false);
    const [recommendation, setRecommendation] = useState(null);
    const [error, setError] = useState(null);
    const [showDetails, setShowDetails] = useState(false);
    const [appliedRows, setAppliedRows] = useState(new Set());

    const handleRecommend = async () => {
        setLoading(true);
        setError(null);
        setRecommendation(null);
        setShowDetails(false);
        setAppliedRows(new Set());

        try {
            const response = await apiClient.post('/admin/ai/recommend-dine-in');

            if (response.data.success) {
                setRecommendation(response.data.data);
                setShowDetails(true);
            } else {
                setError(response.data.message || 'שגיאה בקבלת המלצה');
            }
        } catch (err) {
            console.error('Dine-in recommendation error:', err);
            if (err.response?.status === 402) {
                setError(err.response?.data?.message || 'אין מספיק קרדיטים AI');
            } else if (err.response?.status === 429) {
                setError('חרגת ממגבלת השימוש. נסה שוב בעוד כמה דקות');
            } else {
                setError(err.response?.data?.message || 'לא הצלחנו לקבל המלצה');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleApplyAll = () => {
        if (recommendation && onApplyAdjustments) {
            onApplyAdjustments(recommendation.adjustments || []);
            const allIds = (recommendation.adjustments || []).map((_, i) => i);
            setAppliedRows(new Set(allIds));
        }
    };

    const handleApplyRow = (adjustment, index) => {
        if (onApplyAdjustments) {
            onApplyAdjustments([adjustment]);
            setAppliedRows(prev => new Set([...prev, index]));
        }
    };

    const getConfidenceBadge = (confidence) => {
        const level = confidence?.toLowerCase() || 'medium';
        const configs = {
            high: { className: 'bg-green-100 text-green-700 border-green-200', text: 'ביטחון גבוה' },
            medium: { className: 'bg-yellow-100 text-yellow-700 border-yellow-200', text: 'ביטחון בינוני' },
            low: { className: 'bg-gray-100 text-gray-700 border-gray-200', text: 'הערכה בלבד' },
        };
        const config = configs[level] || configs.medium;
        return (
            <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${config.className}`}>
                {config.text}
            </span>
        );
    };

    return (
        <>
            <button
                type="button"
                onClick={handleRecommend}
                disabled={loading}
                className={`
                    flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-300
                    ${loading
                        ? 'bg-amber-50 text-amber-700 border border-amber-200 cursor-wait'
                        : 'bg-white border border-gray-200 text-gray-600 hover:text-amber-600 hover:border-amber-300 hover:bg-amber-50 shadow-sm'
                    }
                `}
                title="קבל המלצת AI להתאמות מחיר ישיבה"
            >
                {loading ? (
                    <FaSpinner className="animate-spin text-amber-600" />
                ) : (
                    <FaChair className={showDetails ? 'text-amber-600' : 'text-amber-500'} />
                )}
                <span>AI תמחור ישיבה</span>
            </button>

            {/* Error toast - fixed at top */}
            {error && (
                <div className="fixed inset-x-0 top-4 z-[60] flex justify-center px-4">
                    <div className="w-full max-w-sm p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 shadow-xl">
                        <div className="flex items-start gap-2">
                            <span className="text-lg">&#9888;&#65039;</span>
                            <div className="flex-1">
                                <p className="font-semibold mb-1">{error}</p>
                                {error.includes('קרדיטים') && (
                                    <a
                                        href="/admin/paywall"
                                        className="inline-flex items-center gap-1 mt-2 text-xs text-purple-600 hover:text-purple-800 font-medium underline"
                                    >
                                        <span>שדרג לחבילת Pro</span>
                                    </a>
                                )}
                            </div>
                            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-700 p-1">
                                <FaTimes size={12} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal overlay */}
            {showDetails && recommendation && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        onClick={() => setShowDetails(false)}
                    />

                    {/* Modal card */}
                    <div className="relative w-full sm:w-[420px] sm:max-w-[90vw] max-h-[85vh] sm:max-h-[80vh] bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-amber-100 ring-1 ring-black/10 overflow-hidden flex flex-col animate-[slideUp_0.3s_ease-out]">
                        {/* Drag handle - mobile only */}
                        <div className="sm:hidden flex justify-center pt-2 pb-1 shrink-0">
                            <div className="w-10 h-1 rounded-full bg-gray-300" />
                        </div>

                        {/* Header */}
                        <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-4 flex justify-between items-center text-white shrink-0">
                            <div>
                                <h3 className="font-bold text-lg leading-tight">המלצת תמחור ישיבה</h3>
                                <p className="text-xs text-amber-100 opacity-90">תוספות מחיר מומלצות להזמנות &quot;לשבת במקום&quot;</p>
                            </div>
                            <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowDetails(false); }}
                                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                            >
                                <FaTimes />
                            </button>
                        </div>

                        {/* Confidence + General */}
                        <div className="p-4 bg-amber-50/50 border-b border-amber-100 shrink-0">
                            <div className="flex items-center justify-center gap-2 mb-2">
                                {getConfidenceBadge(recommendation.confidence)}
                            </div>
                            {recommendation.general_recommendation && (
                                <div className="bg-white rounded-lg p-3 text-sm text-gray-600 leading-relaxed border border-gray-100">
                                    <FaInfoCircle className="inline-block ml-1.5 text-amber-400" />
                                    {recommendation.general_recommendation}
                                </div>
                            )}
                        </div>

                        {/* Adjustments List */}
                        <div className="overflow-y-auto flex-1 p-4 space-y-2">
                            {(recommendation.adjustments || []).length === 0 ? (
                                <p className="text-center text-gray-500 text-sm py-4">אין המלצות ספציפיות</p>
                            ) : (
                                (recommendation.adjustments || []).map((adj, index) => (
                                    <div key={index} className={`bg-gray-50 rounded-xl p-3 border transition-all ${appliedRows.has(index) ? 'border-green-200 bg-green-50/50' : 'border-gray-100'}`}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-bold text-gray-800 text-sm">{adj.item_name || adj.category_name || 'פריט'}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-amber-600 font-black text-sm">
                                                    +{'\u20AA'}{Math.round(parseFloat(adj.recommended_dine_in_price || adj.suggested_adjustment || 0))}
                                                </span>
                                                {appliedRows.has(index) ? (
                                                    <span className="text-green-500"><FaCheck size={12} /></span>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleApplyRow(adj, index)}
                                                        className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors font-bold"
                                                    >
                                                        החל
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        {adj.reasoning && (
                                            <p className="text-xs text-gray-500 leading-relaxed">{adj.reasoning}</p>
                                        )}
                                        {adj.adjustment_percent != null && (
                                            <span className="inline-block mt-1 text-[10px] px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full">
                                                +{parseFloat(adj.adjustment_percent).toFixed(1)}%
                                            </span>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Factors */}
                        {recommendation.factors && recommendation.factors.length > 0 && (
                            <div className="px-4 pb-3 flex flex-wrap gap-1.5 shrink-0">
                                {recommendation.factors.slice(0, 4).map((factor, idx) => (
                                    <span key={idx} className="inline-flex items-center px-2 py-1 bg-amber-50 text-amber-600 text-xs rounded-md border border-amber-100">
                                        {factor}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Apply All */}
                        {(recommendation.adjustments || []).length > 0 && (
                            <div className="p-4 bg-gray-50 border-t border-gray-100 shrink-0">
                                <button
                                    type="button"
                                    onClick={handleApplyAll}
                                    className="w-full bg-gray-900 text-white py-2.5 rounded-xl font-semibold hover:bg-gray-800 transition-all shadow-sm active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                    <FaCheckCircle className="text-green-400" />
                                    החל את כל ההמלצות
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

export default AiDineInRecommender;
