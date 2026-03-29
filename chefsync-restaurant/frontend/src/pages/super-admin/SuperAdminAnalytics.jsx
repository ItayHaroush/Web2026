import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import SuperAdminLayout from '../../layouts/SuperAdminLayout';
import api from '../../services/apiClient';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { FaChartBar, FaUsers, FaMousePointer, FaUtensils, FaStore, FaUserShield, FaMobileAlt, FaSearch, FaTimes } from 'react-icons/fa';
import { pageKeyLabel, describeCustomerPath } from '../../constants/pageViewLabels';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const KIND_LABELS = {
    anonymous: 'מבקר אנונימי',
    customer_guest: 'לקוח (לא רשום)',
    customer_registered: 'לקוח רשום',
    admin: 'מנהל / צוות (מאוחד)',
};

const VISITOR_FILTERS = [
    { value: 'all', label: 'הכל' },
    { value: 'exclude_owner', label: 'בלי כניסות שלי' },
    { value: 'owner_only', label: 'רק שלי' },
];

function buildVisitorKindDisplayRows(byKind, adminSplit, registeredSplit) {
    const entries = Object.entries(byKind || {}).filter(([kind]) => {
        if (kind === 'admin' && adminSplit) return false;
        if (kind === 'customer_registered' && registeredSplit) return false;
        return true;
    });
    const rows = entries.map(([kind, count]) => ({
        key: kind,
        label: KIND_LABELS[kind] || kind,
        count,
        accent: false,
        ownerChannel: null,
    }));
    if (adminSplit) {
        rows.push({
            key: 'platform_owner_admin',
            label: 'בעל המערכת — פאנל ניהול',
            count: adminSplit.platform_owner,
            accent: true,
            ownerChannel: 'admin',
        });
        rows.push({
            key: 'staff_admins',
            label: 'מנהלי מסעדה וצוות',
            count: adminSplit.other_admins,
            accent: false,
            ownerChannel: null,
        });
    }
    if (registeredSplit) {
        rows.push({
            key: 'platform_owner_registered',
            label: 'בעל המערכת — לקוח רשום (אפליקציית לקוח)',
            count: registeredSplit.platform_owner,
            accent: true,
            ownerChannel: 'registered',
        });
        rows.push({
            key: 'other_registered_customers',
            label: 'לקוחות רשומים אחרים',
            count: registeredSplit.other_registered,
            accent: false,
            ownerChannel: null,
        });
    }
    rows.sort((a, b) => b.count - a.count);
    return rows;
}

function buildAnalyticsQueryString({ rangePreset, days, visitorFilter, focusPicks }) {
    const sp = new URLSearchParams();
    sp.set('visitor_filter', visitorFilter);
    if (rangePreset === 'today') {
        sp.set('period', 'today');
    } else {
        sp.set('days', String(days));
    }
    focusPicks.forEach((pick) => {
        if (pick.type === 'admin') {
            sp.append('focus_admin_ids[]', String(pick.id));
        } else {
            sp.append('focus_customer_ids[]', String(pick.id));
        }
    });
    return sp.toString();
}

const tableScrollClass =
    'overflow-x-auto max-h-[min(60vh,520px)] overflow-y-auto rounded-xl border border-gray-50 -mx-1';

export default function SuperAdminAnalytics() {
    const { getAuthHeaders, user } = useAdminAuth();
    const [rangePreset, setRangePreset] = useState('7d');
    const [days, setDays] = useState(7);
    const [visitorFilter, setVisitorFilter] = useState('all');
    const [focusPicks, setFocusPicks] = useState([]);
    const [entityQuery, setEntityQuery] = useState('');
    const [entityResults, setEntityResults] = useState({ users: [], customers: [] });
    const [entityLoading, setEntityLoading] = useState(false);
    const [summary, setSummary] = useState(null);
    const [topRows, setTopRows] = useState([]);
    const [menuInsights, setMenuInsights] = useState(null);
    const [loading, setLoading] = useState(true);
    const searchDebounce = useRef(null);

    const queryKey = useMemo(
        () =>
            buildAnalyticsQueryString({
                rangePreset,
                days,
                visitorFilter,
                focusPicks,
            }),
        [rangePreset, days, visitorFilter, focusPicks]
    );

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const h = { headers: getAuthHeaders() };
            const qs = queryKey;
            const [sRes, tRes, mRes] = await Promise.all([
                api.get(`/super-admin/analytics/summary?${qs}`, h),
                api.get(`/super-admin/analytics/top-entities?${qs}&limit=50`, h),
                api.get(`/super-admin/analytics/menu-insights?${qs}&limit_recent=100`, h),
            ]);
            if (sRes.data?.success) setSummary(sRes.data.data);
            if (tRes.data?.success) setTopRows(tRes.data.data?.rows || []);
            if (mRes.data?.success) setMenuInsights(mRes.data.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [getAuthHeaders, queryKey]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        if (searchDebounce.current) clearTimeout(searchDebounce.current);
        const q = entityQuery.trim();
        if (q.length < 2) {
            setEntityResults({ users: [], customers: [] });
            return;
        }
        searchDebounce.current = setTimeout(async () => {
            setEntityLoading(true);
            try {
                const res = await api.get(
                    `/super-admin/analytics/entity-suggestions?query=${encodeURIComponent(q)}`,
                    { headers: getAuthHeaders() }
                );
                if (res.data?.success) {
                    setEntityResults(res.data.data || { users: [], customers: [] });
                }
            } catch {
                setEntityResults({ users: [], customers: [] });
            } finally {
                setEntityLoading(false);
            }
        }, 320);
        return () => {
            if (searchDebounce.current) clearTimeout(searchDebounce.current);
        };
    }, [entityQuery, getAuthHeaders]);

    const byPage = summary?.by_page_key || {};
    const byKind = summary?.by_visitor_kind || {};
    const pageEntries = Object.entries(byPage).sort((a, b) => b[1] - a[1]);
    const platformOwner = summary?.platform_owner;
    const visitorKindRows = useMemo(
        () => buildVisitorKindDisplayRows(byKind, summary?.admin_visit_split, summary?.registered_visit_split),
        [byKind, summary?.admin_visit_split, summary?.registered_visit_split]
    );

    const hourChartData = useMemo(
        () =>
            (summary?.by_hour || []).map((x) => ({
                name: `${x.hour}:00`,
                count: x.count,
            })),
        [summary?.by_hour]
    );

    const filterHintShort =
        visitorFilter === 'exclude_owner'
            ? 'ללא כניסות שמזוהות איתך (פאנל + לקוח B2C לפי הגדרות המערכת).'
            : visitorFilter === 'owner_only'
              ? 'רק כניסות שמזוהות איתך.'
              : null;

    const addFocusPick = (type, id, label) => {
        const key = `${type}-${id}`;
        if (focusPicks.some((p) => `${p.type}-${p.id}` === key)) return;
        if (focusPicks.length >= 8) return;
        setFocusPicks((prev) => [...prev, { type, id, label }]);
        setEntityQuery('');
        setEntityResults({ users: [], customers: [] });
    };

    const removeFocusPick = (key) => {
        setFocusPicks((prev) => prev.filter((p) => `${p.type}-${p.id}` !== key));
    };

    const thSticky = 'sticky top-0 z-10 bg-white py-2 px-2 font-black text-gray-500 shadow-sm';

    return (
        <SuperAdminLayout>
            <div className="space-y-6 sm:space-y-8" dir="rtl">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 flex flex-wrap items-center gap-2">
                        <div className="p-2 bg-indigo-100 rounded-lg">
                            <FaChartBar className="text-indigo-600" size={22} />
                        </div>
                        אנליטיקות כניסה
                        {user?.email ? (
                            <span className="text-xs font-bold text-gray-400 ltr">
                                · <span className="font-mono">{user.email}</span>
                                {user?.is_super_admin ? ' · סופר־אדמין' : ''}
                            </span>
                        ) : null}
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">ציבור, פאנל מסעדה וסופר־אדמין — מזהה אנונימי בדפדפן.</p>
                    {summary?.since && summary?.until ? (
                        <p className="text-[11px] text-gray-400 mt-1 font-mono ltr text-left">
                            {summary.period === 'today' ? 'היום: ' : ''}
                            {new Date(summary.since).toLocaleString('he-IL')} — {new Date(summary.until).toLocaleString('he-IL')}
                        </p>
                    ) : null}
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                    <button
                        type="button"
                        onClick={() => setRangePreset('today')}
                        className={`px-4 py-2 rounded-xl text-sm font-black transition-all ${
                            rangePreset === 'today'
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        היום
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setRangePreset('7d');
                            setDays(7);
                        }}
                        className={`px-4 py-2 rounded-xl text-sm font-black transition-all ${
                            rangePreset === '7d'
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        7 ימים
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setRangePreset('30d');
                            setDays(30);
                        }}
                        className={`px-4 py-2 rounded-xl text-sm font-black transition-all ${
                            rangePreset === '30d'
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        30 ימים
                    </button>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-3">
                    <p className="text-xs font-black text-gray-500 uppercase tracking-wider">סינון בעל מערכת</p>
                    <div className="flex flex-wrap gap-2">
                        {VISITOR_FILTERS.map((f) => (
                            <button
                                key={f.value}
                                type="button"
                                onClick={() => setVisitorFilter(f.value)}
                                className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-black transition-all border ${
                                    visitorFilter === f.value
                                        ? 'bg-gray-800 text-white border-gray-800'
                                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                                }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                    {filterHintShort ? <p className="text-xs text-gray-500">{filterHintShort}</p> : null}
                    {(platformOwner?.email_masked || platformOwner?.customer_phone_masked) && (
                        <details className="text-xs text-gray-500 border-t border-gray-100 pt-3">
                            <summary className="cursor-pointer font-bold text-gray-600">מזהי בעל מערכת (קונפיג)</summary>
                            <div className="mt-2 space-y-1 ltr text-left">
                                {platformOwner.email_masked ? (
                                    <p>
                                        פאנל: <span className="font-mono">{platformOwner.email_masked}</span>
                                        {!platformOwner.user_resolved && platformOwner.email_configured ? (
                                            <span className="text-amber-600 mr-1"> (לא נמצא ב־DB)</span>
                                        ) : null}
                                    </p>
                                ) : null}
                                {platformOwner.customer_phone_masked ? (
                                    <p>
                                        B2C: <span className="font-mono">{platformOwner.customer_phone_masked}</span>
                                        {!platformOwner.customer_resolved && platformOwner.customer_phone_configured ? (
                                            <span className="text-amber-600 mr-1"> (לא נמצא ב־DB)</span>
                                        ) : null}
                                    </p>
                                ) : null}
                            </div>
                        </details>
                    )}
                </div>

                <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-3">
                    <p className="text-xs font-black text-gray-500 uppercase tracking-wider">התמקדות במשתמשים</p>
                    <div className="relative">
                        <FaSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                        <input
                            type="search"
                            value={entityQuery}
                            onChange={(e) => setEntityQuery(e.target.value)}
                            placeholder="חיפוש אימייל, שם או טלפון…"
                            className="w-full rounded-xl border border-gray-200 py-2.5 pr-10 pl-3 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
                        />
                    </div>
                    {entityLoading ? <p className="text-xs text-gray-400">מחפש…</p> : null}
                    {(entityResults.users?.length > 0 || entityResults.customers?.length > 0) && entityQuery.trim().length >= 2 ? (
                        <div className="max-h-48 overflow-y-auto rounded-xl border border-gray-100 divide-y divide-gray-50 text-sm">
                            {entityResults.users?.map((u) => (
                                <button
                                    key={`u-${u.id}`}
                                    type="button"
                                    className="w-full text-right px-3 py-2 hover:bg-gray-50 flex flex-col"
                                    onClick={() => addFocusPick('admin', u.id, u.label)}
                                >
                                    <span className="font-bold">{u.label}</span>
                                    <span className="text-xs text-gray-500 font-mono ltr">{u.sub}</span>
                                    <span className="text-[10px] text-indigo-600 font-black">מנהל</span>
                                </button>
                            ))}
                            {entityResults.customers?.map((c) => (
                                <button
                                    key={`c-${c.id}`}
                                    type="button"
                                    className="w-full text-right px-3 py-2 hover:bg-gray-50 flex flex-col"
                                    onClick={() => addFocusPick('customer', c.id, c.label)}
                                >
                                    <span className="font-bold">{c.label}</span>
                                    <span className="text-xs text-gray-500">{c.sub}</span>
                                    <span className="text-[10px] text-emerald-700 font-black">לקוח</span>
                                </button>
                            ))}
                        </div>
                    ) : null}
                    {focusPicks.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {focusPicks.map((p) => (
                                <span
                                    key={`${p.type}-${p.id}`}
                                    className="inline-flex items-center gap-1 rounded-full bg-indigo-50 text-indigo-900 pl-2 pr-1 py-1 text-xs font-bold"
                                >
                                    {p.type === 'admin' ? 'מנהל' : 'לקוח'} #{p.id} · {p.label}
                                    <button
                                        type="button"
                                        className="p-1 rounded-full hover:bg-indigo-200"
                                        onClick={() => removeFocusPick(`${p.type}-${p.id}`)}
                                        aria-label="הסר"
                                    >
                                        <FaTimes size={10} />
                                    </button>
                                </span>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-gray-400">ללא התמקדות — כל המבקרים בטווח.</p>
                    )}
                </div>

                {loading ? (
                    <p className="text-gray-500 font-bold">טוען…</p>
                ) : (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm min-w-0">
                                <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-1">סה״כ צפיות</p>
                                <p className="text-3xl font-black text-gray-900">{summary?.total_visits ?? 0}</p>
                                {summary?.compare_yesterday ? (
                                    <p
                                        className={`text-xs font-bold mt-1 ${
                                            (summary.compare_yesterday.delta ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'
                                        }`}
                                    >
                                        מול אתמול (חלון זהה): {summary.compare_yesterday.delta >= 0 ? '+' : ''}
                                        {summary.compare_yesterday.delta}
                                    </p>
                                ) : null}
                            </div>
                            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                                <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                    <FaUtensils className="text-orange-500" /> כניסות לתפריט
                                </p>
                                <p className="text-3xl font-black text-gray-900">{summary?.menu_visits ?? 0}</p>
                            </div>
                            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                                <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                    <FaStore className="text-amber-600" /> מסעדות בתפריט
                                </p>
                                <p className="text-3xl font-black text-gray-900">{summary?.menu_distinct_restaurants ?? 0}</p>
                            </div>
                            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                                <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                    <FaMousePointer className="text-indigo-500" /> מבקרים (UUID)
                                </p>
                                <p className="text-3xl font-black text-gray-900">{summary?.unique_visitor_uuids ?? 0}</p>
                            </div>
                            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                                <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                    <FaUsers className="text-emerald-500" /> לקוחות (מזהה)
                                </p>
                                <p className="text-3xl font-black text-gray-900">{summary?.unique_customer_ids ?? 0}</p>
                            </div>
                            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                                <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-1">משתמשי ניהול</p>
                                <p className="text-3xl font-black text-gray-900">{summary?.unique_admin_user_ids ?? 0}</p>
                            </div>
                        </div>
                        {hourChartData.length > 0 ? (
                            <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6 shadow-sm">
                                <h2 className="text-lg font-black text-gray-900 mb-4">צפיות לפי שעה</h2>
                                <div className="h-64 w-full min-w-0" dir="ltr">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={hourChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                                            <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={2} />
                                            <YAxis allowDecimals={false} width={36} tick={{ fontSize: 10 }} />
                                            <Tooltip />
                                            <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} name="צפיות" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        ) : null}


                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                            <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6 shadow-sm min-w-0">
                                <h2 className="text-lg font-black text-gray-900 mb-1 flex items-center gap-2">
                                    <FaUtensils className="text-orange-500" />
                                    תפריט — פילוח לפי מסעדה
                                </h2>
                                <p className="text-xs text-gray-500 mb-4">
                                    {pageKeyLabel('menu')} · <code className="text-[10px] bg-gray-100 px-1 rounded">menu</code>
                                </p>
                                <div className={tableScrollClass}>
                                    <table className="min-w-full text-sm">
                                        <thead>
                                            <tr className="text-right border-b border-gray-200">
                                                <th className={thSticky}>מסעדה</th>
                                                <th className={`${thSticky} text-center`}>כניסות</th>
                                                <th className={`${thSticky} text-center`}>מבקרים ייחודיים</th>
                                            </tr>
                                        </thead>
                                    <tbody>
                                        {(menuInsights?.by_restaurant || []).length === 0 ? (
                                            <tr>
                                                <td colSpan={3} className="py-6 text-center text-gray-500">
                                                    אין כניסות לתפריט בתקופה
                                                </td>
                                            </tr>
                                        ) : (
                                            menuInsights.by_restaurant.map((r, i) => (
                                                <tr key={i} className="border-b border-gray-50">
                                                    <td className="py-2 px-2">
                                                        <div className="font-black text-gray-900">
                                                            {r.restaurant_name || '—'}
                                                            {r.restaurant_id != null && (
                                                                <span className="text-gray-400 font-mono text-xs font-normal mr-1">
                                                                    #{r.restaurant_id}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {r.tenant_id ? (
                                                            <div className="text-[10px] text-gray-400 mt-0.5 ltr text-left break-all font-mono">
                                                                מזהה טננט (טכני): {r.tenant_id}
                                                            </div>
                                                        ) : null}
                                                    </td>
                                                    <td className="py-2 px-2 text-center font-black">{r.visits}</td>
                                                    <td className="py-2 px-2 text-center font-black text-indigo-700">{r.unique_visitors}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6 shadow-sm min-w-0">
                                <h2 className="text-lg font-black text-gray-900 mb-1">תפריט — כניסות אחרונות</h2>
                                <p className="text-xs text-gray-500 mb-4">מבקרים מוסתרים חלקית</p>
                                <div className={tableScrollClass}>
                                    <table className="min-w-full text-sm">
                                        <thead>
                                            <tr className="text-right border-b border-gray-200">
                                                <th className={thSticky}>זמן</th>
                                                <th className={thSticky}>מסעדה</th>
                                                <th className={thSticky}>מבקר / לקוח</th>
                                                <th className={thSticky}>דף / יעד</th>
                                            </tr>
                                        </thead>
                                    <tbody>
                                        {(menuInsights?.recent_menu_views || []).length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="py-6 text-center text-gray-500">
                                                    אין רשומות
                                                </td>
                                            </tr>
                                        ) : (
                                            menuInsights.recent_menu_views.map((r) => (
                                                <tr key={r.id} className="border-b border-gray-50 align-top">
                                                    <td className="py-2 px-2 text-gray-600 whitespace-nowrap text-xs">
                                                        {r.created_at
                                                            ? new Date(r.created_at).toLocaleString('he-IL')
                                                            : '—'}
                                                    </td>
                                                    <td className="py-2 px-2">
                                                        <div className="font-black text-gray-900">{r.restaurant_name || '—'}</div>
                                                        {r.tenant_id ? (
                                                            <div className="text-[10px] font-mono text-gray-400 ltr text-left break-all mt-0.5">
                                                                מזהה טננט: {r.tenant_id}
                                                            </div>
                                                        ) : null}
                                                    </td>
                                                    <td className="py-2 px-2 text-gray-800 text-xs">{r.detail_label}</td>
                                                    <td
                                                        className="py-2 px-2 text-sm font-bold text-gray-800 max-w-[200px]"
                                                        title={r.path || ''}
                                                    >
                                                        {describeCustomerPath(r.path)}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                                <h2 className="text-lg font-black text-gray-900 mb-1">לפי דף</h2>
                                <p className="text-xs text-gray-500 mb-4">שם בעברית + מפתח טכני (page_key) לזיהוי במערכת</p>
                                <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
                                    {pageEntries.length === 0 ? (
                                        <p className="text-sm text-gray-500">אין נתונים בתקופה</p>
                                    ) : (
                                        pageEntries.map(([key, count]) => (
                                            <div
                                                key={key}
                                                className="flex justify-between items-start gap-3 py-2 border-b border-gray-50 text-sm"
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <div className="font-black text-gray-900">{pageKeyLabel(key)}</div>
                                                    <code className="text-[10px] text-gray-400 font-mono ltr text-left block truncate mt-0.5">
                                                        {key}
                                                    </code>
                                                </div>
                                                <span className="font-black text-gray-800 shrink-0 tabular-nums">{count}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                                <h2 className="text-lg font-black text-gray-900 mb-1">לפי סוג מבקר</h2>
                                <p className="text-xs text-gray-500 mb-4">
                                    {summary?.admin_visit_split || summary?.registered_visit_split
                                        ? 'מפוצל לפי בעל המערכת: פאנל ניהול (משתמש) ולקוח B2C רשום (טלפון), מול שאר המשתמשים.'
                                        : 'כניסות מזוהות לפי סוג המבקר שנשמר באירוע.'}
                                </p>
                                <div className="space-y-2">
                                    {visitorKindRows.length === 0 ? (
                                        <p className="text-sm text-gray-500">אין נתונים בתקופה</p>
                                    ) : (
                                        visitorKindRows.map((row) => (
                                            <div
                                                key={row.key}
                                                className={`flex justify-between items-center py-2 border-b border-gray-50 text-sm rounded-lg px-2 -mx-2 ${
                                                    row.accent ? 'bg-amber-50/90 border-amber-100' : ''
                                                }`}
                                            >
                                                <span
                                                    className={`font-bold flex items-center gap-2 ${
                                                        row.accent ? 'text-amber-900' : 'text-gray-700'
                                                    }`}
                                                >
                                                    {row.ownerChannel === 'admin' ? (
                                                        <FaUserShield className="text-amber-600 shrink-0" size={14} />
                                                    ) : null}
                                                    {row.ownerChannel === 'registered' ? (
                                                        <FaMobileAlt className="text-amber-600 shrink-0" size={14} />
                                                    ) : null}
                                                    {row.label}
                                                </span>
                                                <span className="font-black text-gray-800 tabular-nums">{row.count}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6 shadow-sm min-w-0">
                            <h2 className="text-lg font-black text-gray-900 mb-4">מובילים לפי פעילות</h2>
                            <div className={tableScrollClass}>
                                <table className="min-w-full text-sm">
                                    <thead>
                                        <tr className="text-right border-b border-gray-200">
                                            <th className={thSticky}>תווית</th>
                                            <th className={thSticky}>סוג</th>
                                            <th className={`${thSticky} text-center`}>צפיות</th>
                                        </tr>
                                    </thead>
                                <tbody>
                                    {topRows.length === 0 ? (
                                        <tr>
                                            <td colSpan={3} className="py-8 text-center text-gray-500">
                                                אין נתונים בתקופה
                                            </td>
                                        </tr>
                                    ) : (
                                        topRows.map((row, i) => (
                                            <tr
                                                key={i}
                                                className={`border-b border-gray-50 hover:bg-gray-50/80 ${
                                                    row.is_platform_owner ? 'bg-amber-50/50' : ''
                                                }`}
                                            >
                                                <td className="py-3 px-2 font-bold text-gray-800">
                                                    {row.label}
                                                    {row.is_platform_owner ? (
                                                        <span className="mr-2 text-[10px] font-black uppercase text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-md">
                                                            בעל מערכת
                                                        </span>
                                                    ) : null}
                                                </td>
                                                <td className="py-3 px-2 text-gray-600">
                                                    {KIND_LABELS[row.visitor_kind] || row.visitor_kind}
                                                </td>
                                                <td className="py-3 px-2 text-center font-black">{row.visit_count}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </SuperAdminLayout>
    );
}
