import { useState, useEffect } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import AdminLayout from '../../layouts/AdminLayout';
import api from '../../services/apiClient';

export default function AdminDashboard() {
    const { getAuthHeaders } = useAdminAuth();
    const [stats, setStats] = useState(null);
    const [recentOrders, setRecentOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboard();
    }, []);

    const fetchDashboard = async () => {
        try {
            const response = await api.get('/admin/dashboard', {
                headers: getAuthHeaders()
            });
            if (response.data.success) {
                setStats(response.data.stats);
                setRecentOrders(response.data.recent_orders);
            }
        } catch (error) {
            console.error('Failed to fetch dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const statCards = [
        {
            key: 'orders_today',
            label: 'הזמנות היום',
            icon: '📦',
            color: 'bg-blue-500'
        },
        {
            key: 'orders_pending',
            label: 'ממתינות לטיפול',
            icon: '⏳',
            color: 'bg-orange-500'
        },
        {
            key: 'revenue_today',
            label: 'הכנסות היום',
            icon: '💰',
            color: 'bg-green-500',
            format: (v) => `₪${(v || 0).toLocaleString()}`
        },
        {
            key: 'revenue_week',
            label: 'הכנסות השבוע',
            icon: '📈',
            color: 'bg-purple-500',
            format: (v) => `₪${(v || 0).toLocaleString()}`
        },
    ];

    const getStatusBadge = (status) => {
        const statuses = {
            pending: { text: 'ממתין', color: 'bg-yellow-100 text-yellow-700' },
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
            {/* כרטיסי סטטיסטיקה */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {statCards.map((card) => (
                    <div key={card.key} className="bg-white rounded-2xl shadow-sm p-6">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-3xl">{card.icon}</span>
                            <div className={`w-12 h-12 ${card.color} rounded-xl flex items-center justify-center`}>
                                <span className="text-white text-xl font-bold">
                                    {card.format
                                        ? ''
                                        : stats?.[card.key] || 0}
                                </span>
                            </div>
                        </div>
                        <p className="text-2xl font-bold text-gray-800">
                            {card.format
                                ? card.format(stats?.[card.key])
                                : stats?.[card.key] || 0}
                        </p>
                        <p className="text-sm text-gray-500">{card.label}</p>
                    </div>
                ))}
            </div>

            {/* סיכום נוסף */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
                <div className="bg-gradient-to-br from-brand-primary to-brand-secondary text-white rounded-2xl p-6">
                    <div className="flex items-center gap-4">
                        <span className="text-4xl">🍽️</span>
                        <div>
                            <p className="text-3xl font-bold">{stats?.menu_items || 0}</p>
                            <p className="text-white/80">פריטים בתפריט</p>
                        </div>
                    </div>
                </div>
                <div className="bg-gradient-to-br from-purple-500 to-pink-500 text-white rounded-2xl p-6">
                    <div className="flex items-center gap-4">
                        <span className="text-4xl">📁</span>
                        <div>
                            <p className="text-3xl font-bold">{stats?.categories || 0}</p>
                            <p className="text-white/80">קטגוריות</p>
                        </div>
                    </div>
                </div>
                <div className="bg-gradient-to-br from-orange-500 to-red-500 text-white rounded-2xl p-6">
                    <div className="flex items-center gap-4">
                        <span className="text-4xl">👥</span>
                        <div>
                            <p className="text-3xl font-bold">{stats?.employees || 0}</p>
                            <p className="text-white/80">עובדים</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* הזמנות אחרונות */}
            <div className="bg-white rounded-2xl shadow-sm">
                <div className="p-6 border-b">
                    <h2 className="text-xl font-bold text-gray-800">📋 הזמנות אחרונות</h2>
                </div>
                <div className="divide-y">
                    {recentOrders.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            <span className="text-4xl mb-4 block">📭</span>
                            <p>אין הזמנות להצגה</p>
                        </div>
                    ) : (
                        recentOrders.map((order) => {
                            const statusBadge = getStatusBadge(order.status);
                            return (
                                <div key={order.id} className="p-4 hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-brand-primary/10 rounded-xl flex items-center justify-center">
                                                <span className="font-bold text-brand-primary">#{order.id}</span>
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-800">{order.customer_name}</p>
                                                <p className="text-sm text-gray-500">
                                                    {order.items?.length || 0} פריטים •
                                                    {new Date(order.created_at).toLocaleString('he-IL', {
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-left">
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusBadge.color}`}>
                                                {statusBadge.text}
                                            </span>
                                            <p className="text-lg font-bold text-gray-800 mt-1">₪{order.total}</p>
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
