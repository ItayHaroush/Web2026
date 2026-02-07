import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CustomerLayout } from '../layouts/CustomerLayout';
import { FaMask, FaBoxOpen, FaUser, FaPhone, FaClock, FaInfoCircle, FaUtensils, FaShoppingBag, FaCheckCircle, FaExclamationTriangle, FaMapMarkerAlt } from 'react-icons/fa';
import orderService from '../services/orderService';
import { ORDER_STATUS, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../constants/api';
import RatingWidget from '../components/RatingWidget';
import api from '../services/apiClient';
import CountdownTimer from '../components/CountdownTimer';

/**
 * פורמט מספר טלפון ישראלי
 * @param {string} phone - מספר טלפון בפורמט E.164 (+972501234567)
 * @returns {string} - מספר מפורמט (050-123-4567)
 */
function formatIsraeliPhone(phone) {
    if (!phone) return '';
    // הסרת + ו-972
    let cleaned = phone.replace(/\+972/, '0').replace(/\D/g, '');
    // פורמט: 050-123-4567
    if (cleaned.length === 10) {
        return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone; // אם לא תקין, החזר כמו שהוא
}

/**
 * עמוד סטטוס הזמנה
 * @param {boolean} isPreviewMode - האם זה מצב תצוגה מקדימה (admin)
 */

export default function OrderStatusPage({ isPreviewMode = false }) {
    const { tenantId: urlTenantId, orderId } = useParams();
    const { tenantId, loginAsCustomer } = useAuth();
    const navigate = useNavigate();
    const [order, setOrder] = useState(null);
    const [restaurant, setRestaurant] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [fatalErrorMessage, setFatalErrorMessage] = useState('');
    const [shouldPoll, setShouldPoll] = useState(true);
    const [errorCount, setErrorCount] = useState(0);
    const [precheckPassed, setPrecheckPassed] = useState(false);
    const [etaAlert, setEtaAlert] = useState('');
    const [cancelNotice, setCancelNotice] = useState('');
    const [showStatusCard, setShowStatusCard] = useState(true);
    const etaUpdatedAtRef = useRef(null);
    const statusRef = useRef(null);
    const initialLoadRef = useRef(true);

    // מצב דירוג
    const [selectedRating, setSelectedRating] = useState(null);
    const [reviewText, setReviewText] = useState('');
    const [submittingReview, setSubmittingReview] = useState(false);
    const [reviewSuccess, setReviewSuccess] = useState(false);

    // קביעת effectiveTenantId - מה-URL או מ-localStorage במצב preview
    const effectiveTenantId = isPreviewMode
        ? (tenantId || localStorage.getItem('tenantId'))
        : urlTenantId;

    // הבטחת כתובת קאנונית עם tenant בסלאג - לא במצב preview
    useEffect(() => {
        // אם זה מצב preview, דלג על הניווט הזה
        if (isPreviewMode) {
            setPrecheckPassed(true);
            return;
        }

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
    }, [urlTenantId, tenantId, loginAsCustomer, orderId, navigate, isPreviewMode]);

    useEffect(() => {
        if (isPreviewMode) {
            // במצב preview, פשוט מאשרים
            setPrecheckPassed(true);
            return;
        }

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
    }, [orderId, urlTenantId, isPreviewMode]);

    // Fetch restaurant info
    useEffect(() => {
        if (effectiveTenantId) {
            api.get(`/restaurants/by-tenant/${encodeURIComponent(effectiveTenantId)}`)
                .then(response => setRestaurant(response.data?.data))
                .catch(err => console.error('Failed to load restaurant:', err));
        }
    }, [effectiveTenantId]);



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
            const nextOrder = data.data;
            setOrder(nextOrder);
            setErrorCount(0);
            const isCancelled = nextOrder?.status === 'cancelled';

            if (isCancelled) {
                setCancelNotice('ההזמנה בוטלה על ידי המסעדה. ניתן לבצע הזמנה חדשה או לפנות למסעדה.');
                setShouldPoll(false);

                const tenantKey = urlTenantId || tenantId || localStorage.getItem('tenantId');
                if (tenantKey) {
                    localStorage.removeItem(`activeOrder_${tenantKey}`);
                }
            } else if (!shouldPoll) {
                setShouldPoll(true);
            }

            const nextEtaUpdatedAt = nextOrder?.eta_updated_at || null;
            if (etaUpdatedAtRef.current && nextEtaUpdatedAt && etaUpdatedAtRef.current !== nextEtaUpdatedAt) {
                const etaText = nextOrder?.eta_minutes
                    ? `זמן ההזמנה עודכן ל-${nextOrder.eta_minutes} דקות`
                    : 'זמן ההזמנה עודכן';
                setEtaAlert(etaText);
                setTimeout(() => setEtaAlert(''), 6000);
                playNotificationSound();
            }
            etaUpdatedAtRef.current = nextEtaUpdatedAt;

            if (statusRef.current && nextOrder?.status && statusRef.current !== nextOrder.status) {
                playNotificationSound();
            }
            statusRef.current = nextOrder?.status || statusRef.current;

            if (initialLoadRef.current) {
                initialLoadRef.current = false;
            }

            if (data.data?.status === ORDER_STATUS.DELIVERED) {
                const tenantKey = effectiveTenantId;
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
    }, [orderId, effectiveTenantId, shouldPoll, precheckPassed]);

    const playNotificationSound = () => {
        try {
            const audio = new Audio('/sounds/Order-up-bell-sound.mp3');
            audio.volume = 0.5;
            audio.play().catch(err => {
                console.log('לא ניתן להשמיע התראה:', err);
            });
        } catch (e) {
            // ignore audio errors
        }
    };

    useEffect(() => {
        if (!effectiveTenantId || !precheckPassed) {
            return;
        }
        loadOrder({ withLoading: true });
        setErrorCount(0);
        setShouldPoll(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orderId, effectiveTenantId, precheckPassed]);

    useEffect(() => {
        if (!shouldPoll || !effectiveTenantId || !precheckPassed) {
            return undefined;
        }
        const interval = setInterval(() => loadOrder({ withLoading: false }), 5000);
        return () => clearInterval(interval);
    }, [shouldPoll, loadOrder, effectiveTenantId, precheckPassed]);

    const handleRetry = () => {
        setShouldPoll(true);
        setFatalErrorMessage('');
        loadOrder({ withLoading: true });
    };

    const handleCloseCancelNotice = () => {
        setCancelNotice('');
        setShowStatusCard(false);
    };

    if (loading) {
        const content = (
            <div className="flex justify-center items-center h-64">
                <p className="text-lg text-gray-600 dark:text-brand-dark-muted">טוען...</p>
            </div>
        );

        // במצב preview לא צריך CustomerLayout (כבר יש AdminLayout)
        return isPreviewMode ? content : <CustomerLayout>{content}</CustomerLayout>;
    }

    if (error || !order) {
        const content = (
            <div className="bg-red-50 border border-red-200 text-red-900 px-3 sm:px-4 py-4 sm:py-6 rounded-2xl space-y-3 sm:space-y-4">
                <div>
                    <p className="font-semibold text-base sm:text-lg">{error}</p>
                    {fatalErrorMessage ? (
                        <p className="text-sm text-red-700 mt-2">עצרתנו את בדיקות הסטטוס כדי שלא תתבצע פניה חוזרת ללא צורך.</p>
                    ) : (
                        <p className="text-sm text-red-700 mt-2">נצרת הפעילות האוטומטית לאחר מספר שגיאות. אפשר לנסות שוב ידנית.</p>
                    )}
                </div>
                {fatalErrorMessage ? (
                    <button
                        onClick={() => navigate('/')}
                        className="w-full sm:w-auto bg-red-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-red-700 transition whitespace-nowrap"
                    >
                        חזרה לבחירת מסעדה
                    </button>
                ) : (
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                        <button
                            onClick={handleRetry}
                            className="w-full sm:w-auto bg-brand-primary text-white px-4 py-2 rounded-lg text-sm hover:bg-brand-secondary transition"
                        >
                            נסה שוב
                        </button>
                        <button
                            onClick={() => navigate('/')}
                            className="w-full sm:w-auto bg-gray-200 dark:bg-brand-dark-border text-gray-800 dark:text-brand-dark-text px-4 py-2 rounded-lg text-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                        >
                            חזרה לבחירת מסעדה
                        </button>
                    </div>
                )}
            </div>
        );

        // במצב preview לא צריך CustomerLayout (כבר יש AdminLayout)
        return isPreviewMode ? content : <CustomerLayout>{content}</CustomerLayout>;
    }

    // פונקציה לשליחת דירוג
    const handleSubmitReview = async () => {
        if (!selectedRating) {
            alert('אנא בחר דירוג');
            return;
        }

        setSubmittingReview(true);
        try {
            const response = await api.post(`/orders/${orderId}/review`, {
                rating: selectedRating,
                review_text: reviewText.trim() || null,
            });

            if (response.data.success) {
                setReviewSuccess(true);
                // עדכון ההזמנה במצב
                setOrder(prev => ({
                    ...prev,
                    rating: selectedRating,
                    review_text: reviewText.trim() || null,
                    reviewed_at: new Date().toISOString(),
                }));
            }
        } catch (error) {
            console.error('❌ שגיאה בשליחת דירוג:', error);
            console.error('Error response:', error.response?.data);
            alert('שגיאה בשליחת הדירוג. אנא נסה שוב.');
        } finally {
            setSubmittingReview(false);
        }
    };

    // בניית שלבי סטטוס דינמי לפי סוג משלוח
    const isDeliveryOrder = order.delivery_method === 'delivery';

    const statusSteps = isDeliveryOrder
        ? [
            { value: ORDER_STATUS.RECEIVED, label: ORDER_STATUS_LABELS.received },
            { value: ORDER_STATUS.PREPARING, label: ORDER_STATUS_LABELS.preparing },
            { value: ORDER_STATUS.READY, label: ORDER_STATUS_LABELS.ready },
            { value: ORDER_STATUS.DELIVERING, label: ORDER_STATUS_LABELS.delivering },
            { value: ORDER_STATUS.DELIVERED, label: ORDER_STATUS_LABELS.delivered },
        ]
        : [
            { value: ORDER_STATUS.RECEIVED, label: ORDER_STATUS_LABELS.received },
            { value: ORDER_STATUS.PREPARING, label: ORDER_STATUS_LABELS.preparing },
            { value: ORDER_STATUS.READY, label: 'מוכן לאיסוף' }, // תווית מותאמת לאיסוף
            { value: ORDER_STATUS.DELIVERED, label: 'נמסר' },
        ];

    const currentStepIndex = statusSteps.findIndex((s) => s.value === order.status);
    const isCancelled = order.status === 'cancelled';
    const statusLabel = ORDER_STATUS_LABELS[order.status] ?? 'בוטל';
    const statusColor = ORDER_STATUS_COLORS[order.status] ?? 'bg-red-100 text-red-700';

    const content = (
        <div className="space-y-8">
            {/* תג דמו */}
            {restaurant?.is_demo && (
                <div className="max-w-2xl mx-auto bg-gradient-to-r from-amber-100 to-orange-100 border-2 border-amber-400 rounded-2xl p-3 shadow-lg">
                    <div className="flex items-center justify-center gap-2">
                        <FaMask className="text-2xl text-orange-500" />
                        <span className="font-bold text-amber-900">הזמנה להמחשה - לא אמיתית</span>
                    </div>
                </div>
            )}

            <div className="text-center">
                <h1 className="text-2xl sm:text-3xl font-bold text-brand-primary mb-2">סטטוס הזמנה</h1>
                <p className="text-sm sm:text-base text-gray-600 dark:text-brand-dark-muted">הזמנה #{order.id}</p>
            </div>

            {etaAlert && (
                <div className="max-w-2xl mx-auto bg-amber-50 border border-amber-200 text-amber-800 px-3 sm:px-4 py-2 sm:py-3 rounded-xl text-center text-sm sm:text-base">
                    {etaAlert}
                </div>
            )}

            {cancelNotice && (
                <div className="max-w-2xl mx-auto bg-red-50 border border-red-200 text-red-900 px-3 sm:px-4 py-3 sm:py-4 rounded-xl flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-4">
                    <div className="flex-1">
                        <p className="font-semibold text-base sm:text-lg">ההזמנה בוטלה</p>
                        <p className="text-xs sm:text-sm text-red-800 mt-1">{cancelNotice}</p>
                    </div>
                    <button
                        onClick={handleCloseCancelNotice}
                        className="bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 transition"
                    >
                        סגור
                    </button>
                </div>
            )}

            {/* כרטיס הזמנה */}
            {showStatusCard && (
                <div className="bg-white dark:bg-brand-dark-surface rounded-2xl shadow-lg dark:shadow-black/20 border border-gray-200 dark:border-brand-dark-border p-6 sm:p-8 max-w-3xl mx-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6">
                        <div className="flex items-start gap-3">
                            <div className="mt-1 text-brand-primary">
                                <FaUser className="text-lg" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-gray-500 dark:text-brand-dark-muted uppercase tracking-wide mb-1">שם לקוח</p>
                                <p className="font-bold text-gray-900 dark:text-brand-dark-text">{order.customer_name}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="mt-1 text-green-600">
                                <FaPhone className="text-lg" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-gray-500 dark:text-brand-dark-muted uppercase tracking-wide mb-1">טלפון</p>
                                <p className="font-bold text-gray-900 dark:text-brand-dark-text dir-ltr text-right">{formatIsraeliPhone(order.customer_phone)}</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <div className="mt-1 text-purple-600">
                                <FaClock className="text-lg" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-gray-500 dark:text-brand-dark-muted uppercase tracking-wide mb-1">זמן הזמנה</p>
                                <p className="font-bold text-gray-900 dark:text-brand-dark-text">
                                    {new Date(order.created_at).toLocaleString('he-IL', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="mt-1 text-orange-600">
                                <FaInfoCircle className="text-lg" />
                            </div>
                            <div className="flex-1">
                                <p className="text-xs font-semibold text-gray-500 dark:text-brand-dark-muted uppercase tracking-wide mb-1">זמן הכנה משוער</p>
                                {order.eta_minutes ? (
                                    <div className="flex items-center gap-2">
                                        <p className="font-bold text-gray-900 dark:text-brand-dark-text">{order.eta_minutes} דקות</p>
                                        {order.eta_note && (
                                            <div className="relative group">
                                                <button
                                                    type="button"
                                                    className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 text-xs font-bold flex items-center justify-center hover:bg-orange-200 transition"
                                                    aria-label="מידע נוסף על זמן משוער"
                                                >
                                                    <FaInfoCircle />
                                                </button>
                                                <div className="absolute z-10 hidden group-hover:block group-focus-within:block top-7 right-0 bg-gray-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg max-w-xs whitespace-pre-wrap">
                                                    {order.eta_note}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500 dark:text-brand-dark-muted">ממתין לאישור המסעדה</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* שעון ספירה לאחור */}
                    {!isCancelled && (
                        <div className="my-6">
                            <CountdownTimer
                                startTime={order.created_at}
                                etaMinutes={order.eta_minutes}
                                etaNote={order.eta_note}
                                deliveryMethod={order.delivery_method}
                                orderStatus={order.status}
                            >
                                {/* ביקורת מוטמעת בתוך המודל */}
                                {order.status === ORDER_STATUS.DELIVERED && !order.rating && !reviewSuccess && (
                                    <div className="w-full space-y-4">
                                        <div className="border-t border-green-200 pt-4">
                                            <h3 className="text-lg sm:text-xl font-black text-gray-900 dark:text-brand-dark-text mb-3 text-center">
                                                איך הייתה החוויה?
                                            </h3>

                                            {/* ווידג'ט דירוג */}
                                            <div className="py-2">
                                                <RatingWidget
                                                    value={selectedRating}
                                                    onChange={setSelectedRating}
                                                    size="md"
                                                />
                                            </div>

                                            {/* שדה טקסט */}
                                            <div className="max-w-md mx-auto mt-3">
                                                <textarea
                                                    value={reviewText}
                                                    onChange={(e) => setReviewText(e.target.value)}
                                                    placeholder="ספר לנו על החוויה שלך (אופציונלי)"
                                                    className="w-full p-3 border-2 border-gray-200 dark:border-brand-dark-border rounded-xl resize-none focus:border-green-400 focus:ring-2 focus:ring-green-100 outline-none transition-all text-sm dark:bg-brand-dark-bg dark:text-brand-dark-text"
                                                    rows={2}
                                                    maxLength={500}
                                                />
                                                <p className="text-xs text-gray-500 dark:text-brand-dark-muted mt-1 text-right">
                                                    {reviewText.length}/500 תווים
                                                </p>
                                            </div>

                                            {/* כפתור שליחה */}
                                            <button
                                                onClick={handleSubmitReview}
                                                disabled={!selectedRating || submittingReview}
                                                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-3 rounded-xl font-bold text-base hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 active:scale-95 shadow-md mt-3"
                                            >
                                                {submittingReview ? 'שולח...' : 'שלח ביקורת'}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* הצגת תודה אחרי שליחת דירוג */}
                                {(order.rating || reviewSuccess) && order.status === ORDER_STATUS.DELIVERED && (
                                    <div className="w-full border-t border-green-200 pt-4 text-center space-y-3">
                                        <h3 className="text-xl font-black text-gray-900 dark:text-brand-dark-text">
                                            תודה על הדירוג! 💚
                                        </h3>
                                        {order.rating && (
                                            <div className="pt-2">
                                                <RatingWidget
                                                    value={order.rating}
                                                    readOnly
                                                    size="sm"
                                                />
                                                {order.review_text && (
                                                    <div className="mt-3 bg-white/60 dark:bg-brand-dark-bg/60 rounded-xl p-3 text-xs sm:text-sm text-gray-700 dark:text-gray-300 italic">
                                                        "{order.review_text}"
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </CountdownTimer>
                        </div>
                    )}

                    {!isCancelled && (
                        <>
                            {/* סטטוס סרגל */}
                            <div className="bg-gray-50 dark:bg-brand-dark-border/50 rounded-xl p-6 space-y-4">
                                <div className="flex items-center gap-2 mb-4">
                                    <FaCheckCircle className="text-brand-primary" />
                                    <p className="text-sm font-bold text-gray-700 dark:text-gray-300">מעקב התקדמות</p>
                                </div>

                                <div className="relative flex justify-between items-start">
                                    {/* קו רקע */}
                                    <div className="absolute top-5 right-5 left-5 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" style={{ zIndex: 0 }}></div>
                                    {/* קו מלא */}
                                    <div
                                        className="absolute top-5 right-5 h-1 bg-gradient-to-l from-green-500 to-brand-primary rounded-full transition-all duration-500"
                                        style={{
                                            width: `calc(${(currentStepIndex / (statusSteps.length - 1)) * 100}% - 2.5rem)`,
                                            zIndex: 1
                                        }}
                                    ></div>

                                    {statusSteps.map((step, index) => (
                                        <div key={step.value} className="flex flex-col items-center flex-1 relative" style={{ zIndex: 2 }}>
                                            <div
                                                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm mb-2 border-2 transition-all ${index <= currentStepIndex
                                                    ? 'bg-gradient-to-br from-brand-primary to-green-500 text-white border-transparent shadow-lg'
                                                    : 'bg-white dark:bg-brand-dark-bg text-gray-400 dark:text-gray-500 border-gray-300 dark:border-gray-600'
                                                    }`}
                                            >
                                                {index < currentStepIndex ? <FaCheckCircle /> : index + 1}
                                            </div>
                                            <p className={`text-xs text-center font-medium ${index <= currentStepIndex ? 'text-gray-900 dark:text-brand-dark-text' : 'text-gray-500 dark:text-brand-dark-muted'
                                                }`}>{step.label}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* סטטוס נוכחי */}
                            <div className={`mt-6 p-5 rounded-xl text-center ${statusColor} border-2`}>
                                <p className="text-xl sm:text-2xl font-black">
                                    {statusLabel}
                                </p>
                            </div>
                        </>
                    )}

                    {isCancelled && (
                        <div className="mt-6 p-6 rounded-xl text-center bg-red-50 border-2 border-red-300">
                            <div className="flex flex-col items-center gap-3">
                                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                                    <FaExclamationTriangle className="text-3xl text-red-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-black text-red-900">{statusLabel}</p>
                                    <p className="text-sm mt-2 text-red-700">ההזמנה לא תטופל. אפשר לבצע הזמנה חדשה.</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* פרטי פריטים */}
            {order.items && order.items.length > 0 && (
                <div className="space-y-4 max-w-3xl mx-auto">
                    {/* פרטי כתובת משלוח - רק במשלוח */}
                    {order.delivery_method === 'delivery' && order.delivery_address && (
                        <div className="bg-gradient-to-br from-orange-50 to-brand-cream dark:from-orange-900/20 dark:to-brand-dark-surface rounded-xl p-5 border-2 border-brand-primary/30 dark:border-brand-dark-border space-y-3">
                            <div className="flex items-center gap-2 mb-2">
                                <FaMapMarkerAlt className="text-xl text-brand-primary" />
                                <h2 className="text-lg font-black text-gray-900 dark:text-brand-dark-text">כתובת משלוח</h2>
                            </div>
                            <p className="text-base font-bold text-gray-800 dark:text-gray-200">{order.delivery_address}</p>
                            {order.delivery_notes && (
                                <div className="bg-white/60 dark:bg-brand-dark-bg/60 rounded-lg p-3 border border-brand-primary/20 dark:border-brand-dark-border">
                                    <p className="text-xs font-semibold text-gray-500 dark:text-brand-dark-muted mb-1">הערות לשליח:</p>
                                    <p className="text-sm text-gray-700 dark:text-gray-300">{order.delivery_notes}</p>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex items-center gap-2">
                        <FaUtensils className="text-xl text-brand-primary" />
                        <h2 className="text-xl font-black text-gray-900 dark:text-brand-dark-text">פריטי ההזמנה</h2>
                    </div>
                    {order.items.map((item) => {
                        const quantity = item.quantity ?? item.qty ?? 1;
                        const unitPrice = Number(item.price_at_order) || 0;
                        const variantDelta = Number(item.variant_price_delta) || 0;
                        const addonsTotal = Number(item.addons_total) || 0;
                        const basePrice = Math.max(unitPrice - variantDelta - addonsTotal, 0);
                        const lineTotal = (unitPrice * quantity).toFixed(2);
                        const addons = Array.isArray(item.addons) ? item.addons : [];
                        const hasCustomizations = Boolean(item.variant_name) || addonsTotal > 0 || variantDelta > 0;

                        return (
                            <div key={item.id} className="bg-white dark:bg-brand-dark-surface border border-gray-200 dark:border-brand-dark-border rounded-xl p-4 sm:p-5 space-y-2 hover:shadow-md dark:hover:shadow-black/20 transition-shadow">
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="font-semibold text-gray-900 dark:text-brand-dark-text">
                                            {(item.menuItem?.name || item.menu_item?.name || item.name || 'פריט')}× {quantity}
                                        </div>
                                        {unitPrice > 0 && (
                                            <div className="font-semibold text-gray-900 dark:text-brand-dark-text">₪{lineTotal}</div>
                                        )}
                                    </div>
                                    {item.variant_name && (
                                        <div className="text-sm text-gray-700 dark:text-gray-300">סוג לחם: {item.variant_name}</div>
                                    )}
                                    {addons.length > 0 && (
                                        <>
                                            {addons.filter(a => !a.on_side).length > 0 && (
                                                <div className="text-sm text-gray-700 dark:text-gray-300">
                                                    תוספות: {addons.filter(a => !a.on_side).map(a => a.name).join(' · ')}
                                                </div>
                                            )}
                                            {addons.filter(a => a.on_side).length > 0 && (
                                                <div className="text-sm text-orange-600 font-medium flex items-center gap-1">
                                                    <FaBoxOpen />
                                                    <span>בצד: {addons.filter(a => a.on_side).map(a => a.name).join(' · ')}</span>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                                {hasCustomizations && (
                                    <div className="text-sm text-gray-700 dark:text-gray-300">
                                        {[
                                            basePrice > 0 ? `בסיס: ₪${basePrice.toFixed(2)}` : null,
                                            variantDelta > 0 ? `סוג לחם: ₪${variantDelta.toFixed(2)}` : null,
                                            addonsTotal > 0 ? `תוספות: ₪${addonsTotal.toFixed(2)}` : null,
                                        ]
                                            .filter(Boolean)
                                            .join(' · ')}
                                    </div>
                                )}
                                {unitPrice > 0 && (
                                    <div className="text-xs text-gray-600 dark:text-brand-dark-muted">₪{unitPrice.toFixed(2)} ליחידה</div>
                                )}


                            </div>
                        );
                    })}

                    {/* פירוט מחיר */}
                    <div className="bg-gradient-to-br from-brand-cream to-orange-50 dark:from-brand-dark-surface dark:to-orange-900/20 rounded-xl p-5 space-y-3 border border-gray-200 dark:border-brand-dark-border shadow-sm dark:shadow-black/20">
                        <div className="flex items-center justify-between text-gray-700 dark:text-gray-300">
                            <span>סכום ביניים</span>
                            <span>₪{(Number(order.total_amount || 0) - Number(order.delivery_fee || 0)).toFixed(2)}</span>
                        </div>
                        {order.delivery_method === 'delivery' && order.delivery_fee > 0 && (
                            <div className="flex items-center justify-between text-gray-700 dark:text-gray-300">
                                <span>
                                    משלוח
                                    {order.delivery_distance_km && (
                                        <span className="text-sm text-gray-500 dark:text-brand-dark-muted"> ({Number(order.delivery_distance_km).toFixed(1)} ק"מ)</span>
                                    )}
                                </span>
                                <span>₪{Number(order.delivery_fee).toFixed(2)}</span>
                            </div>
                        )}
                        <div className="border-t border-gray-300 dark:border-brand-dark-border pt-2 flex items-center justify-between text-lg font-bold text-gray-900 dark:text-brand-dark-text">
                            <span>סה"כ</span>
                            <span>₪{Number(order.total_amount || 0).toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* ניווט */}
            <div className="text-center">
                <button
                    onClick={() => navigate(isPreviewMode ? '/admin/preview-menu' : '/menu')}
                    className="bg-gradient-to-r from-brand-primary to-orange-600 text-white px-8 py-4 rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg dark:shadow-black/20 hover:shadow-xl transform hover:scale-105 active:scale-95 inline-flex items-center gap-3 font-bold"
                >
                    <FaShoppingBag className="text-lg" />
                    <span>חזור לתפריט</span>
                </button>
            </div>
        </div>
    );

    // במצב preview לא צריך CustomerLayout (כבר יש AdminLayout)
    return isPreviewMode ? content : <CustomerLayout>{content}</CustomerLayout>;
}
