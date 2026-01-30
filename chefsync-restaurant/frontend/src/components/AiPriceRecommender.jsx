import { useState } from 'react';
import { FaLightbulb, FaSpinner, FaCheckCircle, FaInfoCircle, FaTags, FaTimes } from 'react-icons/fa';
import apiClient from '../services/apiClient';

/**
 * AI Price Recommender Component
 * 
 * קומפוננטה שמציגה כפתור להמלצת מחיר חכמה על סמך ניתוח שוק
 * עיצוב מעודכן: נקי, קומפקטי ויוקרתי
 */
const AiPriceRecommender = ({ itemData, onPriceRecommended }) => {
    const [loading, setLoading] = useState(false);
    const [recommendation, setRecommendation] = useState(null);
    const [error, setError] = useState(null);
    const [showDetails, setShowDetails] = useState(false);

    const handleRecommend = async () => {
        // Validate required fields
        if (!itemData.name || !itemData.category_id) {
            setError('נא למלא שם מנה וקטגוריה');
            setTimeout(() => setError(null), 3000);
            return;
        }

        setLoading(true);
        setError(null);
        setRecommendation(null);
        setShowDetails(false);

        try {
            const response = await apiClient.post('/admin/ai/recommend-price', {
                name: itemData.name,
                category_id: itemData.category_id,
                category_name: itemData.category_name || '',
                description: itemData.description || '',
                price: itemData.price || null,
            });

            if (response.data.success) {
                setRecommendation(response.data.data);
                setShowDetails(true);
            } else {
                setError(response.data.message || 'שגיאה בקבלת המלצה');
            }
        } catch (err) {
            console.error('Price recommendation error:', err);
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

    const handleApplyPrice = () => {
        if (recommendation && onPriceRecommended) {
            onPriceRecommended(recommendation.recommended_price);
            setShowDetails(false);
        }
    };

    const getConfidenceBadge = (confidence) => {
        const level = confidence?.toLowerCase() || 'medium';
        let colorClass, text;

        switch (level) {
            case 'high':
                colorClass = 'bg-green-100 text-green-700 border-green-200';
                text = 'ביטחון גבוה';
                break;
            case 'medium':
                colorClass = 'bg-yellow-100 text-yellow-700 border-yellow-200';
                text = 'ביטחון בינוני';
                break;
            case 'low':
                colorClass = 'bg-gray-100 text-gray-700 border-gray-200';
                text = 'הערכה בלבד';
                break;
            default:
                colorClass = 'bg-gray-100 text-gray-600';
                text = 'לא ידוע';
        }

        return (
            <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${colorClass}`}>
                {text}
            </span>
        );
    };

    return (
        <div className="relative inline-block w-full">
            <div className="flex items-center gap-2 mt-1">
                <button
                    type="button"
                    onClick={handleRecommend}
                    disabled={loading}
                    className={`
              flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-300 w-full sm:w-auto
              ${loading
                            ? 'bg-purple-50 text-purple-700 border border-purple-200 cursor-wait'
                            : 'bg-white border border-gray-200 text-gray-600 hover:text-purple-600 hover:border-purple-300 hover:bg-purple-50 shadow-sm'
                        }
            `}
                    title="קבל המלצת מחיר חכמה"
                >
                    {loading ? (
                        <FaSpinner className="animate-spin text-purple-600" />
                    ) : (
                        <FaLightbulb className={showDetails ? 'text-purple-600' : 'text-yellow-500'} />
                    )}
                    <span className="inline">AI Pricing</span>
                </button>
            </div>

            {error && (
                <div className="absolute z-50 right-0 top-full mt-2 w-64 sm:w-72 md:w-80 shadow-xl">
                    <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">
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
                            <button
                                onClick={() => setError(null)}
                                className="text-red-400 hover:text-red-700 p-1"
                            >
                                <FaTimes size={12} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Floating Card - Responsive positioning */}
            <div className={`
          absolute z-50 right-0 top-full mt-2 
          w-[calc(100vw-2rem)] sm:w-[320px] max-w-[350px]
          transition-all duration-300 ease-out transform origin-top-right
          ${showDetails ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'}
      `}>
                {recommendation && (
                    <div className="bg-white rounded-xl shadow-2xl border border-purple-100 ring-1 ring-black/10 overflow-hidden">

                        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 flex justify-between items-center text-white">
                            <div>
                                <h3 className="font-bold text-lg leading-tight">המלצת מחיר</h3>
                                <p className="text-xs text-purple-200 opacity-90">מבוסס על שוק ומתחרים</p>
                            </div>
                            <button
                                type="button"  // Prevent form submission
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setShowDetails(false);
                                }}
                                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                            >
                                <FaTimes />
                            </button>
                        </div>

                        <div className="p-5 text-center bg-purple-50/50 border-b border-purple-100">
                            <div className="flex items-center justify-center gap-2 mb-1">
                                {getConfidenceBadge(recommendation.confidence)}
                            </div>
                            <div className="text-4xl font-extrabold text-gray-800 tracking-tight my-2">
                                ₪{recommendation.recommended_price.toFixed(2)}
                            </div>
                            <p className="text-sm text-gray-500">מחיר מומלץ לצרכן</p>
                        </div>

                        <div className="grid grid-cols-3 divide-x divide-x-reverse divide-gray-100 border-b border-gray-100">
                            <div className="p-3 text-center">
                                <span className="block text-xs text-gray-400 uppercase tracking-wider">נמוך</span>
                                <span className="font-semibold text-gray-700">₪{recommendation.market_data?.min_price || '-'}</span>
                            </div>
                            <div className="p-3 text-center">
                                <span className="block text-xs text-purple-500 font-bold uppercase tracking-wider">ממוצע</span>
                                <span className="font-semibold text-purple-700">₪{recommendation.market_data?.avg_price || '-'}</span>
                            </div>
                            <div className="p-3 text-center">
                                <span className="block text-xs text-gray-400 uppercase tracking-wider">גבוה</span>
                                <span className="font-semibold text-gray-700">₪{recommendation.market_data?.max_price || '-'}</span>
                            </div>
                        </div>

                        <div className="p-4 space-y-3">
                            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600 leading-relaxed border border-gray-100">
                                <FaInfoCircle className="inline-block ml-1.5 text-purple-400" />
                                {recommendation.reasoning}
                            </div>

                            {recommendation.factors && recommendation.factors.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {recommendation.factors.slice(0, 3).map((factor, idx) => (
                                        <span key={idx} className="inline-flex items-center px-2 py-1 bg-purple-50 text-purple-600 text-xs rounded-md border border-purple-100">
                                            <FaTags className="ml-1 opacity-50" size={10} />
                                            {factor}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3">
                            <button
                                onClick={handleApplyPrice}
                                className="flex-1 bg-gray-900 text-white py-2.5 rounded-xl font-semibold hover:bg-gray-800 transition-all shadow-sm active:scale-[0.98] flex items-center justify-center gap-2"
                            >
                                <FaCheckCircle className="text-green-400" />
                                עדכן מחיר
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AiPriceRecommender;
