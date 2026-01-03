import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CustomerLayout } from '../layouts/CustomerLayout';
import orderService from '../services/orderService';
import { ORDER_STATUS, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../constants/api';

/**
 * עמוד סטטוס הזמנה
 */

export default function OrderStatusPage() {
    const { orderId } = useParams();
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const loadOrder = async () => {
        try {
            setError(null);
            const data = await orderService.getOrder(orderId);
            setOrder(data.data);
        } catch (err) {
            console.error('שגיאה בטעינת סטטוס הזמנה:', err);
            setError('לא הצלחנו לטעון את סטטוס ההזמנה');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadOrder();
        // Polling כל 5 שניות
        const interval = setInterval(loadOrder, 5000);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orderId]);

    if (loading) {
        return (
            <CustomerLayout>
                <div className="flex justify-center items-center h-64">
                    <p className="text-lg text-gray-600">טוען...</p>
                </div>
            </CustomerLayout>
        );
    }

    if (error || !order) {
        return (
            <CustomerLayout>
                <div className="bg-red-100 border border-red-400 text-red-900 px-4 py-3 rounded">
                    <p>{error}</p>
                    <button
                        onClick={loadOrder}
                        className="mt-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition"
                    >
                        נסה שוב
                    </button>
                </div>
            </CustomerLayout>
        );
    }

    const statusSteps = [
        { value: ORDER_STATUS.RECEIVED, label: ORDER_STATUS_LABELS.received },
        { value: ORDER_STATUS.PREPARING, label: ORDER_STATUS_LABELS.preparing },
        { value: ORDER_STATUS.READY, label: ORDER_STATUS_LABELS.ready },
        { value: ORDER_STATUS.DELIVERED, label: ORDER_STATUS_LABELS.delivered },
    ];

    const currentStepIndex = statusSteps.findIndex((s) => s.value === order.status);

    return (
        <CustomerLayout>
            <div className="space-y-8">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-brand-primary mb-2">סטטוס הזמנה</h1>
                    <p className="text-gray-600">הזמנה #{order.id}</p>
                </div>

                {/* כרטיס הזמנה */}
                <div className="bg-white border-2 border-brand-primary rounded-lg p-6 max-w-2xl mx-auto">
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div>
                            <p className="text-sm text-gray-600 mb-1">שם</p>
                            <p className="font-semibold text-gray-900">{order.customer_name}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600 mb-1">טלפון</p>
                            <p className="font-semibold text-gray-900">{order.customer_phone}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600 mb-1">סכום כללי</p>
                            <p className="font-semibold text-brand-accent text-lg">₪{order.total_amount}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600 mb-1">זמן הזמנה</p>
                            <p className="font-semibold text-gray-900">
                                {new Date(order.created_at).toLocaleString('he-IL')}
                            </p>
                        </div>
                    </div>

                    {/* סטטוס סרגל */}
                    <div className="space-y-4">
                        <p className="text-sm font-semibold text-gray-700">התקדמות:</p>

                        <div className="flex justify-between items-center">
                            {statusSteps.map((step, index) => (
                                <div key={step.value} className="flex flex-col items-center flex-1">
                                    <div
                                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white mb-2 ${index <= currentStepIndex ? 'bg-brand-accent' : 'bg-gray-300'
                                            }`}
                                    >
                                        {index < currentStepIndex ? '✓' : index + 1}
                                    </div>
                                    <p className="text-xs text-center text-gray-700">{step.label}</p>

                                    {/* קו ביניים */}
                                    {index < statusSteps.length - 1 && (
                                        <div
                                            className={`h-1 flex-1 mx-1 mt-3 ${index < currentStepIndex ? 'bg-brand-accent' : 'bg-gray-300'
                                                }`}
                                            style={{ width: '100%' }}
                                        ></div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* סטטוס נוכחי */}
                    <div className={`mt-6 p-4 rounded-lg text-center ${ORDER_STATUS_COLORS[order.status]}`}>
                        <p className="text-2xl font-bold">
                            {ORDER_STATUS_LABELS[order.status]}
                        </p>
                    </div>
                </div>

                {/* פרטי פריטים */}
                {order.items && order.items.length > 0 && (
                    <div className="space-y-3">
                        <h2 className="text-xl font-bold text-gray-900">פרטי הזמנה:</h2>
                        {order.items.map((item) => (
                            <div key={item.id} className="bg-gray-50 border border-gray-200 rounded p-3 flex justify-between">
                                <span>{item.menuItem?.name || 'פריט'} × {item.quantity}</span>
                                <span className="font-semibold">₪{(item.price_at_order * item.quantity).toFixed(2)}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* ניווט */}
                <div className="text-center">
                    <a
                        href="/menu"
                        className="bg-brand-primary text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition inline-block"
                    >
                        חזור לתפריט
                    </a>
                </div>
            </div>
        </CustomerLayout>
    );
}
