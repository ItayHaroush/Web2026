import React, { useState, useEffect, useRef } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { useRestaurantStatus } from '../../context/RestaurantStatusContext';
import AdminLayout from '../../layouts/AdminLayout';
import api from '../../services/apiClient';
import {
    FaReceipt,
    FaClock,
    FaUser,
    FaPhone,
    FaMapMarkerAlt,
    FaInfoCircle,
    FaCheckCircle,
    FaSpinner,
    FaBoxOpen,
    FaTruck,
    FaCheck,
    FaTimes,
    FaBell,
    FaExclamationTriangle,
    FaArrowLeft,
    FaMotorcycle,
    FaShoppingBag,
    FaHistory
} from 'react-icons/fa';

export default function AdminOrders() {
    const { getAuthHeaders } = useAdminAuth();
    const { restaurantStatus } = useRestaurantStatus();
    const [orders, setOrders] = useState([]);
    const [allOrders, setAllOrders] = useState([]); // כל ההזמנות ללא סינון
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('');
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [newOrderAlert, setNewOrderAlert] = useState(false);
    const [etaExtraMinutes, setEtaExtraMinutes] = useState('');
    const [etaNote, setEtaNote] = useState('');
    const [etaUpdating, setEtaUpdating] = useState(false);
    const previousOrdersCount = useRef(0);
    const isLocked = restaurantStatus?.is_approved === false;

    const formatAddons = (addons) => {
        if (!Array.isArray(addons) || addons.length === 0) return '';
        return addons
            .map((addon) => {
                if (typeof addon === 'string') return addon;
                return addon?.name ?? addon?.addon_name ?? null;
            })
            .filter(Boolean)
            .join(' · ');
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

    useEffect(() => {
        fetchOrders();
        // רענון אוטומטי כל 10 שניות
        const interval = setInterval(fetchOrders, 10000);
        return () => clearInterval(interval);
    }, [filterStatus]);

    useEffect(() => {
        if (!selectedOrder) return;
        setEtaExtraMinutes('');
        setEtaNote(selectedOrder.eta_note || '');
    }, [selectedOrder]);

    const fetchOrders = async () => {
        try {
            const params = filterStatus ? { status: filterStatus } : {};
            const response = await api.get('/admin/orders', {
                headers: getAuthHeaders(),
                params
            });
            if (response.data.success) {
                const newOrders = response.data.orders.data || response.data.orders;

                // בדיקה אם יש הזמנות חדשות (רק כשמציגים הכל או הזמנות ממתינות)
                if (!filterStatus && previousOrdersCount.current > 0 && newOrders.length > previousOrdersCount.current) {
                    setNewOrderAlert(true);
                    playNotificationSound();
                    setTimeout(() => setNewOrderAlert(false), 5000);
                }

                if (!filterStatus) {
                    previousOrdersCount.current = newOrders.length;
                    setAllOrders(newOrders);
                }

                setOrders(newOrders);

                return newOrders;
            }
        } catch (error) {
            console.error('Failed to fetch orders:', error);
        } finally {
            setLoading(false);
        }

        return null;
    };

    const playNotificationSound = () => {
        // צליל התראה באמצעות Audio API
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.value = 0.3;

        oscillator.start();
        setTimeout(() => oscillator.stop(), 200);

        setTimeout(() => {
            const osc2 = audioContext.createOscillator();
            const gain2 = audioContext.createGain();
            osc2.connect(gain2);
            gain2.connect(audioContext.destination);
            osc2.frequency.value = 1000;
            osc2.type = 'sine';
            gain2.gain.value = 0.3;
            osc2.start();
            setTimeout(() => osc2.stop(), 200);
        }, 250);
    };

    const updateStatus = async (orderId, newStatus) => {
        if (isLocked) {
            alert('המסעדה ממתינה לאישור מנהל מערכת. פעולות על הזמנות נעולות זמנית.');
            return;
        }
        try {
            console.log('Updating order', orderId, 'to status:', newStatus);
            const response = await api.patch(`/admin/orders/${orderId}/status`,
                { status: newStatus },
                { headers: getAuthHeaders() }
            );
            console.log('Update response:', response.data);

            if (response.data.success) {
                // רענון רשימת ההזמנות
                const refreshed = await fetchOrders();

                // עדכון ההזמנה הנבחרת (חשוב: להשאיר items/addons/variant_name ולא לדרוס עם payload חלקי)
                if (selectedOrder?.id === orderId) {
                    const refreshedOrder = Array.isArray(refreshed)
                        ? refreshed.find((o) => o.id === orderId)
                        : null;
                    setSelectedOrder(refreshedOrder || response.data.order || selectedOrder);
                }
            } else {
                console.error('Update failed:', response.data);
                alert('שגיאה בעדכון סטטוס: ' + (response.data.message || 'שגיאה לא ידועה'));
            }
        } catch (error) {
            console.error('Failed to update status:', error);
            console.error('Error details:', error.response?.data);
        }
    };

    const updateEta = async () => {
        if (isLocked) {
            alert('המסעדה ממתינה לאישור מנהל מערכת. פעולות על הזמנות נעולות זמנית.');
            return;
        }
        if (!selectedOrder) return;
        const extra = Number(etaExtraMinutes);
        if (!Number.isFinite(extra) || extra <= 0) {
            alert('נא להזין תוספת בדקות (מספר חיובי)');
            return;
        }

        const current = Number(selectedOrder.eta_minutes || 0);
        const newEta = current + extra;

        try {
            setEtaUpdating(true);
            const response = await api.patch(
                `/admin/orders/${selectedOrder.id}/eta`,
                {
                    eta_minutes: newEta,
                    eta_note: etaNote || null,
                },
                { headers: getAuthHeaders() }
            );

            if (response.data.success) {
                const refreshed = await fetchOrders();
                const refreshedOrder = Array.isArray(refreshed)
                    ? refreshed.find((o) => o.id === selectedOrder.id)
                    : null;
                setSelectedOrder(refreshedOrder || response.data.order || selectedOrder);
                setEtaExtraMinutes('');
            } else {
                alert('שגיאה בעדכון זמן ההזמנה');
            }
        } catch (error) {
            console.error('Failed to update ETA:', error);
            alert('שגיאה בעדכון זמן ההזמנה');
        } finally {
            setEtaUpdating(false);
        }
    };

    const statusOptions = [
        { value: '', label: 'הכל', icon: <FaReceipt /> },
        { value: 'pending', label: 'ממתין', icon: <FaClock /> },
        { value: 'received', label: 'התקבל', icon: <FaBell /> },
        { value: 'preparing', label: 'בהכנה', icon: <FaSpinner className="animate-spin" /> },
        { value: 'ready', label: 'מוכן', icon: <FaCheckCircle /> },
        { value: 'delivering', label: 'במשלוח', icon: <FaMotorcycle /> },
        { value: 'delivered', label: 'נמסר', icon: <FaBoxOpen /> },
        { value: 'cancelled', label: 'בוטל', icon: <FaTimes /> },
    ];

    const getStatusBadge = (status) => {
        const statuses = {
            pending: {
                text: 'ממתין',
                color: 'bg-amber-50 text-amber-600 border-amber-100',
                icon: <FaClock />,
                nextStatus: 'preparing'
            },
            received: {
                text: 'התקבל',
                color: 'bg-amber-50 text-amber-600 border-amber-100',
                icon: <FaBell />,
                nextStatus: 'preparing'
            },
            preparing: {
                text: 'בהכנה',
                color: 'bg-blue-50 text-blue-600 border-blue-100',
                icon: <FaSpinner className="animate-spin" />,
                nextStatus: 'ready'
            },
            ready: {
                text: 'מוכן',
                color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
                icon: <FaCheckCircle />,
                nextStatus: 'delivering'
            },
            delivering: {
                text: 'במשלוח',
                color: 'bg-purple-50 text-purple-600 border-purple-100',
                icon: <FaMotorcycle />,
                nextStatus: 'delivered'
            },
            delivered: {
                text: 'נמסר',
                color: 'bg-slate-50 text-slate-600 border-slate-100',
                icon: <FaBoxOpen />,
                nextStatus: null
            },
            cancelled: {
                text: 'בוטל',
                color: 'bg-red-50 text-red-600 border-red-100',
                icon: <FaTimes />,
                nextStatus: null
            },
        };
        return statuses[status] || {
            text: status,
            color: 'bg-gray-50 text-gray-700 border-gray-100',
            icon: <FaInfoCircle />,
            nextStatus: null
        };
    };

    if (loading) {
        return (
            <AdminLayout>
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            {/* התרעת הזמנה חדשה מודרנית */}
            {newOrderAlert && (
                <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-bounce">
                    <div className="bg-white rounded-3xl shadow-2xl p-4 flex items-center gap-4 border-2 border-emerald-500 backdrop-blur-xl">
                        <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center animate-pulse">
                            <FaBell size={24} />
                        </div>
                        <div>
                            <p className="font-black text-gray-900 text-lg leading-none">הזמנה חדשה!</p>
                            <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mt-1">יש להכין את המנה במהירות</p>
                        </div>
                    </div>
                </div>
            )}

            {/* כותרת ומונה הזמנות מודרנית */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4 sm:p-6 mb-6 overflow-hidden relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/5 rounded-full -mr-16 -mt-16 blur-2xl" />
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                            <div className="w-10 h-10 bg-brand-primary text-white rounded-xl flex items-center justify-center shadow-lg shadow-brand-primary/20">
                                <FaReceipt size={18} />
                            </div>
                            ניהול הזמנות
                        </h1>
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest mt-2 flex items-center gap-2">
                            {(allOrders.length || orders.length)} הזמנות במערכת
                        </p>
                    </div>
                    <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl border border-gray-100">
                        <div className="text-center px-4 border-l border-gray-200">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-tight">ממתינות</p>
                            <p className="text-2xl font-black text-amber-600 leading-none mt-1">
                                {(allOrders.length ? allOrders : orders).filter(o => ['pending', 'received'].includes(o.status)).length}
                            </p>
                        </div>
                        <div className="text-center px-4">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-tight">סה"כ היום</p>
                            <p className="text-2xl font-black text-brand-primary leading-none mt-1">
                                {allOrders.length || orders.length}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* פילטרים - טאבים מודרניים */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-2 mb-6 overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-1 min-w-max">
                    {statusOptions.map((option) => {
                        const ordersToCount = allOrders.length ? allOrders : orders;
                        const count = option.value ? ordersToCount.filter(o => o.status === option.value).length : ordersToCount.length;
                        const isActive = filterStatus === option.value;

                        return (
                            <button
                                key={option.value}
                                onClick={() => setFilterStatus(option.value)}
                                className={`px-4 py-2.5 rounded-2xl font-black text-[11px] uppercase tracking-wider transition-all flex items-center gap-2.5 group relative ${isActive
                                        ? 'bg-gray-900 text-white shadow-lg'
                                        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                                    }`}
                            >
                                <span className={`${isActive ? 'text-white' : 'text-gray-400 group-hover:text-brand-primary'} transition-colors`}>
                                    {option.icon}
                                </span>
                                {option.label}
                                {count > 0 && (
                                    <span className={`px-1.5 py-0.5 rounded-lg text-[9px] font-black min-w-[20px] ${isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                                        }`}>
                                        {count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* רשימת הזמנות */}
                <div className="lg:col-span-12 xl:col-span-7">
                    <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-gray-50 flex items-center justify-between bg-slate-50/50">
                            <h2 className="font-black text-gray-900 flex items-center gap-2 uppercase tracking-wide text-sm">
                                <FaHistory className="text-gray-400" />
                                רשימת הזמנות
                            </h2>
                            <div className="px-3 py-1 bg-white rounded-full border border-gray-200 text-[10px] font-bold text-gray-500">
                                {orders.length} תוצאות
                            </div>
                        </div>
                        <div className="divide-y divide-gray-50 max-h-[700px] overflow-y-auto custom-scrollbar">
                            {orders.length === 0 ? (
                                <div className="p-20 text-center">
                                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-dashed border-gray-200">
                                        <FaReceipt size={32} className="text-gray-300" />
                                    </div>
                                    <p className="text-sm font-black text-gray-400 uppercase tracking-[0.2em]">אין הזמנות להצגה</p>
                                </div>
                            ) : (
                                orders.map((order) => {
                                    const statusBadge = getStatusBadge(order.status);
                                    const isPending = ['pending', 'received'].includes(order.status);
                                    const isDelivery = order.delivery_method === 'delivery' || (!!order.delivery_address);
                                    const isSelected = selectedOrder?.id === order.id;

                                    return (
                                        <div
                                            key={order.id}
                                            onClick={() => setSelectedOrder(order)}
                                            className={`p-4 sm:p-5 cursor-pointer transition-all relative group ${isSelected
                                                    ? 'bg-brand-primary/5'
                                                    : 'hover:bg-gray-50/80 active:bg-gray-100'
                                                }`}
                                        >
                                            {/* אינדיקטור בחירה */}
                                            {isSelected && (
                                                <div className="absolute inset-y-0 right-0 w-1.5 bg-brand-primary rounded-l-full shadow-[0_0_15px_rgba(var(--brand-primary-rgb),0.5)]" />
                                            )}

                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-14 h-14 rounded-2xl border flex flex-col items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${isPending
                                                            ? 'bg-amber-50 border-amber-200 shadow-[0_0_10px_rgba(251,191,36,0.3)] animate-pulse'
                                                            : isSelected ? 'bg-white border-brand-primary/30 shadow-md' : 'bg-white border-gray-100 shadow-sm'
                                                        }`}>
                                                        <span className="text-[10px] font-black text-gray-400 tracking-tighter leading-none">#</span>
                                                        <span className={`text-sm font-black mt-0.5 ${isPending ? 'text-amber-700' : 'text-gray-900'}`}>{order.id}</span>
                                                    </div>

                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-3 mb-1.5">
                                                            <p className="font-black text-gray-900 text-base truncate">{order.customer_name}</p>
                                                            <div className={`px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase border flex items-center gap-1.5 ${statusBadge.color}`}>
                                                                <span className="w-1 h-1 rounded-full bg-current animate-pulse" />
                                                                {statusBadge.text}
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                                                            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500">
                                                                <FaClock size={10} className="text-gray-400" />
                                                                {new Date(order.created_at).toLocaleString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                                            </div>
                                                            <div className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-tight py-0.5 px-2 rounded-full border ${isDelivery ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-orange-50 text-orange-600 border-orange-100'
                                                                }`}>
                                                                {isDelivery ? <FaMotorcycle size={10} /> : <FaShoppingBag size={10} />}
                                                                {isDelivery ? 'משלוח' : 'איסוף עצמי'}
                                                            </div>
                                                            {isDelivery && order.delivery_address && (
                                                                <div className="flex items-center gap-1.5 text-xs font-bold text-gray-400 truncate max-w-[200px]">
                                                                    <FaMapMarkerAlt size={10} />
                                                                    {order.delivery_address}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between sm:flex-col sm:items-end sm:justify-center gap-2 pr-0 sm:pr-4">
                                                    <p className="text-xl font-black text-gray-900">
                                                        ₪{Number(order.total).toFixed(2)}
                                                    </p>
                                                    <div className={`w-8 h-8 rounded-full border border-gray-100 flex items-center justify-center transition-all ${isSelected ? 'bg-brand-primary text-white border-brand-primary border-2 animate-bounce' : 'bg-white text-gray-300 group-hover:bg-gray-100'
                                                        }`}>
                                                        <FaArrowLeft size={10} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

                {/* פרטי הזמנה - פאנל צדדי מודרני */}
                <div className="lg:col-span-12 xl:col-span-5">
                    {selectedOrder ? (
                        <div className="bg-white rounded-[2rem] border border-gray-200 shadow-xl overflow-hidden sticky top-24 animate-in fade-in slide-in-from-left-4 duration-300">
                            {/* כותרת הפרטים */}
                            <div className="p-6 border-b border-gray-100 bg-slate-50 relative">
                                <div className="absolute top-0 left-0 w-24 h-24 bg-brand-primary/5 rounded-full -ml-12 -mt-12" />
                                <div className="flex items-center justify-between relative z-10">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center text-gray-900 font-black">
                                            #{selectedOrder.id}
                                        </div>
                                        <div>
                                            <h3 className="font-black text-gray-900 text-lg leading-none">פרטי הזמנה</h3>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-2 flex items-center gap-2">
                                                <FaClock size={10} />
                                                {new Date(selectedOrder.created_at).toLocaleString('he-IL', {
                                                    day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
                                                })}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setSelectedOrder(null)}
                                        className="w-8 h-8 rounded-full bg-white border border-gray-100 text-gray-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-all shadow-sm"
                                    >
                                        <FaTimes size={12} />
                                    </button>
                                </div>
                            </div>

                            <div className="p-6 space-y-6 max-h-[calc(100vh-250px)] overflow-y-auto custom-scrollbar">
                                {/* סטטוס נוכחי - כרטיס בולט */}
                                <div className={`rounded-3xl p-5 border-2 relative overflow-hidden group ${getStatusBadge(selectedOrder.status).color}`}>
                                    <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform">
                                        {getStatusBadge(selectedOrder.status).icon && React.cloneElement(getStatusBadge(selectedOrder.status).icon, { size: 80 })}
                                    </div>
                                    <div className="relative z-10">
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-1">סטטוס הזמנה</p>
                                        <div className="flex items-center gap-3">
                                            <div className="text-2xl font-black">{getStatusBadge(selectedOrder.status).text}</div>
                                            {selectedOrder.status === 'preparing' && (
                                                <div className="flex gap-1">
                                                    <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                                    <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                                    <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                                </div>
                                            )}
                                        </div>
                                        {selectedOrder.updated_by_name && (
                                            <div className="mt-4 pt-3 border-t border-current/10 flex items-center gap-2 opacity-70">
                                                <FaUser size={10} />
                                                <span className="text-[10px] font-bold uppercase">טופל ע"י {selectedOrder.updated_by_name}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* פרטי לקוח - גריד */}
                                <div className="bg-slate-50 rounded-3xl p-5 border border-gray-100">
                                    <h4 className="font-black text-gray-900 text-xs uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <FaUser className="text-gray-400" />
                                        מידע לקוח
                                    </h4>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center text-brand-primary">
                                                    <FaUser size={16} />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-black text-gray-400 uppercase tracking-tighter">שם מלא</p>
                                                    <p className="text-sm font-black text-gray-900">{selectedOrder.customer_name}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <a
                                                    href={`tel:${selectedOrder.customer_phone}`}
                                                    className="w-10 h-10 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center text-emerald-500 hover:bg-emerald-50 hover:border-emerald-200 transition-all"
                                                >
                                                    <FaPhone size={14} />
                                                </a>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center text-brand-primary">
                                                <FaMapMarkerAlt size={16} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-black text-gray-400 uppercase tracking-tighter">
                                                    {selectedOrder.delivery_method === 'delivery' ? 'כתובת משלוח' : 'אופן קבלת הזמנה'}
                                                </p>
                                                <p className="text-sm font-black text-gray-900 truncate">
                                                    {selectedOrder.delivery_method === 'delivery'
                                                        ? (selectedOrder.delivery_address || 'לא צוינה כתובת')
                                                        : 'איסוף עצמי מהמסעדה'
                                                    }
                                                </p>
                                            </div>
                                        </div>

                                        {selectedOrder.delivery_notes && (
                                            <div className="bg-amber-50 rounded-2xl p-3 border border-amber-100 flex items-start gap-3">
                                                <FaInfoCircle className="text-amber-500 mt-1 shrink-0" size={14} />
                                                <p className="text-xs font-bold text-amber-700 leading-normal">
                                                    <span className="block uppercase tracking-widest text-[9px] mb-0.5 opacity-70">הערות לקוח:</span>
                                                    {selectedOrder.delivery_notes}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* ניהול זמן (ETA) - עיצוב חדש */}
                                <div className="bg-white border-2 border-slate-100 rounded-3xl p-5 shadow-sm group hover:border-brand-primary/20 transition-all">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="font-black text-gray-900 text-xs uppercase tracking-widest flex items-center gap-2">
                                            <FaClock className="text-brand-primary" />
                                            זמן משוער (ETA)
                                        </h4>
                                        {selectedOrder.eta_minutes && (
                                            <span className="px-3 py-1 bg-brand-primary/10 text-brand-primary rounded-full text-[10px] font-black">
                                                {selectedOrder.eta_minutes} דק'
                                            </span>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                        <div className="space-y-1.5 text-right">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-tight mr-1">הארכה (דק')</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    value={etaExtraMinutes}
                                                    onChange={(e) => setEtaExtraMinutes(e.target.value)}
                                                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-black focus:ring-2 focus:ring-brand-primary group-hover:bg-slate-100"
                                                    placeholder="0"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1.5 text-right">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-tight mr-1">הערה ללקוח</label>
                                            <input
                                                type="text"
                                                value={etaNote}
                                                onChange={(e) => setEtaNote(e.target.value)}
                                                className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-black focus:ring-2 focus:ring-brand-primary group-hover:bg-slate-100"
                                                placeholder="עיכוב אפשרי"
                                            />
                                        </div>
                                    </div>

                                    <button
                                        onClick={updateEta}
                                        disabled={etaUpdating || !etaExtraMinutes || isLocked}
                                        className="w-full bg-slate-900 text-white p-3.5 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-lg hover:shadow-slate-200 transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        {etaUpdating ? (
                                            <FaSpinner className="animate-spin mx-auto" />
                                        ) : 'עדכן זמן ושלח SMS'}
                                    </button>
                                </div>

                                {/* פריטי הזמנה */}
                                <div>
                                    <h4 className="font-black text-gray-900 text-xs uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <FaShoppingBag className="text-gray-400" />
                                        פירוט הזמנה
                                    </h4>
                                    <div className="space-y-6">
                                        {groupItemsByCategory(selectedOrder.items || []).map((group) => (
                                            <div key={group.label} className="space-y-3">
                                                <div className="flex items-center gap-3">
                                                    <span className="h-[1px] flex-1 bg-gray-100" />
                                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-3 py-1 bg-white border border-gray-100 rounded-full">{group.label}</span>
                                                    <span className="h-[1px] flex-1 bg-gray-100" />
                                                </div>
                                                <div className="space-y-2">
                                                    {group.items.map((item, index) => {
                                                        const quantity = Number(item.quantity ?? item.qty ?? 1);
                                                        const unitPrice = Number(item.price_at_order ?? item.price ?? 0);
                                                        const variantDelta = Number(item.variant_price_delta ?? 0);
                                                        const addonsTotal = Number(item.addons_total ?? 0);
                                                        const basePrice = Math.max(unitPrice - variantDelta - addonsTotal, 0);
                                                        const lineTotal = (unitPrice * quantity).toFixed(2);
                                                        const addons = Array.isArray(item.addons) ? item.addons : [];
                                                        const hasCustomizations = Boolean(item.variant_name) || addons.length > 0 || variantDelta > 0 || addonsTotal > 0;

                                                        return (
                                                            <div key={`${group.label}-${index}`} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                                                                <div className="flex justify-between items-start">
                                                                    <div className="space-y-1.5">
                                                                        <div className="font-black text-gray-900 text-base leading-none">
                                                                            {item.menu_item?.name || item.name || 'פריט'}
                                                                            <span className="text-brand-primary mr-2">×{quantity}</span>
                                                                        </div>
                                                                        {item.variant_name && (
                                                                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-50 rounded-lg text-[10px] font-bold text-slate-600 w-fit">
                                                                                <FaInfoCircle size={8} />
                                                                                {item.variant_name}
                                                                            </div>
                                                                        )}
                                                                        {addons.length > 0 && (
                                                                            <div className="text-[11px] font-medium text-gray-500 bg-emerald-50/50 p-2 rounded-xl border border-emerald-100/50">
                                                                                <span className="font-black text-emerald-700 uppercase tracking-tighter text-[9px] block mb-0.5">תוספות:</span>
                                                                                {formatAddons(addons)}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-left">
                                                                        <div className="font-black text-gray-900 text-lg leading-none">₪{lineTotal}</div>
                                                                        <div className="text-[10px] font-black text-gray-400 mt-1 uppercase tracking-tighter">₪{unitPrice.toFixed(2)} / יח'</div>
                                                                    </div>
                                                                </div>
                                                                {hasCustomizations && (
                                                                    <div className="mt-3 pt-3 border-t border-gray-50 flex flex-wrap gap-x-4 gap-y-1 text-[9px] font-black uppercase tracking-widest text-gray-400">
                                                                        <div>בסיס: ₪{basePrice.toFixed(2)}</div>
                                                                        {variantDelta > 0 && <div>וריאציה: +₪{variantDelta.toFixed(2)}</div>}
                                                                        {addonsTotal > 0 && <div>תוספות: +₪{addonsTotal.toFixed(2)}</div>}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* סיכום - כרטיס בולט */}
                                <div className="bg-gray-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16" />
                                    <div className="relative z-10">
                                        <div className="flex justify-between items-end">
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-50 mb-1">סה"כ לתשלום</p>
                                                <p className="text-3xl font-black">₪{Number(selectedOrder.total || 0).toFixed(2)}</p>
                                            </div>
                                            <div className="text-left opacity-30">
                                                <FaReceipt size={40} />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* כפתורי פעולה - מודרניים */}
                                <div className="space-y-4 pt-2 pb-6">
                                    {(() => {
                                        const currentBadge = getStatusBadge(selectedOrder.status);
                                        const nextStatus = currentBadge.nextStatus;

                                        if (nextStatus) {
                                            const nextBadge = getStatusBadge(nextStatus);
                                            const buttonConfigs = {
                                                'preparing': { text: 'אישור והתחלת הכנה', icon: <FaCheckCircle />, color: 'from-brand-primary to-brand-secondary' },
                                                'ready': { text: 'סיום הכנה - מוכן!', icon: <FaCheckCircle />, color: 'from-emerald-500 to-emerald-600' },
                                                'delivering': { text: 'יצא למשלוח', icon: <FaMotorcycle />, color: 'from-purple-500 to-purple-600' },
                                                'delivered': { text: 'מסירה ללקוח', icon: <FaBoxOpen />, color: 'from-slate-700 to-slate-800' }
                                            };

                                            const config = buttonConfigs[nextStatus] || { text: `העבר ל${nextBadge.text}`, icon: nextBadge.icon, color: 'from-gray-700 to-gray-800' };

                                            return (
                                                <button
                                                    onClick={() => updateStatus(selectedOrder.id, nextStatus)}
                                                    disabled={isLocked}
                                                    className={`w-full bg-gradient-to-r ${config.color} text-white py-5 rounded-[2rem] font-black text-lg shadow-xl shadow-current/10 hover:shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider`}
                                                >
                                                    {config.icon}
                                                    {config.text}
                                                </button>
                                            );
                                        }
                                        return null;
                                    })()}

                                    {selectedOrder.status !== 'cancelled' && selectedOrder.status !== 'delivered' && (
                                        <button
                                            onClick={() => {
                                                if (confirm('האם אתה בטוח שברצונך לבטל את ההזמנה?')) {
                                                    updateStatus(selectedOrder.id, 'cancelled');
                                                }
                                            }}
                                            disabled={isLocked}
                                            className="w-full bg-red-50 text-red-600 p-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-red-100 transition-all active:scale-95 flex items-center justify-center gap-2 group disabled:opacity-50"
                                        >
                                            <FaTimes size={14} className="group-hover:rotate-90 transition-transform" />
                                            ביטול הזמנה לצמיתות
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-12 text-center sticky top-24">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-dashed border-gray-200">
                                <FaInfoCircle size={32} className="text-gray-300 animate-pulse" />
                            </div>
                            <h3 className="text-lg font-black text-gray-900 mb-2 uppercase tracking-tight">נא לבחור הזמנה</h3>
                            <p className="text-xs font-bold text-gray-400 leading-relaxed max-w-[200px] mx-auto uppercase tracking-widest mt-4">
                                בחר הזמנה מהרשימה בצד ימין כדי לצפות בפרטים המלאים ולעדכן סטטוס
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}
