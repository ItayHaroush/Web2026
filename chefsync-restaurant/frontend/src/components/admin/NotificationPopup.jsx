import { useEffect, useRef, useState, useCallback } from 'react';
import { FaBell, FaTimes, FaCheck, FaCheckDouble, FaInfoCircle, FaExclamationTriangle, FaClipboardList } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import api from '../../services/apiClient';

const SEVERITY_STYLES = {
    info: { bg: 'bg-blue-50', border: 'border-blue-200', icon: <FaInfoCircle className="text-blue-500" size={14} /> },
    warning: { bg: 'bg-amber-50', border: 'border-amber-200', icon: <FaExclamationTriangle className="text-amber-500" size={14} /> },
    critical: { bg: 'bg-red-50', border: 'border-red-200', icon: <FaExclamationTriangle className="text-red-500" size={14} /> },
};

export default function NotificationPopup({ notificationCount = 0 }) {
    const [open, setOpen] = useState(false);
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(false);
    const ref = useRef(null);
    const navigate = useNavigate();

    const fetchAlerts = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get('/admin/ai/agent/alerts');
            if (res.data?.success) {
                setAlerts(res.data.alerts || []);
            }
        } catch {
            // silent — don't let API errors affect page
        } finally {
            setLoading(false);
        }
    }, []);

    // Close on click outside
    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        if (open) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const handleToggle = () => {
        if (!open) fetchAlerts();
        setOpen(!open);
    };

    const markRead = async (id) => {
        try {
            await api.patch(`/admin/ai/agent/alerts/${id}/read`);
            setAlerts((prev) => prev.filter((a) => a.id !== id));
        } catch {
            // silent
        }
    };

    const markAllRead = async () => {
        await Promise.all(alerts.map((a) => api.patch(`/admin/ai/agent/alerts/${a.id}/read`)));
        setAlerts([]);
    };

    // Bell shows active orders badge (preserving original behavior)
    const hasActiveOrders = notificationCount > 0;

    return (
        <div className="relative" ref={ref}>
            {/* Bell button — badge shows active orders count (same as original) */}
            <button
                type="button"
                onClick={handleToggle}
                className={`p-2 transition-colors relative ${hasActiveOrders ? 'text-orange-600 animate-pulse-slow' : 'text-gray-400 hover:text-orange-600'}`}
                title={hasActiveOrders ? `${notificationCount} הזמנות פעילות` : 'אין התראות חדשות'}
            >
                <FaBell size={20} />
                {hasActiveOrders && (
                    <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-white flex items-center justify-center">
                        {notificationCount > 9 ? '9+' : notificationCount}
                    </span>
                )}
            </button>

            {/* Dropdown panel */}
            {open && (
                <div className="absolute left-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
                    {/* Orders shortcut */}
                    {hasActiveOrders && (
                        <button
                            type="button"
                            onClick={() => { setOpen(false); navigate('/admin/orders'); }}
                            className="w-full flex items-center gap-3 px-4 py-3 bg-orange-50 hover:bg-orange-100 border-b border-orange-100 transition-colors text-right"
                        >
                            <FaClipboardList className="text-orange-500" size={16} />
                            <div className="flex-1">
                                <p className="text-sm font-bold text-orange-800">{notificationCount} הזמנות פתוחות</p>
                                <p className="text-[10px] text-orange-500">לחץ למעבר לדף הזמנות</p>
                            </div>
                        </button>
                    )}

                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                        <h3 className="text-sm font-black text-gray-800">התראות מערכת</h3>
                        <div className="flex items-center gap-2">
                            {alerts.length > 0 && (
                                <button onClick={markAllRead} className="text-[10px] font-bold text-brand-primary hover:underline flex items-center gap-1">
                                    <FaCheckDouble size={10} /> סמן הכל כנקרא
                                </button>
                            )}
                            <button onClick={() => setOpen(false)} className="p-1 text-gray-400 hover:text-gray-600">
                                <FaTimes size={12} />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="max-h-80 overflow-y-auto">
                        {loading && alerts.length === 0 ? (
                            <div className="p-8 text-center text-gray-400">
                                <div className="w-6 h-6 border-2 border-brand-primary/20 border-t-brand-primary rounded-full animate-spin mx-auto mb-2" />
                                <p className="text-xs font-bold">טוען...</p>
                            </div>
                        ) : alerts.length === 0 ? (
                            <div className="p-8 text-center text-gray-300">
                                <FaBell size={28} className="mx-auto mb-2 opacity-30" />
                                <p className="text-xs font-bold">אין התראות חדשות</p>
                            </div>
                        ) : (
                            alerts.map((alert) => {
                                const style = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.info;
                                return (
                                    <div key={alert.id} className={`flex items-start gap-3 px-4 py-3 border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${style.bg}`}>
                                        <div className="mt-0.5">{style.icon}</div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-gray-900 leading-snug">{alert.title}</p>
                                            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{alert.body}</p>
                                            <p className="text-[10px] text-gray-400 mt-1">
                                                {new Date(alert.created_at).toLocaleString('he-IL')}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => markRead(alert.id)}
                                            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                            title="סמן כנקרא"
                                        >
                                            <FaCheck size={12} />
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
