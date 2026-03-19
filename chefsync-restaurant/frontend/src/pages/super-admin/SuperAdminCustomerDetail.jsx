import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import SuperAdminLayout from '../../layouts/SuperAdminLayout';
import { useAdminAuth } from '../../context/AdminAuthContext';
import api from '../../services/apiClient';
import {
    FaArrowRight, FaSpinner, FaUser, FaPhone, FaEnvelope,
    FaShoppingBag, FaClock, FaCheckCircle, FaMapMarkerAlt,
    FaTimes, FaLink
} from 'react-icons/fa';

const STATUS_LABELS = {
    pending: 'ממתין', confirmed: 'אושר', preparing: 'בהכנה',
    ready: 'מוכן', on_the_way: 'בדרך', delivered: 'נמסר',
    completed: 'הושלם', cancelled: 'בוטל',
};

const STATUS_COLORS = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-blue-100 text-blue-800',
    preparing: 'bg-orange-100 text-orange-800',
    ready: 'bg-green-100 text-green-800',
    on_the_way: 'bg-indigo-100 text-indigo-800',
    delivered: 'bg-green-100 text-green-800',
    completed: 'bg-gray-100 text-gray-700',
    cancelled: 'bg-red-100 text-red-800',
};

export default function SuperAdminCustomerDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { getAuthHeaders } = useAdminAuth();
    const [customer, setCustomer] = useState(null);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState(null);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const res = await api.get(`/super-admin/customers/${id}`, { headers: getAuthHeaders() });
                const payload = res.data?.data ?? res.data;
                if (res.data?.success && payload) {
                    setCustomer(payload.customer ?? payload);
                    setOrders(payload.orders ?? []);
                }
            } catch (err) {
                console.error('Failed to load customer:', err?.response?.status, err?.response?.data);
            }
            setLoading(false);
        };
        load();
    }, [id, getAuthHeaders]);

    if (loading) {
        return (
            <SuperAdminLayout>
                <div className="flex items-center justify-center py-32">
                    <FaSpinner className="animate-spin text-indigo-600" size={28} />
                </div>
            </SuperAdminLayout>
        );
    }

    if (!customer) {
        return (
            <SuperAdminLayout>
                <div className="text-center py-20">
                    <p className="text-gray-400">לקוח לא נמצא</p>
                    <button onClick={() => navigate('/super-admin/customers')} className="text-indigo-600 font-bold text-sm mt-2">חזור לרשימה</button>
                </div>
            </SuperAdminLayout>
        );
    }

    return (
        <SuperAdminLayout>
            <div className="space-y-6" dir="rtl">
                {/* Back */}
                <button onClick={() => navigate('/super-admin/customers')} className="flex items-center gap-2 text-sm font-bold text-indigo-600 hover:underline">
                    <FaArrowRight size={12} />
                    חזור לרשימת לקוחות
                </button>

                {/* Profile card */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <div className="flex items-start gap-4">
                        <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center text-2xl font-black">
                            {customer.name?.charAt(0) || <FaUser />}
                        </div>
                        <div className="flex-1 space-y-2">
                            <h2 className="text-xl font-black text-gray-900">{customer.name}</h2>
                            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                                <span className="flex items-center gap-1.5"><FaPhone size={11} className="text-gray-400" /> <span dir="ltr">{customer.phone}</span></span>
                                {customer.email && (
                                    <span className="flex items-center gap-1.5">
                                        <FaEnvelope size={11} className="text-gray-400" />
                                        {customer.email}
                                        {customer.email_verified_at ? <FaCheckCircle className="text-green-500" size={10} /> : <FaClock className="text-amber-500" size={10} />}
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-3 text-xs">
                                <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 font-bold">{customer.total_orders || 0} הזמנות</span>
                                {customer.is_registered && <span className="px-2.5 py-1 rounded-full bg-green-50 text-green-700 font-bold">רשום</span>}
                                {customer.user_id && <span className="px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 font-bold flex items-center gap-1"><FaLink size={8} /> מקושר למשתמש</span>}
                                <span className="px-2.5 py-1 rounded-full bg-gray-50 text-gray-600 font-bold">
                                    מאז {new Date(customer.created_at).toLocaleDateString('he-IL')}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Addresses */}
                {customer.addresses?.length > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                        <h3 className="text-sm font-black text-gray-900 flex items-center gap-2 mb-4">
                            <FaMapMarkerAlt className="text-gray-400" />
                            כתובות שמורות ({customer.addresses.length})
                        </h3>
                        <div className="space-y-2">
                            {customer.addresses.map(addr => (
                                <div key={addr.id} className="bg-gray-50 rounded-xl p-3 text-sm">
                                    <p className="font-bold text-gray-800">{addr.label} — {addr.street} {addr.house_number}, {addr.city}</p>
                                    {addr.notes && <p className="text-xs text-gray-400 mt-0.5">{addr.notes}</p>}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Orders */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h3 className="text-sm font-black text-gray-900 flex items-center gap-2 mb-4">
                        <FaShoppingBag className="text-gray-400" />
                        היסטוריית הזמנות ({orders.length})
                    </h3>
                    {orders.length === 0 ? (
                        <p className="text-gray-400 text-sm text-center py-8">אין הזמנות</p>
                    ) : (
                        <div className="space-y-2 max-h-[500px] overflow-y-auto">
                            {orders.map(order => (
                                <div
                                    key={order.id}
                                    onClick={() => setSelectedOrder(order)}
                                    className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-white border border-gray-200 rounded-lg flex items-center justify-center text-xs font-black text-gray-600">
                                            #{String(order.id).slice(-4)}
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500">
                                                {new Date(order.created_at).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                            <p className="text-[10px] text-gray-400">
                                                {(order.items?.length ?? order.items_count ?? 0)} פריטים
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-600'}`}>
                                            {STATUS_LABELS[order.status] || order.status}
                                        </span>
                                        <span className="text-sm font-black text-gray-900">₪{Number(order.total_amount || order.total || 0).toFixed(0)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Order Detail Modal */}
                {selectedOrder && (
                    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
                        <div className="fixed inset-0 bg-black/50" onClick={() => setSelectedOrder(null)} />
                        <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden z-10" dir="rtl">
                            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                                <h3 className="text-lg font-black text-gray-900">
                                    הזמנה #{String(selectedOrder.id).slice(-4)} — {new Date(selectedOrder.created_at).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                </h3>
                                <button onClick={() => setSelectedOrder(null)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
                                    <FaTimes size={18} />
                                </button>
                            </div>
                            <div className="p-4 overflow-y-auto max-h-[60vh]">
                                <div className="space-y-2 mb-4">
                                    {(selectedOrder.items || []).map((item) => (
                                        <div key={item.id} className="flex justify-between items-center py-2 border-b border-gray-50 text-sm">
                                            <span className="font-bold text-gray-800">
                                                {item.menu_item?.name ?? item.name ?? 'פריט'}
                                                {item.quantity > 1 ? ` × ${item.quantity}` : ''}
                                            </span>
                                            <span className="text-gray-600">₪{Number((item.price_at_order ?? item.price ?? 0) * (item.quantity || 1)).toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t border-gray-200 font-black text-gray-900">
                                    <span>סה״כ</span>
                                    <span>₪{Number(selectedOrder.total_amount || selectedOrder.total || 0).toFixed(2)}</span>
                                </div>
                                <div className="mt-3">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[selectedOrder.status] || 'bg-gray-100 text-gray-600'}`}>
                                        {STATUS_LABELS[selectedOrder.status] || selectedOrder.status}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </SuperAdminLayout>
    );
}
