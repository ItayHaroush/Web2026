import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCustomer } from '../context/CustomerContext';
import apiClient from '../services/apiClient';
import { FaTimes, FaRedo, FaShoppingBag, FaClock, FaTruck, FaStore, FaFilter, FaSearch, FaChevronDown } from 'react-icons/fa';

const STATUS_LABELS = {
    pending: 'ממתין',
    confirmed: 'אושר',
    preparing: 'בהכנה',
    ready: 'מוכן',
    on_the_way: 'בדרך',
    delivered: 'נמסר',
    completed: 'הושלם',
    cancelled: 'בוטל',
};

const STATUS_COLORS = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-blue-100 text-blue-800',
    preparing: 'bg-orange-100 text-orange-800',
    ready: 'bg-green-100 text-green-800',
    on_the_way: 'bg-purple-100 text-purple-800',
    delivered: 'bg-green-100 text-green-800',
    completed: 'bg-gray-100 text-gray-800',
    cancelled: 'bg-red-100 text-red-800',
};

export default function OrderHistoryModal({ isOpen, onClose }) {
    const navigate = useNavigate();
    const { customerToken } = useCustomer();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reordering, setReordering] = useState(null);
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    const fetchOrders = useCallback(async () => {
        const token = customerToken || localStorage.getItem('customer_token');
        if (!token) { setLoading(false); return; }
        setLoading(true);
        try {
            const response = await apiClient.get('/customer/orders', {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.data?.success) {
                const data = response.data.data || [];
                const seen = new Set();
                const unique = data.filter(o => {
                    if (seen.has(o.id)) return false;
                    seen.add(o.id);
                    return true;
                });
                setOrders(unique);
            }
        } catch { /* handled by context */ }
        setLoading(false);
    }, [customerToken]);

    useEffect(() => {
        if (isOpen) {
            setOrders([]);
            fetchOrders();
        }
    }, [isOpen, fetchOrders]);

    const handleReorder = async (orderId, order) => {
        const token = customerToken || localStorage.getItem('customer_token');
        if (!token) return;

        // Cross-restaurant reorder: confirm if the target restaurant differs from current
        const currentTenantId = window.location.pathname.split('/')[1];
        if (order?.restaurant_tenant_id && currentTenantId && order.restaurant_tenant_id !== currentTenantId) {
            const confirmed = window.confirm(
                `ההזמנה ממסעדה אחרת (${order.restaurant_name || order.restaurant_tenant_id}). לעבור למסעדה ולטעון את ההזמנה?`
            );
            if (!confirmed) return;
        }

        setReordering(orderId);
        try {
            const response = await apiClient.post(`/customer/reorder/${orderId}`, {}, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.data?.success) {
                const { restaurant_tenant_id, items, unavailable } = response.data.data;
                localStorage.setItem('reorder_items', JSON.stringify(items));
                localStorage.setItem('reorder_tenant', restaurant_tenant_id);
                if (unavailable?.length > 0) {
                    localStorage.setItem('reorder_unavailable', JSON.stringify(unavailable));
                }
                onClose();
                navigate(`/${restaurant_tenant_id}/menu`);
                setTimeout(() => window.dispatchEvent(new Event('reorder_items_ready')), 100);
            }
        } catch { /* ignore */ }
        setReordering(null);
    };

    const filteredOrders = orders.filter((order) => {
        if (filter === 'active') {
            return !['completed', 'delivered', 'cancelled'].includes(order.status);
        }
        if (filter === 'completed') {
            return ['completed', 'delivered'].includes(order.status);
        }
        if (filter === 'cancelled') {
            return order.status === 'cancelled';
        }
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            return (
                order.restaurant_name?.toLowerCase().includes(q) ||
                order.items?.some(i => i.name?.toLowerCase().includes(q)) ||
                String(order.id).includes(q)
            );
        }
        return true;
    });

    const totalSpent = orders
        .filter(o => ['completed', 'delivered'].includes(o.status))
        .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center p-0 sm:p-4" dir="rtl">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            <div className="relative bg-white dark:bg-brand-dark-surface rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg max-h-[92vh] sm:max-h-[85vh] overflow-hidden animate-slide-up sm:animate-none z-10 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-brand-dark-border flex-shrink-0">
                    <div>
                        <h2 className="text-xl font-black text-gray-900 dark:text-brand-dark-text">ההזמנות שלי</h2>
                        {orders.length > 0 && (
                            <p className="text-xs text-gray-400 mt-0.5">{orders.length} הזמנות · ₪{totalSpent.toFixed(0)} סה״כ</p>
                        )}
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition p-1">
                        <FaTimes size={20} />
                    </button>
                </div>

                {/* Search + Filters */}
                {orders.length > 0 && (
                    <div className="px-5 pt-3 pb-2 space-y-2 flex-shrink-0 border-b border-gray-50 dark:border-brand-dark-border/50">
                        <div className="relative">
                            <FaSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
                            <input
                                type="text"
                                placeholder="חפש מסעדה, מנה או מספר הזמנה..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pr-9 pl-3 py-2 text-sm border border-gray-200 dark:border-brand-dark-border rounded-xl focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 outline-none transition dark:bg-brand-dark-bg dark:text-brand-dark-text"
                            />
                        </div>
                        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                            {[
                                { key: 'all', label: 'הכל' },
                                { key: 'active', label: 'פעילות' },
                                { key: 'completed', label: 'הושלמו' },
                                { key: 'cancelled', label: 'בוטלו' },
                            ].map(f => (
                                <button
                                    key={f.key}
                                    onClick={() => setFilter(f.key)}
                                    className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition ${
                                        filter === f.key
                                            ? 'bg-brand-primary text-white'
                                            : 'bg-gray-100 dark:bg-brand-dark-border text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                                    }`}
                                >
                                    {f.label}
                                    {f.key === 'all' && ` (${orders.length})`}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Orders List */}
                <div className="flex-1 overflow-y-auto px-5 py-3">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="animate-pulse text-gray-400 text-sm">טוען הזמנות...</div>
                        </div>
                    ) : filteredOrders.length === 0 ? (
                        <div className="text-center py-16 space-y-3">
                            <FaShoppingBag className="mx-auto text-4xl text-gray-300" />
                            <p className="text-gray-400 text-sm">
                                {search ? 'לא נמצאו תוצאות' : filter !== 'all' ? 'אין הזמנות בקטגוריה זו' : 'עדיין אין הזמנות'}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredOrders.map((order) => {
                                const isActive = !['completed', 'delivered', 'cancelled'].includes(order.status);
                                const isCancelled = order.status === 'cancelled';

                                return (
                                <div key={order.id} className="bg-gray-50 dark:bg-brand-dark-bg rounded-2xl overflow-hidden border border-gray-100 dark:border-brand-dark-border/50">
                                    {/* Order Header */}
                                    <div
                                        className={`p-3.5 space-y-2 ${isActive ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-brand-dark-border/30 transition' : ''}`}
                                        onClick={() => {
                                            if (isActive && order.restaurant_tenant_id) {
                                                onClose();
                                                navigate(`/${order.restaurant_tenant_id}/order-status/${order.id}`);
                                            }
                                        }}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-2.5">
                                                {order.restaurant_logo_url ? (
                                                    <img src={order.restaurant_logo_url} alt="" className="w-10 h-10 rounded-xl object-cover shadow-sm" />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center">
                                                        <FaStore className="text-brand-primary" size={14} />
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="font-bold text-sm text-gray-900 dark:text-brand-dark-text">{order.restaurant_name}</p>
                                                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                                                        <span className="flex items-center gap-1">
                                                            <FaClock size={9} />
                                                            {new Date(order.created_at).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                        <span>·</span>
                                                        <span className="flex items-center gap-1">
                                                            {order.delivery_method === 'delivery' ? <FaTruck size={9} /> : <FaStore size={9} />}
                                                            {order.delivery_method === 'delivery' ? 'משלוח' : 'איסוף'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-left flex-shrink-0">
                                                <p className="font-bold text-sm text-gray-900 dark:text-brand-dark-text">₪{Number(order.total_amount).toFixed(2)}</p>
                                                <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-600'}`}>
                                                    {STATUS_LABELS[order.status] || order.status}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Active order indicator */}
                                        {isActive && (
                                            <div className="flex items-center gap-1.5 text-xs text-brand-primary font-bold">
                                                <span className="w-1.5 h-1.5 bg-brand-primary rounded-full animate-pulse" />
                                                <span>לחץ למעקב אחר ההזמנה</span>
                                                <FaChevronDown className="rotate-[-90deg]" size={8} />
                                            </div>
                                        )}

                                        {/* Cancellation reason */}
                                        {isCancelled && order.cancellation_reason && (
                                            <div className="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-2.5 py-1.5">
                                                <FaTimes size={9} className="mt-0.5 shrink-0" />
                                                <span>סיבת ביטול: {order.cancellation_reason}</span>
                                            </div>
                                        )}

                                        {/* Items preview */}
                                        <div className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                            {order.items?.slice(0, 4).map((item, i) => (
                                                <span key={i}>
                                                    {item.name} ×{item.quantity}
                                                    {item.variant_name && <span className="text-gray-400"> ({item.variant_name})</span>}
                                                    {i < Math.min((order.items?.length || 0), 4) - 1 && ' · '}
                                                </span>
                                            ))}
                                            {(order.items?.length || 0) > 4 && <span className="text-gray-400"> +{order.items.length - 4}</span>}
                                        </div>

                                        {/* Order ID */}
                                        <p className="text-[10px] text-gray-300 dark:text-gray-600">הזמנה #{order.id}</p>
                                    </div>

                                    {/* Reorder button */}
                                    {['completed', 'delivered'].includes(order.status) && (
                                        <button
                                            onClick={() => handleReorder(order.id, order)}
                                            disabled={reordering === order.id}
                                            className="w-full flex items-center justify-center gap-1.5 bg-brand-primary/5 hover:bg-brand-primary/10 text-brand-primary border-t border-gray-100 dark:border-brand-dark-border/50 px-4 py-2.5 font-bold text-xs transition disabled:opacity-50"
                                        >
                                            <FaRedo size={10} className={reordering === order.id ? 'animate-spin' : ''} />
                                            <span>{reordering === order.id ? 'מכין הזמנה...' : 'הזמן שוב'}</span>
                                        </button>
                                    )}
                                </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
