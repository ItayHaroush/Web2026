import { useState, useEffect, useRef } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import AdminLayout from '../../layouts/AdminLayout';
import api from '../../services/apiClient';

export default function AdminOrders() {
    const { getAuthHeaders } = useAdminAuth();
    const [orders, setOrders] = useState([]);
    const [allOrders, setAllOrders] = useState([]); // כל ההזמנות ללא סינון
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('');
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [newOrderAlert, setNewOrderAlert] = useState(false);
    const previousOrdersCount = useRef(0);
    const audioRef = useRef(null);

    useEffect(() => {
        fetchOrders();
        // רענון אוטומטי כל 10 שניות
        const interval = setInterval(fetchOrders, 10000);
        return () => clearInterval(interval);
    }, [filterStatus]);

    const fetchOrders = async () => {
        try {
            const params = filterStatus ? { status: filterStatus } : {};
            const response = await api.get('/admin/orders', {
                headers: getAuthHeaders(),
                params
            });
            if (response.data.success) {
                const newOrders = response.data.orders.data || response.data.orders;

                // בדיקה אם יש הזמנות חדשות (רק כשמציגים הכל או הזמנות ממתינות)
                if (!filterStatus && previousOrdersCount.current > 0 && newOrders.length > previousOrdersCount.current) {
                    setNewOrderAlert(true);
                    playNotificationSound();
                    setTimeout(() => setNewOrderAlert(false), 5000);
                }

                if (!filterStatus) {
                    previousOrdersCount.current = newOrders.length;
                    setAllOrders(newOrders);
                }

                setOrders(newOrders);
            }
        } catch (error) {
            console.error('Failed to fetch orders:', error);
        } finally {
            setLoading(false);
        }
    };

    const playNotificationSound = () => {
        // צליל התראה באמצעות Audio API
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.value = 0.3;

        oscillator.start();
        setTimeout(() => oscillator.stop(), 200);

        setTimeout(() => {
            const osc2 = audioContext.createOscillator();
            const gain2 = audioContext.createGain();
            osc2.connect(gain2);
            gain2.connect(audioContext.destination);
            osc2.frequency.value = 1000;
            osc2.type = 'sine';
            gain2.gain.value = 0.3;
            osc2.start();
            setTimeout(() => osc2.stop(), 200);
        }, 250);
    };

    const updateStatus = async (orderId, newStatus) => {
        try {
            console.log('Updating order', orderId, 'to status:', newStatus);
            const response = await api.patch(`/admin/orders/${orderId}/status`,
                { status: newStatus },
                { headers: getAuthHeaders() }
            );
            console.log('Update response:', response.data);

            if (response.data.success) {
                // רענון רשימת ההזמנות
                await fetchOrders();

                // עדכון ההזמנה הנבחרת
                if (selectedOrder?.id === orderId) {
                    setSelectedOrder(response.data.order);
                }
            } else {
                console.error('Update failed:', response.data);
                alert('שגיאה בעדכון סטטוס: ' + (response.data.message || 'שגיאה לא ידועה'));
            }
        } catch (error) {
            console.error('Failed to update status:', error);
            console.error('Error details:', error.response?.data);
        }
    };

    const statusOptions = [
        { value: '', label: 'הכל', icon: '📋' },
        { value: 'pending', label: 'ממתין', icon: '⏳' },
        { value: 'received', label: 'התקבל', icon: '📥' },
        { value: 'preparing', label: 'בהכנה', icon: '👨‍🍳' },
        { value: 'ready', label: 'מוכן', icon: '✅' },
        { value: 'delivering', label: 'במשלוח', icon: '🚗' },
        { value: 'delivered', label: 'נמסר', icon: '📦' },
        { value: 'cancelled', label: 'בוטל', icon: '❌' },
    ];

    const getStatusBadge = (status) => {
        const statuses = {
            pending: { text: 'ממתין', color: 'bg-yellow-100 text-yellow-700', nextStatus: 'preparing' },
            received: { text: 'התקבל', color: 'bg-yellow-100 text-yellow-700', nextStatus: 'preparing' },
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
            {/* התרעת הזמנה חדשה */}
            {newOrderAlert && (
                <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-bounce">
                    <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-3">
                        <span className="text-3xl">🔔</span>
                        <div>
                            <p className="font-bold text-lg">הזמנה חדשה!</p>
                            <p className="text-sm opacity-90">יש לך הזמנה חדשה שממתינה</p>
                        </div>
                    </div>
                </div>
            )}

            {/* כותרת ומונה הזמנות ממתינות */}
            <div className="bg-gradient-to-r from-brand-primary to-brand-secondary rounded-2xl shadow-lg p-6 mb-6 text-white">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold mb-1">ניהול הזמנות</h1>
                        <p className="opacity-90">סה"כ {(allOrders.length || orders.length)} הזמנות</p>
                    </div>
                    <div className="text-center">
                        <div className="bg-white/20 rounded-2xl px-6 py-3 backdrop-blur-sm">
                            <p className="text-sm opacity-90">ממתינות</p>
                            <p className="text-4xl font-bold">
                                {(allOrders.length ? allOrders : orders).filter(o => ['pending', 'received'].includes(o.status)).length}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* פילטרים */}
            <div className="bg-white rounded-2xl shadow-sm p-4 mb-6">
                <div className="flex flex-wrap gap-2">
                    {statusOptions.map((option) => {
                        const ordersToCount = allOrders.length ? allOrders : orders;
                        const count = option.value ? ordersToCount.filter(o => o.status === option.value).length : ordersToCount.length;
                        return (
                            <button
                                key={option.value}
                                onClick={() => setFilterStatus(option.value)}
                                className={`px-4 py-2 rounded-xl font-medium transition-all relative ${filterStatus === option.value
                                    ? 'bg-brand-primary text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                {option.icon} {option.label}
                                {count > 0 && (
                                    <span className={`mr-2 px-2 py-0.5 rounded-full text-xs ${filterStatus === option.value
                                        ? 'bg-white/20'
                                        : 'bg-gray-200'
                                        }`}>
                                        {count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
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
                                    const isPending = ['pending', 'received'].includes(order.status);
                                    const isActive = ['pending', 'received', 'preparing', 'ready', 'delivering'].includes(order.status);
                                    const isDelivery = order.delivery_method === 'delivery' || (!!order.delivery_address);

                                    return (
                                        <div
                                            key={order.id}
                                            onClick={() => setSelectedOrder(order)}
                                            className={`p-4 cursor-pointer transition-all relative ${selectedOrder?.id === order.id
                                                ? 'bg-brand-primary/5 border-r-4 border-brand-primary'
                                                : 'hover:bg-gray-50'
                                                } ${isPending ? 'border-r-4 border-yellow-400 bg-yellow-50/30' : ''}`}
                                        >
                                            {isPending && (
                                                <div className="absolute top-2 left-2">
                                                    <span className="flex h-3 w-3">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
                                                    </span>
                                                </div>
                                            )}
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isPending
                                                        ? 'bg-yellow-100 animate-pulse'
                                                        : 'bg-brand-primary/10'
                                                        }`}>
                                                        <span className={`font-bold ${isPending ? 'text-yellow-700' : 'text-brand-primary'
                                                            }`}>#{order.id}</span>
                                                    </div>
                                                    <div>
                                                        <p className={`font-medium ${isPending ? 'text-yellow-900' : 'text-gray-800'
                                                            }`}>{order.customer_name}</p>
                                                        <p className="text-sm text-gray-500">
                                                            {new Date(order.created_at).toLocaleString('he-IL')}
                                                        </p>
                                                        <p className="text-xs text-gray-500 flex items-center gap-1">
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                                                                {isDelivery ? 'משלוח' : 'איסוף עצמי'}
                                                            </span>
                                                            {isDelivery && order.delivery_address && (
                                                                <span className="truncate max-w-[140px]">📍 {order.delivery_address}</span>
                                                            )}
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
                                {/* סטטוס נוכחי */}
                                <div className={`rounded-xl p-4 text-center ${getStatusBadge(selectedOrder.status).color.replace('text-', 'border-').replace('bg-', 'bg-')} border-2`}>
                                    <p className="text-sm opacity-75 mb-1">סטטוס נוכחי</p>
                                    <p className="text-2xl font-bold">{getStatusBadge(selectedOrder.status).text}</p>
                                    <p className="text-xs mt-2 opacity-75">
                                        {new Date(selectedOrder.created_at).toLocaleString('he-IL', {
                                            day: 'numeric',
                                            month: 'long',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </p>
                                    {selectedOrder.updated_by_name && (
                                        <p className="text-xs mt-2 opacity-75 border-t pt-2">
                                            עודכן על ידי: <span className="font-medium">{selectedOrder.updated_by_name}</span>
                                        </p>
                                    )}
                                </div>

                                {/* פרטי לקוח */}
                                <div className="bg-gray-50 rounded-xl p-4">
                                    <h4 className="font-medium text-gray-800 mb-2">👤 פרטי לקוח</h4>
                                    <p className="text-gray-600 font-medium">{selectedOrder.customer_name}</p>
                                    <p className="text-gray-600 dir-ltr text-right">{selectedOrder.customer_phone}</p>
                                    <div className="text-sm text-gray-600 mt-2 space-y-2">
                                        <p className="inline-flex items-center gap-2 px-2 py-1 bg-white rounded-lg">
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">
                                                {selectedOrder.delivery_method === 'delivery' ? 'משלוח' : 'איסוף עצמי'}
                                            </span>
                                            {selectedOrder.delivery_method === 'delivery' && selectedOrder.delivery_address && (
                                                <span>📍 {selectedOrder.delivery_address}</span>
                                            )}
                                        </p>
                                        {selectedOrder.delivery_notes && (
                                            <p className="p-2 bg-white rounded-lg">הערות משלוח: {selectedOrder.delivery_notes}</p>
                                        )}
                                    </div>
                                </div>

                                {/* פריטים */}
                                <div>
                                    <h4 className="font-medium text-gray-800 mb-2">🍽️ פריטים</h4>
                                    <div className="space-y-2">
                                        {selectedOrder.items?.map((item, index) => {
                                            const itemPrice = Number(item.price || item.menu_item?.price || 0);
                                            const itemQuantity = Number(item.quantity || 1);
                                            const subtotal = item.subtotal ? Number(item.subtotal) : (itemPrice * itemQuantity);

                                            return (
                                                <div key={index} className="flex justify-between bg-gray-50 rounded-lg p-3">
                                                    <div>
                                                        <span className="font-medium">{item.menu_item?.name || item.name}</span>
                                                        <span className="text-gray-500 mr-2">x{itemQuantity}</span>
                                                    </div>
                                                    <span className="font-medium">₪{subtotal.toFixed(2)}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* סיכום */}
                                <div className="border-t pt-4">
                                    <div className="flex justify-between text-lg font-bold">
                                        <span>סה"כ</span>
                                        <span>₪{Number(selectedOrder.total || 0).toFixed(2)}</span>
                                    </div>
                                </div>

                                {/* כפתורי פעולה */}
                                <div className="space-y-2">
                                    {(() => {
                                        const currentBadge = getStatusBadge(selectedOrder.status);
                                        const nextStatus = currentBadge.nextStatus;

                                        if (nextStatus) {
                                            const nextBadge = getStatusBadge(nextStatus);
                                            const buttonTexts = {
                                                'preparing': 'אישור והתחלת הכנה',
                                                'ready': 'סיום הכנה - מוכן',
                                                'delivering': 'שליחה למשלוח',
                                                'delivered': 'אישור מסירה ללקוח'
                                            };

                                            return (
                                                <button
                                                    onClick={() => updateStatus(selectedOrder.id, nextStatus)}
                                                    className="w-full bg-gradient-to-r from-brand-primary to-brand-secondary text-white py-4 rounded-xl font-bold text-lg hover:shadow-lg transition-all transform hover:scale-105"
                                                >
                                                    {buttonTexts[nextStatus] || `העבר ל${nextBadge.text}`}
                                                </button>
                                            );
                                        }
                                        return null;
                                    })()}

                                    {selectedOrder.status !== 'cancelled' && selectedOrder.status !== 'delivered' && (
                                        <button
                                            onClick={() => {
                                                if (confirm('האם אתה בטוח שברצונך לבטל הזמנה זו?')) {
                                                    updateStatus(selectedOrder.id, 'cancelled');
                                                }
                                            }}
                                            className="w-full bg-red-50 text-red-600 py-3 rounded-xl font-medium hover:bg-red-100 transition-colors"
                                        >
                                            ❌ ביטול הזמנה
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
