import { useState, useEffect } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import AdminLayout from '../../layouts/AdminLayout';
import api from '../../services/apiClient';
import {
    FaDesktop,
    FaClock,
    FaInfoCircle,
    FaCheckCircle,
    FaRoute,
    FaPrint,
    FaTimes,
    FaBoxOpen
} from 'react-icons/fa';

// מסוף סניף לעובדים/שליחים: מציג הזמנות פתוחות ומאפשר עדכון סטטוס מהיר
export default function AdminTerminal() {
    const { getAuthHeaders } = useAdminAuth();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchOrders();
        const interval = setInterval(fetchOrders, 30000);
        return () => clearInterval(interval);
    }, []);

    const formatAddons = (addons) => {
        if (!Array.isArray(addons) || addons.length === 0) return { inside: '', onSide: '' };

        const inside = addons
            .filter(addon => {
                const onSide = typeof addon === 'object' ? addon?.on_side : false;
                return !onSide;
            })
            .map(addon => typeof addon === 'string' ? addon : (addon?.name ?? addon?.addon_name))
            .filter(Boolean)
            .join(' · ');

        const onSide = addons
            .filter(addon => {
                const onSide = typeof addon === 'object' ? addon?.on_side : false;
                return onSide;
            })
            .map(addon => typeof addon === 'string' ? addon : (addon?.name ?? addon?.addon_name))
            .filter(Boolean)
            .join(' · ');

        return { inside, onSide };
    };

    const getItemCategoryLabel = (item) => (
        item?.category_name
        || item?.menu_item?.category?.name
        || item?.menu_item?.category_name
        || 'ללא קטגוריה'
    );

    const groupItemsByCategory = (items = []) => {
        const groups = [];
        const map = new Map();
        items.forEach((item) => {
            const label = getItemCategoryLabel(item);
            if (!map.has(label)) {
                const entry = { label, items: [] };
                map.set(label, entry);
                groups.push(entry);
            }
            map.get(label).items.push(item);
        });
        return groups;
    };

    const fetchOrders = async () => {
        try {
            // קבל את כל ההזמנות וסנן לפי סטטוס פתוח
            const response = await api.get('/admin/orders', {
                headers: getAuthHeaders()
            });
            if (response.data.success) {
                // סנן רק הזמנות שלא הושלמו או בוטלו
                const allOrders = response.data.orders.data || response.data.orders;
                const openOrders = allOrders.filter(order =>
                    order.status !== 'delivered' && order.status !== 'cancelled'
                );
                setOrders(openOrders);
            }
        } catch (error) {
            console.error('Failed to fetch orders:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateStatus = async (orderId, status) => {
        try {
            await api.patch(`/admin/orders/${orderId}/status`, { status }, { headers: getAuthHeaders() });
            fetchOrders();
        } catch (error) {
            console.error('Failed to update status:', error);
        }
    };

    const nextStatus = (status) => {
        const flow = {
            pending: 'preparing',
            received: 'preparing',
            preparing: 'ready',
            ready: 'delivering',
            delivering: 'delivered',
        };
        return flow[status] || null;
    };

    const statusLabel = {
        pending: 'ממתין',
        received: 'התקבל',
        preparing: 'בהכנה',
        ready: 'מוכן',
        delivering: 'במשלוח',
        delivered: 'נמסר',
        cancelled: 'בוטל',
    };

    if (loading) {
        return (
            <AdminLayout>
                <div className="flex flex-col items-center justify-center h-96">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-brand-primary"></div>
                    <p className="mt-4 text-gray-500 font-black animate-pulse">טוען מסוף סניף...</p>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="max-w-[1600px] mx-auto space-y-10 pb-32 animate-in fade-in duration-500">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 px-4">
                    <div className="flex items-center gap-5">
                        <div className="w-20 h-20 bg-indigo-50 rounded-[2.5rem] flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100/50">
                            <FaDesktop size={32} />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black text-gray-900 tracking-tight flex items-center gap-4">
                                מסוף סניף
                                <span className="text-sm bg-brand-primary/10 text-brand-primary px-4 py-1.5 rounded-full font-black animate-pulse">
                                    LIVE
                                </span>
                            </h1>
                            <p className="text-gray-500 font-medium mt-1">ניהול הזמנות בזמן אמת - מטבח, שליחים ושירות</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-4 w-full md:w-auto">
                        <div className="flex items-center gap-3 bg-white px-6 py-4 rounded-[1.5rem] shadow-sm border border-gray-100 flex-1 md:flex-none">
                            <div className="w-3 h-3 bg-emerald-500 rounded-full animate-ping" />
                            <span className="text-sm font-black text-gray-900 whitespace-nowrap">
                                {orders.length} הזמנות פתוחות
                            </span>
                        </div>
                        <button
                            onClick={fetchOrders}
                            className="p-4 bg-gray-900 text-white rounded-[1.5rem] hover:bg-black transition-all active:scale-95 shadow-lg group flex-1 md:flex-none justify-center font-black"
                        >
                            רענן נתונים
                        </button>
                    </div>
                </div>

                {orders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 bg-white rounded-[4rem] border-2 border-dashed border-gray-100 shadow-sm mx-4">
                        <div className="w-32 h-32 bg-gray-50 rounded-[3rem] flex items-center justify-center text-6xl mb-8 group-hover:scale-110 transition-transform">
                            🍕
                        </div>
                        <h2 className="text-3xl font-black text-gray-900 mb-3">אין הזמנות פתוחות כרגע</h2>
                        <p className="text-gray-500 font-medium text-lg">כאשר לקוחות יזמינו, הם יופיעו כאן באופן אוטומטי</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 px-4">
                        {orders.map((order) => {
                            const next = nextStatus(order.status);
                            const items = order.items || [];
                            const categoryGroups = groupItemsByCategory(items);

                            return (
                                <div
                                    key={order.id}
                                    className={`group flex flex-col bg-white rounded-[3.5rem] shadow-sm border-2 transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 overflow-hidden ${order.status === 'ready' ? 'border-amber-200' :
                                        order.status === 'preparing' ? 'border-brand-primary/20' :
                                            'border-gray-50'
                                        }`}
                                >
                                    {/* Order Header Card */}
                                    <div className={`p-8 pb-6 border-b border-gray-50 transition-colors ${order.status === 'ready' ? 'bg-amber-50/50' :
                                        order.status === 'preparing' ? 'bg-brand-primary/[0.03]' :
                                            'bg-gray-50/30'
                                        }`}>
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-3xl font-black text-gray-900">#{order.id.toString().slice(-4)}</h3>
                                                    {order.is_test && (
                                                        <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-purple-100 text-purple-700 border-2 border-purple-300 animate-pulse">
                                                            🧪 דוגמה
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-gray-400 font-bold text-xs mt-1 uppercase tracking-widest flex items-center gap-2">
                                                    <FaClock size={10} />
                                                    {new Date(order.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                            <div className={`px-5 py-2 rounded-2xl text-xs font-black uppercase tracking-widest shadow-sm ${order.status === 'ready' ? 'bg-amber-500 text-white animate-bounce' :
                                                order.status === 'preparing' ? 'bg-brand-primary text-white' :
                                                    'bg-indigo-500 text-white'
                                                }`}>
                                                {statusLabel[order.status]}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-xl shadow-sm border border-gray-100">
                                                👤
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-lg font-black text-gray-900 truncate tracking-tight">{order.customer_name}</p>
                                                <p className="text-gray-400 text-sm font-bold ltr text-right">{order.customer_phone}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Order Items (Scrollable Body) */}
                                    <div className="flex-1 p-8 space-y-6 overflow-y-auto max-h-[400px] custom-scrollbar shadow-inner bg-white/50">
                                        {categoryGroups.map((group, idx) => (
                                            <div key={idx} className="space-y-3">
                                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                                    <div className="h-px bg-gray-100 flex-1" />
                                                    {group.label}
                                                    <div className="h-px bg-gray-100 flex-1" />
                                                </h4>
                                                {group.items.map((item, itemIdx) => (
                                                    <div key={itemIdx} className="bg-gray-50/50 rounded-2xl p-4 border border-gray-50 group/item hover:bg-white hover:shadow-md transition-all">
                                                        <div className="flex justify-between gap-4">
                                                            <div className="flex items-start gap-3">
                                                                <span className="w-7 h-7 bg-white rounded-lg flex items-center justify-center text-xs font-black text-brand-primary shadow-sm border border-gray-100">
                                                                    {item.quantity || 1}
                                                                </span>
                                                                <p className="font-black text-gray-900 text-sm leading-tight">{item.menu_item?.name || item.name || 'פריט'}</p>
                                                            </div>
                                                            <div className="text-right text-gray-900 font-bold text-xs">₪{(Number(item.price_at_order || item.price || 0) * Number(item.quantity || 1)).toFixed(2)}</div>
                                                        </div>
                                                        {(() => {
                                                            const { inside, onSide } = formatAddons(item.addons);
                                                            return (
                                                                <div className="mt-2 mr-10 space-y-1">
                                                                    {inside && (
                                                                        <p className="text-[11px] text-gray-500 font-medium leading-relaxed bg-white/60 p-2 rounded-xl border border-gray-100/50">
                                                                            תוספות: {inside}
                                                                        </p>
                                                                    )}
                                                                    {onSide && (
                                                                        <p className="text-[11px] text-orange-600 font-medium leading-relaxed bg-orange-50/60 p-2 rounded-xl border border-orange-100/50 flex items-center gap-1">
                                                                            <FaBoxOpen /> בצד: {onSide}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            );
                                                        })()}
                                                        {item.variant_name && (
                                                            <p className="mt-1 text-[10px] text-gray-400 font-black mr-10 italic">
                                                                סוג: {item.variant_name}
                                                            </p>
                                                        )}
                                                        {item.notes && (
                                                            <div className="mt-2 mr-10 flex items-start gap-2 text-[10px] text-rose-500 font-bold bg-rose-50 p-2 rounded-xl">
                                                                <FaInfoCircle className="mt-0.5 shrink-0" />
                                                                <span>הערה: {item.notes}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Action Footers */}
                                    <div className="p-8 bg-gray-50/50 border-t border-gray-100 mt-auto">
                                        <div className="flex justify-between items-center mb-6 px-2">
                                            <span className="text-sm font-black text-gray-400">סה"כ לתשלום</span>
                                            <span className="text-2xl font-black text-gray-900 tracking-tighter">₪{Number(order.total).toFixed(2)}</span>
                                        </div>

                                        {next ? (
                                            <button
                                                onClick={() => updateStatus(order.id, next)}
                                                className={`w-full py-5 rounded-[2rem] font-black text-lg transition-all active:scale-95 shadow-xl flex items-center justify-center gap-4 hover:-translate-y-1 ${order.status === 'ready' ? 'bg-emerald-500 text-white shadow-emerald-500/20 hover:bg-emerald-600' :
                                                    order.status === 'preparing' ? 'bg-amber-500 text-white shadow-amber-500/20 hover:bg-amber-600' :
                                                        'bg-brand-primary text-white shadow-brand-primary/20 hover:bg-brand-dark'
                                                    }`}
                                            >
                                                {order.status === 'ready' ? (
                                                    <><FaCheckCircle /> הכר כנמסר</>
                                                ) : (
                                                    <><FaRoute /> {statusLabel[next]}</>
                                                )}
                                            </button>
                                        ) : (
                                            <div className="text-center py-4 bg-emerald-50 text-emerald-600 rounded-3xl font-black text-sm border border-emerald-100 flex items-center justify-center gap-2">
                                                <FaCheckCircle /> הושלם
                                            </div>
                                        )}

                                        <div className="grid grid-cols-2 gap-3 mt-4">
                                            <button
                                                className="py-3 bg-white text-gray-600 rounded-2xl text-xs font-black shadow-sm border border-gray-100 hover:bg-gray-50 transition-all active:scale-95 flex items-center justify-center gap-2"
                                                onClick={() => window.print()}
                                            >
                                                <FaPrint size={12} /> הדפס
                                            </button>
                                            <button
                                                onClick={() => updateStatus(order.id, 'cancelled')}
                                                className="py-3 bg-white text-rose-500 rounded-2xl text-xs font-black shadow-sm border border-gray-100 hover:bg-rose-50 transition-all active:scale-95 flex items-center justify-center gap-2"
                                            >
                                                <FaTimes size={12} /> ביטול
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
