import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaChartLine, FaStar, FaClock, FaLightbulb, FaExclamationTriangle, FaSync, FaChevronDown, FaChevronUp, FaCheckCircle, FaInfoCircle, FaBolt } from 'react-icons/fa';
import apiClient from '../services/apiClient';
import { useRestaurantStatus } from '../context/RestaurantStatusContext';
import { isFeatureUnlocked } from '../utils/tierUtils';
import UpgradeBanner from './UpgradeBanner';

const PRIORITY_COLORS = {
    critical: 'border-red-300 bg-red-50',
    high: 'border-amber-300 bg-amber-50',
    medium: 'border-blue-200 bg-blue-50',
    low: 'border-green-200 bg-green-50',
};

const TYPE_ICONS = {
    success: <FaCheckCircle className="text-green-500" />,
    warning: <FaExclamationTriangle className="text-amber-500" />,
    alert: <FaExclamationTriangle className="text-red-500" />,
    info: <FaInfoCircle className="text-blue-500" />,
};

const AiInsightsPanel = () => {
    const navigate = useNavigate();
    const { subscriptionInfo } = useRestaurantStatus();
    const isLocked = !isFeatureUnlocked(subscriptionInfo?.features, 'ai_insights');
    const [insights, setInsights] = useState(null);
    const [smartInsights, setSmartInsights] = useState(null);
    const [loading, setLoading] = useState(true);
    const [smartLoading, setSmartLoading] = useState(true);
    const [error, setError] = useState(null);
    const [cached, setCached] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const hasFetchedRef = useRef(false);

    const fetchSmartInsights = async (force = false) => {
        try {
            setSmartLoading(true);
            const { data } = await apiClient.get('/admin/ai/smart-insights', {
                params: { ...(force ? { force_regenerate: '1' } : {}), _t: Date.now() }
            });
            if (data.success && data.data?.insights) {
                setSmartInsights(data.data);
            }
        } catch (err) {
            console.error('Failed to fetch smart insights:', err);
        } finally {
            setSmartLoading(false);
        }
    };

    const fetchInsights = async (force = false) => {
        try {
            setLoading(true);
            setError(null);

            const { data } = await apiClient.get('/admin/ai/dashboard-insights', {
                params: {
                    ...(force ? { force_regenerate: '1' } : {}),
                    _t: Date.now()
                }
            });

            if (data.success) {
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
        if (!isOpen) return;
        if (hasFetchedRef.current) return;

        hasFetchedRef.current = true;
        fetchSmartInsights();
        fetchInsights();
    }, [isOpen]);

    const toggleOpen = () => setIsOpen(!isOpen);

    const { sales_trend, top_performers, peak_times, recommendations, alert } = insights || {};
    const smartList = smartInsights?.insights || [];

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
                    {/* Refresh Button */}
                    {!loading && !error && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                fetchInsights(true);
                                fetchSmartInsights(true);
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
                                onClick={() => { fetchInsights(); fetchSmartInsights(); }}
                                className="px-5 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 font-medium text-sm"
                            >
                                נסה שוב
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Smart Insights - Data Driven */}
                            {smartList.length > 0 && (
                                <div className="mb-6">
                                    <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                                        <FaBolt className="text-amber-500" />
                                        תובנות יומיות
                                    </h4>
                                    <div className="space-y-3">
                                        {smartList.map((insight, idx) => (
                                            <div key={idx} className={`p-4 rounded-xl border-r-4 ${PRIORITY_COLORS[insight.priority] || 'border-gray-200 bg-gray-50'}`}>
                                                <div className="flex items-start gap-3">
                                                    <div className="mt-0.5 shrink-0">
                                                        {TYPE_ICONS[insight.type] || TYPE_ICONS.info}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-gray-800 text-sm font-medium leading-relaxed">{insight.text}</p>
                                                        {insight.action && (
                                                            <p className="text-gray-500 text-xs mt-2 flex items-start gap-1.5">
                                                                <FaLightbulb className="text-amber-400 shrink-0 mt-0.5" size={12} />
                                                                <span>{insight.action}</span>
                                                            </p>
                                                        )}
                                                        {insight.cta && (
                                                            <button
                                                                onClick={() => navigate(insight.cta.link)}
                                                                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors shadow-sm"
                                                            >
                                                                <FaBolt size={10} />
                                                                {insight.cta.label}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {smartLoading && smartList.length === 0 && (
                                <div className="mb-6 space-y-3 animate-pulse">
                                    <div className="h-16 bg-gray-100 rounded-xl"></div>
                                    <div className="h-16 bg-gray-100 rounded-xl"></div>
                                </div>
                            )}

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

                            {/* Upgrade prompt */}
                            {isLocked && (
                                <div className="mt-6">
                                    <UpgradeBanner requiredTier="pro" context="ai" feature="ai_insights" />
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
