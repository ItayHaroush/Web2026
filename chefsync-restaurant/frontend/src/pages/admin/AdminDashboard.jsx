import { useMemo, useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';
import AdminLayout from '../../layouts/AdminLayout';
import api from '../../services/apiClient';
import { clearStoredFcmToken, disableFcm, getStoredFcmToken, listenForegroundMessages, requestFcmToken } from '../../services/fcm';
import { PRODUCT_NAME } from '../../constants/brand';
import AiCreditsBadge from '../../components/AiCreditsBadge';
import AiInsightsPanel from '../../components/AiInsightsPanel';
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
    FaCheck,
    FaMapMarkerAlt,
    FaArrowLeft,
    FaTabletAlt
} from 'react-icons/fa';

export default function AdminDashboard() {
    const navigate = useNavigate();
    const { getAuthHeaders, isOwner, isManager } = useAdminAuth();
    const [stats, setStats] = useState(null);
    const [recentOrders, setRecentOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pushState, setPushState] = useState({ status: 'idle', message: '' });

    const permission = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
    const storedToken = useMemo(() => getStoredFcmToken(), [pushState.status]);
    const isPushEnabled = permission === 'granted' && !!storedToken;
    const lastMessageIdsRef = useRef(new Set());

    // רק בעלים ומנהלים רואים הכנסות
    const canViewRevenue = isOwner() || isManager();

    useEffect(() => {
        fetchDashboard();
    }, []);

    // When the dashboard is open (foreground), FCM messages won't be shown automatically.
    // This listener makes it obvious the message arrived.
    useEffect(() => {
        const unsubscribe = listenForegroundMessages((payload) => {
            console.log('[FCM] foreground message', payload);

            const msgId = payload?.messageId || payload?.data?.messageId || payload?.data?.google?.message_id;
            if (msgId) {
                if (lastMessageIdsRef.current.has(msgId)) return;
                lastMessageIdsRef.current.add(msgId);
                setTimeout(() => lastMessageIdsRef.current.delete(msgId), 30_000);
            }

            const title = payload?.notification?.title || payload?.data?.title || PRODUCT_NAME;
            const body = payload?.notification?.body || payload?.data?.body || 'התראה חדשה';

            if (Notification?.permission === 'granted') {
                try {
                    const n = new Notification(title, { body, icon: '/icon-192.png' });
                    n.onclick = () => {
                        n.close();
                        window.focus();
                        if (payload?.data?.orderId) {
                            navigate('/admin/orders');
                        }
                    };
                } catch (e) {
                    // Some browsers block Notification() in certain contexts; fallback to console.
                    console.warn('[FCM] Notification() failed', e);
                }
            }
        });

        return () => {
            if (typeof unsubscribe === 'function') unsubscribe();
        };
    }, []);

    const fetchDashboard = async () => {
        try {
            const response = await api.get('/admin/dashboard', {
                headers: getAuthHeaders()
            });
            console.log('Dashboard response:', response.data);
            if (response.data.success) {
                setStats(response.data.stats);
                // ✅ סינון הזמנות דוגמה מהדשבורד
                const realOrders = (response.data.recent_orders || []).filter(order => !order.is_test);
                setRecentOrders(realOrders);
                console.log('Stats:', response.data.stats);
                console.log('Recent orders (excluding test):', realOrders);
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
                    <div className="flex items-center gap-2">
                        <button
                            onClick={enablePush}
                            disabled={pushState.status === 'loading' || permission === 'denied' || isPushEnabled}
                            className={`flex-1 lg:flex-none px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-sm flex items-center justify-center gap-2 ${isPushEnabled
                                ? 'bg-green-50 text-green-700 border border-green-100 cursor-default'
                                : 'bg-brand-primary text-white hover:shadow-brand-primary/20 hover:shadow-lg disabled:opacity-50'
                                }`}
                        >
                            {pushState.status === 'loading' ? (
                                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : isPushEnabled ? (
                                <><FaCheck size={10} /> מחובר</>
                            ) : (
                                'הפעל התראות'
                            )}
                        </button>

                        {isPushEnabled && (
                            <button
                                onClick={disablePush}
                                disabled={pushState.status === 'loading'}
                                className="px-5 py-2.5 bg-white border border-gray-100 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-sm flex items-center justify-center gap-2"
                            >
                                כבה
                            </button>
                        )}
                    </div>
                </div>
            </div>

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
        </AdminLayout>
    );
}
