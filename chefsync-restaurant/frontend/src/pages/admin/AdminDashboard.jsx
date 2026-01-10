import { useMemo, useRef, useState, useEffect } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import AdminLayout from '../../layouts/AdminLayout';
import api from '../../services/apiClient';
import { clearStoredFcmToken, disableFcm, getStoredFcmToken, listenForegroundMessages, requestFcmToken } from '../../services/fcm';
import { PRODUCT_NAME } from '../../constants/brand';

export default function AdminDashboard() {
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
                    // eslint-disable-next-line no-new
                    new Notification(title, { body, icon: '/icon-192.png' });
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
                setRecentOrders(response.data.recent_orders);
                console.log('Stats:', response.data.stats);
                console.log('Recent orders:', response.data.recent_orders);
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
            icon: '📦',
            color: 'bg-blue-500',
            show: true
        },
        {
            key: 'orders_pending',
            label: 'ממתינות לטיפול',
            icon: '⏳',
            color: 'bg-orange-500',
            show: true
        },
        {
            key: 'revenue_today',
            label: 'הכנסות היום',
            icon: '💰',
            color: 'bg-green-500',
            format: (v) => `₪${(v || 0).toLocaleString()}`,
            show: canViewRevenue
        },
        {
            key: 'revenue_week',
            label: 'הכנסות השבוע',
            icon: '📈',
            color: 'bg-purple-500',
            format: (v) => `₪${(v || 0).toLocaleString()}`,
            show: canViewRevenue
        },
    ].filter(card => card.show);

    const getStatusBadge = (status) => {
        const statuses = {
            pending: { text: 'ממתין', color: 'bg-yellow-100 text-yellow-700' },
            received: { text: 'התקבל', color: 'bg-yellow-100 text-yellow-700' },
            preparing: { text: 'בהכנה', color: 'bg-blue-100 text-blue-700' },
            ready: { text: 'מוכן', color: 'bg-green-100 text-green-700' },
            delivering: { text: 'במשלוח', color: 'bg-purple-100 text-purple-700' },
            delivered: { text: 'נמסר', color: 'bg-gray-100 text-gray-700' },
            cancelled: { text: 'בוטל', color: 'bg-red-100 text-red-700' },
        };
        return statuses[status] || { text: status, color: 'bg-gray-100 text-gray-700' };
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
            <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-5 mb-6 flex flex-col gap-3 sm:gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="text-base sm:text-lg font-semibold text-gray-800">קבלו התראות הזמנה לטאבלט</p>
                    <p className="text-sm text-gray-500">במיוחד באייפון: חייב אישור אחרי לחיצה ידנית.</p>
                    <p className="text-xs text-gray-500 mt-1">
                        סטטוס הרשאה: <span className="font-mono">{permission}</span>
                    </p>
                    {pushState.message && (
                        <p className={`text-sm mt-1 ${pushState.status === 'success' ? 'text-green-600' : pushState.status === 'error' ? 'text-red-600' : 'text-gray-600'}`}>
                            {pushState.message}
                        </p>
                    )}
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                    <button
                        onClick={enablePush}
                        disabled={pushState.status === 'loading' || permission === 'denied' || isPushEnabled}
                        className={`inline-flex items-center justify-center px-4 py-2 rounded-xl text-white font-semibold shadow-sm disabled:opacity-60 ${isPushEnabled ? 'bg-green-600' : 'bg-brand-primary hover:bg-brand-primary/90'
                            }`}
                    >
                        {pushState.status === 'loading'
                            ? 'טוען...'
                            : isPushEnabled
                                ? 'התראות מופעלות'
                                : permission === 'denied'
                                    ? 'התראות חסומות'
                                    : 'הפעל התראות'}
                    </button>

                    {isPushEnabled && (
                        <button
                            onClick={disablePush}
                            disabled={pushState.status === 'loading'}
                            className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-800 font-semibold shadow-sm hover:bg-gray-50 disabled:opacity-60"
                        >
                            כבה התראות
                        </button>
                    )}
                </div>
            </div>

            {/* כרטיסי סטטיסטיקה */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {statCards.map((card) => (
                    <div key={card.key} className="bg-white rounded-2xl shadow-sm p-4 sm:p-6">
                        <div className="flex items-center justify-between mb-3 sm:mb-4">
                            <span className="text-2xl sm:text-3xl">{card.icon}</span>
                            <div className={`w-10 h-10 sm:w-12 sm:h-12 ${card.color} rounded-xl flex items-center justify-center`}>
                                <span className="text-white text-lg sm:text-xl font-bold">
                                    {card.format
                                        ? ''
                                        : stats?.[card.key] || 0}
                                </span>
                            </div>
                        </div>
                        <p className="text-xl sm:text-2xl font-bold text-gray-800">
                            {card.format
                                ? card.format(stats?.[card.key])
                                : stats?.[card.key] || 0}
                        </p>
                        <p className="text-xs sm:text-sm text-gray-500">{card.label}</p>
                    </div>
                ))}
            </div>

            {/* סיכום נוסף */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-gradient-to-br from-brand-primary to-brand-secondary text-white rounded-2xl p-4 sm:p-6">
                    <div className="flex items-center gap-4">
                        <span className="text-3xl sm:text-4xl">🍽️</span>
                        <div>
                            <p className="text-2xl sm:text-3xl font-bold">{stats?.menu_items || 0}</p>
                            <p className="text-white/80 text-sm">פריטים בתפריט</p>
                        </div>
                    </div>
                </div>
                <div className="bg-gradient-to-br from-purple-500 to-pink-500 text-white rounded-2xl p-4 sm:p-6">
                    <div className="flex items-center gap-4">
                        <span className="text-3xl sm:text-4xl">📁</span>
                        <div>
                            <p className="text-2xl sm:text-3xl font-bold">{stats?.categories || 0}</p>
                            <p className="text-white/80 text-sm">קטגוריות</p>
                        </div>
                    </div>
                </div>
                <div className="bg-gradient-to-br from-orange-500 to-red-500 text-white rounded-2xl p-4 sm:p-6">
                    <div className="flex items-center gap-4">
                        <span className="text-3xl sm:text-4xl">👥</span>
                        <div>
                            <p className="text-2xl sm:text-3xl font-bold">{stats?.employees || 0}</p>
                            <p className="text-white/80 text-sm">עובדים</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* הזמנות אחרונות */}
            <div className="bg-white rounded-2xl shadow-sm">
                <div className="p-4 sm:p-6 border-b">
                    <h2 className="text-xl font-bold text-gray-800">📋 הזמנות אחרונות</h2>
                </div>
                <div className="divide-y">
                    {recentOrders.length === 0 ? (
                        <div className="p-6 sm:p-8 text-center text-gray-500">
                            <span className="text-3xl sm:text-4xl mb-4 block">📭</span>
                            <p>אין הזמנות להצגה</p>
                        </div>
                    ) : (
                        recentOrders.map((order) => {
                            const statusBadge = getStatusBadge(order.status);
                            const isDelivery = order.delivery_method === 'delivery' || (!!order.delivery_address);
                            return (
                                <div key={order.id} className="p-3 sm:p-4 hover:bg-gray-50 transition-colors">
                                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                        <div className="flex items-center gap-3 sm:gap-4">
                                            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-brand-primary/10 rounded-xl flex items-center justify-center">
                                                <span className="font-bold text-brand-primary">#{order.id}</span>
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-800 text-sm sm:text-base">{order.customer_name}</p>
                                                <p className="text-xs sm:text-sm text-gray-500 flex flex-wrap items-center gap-1">
                                                    <span>{order.items?.length || 0} פריטים</span>
                                                    <span>•</span>
                                                    <span>{new Date(order.created_at).toLocaleString('he-IL', {
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}</span>
                                                    <span>•</span>
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[11px]">
                                                        {isDelivery ? 'משלוח' : 'איסוף עצמי'}
                                                    </span>
                                                </p>
                                                {isDelivery && order.delivery_address && (
                                                    <p className="text-xs text-gray-500 truncate max-w-[220px]">📍 {order.delivery_address}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-left">
                                            <span className={`px-2 sm:px-3 py-1 rounded-full text-xs font-medium ${statusBadge.color}`}>
                                                {statusBadge.text}
                                            </span>
                                            <p className="text-base sm:text-lg font-bold text-gray-800 mt-1">
                                                ₪{Number(order.total || order.total_amount || 0).toFixed(2)}
                                            </p>
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
