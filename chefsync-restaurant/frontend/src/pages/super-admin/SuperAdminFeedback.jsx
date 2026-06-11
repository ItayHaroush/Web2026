import { useState, useEffect, useCallback } from 'react';
import SuperAdminLayout from '../../layouts/SuperAdminLayout';
import { useAdminAuth } from '../../context/AdminAuthContext';
import api from '../../services/apiClient';
import RatingWidget from '../../components/RatingWidget';
import toast from 'react-hot-toast';
import {
    FaCommentDots,
    FaSearch,
    FaTrash,
    FaChevronRight,
    FaChevronLeft,
    FaStickyNote,
} from 'react-icons/fa';

const CATEGORY_LABELS = {
    general: 'כללי',
    idea: 'רעיון לשיפור',
    bug: 'תקלה',
    complaint: 'תלונה',
    praise: 'מחמאה',
};

const CATEGORY_COLORS = {
    general: 'bg-gray-100 text-gray-700',
    idea: 'bg-blue-100 text-blue-700',
    bug: 'bg-red-100 text-red-700',
    complaint: 'bg-orange-100 text-orange-700',
    praise: 'bg-green-100 text-green-700',
};

const STATUS_LABELS = {
    new: 'חדש',
    in_review: 'בטיפול',
    resolved: 'טופל',
};

const STATUS_COLORS = {
    new: 'bg-amber-100 text-amber-800 border-amber-300',
    in_review: 'bg-blue-100 text-blue-800 border-blue-300',
    resolved: 'bg-green-100 text-green-800 border-green-300',
};

export default function SuperAdminFeedback() {
    const { getAuthHeaders } = useAdminAuth();
    const [items, setItems] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [notesEditing, setNotesEditing] = useState(null); // { id, notes }

    const fetchFeedback = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page) });
            if (statusFilter) params.set('status', statusFilter);
            if (categoryFilter) params.set('category', categoryFilter);
            if (search) params.set('search', search);

            const res = await api.get(`/super-admin/feedback?${params}`, { headers: getAuthHeaders() });
            if (res.data?.success) {
                setItems(res.data.data?.data || []);
                setLastPage(res.data.data?.last_page || 1);
                setStats(res.data.stats || null);
            }
        } catch (e) {
            console.error('שגיאה בטעינת משובים:', e);
            toast.error('שגיאה בטעינת משובים');
        } finally {
            setLoading(false);
        }
    }, [getAuthHeaders, page, statusFilter, categoryFilter, search]);

    useEffect(() => { fetchFeedback(); }, [fetchFeedback]);

    const handleSearch = (e) => {
        e.preventDefault();
        setPage(1);
        setSearch(searchInput.trim());
    };

    const updateStatus = async (item, status) => {
        try {
            const res = await api.patch(`/super-admin/feedback/${item.id}`, { status }, { headers: getAuthHeaders() });
            if (res.data?.success) {
                setItems((prev) => prev.map((f) => (f.id === item.id ? res.data.data : f)));
                toast.success('הסטטוס עודכן');
                fetchFeedback();
            }
        } catch {
            toast.error('שגיאה בעדכון סטטוס');
        }
    };

    const saveNotes = async () => {
        if (!notesEditing) return;
        try {
            const res = await api.patch(
                `/super-admin/feedback/${notesEditing.id}`,
                { admin_notes: notesEditing.notes },
                { headers: getAuthHeaders() }
            );
            if (res.data?.success) {
                setItems((prev) => prev.map((f) => (f.id === notesEditing.id ? res.data.data : f)));
                setNotesEditing(null);
                toast.success('ההערות נשמרו');
            }
        } catch {
            toast.error('שגיאה בשמירת הערות');
        }
    };

    const deleteFeedback = async (id) => {
        if (!window.confirm('למחוק את המשוב לצמיתות?')) return;
        try {
            await api.delete(`/super-admin/feedback/${id}`, { headers: getAuthHeaders() });
            toast.success('המשוב נמחק');
            fetchFeedback();
        } catch {
            toast.error('שגיאה במחיקה');
        }
    };

    const formatDate = (iso) => {
        if (!iso) return '—';
        return new Date(iso).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });
    };

    return (
        <SuperAdminLayout>
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <FaCommentDots className="text-2xl text-brand-primary" />
                    <h1 className="text-2xl font-black text-slate-800">משוב משתמשים</h1>
                </div>

                {/* כרטיסי סיכום */}
                {stats && (
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        <StatCard label="סה״כ משובים" value={stats.total} />
                        <StatCard label="חדשים" value={stats.new} accent="text-amber-600" />
                        <StatCard label="בטיפול" value={stats.in_review} accent="text-blue-600" />
                        <StatCard label="טופלו" value={stats.resolved} accent="text-green-600" />
                        <StatCard label="דירוג ממוצע" value={stats.avg_rating ? `${stats.avg_rating} / 5` : '—'} accent="text-pink-600" />
                    </div>
                )}

                {/* פילטרים */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 flex flex-wrap items-center gap-3">
                    <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 min-w-[200px]">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                placeholder="חיפוש לפי תוכן, שם או טלפון..."
                                className="w-full rounded-lg border border-slate-200 pr-9 pl-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                            />
                            <FaSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
                        </div>
                        <button type="submit" className="bg-brand-primary text-white text-sm font-bold rounded-lg px-4 py-2 hover:opacity-90 transition">
                            חפש
                        </button>
                    </form>

                    <select
                        value={statusFilter}
                        onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
                    >
                        <option value="">כל הסטטוסים</option>
                        {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>

                    <select
                        value={categoryFilter}
                        onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
                    >
                        <option value="">כל הקטגוריות</option>
                        {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                </div>

                {/* רשימת משובים */}
                {loading ? (
                    <div className="text-center py-16 text-slate-400">טוען משובים...</div>
                ) : items.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-100 py-16 text-center text-slate-400">
                        <FaCommentDots className="mx-auto text-4xl mb-3 opacity-30" />
                        אין משובים להצגה
                    </div>
                ) : (
                    <div className="space-y-3">
                        {items.map((item) => (
                            <div key={item.id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 sm:p-5">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${CATEGORY_COLORS[item.category] || CATEGORY_COLORS.general}`}>
                                            {CATEGORY_LABELS[item.category] || item.category}
                                        </span>
                                        {item.rating && (
                                            <span className="scale-75 origin-right">
                                                <RatingWidget value={item.rating} readOnly size="sm" />
                                            </span>
                                        )}
                                        <span className="text-xs text-slate-400">{formatDate(item.created_at)}</span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <select
                                            value={item.status}
                                            onChange={(e) => updateStatus(item, e.target.value)}
                                            className={`text-xs font-bold rounded-lg border px-2 py-1.5 ${STATUS_COLORS[item.status] || ''}`}
                                        >
                                            {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                        </select>
                                        <button
                                            type="button"
                                            onClick={() => setNotesEditing({ id: item.id, notes: item.admin_notes || '' })}
                                            className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
                                            title="הערות פנימיות"
                                        >
                                            <FaStickyNote size={14} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => deleteFeedback(item.id)}
                                            className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                                            title="מחיקה"
                                        >
                                            <FaTrash size={14} />
                                        </button>
                                    </div>
                                </div>

                                <p className="mt-3 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{item.message}</p>

                                <div className="mt-3 pt-3 border-t border-slate-50 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                                    <span className="font-bold text-slate-600">{item.customer?.name || 'לקוח לא ידוע'}</span>
                                    {item.customer?.phone && <span dir="ltr">{item.customer.phone}</span>}
                                    {item.customer?.total_orders != null && <span>{item.customer.total_orders} הזמנות</span>}
                                    {item.page_url && <span className="text-slate-400" dir="ltr">{item.page_url}</span>}
                                    {item.handler?.name && (
                                        <span className="text-slate-400">טופל ע״י {item.handler.name}</span>
                                    )}
                                </div>

                                {item.admin_notes && (
                                    <div className="mt-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs text-amber-800 flex items-start gap-2">
                                        <FaStickyNote className="mt-0.5 shrink-0" />
                                        <span className="whitespace-pre-wrap">{item.admin_notes}</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* עימוד */}
                {lastPage > 1 && (
                    <div className="flex items-center justify-center gap-3">
                        <button
                            type="button"
                            disabled={page <= 1}
                            onClick={() => setPage((p) => p - 1)}
                            className="p-2 rounded-lg border border-slate-200 text-slate-500 disabled:opacity-40 hover:bg-slate-50 transition"
                            aria-label="עמוד קודם"
                        >
                            <FaChevronRight size={14} />
                        </button>
                        <span className="text-sm text-slate-600 font-bold">{page} / {lastPage}</span>
                        <button
                            type="button"
                            disabled={page >= lastPage}
                            onClick={() => setPage((p) => p + 1)}
                            className="p-2 rounded-lg border border-slate-200 text-slate-500 disabled:opacity-40 hover:bg-slate-50 transition"
                            aria-label="עמוד הבא"
                        >
                            <FaChevronLeft size={14} />
                        </button>
                    </div>
                )}
            </div>

            {/* מודל הערות פנימיות */}
            {notesEditing && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" dir="rtl">
                    <button
                        type="button"
                        className="absolute inset-0 bg-black/50"
                        aria-label="סגור"
                        onClick={() => setNotesEditing(null)}
                    />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4">
                        <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                            <FaStickyNote className="text-amber-500" />
                            הערות פנימיות
                        </h3>
                        <textarea
                            value={notesEditing.notes}
                            onChange={(e) => setNotesEditing((prev) => ({ ...prev, notes: e.target.value }))}
                            rows={4}
                            maxLength={2000}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/40 resize-none"
                            placeholder="הערות לצוות (לא נראה ללקוח)..."
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setNotesEditing(null)}
                                className="px-4 py-2 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition"
                            >
                                ביטול
                            </button>
                            <button
                                type="button"
                                onClick={saveNotes}
                                className="px-5 py-2 rounded-xl text-sm font-black bg-brand-primary text-white hover:opacity-90 transition"
                            >
                                שמירה
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </SuperAdminLayout>
    );
}

function StatCard({ label, value, accent = 'text-slate-800' }) {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 text-center">
            <p className={`text-2xl font-black ${accent}`}>{value}</p>
            <p className="text-xs text-slate-500 mt-1 font-bold">{label}</p>
        </div>
    );
}
