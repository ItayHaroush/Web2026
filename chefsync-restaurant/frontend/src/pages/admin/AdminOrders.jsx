import { useState, useEffect } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import AdminLayout from '../../layouts/AdminLayout';
import api from '../../services/apiClient';

export default function AdminOrders() {
    const { getAuthHeaders } = useAdminAuth();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('');
    const [selectedOrder, setSelectedOrder] = useState(null);

    useEffect(() => {
        fetchOrders();
    }, [filterStatus]);

    const fetchOrders = async () => {
        try {
            const params = filterStatus ? { status: filterStatus } : {};
            const response = await api.get('/admin/orders', {
                headers: getAuthHeaders(),
                params
            });
            if (response.data.success) {
                setOrders(response.data.orders.data || response.data.orders);
            }
        } catch (error) {
            console.error('Failed to fetch orders:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateStatus = async (orderId, newStatus) => {
        try {
            const response = await api.patch(`/admin/orders/${orderId}/status`,
                { status: newStatus },
                { headers: getAuthHeaders() }
            );
            if (response.data.success) {
                fetchOrders();
                if (selectedOrder?.id === orderId) {
                    setSelectedOrder(response.data.order);
                }
            }
        } catch (error) {
            console.error('Failed to update status:', error);
        }
    };

    const statusOptions = [
        { value: '', label: 'הכל', icon: '📋' },
        { value: 'pending', label: 'ממתין', icon: '⏳' },
        { value: 'preparing', label: 'בהכנה', icon: '👨‍🍳' },
        { value: 'ready', label: 'מוכן', icon: '✅' },
        { value: 'delivering', label: 'במשלוח', icon: '🚗' },
        { value: 'delivered', label: 'נמסר', icon: '📦' },
        { value: 'cancelled', label: 'בוטל', icon: '❌' },
    ];

    const getStatusBadge = (status) => {
        const statuses = {
            pending: { text: 'ממתין', color: 'bg-yellow-100 text-yellow-700', nextStatus: 'preparing' },
            preparing: { text: 'בהכנה', color: 'bg-blue-100 text-blue-700', nextStatus: 'ready' },
            ready: { text: 'מוכן', color: 'bg-green-100 text-green-700', nextStatus: 'delivering' },
            delivering: { text: 'במשלוח', color: 'bg-purple-100 text-purple-700', nextStatus: 'delivered' },
            delivered: { text: 'נמסר', color: 'bg-gray-100 text-gray-700', nextStatus: null },
            cancelled: { text: 'בוטל', color: 'bg-red-100 text-red-700', nextStatus: null },
        };
        return statuses[status] || { text: status, color: 'bg-gray-100 text-gray-700', nextStatus: null };
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
            {/* פילטרים */}
            <div className="bg-white rounded-2xl shadow-sm p-4 mb-6">
                <div className="flex flex-wrap gap-2">
                    {statusOptions.map((option) => (
                        <button
                            key={option.value}
                            onClick={() => setFilterStatus(option.value)}
                            className={`px-4 py-2 rounded-xl font-medium transition-all ${filterStatus === option.value
                                ? 'bg-brand-primary text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            {option.icon} {option.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* רשימת הזמנות */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-2xl shadow-sm">
                        <div className="p-4 border-b">
                            <h2 className="font-bold text-gray-800">
                                📋 הזמנות ({orders.length})
                            </h2>
                        </div>
                        <div className="divide-y max-h-[600px] overflow-y-auto">
                            {orders.length === 0 ? (
                                <div className="p-8 text-center text-gray-500">
                                    <span className="text-4xl mb-4 block">📭</span>
                                    <p>אין הזמנות להצגה</p>
                                </div>
                            ) : (
                                orders.map((order) => {
                                    const statusBadge = getStatusBadge(order.status);
                                    return (
                                        <div
                                            key={order.id}
                                            onClick={() => setSelectedOrder(order)}
                                            className={`p-4 cursor-pointer transition-all ${selectedOrder?.id === order.id
                                                ? 'bg-brand-primary/5 border-r-4 border-brand-primary'
                                                : 'hover:bg-gray-50'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-12 h-12 bg-brand-primary/10 rounded-xl flex items-center justify-center">
                                                        <span className="font-bold text-brand-primary">#{order.id}</span>
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-gray-800">{order.customer_name}</p>
                                                        <p className="text-sm text-gray-500">
                                                            {new Date(order.created_at).toLocaleString('he-IL')}
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
                </div>

                {/* פרטי הזמנה */}
                <div className="lg:col-span-1">
                    {selectedOrder ? (
                        <div className="bg-white rounded-2xl shadow-sm sticky top-20">
                            <div className="p-4 border-b bg-brand-primary/5">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-bold text-lg">הזמנה #{selectedOrder.id}</h3>
                                    <button
                                        onClick={() => setSelectedOrder(null)}
                                        className="text-gray-400 hover:text-gray-600"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>

                            <div className="p-4 space-y-4">
                                {/* פרטי לקוח */}
                                <div className="bg-gray-50 rounded-xl p-4">
                                    <h4 className="font-medium text-gray-800 mb-2">👤 פרטי לקוח</h4>
                                    <p className="text-gray-600">{selectedOrder.customer_name}</p>
                                    <p className="text-gray-600">{selectedOrder.customer_phone}</p>
                                    {selectedOrder.customer_address && (
                                        <p className="text-gray-600 text-sm mt-1">📍 {selectedOrder.customer_address}</p>
                                    )}
                                </div>

                                {/* פריטים */}
                                <div>
                                    <h4 className="font-medium text-gray-800 mb-2">🍽️ פריטים</h4>
                                    <div className="space-y-2">
                                        {selectedOrder.items?.map((item, index) => (
                                            <div key={index} className="flex justify-between bg-gray-50 rounded-lg p-3">
                                                <div>
                                                    <span className="font-medium">{item.menu_item?.name || item.name}</span>
                                                    <span className="text-gray-500 mr-2">x{item.quantity}</span>
                                                </div>
                                                <span className="font-medium">₪{item.price * item.quantity}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* סיכום */}
                                <div className="border-t pt-4">
                                    <div className="flex justify-between text-lg font-bold">
                                        <span>סה"כ</span>
                                        <span>₪{selectedOrder.total}</span>
                                    </div>
                                </div>

                                {/* כפתורי פעולה */}
                                <div className="space-y-2">
                                    {getStatusBadge(selectedOrder.status).nextStatus && (
                                        <button
                                            onClick={() => updateStatus(selectedOrder.id, getStatusBadge(selectedOrder.status).nextStatus)}
                                            className="w-full bg-brand-primary text-white py-3 rounded-xl font-medium hover:bg-brand-dark transition-colors"
                                        >
                                            העבר ל{getStatusBadge(getStatusBadge(selectedOrder.status).nextStatus).text}
                                        </button>
                                    )}
                                    {selectedOrder.status !== 'cancelled' && selectedOrder.status !== 'delivered' && (
                                        <button
                                            onClick={() => updateStatus(selectedOrder.id, 'cancelled')}
                                            className="w-full bg-red-50 text-red-600 py-3 rounded-xl font-medium hover:bg-red-100 transition-colors"
                                        >
                                            ביטול הזמנה
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-gray-500">
                            <span className="text-4xl mb-4 block">👆</span>
                            <p>בחר הזמנה לצפייה בפרטים</p>
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}
