import { useEffect, useState, useCallback } from 'react';
import SuperAdminLayout from '../../layouts/SuperAdminLayout';
import api from '../../services/apiClient';
import { useAdminAuth } from '../../context/AdminAuthContext';
import {
    FaShoppingCart,
    FaBell,
    FaCheckCircle,
    FaStore,
    FaPhone,
    FaShekelSign,
    FaBox,
    FaClock,
    FaExternalLinkAlt,
} from 'react-icons/fa';

const TABS = [
    { key: 'open', label: 'סלים פתוחים', icon: FaShoppingCart },
    { key: 'reminded', label: 'נשלחו תזכורת', icon: FaBell },
    { key: 'converted', label: 'הזמנות שנצלו', icon: FaCheckCircle },
];

export default function SuperAdminAbandonedCarts() {
    const { getAuthHeaders } = useAdminAuth();
    const [sessions, setSessions] = useState([]);
    const [restaurants, setRestaurants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('open');
    const [restaurantId, setRestaurantId] = useState('');
    const [month, setMonth] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ current_page: 1, last_page: 1 });

    const fetchRestaurants = useCallback(async () => {
        try {
            const res = await api.get('/super-admin/cart-sessions/restaurants', { headers: getAuthHeaders() });
            if (res.data?.success) setRestaurants(res.data.restaurants || []);
        } catch { }
    }, [getAuthHeaders]);

    const fetchSessions = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                status: activeTab,
                page,
            });
            if (restaurantId) params.set('restaurant_id', restaurantId);
            if (activeTab !== 'open') params.set('month', month);

            const res = await api.get(`/super-admin/cart-sessions?${params}`, { headers: getAuthHeaders() });
            if (res.data?.success) {
                const data = res.data.data;
                setSessions(data?.data || []);
                setPagination({
                    current_page: data?.current_page || 1,
                    last_page: data?.last_page || 1,
                });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [getAuthHeaders, activeTab, restaurantId, month, page]);

    useEffect(() => { fetchRestaurants(); }, [fetchRestaurants]);
    useEffect(() => { fetchSessions(); }, [fetchSessions]);

    const statusLabel = (s) => {
        switch (s) {
            case 'open': return { label: 'פתוח', cls: 'bg-amber-50 text-amber-700' };
            case 'reminded': return { label: 'נשלחה תזכורת', cls: 'bg-blue-50 text-blue-700' };
            case 'converted': return { label: 'נצלה', cls: 'bg-green-50 text-green-700' };
            default: return { label: s, cls: 'bg-gray-50 text-gray-600' };
        }
    };

    const cartUrl = (tenantId) => {
        const base = window.location.origin.replace(/\/$/, '');
        return tenantId ? `${base}/${tenantId}/cart` : '#';
    };

    return (
        <SuperAdminLayout>
            <div className="space-y-6" dir="rtl">
                <div className="mb-8">
                    <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                        <div className="p-2 bg-brand-primary/10 rounded-lg">
                            <FaShoppingCart className="text-brand-primary" size={20} />
                        </div>
                        סל נטוש
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">סלים פתוחים, תזכורות שנשלחו והזמנות שנצלו</p>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 flex-wrap">
                    {TABS.map((t) => (
                        <button
                            key={t.key}
                            onClick={() => {
                                setActiveTab(t.key);
                                setPage(1);
                            }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${activeTab === t.key
                                    ? 'bg-brand-primary text-white shadow-md'
                                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                                }`}
                        >
                            <t.icon size={14} />
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                    <label className="flex items-center gap-2">
                        <span className="text-sm text-gray-600 font-medium">מסעדה</span>
                        <select
                            value={restaurantId}
                            onChange={(e) => {
                                setRestaurantId(e.target.value);
                                setPage(1);
                            }}
                            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        >
                            <option value="">הכל</option>
                            {restaurants.map((r) => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                        </select>
                    </label>
                    {activeTab !== 'open' && (
                        <label className="flex items-center gap-2">
                            <span className="text-sm text-gray-600 font-medium">חודש</span>
                            <input
                                type="month"
                                value={month}
                                onChange={(e) => {
                                    setMonth(e.target.value);
                                    setPage(1);
                                }}
                                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                            />
                        </label>
                    )}
                </div>

                {/* Table */}
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="hidden md:grid grid-cols-12 gap-2 px-6 py-3 bg-gray-50 border-b border-gray-100 text-[10px] font-black uppercase tracking-widest text-gray-500">
                        <div className="col-span-2">מסעדה</div>
                        <div className="col-span-1">טלפון</div>
                        <div className="col-span-1">סכום</div>
                        <div className="col-span-1">פריטים</div>
                        <div className="col-span-2">תאריך עדכון</div>
                        <div className="col-span-2">סטטוס</div>
                        <div className="col-span-1">קישור</div>
                    </div>

                    {loading ? (
                        <div className="p-12 text-center text-gray-400">
                            <div className="w-8 h-8 border-2 border-brand-primary/20 border-t-brand-primary rounded-full animate-spin mx-auto mb-3" />
                            <p className="text-xs font-bold uppercase tracking-widest">טוען...</p>
                        </div>
                    ) : sessions.length === 0 ? (
                        <div className="p-12 text-center text-gray-300">
                            <FaShoppingCart size={32} className="mx-auto mb-3 opacity-20" />
                            <p className="text-xs font-bold uppercase tracking-widest">אין רשומות</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {sessions.map((s) => {
                                const st = statusLabel(s.status);
                                return (
                                    <div key={s.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 px-6 py-4 hover:bg-gray-50/50 transition-colors items-center">
                                        <div className="col-span-2 flex items-center gap-2">
                                            <FaStore size={12} className="text-gray-400" />
                                            <span className="text-sm font-bold text-gray-900">{s.restaurant?.name || '—'}</span>
                                        </div>
                                        <div className="col-span-1 text-xs text-gray-600 flex flex-col gap-0.5">
                                            <span className="font-mono flex items-center gap-1">
                                                <FaPhone size={10} /> {s.customer_phone}
                                            </span>
                                            {s.customer_name && (
                                                <span className={`text-[11px] ${s.is_registered_customer ? 'font-bold text-gray-900' : 'text-gray-700'}`}>
                                                    {s.customer_name}
                                                </span>
                                            )}
                                        </div>
                                        <div className="col-span-1 text-sm font-bold text-brand-primary flex items-center gap-1">
                                            <FaShekelSign size={10} /> {s.order_total != null ? s.order_total.toFixed(0) : s.total_amount?.toFixed(0) ?? '—'}
                                        </div>
                                        <div className="col-span-1 text-xs text-gray-600 flex items-center gap-1">
                                            <FaBox size={10} /> {s.item_count}
                                        </div>
                                        <div className="col-span-2 text-xs text-gray-500 flex items-center gap-1">
                                            <FaClock size={10} />
                                            {s.updated_at ? new Date(s.updated_at).toLocaleString('he-IL') : '—'}
                                        </div>
                                        <div className="col-span-2">
                                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${st.cls}`}>
                                                {st.label}
                                            </span>
                                        </div>
                                        <div className="col-span-1 flex flex-col gap-1">
                                            {s.restaurant?.tenant_id && (
                                                <a
                                                    href={cartUrl(s.restaurant.tenant_id)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-xs text-brand-primary hover:underline"
                                                >
                                                    <FaExternalLinkAlt size={10} /> עגלה
                                                </a>
                                            )}
                                            {s.order_status_url && (
                                                <a
                                                    href={s.order_status_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-brand-primary hover:underline"
                                                >
                                                    <FaExternalLinkAlt size={10} /> הזמנה
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {pagination.last_page > 1 && (
                        <div className="flex items-center justify-center gap-4 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
                            <button
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={pagination.current_page <= 1}
                                className="p-2 rounded-lg border border-gray-200 hover:bg-white disabled:opacity-30 transition-colors"
                            >
                                →
                            </button>
                            <span className="text-xs font-bold text-gray-600">
                                עמוד {pagination.current_page} מתוך {pagination.last_page}
                            </span>
                            <button
                                onClick={() => setPage((p) => Math.min(pagination.last_page, p + 1))}
                                disabled={pagination.current_page >= pagination.last_page}
                                className="p-2 rounded-lg border border-gray-200 hover:bg-white disabled:opacity-30 transition-colors"
                            >
                                ←
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </SuperAdminLayout>
    );
}
