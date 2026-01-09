import { useEffect, useMemo, useState } from 'react';
import SuperAdminLayout from '../../layouts/SuperAdminLayout';
import { useAdminAuth } from '../../context/AdminAuthContext';
import api from '../../services/apiClient';
import { toast } from 'react-hot-toast';

function parseCommaList(value) {
    return value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}

export default function SuperAdminNotifications() {
    const { getAuthHeaders } = useAdminAuth();

    const [loadingFilters, setLoadingFilters] = useState(true);
    const [filtersData, setFiltersData] = useState(null);

    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');

    const [selectedCuisineTypes, setSelectedCuisineTypes] = useState([]);
    const [selectedRegions, setSelectedRegions] = useState([]);
    const [selectedCities, setSelectedCities] = useState([]);
    const [selectedRestaurantIds, setSelectedRestaurantIds] = useState([]);

    const [tenantIdsText, setTenantIdsText] = useState('');
    const [userIdsText, setUserIdsText] = useState('');

    const [result, setResult] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchFilters();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchFilters = async () => {
        setLoadingFilters(true);
        try {
            const res = await api.get('/super-admin/notifications/filters', {
                headers: getAuthHeaders(),
            });
            if (res.data?.success) {
                setFiltersData(res.data.data);
            } else {
                toast.error('שגיאה בטעינת פילטרים');
            }
        } catch (e) {
            console.error(e);
            toast.error(e.response?.data?.message || 'שגיאה בטעינת פילטרים');
        } finally {
            setLoadingFilters(false);
        }
    };

    const citiesForSelectedRegions = useMemo(() => {
        const all = filtersData?.cities || [];
        if (!selectedRegions.length) return all;
        return all.filter((c) => selectedRegions.includes(c.region));
    }, [filtersData, selectedRegions]);

    const restaurants = useMemo(() => filtersData?.restaurants || [], [filtersData]);

    const buildFiltersPayload = () => {
        const tenantIds = parseCommaList(tenantIdsText);
        const userIds = parseCommaList(userIdsText)
            .map((s) => Number(s))
            .filter((n) => Number.isFinite(n));

        return {
            tenant_ids: tenantIds.length ? tenantIds : undefined,
            user_ids: userIds.length ? userIds : undefined,
            cuisine_types: selectedCuisineTypes.length ? selectedCuisineTypes : undefined,
            regions: selectedRegions.length ? selectedRegions : undefined,
            cities: selectedCities.length ? selectedCities : undefined,
            restaurant_ids: selectedRestaurantIds.length
                ? selectedRestaurantIds.map((id) => Number(id)).filter((n) => Number.isFinite(n))
                : undefined,
        };
    };

    const send = async (dryRun) => {
        setSubmitting(true);
        setResult(null);

        try {
            const payload = {
                title,
                body,
                dry_run: !!dryRun,
                filters: buildFiltersPayload(),
                data: {
                    url: '/super-admin/dashboard',
                },
            };

            const res = await api.post('/super-admin/notifications/send', payload, {
                headers: getAuthHeaders(),
            });

            if (res.data?.success) {
                setResult(res.data);
                if (dryRun) {
                    toast.success('בדיקת יעד הושלמה');
                } else {
                    toast.success('נשלחה התראה');
                }
            } else {
                toast.error('שליחת התראה נכשלה');
            }
        } catch (e) {
            console.error(e);
            toast.error(e.response?.data?.message || 'שליחת התראה נכשלה');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <SuperAdminLayout>
            <div className="max-w-5xl mx-auto">
                <div className="mb-6">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">🔔 התראות מערכת</h1>
                    <p className="text-sm text-gray-600 mt-1">שליחת התראות לפי פילטרים (סוג מטבח, אזור/עיר, מסעדות, משתמשים).</p>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">כותרת</label>
                            <input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-primary"
                                placeholder="לדוגמה: מבצע חדש השבוע"
                                maxLength={80}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">תוכן</label>
                            <input
                                value={body}
                                onChange={(e) => setBody(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-primary"
                                placeholder="לדוגמה: 10% הנחה על כל התפריט"
                                maxLength={200}
                            />
                        </div>
                    </div>

                    <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                            <h2 className="font-bold text-gray-900 mb-3">🎯 פילטרים</h2>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">סוג מטבח</label>
                                    <select
                                        multiple
                                        value={selectedCuisineTypes}
                                        onChange={(e) => setSelectedCuisineTypes(Array.from(e.target.selectedOptions).map((o) => o.value))}
                                        className="w-full min-h-[120px] px-3 py-2 border border-gray-200 rounded-lg bg-white"
                                        disabled={loadingFilters}
                                    >
                                        {(filtersData?.cuisine_types || []).map((t) => (
                                            <option key={t} value={t}>{t}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">אזור</label>
                                    <select
                                        multiple
                                        value={selectedRegions}
                                        onChange={(e) => {
                                            const next = Array.from(e.target.selectedOptions).map((o) => o.value);
                                            setSelectedRegions(next);
                                            // clear cities if they are no longer in the region set
                                            setSelectedCities((prev) => prev.filter((c) => {
                                                const city = (filtersData?.cities || []).find((x) => x.hebrew_name === c || x.name === c);
                                                return !city?.region || next.includes(city.region);
                                            }));
                                        }}
                                        className="w-full min-h-[120px] px-3 py-2 border border-gray-200 rounded-lg bg-white"
                                        disabled={loadingFilters}
                                    >
                                        {(filtersData?.regions || []).map((r) => (
                                            <option key={r} value={r}>{r}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">ערים</label>
                                    <select
                                        multiple
                                        value={selectedCities}
                                        onChange={(e) => setSelectedCities(Array.from(e.target.selectedOptions).map((o) => o.value))}
                                        className="w-full min-h-[160px] px-3 py-2 border border-gray-200 rounded-lg bg-white"
                                        disabled={loadingFilters}
                                    >
                                        {citiesForSelectedRegions.map((c) => (
                                            <option key={`${c.name}-${c.hebrew_name}`} value={c.hebrew_name || c.name}>
                                                {c.hebrew_name || c.name}{c.region ? ` (${c.region})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">מסעדות</label>
                                    <select
                                        multiple
                                        value={selectedRestaurantIds}
                                        onChange={(e) => setSelectedRestaurantIds(Array.from(e.target.selectedOptions).map((o) => o.value))}
                                        className="w-full min-h-[160px] px-3 py-2 border border-gray-200 rounded-lg bg-white"
                                        disabled={loadingFilters}
                                    >
                                        {restaurants.map((r) => (
                                            <option key={r.id} value={r.id}>
                                                {r.name} — {r.tenant_id}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Tenant IDs (מופרדים בפסיקים)</label>
                                    <input
                                        value={tenantIdsText}
                                        onChange={(e) => setTenantIdsText(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white"
                                        placeholder="pizza-palace, burger-central"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">User IDs (מופרדים בפסיקים)</label>
                                    <input
                                        value={userIdsText}
                                        onChange={(e) => setUserIdsText(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white"
                                        placeholder="12, 34"
                                    />
                                </div>
                            </div>

                            <div className="mt-4 flex flex-col sm:flex-row gap-3">
                                <button
                                    onClick={() => send(true)}
                                    disabled={submitting || !title || !body}
                                    className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50"
                                >
                                    {submitting ? 'טוען...' : 'בדיקת יעד (Dry run)'}
                                </button>
                                <button
                                    onClick={() => send(false)}
                                    disabled={submitting || !title || !body}
                                    className="px-4 py-2 rounded-lg bg-brand-primary text-white hover:bg-brand-primary/90 disabled:opacity-50"
                                >
                                    {submitting ? 'שולח...' : 'שלח התראה'}
                                </button>
                                <button
                                    onClick={() => {
                                        setSelectedCuisineTypes([]);
                                        setSelectedRegions([]);
                                        setSelectedCities([]);
                                        setSelectedRestaurantIds([]);
                                        setTenantIdsText('');
                                        setUserIdsText('');
                                        setResult(null);
                                    }}
                                    className="px-4 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50"
                                >
                                    נקה פילטרים
                                </button>
                            </div>
                        </div>

                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                            <h2 className="font-bold text-gray-900 mb-3">📦 תוצאה</h2>

                            {loadingFilters ? (
                                <p className="text-sm text-gray-600">טוען פילטרים...</p>
                            ) : !filtersData ? (
                                <p className="text-sm text-gray-600">לא נטענו פילטרים.</p>
                            ) : (
                                <div className="text-sm text-gray-700 space-y-2">
                                    <p>סוגי מטבח: {filtersData.cuisine_types?.length || 0}</p>
                                    <p>אזורים: {filtersData.regions?.length || 0}</p>
                                    <p>ערים: {filtersData.cities?.length || 0}</p>
                                    <p>מסעדות: {filtersData.restaurants?.length || 0}</p>
                                </div>
                            )}

                            <div className="mt-4">
                                {result ? (
                                    <div className="bg-white rounded-xl p-4 border border-gray-200">
                                        <p className="text-sm text-gray-700">dry_run: <span className="font-mono">{String(!!result.dry_run)}</span></p>
                                        <p className="text-sm text-gray-700">tokens_targeted: <span className="font-mono">{result.data?.tokens_targeted ?? '-'}</span></p>
                                        {result.data?.sent_ok !== undefined && (
                                            <p className="text-sm text-gray-700">sent_ok: <span className="font-mono">{result.data.sent_ok}</span></p>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-600">הרץ Dry run כדי לראות כמה טוקנים יישלחו.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </SuperAdminLayout>
    );
}
