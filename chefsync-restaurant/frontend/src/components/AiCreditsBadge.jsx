import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaMagic, FaChartLine, FaChevronDown } from 'react-icons/fa';
import apiClient from '../services/apiClient';

/**
 * AI Credits Badge Component
 * 
 * מציג מצב קרדיטים AI ושימוש נוכחי
 * מוצג בדשבורד Admin - כולל עיצוב קומפקטי שנפתח בלחיצה
 */
const AiCreditsBadge = ({ detailed = false }) => {
    const navigate = useNavigate();
    const [credits, setCredits] = useState(null);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        fetchCreditsData();
    }, []);

    const fetchCreditsData = async () => {
        try {
            const [creditsResponse, statsResponse] = await Promise.all([
                apiClient.get('/admin/ai/credits'),
                detailed ? apiClient.get('/admin/ai/usage-stats') : Promise.resolve(null),
            ]);

            if (creditsResponse.data.success) {
                setCredits(creditsResponse.data.data);
            }

            if (statsResponse?.data?.success) {
                setStats(statsResponse.data.data);
            }
        } catch (error) {
            console.error('Failed to fetch AI credits:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="animate-pulse bg-white border border-gray-100 rounded-2xl h-16 w-full"></div>
        );
    }

    if (!credits) {
        return null;
    }

    const percentageUsed = (credits.credits_used / credits.monthly_limit) * 100;
    const isLowCredits = percentageUsed > 80;
    const isCritical = percentageUsed > 95;

    // Tier display names
    const tierNames = {
        free: 'חינם',
        pro: 'Pro',
        enterprise: 'Enterprise',
    };

    // Color schemes based on usage
    const getThemeColor = () => {
        if (isCritical) return 'red';
        if (isLowCredits) return 'yellow';
        return 'purple';
    };

    const theme = getThemeColor();

    return (
        <div
            className={`
                bg-white rounded-2xl border transition-all duration-300 overflow-hidden
                ${isOpen ? 'shadow-md border-gray-200' : 'shadow-sm border-gray-100 hover:border-gray-300'}
            `}
        >
            {/* Header - Always visible, Click to toggle */}
            <div
                onClick={() => setIsOpen(!isOpen)}
                className="p-4 flex items-center justify-between cursor-pointer select-none bg-white relative z-10"
            >
                <div className="flex items-center gap-3">
                    <div className={`
                        p-2 rounded-xl text-white shadow-sm
                        ${theme === 'red' ? 'bg-red-500' : theme === 'yellow' ? 'bg-yellow-500' : 'bg-gradient-to-br from-purple-600 to-indigo-600'}
                    `}>
                        <FaMagic size={18} />
                    </div>

                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-gray-800">ניצולת AI</h3>
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full border border-gray-200">
                                {tierNames[credits.tier]}
                            </span>
                        </div>

                        {/* Compact Stats for Header */}
                        <div className="flex items-center gap-2 mt-1">
                            <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-500
                                        ${theme === 'red' ? 'bg-red-500' : theme === 'yellow' ? 'bg-yellow-500' : 'bg-purple-500'}
                                    `}
                                    style={{ width: `${Math.min(percentageUsed, 100)}%` }}
                                />
                            </div>
                            <span className="text-xs text-gray-500 font-medium">
                                {credits.credits_remaining} נותרו
                            </span>
                        </div>
                    </div>
                </div>

                <div className={`p-2 rounded-full hover:bg-gray-50 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-purple-600' : ''}`}>
                    <FaChevronDown size={14} />
                </div>
            </div>

            {/* Collapsible Content */}
            <div className={`
                transition-all duration-500 ease-in-out border-t border-gray-100 bg-gray-50/50
                ${isOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}
            `}>
                <div className="p-5">
                    {/* Detailed Progress */}
                    <div className="mb-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                        <div className="flex justify-between text-sm mb-2 text-gray-600">
                            <span>שימוש החודש</span>
                            <span className="font-bold">{credits.credits_used} / {credits.monthly_limit}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden shadow-inner">
                            <div
                                className={`h-full transition-all duration-700
                                    ${theme === 'red' ? 'bg-gradient-to-r from-red-500 to-red-600' :
                                        theme === 'yellow' ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
                                            'bg-gradient-to-r from-purple-500 to-indigo-500'}
                                `}
                                style={{ width: `${Math.min(percentageUsed, 100)}%` }}
                            />
                        </div>
                        <div className="text-xs text-gray-400 mt-2 flex justify-between">
                            <span>איפוס: {new Date(credits.billing_cycle_end).toLocaleDateString('he-IL')}</span>
                            <span>{Math.round(percentageUsed)}% ניצול</span>
                        </div>
                    </div>

                    {/* Alerts */}
                    {isCritical && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-700 font-medium flex items-center gap-2">
                            <span>⚠️</span> הקרדיטים עומדים להיגמר! המערכת תפסיק לספק שירותי AI בקרוב.
                        </div>
                    )}

                    {/* Advanced Stats */}
                    {detailed && stats && (
                        <div className="mt-2">
                            <div className="flex items-center gap-2 mb-3 text-gray-700 font-bold text-sm">
                                <div className="p-1 bg-blue-50 text-blue-600 rounded">
                                    <FaChartLine size={12} />
                                </div>
                                ביצועים
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-xs mb-4">
                                <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                                    <div className="text-gray-400 mb-1">בקשות</div>
                                    <div className="font-bold text-xl text-gray-800">{stats.total_requests}</div>
                                </div>
                                <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                                    <div className="text-gray-400 mb-1">דיוק</div>
                                    <div className="font-bold text-xl text-green-600">
                                        {Math.round((stats.successful_requests / stats.total_requests) * 100) || 0}%
                                    </div>
                                </div>
                                <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                                    <div className="text-gray-400 mb-1">Cache Hit</div>
                                    <div className="font-bold text-xl text-blue-600">{stats.cache_hit_rate}%</div>
                                </div>
                                <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                                    <div className="text-gray-400 mb-1">זמן תגובה</div>
                                    <div className="font-bold text-xl text-purple-600">{Math.round(stats.avg_response_time_ms)}ms</div>
                                </div>
                            </div>

                            {/* Features */}
                            {stats.by_feature && Object.keys(stats.by_feature).length > 0 && (
                                <div className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
                                    <div className="text-xs font-bold text-gray-700 mb-2">שימוש לפי פיצ'ר</div>
                                    <div className="space-y-2">
                                        {Object.entries(stats.by_feature).map(([feature, data]) => (
                                            <div key={feature} className="flex justify-between items-center text-xs">
                                                <span className="text-gray-500">
                                                    {feature === 'description_generator' ? 'תיאורי מנות' :
                                                        feature === 'dashboard_insights' ? 'תובנות עסקיות' :
                                                            feature === 'price_recommendations' ? 'המלצות מחיר' : feature}
                                                </span>
                                                <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-700 font-medium">
                                                    {data.count}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Upgrade Button */}
                    {(credits.tier === 'free' || credits.tier === 'basic') && (
                        <div className="mt-4">
                            <button
                                onClick={() => navigate('/admin/paywall')}
                                className="w-full bg-gradient-to-r from-gray-900 to-gray-800 text-white
                                py-2.5 rounded-xl text-sm font-semibold hover:shadow-lg transform active:scale-[0.98] transition-all"
                            >
                                שדרג ל-Pro לקבלת יותר קרדיטים ✨
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AiCreditsBadge;
