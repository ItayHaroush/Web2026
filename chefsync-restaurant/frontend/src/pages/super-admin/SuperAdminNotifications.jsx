import { useEffect, useMemo, useState } from 'react';
import SuperAdminLayout from '../../layouts/SuperAdminLayout';
import { useAdminAuth } from '../../context/AdminAuthContext';
import api from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import {
    FaBell,
    FaPaperPlane,
    FaVial,
    FaUndo,
    FaSearch,
    FaStore,
    FaCheck,
    FaTimes,
    FaInfoCircle,
    FaBullseye,
    FaBoxOpen
} from 'react-icons/fa';

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
            <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-4">
                <div className="mb-8">
                    <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                        <div className="p-2 bg-brand-primary/10 rounded-lg">
                            <FaBell className="text-brand-primary" size={20} />
                        </div>
                        מרכז התראות PWA
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">שילוח הודעות Push למכשירי קצה מבוססי מסעדות</p>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                    {/* עמודה שמאלית - טופס ובחירה */}
                    <div className="xl:col-span-2 space-y-6">
                        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                            <h2 className="text-lg font-black text-gray-900 mb-6 flex items-center gap-2">
                                <FaPaperPlane className="text-brand-primary" size={16} />
                                פרטי ההודעה
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-black text-gray-500 mr-1 uppercase tracking-wider">כותרת ההתראה</label>
                                    <input
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-sm font-bold"
                                        placeholder="לדוגמה: עדכון מערכת חשוב"
                                        maxLength={80}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-black text-gray-500 mr-1 uppercase tracking-wider">תוכן ההודעה</label>
                                    <input
                                        value={body}
                                        onChange={(e) => setBody(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-sm font-medium"
                                        placeholder="לדוגמה: המערכת תבצע תחזוקה הלילה ב-02:00"
                                        maxLength={200}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                                <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                                    <FaBullseye className="text-brand-primary" size={16} />
                                    בחירת קהל יעד
                                </h2>
                                <div className="relative">
                                    <FaSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                                    <input
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        className="pr-9 pl-4 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-xs font-bold w-full md:w-64"
                                        placeholder="חפש מסעדה או מזהה..."
                                    />
                                </div>
                            </div>

                            <div className="mb-4 flex items-center justify-between px-2">
                                <span className="text-xs font-black text-brand-primary uppercase tracking-widest bg-brand-primary/5 px-3 py-1 rounded-lg">
                                    נבחרו: {selectedRestaurantIds.length} מסעדות
                                </span>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedRestaurantIds(filteredRestaurants.map((r) => r.id))}
                                        className="text-[10px] font-black uppercase px-3 py-1.5 rounded-lg border border-gray-100 hover:bg-gray-50 transition-all text-gray-500"
                                        disabled={loadingFilters}
                                    >
                                        בחר הכל
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedRestaurantIds([])}
                                        className="text-[10px] font-black uppercase px-3 py-1.5 rounded-lg border border-gray-100 hover:bg-gray-50 transition-all text-gray-500"
                                    >
                                        נקה
                                    </button>
                                </div>
                            </div>

                            <div className="border border-gray-50 rounded-2xl max-h-[400px] overflow-y-auto custom-scrollbar">
                                {loadingFilters ? (
                                    <div className="p-12 text-center text-gray-400">
                                        <div className="w-8 h-8 border-2 border-brand-primary/20 border-t-brand-primary rounded-full animate-spin mx-auto mb-3" />
                                        <p className="text-xs font-bold uppercase tracking-widest">טוען נתונים...</p>
                                    </div>
                                ) : filteredRestaurants.length === 0 ? (
                                    <div className="p-12 text-center text-gray-300">
                                        <FaSearch size={32} className="mx-auto mb-3 opacity-20" />
                                        <p className="text-xs font-bold uppercase tracking-widest">לא נמצאו מסעדות</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-gray-50">
                                        {filteredRestaurants.map((r) => {
                                            const checked = selectedRestaurantIds.includes(r.id);
                                            return (
                                                <label key={r.id} className={`flex items-center gap-4 p-4 cursor-pointer transition-all hover:bg-gray-50/80 ${checked ? 'bg-brand-primary/5' : ''}`}>
                                                    <div className={`w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center ${checked ? 'bg-brand-primary border-brand-primary shadow-sm shadow-brand-primary/20' : 'border-gray-200 bg-white'}`}>
                                                        {checked && <FaCheck className="text-white" size={10} />}
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="text-sm font-black text-gray-900 leading-none mb-1">{r.name}</p>
                                                        <p className="text-[10px] text-gray-400 font-mono tracking-wider">@{r.tenant_id}</p>
                                                    </div>
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={(e) => {
                                                            const next = e.target.checked
                                                                ? Array.from(new Set([...selectedRestaurantIds, r.id]))
                                                                : selectedRestaurantIds.filter((id) => id !== r.id);
                                                            setSelectedRestaurantIds(next);
                                                        }}
                                                        className="hidden"
                                                    />
                                                </label>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4">
                            <button
                                onClick={() => send(true)}
                                disabled={submitting || !title || !body || !selectedRestaurantIds.length}
                                className="flex-1 px-6 py-3.5 bg-gray-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all shadow-lg shadow-gray-200 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <FaVial size={14} />
                                בדיקת יעד (Dry run)
                            </button>
                            <button
                                onClick={() => send(false)}
                                disabled={submitting || !title || !body || !selectedRestaurantIds.length}
                                className="flex-2 px-6 py-3.5 bg-brand-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-brand-primary/95 transition-all shadow-lg shadow-brand-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {submitting ? (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <FaPaperPlane size={14} />
                                )}
                                שלח התראה ללקוחות
                            </button>
                            <button
                                onClick={() => {
                                    setSelectedRestaurantIds([]);
                                    setSearch('');
                                    setResult(null);
                                }}
                                className="px-6 py-3.5 bg-white border border-gray-200 text-gray-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                            >
                                <FaUndo size={14} />
                                אפס הכל
                            </button>
                        </div>
                    </div>

                    {/* עמודה ימנית - נתונים ותוצאות */}
                    <div className="space-y-6">
                        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                            <h2 className="text-lg font-black text-gray-900 mb-6 flex items-center gap-2">
                                <FaInfoCircle className="text-brand-primary" size={16} />
                                נתוני בסיס
                            </h2>
                            <div className="space-y-4">
                                <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between">
                                    <span className="text-xs font-bold text-gray-500 uppercase">מסעדות במאגר</span>
                                    <span className="text-sm font-black text-gray-900">{filtersData?.restaurants?.length || 0}</span>
                                </div>
                                <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between">
                                    <span className="text-xs font-bold text-gray-500 uppercase">ערים פעילות</span>
                                    <span className="text-sm font-black text-gray-900">{filtersData?.cities?.length || 0}</span>
                                </div>
                                <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between">
                                    <span className="text-xs font-bold text-gray-500 uppercase">סוגי מטבח</span>
                                    <span className="text-sm font-black text-gray-900">{filtersData?.cuisine_types?.length || 0}</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                            <h2 className="text-lg font-black text-gray-900 mb-6 flex items-center gap-2">
                                <FaBoxOpen className="text-brand-primary" size={16} />
                                סטטוס שליחה
                            </h2>
                            {result ? (
                                <div className="space-y-4">
                                    <div className={`p-4 rounded-2xl border ${result.dry_run ? 'bg-amber-50 border-amber-100' : 'bg-green-50 border-green-100'} transition-all`}>
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">משימת שידור</span>
                                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${result.dry_run ? 'bg-amber-200 text-amber-800' : 'bg-green-200 text-green-800'}`}>
                                                {result.dry_run ? 'בדיקת יעד' : 'שידור חי'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="flex-1">
                                                <p className="text-2xl font-black text-gray-900 leading-none">{result.data?.tokens_targeted ?? 0}</p>
                                                <p className="text-[10px] font-bold text-gray-500 uppercase mt-1">טוקנים שזוהו</p>
                                            </div>
                                            {!result.dry_run && (
                                                <div className="text-left">
                                                    <p className="text-2xl font-black text-green-600 leading-none">{result.data?.sent_ok ?? 0}</p>
                                                    <p className="text-[10px] font-bold text-gray-500 uppercase mt-1">בוצעו בהצלחה</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                        <p className="text-[11px] font-bold text-gray-400 uppercase mb-2 tracking-widest">תצוגה מקדימה</p>
                                        <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                                            <p className="text-xs font-black text-gray-900 mb-1">{title || 'כותרת ההתראה...'}</p>
                                            <p className="text-[10px] text-gray-500 font-medium leading-tight">{body || 'תוכן ההתראה יופיע כאן...'}</p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="py-8 text-center bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                                    <FaBell className="mx-auto mb-3 text-gray-200" size={32} />
                                    <p className="text-xs font-black text-gray-400 uppercase leading-relaxed px-6">ממתין לפעולת<br />שליחה או בדיקה</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </SuperAdminLayout>
    );
}
