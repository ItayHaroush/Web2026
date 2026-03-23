import { useState, useRef } from 'react';
import { FaTimes, FaCopy, FaWhatsapp, FaCheckCircle, FaMoneyBillWave, FaSpinner } from 'react-icons/fa';
import api from '../../services/apiClient';
import { paymentStatusBadgeLabel } from '../../utils/orderPaymentLabels';

function digitsForWhatsApp(phone) {
    if (!phone || typeof phone !== 'string') return null;
    let d = phone.replace(/\D/g, '');
    if (!d) return null;
    if (d.startsWith('972')) return d;
    if (d.startsWith('0')) return `972${d.slice(1)}`;
    if (d.length === 9) return `972${d}`;
    return d;
}

async function copyTextRobust(text) {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch {
        /* clipboard API often fails outside HTTPS or without focus — fallback below */
    }
    try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        ta.style.top = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
    } catch {
        return false;
    }
}

/**
 * טיפול ידני: קישור תשלום, וואטסאפ, סימון שולם, החלפה למזומן.
 */
export default function OrderManualPaymentModal({ order, getAuthHeaders, onClose, onUpdated }) {
    const [paymentLinkBusy, setPaymentLinkBusy] = useState(false);
    const [markPaidBusy, setMarkPaidBusy] = useState(false);
    const [switchCashBusy, setSwitchCashBusy] = useState(false);
    const [toast, setToast] = useState('');
    const toastTimerRef = useRef(null);

    if (!order) return null;

    const total = Number(order.total_amount ?? order.total ?? 0);
    const waDigits = digitsForWhatsApp(order.customer_phone);

    const showToast = (msg, isError = false) => {
        setToast(msg);
        if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = window.setTimeout(() => setToast(''), isError ? 5000 : 3000);
    };

    const handlePaymentLink = async (mode) => {
        setPaymentLinkBusy(true);
        try {
            const res = await api.post(`/admin/orders/${order.id}/payment-link`, {}, { headers: getAuthHeaders() });
            const url = res.data?.payment_url;
            if (!res.data?.success || !url) {
                showToast(res.data?.message || 'לא ניתן ליצור קישור', true);
                return;
            }
            if (mode === 'whatsapp') {
                if (!waDigits) {
                    const copied = await copyTextRobust(url);
                    showToast(copied ? 'אין מספר טלפון — הקישור הועתק ללוח' : 'אין מספר טלפון — לא ניתן להעתיק ללוח');
                    return;
                }
                const text = encodeURIComponent(`היי, להשלמת התשלום להזמנה #${order.id}:\n${url}`);
                window.open(`https://wa.me/${waDigits}?text=${text}`, '_blank', 'noopener,noreferrer');
            } else {
                const copied = await copyTextRobust(url);
                if (copied) {
                    showToast('קישור התשלום הועתק ללוח');
                } else {
                    window.prompt('העתקו את הקישור לתשלום:', url);
                }
            }
        } catch (e) {
            showToast(e.response?.data?.message || 'שגיאה ביצירת קישור', true);
        } finally {
            setPaymentLinkBusy(false);
        }
    };

    const handleMarkPaid = async () => {
        if (!window.confirm('לסמן את ההזמנה כשולמה ידנית?')) return;
        setMarkPaidBusy(true);
        try {
            const res = await api.post(`/admin/orders/${order.id}/mark-paid`, {}, { headers: getAuthHeaders() });
            if (res.data?.success) {
                showToast('ההזמנה סומנה כשולמה');
                onUpdated?.(res.data.order);
            } else {
                showToast(res.data?.message || 'שגיאה', true);
            }
        } catch (e) {
            showToast(e.response?.data?.message || 'שגיאה בסימון', true);
        } finally {
            setMarkPaidBusy(false);
        }
    };

    const handleSwitchToCash = async () => {
        if (!window.confirm('להחליף את ההזמנה למזומן? הלקוח ישלם בקופה או במסירה.')) return;
        setSwitchCashBusy(true);
        try {
            const res = await api.post(`/admin/orders/${order.id}/switch-to-cash`, {}, { headers: getAuthHeaders() });
            if (res.data?.success) {
                showToast('אמצעי התשלום עודכן למזומן');
                onUpdated?.(res.data.order);
            } else {
                showToast(res.data?.message || 'שגיאה', true);
            }
        } catch (e) {
            showToast(e.response?.data?.message || 'שגיאה בעדכון', true);
        } finally {
            setSwitchCashBusy(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
            role="presentation"
        >
            <div
                className="bg-white rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-gray-100"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-100">
                    <div>
                        <h2 className="text-lg font-black text-gray-900">טיפול ידני בתשלום</h2>
                        <p className="text-sm font-bold text-gray-600 mt-1">
                            הזמנה #{order.id} · {order.customer_name || '—'}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                            סה״כ ₪{total.toFixed(2)}
                            {order.payment_method === 'credit_card' && (
                                <span className={`mr-2 font-black ${order.payment_status === 'failed' ? 'text-red-600' : order.payment_status === 'paid' ? 'text-emerald-600' : 'text-amber-600'}`}>
                                    · {paymentStatusBadgeLabel(order)}
                                </span>
                            )}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-xl text-gray-400 hover:bg-gray-50 hover:text-gray-700"
                        aria-label="סגור"
                    >
                        <FaTimes size={18} />
                    </button>
                </div>

                {toast && (
                    <div className="mx-5 mt-4 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-100 text-amber-900 text-sm font-bold text-center">
                        {toast}
                    </div>
                )}

                <div className="p-5 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                            type="button"
                            disabled={paymentLinkBusy}
                            onClick={() => handlePaymentLink('copy')}
                            className="flex items-center justify-center gap-2 bg-slate-50 text-slate-800 border border-slate-200 p-3 rounded-2xl font-bold text-xs hover:bg-slate-100 transition-all disabled:opacity-50"
                        >
                            {paymentLinkBusy ? <FaSpinner className="animate-spin" size={14} /> : <FaCopy size={14} />}
                            העתק קישור לתשלום
                        </button>
                        <button
                            type="button"
                            disabled={paymentLinkBusy || !waDigits}
                            title={!waDigits ? 'אין מספר טלפון בהזמנה' : undefined}
                            onClick={() => handlePaymentLink('whatsapp')}
                            className="flex items-center justify-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-200 p-3 rounded-2xl font-bold text-xs hover:bg-emerald-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {paymentLinkBusy ? <FaSpinner className="animate-spin" size={14} /> : <FaWhatsapp size={16} />}
                            וואטסאפ
                        </button>
                    </div>

                    <button
                        type="button"
                        disabled={markPaidBusy}
                        onClick={handleMarkPaid}
                        className="w-full flex items-center justify-center gap-2 bg-green-50 text-green-800 border border-green-200 p-3 rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-green-100 transition-all disabled:opacity-50"
                    >
                        {markPaidBusy ? <FaSpinner className="animate-spin" size={14} /> : <FaCheckCircle size={14} />}
                        סמן כשולם ידנית
                    </button>

                    <button
                        type="button"
                        disabled={switchCashBusy}
                        onClick={handleSwitchToCash}
                        className="w-full flex items-center justify-center gap-2 bg-amber-50 text-amber-900 border border-amber-200 p-3 rounded-2xl font-black text-xs hover:bg-amber-100 transition-all disabled:opacity-50"
                    >
                        {switchCashBusy ? <FaSpinner className="animate-spin" size={14} /> : <FaMoneyBillWave size={14} />}
                        החלף למזומן
                    </button>
                </div>
            </div>
        </div>
    );
}
