import { useEffect, useState, useCallback, useMemo } from 'react';
import SuperAdminLayout from '../../layouts/SuperAdminLayout';
import api from '../../services/apiClient';
import { useAdminAuth } from '../../context/AdminAuthContext';
import {
    FaFunnelDollar,
    FaExclamationTriangle,
    FaBug,
    FaClock,
    FaMobileAlt,
    FaStore,
    FaShoppingBasket,
    FaArrowDown,
} from 'react-icons/fa';

const RANGE_PRESETS = [
    { value: 'today', label: 'היום' },
    { value: '7d', label: '7 ימים' },
    { value: '30d', label: '30 יום' },
];

const DEVICE_LABELS = {
    mobile: 'מובייל',
    tablet: 'טאבלט',
    desktop: 'מחשב',
    unknown: 'לא ידוע',
};

const OS_LABELS = {
    android: 'Android',
    ios: 'iOS (אייפון)',
    windows: 'Windows',
    macos: 'macOS',
    linux: 'Linux',
    unknown: 'לא ידוע',
};

const ERROR_TYPE_LABELS = {
    js_error: 'שגיאת JavaScript',
    unhandled_rejection: 'Promise שנכשל',
    api_error: 'שגיאת שרת (API)',
};

function fmtDuration(seconds) {
    const s = Number(seconds) || 0;
    if (s < 60) return `${Math.round(s)} שנ'`;
    const m = Math.floor(s / 60);
    const rem = Math.round(s % 60);
    return rem ? `${m} דק' ${rem} שנ'` : `${m} דק'`;
}

function buildQuery({ rangePreset, restaurantId, device }) {
    const sp = new URLSearchParams();
    if (rangePreset === 'today') sp.set('period', 'today');
    else sp.set('days', rangePreset === '30d' ? '30' : '7');
    if (restaurantId) sp.set('restaurant_id', String(restaurantId));
    if (device) sp.set('device', device);
    return sp.toString();
}

function Kpi({ label, value, sub, accent }) {
    return (
        <div className={`rounded-2xl border p-4 ${accent ? 'border-brand-primary/40 bg-orange-50' : 'border-gray-200 bg-white'}`}>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{label}</p>
            <p className="mt-1 text-2xl font-black text-gray-900">{value}</p>
            {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
        </div>
    );
}

export default function SuperAdminFunnel() {
    const { getAuthHeaders } = useAdminAuth();
    const [rangePreset, setRangePreset] = useState('7d');
    const [restaurantId, setRestaurantId] = useState('');
    const [device, setDevice] = useState('');
    const [restaurants, setRestaurants] = useState([]);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    const queryKey = useMemo(
        () => buildQuery({ rangePreset, restaurantId, device }),
        [rangePreset, restaurantId, device]
    );

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get(`/super-admin/funnel/summary?${queryKey}`, { headers: getAuthHeaders() });
            if (res.data?.success) setData(res.data.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [getAuthHeaders, queryKey]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        (async () => {
            try {
                const res = await api.get('/super-admin/funnel/restaurants', { headers: getAuthHeaders() });
                if (res.data?.success) setRestaurants(res.data.data || []);
            } catch { /* ignore */ }
        })();
    }, [getAuthHeaders]);

    const totals = data?.totals || {};
    const funnel = data?.funnel || [];
    const maxFunnel = funnel[0]?.sessions || 1;
    const primary = data?.primary_reason;
    const silent = data?.silent_abandon;
    const topReasons = data?.top_block_reasons || [];
    const topErrors = data?.top_errors || [];
    const timePerStage = data?.time_per_stage || [];
    const byDevice = data?.by_device || [];
    const byOs = data?.by_os || [];
    const byRestaurant = data?.by_restaurant;

    return (
        <SuperAdminLayout>
            <div className="space-y-6" dir="rtl">
                {/* כותרת + פילטרים */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-xl bg-brand-primary/15 flex items-center justify-center">
                            <FaFunnelDollar className="text-brand-primary text-xl" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-gray-900">משפך המרה ונטישה</h1>
                            <p className="text-sm text-gray-500">איפה ולמה לקוחות לא משלימים הזמנה</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <select
                            value={restaurantId}
                            onChange={(e) => setRestaurantId(e.target.value)}
                            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                        >
                            <option value="">כל המסעדות</option>
                            {restaurants.map((r) => (
                                <option key={r.restaurant_id} value={r.restaurant_id}>{r.restaurant_name}</option>
                            ))}
                        </select>
                        <select
                            value={device}
                            onChange={(e) => setDevice(e.target.value)}
                            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                        >
                            <option value="">כל המכשירים</option>
                            <option value="mobile">מובייל</option>
                            <option value="tablet">טאבלט</option>
                            <option value="desktop">מחשב</option>
                        </select>
                        <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                            {RANGE_PRESETS.map((p) => (
                                <button
                                    key={p.value}
                                    onClick={() => setRangePreset(p.value)}
                                    className={`px-3 py-2 text-sm font-semibold ${rangePreset === p.value ? 'bg-brand-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {loading && !data ? (
                    <div className="py-20 text-center text-gray-500">טוען נתונים…</div>
                ) : (
                    <>
                        {/* הסיבה מספר 1 */}
                        <div className="rounded-2xl border border-gray-200 bg-white p-5">
                            <div className="flex items-start gap-3">
                                <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                                    <FaExclamationTriangle className="text-red-500" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-bold uppercase tracking-wide text-red-600">הסיבה מספר 1 לנטישה</p>
                                    {primary ? (
                                        <>
                                            <p className="text-2xl font-black text-gray-900 mt-0.5">{primary.label}</p>
                                            <p className="text-sm text-gray-600 mt-1">
                                                {primary.sessions.toLocaleString()} משתמשים נחסמו ({primary.pct_of_abandoned}% מהנטישות עם סיבה מזוהה)
                                            </p>
                                        </>
                                    ) : (
                                        <p className="text-lg font-bold text-gray-700 mt-1">
                                            אין עדיין סיבות חסימה מזוהות בטווח הזמן הזה.
                                        </p>
                                    )}
                                    {silent?.sessions > 0 && (
                                        <p className="text-xs text-gray-500 mt-2">
                                            בנוסף: {silent.sessions.toLocaleString()} עזבו ללא סיבה מפורשת (כנראה מחיר/חוסר עניין) — {silent.pct_of_abandoned}% מהנטישות.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* KPIs */}
                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                            <Kpi label="ביקורים (Sessions)" value={(totals.sessions || 0).toLocaleString()} />
                            <Kpi label="הגיעו לסל" value={(totals.reached_cart || 0).toLocaleString()} />
                            <Kpi label="הזמנות" value={(totals.orders || 0).toLocaleString()} accent />
                            <Kpi label="אחוז המרה" value={`${totals.conversion_rate || 0}%`} sub="מתוך כלל הביקורים" accent />
                            <Kpi label="אחוז נטישה" value={`${totals.abandon_rate || 0}%`} />
                        </div>

                        {/* משפך */}
                        <div className="rounded-2xl border border-gray-200 bg-white p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <FaShoppingBasket className="text-brand-primary" />
                                <h2 className="font-black text-gray-900">משפך לפי שלב</h2>
                            </div>
                            <div className="space-y-2.5">
                                {funnel.map((s) => {
                                    const width = Math.max(2, Math.round((s.sessions / maxFunnel) * 100));
                                    return (
                                        <div key={s.stage} className="flex items-center gap-3">
                                            <div className="w-28 shrink-0 text-sm font-semibold text-gray-700 text-left">{s.label}</div>
                                            <div className="flex-1 bg-gray-100 rounded-lg h-8 relative overflow-hidden">
                                                <div
                                                    className="h-full bg-brand-primary rounded-lg flex items-center px-2"
                                                    style={{ width: `${width}%` }}
                                                >
                                                    <span className="text-xs font-bold text-white whitespace-nowrap">{s.sessions.toLocaleString()}</span>
                                                </div>
                                            </div>
                                            <div className="w-24 shrink-0 text-xs text-gray-500 flex items-center gap-1">
                                                <span>{s.pct_of_total}%</span>
                                                {s.drop_from_prev > 0 && (
                                                    <span className="text-red-500 flex items-center gap-0.5">
                                                        <FaArrowDown className="text-[10px]" /> {s.drop_pct_from_prev}%
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="grid lg:grid-cols-2 gap-4">
                            {/* סיבות נטישה */}
                            <div className="rounded-2xl border border-gray-200 bg-white p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <FaExclamationTriangle className="text-amber-500" />
                                    <h2 className="font-black text-gray-900">סיבות נטישה מובילות</h2>
                                </div>
                                {topReasons.length === 0 ? (
                                    <p className="text-sm text-gray-500">אין נתונים בטווח הזה.</p>
                                ) : (
                                    <ul className="space-y-2">
                                        {topReasons.map((r) => (
                                            <li key={r.reason} className="flex items-center justify-between gap-3">
                                                <span className="text-sm font-semibold text-gray-800">{r.label}</span>
                                                <span className="text-sm text-gray-500">
                                                    <b className="text-gray-900">{r.sessions.toLocaleString()}</b> · {r.pct_of_abandoned}%
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            {/* בדיקות תקינות / שגיאות */}
                            <div className="rounded-2xl border border-gray-200 bg-white p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <FaBug className="text-rose-500" />
                                    <h2 className="font-black text-gray-900">בדיקות תקינות (שגיאות)</h2>
                                </div>
                                {topErrors.length === 0 ? (
                                    <p className="text-sm text-gray-500">לא נתפסו שגיאות בטווח הזה.</p>
                                ) : (
                                    <ul className="space-y-2.5">
                                        {topErrors.map((er, i) => (
                                            <li key={i} className="text-sm">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="font-semibold text-gray-800">
                                                        {ERROR_TYPE_LABELS[er.error_type] || er.error_type}
                                                        <span className="text-gray-400"> · {er.page_key}</span>
                                                    </span>
                                                    <span className="text-gray-500">
                                                        <b className="text-rose-600">{er.sessions.toLocaleString()}</b> משתמשים
                                                    </span>
                                                </div>
                                                {er.sample_message && (
                                                    <p className="text-xs text-gray-400 truncate mt-0.5" dir="ltr">{er.sample_message}</p>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            {/* זמן בכל שלב */}
                            <div className="rounded-2xl border border-gray-200 bg-white p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <FaClock className="text-indigo-500" />
                                    <h2 className="font-black text-gray-900">זמן ממוצע בכל שלב</h2>
                                </div>
                                {timePerStage.length === 0 ? (
                                    <p className="text-sm text-gray-500">אין מספיק נתונים בטווח הזה.</p>
                                ) : (
                                    <ul className="space-y-2">
                                        {timePerStage.map((t) => (
                                            <li key={t.stage} className="flex items-center justify-between gap-3">
                                                <span className="text-sm font-semibold text-gray-800">{t.label}</span>
                                                <span className="text-sm text-gray-500">
                                                    ממוצע <b className="text-gray-900">{fmtDuration(t.avg_seconds)}</b>
                                                    <span className="text-gray-400"> · חציון {fmtDuration(t.median_seconds)}</span>
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            {/* פילוח מכשירים */}
                            <div className="rounded-2xl border border-gray-200 bg-white p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <FaMobileAlt className="text-teal-500" />
                                    <h2 className="font-black text-gray-900">לפי מכשיר ומערכת הפעלה</h2>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs font-bold text-gray-400 mb-1.5">מכשיר</p>
                                        <ul className="space-y-1.5">
                                            {byDevice.map((d) => (
                                                <li key={d.key} className="flex items-center justify-between text-sm">
                                                    <span className="text-gray-700">{DEVICE_LABELS[d.key] || d.key}</span>
                                                    <span className="text-gray-500">{d.sessions.toLocaleString()} · <b className="text-gray-900">{d.conversion_rate}%</b></span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-gray-400 mb-1.5">מערכת הפעלה</p>
                                        <ul className="space-y-1.5">
                                            {byOs.map((o) => (
                                                <li key={o.key} className="flex items-center justify-between text-sm">
                                                    <span className="text-gray-700">{OS_LABELS[o.key] || o.key}</span>
                                                    <span className="text-gray-500">{o.sessions.toLocaleString()} · <b className="text-gray-900">{o.conversion_rate}%</b></span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* לפי מסעדה */}
                        {byRestaurant && byRestaurant.length > 0 && (
                            <div className="rounded-2xl border border-gray-200 bg-white p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <FaStore className="text-brand-primary" />
                                    <h2 className="font-black text-gray-900">המרה לפי מסעדה</h2>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-right text-gray-400 border-b border-gray-100">
                                                <th className="py-2 font-semibold">מסעדה</th>
                                                <th className="py-2 font-semibold">ביקורים</th>
                                                <th className="py-2 font-semibold">הזמנות</th>
                                                <th className="py-2 font-semibold">המרה</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {byRestaurant.map((r) => (
                                                <tr key={r.restaurant_id ?? 'none'} className="border-b border-gray-50">
                                                    <td className="py-2 font-semibold text-gray-800">{r.restaurant_name}</td>
                                                    <td className="py-2 text-gray-600">{r.sessions.toLocaleString()}</td>
                                                    <td className="py-2 text-gray-600">{r.orders.toLocaleString()}</td>
                                                    <td className="py-2 font-bold text-gray-900">{r.conversion_rate}%</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </SuperAdminLayout>
    );
}
