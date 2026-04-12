import { useState, useEffect, useCallback } from 'react';
import SuperAdminLayout from '../../layouts/SuperAdminLayout';
import { useAdminAuth } from '../../context/AdminAuthContext';
import api from '../../services/apiClient';
import {
    FaEnvelope, FaSearch, FaSpinner, FaChevronLeft, FaChevronRight,
    FaCheckCircle, FaTimesCircle, FaFilter
} from 'react-icons/fa';

const TYPE_LABELS = {
    email_verification: { text: 'אימות מייל לקוח', color: 'bg-blue-50 text-blue-700' },
    order_receipt: { text: 'אישור', color: 'bg-green-50 text-green-700' },
    order_cancelled: { text: 'ביטול הזמנה', color: 'bg-red-50 text-red-700' },
    welcome: { text: 'ברוכים הבאים (לקוח)', color: 'bg-purple-50 text-purple-700' },
    share: { text: 'שיתוף', color: 'bg-orange-50 text-orange-700' },
    restaurant_welcome: { text: 'הרשמת מסעדה', color: 'bg-teal-50 text-teal-700' },
    restaurant_approved: { text: 'אישור מסעדה', color: 'bg-emerald-50 text-emerald-700' },
    trial_info: { text: 'מידע תקופת ניסיון', color: 'bg-cyan-50 text-cyan-700' },
    trial_expiring: { text: 'סיום תקופת ניסיון', color: 'bg-amber-50 text-amber-700' },
    daily_report: { text: 'דוח יומי', color: 'bg-indigo-50 text-indigo-700' },
    monthly_report: { text: 'דוח חודשי', color: 'bg-violet-50 text-violet-700' },
    billing_invoice: { text: 'חשבונית', color: 'bg-pink-50 text-pink-700' },
    admin_notification: { text: 'התראה למנהל', color: 'bg-gray-100 text-gray-700' },
    bulk_email: { text: 'שליחה המונית', color: 'bg-rose-50 text-rose-700' },
    test_email: { text: 'מייל בדיקה', color: 'bg-slate-100 text-slate-700' },
};

export default function SuperAdminEmailLog({ embedded = false }) {
    const { getAuthHeaders } = useAdminAuth();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState({});
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page, per_page: 30 });
            if (search) params.set('search', search);
            if (typeFilter) params.set('type', typeFilter);
            if (statusFilter) params.set('status', statusFilter);
            if (dateFrom) params.set('date_from', dateFrom);
            if (dateTo) params.set('date_to', dateTo);

            const res = await api.get(`/super-admin/email-log?${params}`, { headers: getAuthHeaders() });
            if (res.data?.success) {
                setLogs(res.data.data.data || []);
                setMeta({ lastPage: res.data.data.last_page, total: res.data.data.total, currentPage: res.data.data.current_page });
            }
        } catch {}
        setLoading(false);
    }, [getAuthHeaders, page, search, typeFilter, statusFilter, dateFrom, dateTo]);

    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    const content = (
            <div className="space-y-6" dir="rtl">
                {!embedded && (
                <div>
                    <h1 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                        <div className="w-10 h-10 bg-violet-600 text-white rounded-xl flex items-center justify-center shadow-lg">
                            <FaEnvelope size={18} />
                        </div>
                        לוג מיילים
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">כל המיילים שנשלחו מהמערכת</p>
                </div>
                )}

                {/* Search & Filters */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
                    <div className="flex flex-wrap gap-3">
                        <div className="relative flex-1 min-w-[200px]">
                            <FaSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
                            <input
                                type="text"
                                placeholder="חפש לפי מייל או נושא..."
                                value={search}
                                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                                className="w-full pr-9 pl-3 py-2 text-sm border border-gray-200 rounded-xl focus:border-violet-500 focus:ring-1 focus:ring-violet-200 outline-none"
                            />
                        </div>
                        <select
                            value={typeFilter}
                            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
                            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-violet-500 outline-none"
                        >
                            <option value="">כל הסוגים</option>
                            {Object.entries(TYPE_LABELS).map(([key, val]) => (
                                <option key={key} value={key}>{val.text}</option>
                            ))}
                        </select>
                        <select
                            value={statusFilter}
                            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-violet-500 outline-none"
                        >
                            <option value="">כל הסטטוסים</option>
                            <option value="sent">נשלח</option>
                            <option value="failed">נכשל</option>
                        </select>
                    </div>
                    <div className="flex flex-wrap gap-3 items-center">
                        <span className="text-xs font-bold text-gray-400">טווח תאריכים:</span>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                            className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:border-violet-500 outline-none"
                            dir="ltr"
                        />
                        <span className="text-gray-400 text-xs">עד</span>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                            className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:border-violet-500 outline-none"
                            dir="ltr"
                        />
                        {(dateFrom || dateTo || statusFilter || typeFilter) && (
                            <button
                                onClick={() => { setDateFrom(''); setDateTo(''); setStatusFilter(''); setTypeFilter(''); setSearch(''); setPage(1); }}
                                className="text-xs font-bold text-violet-600 hover:underline"
                            >
                                נקה הכל
                            </button>
                        )}
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <FaSpinner className="animate-spin text-violet-600" size={24} />
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="text-center py-16">
                            <FaEnvelope className="mx-auto text-4xl text-gray-300 mb-3" />
                            <p className="text-gray-400 text-sm">אין רשומות</p>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-wider">
                                        <tr>
                                            <th className="text-right px-4 py-3">תאריך</th>
                                            <th className="text-right px-4 py-3">נמען</th>
                                            <th className="text-right px-4 py-3">לקוח</th>
                                            <th className="text-right px-4 py-3">סוג</th>
                                            <th className="text-right px-4 py-3">נושא</th>
                                            <th className="text-center px-4 py-3">סטטוס</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {logs.map(log => {
                                            const typeInfo = TYPE_LABELS[log.type] || { text: log.type, color: 'bg-gray-50 text-gray-600' };
                                            return (
                                                <tr key={log.id} className="hover:bg-gray-50/50">
                                                    <td className="px-4 py-3 text-xs text-gray-400">
                                                        {new Date(log.created_at).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                    </td>
                                                    <td className="px-4 py-3 text-gray-600" dir="ltr">{log.to_email}</td>
                                                    <td className="px-4 py-3 text-gray-600">
                                                        {log.customer?.name || '—'}
                                                        {log.customer?.phone && <span className="text-gray-400 text-xs mr-1" dir="ltr">{log.customer.phone}</span>}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${typeInfo.color}`}>
                                                            {typeInfo.text}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-gray-700 max-w-[200px] truncate">{log.subject}</td>
                                                    <td className="px-4 py-3 text-center">
                                                        {log.status === 'sent'
                                                            ? <FaCheckCircle className="text-green-500 mx-auto" size={14} />
                                                            : <FaTimesCircle className="text-red-500 mx-auto" size={14} title={log.error} />
                                                        }
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            {meta.lastPage > 1 && (
                                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                                    <p className="text-xs text-gray-400">עמוד {meta.currentPage} מתוך {meta.lastPage} ({meta.total} רשומות)</p>
                                    <div className="flex gap-1">
                                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30">
                                            <FaChevronRight size={12} />
                                        </button>
                                        <button onClick={() => setPage(p => Math.min(meta.lastPage, p + 1))} disabled={page >= meta.lastPage} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30">
                                            <FaChevronLeft size={12} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
    );

    if (embedded) return content;
    return <SuperAdminLayout>{content}</SuperAdminLayout>;
}
