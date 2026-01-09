import { useEffect, useMemo, useState } from 'react';
import SuperAdminLayout from '../../layouts/SuperAdminLayout';
import { useAdminAuth } from '../../context/AdminAuthContext';
import api from '../../services/apiClient';
import { toast } from 'react-hot-toast';

export default function SuperAdminNotifications() {
    const { getAuthHeaders } = useAdminAuth();

    const [loadingFilters, setLoadingFilters] = useState(true);
    const [filtersData, setFiltersData] = useState(null);

    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');

    const [search, setSearch] = useState('');
    const [selectedRestaurantIds, setSelectedRestaurantIds] = useState([]);

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

    const restaurants = useMemo(() => filtersData?.restaurants || [], [filtersData]);

    const filteredRestaurants = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return restaurants;
        return restaurants.filter((r) => {
            const name = String(r.name || '').toLowerCase();
            const tenant = String(r.tenant_id || '').toLowerCase();
            return name.includes(q) || tenant.includes(q);
        });
    }, [restaurants, search]);

    const buildFiltersPayload = () => {
        return {
            restaurant_ids: selectedRestaurantIds.map((id) => Number(id)).filter((n) => Number.isFinite(n)),
        };
    };

    const send = async (dryRun) => {
        setSubmitting(true);
        setResult(null);

        try {
            if (!selectedRestaurantIds.length) {
                toast.error('חובה לבחור לפחות מסעדה אחת');
                return;
            }

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
                    <p className="text-sm text-gray-600 mt-1">שליחת התראות לפי בחירת מסעדות בלבד (כדי למנוע טעויות שידור).</p>
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
                            <h2 className="font-bold text-gray-900 mb-3">🎯 בחירת מסעדות</h2>

                            <div className="mb-3">
                                <label className="block text-sm font-medium text-gray-700 mb-1">חיפוש</label>
                                <input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white"
                                    placeholder="חפש לפי שם מסעדה או tenant_id..."
                                />
                            </div>

                            <div className="flex items-center justify-between mb-2">
                                <p className="text-sm text-gray-600">נבחרו: {selectedRestaurantIds.length}</p>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedRestaurantIds(filteredRestaurants.map((r) => r.id))}
                                        className="text-sm px-3 py-1 rounded-lg bg-white border border-gray-200 hover:bg-gray-50"
                                        disabled={loadingFilters}
                                    >
                                        בחר הכל (מסונן)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedRestaurantIds([])}
                                        className="text-sm px-3 py-1 rounded-lg bg-white border border-gray-200 hover:bg-gray-50"
                                    >
                                        נקה
                                    </button>
                                </div>
                            </div>

                            <div className="bg-white border border-gray-200 rounded-xl max-h-[360px] overflow-auto">
                                {loadingFilters ? (
                                    <p className="p-3 text-sm text-gray-600">טוען מסעדות...</p>
                                ) : filteredRestaurants.length === 0 ? (
                                    <p className="p-3 text-sm text-gray-600">לא נמצאו מסעדות.</p>
                                ) : (
                                    <div className="divide-y">
                                        {filteredRestaurants.map((r) => {
                                            const checked = selectedRestaurantIds.includes(r.id);
                                            return (
                                                <label key={r.id} className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50">
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={(e) => {
                                                            const next = e.target.checked
                                                                ? Array.from(new Set([...selectedRestaurantIds, r.id]))
                                                                : selectedRestaurantIds.filter((id) => id !== r.id);
                                                            setSelectedRestaurantIds(next);
                                                        }}
                                                    />
                                                    <div className="flex-1">
                                                        <p className="text-sm font-medium text-gray-900">{r.name}</p>
                                                        <p className="text-xs text-gray-500">{r.tenant_id}</p>
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <div className="mt-4 flex flex-col sm:flex-row gap-3">
                                <button
                                    onClick={() => send(true)}
                                    disabled={submitting || !title || !body || !selectedRestaurantIds.length}
                                    className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50"
                                >
                                    {submitting ? 'טוען...' : 'בדיקת יעד (Dry run)'}
                                </button>
                                <button
                                    onClick={() => send(false)}
                                    disabled={submitting || !title || !body || !selectedRestaurantIds.length}
                                    className="px-4 py-2 rounded-lg bg-brand-primary text-white hover:bg-brand-primary/90 disabled:opacity-50"
                                >
                                    {submitting ? 'שולח...' : 'שלח התראה'}
                                </button>
                                <button
                                    onClick={() => {
                                        setSelectedRestaurantIds([]);
                                        setSearch('');
                                        setResult(null);
                                    }}
                                    className="px-4 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50"
                                >
                                    נקה בחירה
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
