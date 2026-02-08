import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FaRobot,
    FaTimes,
    FaPaperPlane,
    FaChartLine,
    FaUtensils,
    FaBullhorn,
    FaLightbulb,
    FaSpinner,
    FaGem,
    FaBell
} from 'react-icons/fa';
import { useAdminAuth } from '../../context/AdminAuthContext';
import api from '../../services/apiClient';
import AgentActionCard from './AgentActionCard';
import AgentActionModal from './AgentActionModal';

// פעולות מהירות ספציפיות למנהל מסעדה
const QUICK_ACTIONS = [
    {
        id: 'order_summary',
        label: 'סיכום הזמנות',
        icon: <FaChartLine className="text-lg" />,
        gradient: 'from-blue-500 to-cyan-600',
        message: 'תן לי סיכום של הביצועים שלי היום/שבוע/חודש'
    },
    {
        id: 'menu_suggestions',
        label: 'הצעות לתפריט',
        icon: <FaUtensils className="text-lg" />,
        gradient: 'from-emerald-500 to-green-600',
        message: 'לפי הפריטים הפופולריים שלי, מה אתה ממליץ לשפר בתפריט?'
    },
    {
        id: 'performance_insights',
        label: 'תובנות ביצועים',
        icon: <FaLightbulb className="text-lg" />,
        gradient: 'from-amber-500 to-orange-600',
        message: 'נתח את הביצועים העסקיים שלי ותן לי 3 המלצות'
    },
    {
        id: 'customer_engagement',
        label: 'משיכת לקוחות',
        icon: <FaBullhorn className="text-lg" />,
        gradient: 'from-purple-500 to-pink-600',
        message: 'איך אני יכול למשוך יותר לקוחות ולהגדיל את ההזמנות?'
    }
];

export default function FloatingRestaurantAssistant({ isSidebarOpen = false }) {
    const { getAuthHeaders } = useAdminAuth();
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [credits, setCredits] = useState(null); // { remaining, limit }
    const [executingAction, setExecutingAction] = useState(null);
    const [modalAction, setModalAction] = useState(null);
    const [alertCount, setAlertCount] = useState(0);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const alertIntervalRef = useRef(null);

    // קבלת tenant_id מ-localStorage
    const tenantId = localStorage.getItem('tenantId') || 'unknown';
    const STORAGE_KEY = `restaurant_chat_history_${tenantId}`; // ייחודי לכל מסעדה!

    // טעינת היסטוריית שיחה מ-localStorage (ספציפי למסעדה)
    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                setMessages(JSON.parse(stored));
            } catch (e) {
                console.error('Failed to parse chat history', e);
            }
        }
    }, [STORAGE_KEY]);

    // שמירת היסטוריה ל-localStorage
    useEffect(() => {
        if (messages.length > 0) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
        }
    }, [messages]);

    // גלילה אוטומטית למטה
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // טעינת קרדיטים בפתיחה
    useEffect(() => {
        if (isOpen && !credits) {
            fetchCredits();
        }
    }, [isOpen]);

    // Alert polling - every 60s when chat is open
    const fetchAlerts = useCallback(async () => {
        try {
            const response = await api.get('/admin/ai/agent/alerts', {
                headers: getAuthHeaders()
            });

            if (response.data.success && response.data.alerts) {
                const alerts = response.data.alerts;
                setAlertCount(alerts.length);

                // Inject unread alerts as system messages
                if (alerts.length > 0) {
                    const alertMessages = alerts.map(alert => ({
                        role: 'system',
                        content: `${alert.severity === 'critical' ? '🔴' : alert.severity === 'warning' ? '🟡' : '🔵'} ${alert.title}\n${alert.body}`,
                        timestamp: alert.created_at,
                        isAlert: true,
                        alertId: alert.id,
                        severity: alert.severity
                    }));

                    setMessages(prev => {
                        // Don't add duplicate alerts
                        const existingAlertIds = new Set(
                            prev.filter(m => m.alertId).map(m => m.alertId)
                        );
                        const newAlerts = alertMessages.filter(
                            a => !existingAlertIds.has(a.alertId)
                        );
                        if (newAlerts.length === 0) return prev;
                        return [...prev, ...newAlerts];
                    });

                    // Mark alerts as read
                    for (const alert of alerts) {
                        try {
                            await api.patch(
                                `/admin/ai/agent/alerts/${alert.id}/read`,
                                {},
                                { headers: getAuthHeaders() }
                            );
                        } catch (e) {
                            // Silently ignore mark-read errors
                        }
                    }
                }
            }
        } catch (error) {
            // Silently fail alert polling
        }
    }, [getAuthHeaders]);

    useEffect(() => {
        if (isOpen) {
            fetchAlerts();
            alertIntervalRef.current = setInterval(fetchAlerts, 60000);
        }
        return () => {
            if (alertIntervalRef.current) {
                clearInterval(alertIntervalRef.current);
                alertIntervalRef.current = null;
            }
        };
    }, [isOpen, fetchAlerts]);

    // Execute agent action
    const handleActionConfirm = async (action) => {
        setExecutingAction(action.action_id);

        try {
            const response = await api.post(
                '/admin/ai/agent/execute',
                {
                    action_id: action.action_id,
                    params: action.params
                },
                { headers: getAuthHeaders() }
            );

            const resultMessage = {
                role: 'system',
                content: response.data.success
                    ? `✅ הפעולה "${action.display_name}" בוצעה בהצלחה!${response.data.message ? '\n' + response.data.message : ''}`
                    : `❌ הפעולה "${action.display_name}" נכשלה: ${response.data.message || 'שגיאה לא ידועה'}`,
                timestamp: new Date().toISOString(),
                isActionResult: true,
                actionSuccess: response.data.success
            };

            setMessages(prev => [...prev, resultMessage]);
        } catch (error) {
            const errorMsg = error.response?.data?.message || error.message || 'שגיאה בביצוע הפעולה';
            const resultMessage = {
                role: 'system',
                content: `❌ שגיאה בביצוע "${action.display_name}": ${errorMsg}`,
                timestamp: new Date().toISOString(),
                isActionResult: true,
                actionSuccess: false
            };
            setMessages(prev => [...prev, resultMessage]);
        } finally {
            setExecutingAction(null);
        }
    };

    const handleActionCancel = (action) => {
        const cancelMessage = {
            role: 'system',
            content: `⏹️ הפעולה "${action.display_name}" בוטלה`,
            timestamp: new Date().toISOString(),
            isActionResult: true
        };
        setMessages(prev => [...prev, cancelMessage]);
    };

    // שליחת הודעה
    const sendMessage = async (messageText, preset = null) => {
        if (!messageText.trim() && !preset) return;

        const userMessage = {
            role: 'user',
            content: messageText,
            timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, userMessage]);
        setInputMessage('');
        setIsLoading(true);

        try {
            const response = await api.post(
                '/admin/ai/chat',
                {
                    message: messageText,
                    preset: preset
                },
                { headers: getAuthHeaders() }
            );

            if (response.data.success) {
                const aiMessage = {
                    role: 'assistant',
                    content: response.data.answer || response.data.response,
                    timestamp: new Date().toISOString(),
                    suggested_actions: response.data.suggested_actions || [],
                    proposed_actions: response.data.proposed_actions || []
                };

                setMessages(prev => [...prev, aiMessage]);

                // עדכון קרדיטים
                if (response.data.credits_remaining !== undefined) {
                    setCredits({
                        remaining: response.data.credits_remaining,
                        limit: response.data.credits_limit
                    });
                }
            } else {
                throw new Error(response.data.message || 'שגיאה בשליחת ההודעה');
            }
        } catch (error) {
            console.error('AI Chat Error:', error);
            console.error('Error response:', error.response);

            let errorMessage = 'מצטער, אירעה שגיאה. נסה שוב.';

            if (error.response?.status === 429) {
                errorMessage = error.response.data.message || 'הגעת למכסת השאילתות החודשית. שדרג למנוי Pro לקבלת 300 שאילתות.';
            } else if (error.response?.status === 401) {
                errorMessage = 'נדרשת התחברות מחדש. אנא רענן את הדף.';
            } else if (error.response?.status === 404) {
                errorMessage = 'שירות ה-AI אינו זמין כרגע. אנא נסה שוב מאוחר יותר.';
            } else if (error.response?.data?.message) {
                errorMessage = error.response.data.message;
            }

            const errorMsg = {
                role: 'assistant',
                content: errorMessage,
                timestamp: new Date().toISOString(),
                isError: true
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    // טעינת מידע על קרדיטים
    const fetchCredits = async () => {
        try {
            const response = await api.get('/admin/ai/credits', {
                headers: getAuthHeaders()
            });

            if (response.data.success) {
                setCredits({
                    remaining: response.data.credits_remaining,
                    limit: response.data.credits_limit
                });
            }
        } catch (error) {
            console.error('Failed to fetch credits:', error);
        }
    };

    const handleQuickAction = (action) => {
        sendMessage(action.message, action.id);
    };

    const clearHistory = () => {
        setMessages([]);
        localStorage.removeItem(STORAGE_KEY);
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className={`fixed bottom-24 sm:bottom-28 left-4 sm:left-8 lg:bottom-6 lg:left-6 z-30 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 group ${isSidebarOpen ? 'lg:opacity-100 opacity-0 pointer-events-none lg:pointer-events-auto' : 'opacity-100'
                    }`}
                aria-label="פתח עוזר AI"
            >
                <FaRobot className="text-2xl" />
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold animate-pulse">
                    AI
                </span>
                {alertCount > 0 && (
                    <span className="absolute -top-1 -left-1 bg-yellow-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                        {alertCount}
                    </span>
                )}
            </button>
        );
    }

    return (
        <>
            <div className={`fixed bottom-24 sm:bottom-28 left-4 sm:left-8 lg:bottom-6 lg:left-6 z-30 w-[calc(100vw-2rem)] sm:w-96 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${isSidebarOpen ? 'lg:opacity-100 opacity-0 pointer-events-none lg:pointer-events-auto' : 'opacity-100'
                }`} style={{ height: 'min(600px, 80vh)' }}>
                {/* Header */}
                <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-4 rounded-t-2xl flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <FaRobot className="text-2xl" />
                        <div>
                            <h3 className="font-bold text-lg">סוכן AI למסעדה</h3>
                            {credits && (
                                <div className="text-xs opacity-90 flex items-center gap-1">
                                    <FaGem className="text-yellow-300" />
                                    <span>{credits.remaining}/{credits.limit} שאילתות נותרו</span>
                                </div>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="hover:bg-white/20 rounded-full p-2 transition"
                    >
                        <FaTimes />
                    </button>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-gray-900">
                    {messages.length === 0 && (
                        <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                            <FaRobot className="text-5xl mx-auto mb-4 opacity-50" />
                            <p className="text-sm">שלום! אני הסוכן החכם שלך</p>
                            <p className="text-xs mt-2">אני יכול לעזור לנהל את המסעדה, לבצע שינויים, ולנתח ביצועים</p>
                        </div>
                    )}

                    {messages.map((msg, index) => (
                        <div
                            key={index}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[85%] rounded-2xl px-4 py-3 ${msg.role === 'user'
                                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                                    : msg.isError
                                        ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                                        : msg.isAlert
                                            ? `${msg.severity === 'critical'
                                                ? 'bg-red-50 dark:bg-red-900/40 border border-red-200 dark:border-red-800'
                                                : msg.severity === 'warning'
                                                    ? 'bg-yellow-50 dark:bg-yellow-900/40 border border-yellow-200 dark:border-yellow-800'
                                                    : 'bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800'
                                            } text-gray-800 dark:text-gray-200`
                                            : msg.isActionResult
                                                ? `${msg.actionSuccess
                                                    ? 'bg-green-50 dark:bg-green-900/40 border border-green-200 dark:border-green-800'
                                                    : 'bg-orange-50 dark:bg-orange-900/40 border border-orange-200 dark:border-orange-800'
                                                } text-gray-800 dark:text-gray-200`
                                                : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 shadow-md'
                                    }`}
                            >
                                {/* Alert badge */}
                                {msg.isAlert && (
                                    <div className="flex items-center gap-1 mb-1 text-xs font-semibold opacity-70">
                                        <FaBell />
                                        <span>התראה</span>
                                    </div>
                                )}

                                <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>

                                {/* Proposed Actions (Agent Cards) */}
                                {msg.proposed_actions && msg.proposed_actions.length > 0 && (
                                    <div className="mt-2 space-y-2">
                                        {msg.proposed_actions.map((action, i) => (
                                            <AgentActionCard
                                                key={`${action.action_id}-${i}`}
                                                action={action}
                                                onConfirm={handleActionConfirm}
                                                onCancel={handleActionCancel}
                                                onOpenModal={setModalAction}
                                                disabled={!!executingAction}
                                            />
                                        ))}
                                    </div>
                                )}

                                {/* Suggested Actions (Navigation) */}
                                {msg.suggested_actions && msg.suggested_actions.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
                                        {msg.suggested_actions.map((action, i) => (
                                            <button
                                                key={i}
                                                onClick={() => navigate(action.route)}
                                                className="block w-full text-right text-xs bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-2 rounded-lg hover:shadow-md transition"
                                            >
                                                {action.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-white dark:bg-gray-800 rounded-2xl px-4 py-3 shadow-md">
                                <FaSpinner className="animate-spin text-purple-600" />
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Quick Actions */}
                {messages.length === 0 && (
                    <div className="p-3 bg-white dark:bg-gray-800 border-t dark:border-gray-700 grid grid-cols-2 gap-2">
                        {QUICK_ACTIONS.map(action => (
                            <button
                                key={action.id}
                                onClick={() => handleQuickAction(action)}
                                disabled={isLoading}
                                className={`bg-gradient-to-r ${action.gradient} text-white text-xs font-medium px-3 py-2 rounded-xl hover:shadow-lg transition-all duration-200 flex items-center gap-2 disabled:opacity-50`}
                            >
                                {action.icon}
                                <span>{action.label}</span>
                            </button>
                        ))}
                    </div>
                )}

                {/* Input Area */}
                <div className="p-4 bg-white dark:bg-gray-800 border-t dark:border-gray-700 rounded-b-2xl shrink-0">
                    <div className="flex gap-2 items-center">
                        <input
                            ref={inputRef}
                            type="text"
                            value={inputMessage}
                            onChange={(e) => setInputMessage(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && !isLoading && sendMessage(inputMessage)}
                            placeholder="שאל שאלה או בקש פעולה..."
                            disabled={isLoading}
                            className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white disabled:opacity-50 text-base"
                        />
                        <button
                            onClick={() => sendMessage(inputMessage)}
                            disabled={isLoading || !inputMessage.trim()}
                            className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-3 rounded-xl hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <FaPaperPlane />
                        </button>
                    </div>

                    {messages.length > 0 && (
                        <button
                            onClick={clearHistory}
                            className="text-xs text-gray-500 hover:text-red-600 mt-2 transition"
                        >
                            נקה היסטוריה
                        </button>
                    )}
                </div>
            </div>

            {/* Agent Action Modal (for high/critical risk) */}
            {modalAction && (
                <AgentActionModal
                    action={modalAction}
                    onConfirm={handleActionConfirm}
                    onClose={() => setModalAction(null)}
                />
            )}
        </>
    );
}
