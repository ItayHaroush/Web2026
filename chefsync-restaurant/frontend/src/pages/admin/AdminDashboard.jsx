import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';
import AdminLayout from '../../layouts/AdminLayout';
import api from '../../services/apiClient';
import { clearStoredFcmToken, disableFcm, getStoredFcmToken, requestFcmToken } from '../../services/fcm';
import AiCreditsBadge from '../../components/AiCreditsBadge';
import AiInsightsPanel from '../../components/AiInsightsPanel';
import UpgradeBanner from '../../components/UpgradeBanner';
import {
    FaBox,
    FaClock,
    FaWallet,
    FaChartLine,
    FaUtensils,
    FaFolder,
    FaUsers,
    FaBell,
    FaBellSlash,
    FaReceipt,
    FaMapMarkerAlt,
    FaArrowLeft,
    FaTabletAlt,
    FaExclamationTriangle,
    FaLink,
    FaHandPaper,
    FaVolumeUp,
    FaVolumeMute
} from 'react-icons/fa';
import OrderManualPaymentModal from '../../components/admin/OrderManualPaymentModal';
import FutureOrderDetailModal from '../../components/admin/FutureOrderDetailModal';
import { ORDER_STATUS_AWAITING_PAYMENT_HE, paymentStatusBadgeLabel, shouldShowPaymentStatusBadge } from '../../utils/orderPaymentLabels';

export default function AdminDashboard() {
    const navigate = useNavigate();
    const { getAuthHeaders, isOwner, isManager } = useAdminAuth();
    const [stats, setStats] = useState(null);
    const [recentOrders, setRecentOrders] = useState([]);
    const [futureOrders, setFutureOrders] = useState([]);
    const [manualPaymentOrders, setManualPaymentOrders] = useState([]);
    const [manualPaymentModalOrder, setManualPaymentModalOrder] = useState(null);
    const [futureDetailOrder, setFutureDetailOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [pushState, setPushState] = useState({ status: 'idle', message: '' });

    const permission = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
    const storedToken = useMemo(() => getStoredFcmToken(), [pushState.status]);
    const isPushEnabled = permission === 'granted' && !!storedToken;
    // רק בעלים ומנהלים רואים הכנסות
    const canViewRevenue = isOwner() || isManager();
    const canManualPaymentTools = isOwner() || isManager();

    // מצב צלצול הזמנות — נשמר ב-localStorage
    const [soundEnabled, setSoundEnabled] = useState(() => {
        try { return localStorage.getItem('admin_sound_enabled') !== 'false'; } catch { return true; }
    });
    const handleSoundToggle = (next) => {
        setSoundEnabled(next);
        try { localStorage.setItem('admin_sound_enabled', next ? 'true' : 'false'); } catch { /* ignore */ }
        if (next) {
            try {
                const a = new Audio('/sounds/Order-up-bell-sound.mp3');
                a.volume = 0.4;
                a.play().catch(() => { });
            } catch { /* ignore */ }
        }
    };

    /** כרטיס "טיפול בתשלום" (HYP) מהשרת; אם ריק — נופלים ל-10 האחרונות עם pending/failed */
    const bannerUnpaidOrders = useMemo(() => {
        if (manualPaymentOrders.length > 0) {
            return manualPaymentOrders;
        }
        return recentOrders.filter(
            (o) =>
                (o.payment_status === 'pending' || o.payment_status === 'failed') &&
                o.status !== 'cancelled'
        );
    }, [manualPaymentOrders, recentOrders]);

    useEffect(() => {
        fetchDashboard();
    }, []);

    const fetchDashboard = async () => {
        try {
            const response = await api.get('/admin/dashboard', {
                headers: getAuthHeaders()
            });
            if (import.meta.env.DEV) {
                console.log('Dashboard response:', response.data);
            }
            if (response.data.success) {
                setStats(response.data.stats);
                const realOrders = (response.data.recent_orders || []).filter(order => !order.is_test);
                setRecentOrders(realOrders);
                setFutureOrders(response.data.future_orders || []);
                setManualPaymentOrders(response.data.manual_payment_orders || []);
            }
        } catch (error) {
            console.error('Failed to fetch dashboard:', error);
            console.error('Error details:', error.response?.data);
        } finally {
            setLoading(false);
        }
    };

    const enablePush = async () => {
        try {
            setPushState({ status: 'loading', message: 'מבקש הרשאה להתראות...' });
            const token = await requestFcmToken();
            if (!token) {
                const perm = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
                setPushState({
                    status: 'error',
                    message: perm === 'denied'
                        ? 'ההתראות חסומות בדפדפן. יש לאפשר דרך ההגדרות.'
                        : 'הרשאה נדחתה. יש לאשר התראות.',
                });
                return;
            }

            await api.post('/fcm/register', { token, device_label: 'tablet' }, { headers: getAuthHeaders() });
            setPushState({ status: 'success', message: 'התראות הופעלו לטאבלט הזה.' });
        } catch (error) {
            console.error('Failed to enable push', error);
            setPushState({ status: 'error', message: 'שגיאה בהפעלת התראות. נסו שוב.' });
        }
    };

    const disablePush = async () => {
        try {
            setPushState({ status: 'loading', message: 'מכבה התראות...' });

            const token = getStoredFcmToken();
            if (token) {
                try {
                    await api.post('/fcm/unregister', { token }, { headers: getAuthHeaders() });
                } catch (e) {
                    console.warn('[FCM] backend unregister failed', e);
                }
            }

            try {
                await disableFcm();
            } catch (e) {
                console.warn('[FCM] deleteToken failed', e);
                clearStoredFcmToken();
            }

            setPushState({
                status: 'success',
                message: 'התראות כובו עבור המכשיר הזה. כדי לבטל הרשאה לחלוטין יש לחסום בהגדרות הדפדפן.',
            });
        } catch (error) {
            console.error('Failed to disable push', error);
            setPushState({ status: 'error', message: 'שגיאה בכיבוי התראות. נסו שוב.' });
        }
    };

    const statCards = [
        {
            key: 'orders_today',
            label: 'הזמנות היום',
            icon: <FaBox size={14} />,
            color: 'text-blue-600',
            bg: 'bg-blue-50',
            show: true
        },
        {
            key: 'orders_pending',
            label: 'ממתינות לטיפול',
            icon: <FaClock size={14} />,
            color: 'text-amber-600',
            bg: 'bg-amber-50',
            show: true
        },
        {
            key: 'revenue_today',
            label: 'הכנסות היום',
            icon: <FaWallet size={14} />,
            color: 'text-emerald-600',
            bg: 'bg-emerald-50',
            format: (v) => `₪${(v || 0).toLocaleString()}`,
            show: canViewRevenue
        },
        {
            key: 'revenue_week',
            label: 'הכנסות השבוע',
            icon: <FaChartLine size={14} />,
            color: 'text-indigo-600',
            bg: 'bg-indigo-50',
            format: (v) => `₪${(v || 0).toLocaleString()}`,
            show: canViewRevenue
        },
    ].filter(card => card.show);

    const getStatusBadge = (status) => {
        const statuses = {
            awaiting_payment: { text: ORDER_STATUS_AWAITING_PAYMENT_HE, color: 'bg-orange-50 text-orange-800 border-orange-100' },
            pending: { text: 'ממתין', color: 'bg-yellow-50 text-yellow-700 border-yellow-100' },
            received: { text: 'התקבל', color: 'bg-yellow-50 text-yellow-700 border-yellow-100' },
            preparing: { text: 'בהכנה', color: 'bg-blue-50 text-blue-700 border-blue-100' },
            ready: { text: 'מוכן', color: 'bg-green-50 text-green-700 border-green-100' },
            delivering: { text: 'במשלוח', color: 'bg-purple-50 text-purple-700 border-purple-100' },
            delivered: { text: 'נמסר', color: 'bg-gray-50 text-gray-700 border-gray-100' },
            cancelled: { text: 'בוטל', color: 'bg-red-50 text-red-700 border-red-100' },
        };
        return statuses[status] || { text: status, color: 'bg-gray-50 text-gray-700 border-gray-100' };
    };

    if (loading) {
        return (
            <AdminLayout>
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            {/* Upgrade Banner */}
            <div className="mb-4">
                <UpgradeBanner variant="inline" context="ai" />
            </div>

            {/* באנר התראות מודרני */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4 sm:p-5 mb-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-2xl ${isPushEnabled ? 'bg-green-50 text-green-600' : 'bg-brand-primary/5 text-brand-primary'}`}>
                            {isPushEnabled ? <FaBell size={20} /> : <FaBellSlash size={20} />}
                        </div>
                        <div>
                            <p className="text-base font-black text-gray-900 leading-tight">התראות זמן אמת לטאבלט</p>
                            <p className="text-xs text-gray-500 font-bold mt-0.5">קבל צליל והתראה על כל הזמנה חדשה שמתקבלת</p>
                            {pushState.message && (
                                <p className={`text-[11px] mt-1 font-black uppercase ${pushState.status === 'success' ? 'text-green-600' : pushState.status === 'error' ? 'text-red-500' : 'text-gray-400'}`}>
                                    • {pushState.message}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs font-black text-gray-500 whitespace-nowrap">התראות</span>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={isPushEnabled}
                            aria-busy={pushState.status === 'loading'}
                            onClick={() => (isPushEnabled ? disablePush() : enablePush())}
                            disabled={pushState.status === 'loading' || permission === 'denied'}
                            className={`relative h-9 w-14 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:opacity-40 ${isPushEnabled ? 'bg-emerald-500' : 'bg-gray-200'
                                }`}
                        >
                            <span
                                className={`absolute top-1 h-7 w-7 rounded-full bg-white shadow-md transition-all duration-200 ${isPushEnabled ? 'end-1' : 'start-1'
                                    }`}
                            />
                            {pushState.status === 'loading' && (
                                <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                </span>
                            )}
                        </button>
                    </div>
                </div>
                {/* שורת צלצול הזמנות */}
                <div className="pt-3 mt-1 border-t border-gray-100 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${soundEnabled ? 'bg-orange-50 text-orange-500' : 'bg-gray-100 text-gray-400'}`}>
                            {soundEnabled ? <FaVolumeUp size={16} /> : <FaVolumeMute size={16} />}
                        </div>
                        <div>
                            <p className="text-sm font-black text-gray-900 leading-tight">צלצול הזמנות</p>
                            <p className="text-xs text-gray-500">{soundEnabled ? 'צלצול הזמנות פעיל' : 'כבוי — לחץ להפעלה'}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        role="switch"
                        aria-checked={soundEnabled}
                        onClick={() => handleSoundToggle(!soundEnabled)}
                        className={`relative h-9 w-14 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 ${soundEnabled ? 'bg-orange-400' : 'bg-gray-200'}`}
                    >
                        <span className={`absolute top-1 h-7 w-7 rounded-full bg-white shadow-md transition-all duration-200 ${soundEnabled ? 'end-1' : 'start-1'}`} />
                    </button>
                </div>
            </div>

            {/* התראה על הזמנות לא שולמו — מספר הזמנה + סיבה; לחיצה פותחת את ההזמנה במסך ההזמנות כשיש אחת */}
            {bannerUnpaidOrders.length > 0 && (
                <div
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            if (bannerUnpaidOrders.length === 1) {
                                navigate(`/admin/orders?orderId=${bannerUnpaidOrders[0].id}`);
                            } else {
                                navigate('/admin/orders');
                            }
                        }
                    }}
                    onClick={() => {
                        if (bannerUnpaidOrders.length === 1) {
                            navigate(`/admin/orders?orderId=${bannerUnpaidOrders[0].id}`);
                        } else {
                            navigate('/admin/orders');
                        }
                    }}
                    className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-6 flex flex-col sm:flex-row sm:items-start gap-3 cursor-pointer hover:bg-orange-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2"
                >
                    <FaExclamationTriangle className="text-orange-500 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-orange-800">
                            {bannerUnpaidOrders.length === 1
                                ? 'יש הזמנה אחת בהמתנה לתשלום'
                                : `יש ${bannerUnpaidOrders.length} הזמנות בהמתנה לתשלום`}
                        </p>
                        <ul className="mt-2 space-y-1 text-xs font-bold text-orange-900/90">
                            {bannerUnpaidOrders.slice(0, 6).map((o) => {
                                const reason =
                                    paymentStatusBadgeLabel(o) ||
                                    (o.payment_status === 'failed' ? 'תשלום נכשל' : 'ממתין לתשלום');
                                return (
                                    <li key={o.id} className="flex flex-wrap gap-x-2 gap-y-0.5">
                                        <span className="font-black tabular-nums">#{o.id}</span>
                                        <span className="text-orange-800/90">{reason}</span>
                                    </li>
                                );
                            })}
                        </ul>
                        {bannerUnpaidOrders.length > 6 && (
                            <p className="text-[10px] font-bold text-orange-700 mt-1.5">ועוד {bannerUnpaidOrders.length - 6}…</p>
                        )}
                    </div>
                </div>
            )}

            {/* כרטיסי סטטיסטיקה מצומצמים */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {statCards.map((card) => (
                    <div key={card.key} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 group hover:border-brand-primary/30 transition-all">
                        <div className="flex items-center justify-between mb-2">
                            <div className={`p-2 rounded-lg ${card.bg} ${card.color}`}>
                                {card.icon}
                            </div>
                            <div className="h-1 w-8 bg-gray-50 rounded-full overflow-hidden">
                                <div className={`h-full ${card.color.replace('text-', 'bg-')} opacity-20 w-1/2`} />
                            </div>
                        </div>
                        <p className="text-xl font-black text-gray-900 leading-none">
                            {card.format
                                ? card.format(stats?.[card.key])
                                : stats?.[card.key] || 0}
                        </p>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mt-1.5">{card.label}</p>
                    </div>
                ))}
            </div>

            {(futureOrders.length > 0 || (canManualPaymentTools && manualPaymentOrders.length > 0)) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6 items-stretch">
                    {futureOrders.length > 0 && (
                        <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-4 flex flex-col min-h-0">
                            <div className="flex items-center justify-between gap-2 mb-3 shrink-0">
                                <h3 className="text-sm font-black text-gray-900 flex items-center gap-2 min-w-0">
                                    <span className="p-2 rounded-lg bg-indigo-50 text-indigo-600 shrink-0">
                                        <FaClock size={14} />
                                    </span>
                                    <span className="truncate">עתידיות ({futureOrders.length})</span>
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => navigate('/admin/orders')}
                                    className="text-[10px] font-black text-indigo-600 hover:underline shrink-0"
                                >
                                    מסך הזמנות
                                </button>
                            </div>
                            <div className="space-y-2 max-h-52 overflow-y-auto flex-1 min-h-0">
                                {futureOrders.map(order => (
                                    <div
                                        key={order.id}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => setFutureDetailOrder(order)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                setFutureDetailOrder(order);
                                            }
                                        }}
                                        className="flex items-center justify-between p-2.5 bg-indigo-50/50 rounded-xl border border-indigo-100/50 cursor-pointer hover:bg-indigo-100/50 transition-colors text-sm"
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className="w-7 h-7 bg-indigo-100 text-indigo-700 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0">
                                                #{String(order.id).slice(-4)}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-bold text-gray-900 truncate">{order.customer_name}</p>
                                                <p className="text-[10px] text-indigo-600 font-bold">
                                                    {new Date(order.scheduled_for).toLocaleString('he-IL', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-left shrink-0 mr-2">
                                            <p className="font-black text-gray-900">₪{Number(order.total_amount || order.total || 0).toFixed(0)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {canManualPaymentTools && manualPaymentOrders.length > 0 && (
                        <div className="bg-white rounded-2xl border border-cyan-100 shadow-sm p-4 flex flex-col min-h-0">
                            <div className="flex items-center justify-between gap-2 mb-3 shrink-0">
                                <h3 className="text-sm font-black text-gray-900 flex items-center gap-2 min-w-0">
                                    <span className="p-2 rounded-lg bg-cyan-50 text-cyan-700 shrink-0">
                                        <FaHandPaper size={14} />
                                    </span>
                                    <span className="truncate">טיפול בתשלום ({manualPaymentOrders.length})</span>
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => navigate('/admin/orders')}
                                    className="text-[10px] font-black text-cyan-700 hover:underline shrink-0"
                                >
                                    הכל
                                </button>
                            </div>
                            <div className="divide-y divide-gray-50 max-h-52 overflow-y-auto flex-1 min-h-0 border-t border-gray-50 -mx-4 px-4">
                                {manualPaymentOrders.map((o) => {
                                    const pay = o.payment_status === 'failed' ? 'נכשל' : 'ממתין';
                                    const total = Number(o.total_amount ?? o.total ?? 0);
                                    return (
                                        <div
                                            key={o.id}
                                            className="py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 hover:bg-gray-50/80 transition-colors first:pt-0"
                                        >
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                                                    <span className="text-xs font-black text-gray-900">#{o.id}</span>
                                                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-gray-100/60 text-gray-600 border border-gray-200/60">
                                                        {pay}
                                                    </span>
                                                </div>
                                                <p className="text-xs font-bold text-gray-800 truncate">{o.customer_name || '—'}</p>
                                                <p className="text-[10px] text-gray-400 font-bold">₪{total.toFixed(2)}</p>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => setManualPaymentModalOrder(o)}
                                                    className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl bg-cyan-600 text-white text-[10px] font-black hover:bg-cyan-700 transition-all"
                                                >
                                                    <FaLink size={10} />
                                                    טיפול
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => navigate(`/admin/orders?orderId=${o.id}`)}
                                                    className="inline-flex items-center justify-center px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-gray-700 text-[10px] font-black hover:bg-gray-50"
                                                >
                                                    פתח
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* סיכום נוסף - גריד צבעוני מצומצם */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-blue-50/50 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:scale-110" />
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <FaUtensils size={18} />
                    </div>
                    <div>
                        <p className="text-lg font-black text-gray-900 leading-none">{stats?.menu_items || 0}</p>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">פריטים בתפריט</p>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-purple-50/50 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:scale-110" />
                    <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                        <FaFolder size={18} />
                    </div>
                    <div>
                        <p className="text-lg font-black text-gray-900 leading-none">{stats?.categories || 0}</p>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">קטגוריות</p>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-orange-50/50 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:scale-110" />
                    <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                        <FaUsers size={18} />
                    </div>
                    <div>
                        <p className="text-lg font-black text-gray-900 leading-none">{stats?.employees || 0}</p>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">עובדים</p>
                    </div>
                </div>
            </div>

            {/* AI Credits Section */}
            <div className="mb-6">
                <AiCreditsBadge detailed={canViewRevenue} />
            </div>

            {/* AI Insights Section */}
            <div className="mb-6">
                <AiInsightsPanel />
            </div>

            {/* הזמנות אחרונות */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-50 flex items-center justify-between">
                    <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                        <FaReceipt size={16} className="text-brand-primary" />
                        הזמנות אחרונות
                    </h2>
                    <button className="text-[10px] font-black text-brand-primary uppercase tracking-widest hover:underline">
                        הצג הכל
                    </button>
                </div>
                <div className="divide-y divide-gray-50">
                    {recentOrders.length === 0 ? (
                        <div className="p-12 text-center">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-dashed border-gray-200 text-gray-300">
                                <FaReceipt size={24} />
                            </div>
                            <p className="text-sm font-black text-gray-400 uppercase tracking-widest">אין הזמנות להצגה</p>
                        </div>
                    ) : (
                        recentOrders.map((order) => {
                            const statusBadge = getStatusBadge(order.status);
                            const isDelivery = order.delivery_method === 'delivery' || (!!order.delivery_address);
                            return (
                                <div
                                    key={order.id}
                                    className="p-4 hover:bg-gray-50 transition-all cursor-pointer group"
                                    onClick={() => navigate(`/admin/orders?orderId=${order.id}`)}
                                >
                                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-white border border-gray-100 rounded-2xl flex items-center justify-center shadow-sm group-hover:border-brand-primary/20 group-hover:shadow-md transition-all">
                                                <span className="text-[10px] font-black text-gray-900">#{order.id}</span>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <p className="font-black text-gray-900 text-sm">{order.customer_name}</p>
                                                    <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border shrink-0 ${statusBadge.color}`}>
                                                        {statusBadge.text}
                                                    </span>
                                                    {shouldShowPaymentStatusBadge(order) && (
                                                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border shrink-0 bg-gray-100/60 text-gray-600 border-gray-200/60`}>
                                                            {paymentStatusBadgeLabel(order)}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                                    <p className="text-[10px] font-bold text-gray-400 flex items-center gap-1 uppercase tracking-tighter">
                                                        <FaClock size={8} />
                                                        {new Date(order.created_at).toLocaleString('he-IL', {
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </p>
                                                    <p className="text-[10px] font-bold text-gray-400 flex items-center gap-1 uppercase tracking-tighter">
                                                        <FaBox size={8} />
                                                        {order.items?.length || 0} פריטים
                                                    </p>
                                                    {order.source === 'kiosk' ? (
                                                        <>
                                                            <p className="text-[10px] font-black uppercase flex items-center gap-1 text-amber-700">
                                                                <FaTabletAlt size={8} />
                                                                קיוסק
                                                            </p>
                                                            <p className={`text-[10px] font-black uppercase flex items-center gap-1 ${order.order_type === 'dine_in' ? 'text-green-600' : 'text-orange-500'}`}>
                                                                <span className="w-1 h-1 rounded-full bg-current" />
                                                                {order.order_type === 'dine_in' ? 'לשבת' : 'לקחת'}
                                                            </p>
                                                            {order.table_number && (
                                                                <p className="text-[10px] font-black uppercase flex items-center gap-1 text-indigo-600">
                                                                    <span className="w-1 h-1 rounded-full bg-current" />
                                                                    שולחן {order.table_number}
                                                                </p>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <p className={`text-[10px] font-black uppercase flex items-center gap-1 ${isDelivery ? 'text-purple-500' : 'text-orange-500'}`}>
                                                            <span className="w-1 h-1 rounded-full bg-current" />
                                                            {isDelivery ? 'משלוח' : 'איסוף'}
                                                        </p>
                                                    )}
                                                </div>
                                                {isDelivery && order.delivery_address && (
                                                    <p className="text-[10px] text-gray-400 font-medium flex items-center gap-1 mt-1 truncate max-w-[200px]">
                                                        <FaMapMarkerAlt size={8} />
                                                        {order.delivery_address}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between md:flex-col md:items-end md:justify-center gap-2 shrink-0 pr-0 md:pr-4">
                                            <p className="text-lg font-black text-gray-900 leading-none">
                                                ₪{Number(order.total || order.total_amount || 0).toFixed(2)}
                                            </p>
                                            <div className="w-8 h-8 rounded-full border border-gray-100 flex items-center justify-center group-hover:bg-brand-primary group-hover:text-white group-hover:border-brand-primary transition-all shadow-sm">
                                                <FaArrowLeft size={10} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {manualPaymentModalOrder && (
                <OrderManualPaymentModal
                    order={manualPaymentModalOrder}
                    getAuthHeaders={getAuthHeaders}
                    onClose={() => setManualPaymentModalOrder(null)}
                    onUpdated={() => {
                        fetchDashboard();
                        setManualPaymentModalOrder(null);
                    }}
                />
            )}

            {futureDetailOrder && (
                <FutureOrderDetailModal
                    order={futureDetailOrder}
                    onClose={() => setFutureDetailOrder(null)}
                    getAuthHeaders={getAuthHeaders}
                    onOrderCancelled={() => {
                        fetchDashboard();
                        setFutureDetailOrder(null);
                    }}
                />
            )}
        </AdminLayout>
    );
}
