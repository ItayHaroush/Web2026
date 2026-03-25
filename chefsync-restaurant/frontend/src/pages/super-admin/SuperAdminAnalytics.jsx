import { useEffect, useState, useCallback, useMemo } from 'react';
import SuperAdminLayout from '../../layouts/SuperAdminLayout';
import api from '../../services/apiClient';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { FaChartBar, FaUsers, FaMousePointer, FaUtensils, FaStore, FaUserShield, FaMobileAlt } from 'react-icons/fa';
import { pageKeyLabel, describeCustomerPath } from '../../constants/pageViewLabels';

const KIND_LABELS = {
    anonymous: 'מבקר אנונימי',
    customer_guest: 'לקוח (לא רשום)',
    customer_registered: 'לקוח רשום',
    admin: 'מנהל / צוות (מאוחד)',
};

const VISITOR_FILTERS = [
    { value: 'all', label: 'הכל' },
    { value: 'exclude_owner', label: 'בלי כניסות שלי (בעל המערכת)' },
    { value: 'owner_only', label: 'רק כניסות שלי' },
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

export default function SuperAdminAnalytics() {
    const { getAuthHeaders, user } = useAdminAuth();
    const [days, setDays] = useState(7);
    const [visitorFilter, setVisitorFilter] = useState('all');
    const [summary, setSummary] = useState(null);
    const [topRows, setTopRows] = useState([]);
    const [menuInsights, setMenuInsights] = useState(null);
    const [loading, setLoading] = useState(true);

    const vf = encodeURIComponent(visitorFilter);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const h = { headers: getAuthHeaders() };
            const [sRes, tRes, mRes] = await Promise.all([
                api.get(`/super-admin/analytics/summary?days=${days}&visitor_filter=${vf}`, h),
                api.get(`/super-admin/analytics/top-entities?days=${days}&limit=50&visitor_filter=${vf}`, h),
                api.get(`/super-admin/analytics/menu-insights?days=${days}&limit_recent=100&visitor_filter=${vf}`, h),
            ]);
            if (sRes.data?.success) setSummary(sRes.data.data);
            if (tRes.data?.success) setTopRows(tRes.data.data?.rows || []);
            if (mRes.data?.success) setMenuInsights(mRes.data.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [getAuthHeaders, days, vf]);

    useEffect(() => {
        load();
    }, [load]);

    const byPage = summary?.by_page_key || {};
    const byKind = summary?.by_visitor_kind || {};
    const pageEntries = Object.entries(byPage).sort((a, b) => b[1] - a[1]);
    const platformOwner = summary?.platform_owner;
    const visitorKindRows = useMemo(
        () => buildVisitorKindDisplayRows(byKind, summary?.admin_visit_split, summary?.registered_visit_split),
        [byKind, summary?.admin_visit_split, summary?.registered_visit_split]
    );

    const filterHint =
        visitorFilter === 'exclude_owner'
            ? 'מוצגים נתונים ללא הכניסות שלך: לא כמשתמש פאנל (לפי אימייל המערכת) ולא כלקוח B2C רשום (לפי מספר הטלפון המוגדר ב־PLATFORM_OWNER_CUSTOMER_PHONE).'
            : visitorFilter === 'owner_only'
              ? 'מוצגות רק כניסות שמקושרות אליך: פאנל ניהול (משתמש עם אימייל בעל המערכת) או אפליקציית לקוח עם אותו מספר טלפון רשום ב־customers.'
              : null;

    return (
        <SuperAdminLayout>
            <div className="space-y-8" dir="rtl">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                        <div className="p-2 bg-indigo-100 rounded-lg">
                            <FaChartBar className="text-indigo-600" size={22} />
                        </div>
                        אנליטיקות כניסה
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        כניסות לדפים ציבוריים, פאנל מסעדה וסופר־אדמין — מזהה אנונימי נשמר בדפדפן (לא מבוסס טלפון).
                    </p>
                    {user?.email && (
                        <p className="text-xs text-gray-400 mt-2 ltr text-left">
                            מחובר כעת: <span className="font-mono">{user.email}</span>
                            {user?.is_super_admin ? (
                                <span className="mr-2 text-indigo-600 font-bold">· סופר־אדמין</span>
                            ) : null}
                        </p>
                    )}
                </div>

                <div className="space-y-3">
                    <p className="text-xs font-black text-gray-500 uppercase tracking-wider">סינון לפי בעל המערכת</p>
                    <div className="flex flex-wrap gap-2">
                        {VISITOR_FILTERS.map((f) => (
                            <button
                                key={f.value}
                                type="button"
                                onClick={() => setVisitorFilter(f.value)}
                                className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-black transition-all border ${
                                    visitorFilter === f.value
                                        ? 'bg-violet-600 text-white border-violet-600 shadow-md'
                                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                                }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                    {(platformOwner?.email_masked || platformOwner?.customer_phone_masked) && (
                        <div className="text-xs text-gray-500 space-y-1">
                            <p className="font-black text-gray-600">מזהים לסינון ובהבדלה בסטטיסטיקה</p>
                            {platformOwner.email_masked ? (
                                <p>
                                    משתמש פאנל (אימייל):{' '}
                                    <span className="font-mono ltr text-left inline-block">{platformOwner.email_masked}</span>
                                    {!platformOwner.user_resolved && platformOwner.email_configured ? (
                                        <span className="text-amber-600 font-bold mr-1 block sm:inline mt-1 sm:mt-0">
                                            — לא נמצא משתמש עם אימייל זה; סינון לפי פאנל לא יחול.
                                        </span>
                                    ) : null}
                                </p>
                            ) : null}
                            {platformOwner.customer_phone_masked ? (
                                <p>
                                    לקוח רשום B2C (טלפון):{' '}
                                    <span className="font-mono ltr text-left inline-block">{platformOwner.customer_phone_masked}</span>
                                    {!platformOwner.customer_resolved && platformOwner.customer_phone_configured ? (
                                        <span className="text-amber-600 font-bold mr-1 block sm:inline mt-1 sm:mt-0">
                                            — לא נמצאה רשומת לקוח עם מספר זה (אחרי נרמול ל־E164); סינון לפי לקוח לא יחול.
                                        </span>
                                    ) : null}
                                </p>
                            ) : null}
                        </div>
                    )}
                    {filterHint && (
                        <div className="rounded-xl border border-violet-100 bg-violet-50/80 px-4 py-3 text-sm text-violet-900 font-bold">
                            {filterHint}
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap gap-2">
                    {[7, 30].map((d) => (
                        <button
                            key={d}
                            type="button"
                            onClick={() => setDays(d)}
                            className={`px-4 py-2 rounded-xl text-sm font-black transition-all ${
                                days === d
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            {d} ימים אחרונים
                        </button>
                    ))}
                </div>

                {loading ? (
                    <p className="text-gray-500 font-bold">טוען…</p>
                ) : (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                                <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-1">סה״כ צפיות</p>
                                <p className="text-3xl font-black text-gray-900">{summary?.total_visits ?? 0}</p>
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

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm overflow-x-auto">
                                <h2 className="text-lg font-black text-gray-900 mb-1 flex items-center gap-2">
                                    <FaUtensils className="text-orange-500" />
                                    תפריט — פילוח לפי מסעדה
                                </h2>
                                <p className="text-xs text-gray-500 mb-4">
                                    כניסות לתפריט לקוח ({pageKeyLabel('menu')} · מפתח טכני: <code className="text-[10px] bg-gray-100 px-1 rounded">menu</code>)
                                </p>
                                <table className="min-w-full text-sm">
                                    <thead>
                                        <tr className="text-right border-b border-gray-200">
                                            <th className="py-2 px-2 font-black text-gray-500">מסעדה</th>
                                            <th className="py-2 px-2 font-black text-gray-500 text-center">כניסות</th>
                                            <th className="py-2 px-2 font-black text-gray-500 text-center">מבקרים ייחודיים</th>
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

                            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm overflow-x-auto">
                                <h2 className="text-lg font-black text-gray-900 mb-1">תפריט — כניסות אחרונות (מפורט)</h2>
                                <p className="text-xs text-gray-500 mb-4">לקוח מזוהה: שם + טלפון מוסתר · אורח: שם מהטופס אם הוזן + קצה UUID</p>
                                <table className="min-w-full text-sm">
                                    <thead>
                                        <tr className="text-right border-b border-gray-200">
                                            <th className="py-2 px-2 font-black text-gray-500">זמן</th>
                                            <th className="py-2 px-2 font-black text-gray-500">מסעדה</th>
                                            <th className="py-2 px-2 font-black text-gray-500">מבקר / לקוח</th>
                                            <th className="py-2 px-2 font-black text-gray-500">דף / יעד</th>
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

                        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm overflow-x-auto">
                            <h2 className="text-lg font-black text-gray-900 mb-4">מובילים לפי פעילות</h2>
                            <table className="min-w-full text-sm">
                                <thead>
                                    <tr className="text-right border-b border-gray-200">
                                        <th className="py-3 px-2 font-black text-gray-500">תווית</th>
                                        <th className="py-3 px-2 font-black text-gray-500">סוג</th>
                                        <th className="py-3 px-2 font-black text-gray-500 text-center">צפיות</th>
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
                    </>
                )}
            </div>
        </SuperAdminLayout>
    );
}
