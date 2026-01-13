import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CustomerLayout } from '../layouts/CustomerLayout';
import orderService from '../services/orderService';
import { ORDER_STATUS, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../constants/api';

/**
 * עמוד סטטוס הזמנה
 */

export default function OrderStatusPage() {
    const { tenantId: urlTenantId, orderId } = useParams();
    const { tenantId, loginAsCustomer } = useAuth();
    const navigate = useNavigate();
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [fatalErrorMessage, setFatalErrorMessage] = useState('');
    const [shouldPoll, setShouldPoll] = useState(true);
    const [errorCount, setErrorCount] = useState(0);
    const [precheckPassed, setPrecheckPassed] = useState(false);

    // הבטחת כתובת קאנונית עם tenant בסלאג
    useEffect(() => {
        if (!urlTenantId) {
            if (typeof loginAsCustomer === 'function' && tenantId !== urlTenantId) {
                loginAsCustomer(urlTenantId);
            }
            return;
        }

        const fallbackTenant = tenantId || localStorage.getItem('tenantId');
        if (fallbackTenant) {
            navigate(`/${fallbackTenant}/order-status/${orderId}`, { replace: true });
        } else {
            navigate('/', { replace: true });
        }
    }, [urlTenantId, tenantId, loginAsCustomer, orderId, navigate]);

    useEffect(() => {
        if (!orderId || !urlTenantId) {
            return;
        }

        const recordedTenant = localStorage.getItem(`order_tenant_${orderId}`);
        if (recordedTenant && recordedTenant !== urlTenantId) {
            const message = 'ההזמנה לא קיימת במסעדה שנבחרה';
            setFatalErrorMessage(message);
            setError(message);
            setShouldPoll(false);
            setLoading(false);
            setPrecheckPassed(false);
            return;
        }

        setPrecheckPassed(true);
    }, [orderId, urlTenantId]);

    const loadOrder = useCallback(async ({ withLoading = false } = {}) => {
        if (!orderId || !urlTenantId || !precheckPassed) {
            return;
        }

        if (withLoading) {
            setLoading(true);
        }

        try {
            setError(null);
            setFatalErrorMessage('');
            const data = await orderService.getOrder(orderId);
            setOrder(data.data);
            setErrorCount(0);
            if (!shouldPoll) {
                setShouldPoll(true);
            }

            if (data.data?.status === ORDER_STATUS.DELIVERED) {
                const tenantKey = urlTenantId || tenantId || localStorage.getItem('tenantId');
                if (tenantKey) {
                    localStorage.removeItem(`activeOrder_${tenantKey}`);
                }
            }
        } catch (err) {
            console.error('שגיאה בטעינת סטטוס הזמנה:', err);
            const statusCode = err?.response?.status;
            if (statusCode === 404) {
                const message = 'ההזמנה לא קיימת במסעדה שנבחרה';
                setFatalErrorMessage(message);
                setError(message);
                setShouldPoll(false);
            } else {
                setError('לא הצלחנו לטעון את סטטוס ההזמנה');
                setErrorCount((prev) => {
                    const next = prev + 1;
                    if (next >= 3) {
                        setShouldPoll(false);
                    }
                    return next;
                });
            }
        } finally {
            if (withLoading) {
                setLoading(false);
            }
        }
    }, [orderId, tenantId, urlTenantId, shouldPoll, precheckPassed]);

    useEffect(() => {
        if (!urlTenantId || !precheckPassed) {
            return;
        }
        loadOrder({ withLoading: true });
        setErrorCount(0);
        setShouldPoll(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orderId, urlTenantId, precheckPassed]);

    useEffect(() => {
        if (!shouldPoll || !urlTenantId || !precheckPassed) {
            return undefined;
        }
        const interval = setInterval(() => loadOrder({ withLoading: false }), 5000);
        return () => clearInterval(interval);
    }, [shouldPoll, loadOrder, urlTenantId, precheckPassed]);

    const handleRetry = () => {
        setShouldPoll(true);
        setFatalErrorMessage('');
        loadOrder({ withLoading: true });
    };

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
                <div className="bg-red-50 border border-red-200 text-red-900 px-4 py-6 rounded-2xl space-y-4">
                    <div>
                        <p className="font-semibold text-lg">{error}</p>
                        {fatalErrorMessage ? (
                            <p className="text-sm text-red-700 mt-2">עצרתנו את בדיקות הסטטוס כדי שלא תתבצע פניה חוזרת ללא צורך.</p>
                        ) : (
                            <p className="text-sm text-red-700 mt-2">נצרת הפעילות האוטומטית לאחר מספר שגיאות. אפשר לנסות שוב ידנית.</p>
                        )}
                    </div>
                    {fatalErrorMessage ? (
                        <button
                            onClick={() => navigate('/')}
                            className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition"
                        >
                            חזרה לבחירת מסעדה
                        </button>
                    ) : (
                        <div className="flex gap-3">
                            <button
                                onClick={handleRetry}
                                className="bg-brand-primary text-white px-4 py-2 rounded-lg hover:bg-brand-secondary transition"
                            >
                                נסה שוב
                            </button>
                            <button
                                onClick={() => navigate('/')}
                                className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 transition"
                            >
                                חזרה לבחירת מסעדה
                            </button>
                        </div>
                    )}
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
                        {order.items.map((item) => {
                            const quantity = item.quantity ?? item.qty ?? 1;
                            const unitPrice = Number(item.price_at_order) || 0;
                            const variantDelta = Number(item.variant_price_delta) || 0;
                            const addonsTotal = Number(item.addons_total) || 0;
                            const basePrice = Math.max(unitPrice - variantDelta - addonsTotal, 0);
                            const lineTotal = (unitPrice * quantity).toFixed(2);
                            const addons = Array.isArray(item.addons) ? item.addons : [];

                            return (
                                <div key={item.id} className="bg-gray-50 border border-gray-200 rounded p-4 space-y-2">
                                    <div className="flex justify-between items-start gap-3">
                                        <div className="space-y-1">
                                            <div className="font-semibold text-gray-900">
                                                {item.menuItem?.name || 'פריט'}
                                                <span className="text-gray-700 font-normal"> × {quantity}</span>
                                            </div>
                                            {item.variant_name && (
                                                <div className="text-sm text-gray-700">וריאציה: {item.variant_name}</div>
                                            )}
                                            {addons.length > 0 && (
                                                <div className="text-sm text-gray-700">
                                                    תוספות: {addons.map((addon) => addon.name).join(', ')}
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <div className="font-semibold text-gray-900">₪{lineTotal}</div>
                                            <div className="text-xs text-gray-600">₪{unitPrice.toFixed(2)} ליחידה</div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-gray-700">
                                        <div className="bg-white border rounded px-2 py-1">בסיס: ₪{basePrice.toFixed(2)}</div>
                                        <div className="bg-white border rounded px-2 py-1">וריאציה: ₪{variantDelta.toFixed(2)}</div>
                                        <div className="bg-white border rounded px-2 py-1">תוספות: ₪{addonsTotal.toFixed(2)}</div>
                                        <div className="bg-white border rounded px-2 py-1">סה"כ יחידה: ₪{unitPrice.toFixed(2)}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* ניווט */}
                <div className="text-center">
                    <button
                        onClick={() => navigate('/menu')}
                        className="bg-brand-primary text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition inline-block"
                    >
                        חזור לתפריט
                    </button>
                </div>
            </div>
        </CustomerLayout>
    );
}
