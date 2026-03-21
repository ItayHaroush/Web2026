import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import SuperAdminLayout from '../../layouts/SuperAdminLayout';
import { useAdminAuth } from '../../context/AdminAuthContext';
import api from '../../services/apiClient';
import {
    FaUsers, FaSearch, FaSpinner, FaChevronLeft, FaChevronRight,
    FaPhone, FaClock, FaCheckCircle,
    FaTimes, FaEye, FaEdit, FaTrash, FaWhatsapp, FaBell, FaSms,
    FaMobileAlt, FaPaperPlane, FaHistory,
} from 'react-icons/fa';

function phoneToWaHref(phone) {
    if (!phone) return null;
    let d = String(phone).replace(/\D/g, '');
    if (d.startsWith('0')) d = `972${d.slice(1)}`;
    if (!d.startsWith('972') && d.length >= 9) d = `972${d.replace(/^0+/, '')}`;
    return `https://wa.me/${d}`;
}

export default function SuperAdminCustomers() {
    const navigate = useNavigate();
    const { getAuthHeaders } = useAdminAuth();
    const [customers, setCustomers] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState({});
    const [filters, setFilters] = useState({
        registered_only: false,
        has_orders: false,
        has_email: false,
        guest_with_orders: false,
        has_pwa: false,
        pwa_no_push: false,
    });
    const [inactiveDays, setInactiveDays] = useState('');
    const [selectedIds, setSelectedIds] = useState([]);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [editForm, setEditForm] = useState({ name: '', email: '', phone: '' });
    const [saving, setSaving] = useState(false);

    const [pushModal, setPushModal] = useState(null);
    const [pushForm, setPushForm] = useState({ title: '', body: '' });
    const [pushForTenantId, setPushForTenantId] = useState('');
    const [smsModal, setSmsModal] = useState(null);
    const [smsBody, setSmsBody] = useState('');
    const [sending, setSending] = useState(false);

    const [broadcastOpen, setBroadcastOpen] = useState(false);
    const [broadcastChannel, setBroadcastChannel] = useState('push');
    const [broadcastTitle, setBroadcastTitle] = useState('');
    const [broadcastMessage, setBroadcastMessage] = useState('');
    const [broadcastForTenantId, setBroadcastForTenantId] = useState('');
    const [broadcastLoading, setBroadcastLoading] = useState(false);

    const [broadcastLog, setBroadcastLog] = useState(null);
    const [broadcastLogLoading, setBroadcastLogLoading] = useState(false);
    const [showLogPanel, setShowLogPanel] = useState(false);

    const fetchStats = useCallback(async () => {
        try {
            const res = await api.get('/super-admin/customers/stats', { headers: getAuthHeaders() });
            if (res.data?.success) setStats(res.data.data);
        } catch { /* */ }
    }, [getAuthHeaders]);

    const fetchCustomers = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page, per_page: 25 });
            if (search) params.set('search', search);
            if (filters.registered_only) params.set('registered_only', '1');
            if (filters.has_orders) params.set('has_orders', '1');
            if (filters.has_email) params.set('has_email', '1');
            if (filters.guest_with_orders) params.set('guest_with_orders', '1');
            if (filters.has_pwa) params.set('has_pwa', '1');
            if (filters.pwa_no_push) params.set('pwa_no_push', '1');
            if (inactiveDays) params.set('inactive_days', inactiveDays);

            const res = await api.get(`/super-admin/customers?${params}`, { headers: getAuthHeaders() });
            if (res.data?.success) {
                setCustomers(res.data.data.data || []);
                setMeta({
                    lastPage: res.data.data.last_page,
                    total: res.data.data.total,
                    currentPage: res.data.data.current_page,
                });
            }
        } catch { /* */ }
        setLoading(false);
    }, [getAuthHeaders, page, search, filters, inactiveDays]);

    useEffect(() => { fetchStats(); }, [fetchStats]);
    useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

    const fetchBroadcastLog = async () => {
        setBroadcastLogLoading(true);
        try {
            const res = await api.get('/super-admin/customers/broadcasts?per_page=20', { headers: getAuthHeaders() });
            if (res.data?.success) setBroadcastLog(res.data.data);
        } catch { /* */ }
        setBroadcastLogLoading(false);
    };

    useEffect(() => {
        if (showLogPanel) fetchBroadcastLog();
    }, [showLogPanel]);

    const handleSearch = (e) => {
        e.preventDefault();
        setPage(1);
        fetchCustomers();
    };

    const toggleFilter = (key) => {
        setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
        setPage(1);
    };

    const toggleSelect = (id) => {
        setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    };

    const selectAllOnPage = () => {
        const ids = customers.map((c) => c.id);
        const allSelected = ids.every((id) => selectedIds.includes(id));
        if (allSelected) {
            setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
        } else {
            setSelectedIds((prev) => [...new Set([...prev, ...ids])]);
        }
    };

    const startEdit = (c) => {
        setEditingCustomer(c);
        setEditForm({ name: c.name || '', email: c.email || '', phone: c.phone || '' });
    };

    const saveEdit = async () => {
        if (!editingCustomer) return;
        setSaving(true);
        try {
            const res = await api.put(`/super-admin/customers/${editingCustomer.id}`, editForm, { headers: getAuthHeaders() });
            if (res.data?.success) {
                setEditingCustomer(null);
                fetchCustomers();
            }
        } catch { /* */ }
        setSaving(false);
    };

    const deleteCustomer = async (id) => {
        if (!window.confirm('למחוק את הלקוח? פעולה זו אינה הפיכה.')) return;
        try {
            await api.delete(`/super-admin/customers/${id}`, { headers: getAuthHeaders() });
            fetchCustomers();
            fetchStats();
        } catch { /* */ }
    };

    const sendPush = async () => {
        if (!pushModal) return;
        setSending(true);
        try {
            await api.post(
                `/super-admin/customers/${pushModal.id}/push`,
                {
                    title: pushForm.title,
                    body: pushForm.body,
                    for_tenant_id: pushForTenantId.trim() || undefined,
                },
                { headers: getAuthHeaders() }
            );
            setPushModal(null);
            setPushForm({ title: '', body: '' });
            setPushForTenantId('');
        } catch (err) {
            alert(err.response?.data?.message || 'שגיאה בשליחת פוש');
        }
        setSending(false);
    };

    const sendSmsOne = async () => {
        if (!smsModal) return;
        setSending(true);
        try {
            const res = await api.post(
                `/super-admin/customers/${smsModal.id}/sms`,
                { message: smsBody },
                { headers: getAuthHeaders() }
            );
            if (res.data?.success) {
                setSmsModal(null);
                setSmsBody('');
            } else {
                alert(res.data?.message || 'שגיאה');
            }
        } catch (err) {
            alert(err.response?.data?.message || 'שגיאה ב-SMS');
        }
        setSending(false);
    };

    const runBroadcast = async () => {
        if (!selectedIds.length) {
            alert('בחרו לפחות לקוח אחד');
            return;
        }
        if (!broadcastMessage.trim()) {
            alert('נא להזין הודעה');
            return;
        }
        if (broadcastChannel !== 'sms' && !broadcastTitle.trim()) {
            alert('נא כותרת לפוש');
            return;
        }
        setBroadcastLoading(true);
        try {
            const res = await api.post(
                '/super-admin/customers/broadcast',
                {
                    customer_ids: selectedIds,
                    channel: broadcastChannel,
                    title: broadcastTitle || 'עדכון',
                    message: broadcastMessage,
                    for_tenant_id: broadcastForTenantId.trim() || undefined,
                },
                { headers: getAuthHeaders() }
            );
            if (res.data?.success) {
                const d = res.data.data || {};
                alert(
                    `בוצע. פוש: ${d.push_ok ?? 0}/${d.push_targeted ?? 0}, SMS: ${d.sms_ok ?? 0}/${d.sms_attempted ?? 0}`
                );
                setBroadcastOpen(false);
                setBroadcastMessage('');
                setBroadcastTitle('');
                setBroadcastForTenantId('');
                fetchBroadcastLog();
            }
        } catch (err) {
            alert(err.response?.data?.message || 'שגיאה בשידור');
        }
        setBroadcastLoading(false);
    };

    const statCards = stats
        ? [
            { label: 'סה״כ לקוחות', value: stats.total, box: 'bg-indigo-50' },
            { label: 'חשבון מלא', value: stats.registered, box: 'bg-green-50' },
            { label: 'עם הזמנות', value: stats.withOrders, box: 'bg-blue-50' },
            { label: 'אורח + הזמנות', value: stats.guestWithOrders ?? 0, box: 'bg-amber-50' },
            { label: 'PWA הותקן', value: stats.withPwa ?? 0, box: 'bg-violet-50' },
            { label: 'עם טוקן פוש', value: stats.withPushTokens ?? 0, box: 'bg-cyan-50' },
            { label: 'PWA בלי פוש', value: stats.pwaNoPush ?? 0, box: 'bg-rose-50' },
            { label: 'חדשים השבוע', value: stats.newThisWeek, box: 'bg-purple-50' },
            { label: 'חדשים החודש', value: stats.newThisMonth, box: 'bg-orange-50' },
        ]
        : [];

    const customerActionsClass = 'min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-gray-100 bg-gray-50/80 hover:bg-gray-100 active:scale-[0.98] transition-colors';

    return (
        <SuperAdminLayout>
            <div className="space-y-6 w-full min-w-0 overflow-x-hidden" dir="rtl">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <h1 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2 sm:gap-3">
                            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg shrink-0">
                                <FaUsers size={18} />
                            </div>
                            <span className="break-words">ניהול לקוחות</span>
                        </h1>
                        <p className="text-xs sm:text-sm text-gray-500 mt-1">כל משתמשי הקצה — PWA, פוש, וואטסאפ ושידורים</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => { setShowLogPanel((v) => !v); }}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-50 w-full sm:w-auto shrink-0"
                    >
                        <FaHistory size={14} /> לוג שידורים
                    </button>
                </div>

                {stats && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        {statCards.map((s) => (
                            <div key={s.label} className={`rounded-xl border border-gray-100 p-4 shadow-sm ${s.box}`}>
                                <p className="text-xl font-black text-gray-900">{s.value}</p>
                                <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wide mt-1">{s.label}</p>
                            </div>
                        ))}
                    </div>
                )}

                {showLogPanel && (
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                        <h3 className="text-sm font-black text-gray-800 mb-3 flex items-center gap-2">
                            <FaPaperPlane className="text-indigo-500" /> לוג שידורים / פוש / SMS ללקוח
                        </h3>
                        {broadcastLogLoading ? (
                            <FaSpinner className="animate-spin text-indigo-600" />
                        ) : (
                            <div className="overflow-x-auto max-h-64 overflow-y-auto text-xs">
                                <table className="w-full">
                                    <thead>
                                        <tr className="text-gray-400 text-left border-b">
                                            <th className="py-2 pr-2">תאריך</th>
                                            <th className="py-2 pr-2">ערוץ</th>
                                            <th className="py-2 pr-2">סוג</th>
                                            <th className="py-2 pr-2">כותרת</th>
                                            <th className="py-2 pr-2">נשלח</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(broadcastLog?.data || []).map((row) => (
                                            <tr key={row.id} className="border-b border-gray-50">
                                                <td className="py-2 pr-2 whitespace-nowrap">
                                                    {new Date(row.created_at).toLocaleString('he-IL')}
                                                </td>
                                                <td className="py-2 pr-2">{row.channel}</td>
                                                <td className="py-2 pr-2">{row.type}</td>
                                                <td className="py-2 pr-2 max-w-[140px] truncate">{row.title}</td>
                                                <td className="py-2 pr-2">{row.sent_ok}/{row.tokens_targeted}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {!broadcastLog?.data?.length && <p className="text-gray-400 py-4">אין רשומות</p>}
                            </div>
                        )}
                    </div>
                )}

                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
                    <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
                        <div className="relative flex-1 min-w-0">
                            <FaSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
                            <input
                                type="text"
                                placeholder="חפש לפי שם, טלפון או אימייל..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full min-w-0 pr-9 pl-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 outline-none"
                            />
                        </div>
                        <button type="submit" className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-700 shrink-0 w-full sm:w-auto">
                            חפש
                        </button>
                    </form>
                    <div className="flex gap-2 flex-wrap items-center">
                        {[
                            { key: 'registered_only', label: 'רשומים (חשבון מלא)' },
                            { key: 'has_orders', label: 'עם הזמנות' },
                            { key: 'has_email', label: 'עם אימייל' },
                            { key: 'guest_with_orders', label: 'אורח + הזמנות' },
                            { key: 'has_pwa', label: 'התקין PWA' },
                            { key: 'pwa_no_push', label: 'PWA ללא פוש' },
                        ].map((f) => (
                            <button
                                key={f.key}
                                type="button"
                                onClick={() => toggleFilter(f.key)}
                                className={`px-3 py-1 rounded-full text-xs font-bold transition ${filters[f.key] ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                            >
                                {f.label}
                            </button>
                        ))}
                        <label className="flex items-center gap-1 text-xs text-gray-600 mr-2">
                            <span className="font-bold">לא פעיל</span>
                            <select
                                value={inactiveDays}
                                onChange={(e) => { setInactiveDays(e.target.value); setPage(1); }}
                                className="border rounded-lg px-2 py-1 text-xs"
                            >
                                <option value="">—</option>
                                <option value="7">7+ ימים</option>
                                <option value="14">14+ ימים</option>
                                <option value="30">30+ ימים</option>
                                <option value="90">90+ ימים</option>
                            </select>
                        </label>
                    </div>
                </div>

                {selectedIds.length > 0 && (
                    <div className="flex flex-wrap items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
                        <span className="text-sm font-bold text-indigo-900">{selectedIds.length} נבחרו</span>
                        <button
                            type="button"
                            onClick={() => setBroadcastOpen(true)}
                            className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold"
                        >
                            שידור לנבחרים
                        </button>
                        <button
                            type="button"
                            onClick={() => setSelectedIds([])}
                            className="text-sm text-gray-600 underline"
                        >
                            נקה בחירה
                        </button>
                    </div>
                )}

                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <FaSpinner className="animate-spin text-indigo-600" size={24} />
                        </div>
                    ) : customers.length === 0 ? (
                        <div className="text-center py-16">
                            <FaUsers className="mx-auto text-4xl text-gray-300 mb-3" />
                            <p className="text-gray-400 text-sm">לא נמצאו לקוחות</p>
                        </div>
                    ) : (
                        <>
                            {/* מובייל — כרטיסים */}
                            <div className="md:hidden divide-y divide-gray-100">
                                {customers.map((c) => (
                                    <div key={`m-${c.id}`} className="p-4 space-y-3">
                                        <div className="flex items-start gap-3">
                                            <input
                                                type="checkbox"
                                                className="mt-1.5 shrink-0"
                                                checked={selectedIds.includes(c.id)}
                                                onChange={() => toggleSelect(c.id)}
                                                aria-label={`בחר ${c.name}`}
                                            />
                                            <div className="min-w-0 flex-1 space-y-1">
                                                <p className="font-bold text-gray-900 break-words">{c.name || '—'}</p>
                                                <p className="text-sm text-gray-600 ltr text-right break-all" dir="ltr">{c.phone || '—'}</p>
                                                {c.email ? (
                                                    <p className="text-xs text-gray-600 break-all flex items-center gap-1">
                                                        {c.email}
                                                        {c.email_verified_at
                                                            ? <FaCheckCircle className="text-green-500 shrink-0" size={10} />
                                                            : <FaClock className="text-amber-500 shrink-0" size={10} />}
                                                    </p>
                                                ) : (
                                                    <p className="text-xs text-gray-300">ללא אימייל</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-2 text-[11px] text-gray-600">
                                            <span className="px-2 py-1 rounded-lg bg-gray-50 font-bold">הזמנות: {c.total_orders || 0}</span>
                                            <span className="px-2 py-1 rounded-lg bg-gray-50">פוש: {c.push_tokens_count ?? 0}</span>
                                            <span className="px-2 py-1 rounded-lg bg-gray-50">
                                                PWA: {c.pwa_installed_at ? new Date(c.pwa_installed_at).toLocaleDateString('he-IL') : '—'}
                                            </span>
                                            <span className="px-2 py-1 rounded-lg bg-gray-50">
                                                הזמנה אחרונה: {c.last_order_at ? new Date(c.last_order_at).toLocaleDateString('he-IL') : '—'}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 pt-1">
                                            {phoneToWaHref(c.phone) && (
                                                <a
                                                    href={phoneToWaHref(c.phone)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className={`${customerActionsClass} text-green-600 col-span-1`}
                                                    title="WhatsApp"
                                                >
                                                    <FaWhatsapp size={16} />
                                                </a>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => { setPushModal(c); setPushForm({ title: 'עדכון', body: '' }); setPushForTenantId(''); }}
                                                className={`${customerActionsClass} text-orange-600`}
                                                title="שלח פוש"
                                            >
                                                <FaBell size={16} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => { setSmsModal(c); setSmsBody(''); }}
                                                className={`${customerActionsClass} text-sky-600`}
                                                title="שלח SMS"
                                            >
                                                <FaSms size={16} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => navigate(`/super-admin/customers/${c.id}`)}
                                                className={`${customerActionsClass} text-indigo-600`}
                                                title="צפה"
                                            >
                                                <FaEye size={16} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => startEdit(c)}
                                                className={`${customerActionsClass} text-blue-600`}
                                                title="ערוך"
                                            >
                                                <FaEdit size={16} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => deleteCustomer(c.id)}
                                                className={`${customerActionsClass} text-red-500`}
                                                title="מחק"
                                            >
                                                <FaTrash size={15} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* דסקטופ — טבלה */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-sm min-w-[920px]">
                                    <thead className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-wider">
                                        <tr>
                                            <th className="w-10 px-2 py-3">
                                                <input
                                                    type="checkbox"
                                                    checked={customers.length > 0 && customers.every((cc) => selectedIds.includes(cc.id))}
                                                    onChange={selectAllOnPage}
                                                    aria-label="בחר הכל בעמוד"
                                                />
                                            </th>
                                            <th className="text-right px-4 py-3">שם</th>
                                            <th className="text-right px-4 py-3">טלפון</th>
                                            <th className="text-right px-4 py-3">אימייל</th>
                                            <th className="text-center px-4 py-3">הזמנות</th>
                                            <th className="text-right px-4 py-3">PWA</th>
                                            <th className="text-center px-4 py-3">פוש</th>
                                            <th className="text-right px-4 py-3">הזמנה אחרונה</th>
                                            <th className="text-right px-4 py-3">נוצר</th>
                                            <th className="text-center px-4 py-3 w-[11rem]">פעולות</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {customers.map((c) => (
                                            <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="px-2 py-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.includes(c.id)}
                                                        onChange={() => toggleSelect(c.id)}
                                                    />
                                                </td>
                                                <td className="px-4 py-3 font-bold text-gray-900">{c.name}</td>
                                                <td className="px-4 py-3 text-gray-500 ltr text-right" dir="ltr">{c.phone}</td>
                                                <td className="px-4 py-3">
                                                    {c.email ? (
                                                        <span className="flex items-center gap-1 text-gray-600">
                                                            {c.email}
                                                            {c.email_verified_at
                                                                ? <FaCheckCircle className="text-green-500" size={10} />
                                                                : <FaClock className="text-amber-500" size={10} />}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-300">—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-center font-bold text-gray-900">{c.total_orders || 0}</td>
                                                <td className="px-4 py-3 text-gray-400 text-xs">
                                                    {c.pwa_installed_at
                                                        ? new Date(c.pwa_installed_at).toLocaleDateString('he-IL')
                                                        : '—'}
                                                </td>
                                                <td className="px-4 py-3 text-center font-bold">{c.push_tokens_count ?? 0}</td>
                                                <td className="px-4 py-3 text-gray-400 text-xs">
                                                    {c.last_order_at ? new Date(c.last_order_at).toLocaleDateString('he-IL') : '—'}
                                                </td>
                                                <td className="px-4 py-3 text-gray-400 text-xs">
                                                    {new Date(c.created_at).toLocaleDateString('he-IL')}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center justify-center gap-1 flex-wrap max-w-[11rem] mx-auto">
                                                        {phoneToWaHref(c.phone) && (
                                                            <a
                                                                href={phoneToWaHref(c.phone)}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="p-2 text-green-600 hover:bg-green-50 rounded-lg shrink-0"
                                                                title="WhatsApp"
                                                            >
                                                                <FaWhatsapp size={14} />
                                                            </a>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => { setPushModal(c); setPushForm({ title: 'עדכון', body: '' }); setPushForTenantId(''); }}
                                                            className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg shrink-0"
                                                            title="שלח פוש"
                                                        >
                                                            <FaBell size={14} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => { setSmsModal(c); setSmsBody(''); }}
                                                            className="p-2 text-sky-600 hover:bg-sky-50 rounded-lg shrink-0"
                                                            title="שלח SMS"
                                                        >
                                                            <FaSms size={14} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => navigate(`/super-admin/customers/${c.id}`)}
                                                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg shrink-0"
                                                            title="צפה"
                                                        >
                                                            <FaEye size={14} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => startEdit(c)}
                                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg shrink-0"
                                                            title="ערוך"
                                                        >
                                                            <FaEdit size={14} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => deleteCustomer(c.id)}
                                                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg shrink-0"
                                                            title="מחק"
                                                        >
                                                            <FaTrash size={13} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {meta.lastPage > 1 && (
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-t border-gray-100">
                                    <p className="text-xs text-gray-400 text-center sm:text-right">עמוד {meta.currentPage} מתוך {meta.lastPage} ({meta.total} לקוחות)</p>
                                    <div className="flex gap-1 justify-center sm:justify-end">
                                        <button
                                            type="button"
                                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                                            disabled={page <= 1}
                                            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30"
                                        >
                                            <FaChevronRight size={12} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPage((p) => Math.min(meta.lastPage, p + 1))}
                                            disabled={page >= meta.lastPage}
                                            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30"
                                        >
                                            <FaChevronLeft size={12} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Push modal */}
                {pushModal && (
                    <div className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
                        <div className="fixed inset-0 bg-black/50" onClick={() => setPushModal(null)} />
                        <div className="relative bg-white rounded-t-[1.75rem] sm:rounded-2xl shadow-xl w-full max-w-md max-h-[min(92dvh,90vh)] overflow-y-auto p-6 space-y-4 z-10 my-0 sm:my-8" dir="rtl">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-black flex items-center gap-2">
                                    <FaBell className="text-orange-500" /> פוש ל-{pushModal.name}
                                </h3>
                                <button type="button" onClick={() => setPushModal(null)} className="text-gray-400 hover:text-gray-600">
                                    <FaTimes size={18} />
                                </button>
                            </div>
                            <input
                                type="text"
                                placeholder="כותרת"
                                value={pushForm.title}
                                onChange={(e) => setPushForm((p) => ({ ...p, title: e.target.value }))}
                                className="w-full border rounded-xl px-3 py-2 text-sm"
                            />
                            <textarea
                                placeholder="תוכן"
                                value={pushForm.body}
                                onChange={(e) => setPushForm((p) => ({ ...p, body: e.target.value }))}
                                className="w-full border rounded-xl px-3 py-2 text-sm min-h-[100px]"
                            />
                            <input
                                type="text"
                                placeholder="Tenant ID (אופציונלי) — נדרש כדי לכבד הסכמה מול מסעדה"
                                value={pushForTenantId}
                                onChange={(e) => setPushForTenantId(e.target.value)}
                                className="w-full border rounded-xl px-3 py-2 text-xs font-mono"
                                dir="ltr"
                            />
                            <button
                                type="button"
                                onClick={sendPush}
                                disabled={sending || !pushForm.body.trim()}
                                className="w-full bg-orange-500 text-white py-2.5 rounded-xl font-bold disabled:opacity-50"
                            >
                                {sending ? <FaSpinner className="animate-spin mx-auto" /> : 'שלח'}
                            </button>
                        </div>
                    </div>
                )}

                {/* SMS modal */}
                {smsModal && (
                    <div className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
                        <div className="fixed inset-0 bg-black/50" onClick={() => setSmsModal(null)} />
                        <div className="relative bg-white rounded-t-[1.75rem] sm:rounded-2xl shadow-xl w-full max-w-md max-h-[min(92dvh,90vh)] overflow-y-auto p-6 space-y-4 z-10 my-0 sm:my-8" dir="rtl">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-black flex items-center gap-2">
                                    <FaSms className="text-sky-500" /> SMS ל-{smsModal.name}
                                </h3>
                                <button type="button" onClick={() => setSmsModal(null)} className="text-gray-400 hover:text-gray-600">
                                    <FaTimes size={18} />
                                </button>
                            </div>
                            <textarea
                                placeholder="טקסט (עלות לפי ספק)"
                                value={smsBody}
                                onChange={(e) => setSmsBody(e.target.value)}
                                className="w-full border rounded-xl px-3 py-2 text-sm min-h-[120px]"
                            />
                            <button
                                type="button"
                                onClick={sendSmsOne}
                                disabled={sending || !smsBody.trim()}
                                className="w-full bg-sky-600 text-white py-2.5 rounded-xl font-bold disabled:opacity-50"
                            >
                                {sending ? <FaSpinner className="animate-spin mx-auto" /> : 'שלח SMS'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Broadcast modal */}
                {broadcastOpen && (
                    <div className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
                        <div className="fixed inset-0 bg-black/50" onClick={() => setBroadcastOpen(false)} />
                        <div className="relative bg-white rounded-t-[1.75rem] sm:rounded-2xl shadow-xl w-full max-w-lg max-h-[min(92dvh,90vh)] overflow-y-auto p-6 space-y-4 z-10 my-0 sm:my-8" dir="rtl">
                            <h3 className="text-lg font-black flex items-center gap-2">
                                <FaMobileAlt className="text-indigo-500" /> שידור ל-{selectedIds.length} לקוחות
                            </h3>
                            <select
                                value={broadcastChannel}
                                onChange={(e) => setBroadcastChannel(e.target.value)}
                                className="w-full border rounded-xl px-3 py-2 text-sm"
                            >
                                <option value="push">פוש בלבד</option>
                                <option value="sms">SMS בלבד</option>
                                <option value="both">פוש + SMS</option>
                            </select>
                            {broadcastChannel !== 'sms' && (
                                <input
                                    type="text"
                                    placeholder="כותרת לפוש"
                                    value={broadcastTitle}
                                    onChange={(e) => setBroadcastTitle(e.target.value)}
                                    className="w-full border rounded-xl px-3 py-2 text-sm"
                                />
                            )}
                            <textarea
                                placeholder="הודעה"
                                value={broadcastMessage}
                                onChange={(e) => setBroadcastMessage(e.target.value)}
                                className="w-full border rounded-xl px-3 py-2 text-sm min-h-[120px]"
                            />
                            {broadcastChannel !== 'sms' && (
                                <input
                                    type="text"
                                    placeholder="Tenant ID לפוש (אופציונלי) — רק למי שאישר התראות מהמסעדה"
                                    value={broadcastForTenantId}
                                    onChange={(e) => setBroadcastForTenantId(e.target.value)}
                                    className="w-full border rounded-xl px-3 py-2 text-xs font-mono"
                                    dir="ltr"
                                />
                            )}
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={runBroadcast}
                                    disabled={broadcastLoading}
                                    className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl font-bold"
                                >
                                    {broadcastLoading ? <FaSpinner className="animate-spin mx-auto" /> : 'הפעל שידור'}
                                </button>
                                <button type="button" onClick={() => setBroadcastOpen(false)} className="px-4 py-2 rounded-xl border font-bold">
                                    ביטול
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {editingCustomer && (
                    <div className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
                        <div className="fixed inset-0 bg-black/50" onClick={() => setEditingCustomer(null)} />
                        <div className="relative bg-white rounded-t-[1.75rem] sm:rounded-2xl shadow-xl w-full max-w-md max-h-[min(92dvh,90vh)] overflow-y-auto p-6 space-y-4 z-10 my-0 sm:my-8" dir="rtl">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-black text-gray-900">עריכת לקוח</h3>
                                <button type="button" onClick={() => setEditingCustomer(null)} className="text-gray-400 hover:text-gray-600">
                                    <FaTimes size={18} />
                                </button>
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1">שם</label>
                                    <input
                                        type="text"
                                        value={editForm.name}
                                        onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1">טלפון</label>
                                    <input
                                        type="tel"
                                        dir="ltr"
                                        value={editForm.phone}
                                        onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1">אימייל</label>
                                    <input
                                        type="email"
                                        dir="ltr"
                                        value={editForm.email}
                                        onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                                    />
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={saveEdit}
                                disabled={saving}
                                className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition disabled:opacity-50"
                            >
                                {saving ? <FaSpinner className="animate-spin mx-auto" /> : 'שמור'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </SuperAdminLayout>
    );
}
