import { useState, useEffect, useCallback } from 'react';
import { FaTimes, FaShekelSign, FaCreditCard, FaMoneyBillWave, FaClock, FaGlobe, FaDesktop, FaCashRegister, FaCheckCircle, FaExclamationTriangle, FaBackspace, FaUtensils } from 'react-icons/fa';
import posApi from '../api/posApi';

const SOURCE_CONFIG = {
    web: { label: 'אתר', icon: FaGlobe, color: 'text-blue-400 bg-blue-500/10' },
    kiosk: { label: 'קיוסק', icon: FaDesktop, color: 'text-purple-400 bg-purple-500/10' },
    pos: { label: 'קופה', icon: FaCashRegister, color: 'text-orange-400 bg-orange-500/10' },
    website: { label: 'אתר', icon: FaGlobe, color: 'text-blue-400 bg-blue-500/10' },
};

export default function POSPendingPaymentModal({ headers, posToken, onClose, onPaid }) {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    // Cash payment flow
    const [cashOrder, setCashOrder] = useState(null);
    const [amountTendered, setAmountTendered] = useState('');

    // Credit payment flow
    const [creditOrder, setCreditOrder] = useState(null);
    const [processing, setProcessing] = useState(false);

    // Result state
    const [result, setResult] = useState(null); // { type, message, orderId, change, closedTab }

    const fetchOrders = useCallback(async () => {
        try {
            const res = await posApi.getPendingPaymentOrders(headers, posToken);
            if (res.data.success) {
                setOrders(res.data.orders || []);
            }
        } catch (e) {
            console.error('Failed to fetch pending payment orders:', e);
        } finally {
            setLoading(false);
        }
    }, [headers, posToken]);

    useEffect(() => {
        fetchOrders();
        const interval = setInterval(fetchOrders, 10000);
        return () => clearInterval(interval);
    }, [fetchOrders]);

    // ─── Cash keypad handlers ───

    const amount = parseFloat(amountTendered) || 0;
    const cashTotal = cashOrder ? parseFloat(cashOrder.total_price) : 0;
    const change = amount - cashTotal;
    const canPay = amount >= cashTotal;
    const quickAmounts = [10, 20, 50, 100, 200].filter(a => a >= cashTotal);

    const handleDigit = (d) => {
        setAmountTendered(prev => {
            if (d === '.' && prev.includes('.')) return prev;
            return prev + d;
        });
    };

    const handleDelete = () => {
        setAmountTendered(prev => prev.slice(0, -1));
    };

    const handleExact = () => {
        setAmountTendered(cashTotal.toFixed(2));
    };

    const handlePayCash = async () => {
        if (!cashOrder || !canPay) return;
        setProcessing(true);
        try {
            const res = await posApi.payPendingOrderCash(cashOrder.id, parseFloat(amountTendered), headers, posToken);
            if (res.data.success) {
                setResult({
                    type: 'success',
                    message: 'שולם בהצלחה',
                    orderId: cashOrder.id,
                    change: res.data.change,
                    total: res.data.total,
                    closedTab: res.data.closed_tab,
                });
                fetchOrders();
                onPaid?.();
            }
        } catch (e) {
            setResult({
                type: 'error',
                message: e.response?.data?.message || 'שגיאה בביצוע תשלום',
            });
        } finally {
            setProcessing(false);
        }
    };

    // ─── Credit payment handler ───

    const handlePayCredit = async (order) => {
        setCreditOrder(order);
        setProcessing(true);
        try {
            const res = await posApi.chargeOrderCredit(order.id, headers, posToken);
            if (res.data.success) {
                // סגור שולחן אם יש
                let closedTab = null;
                if (order.table_number) {
                    try {
                        const tabs = await posApi.getOpenTabs(headers, posToken);
                        const tab = (tabs.data.tabs || []).find(t => t.order_id === order.id);
                        if (tab) {
                            await posApi.closeTab(tab.id, headers, posToken);
                            closedTab = { id: tab.id, table_number: tab.table_number };
                        }
                    } catch {}
                }
                // הדפס קבלה
                try { await posApi.printReceipt(order.id, headers, posToken); } catch {}

                setResult({
                    type: 'success',
                    message: 'תשלום אשראי אושר',
                    orderId: order.id,
                    closedTab,
                });
                fetchOrders();
                onPaid?.();
            }
        } catch (e) {
            setResult({
                type: 'error',
                message: e.response?.data?.message || 'העסקה נדחתה',
                orderId: order.id,
            });
        } finally {
            setProcessing(false);
            setCreditOrder(null);
        }
    };

    const resetAll = () => {
        setCashOrder(null);
        setCreditOrder(null);
        setAmountTendered('');
        setResult(null);
    };

    const digits = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', 'del'];

    // ─── Cash keypad view ───
    if (cashOrder && !result) {
        return (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[300] flex items-center justify-center p-4" onClick={() => !processing && resetAll()}>
                <div className="bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-700 animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
                    {/* Header */}
                    <div className="flex items-center justify-between px-8 pt-8 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-emerald-500/20 rounded-xl">
                                <FaMoneyBillWave className="text-emerald-400 text-xl" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-white">תשלום מזומן</h2>
                                <p className="text-slate-400 text-sm">
                                    הזמנה #{cashOrder.id} — לתשלום: <span className="text-orange-400 font-black">₪{cashTotal.toFixed(2)}</span>
                                </p>
                                {cashOrder.table_number && (
                                    <p className="text-indigo-400 text-xs font-bold mt-1 flex items-center gap-1">
                                        <FaUtensils size={10} /> שולחן {cashOrder.table_number}
                                    </p>
                                )}
                            </div>
                        </div>
                        {!processing && (
                            <button onClick={resetAll} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-700 transition-all">
                                <FaTimes size={18} />
                            </button>
                        )}
                    </div>

                    {processing ? (
                        <div className="px-8 pb-8 text-center py-12 space-y-4">
                            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-emerald-500 mx-auto" />
                            <p className="text-white text-xl font-black">מעבד תשלום...</p>
                        </div>
                    ) : (
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
                                onClick={handlePayCash}
                                disabled={!canPay}
                                className="w-full py-4 bg-gradient-to-r from-emerald-500 to-green-500 text-white font-black text-lg rounded-2xl disabled:opacity-30 transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
                            >
                                שלם ₪{cashTotal.toFixed(2)}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ─── Result view ───
    if (result) {
        return (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[300] flex items-center justify-center p-4" onClick={resetAll}>
                <div className="bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-700 animate-in zoom-in-95 duration-300 p-10 text-center space-y-6" onClick={e => e.stopPropagation()}>
                    <div className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center ${result.type === 'success' ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                        {result.type === 'success'
                            ? <FaCheckCircle className="text-emerald-400 text-5xl" />
                            : <FaExclamationTriangle className="text-red-400 text-5xl" />}
                    </div>

                    {result.type === 'success' ? (
                        <>
                            <div>
                                <p className="text-white text-2xl font-black">הזמנה #{result.orderId}</p>
                                <p className="text-emerald-400 text-lg font-bold mt-2">{result.message}</p>
                            </div>
                            <div className="bg-slate-900/50 rounded-2xl p-5 space-y-3">
                                {result.total != null && (
                                    <div className="flex justify-between text-slate-300 font-semibold">
                                        <span>סה״כ</span>
                                        <span>₪{result.total.toFixed(2)}</span>
                                    </div>
                                )}
                                {result.change != null && result.change > 0 && (
                                    <div className="flex justify-between text-amber-400 font-black text-xl pt-2 border-t border-slate-700">
                                        <span>עודף</span>
                                        <span>₪{result.change.toFixed(2)}</span>
                                    </div>
                                )}
                            </div>
                            {result.closedTab && (
                                <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-2xl p-4 flex items-center gap-3 justify-center">
                                    <FaUtensils className="text-indigo-400" />
                                    <span className="text-indigo-400 font-black text-sm">
                                        שולחן {result.closedTab.table_number} נסגר אוטומטית
                                    </span>
                                </div>
                            )}
                            <button onClick={resetAll} className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-lg rounded-2xl active:scale-95">
                                סגור
                            </button>
                        </>
                    ) : (
                        <>
                            <p className="text-white text-xl font-black">התשלום נדחה</p>
                            <p className="text-red-400 font-bold">{result.message}</p>
                            <div className="flex gap-3 justify-center">
                                <button onClick={resetAll} className="px-6 py-3 bg-slate-700 text-white font-black rounded-2xl active:scale-95">
                                    חזור
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        );
    }

    // ─── Main orders list view ───
    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[300] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden border border-slate-700 animate-in zoom-in-95 duration-300 flex flex-col relative" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-8 pt-8 pb-4 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-amber-500/20 rounded-xl">
                            <FaClock className="text-amber-400 text-xl" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white">ממתינות לתשלום</h2>
                            <p className="text-slate-400 text-sm">{orders.length} הזמנות</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-700 transition-all">
                        <FaTimes size={18} />
                    </button>
                </div>

                {/* Processing overlay (for credit) */}
                {processing && creditOrder && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-10 flex items-center justify-center rounded-3xl">
                        <div className="text-center space-y-4">
                            <div className="relative w-20 h-20 mx-auto">
                                <div className="absolute inset-0 rounded-full border-4 border-blue-500/20" />
                                <div className="absolute inset-0 rounded-full border-4 border-t-blue-500 animate-spin" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <FaCreditCard className="text-blue-400 text-2xl" />
                                </div>
                            </div>
                            <p className="text-white text-lg font-black">ממתין ל-PinPad...</p>
                            <p className="text-blue-300 text-sm">בקש מהלקוח להעביר/להכניס כרטיס</p>
                        </div>
                    </div>
                )}

                {/* Orders list */}
                <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-3 custom-scrollbar">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-b-4 border-orange-500" />
                        </div>
                    ) : orders.length === 0 ? (
                        <div className="text-center py-16">
                            <FaCheckCircle className="text-5xl text-emerald-500/30 mx-auto mb-4" />
                            <p className="text-slate-500 text-lg font-black">אין הזמנות ממתינות לתשלום</p>
                        </div>
                    ) : (
                        orders.map(order => {
                            const source = SOURCE_CONFIG[order.source] || SOURCE_CONFIG.website;
                            const SourceIcon = source.icon;
                            return (
                                <div key={order.id} className="bg-slate-900/50 rounded-2xl border border-slate-700/50 overflow-hidden">
                                    <div className="p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <span className="text-white font-black text-lg">#{order.id}</span>
                                                <span className={`text-xs font-black px-2 py-1 rounded-lg flex items-center gap-1 ${source.color}`}>
                                                    <SourceIcon size={10} /> {source.label}
                                                </span>
                                                {order.table_number && (
                                                    <span className="text-xs font-bold px-2 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center gap-1">
                                                        <FaUtensils size={9} /> שולחן {order.table_number}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-left">
                                                <p className="text-white font-black text-lg flex items-center gap-1">
                                                    <FaShekelSign className="text-sm" />{order.total_price.toFixed(2)}
                                                </p>
                                                <p className="text-slate-500 text-xs">{order.created_at}</p>
                                            </div>
                                        </div>
                                        <p className="text-slate-400 text-sm mb-3">
                                            {order.customer_name} — {order.items?.length || 0} פריטים
                                        </p>
                                        {/* Payment buttons */}
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => { setCashOrder(order); setAmountTendered(''); }}
                                                disabled={processing}
                                                className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl font-black text-sm active:scale-95 hover:bg-emerald-500/20 transition-all disabled:opacity-30"
                                            >
                                                <FaMoneyBillWave /> מזומן
                                            </button>
                                            <button
                                                onClick={() => handlePayCredit(order)}
                                                disabled={processing}
                                                className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-xl font-black text-sm active:scale-95 hover:bg-blue-500/20 transition-all disabled:opacity-30"
                                            >
                                                <FaCreditCard /> אשראי
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
