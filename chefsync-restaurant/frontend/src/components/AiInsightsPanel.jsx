import { useState, useEffect, useRef } from 'react';
import { FaChartLine, FaStar, FaClock, FaLightbulb, FaExclamationTriangle, FaSync, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import apiClient from '../services/apiClient';

const AiInsightsPanel = () => {
    const [insights, setInsights] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [cached, setCached] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const hasFetchedRef = useRef(false);
    const abortControllerRef = useRef(null);

    const fetchInsights = async (signal) => {
        try {
            setLoading(true);
            setError(null);

            const { data } = await apiClient.get('/admin/ai/dashboard-insights', {
                signal // Pass abort signal to axios
            });

            if (data.success) {
                // Handle graceful degradation where backend sends success:true but includes inner error
                if (data.data?.error) {
                    setError(data.data.error);
                    setInsights(null);
                } else {
                    setInsights(data.data.insights);
                    setCached(data.cached || false);
                }
            } else {
                setError(data.message || 'שגיאה בטעינת תובנות');
            }
        } catch (err) {
            // Ignore abort errors
            if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
                console.log('Insights request canceled');
                return;
            }
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

        // Create abort controller for this request
        abortControllerRef.current = new AbortController();
        fetchInsights(abortControllerRef.current.signal);

        // Cleanup: abort request if component unmounts or panel closes
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [isOpen]);

    const toggleOpen = () => setIsOpen(!isOpen);

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
                                fetchInsights();
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
                transition-all duration-500 ease-in-out overflow-hidden
                ${isOpen ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}
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
                        <div className="p-5 bg-white rounded-2xl border border-gray-100 shadow-sm">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-xl">
                                    <FaLightbulb className="text-purple-600" size={20} />
                                </div>
                                <h4 className="font-bold text-gray-800">ניתוח עסקי מבוסס AI</h4>
                            </div>
                            <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
                                {insights}
                            </div>
                            <div className="mt-6 pt-4 border-t border-gray-100 text-center text-xs text-gray-400">
                                נוצר באמצעות OpenAI • {cached ? 'עיבוד מארכיון' : 'עיבוד בזמן אמת'}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AiInsightsPanel;
