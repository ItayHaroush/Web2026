import { useState, useEffect } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import AdminLayout from '../../layouts/AdminLayout';
import api from '../../services/apiClient';

// מסוף סניף לעובדים/שליחים: מציג הזמנות פתוחות ומאפשר עדכון סטטוס מהיר
export default function AdminTerminal() {
    const { getAuthHeaders, isEmployee, isDelivery } = useAdminAuth();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchOrders();
        const interval = setInterval(fetchOrders, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchOrders = async () => {
        try {
            const response = await api.get('/admin/orders', {
                headers: getAuthHeaders(),
                params: { status: 'pending' }
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

    const updateStatus = async (orderId, status) => {
        try {
            await api.patch(`/admin/orders/${orderId}/status`, { status }, { headers: getAuthHeaders() });
            fetchOrders();
        } catch (error) {
            console.error('Failed to update status:', error);
        }
    };

    const nextStatus = (status) => {
        const flow = {
            pending: 'preparing',
            preparing: 'ready',
            ready: isDelivery() ? 'delivering' : 'delivered',
            delivering: 'delivered',
        };
        return flow[status] || null;
    };

    const statusLabel = {
        pending: 'ממתין',
        preparing: 'בהכנה',
        ready: 'מוכן',
        delivering: 'במשלוח',
        delivered: 'נמסר',
        cancelled: 'בוטל',
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
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">🖥️ מסוף סניף</h1>
                    <p className="text-gray-500">הזמנות ממתינות / בהכנה</p>
                </div>
                <button
                    onClick={fetchOrders}
                    className="px-4 py-2 bg-gray-100 rounded-lg text-gray-700 hover:bg-gray-200"
                >
                    רענן
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {orders.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-gray-500 md:col-span-2 lg:col-span-3">
                        <span className="text-4xl mb-4 block">📭</span>
                        <p>אין הזמנות פתוחות</p>
                    </div>
                ) : (
                    orders.map((order) => (
                        <div key={order.id} className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-bold text-lg">#{order.id}</p>
                                    <p className="text-sm text-gray-500">{order.customer_name}</p>
                                </div>
                                <span className="text-sm px-3 py-1 rounded-full bg-orange-100 text-orange-700">
                                    {statusLabel[order.status] || order.status}
                                </span>
                            </div>

                            <div className="space-y-2 max-h-40 overflow-y-auto">
                                {order.items?.map((item, idx) => (
                                    <div key={idx} className="flex justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                                        <span>{item.menu_item?.name || item.name}</span>
                                        <span className="text-gray-600">x{item.quantity}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="flex justify-between items-center">
                                <span className="font-bold text-gray-800">₪{order.total}</span>
                                {nextStatus(order.status) ? (
                                    <button
                                        onClick={() => updateStatus(order.id, nextStatus(order.status))}
                                        className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-dark"
                                    >
                                        קדם ל{statusLabel[nextStatus(order.status)]}
                                    </button>
                                ) : (
                                    <span className="text-sm text-gray-500">אין פעולות</span>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </AdminLayout>
    );
}
