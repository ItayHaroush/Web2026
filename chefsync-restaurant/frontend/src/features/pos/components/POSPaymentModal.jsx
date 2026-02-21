import { useState } from 'react';
import { FaShekelSign, FaBackspace, FaCheckCircle, FaTimes, FaMoneyBillWave } from 'react-icons/fa';
import posApi from '../api/posApi';

export default function POSPaymentModal({ cart, total, headers, posToken, onClose, onSuccess }) {
    const [amountTendered, setAmountTendered] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    const amount = parseFloat(amountTendered) || 0;
    const change = amount - total;
    const canPay = amount >= total;

    const quickAmounts = [10, 20, 50, 100, 200].filter(a => a >= total);

    const handleDigit = (d) => {
        if (loading || result) return;
        setAmountTendered(prev => {
            if (d === '.' && prev.includes('.')) return prev;
            return prev + d;
        });
    };

    const handleDelete = () => {
        if (loading || result) return;
        setAmountTendered(prev => prev.slice(0, -1));
    };

    const handleExact = () => {
        setAmountTendered(total.toFixed(2));
    };

    const handlePay = async () => {
        setLoading(true);
        try {
            const res = await posApi.createOrder({
                items: cart,
                payment_method: 'cash',
                amount_tendered: parseFloat(amountTendered),
            }, headers, posToken);

            if (res.data.success) {
                setResult({
                    orderId: res.data.order.id,
                    change: res.data.change,
                    total,
                });
            }
        } catch (e) {
            alert(e.response?.data?.message || 'שגיאה ביצירת הזמנה');
        } finally {
            setLoading(false);
        }
    };

    const digits = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', 'del'];

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[300] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-700 animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
                {result ? (
                    <div className="p-10 text-center space-y-6 animate-in fade-in zoom-in-95 duration-500">
                        <div className="w-24 h-24 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center">
                            <FaCheckCircle className="text-emerald-400 text-5xl" />
                        </div>
                        <div>
                            <p className="text-white text-3xl font-black">הזמנה #{result.orderId}</p>
                            <p className="text-emerald-400 text-xl font-bold mt-2">שולם בהצלחה</p>
                        </div>
                        <div className="bg-slate-900/50 rounded-2xl p-6 space-y-3">
                            <div className="flex justify-between text-slate-300 font-semibold">
                                <span>סה״כ</span>
                                <span>₪{result.total.toFixed(2)}</span>
                            </div>
                            {result.change != null && result.change > 0 && (
                                <div className="flex justify-between text-amber-400 font-black text-xl pt-2 border-t border-slate-700">
                                    <span>עודף</span>
                                    <span>₪{result.change.toFixed(2)}</span>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={() => { onSuccess(); }}
                            className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-lg rounded-2xl active:scale-95"
                        >
                            הזמנה הבאה
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="flex items-center justify-between px-8 pt-8 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-emerald-500/20 rounded-xl">
                                    <FaMoneyBillWave className="text-emerald-400 text-xl" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-white">תשלום מזומן</h2>
                                    <p className="text-slate-400 text-sm">
                                        לתשלום: <span className="text-orange-400 font-black">₪{total.toFixed(2)}</span>
                                    </p>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-700 transition-all">
                                <FaTimes size={18} />
                            </button>
                        </div>

                        <div className="px-8 pb-8 space-y-4">
                            {/* Quick amounts */}
                            <div className="flex gap-2 flex-wrap">
                                <button onClick={handleExact} className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-sm font-black active:scale-95">
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

                            {/* Amount display */}
                            <div className="bg-slate-900 rounded-2xl p-4 text-center border border-slate-700">
                                <p className="text-slate-500 text-xs font-bold mb-1">סכום שהתקבל</p>
                                <p className="text-white text-4xl font-black flex items-center justify-center gap-1">
                                    <FaShekelSign className="text-lg text-slate-500" />
                                    {amountTendered || '0'}
                                </p>
                                {amount > 0 && (
                                    <p className={`text-lg font-black mt-2 ${canPay ? 'text-emerald-400' : 'text-red-400'}`}>
                                        עודף: ₪{change >= 0 ? change.toFixed(2) : `(חסר ${Math.abs(change).toFixed(2)})`}
                                    </p>
                                )}
                            </div>

                            {/* Keypad */}
                            <div className="grid grid-cols-3 gap-2" dir="ltr">
                                {digits.map((d, idx) => {
                                    if (d === 'del') {
                                        return (
                                            <button key={idx} onClick={handleDelete} className="h-14 rounded-xl bg-slate-700/50 hover:bg-slate-700 text-slate-300 flex items-center justify-center active:scale-90">
                                                <FaBackspace size={20} />
                                            </button>
                                        );
                                    }
                                    return (
                                        <button key={idx} onClick={() => handleDigit(d)} className="h-14 rounded-xl bg-slate-700/80 hover:bg-slate-600 text-white text-xl font-black active:scale-90 border border-slate-600/30">
                                            {d}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Pay button */}
                            <button
                                onClick={handlePay}
                                disabled={!canPay || loading}
                                className="w-full py-4 bg-gradient-to-r from-emerald-500 to-green-500 text-white font-black text-lg rounded-2xl disabled:opacity-30 transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
                            >
                                {loading ? 'מעבד...' : `שלם ₪${total.toFixed(2)}`}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
