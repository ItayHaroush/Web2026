import { useState, useEffect, useRef } from 'react';
import {
    FaRobot,
    FaTimes,
    FaPaperPlane,
    FaLightbulb,
    FaBed,
    FaRocket,
    FaSms,
    FaSpinner
} from 'react-icons/fa';
import { useAdminAuth } from '../../context/AdminAuthContext';
import api from '../../services/apiClient';

const QUICK_ACTIONS = [
    {
        id: 'daily_insights',
        label: 'תובנות היום',
        icon: <FaLightbulb className="text-lg" />,
        gradient: 'from-amber-500 to-orange-600',
        message: 'תן לי תובנות על ביצועי המערכת היום'
    },
    {
        id: 'dormant_restaurants',
        label: 'מי נרדם?',
        icon: <FaBed className="text-lg" />,
        gradient: 'from-blue-500 to-indigo-600',
        message: 'אילו מסעדות לא קיבלו הזמנות לאחרונה?'
    },
    {
        id: 'pilot_candidates',
        label: 'מועמדים לפיילוט',
        icon: <FaRocket className="text-lg" />,
        gradient: 'from-emerald-500 to-teal-600',
        message: 'מי מועמד טוב לשדרוג למנוי פרו?'
    },
    {
        id: 'sms_draft',
        label: 'טיוטת SMS',
        icon: <FaSms className="text-lg" />,
        gradient: 'from-purple-500 to-pink-600',
        message: 'כתוב טיוטת הודעה למסעדנים'
    }
];

const STORAGE_KEY = 'super_admin_chat_history';

export default function FloatingAiAssistant() {
    const { getAuthHeaders } = useAdminAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    console.log('FloatingAiAssistant rendered');

    // טען היסטוריה מ-localStorage
    useEffect(() => {
        console.log('FloatingAiAssistant mounted');
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                setMessages(parsed);
            }
        } catch (error) {
            console.error('Failed to load chat history:', error);
        }
    }, []);

    // שמור היסטוריה ב-localStorage
    useEffect(() => {
        if (messages.length > 0) {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-20))); // שמור רק 20 אחרונות
            } catch (error) {
                console.error('Failed to save chat history:', error);
            }
        }
    }, [messages]);

    // גלילה אוטומטית למטה
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
        }
    }, [messages, isOpen]);

    // שליחת הודעה
    const sendMessage = async (message, preset = null) => {
        if (!message.trim() && !preset) return;

        const userMessage = {
            id: Date.now(),
            type: 'user',
            content: message,
            timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, userMessage]);
        setInputMessage('');
        setIsLoading(true);

        try {
            const response = await api.post(
                '/super-admin/ai/chat',
                {
                    message: message,
                    preset: preset,
                    context: {
                        page: 'dashboard'
                    }
                },
                { headers: getAuthHeaders() }
            );

            const aiMessage = {
                id: Date.now() + 1,
                type: 'ai',
                content: response.data.answer,
                actions: response.data.actions || [],
                meta: response.data.meta,
                timestamp: new Date().toISOString()
            };

            setMessages(prev => [...prev, aiMessage]);
        } catch (error) {
            console.error('Chat error:', error);
            const errorMessage = {
                id: Date.now() + 1,
                type: 'error',
                content: error.response?.data?.message || 'שגיאה בתקשורת עם העוזר AI',
                timestamp: new Date().toISOString()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    // טיפול ב-Quick Action
    const handleQuickAction = (action) => {
        sendMessage(action.message, action.id);
    };

    // טיפול בפעולות מוצעות מ-AI
    const handleAiAction = (action) => {
        if (action.type === 'preset') {
            const preset = QUICK_ACTIONS.find(a => a.id === action.value);
            if (preset) {
                // If action has a specific message, use it. Otherwise use preset default.
                if (action.message) {
                    sendMessage(action.message, preset.id);
                } else {
                    handleQuickAction(preset);
                }
            }
        } else if (action.type === 'regenerate') {
            const lastUserMessage = [...messages].reverse().find(m => m.type === 'user');
            if (lastUserMessage) {
                sendMessage(lastUserMessage.content, 'sms_draft');
            }
        }
    };

    // ניקוי היסטוריה
    const clearHistory = () => {
        setMessages([]);
        localStorage.removeItem(STORAGE_KEY);
    };

    return (
        <>
            {/* כפתור צף */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`fixed bottom-4 left-4 sm:bottom-8 sm:left-8 w-14 h-14 sm:w-16 sm:h-16 rounded-full shadow-2xl flex items-center justify-center text-white transition-all duration-300 z-50 ${isOpen
                    ? 'bg-gray-600 hover:bg-gray-700 scale-90'
                    : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:scale-110 hover:shadow-purple-500/50'
                    }`}
            >
                {isOpen ? <FaTimes size={20} /> : <FaRobot size={24} />}
            </button>

            {/* חלון צ'אט */}
            {isOpen && (
                <div className="fixed bottom-20 sm:bottom-28 left-4 sm:left-8 w-[calc(100vw-2rem)] sm:w-96 bg-white rounded-3xl shadow-2xl flex flex-col z-50 animate-in fade-in zoom-in-95 duration-300 overflow-hidden" style={{ height: 'min(600px, 75vh)' }}>
                    {/* Header */}
                    <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-5 sm:p-6 rounded-t-3xl shrink-0">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                                    <FaRobot size={20} />
                                </div>
                                <div>
                                    <h3 className="font-black text-lg">עוזר AI</h3>
                                    <p className="text-xs text-purple-100">סופר אדמין • מערכת ChefSync</p>
                                </div>
                            </div>
                            {messages.length > 0 && (
                                <button
                                    onClick={clearHistory}
                                    className="text-xs text-purple-100 hover:text-white underline"
                                >
                                    נקה
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Quick Actions */}
                    {messages.length === 0 && (
                        <div className="p-4 border-b border-gray-100">
                            <p className="text-xs text-gray-500 font-bold mb-3">פעולות מהירות:</p>
                            <div className="grid grid-cols-2 gap-2">
                                {QUICK_ACTIONS.map(action => (
                                    <button
                                        key={action.id}
                                        onClick={() => handleQuickAction(action)}
                                        disabled={isLoading}
                                        className={`p-3 rounded-xl bg-gradient-to-r ${action.gradient} text-white font-bold text-xs flex flex-col items-center gap-2 hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
                                    >
                                        {action.icon}
                                        <span className="text-center">{action.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {messages.length === 0 && (
                            <div className="text-center py-12">
                                <FaRobot size={48} className="mx-auto text-purple-200 mb-4" />
                                <p className="text-gray-400 font-medium text-sm">
                                    שלום! אני עוזר AI שלך 👋
                                </p>
                                <p className="text-gray-300 text-xs mt-2">
                                    בחר פעולה מהירה או שאל שאלה
                                </p>
                            </div>
                        )}

                        {messages.map(msg => (
                            <div
                                key={msg.id}
                                className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[85%] rounded-2xl p-3 ${msg.type === 'user'
                                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white'
                                        : msg.type === 'error'
                                            ? 'bg-red-50 text-red-700 border border-red-200'
                                            : 'bg-gray-100 text-gray-900'
                                        }`}
                                >
                                    <p className="text-sm font-medium whitespace-pre-wrap">{msg.content}</p>

                                    {/* כפתורי פעולה מוצעים */}
                                    {msg.actions && msg.actions.length > 0 && (
                                        <div className="mt-3 space-y-2">
                                            {msg.actions.map((action, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => handleAiAction(action)}
                                                    className="w-full text-left px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold transition-all"
                                                >
                                                    {action.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Meta info */}
                                    {msg.meta && (
                                        <div className="mt-2 text-[10px] opacity-60">
                                            {msg.meta.response_time_ms && `⏱️ ${msg.meta.response_time_ms}ms`}
                                            {msg.meta.credits_used > 0 && ` • 💎 ${msg.meta.credits_used} credits`}
                                            {msg.meta.bypass_reason && ` • ✨ ${msg.meta.bypass_reason}`}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-gray-100 rounded-2xl p-3 flex items-center gap-2">
                                    <FaSpinner className="animate-spin text-purple-600" />
                                    <span className="text-sm text-gray-600 font-medium">מחשב תשובה...</span>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="p-4 border-t border-gray-100 shrink-0">
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                sendMessage(inputMessage);
                            }}
                            className="flex gap-2"
                        >
                            <input
                                type="text"
                                value={inputMessage}
                                onChange={(e) => setInputMessage(e.target.value)}
                                disabled={isLoading}
                                placeholder="שאל שאלה..."
                                className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none text-base font-medium disabled:bg-gray-50 disabled:cursor-not-allowed"
                            />
                            <button
                                type="submit"
                                disabled={isLoading || !inputMessage.trim()}
                                className="w-12 h-12 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl flex items-center justify-center hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
                            >
                                <FaPaperPlane />
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
