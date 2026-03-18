import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CustomerLayout } from '../layouts/CustomerLayout';
import { useCustomer } from '../context/CustomerContext';
import apiClient from '../services/apiClient';
import { FaShoppingBag, FaRedo, FaArrowRight, FaClock, FaTruck, FaStore, FaExclamationTriangle } from 'react-icons/fa';

/**
 * עמוד היסטוריית הזמנות לקוח
 */
export default function CustomerOrderHistory() {
    const navigate = useNavigate();
    const { customer, customerToken, isRecognized, openUserModal } = useCustomer();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [reordering, setReordering] = useState(null);

    useEffect(() => {
        if (!isRecognized || !customerToken) {
            setLoading(false);
            return;
        }

        const fetchOrders = async () => {
            try {
                const response = await apiClient.get('/customer/orders', {
                    headers: { Authorization: `Bearer ${customerToken}` },
                });
                if (response.data?.success) {
                    setOrders(response.data.data);
                }
            } catch (err) {
                setError('שגיאה בטעינת ההזמנות');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchOrders();
    }, [customerToken, isRecognized]);

    const handleReorder = async (orderId, tenantId) => {
        setReordering(orderId);
        try {
            const response = await apiClient.post(`/customer/reorder/${orderId}`, {}, {
                headers: { Authorization: `Bearer ${customerToken}` },
            });

            if (response.data?.success) {
                const { restaurant_tenant_id, items, unavailable } = response.data.data;

                // שמור פריטים ב-localStorage לטעינה ע"י CartContext
                localStorage.setItem('reorder_items', JSON.stringify(items));
                localStorage.setItem('reorder_tenant', restaurant_tenant_id);

                // אם יש פריטים לא זמינים, הצג הודעה
                if (unavailable?.length > 0) {
                    localStorage.setItem('reorder_unavailable', JSON.stringify(unavailable));
                }

                navigate(`/${restaurant_tenant_id}/menu`);
            }
        } catch (err) {
            console.error('Reorder failed:', err);
        } finally {
            setReordering(null);
        }
    };

    if (!isRecognized) {
        return (
            <CustomerLayout>
                <div className="text-center py-16 space-y-4">
                    <FaShoppingBag className="mx-auto text-5xl text-gray-300" />
                    <h2 className="text-xl font-bold text-gray-900 dark:text-brand-dark-text">היסטוריית הזמנות</h2>
                    <p className="text-gray-500 dark:text-brand-dark-muted">יש להתחבר כדי לראות את ההזמנות שלך</p>
                    <button
                        onClick={openUserModal}
                        className="bg-brand-primary text-white px-6 py-3 rounded-xl font-bold hover:bg-brand-secondary transition"
                    >
                        התחבר עכשיו
                    </button>
                </div>
            </CustomerLayout>
        );
    }

    if (loading) {
        return (
            <CustomerLayout>
                <div className="flex justify-center items-center h-64">
                    <p className="text-lg text-gray-600 dark:text-brand-dark-muted">טוען הזמנות...</p>
                </div>
            </CustomerLayout>
        );
    }

    return (
        <CustomerLayout>
            <div className="space-y-6 max-w-2xl mx-auto">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-black text-gray-900 dark:text-brand-dark-text">ההזמנות שלי</h1>
                    <button
                        onClick={() => navigate('/')}
                        className="text-brand-primary hover:text-brand-secondary transition flex items-center gap-1 text-sm font-bold"
                    >
                        <FaArrowRight size={12} />
                        <span>חזרה</span>
                    </button>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                        <FaExclamationTriangle className="text-red-500" />
                        <p className="text-red-700 text-sm">{error}</p>
                    </div>
                )}

                {orders.length === 0 && !error && (
                    <div className="text-center py-12 space-y-3">
                        <FaShoppingBag className="mx-auto text-5xl text-gray-300" />
                        <p className="text-gray-500 dark:text-brand-dark-muted">עדיין אין הזמנות</p>
                    </div>
                )}

                {orders.map((order) => (
                    <div key={order.id} className="bg-white dark:bg-brand-dark-surface rounded-2xl shadow-md dark:shadow-black/20 border border-gray-200 dark:border-brand-dark-border overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-brand-dark-border/30 border-b border-gray-100 dark:border-brand-dark-border">
                            <div className="flex items-center gap-3">
                                {order.restaurant_logo_url ? (
                                    <img src={order.restaurant_logo_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
                                ) : (
                                    <div className="w-10 h-10 rounded-lg bg-brand-primary/10 flex items-center justify-center">
                                        <FaStore className="text-brand-primary" />
                                    </div>
                                )}
                                <div>
                                    <p className="font-bold text-gray-900 dark:text-brand-dark-text text-sm">{order.restaurant_name}</p>
                                    <p className="text-xs text-gray-500 dark:text-brand-dark-muted flex items-center gap-1">
                                        <FaClock size={10} />
                                        {new Date(order.created_at).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>

                            <div className="text-left">
                                <p className="font-bold text-gray-900 dark:text-brand-dark-text">₪{Number(order.total_amount).toFixed(2)}</p>
                                <div className="flex items-center gap-1 text-xs text-gray-500">
                                    {order.delivery_method === 'delivery' ? <FaTruck size={10} /> : <FaStore size={10} />}
                                    <span>{order.delivery_method === 'delivery' ? 'משלוח' : 'איסוף'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Items */}
                        <div className="p-4 space-y-2">
                            {order.items?.slice(0, 4).map((item, i) => (
                                <div key={i} className="flex items-center justify-between text-sm">
                                    <span className="text-gray-700 dark:text-gray-300">
                                        {item.name} × {item.quantity}
                                        {item.variant_name && <span className="text-gray-400 mr-1">({item.variant_name})</span>}
                                        {item.is_gift && <span className="text-brand-primary mr-1 text-xs">(מתנה)</span>}
                                    </span>
                                    {item.price_at_order > 0 && (
                                        <span className="text-gray-600 dark:text-gray-400">₪{(item.price_at_order * item.quantity).toFixed(2)}</span>
                                    )}
                                </div>
                            ))}
                            {order.items?.length > 4 && (
                                <p className="text-xs text-gray-400">+{order.items.length - 4} פריטים נוספים</p>
                            )}
                        </div>

                        {/* Reorder button */}
                        <div className="p-4 pt-0">
                            <button
                                onClick={() => handleReorder(order.id, order.restaurant_tenant_id)}
                                disabled={reordering === order.id}
                                className="w-full flex items-center justify-center gap-2 bg-brand-primary/10 text-brand-primary rounded-xl px-4 py-3 font-bold text-sm hover:bg-brand-primary/20 transition disabled:opacity-50"
                            >
                                <FaRedo size={14} className={reordering === order.id ? 'animate-spin' : ''} />
                                <span>{reordering === order.id ? 'מכין הזמנה...' : 'הזמן שוב'}</span>
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </CustomerLayout>
    );
}
