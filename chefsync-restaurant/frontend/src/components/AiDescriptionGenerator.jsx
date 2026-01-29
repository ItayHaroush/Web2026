import { useState } from 'react';
import { FaMagic, FaRedo, FaCheck, FaTimes, FaEdit } from 'react-icons/fa';
import apiClient from '../services/apiClient';

/**
 * AI Description Generator Component
 * 
 * מחולל תיאורים חכם
 * עיצוב מעודכן: כפתור יוקרתי, אנימציות, ותצוגת תוצאה נקייה
 */
const AiDescriptionGenerator = ({ menuItem, onDescriptionGenerated }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [generatedDescription, setGeneratedDescription] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [tempDescription, setTempDescription] = useState('');

    const handleGenerate = async (isRegenerate = false) => {
        setLoading(true);
        setError(null);
        // Reset previous state on new generation
        if (!isRegenerate) {
            setGeneratedDescription(null);
            setIsEditing(false);
        }

        try {
            const response = await apiClient.post('/admin/ai/generate-description', {
                name: menuItem.name,
                price: menuItem.price,
                category: menuItem.category_name || '',
                allergens: menuItem.allergens || [],
                is_vegetarian: menuItem.is_vegetarian || false,
                is_vegan: menuItem.is_vegan || false,
                force_regenerate: isRegenerate,
            });

            if (response.data.success) {
                const description = response.data.data.description;
                setGeneratedDescription(description);
                setTempDescription(description);
            } else {
                setError(response.data.message || 'שגיאה ביצירת תיאור');
            }
        } catch (err) {
            console.error('AI Description Generation Error:', err);
            if (err.response?.status === 402) {
                setError(err.response?.data?.message || 'אין מספיק קרדיטים AI');
            } else if (err.response?.status === 429) {
                setError('חרגת ממגבלת השימוש. נסה שוב בעוד כמה דקות');
            } else {
                setError(err.response?.data?.message || 'שגיאה ביצירת תיאור');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleApply = () => {
        if (onDescriptionGenerated) {
            onDescriptionGenerated(isEditing ? tempDescription : generatedDescription);
        }
        // Clear internal state after applying to let "success" state show or just close
        setGeneratedDescription(null);
        setIsEditing(false);
    };

    const canGenerate = menuItem.name && menuItem.price;

    return (
        <div className="w-full">
            {/* Main Trigger Button */}
            {!generatedDescription && !loading && (
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => handleGenerate(false)}
                        disabled={!canGenerate}
                        className={`
                            group flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300
                            ${!canGenerate
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-white border border-purple-200 text-purple-700 hover:bg-purple-50 hover:shadow-md hover:border-purple-300 active:scale-95'
                            }
                        `}
                    >
                        <div className={`
                            p-1.5 rounded-lg text-white transition-all duration-300
                            ${!canGenerate ? 'bg-gray-300' : 'bg-gradient-to-br from-purple-500 to-indigo-600 group-hover:rotate-12'}
                        `}>
                            <FaMagic size={12} />
                        </div>
                        <span>צור תיאור חכם</span>
                    </button>
                    {!canGenerate && <span className="text-xs text-gray-400">נדרש שם ומחיר</span>}
                </div>
            )}

            {/* Loading State */}
            {loading && (
                <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-xl border border-purple-100 animate-pulse">
                    <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-purple-700 text-sm font-medium">יוצר תיאור...</span>
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="mt-2 p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">
                    <div className="flex items-start gap-2">
                        <span className="text-lg">⚠️</span>
                        <div className="flex-1">
                            <p className="font-semibold mb-1">{error}</p>
                            {error.includes('קרדיטים') && (
                                <a
                                    href="/admin/paywall"
                                    className="inline-flex items-center gap-1 mt-2 text-xs text-purple-600 hover:text-purple-800 font-medium underline"
                                >
                                    <span>שדרג לחבילת Pro</span>
                                    <span>→</span>
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Result Area - Collapsible */}
            <div className={`
                transition-all duration-500 ease-in-out overflow-hidden
                ${generatedDescription ? 'max-h-[500px] opacity-100 mt-3' : 'max-h-0 opacity-0'}
            `}>
                {generatedDescription && (
                    <div className="bg-white rounded-xl border border-purple-100 shadow-sm overflow-hidden ring-1 ring-purple-50">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-3 flex justify-between items-center text-white">
                            <div className="flex items-center gap-2">
                                <FaMagic className="text-purple-200" />
                                <span className="text-sm font-bold">הצעה מה-AI</span>
                            </div>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => setIsEditing(!isEditing)}
                                    className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                                    title="ערוך לפני שמירה"
                                >
                                    <FaEdit size={14} />
                                </button>
                                <button
                                    onClick={() => handleGenerate(true)}
                                    className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                                    title="נסה שוב"
                                >
                                    <FaRedo size={14} />
                                </button>
                                <button
                                    onClick={() => setGeneratedDescription(null)}
                                    className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                                    title="סגור"
                                >
                                    <FaTimes size={14} />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-4">
                            {isEditing ? (
                                <textarea
                                    value={tempDescription}
                                    onChange={(e) => setTempDescription(e.target.value)}
                                    className="w-full h-24 p-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none bg-gray-50"
                                />
                            ) : (
                                <p className="text-sm text-gray-700 leading-relaxed">
                                    {tempDescription}
                                </p>
                            )}
                        </div>

                        {/* Footer Actions */}
                        <div className="p-3 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
                            <button
                                onClick={handleApply}
                                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg text-sm font-medium hover:shadow-lg active:scale-95 transition-all"
                            >
                                <FaCheck size={12} />
                                <span>השתמש בתיאור זה</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AiDescriptionGenerator;
