import { useState, useEffect, useRef } from 'react';
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
    FaGem
} from 'react-icons/fa';
import { useAdminAuth } from '../../context/AdminAuthContext';
import api from '../../services/apiClient';

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

export default function FloatingRestaurantAssistant() {
    const { getAuthHeaders } = useAdminAuth();
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [credits, setCredits] = useState(null); // { remaining, limit }
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // קבלת tenant_id מ-localStorage
    const tenantId = localStorage.getItem('tenantId') || 'unknown';
    const STORAGE_KEY = `restaurant_chat_history_${tenantId}`; // ⚠️ ייחודי לכל מסעדה!

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
                '/admin/ai/chat', // ⚠️ שונה מסופר אדמין!
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
                    suggested_actions: response.data.suggested_actions || []
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
                className="fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-50 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 group"
                aria-label="פתח עוזר AI"
            >
                <FaRobot className="text-2xl" />
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold animate-pulse">
                    AI
                </span>
            </button>
        );
    }

    return (
        <div className="fixed bottom-4 sm:bottom-6 left-4 sm:left-6 z-50 w-[calc(100vw-2rem)] sm:w-96 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300" style={{ height: 'min(600px, 80vh)' }}>
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-4 rounded-t-2xl flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <FaRobot className="text-2xl" />
                    <div>
                        <h3 className="font-bold text-lg">עוזר AI למסעדה</h3>
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
                        <p className="text-sm">שלום! אני כאן לעזור לך לנהל את המסעדה שלך</p>
                        <p className="text-xs mt-2">בחר פעולה מהירה או שאל שאלה</p>
                    </div>
                )}

                {messages.map((msg, index) => (
                    <div
                        key={index}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.role === 'user'
                                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                                : msg.isError
                                    ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                                    : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 shadow-md'
                                }`}
                        >
                            <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>

                            {/* Suggested Actions */}
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
                        placeholder="שאל שאלה על המסעדה שלך..."
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
                        🗑️ נקה היסטוריה
                    </button>
                )}
            </div>
        </div>
    );
}
