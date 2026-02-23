import { useState, useEffect, useCallback } from 'react';
import { FaCheckCircle, FaFire, FaBell, FaTruck, FaBan, FaClock, FaShekelSign, FaClipboardList, FaMotorcycle, FaPrint, FaUtensils } from 'react-icons/fa';
import posApi from '../api/posApi';

const STATUS_CONFIG = {
    pending: { label: 'ממתינה', color: 'bg-amber-500', bg: 'bg-amber-500/10 border-amber-500/30', icon: FaClock },
    received: { label: 'התקבלה', color: 'bg-orange-500', bg: 'bg-orange-500/10 border-orange-500/30', icon: FaBell },
    preparing: { label: 'בהכנה', color: 'bg-blue-500', bg: 'bg-blue-500/10 border-blue-500/30', icon: FaFire },
    ready: { label: 'מוכנה', color: 'bg-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/30', icon: FaCheckCircle },
    delivering: { label: 'במשלוח', color: 'bg-purple-500', bg: 'bg-purple-500/10 border-purple-500/30', icon: FaMotorcycle },
    delivered: { label: 'נמסרה', color: 'bg-slate-500', bg: 'bg-slate-500/10 border-slate-500/30', icon: FaTruck },
    cancelled: { label: 'בוטלה', color: 'bg-red-500', bg: 'bg-red-500/10 border-red-500/30', icon: FaBan },
};

function getAllowedNextStatuses(currentStatus, deliveryMethod) {
    const common = {
        pending: ['received', 'preparing', 'cancelled'],
        received: ['preparing', 'cancelled'],
        preparing: ['ready', 'cancelled'],
        cancelled: [],
    };

    const delivery = {
        ready: ['delivering', 'cancelled'],
        delivering: ['delivered', 'cancelled'],
        delivered: [],
    };

    const pickup = {
        ready: ['delivered', 'cancelled'],
        delivered: [],
    };

    const transitions = {
        ...common,
        ...(deliveryMethod === 'delivery' ? delivery : pickup),
    };

    return transitions[currentStatus] || [];
}

function normalizeOrder(raw) {
    const items = (raw.items || []).map(i => ({
        id: i.id,
        name: i.name || i.item_name || i.menuItem?.name || 'פריט',
        quantity: i.quantity || i.qty || 0,
        unit_price: parseFloat(i.price_at_order || i.unit_price || i.price || 0),
        variant_name: i.variant_name || null,
        addons_text: Array.isArray(i.addons) && i.addons.length
            ? i.addons.map(a => a.name || a).filter(Boolean).join(', ')
            : (i.addons_text || null),
    }));

    return {
        id: raw.id,
        customer_name: raw.customer_name || 'אורח',
        status: raw.status,
        delivery_method: raw.delivery_method || 'pickup',
        payment_method: raw.payment_method,
        payment_status: raw.payment_status,
        total_price: parseFloat(raw.total_amount || raw.total_price || raw.total || 0),
        source: raw.source || 'website',
        notes: raw.notes,
        created_at: raw.created_at
            ? (typeof raw.created_at === 'string' && raw.created_at.length <= 5
                ? raw.created_at
                : new Date(raw.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }))
            : '',
        items,
    };
}

export default function POSOrderPanel({ headers, posToken, mode = 'active' }) {
    const [printMsg, setPrintMsg] = useState(null);

    const showPrintMsg = (text, isError = false) => {
        setPrintMsg({ text, isError });
        setTimeout(() => setPrintMsg(null), 3000);
    };

    const handlePrintReceipt = async (orderId) => {
        try {
            const res = await posApi.printReceipt(orderId, headers, posToken);
            showPrintMsg(res.data.message || 'נשלח להדפסה', !res.data.success);
        } catch (e) {
            showPrintMsg(e.response?.data?.message || 'שגיאה בהדפסה', true);
        }
    };

    const handlePrintKitchen = async (orderId) => {
        try {
            const res = await posApi.printKitchenTicket(orderId, headers, posToken);
            showPrintMsg(res.data.message || 'נשלח להדפסה', !res.data.success);
        } catch (e) {
            showPrintMsg(e.response?.data?.message || 'שגיאה בהדפסה', true);
        }
    };
    const [orders, setOrders] = useState([]);
    const [expandedId, setExpandedId] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchOrders = useCallback(async () => {
        try {
            const res = await posApi.getOrders(headers);
            if (res.data.success) {
                const rawOrders = res.data.orders?.data || res.data.orders || [];
                const list = Array.isArray(rawOrders) ? rawOrders : [];
                setOrders(list.map(normalizeOrder));
            }
        } catch (e) {
            console.error('Failed to fetch orders:', e);
        } finally {
            setLoading(false);
        }
    }, [headers]);

    useEffect(() => {
        fetchOrders();
        const interval = setInterval(fetchOrders, 8000);
        return () => clearInterval(interval);
    }, [fetchOrders]);

    const updateStatus = async (orderId, newStatus) => {
        try {
            await posApi.updateOrderStatus(orderId, newStatus, headers);
            fetchOrders();
        } catch (e) {
            const msg = e.response?.data?.message || 'שגיאה בעדכון סטטוס';
            alert(msg);
        }
    };

    const isActive = (status) => !['delivered', 'cancelled'].includes(status);
    const filtered = mode === 'active'
        ? orders.filter(o => isActive(o.status))
        : orders.filter(o => !isActive(o.status));

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-orange-500" />
            </div>
        );
    }

    if (filtered.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center">
                <FaClipboardList className="text-6xl text-slate-700 mb-4" />
                <p className="text-slate-500 text-xl font-black">
                    {mode === 'active' ? 'אין הזמנות פעילות' : 'אין הזמנות שהושלמו היום'}
                </p>
                <p className="text-slate-600 text-sm mt-2">
                    {mode === 'active' ? 'הזמנות חדשות יופיעו כאן אוטומטית' : 'הזמנות שנמסרו או בוטלו יופיעו כאן'}
                </p>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto p-4 space-y-4 custom-scrollbar relative">
            {printMsg && (
                <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[600] px-6 py-3 rounded-2xl font-bold text-sm shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300 ${
                    printMsg.isError
                        ? 'bg-red-500 text-white'
                        : 'bg-emerald-500 text-white'
                }`}>
                    {printMsg.text}
                </div>
            )}
            <h3 className="text-slate-400 text-xs font-black uppercase tracking-widest px-2">
                {mode === 'active'
                    ? `הזמנות פעילות (${filtered.length})`
                    : `הזמנות שהושלמו (${filtered.length})`}
            </h3>
            <div className="space-y-3">
                {filtered.map(order => (
                    <OrderCard
                        key={order.id}
                        order={order}
                        expanded={expandedId === order.id}
                        onToggle={() => setExpandedId(expandedId === order.id ? null : order.id)}
                        onUpdateStatus={updateStatus}
                        showActions={mode === 'active'}
                        onPrintReceipt={handlePrintReceipt}
                        onPrintKitchen={handlePrintKitchen}
                    />
                ))}
            </div>
        </div>
    );
}

function OrderCard({ order, expanded, onToggle, onUpdateStatus, showActions = true, onPrintReceipt, onPrintKitchen }) {
    const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
    const Icon = config.icon;

    const allowed = getAllowedNextStatuses(order.status, order.delivery_method);
    const nextStatuses = allowed.filter(s => s !== 'cancelled');
    const canCancel = allowed.includes('cancelled');

    return (
        <div className={`rounded-2xl border ${config.bg} overflow-hidden transition-all`}>
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between px-5 py-4 text-right"
            >
                <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl ${config.color} flex items-center justify-center text-white`}>
                        <Icon size={18} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-white font-black text-lg">#{order.id}</span>
                            <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${config.color} text-white`}>
                                {config.label}
                            </span>
                            <span className="text-slate-400 text-xs font-semibold">{order.created_at}</span>
                        </div>
                        <p className="text-slate-400 text-sm font-semibold">
                            {order.customer_name} — {order.items.length} פריטים
                            {order.delivery_method === 'delivery' && <span className="text-purple-400 mr-2">משלוח</span>}
                        </p>
                    </div>
                </div>
                <div className="text-left">
                    <p className="text-white font-black text-lg flex items-center gap-1">
                        <FaShekelSign className="text-sm" />{order.total_price.toFixed(2)}
                    </p>
                    <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${
                        order.payment_status === 'paid' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                    }`}>
                        {order.payment_status === 'paid' ? 'שולם' : 'ממתין'}
                    </span>
                </div>
            </button>

            {expanded && (
                <div className="px-5 pb-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="bg-slate-900/50 rounded-xl p-4 space-y-2">
                        {order.items.map((item, i) => (
                            <div key={i} className="flex justify-between text-sm">
                                <span className="text-slate-300 font-semibold">
                                    {item.quantity}x {item.name}
                                    {item.variant_name && <span className="text-slate-500 mr-1">({item.variant_name})</span>}
                                    {item.addons_text && <span className="text-slate-600 block text-xs mr-4">{item.addons_text}</span>}
                                </span>
                                <span className="text-slate-400 font-bold">{item.unit_price.toFixed(2)}₪</span>
                            </div>
                        ))}
                    </div>

                    {order.notes && (
                        <p className="text-amber-400 text-sm font-semibold bg-amber-500/10 p-3 rounded-xl">{order.notes}</p>
                    )}

                    {showActions && (
                        <div className="flex gap-2 flex-wrap">
                            {nextStatuses.map(ns => {
                                const nsConfig = STATUS_CONFIG[ns];
                                return (
                                    <button
                                        key={ns}
                                        onClick={() => onUpdateStatus(order.id, ns)}
                                        className={`flex-1 min-w-[120px] py-3 rounded-xl font-black text-white text-sm transition-all active:scale-95 ${nsConfig.color}`}
                                    >
                                        {nsConfig.label} ←
                                    </button>
                                );
                            })}
                            {canCancel && (
                                <button
                                    onClick={() => onUpdateStatus(order.id, 'cancelled')}
                                    className="px-4 py-3 rounded-xl bg-red-500/20 text-red-400 font-black text-sm transition-all active:scale-95 hover:bg-red-500/30"
                                >
                                    ביטול
                                </button>
                            )}
                        </div>
                    )}

                    <div className="flex gap-2">
                        <button
                            onClick={() => onPrintReceipt?.(order.id)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-500/10 text-blue-400 text-xs font-bold transition-all active:scale-95 hover:bg-blue-500/20"
                        >
                            <FaPrint size={11} /> קבלה
                        </button>
                        <button
                            onClick={() => onPrintKitchen?.(order.id)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-orange-500/10 text-orange-400 text-xs font-bold transition-all active:scale-95 hover:bg-orange-500/20"
                        >
                            <FaUtensils size={11} /> מטבח
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
