import { useState, useEffect, useCallback } from 'react';
import SuperAdminLayout from '../../layouts/SuperAdminLayout';
import { useAdminAuth } from '../../context/AdminAuthContext';
import api from '../../services/apiClient';
import toast from 'react-hot-toast';
import {
    FaGlobe,
    FaSearch,
    FaChevronRight,
    FaChevronLeft,
    FaRocket,
    FaTimes,
} from 'react-icons/fa';

const STATUS_LABELS = {
    awaiting_payment: 'ממתין לתשלום',
    pending: 'ממתין לטיפול',
    in_progress: 'בטיפול',
    awaiting_customer_info: 'ממתין למידע',
    awaiting_dns: 'ממתין ל-DNS',
    ssl_setup: 'בהגדרת SSL',
    active: 'פעיל',
    rejected: 'נדחה',
    completed: 'הושלם',
};

const TYPE_LABELS = {
    existing_domain: 'דומיין קיים',
    full_service: 'שירות מלא',
    change_domain: 'שינוי',
    disconnect_domain: 'ניתוק',
};

const PAYMENT_LABELS = {
    awaiting_payment: 'ממתין לתשלום',
    paid: 'שולם',
    waived: 'פטור',
    included_in_setup: 'כלול בהקמה',
    refunded: 'הוחזר',
};

const PAYMENT_COLORS = {
    awaiting_payment: 'bg-amber-100 text-amber-900',
    paid: 'bg-green-100 text-green-900',
    waived: 'bg-gray-100 text-gray-700',
    included_in_setup: 'bg-blue-100 text-blue-900',
    refunded: 'bg-red-100 text-red-900',
};

const AUDIT_ACTION_LABELS = {
    created: 'בקשה נוצרה',
    included_in_setup: 'סומן כלול בהקמה',
    payment_received: 'תשלום התקבל',
    payment_status_changed: 'סטטוס תשלום השתנה',
    status_changed: 'סטטוס השתנה',
    note_added: 'הערה נוספה',
    vercel_prepared: 'נוסף ל-Vercel',
    vercel_sync: 'סנכרון Vercel',
    activate_blocked: 'הפעלה נחסמה',
    domain_activated: 'דומיין הופעל',
    domain_disconnected: 'דומיין נותק',
    disconnect_vercel_warning: 'אזהרת ניתוק Vercel',
    rejected: 'בקשה נדחתה',
};

const STATUS_OPTIONS = Object.keys(STATUS_LABELS).filter((s) => s !== 'active');

export default function SuperAdminDomainRequests() {
    const { getAuthHeaders } = useAdminAuth();
    const [items, setItems] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [activateDomain, setActivateDomain] = useState('');
    const [readiness, setReadiness] = useState(null);

    const HEALTH_LABELS = {
        pending: 'ממתין',
        dns_pending: 'DNS ממתין',
        ssl_pending: 'SSL ממתין',
        healthy: 'תקין',
        error: 'שגיאה',
    };

    const fetchList = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page) });
            if (statusFilter) params.set('status', statusFilter);
            if (search) params.set('search', search);
            const res = await api.get(`/super-admin/domain-requests?${params}`, { headers: getAuthHeaders() });
            if (res.data?.success) {
                setItems(res.data.data?.data || []);
                setLastPage(res.data.data?.last_page || 1);
                setStats(res.data.stats || null);
            }
        } catch {
            toast.error('שגיאה בטעינה');
        } finally {
            setLoading(false);
        }
    }, [getAuthHeaders, page, statusFilter, search]);

    useEffect(() => { fetchList(); }, [fetchList]);

    const loadDetail = async (id) => {
        setDetailLoading(true);
        try {
            const res = await api.get(`/super-admin/domain-requests/${id}`, { headers: getAuthHeaders() });
            if (res.data?.success) {
                setSelected(res.data.data);
                setActivateDomain(res.data.data.domain_name || '');
                setReadiness(null);
            }
        } catch {
            toast.error('שגיאה בטעינת פרטים');
        } finally {
            setDetailLoading(false);
        }
    };

    const updateStatus = async (id, status) => {
        try {
            const res = await api.patch(`/super-admin/domain-requests/${id}/status`, { status }, { headers: getAuthHeaders() });
            if (res.data?.success) {
                toast.success('סטטוס עודכן');
                fetchList();
                if (selected?.id === id) setSelected(res.data.data);
            }
        } catch {
            toast.error('שגיאה בעדכון');
        }
    };

    const handlePrepareVercel = async () => {
        if (!selected) return;
        try {
            const res = await api.post(`/super-admin/domain-requests/${selected.id}/prepare-vercel`, {}, { headers: getAuthHeaders() });
            if (res.data?.success) {
                toast.success('נוסף ל-Vercel — שלח הוראות DNS ללקוח');
                setReadiness(res.data.readiness);
                loadDetail(selected.id);
                fetchList();
            }
        } catch (e) {
            toast.error(e.response?.data?.message || 'שגיאה');
        }
    };

    const handleSyncVercel = async () => {
        if (!selected) return;
        try {
            const res = await api.post(`/super-admin/domain-requests/${selected.id}/sync-vercel`, {}, { headers: getAuthHeaders() });
            if (res.data?.success) {
                setReadiness(res.data.readiness);
                toast.success(res.data.can_activate ? 'מוכן להפעלה!' : (res.data.readiness?.message || 'סונכרן'));
                loadDetail(selected.id);
            }
        } catch (e) {
            toast.error(e.response?.data?.message || 'שגיאה');
        }
    };

    const handleExecuteDisconnect = async () => {
        if (!selected || !window.confirm('לנתק את הדומיין? הפעולה תסיר מ-Vercel ותשמור היסטוריה.')) return;
        try {
            const res = await api.post(`/super-admin/domain-requests/${selected.id}/execute-disconnect`, {}, { headers: getAuthHeaders() });
            if (res.data?.success) {
                toast.success('הדומיין נותק');
                fetchList();
                loadDetail(selected.id);
            }
        } catch (e) {
            toast.error(e.response?.data?.message || 'שגיאה');
        }
    };

    const handleActivate = async () => {
        if (!selected) return;
        try {
            const res = await api.post(
                `/super-admin/domain-requests/${selected.id}/activate-domain`,
                { active_domain: activateDomain },
                { headers: getAuthHeaders() }
            );
            if (res.data?.success) {
                toast.success('הדומיין הופעל');
                fetchList();
                loadDetail(selected.id);
            }
        } catch (e) {
            const msg = e.response?.data?.message || 'שגיאה בהפעלה';
            toast.error(msg);
            if (e.response?.data?.readiness) setReadiness(e.response.data.readiness);
            if (e.response?.data?.dns_records) {
                setSelected((s) => ({ ...s, dns_records: e.response.data.dns_records, status: e.response.data.status || s.status }));
            }
        }
    };

    const handleReject = async () => {
        if (!selected) return;
        const reason = window.prompt('סיבת דחייה:');
        if (!reason) return;
        try {
            await api.post(`/super-admin/domain-requests/${selected.id}/reject`, { rejection_reason: reason }, { headers: getAuthHeaders() });
            toast.success('הבקשה נדחתה');
            fetchList();
            loadDetail(selected.id);
        } catch {
            toast.error('שגיאה');
        }
    };

    const markIncluded = async () => {
        if (!selected) return;
        try {
            await api.post(
                `/super-admin/domain-requests/${selected.id}/payment-status`,
                { payment_status: 'included_in_setup' },
                { headers: getAuthHeaders() }
            );
            toast.success('סומן כלול בהקמה');
            loadDetail(selected.id);
            fetchList();
        } catch {
            toast.error('שגיאה');
        }
    };

    return (
        <SuperAdminLayout>
            <div className="p-4 sm:p-6 max-w-7xl mx-auto" dir="rtl">
                <div className="flex items-center gap-3 mb-6">
                    <FaGlobe className="text-brand-primary" size={24} />
                    <h1 className="text-2xl font-black text-gray-900">בקשות דומיין</h1>
                </div>

                {stats && (
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
                        {[
                            ['פתוחות', stats.open_requests],
                            ['החודש', stats.requests_this_month],
                            ['פעילים', stats.active_domains],
                            ['הכנסות ₪', Number(stats.domain_revenue || 0).toLocaleString()],
                            ['זמן ממוצע (ש)', stats.avg_resolution_hours ?? '—'],
                        ].map(([label, val]) => (
                            <div key={label} className="bg-white rounded-xl border border-gray-100 p-4">
                                <p className="text-xs text-gray-400 font-bold">{label}</p>
                                <p className="text-xl font-black text-gray-900">{val}</p>
                            </div>
                        ))}
                    </div>
                )}

                <form
                    onSubmit={(e) => { e.preventDefault(); setPage(1); setSearch(searchInput.trim()); }}
                    className="flex flex-wrap gap-2 mb-4"
                >
                    <div className="relative flex-1 min-w-[200px]">
                        <FaSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <input
                            className="w-full pr-9 pl-3 py-2 border border-gray-200 rounded-xl text-sm"
                            placeholder="חיפוש מסעדה / דומיין / מספר בקשה"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                        />
                    </div>
                    <select
                        className="border border-gray-200 rounded-xl px-3 py-2 text-sm"
                        value={statusFilter}
                        onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                    >
                        <option value="">כל הסטטוסים</option>
                        {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                        ))}
                    </select>
                    <button type="submit" className="px-4 py-2 bg-brand-primary text-white rounded-xl text-sm font-black">חפש</button>
                </form>

                <div className="grid lg:grid-cols-2 gap-6">
                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                        {loading ? (
                            <p className="p-8 text-center text-gray-400">טוען…</p>
                        ) : items.length === 0 ? (
                            <p className="p-8 text-center text-gray-400">אין בקשות</p>
                        ) : (
                            <ul className="divide-y divide-gray-50">
                                {items.map((item) => (
                                    <li key={item.id}>
                                        <button
                                            type="button"
                                            onClick={() => loadDetail(item.id)}
                                            className={`w-full text-right p-4 hover:bg-gray-50 transition-colors ${selected?.id === item.id ? 'bg-brand-primary/5' : ''}`}
                                        >
                                            <div className="flex justify-between items-start gap-2">
                                                <div>
                                                    <p className="font-black text-gray-900">{item.restaurant?.name}</p>
                                                    <p className="text-xs text-gray-500">{item.request_number} · {TYPE_LABELS[item.type]}</p>
                                                    <p className="text-xs font-mono text-gray-600 mt-1" dir="ltr">{item.domain_name}</p>
                                                    {item.payment_status && (
                                                        <span className={`inline-block mt-1 text-[10px] font-black px-2 py-0.5 rounded-full ${PAYMENT_COLORS[item.payment_status] || 'bg-gray-100 text-gray-600'}`}>
                                                            {PAYMENT_LABELS[item.payment_status] || item.payment_status}
                                                            {Number(item.amount) > 0 ? ` · ₪${Number(item.amount).toLocaleString()}` : ''}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-[10px] font-black bg-gray-100 px-2 py-1 rounded-full shrink-0">
                                                    {STATUS_LABELS[item.status]}
                                                </span>
                                            </div>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {lastPage > 1 && (
                            <div className="flex justify-center gap-4 p-4 border-t">
                                <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="p-2 disabled:opacity-30"><FaChevronRight /></button>
                                <span className="text-sm font-bold">{page} / {lastPage}</span>
                                <button type="button" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)} className="p-2 disabled:opacity-30"><FaChevronLeft /></button>
                            </div>
                        )}
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-100 p-5 min-h-[320px]">
                        {!selected ? (
                            <p className="text-gray-400 text-center py-12">בחר בקשה מהרשימה</p>
                        ) : detailLoading ? (
                            <p className="text-center py-12">טוען…</p>
                        ) : (
                            <>
                                <h2 className="font-black text-lg mb-1">{selected.restaurant?.name}</h2>
                                <p className="text-sm text-gray-500 mb-4">{selected.request_number}</p>

                                <div className="space-y-2 text-sm mb-4">
                                    <p><strong>איש קשר:</strong> {selected.requested_by?.name} · {selected.requested_by?.email}</p>
                                    <p dir="ltr"><strong>דומיין:</strong> {selected.domain_name}</p>
                                    <p>
                                        <strong>תשלום:</strong>{' '}
                                        <span className={`text-xs font-black px-2 py-0.5 rounded-full ${PAYMENT_COLORS[selected.payment_status] || 'bg-gray-100 text-gray-700'}`}>
                                            {PAYMENT_LABELS[selected.payment_status] || selected.payment_status}
                                        </span>
                                        {Number(selected.amount) > 0 ? ` · ₪${Number(selected.amount).toLocaleString()}` : ''}
                                    </p>
                                </div>

                                <select
                                    className="w-full border rounded-xl px-3 py-2 text-sm mb-3"
                                    value={selected.status}
                                    onChange={(e) => updateStatus(selected.id, e.target.value)}
                                >
                                    {STATUS_OPTIONS.map((s) => (
                                        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                                    ))}
                                </select>

                                {selected.payment_status === 'awaiting_payment' && (
                                    <button type="button" onClick={markIncluded} className="w-full mb-2 py-2 text-sm font-black bg-amber-100 text-amber-900 rounded-xl">
                                        סמן: כלול בהקמה
                                    </button>
                                )}

                                {!['active', 'rejected', 'completed'].includes(selected.status) && selected.type !== 'disconnect_domain' && (
                                    <div className="border-t pt-4 mt-4 space-y-2">
                                        <p className="text-xs font-black text-gray-500">Vercel & DNS</p>
                                        <div className="flex gap-2">
                                            <button type="button" onClick={handlePrepareVercel} className="flex-1 py-2 text-xs font-black bg-blue-100 text-blue-900 rounded-xl">
                                                הוסף ל-Vercel
                                            </button>
                                            <button type="button" onClick={handleSyncVercel} className="flex-1 py-2 text-xs font-black bg-gray-100 text-gray-800 rounded-xl">
                                                סנכרן סטטוס
                                            </button>
                                        </div>
                                        {readiness && (
                                            <div className={`text-xs rounded-xl p-3 ${readiness.can_activate ? 'bg-green-50 text-green-900' : 'bg-amber-50 text-amber-900'}`}>
                                                <p className="font-black">{readiness.can_activate ? 'מוכן להפעלה' : readiness.message}</p>
                                                <p>verified: {readiness.verified ? 'כן' : 'לא'} · SSL: {readiness.ssl_status} · health: {HEALTH_LABELS[readiness.health_status] || readiness.health_status}</p>
                                            </div>
                                        )}
                                        <p className="text-xs font-black text-gray-500 pt-2">הפעל דומיין</p>
                                        <input
                                            dir="ltr"
                                            className="w-full border rounded-xl px-3 py-2 text-sm font-mono"
                                            value={activateDomain}
                                            onChange={(e) => setActivateDomain(e.target.value)}
                                        />
                                        {selected.dns_records?.length > 0 && (
                                            <div className="bg-yellow-50 rounded-xl p-3 text-xs font-mono" dir="ltr">
                                                {selected.dns_records.map((r, i) => (
                                                    <div key={i}>{r.type} {r.name} → {r.value}</div>
                                                ))}
                                            </div>
                                        )}
                                        <button
                                            type="button"
                                            onClick={handleActivate}
                                            className="w-full py-2.5 bg-green-600 text-white rounded-xl font-black flex items-center justify-center gap-2"
                                        >
                                            <FaRocket /> Activate Domain
                                        </button>
                                        <button type="button" onClick={handleReject} className="w-full py-2 text-red-600 font-black flex items-center justify-center gap-1">
                                            <FaTimes size={12} /> דחה
                                        </button>
                                    </div>
                                )}

                                {selected.type === 'disconnect_domain' && selected.status === 'pending' && (
                                    <button
                                        type="button"
                                        onClick={handleExecuteDisconnect}
                                        className="w-full mt-4 py-2.5 bg-red-600 text-white rounded-xl font-black"
                                    >
                                        בצע ניתוק בטוח
                                    </button>
                                )}

                                {selected.audit_logs?.length > 0 && (
                                    <div className="mt-6 border-t pt-4">
                                        <p className="text-xs font-black text-gray-500 mb-2">היסטוריית פעולות</p>
                                        <ul className="space-y-2 max-h-48 overflow-y-auto text-xs">
                                            {selected.audit_logs.map((log) => (
                                                <li key={log.id} className="bg-gray-50 rounded-lg p-2">
                                                    <span className="font-black">{AUDIT_ACTION_LABELS[log.action] || log.action}</span>
                                                    {log.user?.name && <> · {log.user.name}</>}
                                                    {log.ip_address && <> · {log.ip_address}</>}
                                                    <br />
                                                    <span className="text-gray-400">{new Date(log.created_at).toLocaleString('he-IL')}</span>
                                                    {log.note && <p className="mt-1 text-gray-600">{log.note}</p>}
                                                    {log.payload?.status_from && log.payload?.status_to && (
                                                        <p className="mt-1 text-gray-500">
                                                            {STATUS_LABELS[log.payload.status_from] || log.payload.status_from}
                                                            {' → '}
                                                            {STATUS_LABELS[log.payload.status_to] || log.payload.status_to}
                                                        </p>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </SuperAdminLayout>
    );
}
