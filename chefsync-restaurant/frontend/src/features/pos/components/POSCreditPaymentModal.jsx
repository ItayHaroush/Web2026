import { useState } from 'react';
import { FaCreditCard, FaCheckCircle, FaTimes, FaExclamationTriangle, FaRedo } from 'react-icons/fa';
import posApi from '../api/posApi';

export default function POSCreditPaymentModal({ cart, total, headers, posToken, orderType = 'takeaway', customerName = '', onClose, onSuccess }) {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null); // { type: 'success' | 'error', data }
    const [retrying, setRetrying] = useState(false);

    const handlePay = async () => {
        setLoading(true);
        setResult(null);
        try {
            const res = await posApi.createOrderCredit({
                items: cart,
                order_type: orderType,
                ...(customerName.trim() && { customer_name: customerName.trim() }),
            }, headers, posToken);

            if (res.data.success) {
                setResult({
                    type: 'success',
                    data: {
                        orderId: res.data.order?.id,
                        total,
                        payment: res.data.payment,
                    },
                });
            }
        } catch (e) {
            const responseData = e.response?.data;
            setResult({
                type: 'error',
                data: {
                    message: responseData?.message || 'שגיאה בביצוע העסקה',
                    orderId: responseData?.order_id,
                    payment: responseData?.payment,
                },
            });
        } finally {
            setLoading(false);
            setRetrying(false);
        }
    };

    const handleRetry = () => {
        const failedOrderId = result?.data?.orderId;
        setRetrying(true);
        setResult(null);
        setLoading(true);

        if (failedOrderId) {
            // retry charging existing order
            posApi.chargeOrderCredit(failedOrderId, headers, posToken)
                .then(res => {
                    if (res.data.success) {
                        setResult({
                            type: 'success',
                            data: {
                                orderId: failedOrderId,
                                total,
                                payment: res.data.payment,
                            },
                        });
                    }
                })
                .catch(e => {
                    setResult({
                        type: 'error',
                        data: {
                            message: e.response?.data?.message || 'שגיאה בביצוע העסקה',
                            orderId: failedOrderId,
                            payment: e.response?.data?.payment,
                        },
                    });
                })
                .finally(() => {
                    setLoading(false);
                    setRetrying(false);
                });
        } else {
            handlePay();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[300] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-700 animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>

                {/* Success */}
                {result?.type === 'success' ? (
                    <div className="p-10 text-center space-y-6 animate-in fade-in zoom-in-95 duration-500">
                        <div className="w-24 h-24 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center">
                            <FaCheckCircle className="text-emerald-400 text-5xl" />
                        </div>
                        <div>
                            <p className="text-white text-3xl font-black">הזמנה #{result.data.orderId}</p>
                            <p className="text-emerald-400 text-xl font-bold mt-2">תשלום אשראי אושר</p>
                        </div>
                        <div className="bg-slate-900/50 rounded-2xl p-6 space-y-3">
                            <div className="flex justify-between text-slate-300 font-semibold">
                                <span>סה״כ</span>
                                <span>₪{result.data.total.toFixed(2)}</span>
                            </div>
                            {result.data.payment?.approval_code && (
                                <div className="flex justify-between text-slate-400 text-sm">
                                    <span>אישור</span>
                                    <span dir="ltr">{result.data.payment.approval_code}</span>
                                </div>
                            )}
                            {result.data.payment?.card_last4 && (
                                <div className="flex justify-between text-slate-400 text-sm">
                                    <span>כרטיס</span>
                                    <span dir="ltr">****{result.data.payment.card_last4}</span>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={() => onSuccess()}
                            className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-lg rounded-2xl active:scale-95"
                        >
                            הזמנה הבאה
                        </button>
                    </div>

                /* Error / Declined */
                ) : result?.type === 'error' ? (
                    <div className="p-10 text-center space-y-6 animate-in fade-in zoom-in-95 duration-500">
                        <div className="w-24 h-24 mx-auto rounded-full bg-red-500/20 flex items-center justify-center">
                            <FaExclamationTriangle className="text-red-400 text-5xl" />
                        </div>
                        <div>
                            <p className="text-white text-2xl font-black">העסקה נדחתה</p>
                            <p className="text-red-400 text-base font-bold mt-2">{result.data.message}</p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={handleRetry}
                                className="flex-1 py-4 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-black text-lg rounded-2xl active:scale-95 flex items-center justify-center gap-2"
                            >
                                <FaRedo size={14} /> נסה שוב
                            </button>
                            <button
                                onClick={onClose}
                                className="px-6 py-4 bg-slate-700 text-slate-300 font-black text-lg rounded-2xl active:scale-95"
                            >
                                ביטול
                            </button>
                        </div>
                    </div>

                /* Initial / Loading state */
                ) : (
                    <div className="p-8 space-y-6">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-blue-500/20 rounded-xl">
                                    <FaCreditCard className="text-blue-400 text-xl" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-white">תשלום אשראי</h2>
                                    <p className="text-slate-400 text-sm">
                                        לתשלום: <span className="text-orange-400 font-black">₪{total.toFixed(2)}</span>
                                    </p>
                                </div>
                            </div>
                            {!loading && (
                                <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-700 transition-all">
                                    <FaTimes size={18} />
                                </button>
                            )}
                        </div>

                        {loading ? (
                            /* PinPad waiting state */
                            <div className="text-center py-12 space-y-6 animate-in fade-in duration-300">
                                <div className="relative w-28 h-28 mx-auto">
                                    <div className="absolute inset-0 rounded-full border-4 border-blue-500/20" />
                                    <div className="absolute inset-0 rounded-full border-4 border-t-blue-500 animate-spin" />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <FaCreditCard className="text-blue-400 text-3xl" />
                                    </div>
                                </div>
                                <div>
                                    <p className="text-white text-xl font-black">ממתין ל-PinPad...</p>
                                    <p className="text-slate-400 text-sm mt-2">
                                        בקש מהלקוח להעביר/להכניס כרטיס
                                    </p>
                                </div>
                                <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4">
                                    <p className="text-blue-300 text-sm font-semibold">
                                        אל תסגור חלון זה — התהליך עשוי להימשך עד דקה
                                    </p>
                                </div>
                            </div>
                        ) : (
                            /* Confirm & Pay */
                            <div className="space-y-4">
                                <div className="bg-slate-900/50 rounded-2xl p-5 space-y-3">
                                    <div className="flex justify-between text-slate-300 font-semibold text-sm">
                                        <span>פריטים</span>
                                        <span>{cart.reduce((s, c) => s + c.quantity, 0)}</span>
                                    </div>
                                    <div className="flex justify-between text-white font-black text-xl pt-2 border-t border-slate-700">
                                        <span>סה״כ לחיוב</span>
                                        <span>₪{total.toFixed(2)}</span>
                                    </div>
                                </div>

                                <button
                                    onClick={handlePay}
                                    className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-black text-lg rounded-2xl transition-all active:scale-95 shadow-lg shadow-blue-500/20 flex items-center justify-center gap-3"
                                >
                                    <FaCreditCard /> חייב באשראי
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
