import { useState } from 'react';
import { FaTimes, FaMoneyBillWave, FaCreditCard, FaCheckCircle, FaShekelSign } from 'react-icons/fa';
import posApi from '../api/posApi';
import POSAmountKeypad from './POSAmountKeypad';

export default function CashDeliveryModal({ isOpen, order, headers, posToken, onConfirm, onClose }) {
    const [amountTendered, setAmountTendered] = useState('');
    const [processing, setProcessing] = useState(false);
    const [result, setResult] = useState(null);

    if (!isOpen || !order) return null;

    const paidViaQr = order.payment_status === 'paid' && order.source !== 'pos';
    const total = order.total_price || 0;
    const totalDisplay = total.toFixed(2);
    const amount = parseFloat(amountTendered) || 0;
    const change = amount - total;
    const canPay = amount >= total;
    const quickAmounts = [10, 20, 50, 100, 200].filter(a => a >= total);

    const handleClose = () => {
        setAmountTendered('');
        setProcessing(false);
        setResult(null);
        onClose();
    };

    const handlePayCashAndDeliver = async () => {
        if (!canPay) return;
        setProcessing(true);
        try {
            const res = await posApi.payPendingOrderCash(order.id, parseFloat(amountTendered), headers, posToken);
            if (res.data.success) {
                setResult({
                    change: res.data.change,
                    total: res.data.total,
                });
                onConfirm(order.id, 'cash');
            }
        } catch (e) {
            alert(e.response?.data?.message || 'שגיאה בביצוע תשלום');
            setProcessing(false);
        }
    };

    if (paidViaQr) {
        return (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" dir="rtl">
                <div className="bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-emerald-500/30">
                    <div className="bg-emerald-900/40 px-5 py-4 flex items-center justify-between border-b border-emerald-800/50">
                        <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 bg-emerald-800/50 rounded-xl flex items-center justify-center">
                                <FaCreditCard className="text-emerald-400" size={16} />
                            </div>
                            <div>
                                <h3 className="font-black text-white text-base">מסירת הזמנה #{order.id}</h3>
                                <p className="text-xs text-emerald-400">{order.customer_name}</p>
                            </div>
                        </div>
                        <button onClick={handleClose} className="text-gray-400 hover:text-gray-300 p-1 transition">
                            <FaTimes size={18} />
                        </button>
                    </div>

                    <div className="p-6 space-y-4 text-center">
                        <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
                            <FaCheckCircle className="text-emerald-400" size={32} />
                        </div>
                        <p className="text-emerald-300 font-black text-lg">ההזמנה שולמה באשראי</p>
                        <p className="text-slate-400 text-sm">הלקוח שילם דרך קישור תשלום / QR</p>
                        <div className="bg-slate-800/60 rounded-xl p-4">
                            <p className="text-slate-500 text-xs font-bold mb-1">סכום ששולם</p>
                            <p className="text-emerald-400 font-black text-2xl flex items-center justify-center gap-1">
                                <FaShekelSign size={16} />{totalDisplay}
                            </p>
                        </div>
                    </div>

                    <div className="px-5 pb-5 pt-2">
                        <button
                            onClick={() => { onConfirm(order.id, 'credit_card'); handleClose(); }}
                            className="w-full bg-emerald-600 text-white font-black py-3.5 rounded-xl hover:bg-emerald-700 active:scale-95 transition-all text-sm"
                        >
                            אישור מסירה
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (result) {
        return (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" dir="rtl">
                <div className="bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-emerald-500/30 p-8 text-center space-y-5">
                    <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
                        <FaCheckCircle className="text-emerald-400" size={40} />
                    </div>
                    <p className="text-white text-2xl font-black">הזמנה #{order.id}</p>
                    <p className="text-emerald-400 text-lg font-bold">שולם ונמסר בהצלחה</p>
                    {(result.change != null && result.change > 0) && (
                        <div className="bg-slate-800/60 rounded-xl p-4">
                            <p className="text-amber-400 font-black text-2xl flex items-center justify-center gap-1">
                                עודף: <FaShekelSign size={14} />{Number(result.change).toFixed(2)}
                            </p>
                        </div>
                    )}
                    <button
                        onClick={handleClose}
                        className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black rounded-xl active:scale-95 transition-all"
                    >
                        סגור
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" dir="rtl">
            <div className="bg-gray-900 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-amber-500/30">
                <div className="flex items-center justify-between px-6 pt-6 pb-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-500/20 rounded-xl">
                            <FaMoneyBillWave className="text-emerald-400 text-lg" />
                        </div>
                        <div>
                            <h3 className="font-black text-white text-lg">תשלום מזומן ומסירה</h3>
                            <p className="text-slate-400 text-sm">
                                הזמנה #{order.id} — {order.customer_name} — <span className="text-orange-400 font-black">₪{totalDisplay}</span>
                            </p>
                        </div>
                    </div>
                    {!processing && (
                        <button onClick={handleClose} className="text-gray-400 hover:text-gray-300 p-1 transition">
                            <FaTimes size={18} />
                        </button>
                    )}
                </div>

                {processing ? (
                    <div className="px-6 pb-8 text-center py-10 space-y-4">
                        <div className="animate-spin rounded-full h-14 w-14 border-t-4 border-b-4 border-emerald-500 mx-auto" />
                        <p className="text-white text-lg font-black">מעבד תשלום...</p>
                    </div>
                ) : (
                    <div className="px-6 pb-6 space-y-4">
                        <div className="flex gap-2 flex-wrap">
                            <button onClick={() => setAmountTendered(total.toFixed(2))} className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-sm font-black active:scale-95">
                                מדויק
                            </button>
                            {quickAmounts.map(a => (
                                <button
                                    key={a}
                                    onClick={() => setAmountTendered(String(a))}
                                    className="px-4 py-2 bg-slate-700/50 border border-slate-600/50 text-slate-300 rounded-xl text-sm font-black active:scale-95 hover:bg-slate-700"
                                >
                                    ₪{a}
                                </button>
                            ))}
                        </div>

                        <div className="bg-slate-800 rounded-2xl p-4 text-center border border-slate-700">
                            <p className="text-slate-500 text-xs font-bold mb-1">סכום שהתקבל</p>
                            <p className="text-white text-3xl font-black flex items-center justify-center gap-1">
                                <FaShekelSign className="text-lg text-slate-500" />
                                {amountTendered || '0'}
                            </p>
                            {amount > 0 && (
                                <p className={`text-lg font-black mt-2 ${canPay ? 'text-emerald-400' : 'text-red-400'}`}>
                                    עודף: ₪{change >= 0 ? change.toFixed(2) : `(חסר ${Math.abs(change).toFixed(2)})`}
                                </p>
                            )}
                        </div>

                        <POSAmountKeypad
                            value={amountTendered}
                            onChange={setAmountTendered}
                            disabled={processing}
                        />

                        <button
                            onClick={handlePayCashAndDeliver}
                            disabled={!canPay}
                            className="w-full py-4 bg-gradient-to-r from-emerald-500 to-green-500 text-white font-black text-lg rounded-2xl disabled:opacity-30 transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
                        >
                            שלם ומסור ₪{totalDisplay}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
