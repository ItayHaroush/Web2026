import { useState, useEffect } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import AdminLayout from '../../layouts/AdminLayout';
import api from '../../services/apiClient';
import { reprintOrder } from '../../services/printerService';
import {
    FaDesktop,
    FaClock,
    FaInfoCircle,
    FaCheckCircle,
    FaRoute,
    FaPrint,
    FaTimes,
    FaBoxOpen,
    FaRedoAlt
} from 'react-icons/fa';

// מסוף סניף לעובדים/שליחים: מציג הזמנות פתוחות ומאפשר עדכון סטטוס מהיר
export default function AdminTerminal() {
    const { getAuthHeaders, user } = useAdminAuth();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reprintingId, setReprintingId] = useState(null);

    const formatPhone = (phone) => {
        if (!phone) return '';
        let p = phone.replace(/\s+/g, '');
        if (p.startsWith('+972')) p = '0' + p.slice(4);
        else if (p.startsWith('972')) p = '0' + p.slice(3);
        if (/^0\d{9}$/.test(p)) return p.slice(0, 3) + '-' + p.slice(3);
        return p;
    };

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

    const handleReprint = async (orderId) => {
        setReprintingId(orderId);
        try {
            const res = await reprintOrder(orderId);
            alert(res.message || 'ההדפסה נשלחה בהצלחה');
        } catch (error) {
            console.error('Failed to reprint:', error);
            alert(error.response?.data?.message || 'שגיאה בהדפסה חוזרת');
        } finally {
            setReprintingId(null);
        }
    };

    const printSingleOrder = (order) => {
        const items = order.items || [];
        const time = new Date(order.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
        const date = new Date(order.created_at).toLocaleDateString('he-IL');

        let sourceLabel = '';
        if (order.source === 'kiosk') {
            sourceLabel = order.order_type === 'dine_in' ? 'קיוסק - לשבת' : 'קיוסק - לקחת';
            if (order.table_number) sourceLabel += ` | שולחן ${order.table_number}`;
        } else if (order.delivery_method === 'delivery') {
            sourceLabel = 'משלוח';
        } else {
            sourceLabel = 'איסוף עצמי';
        }

        const itemsHtml = items.map(item => {
            const name = item.menu_item?.name || item.name || 'פריט';
            const qty = item.quantity || 1;
            const price = (Number(item.price_at_order || item.price || 0) * qty).toFixed(2);
            const addons = Array.isArray(item.addons) ? item.addons : [];
            const insideAddons = addons
                .filter(a => !(typeof a === 'object' && a?.on_side))
                .map(a => typeof a === 'string' ? a : (a?.name ?? a?.addon_name))
                .filter(Boolean);
            const sideAddons = addons
                .filter(a => typeof a === 'object' && a?.on_side)
                .map(a => a?.name ?? a?.addon_name)
                .filter(Boolean);

            let html = `<tr><td style="padding:6px 0;font-weight:bold">${qty}x ${name}</td><td style="padding:6px 0;text-align:left;white-space:nowrap">₪${price}</td></tr>`;
            if (item.variant_name) {
                html += `<tr><td colspan="2" style="padding:0 0 4px 0;color:#666;font-size:12px;padding-right:20px">סוג: ${item.variant_name}</td></tr>`;
            }
            if (insideAddons.length > 0) {
                html += `<tr><td colspan="2" style="padding:0 0 4px 0;color:#666;font-size:12px;padding-right:20px">+ ${insideAddons.join(', ')}</td></tr>`;
            }
            if (sideAddons.length > 0) {
                html += `<tr><td colspan="2" style="padding:0 0 4px 0;color:#e67e22;font-size:12px;padding-right:20px">בצד: ${sideAddons.join(', ')}</td></tr>`;
            }
            if (item.notes) {
                html += `<tr><td colspan="2" style="padding:0 0 4px 0;color:#e74c3c;font-size:12px;padding-right:20px">הערה: ${item.notes}</td></tr>`;
            }
            return html;
        }).join('');

        const printWindow = window.open('', '_blank', 'width=400,height=600');
        printWindow.document.write(`<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="utf-8">
<title>הזמנה #${order.id}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; padding: 20px; max-width: 350px; margin: 0 auto; font-size: 14px; }
  .header { text-align: center; border-bottom: 2px dashed #333; padding-bottom: 12px; margin-bottom: 12px; }
  .header h1 { font-size: 22px; margin-bottom: 4px; }
  .header .meta { font-size: 12px; color: #555; }
  .info { border-bottom: 1px dashed #ccc; padding-bottom: 10px; margin-bottom: 10px; }
  .info p { margin: 3px 0; font-size: 13px; }
  .items { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  .items td { vertical-align: top; font-size: 13px; }
  .total { border-top: 2px dashed #333; padding-top: 10px; text-align: center; font-size: 18px; font-weight: bold; margin-top: 8px; }
  .footer { text-align: center; margin-top: 16px; font-size: 11px; color: #999; border-top: 1px dashed #ccc; padding-top: 10px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <div class="header">
    <h1>הזמנה #${order.id}</h1>
    <div class="meta">${date} | ${time}</div>
    <div class="meta" style="margin-top:4px;font-weight:bold">${sourceLabel}</div>
  </div>
  <div class="info">
    <p><strong>${order.customer_name}</strong></p>
    <p dir="ltr" style="text-align:right">${formatPhone(order.customer_phone)}</p>
    ${order.delivery_address ? `<p>כתובת: ${order.delivery_address}</p>` : ''}
    ${order.delivery_notes ? `<p>הערות: ${order.delivery_notes}</p>` : ''}
  </div>
  <table class="items">${itemsHtml}</table>
  ${order.delivery_fee > 0 ? `<div style="font-size:13px;text-align:left;padding:4px 0;border-top:1px dashed #eee">דמי משלוח: ₪${Number(order.delivery_fee).toFixed(2)}</div>` : ''}
  <div class="total">סה"כ: ₪${Number(order.total_amount || order.total || 0).toFixed(2)}</div>
  <div class="footer">${user?.restaurant?.name || 'ChefSync'}</div>
  <script>window.onload=function(){window.print();window.onafterprint=function(){window.close();}}<\/script>
</body>
</html>`);
        printWindow.document.close();
    };

    const nextStatus = (status, deliveryMethod) => {
        const flow = {
            pending: 'preparing',
            received: 'preparing',
            preparing: 'ready',
            ready: deliveryMethod === 'delivery' ? 'delivering' : 'delivered',
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
                            const next = nextStatus(order.status, order.delivery_method);
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
                                                    {order.source === 'kiosk' && (
                                                        <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-amber-100 text-amber-700 border-2 border-amber-300">
                                                            קיוסק
                                                        </span>
                                                    )}
                                                    {order.order_type === 'dine_in' && (
                                                        <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-green-100 text-green-700 border-2 border-green-300">
                                                            לשבת
                                                        </span>
                                                    )}
                                                    {order.order_type === 'takeaway' && (
                                                        <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-orange-100 text-orange-700 border-2 border-orange-300">
                                                            לקחת
                                                        </span>
                                                    )}
                                                    {order.table_number && (
                                                        <span className="px-3 py-1 rounded-full text-xs font-black bg-indigo-100 text-indigo-700 border-2 border-indigo-300">
                                                            שולחן {order.table_number}
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
                                                <p className="text-gray-400 text-sm font-bold ltr text-right">{formatPhone(order.customer_phone)}</p>
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
                                                {order.status === 'ready' && order.delivery_method !== 'delivery' ? (
                                                    <><FaCheckCircle /> הכר כנמסר</>
                                                ) : order.status === 'ready' && order.delivery_method === 'delivery' ? (
                                                    <><FaRoute /> שלח למשלוח</>
                                                ) : order.status === 'delivering' ? (
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

                                        <div className={`grid gap-3 mt-4 ${['preparing', 'ready', 'delivering'].includes(order.status) ? 'grid-cols-3' : 'grid-cols-2'}`}>
                                            <button
                                                className="py-3 bg-white text-gray-600 rounded-2xl text-xs font-black shadow-sm border border-gray-100 hover:bg-gray-50 transition-all active:scale-95 flex items-center justify-center gap-2"
                                                onClick={() => printSingleOrder(order)}
                                            >
                                                <FaPrint size={12} /> הדפס
                                            </button>
                                            {['preparing', 'ready', 'delivering'].includes(order.status) && (
                                                <button
                                                    onClick={() => handleReprint(order.id)}
                                                    disabled={reprintingId === order.id}
                                                    className="py-3 bg-white text-blue-600 rounded-2xl text-xs font-black shadow-sm border border-gray-100 hover:bg-blue-50 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                                                >
                                                    <FaRedoAlt size={12} /> {reprintingId === order.id ? 'שולח...' : 'הדפס למטבח'}
                                                </button>
                                            )}
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
