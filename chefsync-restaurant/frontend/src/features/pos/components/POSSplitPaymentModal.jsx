import { useState, useRef } from 'react';
import { FaShekelSign, FaCreditCard, FaMoneyBillWave, FaTimes, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
import posApi from '../api/posApi';

export default function POSSplitPaymentModal({ cart, total, headers, posToken, discountData, onClose, onSuccess }) {
    const [cashAmount, setCashAmount] = useState('');
    const [creditAmount, setCreditAmount] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingText, setLoadingText] = useState('');
    const [result, setResult] = useState(null);
    // שומר orderId שנוצר כדי למנוע יצירה כפולה
    const createdOrderIdRef = useRef(null);

    const cash = parseFloat(cashAmount) || 0;
    const credit = parseFloat(creditAmount) || 0;
    const remaining = Math.max(0, total - cash - credit);
    const canPay = cash + credit >= total && (cash > 0 || credit > 0);

    // אם הזמנה כבר נוצרה (hold), סגירה צריכה לרענן את הסל והרשימה
    const handleClose = () => {
        if (createdOrderIdRef.current) {
            onSuccess();
        } else {
            onClose();
        }
    };

    const handleCashChange = (val) => {
        setCashAmount(val);
        const c = parseFloat(val) || 0;
        if (c <= total) {
            setCreditAmount((total - c).toFixed(2));
        }
    };

    const handleCreditChange = (val) => {
        setCreditAmount(val);
        const c = parseFloat(val) || 0;
        if (c <= total) {
            setCashAmount((total - c).toFixed(2));
        }
    };

    const handleSplit5050 = () => {
        const half = (total / 2).toFixed(2);
        const other = (total - parseFloat(half)).toFixed(2);
        setCashAmount(half);
        setCreditAmount(other);
    };

    const handlePay = async () => {
        setLoading(true);
        try {
            // שלב 1: יצירת הזמנה (רק אם לא נוצרה כבר)
            let orderId = createdOrderIdRef.current;
            if (!orderId) {
                setLoadingText('יוצר הזמנה...');
                const orderData = {
                    items: cart,
                    payment_method: 'hold',
                    ...(discountData && {
                        discount_type: discountData.discount_type,
                        discount_value: discountData.discount_value,
                        discount_reason: discountData.discount_reason || undefined,
                    }),
                };
                const orderRes = await posApi.createOrder(orderData, headers, posToken);
                if (!orderRes.data.success) {
                    throw new Error(orderRes.data.message || 'שגיאה ביצירת הזמנה');
                }
                orderId = orderRes.data.order?.id;
                createdOrderIdRef.current = orderId;
            }

            // שלב 2: ביצוע תשלום מפוצל
            setLoadingText('ממתין ל-PinPad...');
            const res = await posApi.splitPayment(orderId, cash, credit, headers, posToken);
            if (res.data.success) {
                setResult({ type: 'success', data: res.data });
            }
        } catch (e) {
            setResult({
                type: 'error',
                message: e.response?.data?.message || e.message || 'שגיאה בביצוע תשלום מפוצל',
            });
        } finally {
            setLoading(false);
            setLoadingText('');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[300] flex items-center justify-center p-4" onClick={handleClose}>
            <div className="bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-700 animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>

                {result?.type === 'success' ? (
                    <div className="p-10 text-center space-y-6">
                        <div className="w-24 h-24 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center">
                            <FaCheckCircle className="text-emerald-400 text-5xl" />
                        </div>
                        <div>
                            <p className="text-white text-2xl font-black">תשלום מפוצל אושר</p>
                            <p className="text-emerald-400 text-lg font-bold mt-2">₪{total.toFixed(2)}</p>
                        </div>
                        <div className="bg-slate-900/50 rounded-2xl p-5 space-y-2">
                            {cash > 0 && (
                                <div className="flex justify-between text-slate-300 text-sm font-semibold">
                                    <span className="flex items-center gap-2"><FaMoneyBillWave className="text-emerald-400" /> מזומן</span>
                                    <span>₪{cash.toFixed(2)}</span>
                                </div>
                            )}
                            {credit > 0 && (
                                <div className="flex justify-between text-slate-300 text-sm font-semibold">
                                    <span className="flex items-center gap-2"><FaCreditCard className="text-blue-400" /> אשראי</span>
                                    <span>₪{credit.toFixed(2)}</span>
                                </div>
                            )}
                        </div>
                        <button onClick={() => onSuccess()} className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-lg rounded-2xl active:scale-95">
                            סגור
                        </button>
                    </div>

                ) : result?.type === 'error' ? (
                    <div className="p-10 text-center space-y-6">
                        <div className="w-24 h-24 mx-auto rounded-full bg-red-500/20 flex items-center justify-center">
                            <FaExclamationTriangle className="text-red-400 text-5xl" />
                        </div>
                        <p className="text-white text-xl font-black">התשלום נדחה</p>
                        <p className="text-red-400 font-bold">{result.message}</p>
                        <div className="flex gap-3">
                            <button onClick={() => { setResult(null); handlePay(); }} className="flex-1 py-4 bg-blue-500 text-white font-black rounded-2xl active:scale-95">נסה שוב</button>
                            <button onClick={handleClose} className="px-6 py-4 bg-slate-700 text-slate-300 font-black rounded-2xl active:scale-95">ביטול</button>
                        </div>
                    </div>

                ) : (
                    <div className="p-8 space-y-6">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-black text-white">תשלום מפוצל</h2>
                                <p className="text-slate-400 text-sm">
                                    סה״כ: <span className="text-orange-400 font-black">₪{total.toFixed(2)}</span>
                                </p>
                            </div>
                            {!loading && (
                                <button onClick={handleClose} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-700 transition-all">
                                    <FaTimes size={18} />
                                </button>
                            )}
                        </div>

                        {loading ? (
                            <div className="text-center py-12 space-y-4">
                                <div className="relative w-20 h-20 mx-auto">
                                    <div className="absolute inset-0 rounded-full border-4 border-blue-500/20" />
                                    <div className="absolute inset-0 rounded-full border-4 border-t-blue-500 animate-spin" />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <FaCreditCard className="text-blue-400 text-2xl" />
                                    </div>
                                </div>
                                <p className="text-white text-lg font-black">{loadingText || 'ממתין...'}</p>
                                {loadingText === 'ממתין ל-PinPad...' && (
                                    <p className="text-blue-300 text-sm">בקש מהלקוח להעביר/להכניס כרטיס</p>
                                )}
                            </div>
                        ) : (
                            <>
                                {/* Quick split */}
                                <button onClick={handleSplit5050} className="w-full py-3 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 rounded-xl font-black text-sm active:scale-95">
                                    חלוקה 50/50
                                </button>

                                {/* Cash input */}
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 text-emerald-400 font-black text-sm">
                                        <FaMoneyBillWave /> מזומן
                                    </label>
                                    <div className="relative">
                                        <FaShekelSign className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm" />
                                        <input
                                            type="number"
                                            dir="ltr"
                                            value={cashAmount}
                                            onChange={e => handleCashChange(e.target.value)}
                                            className="w-full pr-10 pl-4 py-3 bg-slate-900 text-white rounded-xl border border-slate-700 focus:border-emerald-500 focus:outline-none text-lg font-bold text-left"
                                            placeholder="0.00"
                                            min="0"
                                            step="0.01"
                                        />
                                    </div>
                                </div>

                                {/* Credit input */}
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 text-blue-400 font-black text-sm">
                                        <FaCreditCard /> אשראי
                                    </label>
                                    <div className="relative">
                                        <FaShekelSign className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm" />
                                        <input
                                            type="number"
                                            dir="ltr"
                                            value={creditAmount}
                                            onChange={e => handleCreditChange(e.target.value)}
                                            className="w-full pr-10 pl-4 py-3 bg-slate-900 text-white rounded-xl border border-slate-700 focus:border-blue-500 focus:outline-none text-lg font-bold text-left"
                                            placeholder="0.00"
                                            min="0"
                                            step="0.01"
                                        />
                                    </div>
                                </div>

                                {remaining > 0.01 && (
                                    <p className="text-red-400 text-sm font-bold text-center">חסר: ₪{remaining.toFixed(2)}</p>
                                )}

                                <button
                                    onClick={handlePay}
                                    disabled={!canPay}
                                    className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-black text-lg rounded-2xl disabled:opacity-30 transition-all active:scale-95 shadow-lg"
                                >
                                    שלם מפוצל ₪{total.toFixed(2)}
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
