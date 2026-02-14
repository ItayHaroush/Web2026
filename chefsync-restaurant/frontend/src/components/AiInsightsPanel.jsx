import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaChartLine, FaStar, FaClock, FaLightbulb, FaExclamationTriangle, FaSync, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import apiClient from '../services/apiClient';
import { useRestaurantStatus } from '../context/RestaurantStatusContext';

const AiInsightsPanel = () => {
    const navigate = useNavigate();
    const { subscriptionInfo } = useRestaurantStatus();
    const isBasic = subscriptionInfo?.tier === 'basic';
    const [insights, setInsights] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [cached, setCached] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const hasFetchedRef = useRef(false);

    const fetchInsights = async (force = false) => {
        try {
            setLoading(true);
            setError(null);

            const { data } = await apiClient.get('/admin/ai/dashboard-insights', {
                params: {
                    ...(force ? { force_regenerate: '1' } : {}),
                    _t: Date.now() // Prevent browser caching
                }
            });

            if (data.success) {
                // Handle graceful degradation where backend sends success:true but includes inner error
                if (data.data?.error) {
                    setError(data.data.error);
                    setInsights(null);
                } else {
                    setInsights(data.data);
                    setCached(data.cached || false);
                }
            } else {
                setError(data.message || 'שגיאה בטעינת תובנות');
            }
        } catch (err) {
            console.error('Failed to fetch AI insights:', err);
            setError('לא ניתן לטעון תובנות כרגע');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // ✅ LAZY LOAD: Only fetch when panel is opened
        if (!isOpen) return;
        if (hasFetchedRef.current) return;

        hasFetchedRef.current = true;
        fetchInsights();
    }, [isOpen]);

    const toggleOpen = () => setIsOpen(!isOpen);

    const { sales_trend, top_performers, peak_times, recommendations, alert } = insights || {};

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-purple-100 overflow-hidden transition-all duration-300">
            {/* Header / Toggle Area */}
            <div
                onClick={toggleOpen}
                className={`
                    p-4 flex items-center justify-between cursor-pointer 
                    bg-gradient-to-r from-purple-50 to-white hover:from-purple-100 transition-colors
                    ${isOpen ? 'border-b border-purple-100' : ''}
                `}
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl shadow-sm text-white">
                        <FaChartLine size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-800">תובנות עסקיות (AI)</h3>
                        <p className="text-xs text-gray-500 flex items-center gap-2">
                            {loading ? (
                                <span className="flex items-center gap-1 text-purple-600">
                                    <FaSync className="animate-spin" size={10} /> טוען נתונים...
                                </span>
                            ) : error ? (
                                <span className="text-red-500">שגיאה בטעינה</span>
                            ) : (
                                <span>{cached ? 'עיבוד מארכיון' : 'עיבוד בזמן אמת'} • Copilot Intelligence</span>
                            )}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Refresh Button - Only visible when open or hovered? Let's keep it visible but subtle */}
                    {!loading && !error && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                fetchInsights(true);
                            }}
                            className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-full transition-all"
                            title="רענן ניתוח"
                        >
                            <FaSync size={14} />
                        </button>
                    )}

                    <div className={`
                        p-1 text-gray-400 transition-transform duration-300
                        ${isOpen ? 'rotate-180 text-purple-600' : ''}
                    `}>
                        <FaChevronDown size={16} />
                    </div>
                </div>
            </div>

            {/* Content Area - Collapsible */}
            <div className={`
                transition-all duration-500 ease-in-out
                ${isOpen ? 'max-h-[600px] opacity-100 overflow-y-auto' : 'max-h-0 opacity-0 overflow-hidden'}
            `}>
                <div className="p-6 bg-gradient-to-b from-white to-purple-50/30">

                    {loading ? (
                        <div className="space-y-4 animate-pulse">
                            <div className="h-20 bg-gray-100 rounded-xl"></div>
                            <div className="h-20 bg-gray-100 rounded-xl"></div>
                            <div className="h-20 bg-gray-100 rounded-xl"></div>
                        </div>
                    ) : error ? (
                        <div className="text-center py-8">
                            <div className="inline-flex p-3 bg-red-50 rounded-full mb-3 text-red-500">
                                <FaExclamationTriangle size={24} />
                            </div>
                            <p className="text-gray-600 mb-4">{error}</p>
                            <button
                                onClick={fetchInsights}
                                className="px-5 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 font-medium text-sm"
                            >
                                נסה שוב
                            </button>
                        </div>
                    ) : insights && (
                        <>
                            {/* Alert Section */}
                            {alert && (
                                <div className="mb-6 p-4 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-4 shadow-sm">
                                    <div className="p-2 bg-amber-100 rounded-lg text-amber-600 shrink-0">
                                        <FaExclamationTriangle size={18} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-amber-800 text-sm mb-1">שים לב</h4>
                                        <p className="text-amber-700 text-sm leading-relaxed">{alert}</p>
                                    </div>
                                </div>
                            )}

                            {/* Main Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                {/* Sales Trend */}
                                <div className="p-5 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                                            <FaChartLine size={14} />
                                        </div>
                                        <h4 className="font-bold text-gray-800 text-sm">מגמת מכירות</h4>
                                    </div>
                                    <p className="text-gray-600 text-sm leading-relaxed">{sales_trend}</p>
                                </div>

                                {/* Top Performers */}
                                <div className="p-5 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="p-1.5 bg-yellow-50 text-yellow-600 rounded-lg">
                                            <FaStar size={14} />
                                        </div>
                                        <h4 className="font-bold text-gray-800 text-sm">כוכבי התפריט</h4>
                                    </div>
                                    <p className="text-gray-600 text-sm leading-relaxed">{top_performers}</p>
                                </div>

                                {/* Peak Times - Full Width */}
                                <div className="p-5 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow md:col-span-2">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="p-1.5 bg-green-50 text-green-600 rounded-lg">
                                            <FaClock size={14} />
                                        </div>
                                        <h4 className="font-bold text-gray-800 text-sm">זמני עומס</h4>
                                    </div>
                                    <p className="text-gray-600 text-sm leading-relaxed">{peak_times}</p>
                                </div>
                            </div>

                            {/* Recommendations */}
                            {recommendations && recommendations.length > 0 && (
                                <div className="mt-6">
                                    <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                                        <FaLightbulb className="text-purple-500" />
                                        המלצות לביצוע
                                    </h4>
                                    <div className="grid gap-3">
                                        {recommendations.map((rec, index) => (
                                            <div key={index} className="flex items-start gap-4 p-4 bg-white rounded-xl border border-purple-100 hover:border-purple-300 transition-colors">
                                                <div className="mt-1 flex-shrink-0 w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-xs font-bold">
                                                    {index + 1}
                                                </div>
                                                <p className="text-gray-700 text-sm leading-relaxed">{rec}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Upgrade prompt for basic tier */}
                            {isBasic && (
                                <div className="mt-6 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <FaStar className="text-amber-500 shrink-0" size={16} />
                                        <p className="text-sm font-bold text-gray-700">שדרג ל-Pro וקבל תובנות AI מתקדמות יותר וקרדיטים נוספים</p>
                                    </div>
                                    <button
                                        onClick={() => navigate('/admin/paywall')}
                                        className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl font-black text-xs transition-all whitespace-nowrap shrink-0"
                                    >
                                        שדרג
                                    </button>
                                </div>
                            )}

                            {/* Footer */}
                            <div className="mt-8 text-center text-xs text-gray-400">
                                נוצר באמצעות מודל AI • מתעדכן כל 24 שעות
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AiInsightsPanel;
