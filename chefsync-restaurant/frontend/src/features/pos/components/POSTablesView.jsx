import { useState, useEffect, useCallback } from 'react';
import { FaPlus, FaMinus, FaTrash, FaShekelSign, FaClock, FaTimes, FaUtensils, FaSearch, FaCreditCard, FaMoneyBillWave, FaCheckCircle, FaBackspace, FaExclamationTriangle, FaBan, FaCashRegister } from 'react-icons/fa';
import api from '../../../services/apiClient';
import posApi from '../api/posApi';
import POSManagerAuth from './POSManagerAuth';
import POSMenuItemModal, { posItemNeedsConfiguration } from './POSMenuItemModal';
import { buildCartKey } from '../../../utils/cart';

export default function POSTablesView({ headers, posToken, shift }) {
    // Require open shift
    if (!shift) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <div className="w-20 h-20 mx-auto bg-amber-500/10 rounded-2xl flex items-center justify-center mb-4">
                    <FaCashRegister className="text-amber-400 text-3xl" />
                </div>
                <p className="text-white text-xl font-black mb-2">יש לפתוח משמרת</p>
                <p className="text-slate-400 text-sm">לא ניתן לפתוח שולחן ללא קופה פתוחה</p>
            </div>
        );
    }

    return <POSTablesViewInner headers={headers} posToken={posToken} />;
}

function POSTablesViewInner({ headers, posToken }) {
    const [tabs, setTabs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showNewTab, setShowNewTab] = useState(false);
    const [selectedTab, setSelectedTab] = useState(null);
    const [showAddItems, setShowAddItems] = useState(false);

    const fetchTabs = useCallback(async () => {
        try {
            const res = await posApi.getOpenTabs(headers, posToken);
            if (res.data.success) {
                setTabs(res.data.tabs || []);
            }
        } catch (e) {
            console.error('Failed to fetch tabs:', e);
        } finally {
            setLoading(false);
        }
    }, [headers, posToken]);

    useEffect(() => {
        fetchTabs();
        const interval = setInterval(fetchTabs, 8000);
        return () => clearInterval(interval);
    }, [fetchTabs]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-orange-500" />
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto p-4 space-y-4 custom-scrollbar">
            <div className="flex items-center justify-between px-2">
                <h3 className="text-slate-400 text-xs font-black uppercase tracking-widest">
                    שולחנות פתוחים ({tabs.length})
                </h3>
                <button
                    onClick={() => setShowNewTab(true)}
                    className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-sm rounded-xl active:scale-95 flex items-center gap-2"
                >
                    <FaPlus size={12} /> פתח שולחן
                </button>
            </div>

            {tabs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <FaUtensils className="text-6xl text-slate-700 mb-4" />
                    <p className="text-slate-500 text-xl font-black">אין שולחנות פתוחים</p>
                    <p className="text-slate-600 text-sm mt-2">לחץ "פתח שולחן" כדי להתחיל</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setSelectedTab(tab)}
                            className="bg-slate-800 border border-slate-700 rounded-2xl p-5 text-right hover:border-orange-500/50 hover:bg-slate-700/50 transition-all active:scale-95 group"
                        >
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-3xl font-black text-orange-400">#{tab.table_number}</span>
                                <div className="flex items-center gap-1 text-slate-500 text-xs">
                                    <FaClock size={10} />
                                    <span>{tab.minutes_open} דק׳</span>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <p className="text-slate-400 text-sm font-semibold">{tab.item_count} פריטים</p>
                                <p className="text-white font-black text-xl flex items-center gap-1">
                                    <FaShekelSign className="text-sm text-slate-500" />
                                    {tab.total.toFixed(2)}
                                </p>
                            </div>
                            <p className="text-slate-600 text-xs mt-2">פתח ע״י {tab.opened_by}</p>
                        </button>
                    ))}
                </div>
            )}

            {/* New Tab Modal */}
            {showNewTab && (
                <NewTabModal
                    headers={headers}
                    posToken={posToken}
                    onClose={() => setShowNewTab(false)}
                    onCreated={() => { setShowNewTab(false); fetchTabs(); }}
                />
            )}

            {/* Tab Detail Modal */}
            {selectedTab && (
                <TabDetailModal
                    tab={selectedTab}
                    headers={headers}
                    posToken={posToken}
                    onClose={() => setSelectedTab(null)}
                    onUpdated={() => { setSelectedTab(null); fetchTabs(); }}
                    onAddItems={() => { setShowAddItems(true); }}
                />
            )}

            {/* Add Items to Tab */}
            {showAddItems && selectedTab && (
                <AddItemsModal
                    tab={selectedTab}
                    headers={headers}
                    posToken={posToken}
                    onClose={() => setShowAddItems(false)}
                    onAdded={() => {
                        setShowAddItems(false);
                        setSelectedTab(null);
                        fetchTabs();
                    }}
                />
            )}
        </div>
    );
}

function NewTabModal({ headers, posToken, onClose, onCreated }) {
    const [tableNumber, setTableNumber] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleCreate = async () => {
        if (!tableNumber.trim()) return;
        setLoading(true);
        setError('');
        try {
            const res = await posApi.openTab(tableNumber.trim(), [], headers, posToken);
            if (res.data.success) {
                onCreated();
            }
        } catch (e) {
            setError(e.response?.data?.message || 'שגיאה בפתיחת שולחן');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[300] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-slate-800 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-700 animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
                <div className="p-8 space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-black text-white">פתיחת שולחן</h2>
                        <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-700">
                            <FaTimes size={18} />
                        </button>
                    </div>

                    <div>
                        <label className="text-slate-400 text-sm font-bold block mb-2">מספר שולחן</label>
                        <input
                            type="text"
                            dir="ltr"
                            value={tableNumber}
                            onChange={e => setTableNumber(e.target.value)}
                            className="w-full px-4 py-4 bg-slate-900 text-white rounded-xl border border-slate-700 focus:border-orange-500 focus:outline-none text-3xl font-black text-center"
                            placeholder="1"
                            autoFocus
                            onKeyDown={e => e.key === 'Enter' && handleCreate()}
                        />
                    </div>

                    {error && <p className="text-red-400 text-sm font-bold text-center">{error}</p>}

                    <button
                        onClick={handleCreate}
                        disabled={!tableNumber.trim() || loading}
                        className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-lg rounded-2xl disabled:opacity-30 active:scale-95"
                    >
                        {loading ? 'פותח...' : 'פתח שולחן'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function TabDetailModal({ tab: initialTab, headers, posToken, onClose, onUpdated, onAddItems }) {
    const [tab, setTab] = useState(initialTab);
    const [closing, setClosing] = useState(false);
    // Payment flow states: null | 'choose' | 'cash' | 'credit-processing' | 'result'
    const [payStep, setPayStep] = useState(null);
    const [amountTendered, setAmountTendered] = useState('');
    const [processing, setProcessing] = useState(false);
    const [payResult, setPayResult] = useState(null);
    // Remove item flow
    const [pendingRemoveItem, setPendingRemoveItem] = useState(null); // item to remove (needs manager auth)
    const [showManagerAuth, setShowManagerAuth] = useState(false);
    const [removing, setRemoving] = useState(null); // itemId being removed

    const total = tab.total || 0;
    const hasItems = (tab.items || []).length > 0 && total > 0;

    const handleCloseClick = () => {
        if (hasItems) {
            setPayStep('choose');
        } else {
            doCloseTab();
        }
    };

    const doCloseTab = async () => {
        setClosing(true);
        try {
            await posApi.closeTab(tab.id, headers, posToken);
            onUpdated();
        } catch (e) {
            alert(e.response?.data?.message || 'שגיאה בסגירת השולחן');
        } finally {
            setClosing(false);
        }
    };

    // ─── Remove item flow ───
    const handleRemoveItemClick = (item) => {
        setPendingRemoveItem(item);
        setShowManagerAuth(true);
    };

    const handleManagerVerified = async () => {
        setShowManagerAuth(false);
        if (!pendingRemoveItem) return;
        setRemoving(pendingRemoveItem.id);
        try {
            const res = await posApi.removeTabItem(tab.id, pendingRemoveItem.id, headers, posToken);
            if (res.data.success && res.data.tab) {
                setTab(res.data.tab);
            }
        } catch (e) {
            alert(e.response?.data?.message || 'שגיאה בהסרת פריט');
        } finally {
            setRemoving(null);
            setPendingRemoveItem(null);
        }
    };

    // ─── Cash keypad ───
    const amount = parseFloat(amountTendered) || 0;
    const change = amount - total;
    const canPay = amount >= total;
    const quickAmounts = [10, 20, 50, 100, 200].filter(a => a >= total);
    const digits = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', 'del'];

    const handleDigit = (d) => {
        setAmountTendered(prev => {
            if (d === '.' && prev.includes('.')) return prev;
            return prev + d;
        });
    };
    const handleDelete = () => setAmountTendered(prev => prev.slice(0, -1));
    const handleExact = () => setAmountTendered(total.toFixed(2));

    const handlePayCash = async () => {
        if (!canPay || !tab.order_id) return;
        setProcessing(true);
        try {
            const res = await posApi.payPendingOrderCash(tab.order_id, parseFloat(amountTendered), headers, posToken);
            if (res.data.success) {
                setPayResult({
                    type: 'success',
                    message: 'שולם בהצלחה',
                    change: res.data.change,
                    total: res.data.total,
                });
                setPayStep('result');
            }
        } catch (e) {
            setPayResult({ type: 'error', message: e.response?.data?.message || 'שגיאה בביצוע תשלום' });
            setPayStep('result');
        } finally {
            setProcessing(false);
        }
    };

    const handlePayCredit = async () => {
        if (!tab.order_id) return;
        setPayStep('credit-processing');
        setProcessing(true);
        try {
            const res = await posApi.chargeOrderCredit(tab.order_id, headers, posToken);
            if (res.data.success) {
                try { await posApi.closeTab(tab.id, headers, posToken); } catch {}
                try { await posApi.printReceipt(tab.order_id, headers, posToken); } catch {}
                setPayResult({ type: 'success', message: 'תשלום אשראי אושר' });
                setPayStep('result');
            }
        } catch (e) {
            setPayResult({ type: 'error', message: e.response?.data?.message || 'העסקה נדחתה' });
            setPayStep('result');
        } finally {
            setProcessing(false);
        }
    };

    // ─── Payment method selection view ───
    if (payStep === 'choose') {
        return (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[300] flex items-center justify-center p-4" onClick={onClose}>
                <div className="bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-700 animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
                    <div className="p-8 space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-2xl font-black text-white">סגירת שולחן #{tab.table_number}</h2>
                            <button onClick={() => setPayStep(null)} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-700">
                                <FaTimes size={18} />
                            </button>
                        </div>

                        <div className="bg-slate-900/50 rounded-2xl p-5 text-center">
                            <p className="text-slate-400 text-sm font-bold mb-1">סה״כ לתשלום</p>
                            <p className="text-white text-3xl font-black flex items-center justify-center gap-1">
                                <FaShekelSign className="text-lg text-orange-400" />
                                {total.toFixed(2)}
                            </p>
                        </div>

                        <div className="space-y-3">
                            <button
                                onClick={() => { setPayStep('cash'); setAmountTendered(''); }}
                                className="w-full flex items-center gap-4 py-4 px-5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-2xl font-black text-lg active:scale-95 hover:bg-emerald-500/20 transition-all"
                            >
                                <FaMoneyBillWave size={22} /> מזומן
                            </button>
                            <button
                                onClick={handlePayCredit}
                                className="w-full flex items-center gap-4 py-4 px-5 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-2xl font-black text-lg active:scale-95 hover:bg-blue-500/20 transition-all"
                            >
                                <FaCreditCard size={22} /> אשראי
                            </button>
                            <button
                                onClick={doCloseTab}
                                disabled={closing}
                                className="w-full flex items-center gap-4 py-4 px-5 bg-slate-700/50 border border-slate-600/50 text-slate-400 rounded-2xl font-black text-sm active:scale-95 hover:bg-slate-700 transition-all"
                            >
                                <FaBan size={16} /> {closing ? 'סוגר...' : 'סגור בלי לשלם'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ─── Cash keypad view ───
    if (payStep === 'cash') {
        return (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[300] flex items-center justify-center p-4" onClick={() => !processing && setPayStep('choose')}>
                <div className="bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-700 animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between px-8 pt-8 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-emerald-500/20 rounded-xl">
                                <FaMoneyBillWave className="text-emerald-400 text-xl" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-white">תשלום מזומן</h2>
                                <p className="text-slate-400 text-sm">
                                    שולחן #{tab.table_number} — לתשלום: <span className="text-orange-400 font-black">₪{total.toFixed(2)}</span>
                                </p>
                            </div>
                        </div>
                        {!processing && (
                            <button onClick={() => setPayStep('choose')} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-700 transition-all">
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
                            <div className="flex gap-2 flex-wrap">
                                <button onClick={handleExact} className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-sm font-black active:scale-95">
                                    מדויק
                                </button>
                                {quickAmounts.map(a => (
                                    <button key={a} onClick={() => setAmountTendered(String(a))}
                                        className="px-4 py-2 bg-slate-700/50 border border-slate-600/50 text-slate-300 rounded-xl text-sm font-black active:scale-95 hover:bg-slate-700">
                                        ₪{a}
                                    </button>
                                ))}
                            </div>

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

                            <button onClick={handlePayCash} disabled={!canPay}
                                className="w-full py-4 bg-gradient-to-r from-emerald-500 to-green-500 text-white font-black text-lg rounded-2xl disabled:opacity-30 transition-all active:scale-95 shadow-lg shadow-emerald-500/20">
                                שלם ₪{total.toFixed(2)}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ─── Credit processing view ───
    if (payStep === 'credit-processing') {
        return (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
                <div className="bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-700 animate-in zoom-in-95 duration-300 p-10 text-center space-y-6" onClick={e => e.stopPropagation()}>
                    <div className="relative w-20 h-20 mx-auto">
                        <div className="absolute inset-0 rounded-full border-4 border-blue-500/20" />
                        <div className="absolute inset-0 rounded-full border-4 border-t-blue-500 animate-spin" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <FaCreditCard className="text-blue-400 text-2xl" />
                        </div>
                    </div>
                    <p className="text-white text-lg font-black">ממתין ל-PinPad...</p>
                    <p className="text-blue-300 text-sm">בקש מהלקוח להעביר/להכניס כרטיס</p>
                    <p className="text-slate-400 text-sm">שולחן #{tab.table_number} — ₪{total.toFixed(2)}</p>
                </div>
            </div>
        );
    }

    // ─── Result view ───
    if (payStep === 'result' && payResult) {
        return (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[300] flex items-center justify-center p-4" onClick={() => payResult.type === 'success' ? onUpdated() : setPayStep('choose')}>
                <div className="bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-700 animate-in zoom-in-95 duration-300 p-10 text-center space-y-6" onClick={e => e.stopPropagation()}>
                    <div className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center ${payResult.type === 'success' ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                        {payResult.type === 'success'
                            ? <FaCheckCircle className="text-emerald-400 text-5xl" />
                            : <FaExclamationTriangle className="text-red-400 text-5xl" />}
                    </div>

                    {payResult.type === 'success' ? (
                        <>
                            <div>
                                <p className="text-white text-2xl font-black">שולחן #{tab.table_number}</p>
                                <p className="text-emerald-400 text-lg font-bold mt-2">{payResult.message}</p>
                            </div>
                            <div className="bg-slate-900/50 rounded-2xl p-5 space-y-3">
                                {payResult.total != null && (
                                    <div className="flex justify-between text-slate-300 font-semibold">
                                        <span>סה״כ</span>
                                        <span>₪{payResult.total.toFixed(2)}</span>
                                    </div>
                                )}
                                {payResult.change != null && payResult.change > 0 && (
                                    <div className="flex justify-between text-amber-400 font-black text-xl pt-2 border-t border-slate-700">
                                        <span>עודף</span>
                                        <span>₪{payResult.change.toFixed(2)}</span>
                                    </div>
                                )}
                            </div>
                            <button onClick={onUpdated} className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-lg rounded-2xl active:scale-95">
                                סגור
                            </button>
                        </>
                    ) : (
                        <>
                            <p className="text-white text-xl font-black">שגיאה</p>
                            <p className="text-red-400 font-bold">{payResult.message}</p>
                            <button onClick={() => setPayStep('choose')} className="px-6 py-3 bg-slate-700 text-white font-black rounded-2xl active:scale-95">
                                חזור
                            </button>
                        </>
                    )}
                </div>
            </div>
        );
    }

    // ─── Default: Tab detail view ───
    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[300] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden border border-slate-700 animate-in zoom-in-95 duration-300 flex flex-col" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-8 pt-8 pb-4 shrink-0">
                    <div>
                        <h2 className="text-2xl font-black text-white">שולחן #{tab.table_number}</h2>
                        <p className="text-slate-400 text-sm">פתוח {tab.minutes_open} דקות</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-700">
                        <FaTimes size={18} />
                    </button>
                </div>

                {/* Items */}
                <div className="flex-1 overflow-y-auto px-8 space-y-2 custom-scrollbar">
                    {(tab.items || []).map((item, i) => (
                        <div key={item.id || i} className="flex items-center justify-between text-sm bg-slate-900/50 rounded-xl p-3 group">
                            <span className="text-slate-300 font-semibold flex-1">
                                {item.quantity}x {item.name}
                                {item.variant_name && <span className="text-slate-500 mr-1">({item.variant_name})</span>}
                                {item.addons_text && <span className="text-slate-600 block text-xs mr-4">{item.addons_text}</span>}
                            </span>
                            <span className="text-slate-400 font-bold ml-3">₪{(item.unit_price * item.quantity).toFixed(2)}</span>
                            <button
                                onClick={() => handleRemoveItemClick(item)}
                                disabled={removing === item.id}
                                className="mr-2 p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all active:scale-90 disabled:opacity-30"
                                title="הסר פריט"
                            >
                                {removing === item.id
                                    ? <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                                    : <FaTrash size={12} />}
                            </button>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="border-t border-slate-700 p-6 space-y-3 shrink-0">
                    <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-black">סה״כ</span>
                        <span className="text-white font-black text-2xl flex items-center gap-1">
                            <FaShekelSign className="text-sm text-orange-400" />
                            {tab.total.toFixed(2)}
                        </span>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={onAddItems}
                            className="flex-1 py-3 bg-blue-500/10 border border-blue-500/30 text-blue-400 font-black rounded-xl active:scale-95 flex items-center justify-center gap-2"
                        >
                            <FaPlus size={12} /> הוסף פריטים
                        </button>
                        <button
                            onClick={handleCloseClick}
                            disabled={closing}
                            className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black rounded-xl active:scale-95"
                        >
                            {closing ? 'סוגר...' : 'סגור חשבון'}
                        </button>
                    </div>
                </div>
            </div>

            {showManagerAuth && (
                <POSManagerAuth
                    title="אישור מנהל"
                    subtitle={`הסרת פריט: ${pendingRemoveItem?.name}`}
                    headers={headers}
                    onVerified={handleManagerVerified}
                    onClose={() => { setShowManagerAuth(false); setPendingRemoveItem(null); }}
                />
            )}
        </div>
    );
}

function AddItemsModal({ tab, headers, posToken, onClose, onAdded }) {
    const [categories, setCategories] = useState([]);
    const [items, setItems] = useState([]);
    const [activeCategory, setActiveCategory] = useState(null);
    const [cart, setCart] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [configureItem, setConfigureItem] = useState(null);

    useEffect(() => {
        (async () => {
            try {
                const res = await api.get('/menu', { headers });
                if (res.data.success) {
                    const rawCategories = res.data.data || [];
                    const cats = rawCategories.map(c => ({ id: c.id, name: c.name }));
                    setCategories(cats);
                    setItems(rawCategories.flatMap(cat =>
                        (cat.items || []).map(item => ({ ...item, category: { id: cat.id, name: cat.name } }))
                    ));
                    if (cats.length > 0) setActiveCategory(cats[0].id);
                }
            } catch (e) {
                console.error('Failed to fetch menu:', e);
            } finally {
                setLoading(false);
            }
        })();
    }, [headers]);

    const filteredItems = items.filter(item =>
        search ? item.name.includes(search) : activeCategory ? item.category?.id === activeCategory : true
    );

    const mergeCartLine = (line) => {
        setCart(prev => {
            const key = line._cartKey;
            const existing = prev.find(c => c._cartKey === key);
            if (existing) {
                return prev.map(c => (c._cartKey === key ? { ...c, quantity: c.quantity + line.quantity } : c));
            }
            return [...prev, line];
        });
    };

    const handlePickMenuItem = (item) => {
        if (posItemNeedsConfiguration(item)) {
            setConfigureItem(item);
            return;
        }
        mergeCartLine({
            menu_item_id: item.id,
            name: item.name,
            price: parseFloat(item.price),
            quantity: 1,
            variant_name: null,
            addons: [],
            _cartKey: buildCartKey(item.id, null, []),
        });
    };

    const updateQty = (index, delta) => {
        setCart(prev => {
            const next = [...prev];
            next[index] = { ...next[index], quantity: next[index].quantity + delta };
            if (next[index].quantity <= 0) next.splice(index, 1);
            return next;
        });
    };

    const lineUnitTotal = (row) => {
        let u = row.price;
        if (row.addons?.length) row.addons.forEach(a => { u += (a.price || 0); });
        return u * row.quantity;
    };

    const cartTotal = cart.reduce((sum, item) => sum + lineUnitTotal(item), 0);

    const handleSave = async () => {
        if (cart.length === 0) return;
        setSaving(true);
        try {
            const itemsPayload = cart.map(({ _cartKey, ...row }) => row);
            await posApi.addItemsToTab(tab.id, itemsPayload, headers, posToken);
            onAdded();
        } catch (e) {
            alert(e.response?.data?.message || 'שגיאה בהוספת פריטים');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[350] flex items-center justify-center p-2" onClick={onClose}>
            <div className="bg-slate-800 rounded-3xl shadow-2xl w-full max-w-4xl h-[85vh] overflow-hidden border border-slate-700 animate-in zoom-in-95 duration-300 flex flex-col" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-6 pb-3 shrink-0">
                    <h2 className="text-xl font-black text-white">הוסף פריטים — שולחן #{tab.table_number}</h2>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-700">
                        <FaTimes size={18} />
                    </button>
                </div>

                <div className="flex flex-1 min-h-0">
                    {/* Menu side */}
                    <div className="flex-1 flex flex-col min-w-0">
                        <div className="p-3 space-y-2 shrink-0">
                            <div className="relative">
                                <FaSearch className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                                    className="w-full pr-10 pl-4 py-2.5 bg-slate-900 text-white rounded-xl border border-slate-700 focus:border-orange-500 focus:outline-none text-sm" placeholder="חיפוש..." />
                            </div>
                            <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                                {categories.map(cat => (
                                    <button key={cat.id} onClick={() => { setActiveCategory(cat.id); setSearch(''); }}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap shrink-0 ${activeCategory === cat.id && !search ? 'bg-orange-500 text-white' : 'bg-slate-900 text-slate-400 border border-slate-700'}`}>
                                        {cat.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 pt-0 custom-scrollbar">
                            {loading ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-b-4 border-orange-500" />
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {filteredItems.map(item => (
                                        <button key={item.id} onClick={() => handlePickMenuItem(item)}
                                            className="bg-slate-900 border border-slate-700 rounded-xl p-3 text-right hover:border-orange-500/50 transition-all active:scale-95">
                                            <p className="text-white font-bold text-sm truncate">{item.name}</p>
                                            <p className="text-orange-400 font-black text-base mt-1">₪{item.price}</p>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Cart side */}
                    <div className="w-64 bg-slate-900 border-r border-slate-700 flex flex-col shrink-0">
                        <div className="px-4 py-3 border-b border-slate-700">
                            <h3 className="text-white font-black text-sm">פריטים חדשים ({cart.reduce((s, c) => s + c.quantity, 0)})</h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                            {cart.map((item, idx) => (
                                <div key={item._cartKey || idx} className="bg-slate-800 rounded-xl p-2.5 border border-slate-700/50">
                                    <p className="text-white font-bold text-xs">{item.name}</p>
                                    {item.variant_name && <p className="text-slate-500 text-[10px]">{item.variant_name}</p>}
                                    {item.addons?.length > 0 && (
                                        <p className="text-slate-500 text-[10px]">{item.addons.map(a => a.name).join(', ')}</p>
                                    )}
                                    <div className="flex items-center justify-between mt-1.5">
                                        <div className="flex items-center gap-1.5">
                                            <button onClick={() => updateQty(idx, -1)} className="w-6 h-6 rounded bg-slate-700 text-white flex items-center justify-center text-xs active:scale-90"><FaMinus size={8} /></button>
                                            <span className="text-white font-black text-xs w-4 text-center">{item.quantity}</span>
                                            <button onClick={() => updateQty(idx, 1)} className="w-6 h-6 rounded bg-slate-700 text-white flex items-center justify-center text-xs active:scale-90"><FaPlus size={8} /></button>
                                        </div>
                                        <span className="text-orange-400 font-black text-xs">₪{lineUnitTotal(item).toFixed(2)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="border-t border-slate-700 p-3 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-400 font-bold">סה״כ חדש</span>
                                <span className="text-white font-black">₪{cartTotal.toFixed(2)}</span>
                            </div>
                            <button
                                onClick={handleSave}
                                disabled={cart.length === 0 || saving}
                                className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-sm rounded-xl disabled:opacity-30 active:scale-95"
                            >
                                {saving ? 'שומר...' : 'הוסף לשולחן'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            {configureItem && (
                <POSMenuItemModal
                    item={configureItem}
                    onClose={() => setConfigureItem(null)}
                    onAdd={line => mergeCartLine(line)}
                />
            )}
        </div>
    );
}
