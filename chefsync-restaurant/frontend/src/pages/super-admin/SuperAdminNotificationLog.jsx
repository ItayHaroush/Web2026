import { useEffect, useState, useCallback } from 'react';
import SuperAdminLayout from '../../layouts/SuperAdminLayout';
import api from '../../services/apiClient';
import { useAdminAuth } from '../../context/AdminAuthContext';
import {
    FaHistory,
    FaPaperPlane,
    FaCheck,
    FaTimes,
    FaChevronRight,
    FaChevronLeft,
    FaStore,
} from 'react-icons/fa';

export default function SuperAdminNotificationLog() {
    const { getAuthHeaders } = useAdminAuth();
    const [logs, setLogs] = useState([]);
    const [pagination, setPagination] = useState({ current_page: 1, last_page: 1 });
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);

    const fetchLogs = useCallback(async (p) => {
        setLoading(true);
        try {
            const res = await api.get('/super-admin/notifications/log', {
                headers: getAuthHeaders(),
                params: { page: p, per_page: 20 },
            });
            if (res.data?.success) {
                setLogs(res.data.data?.data || []);
                setPagination({
                    current_page: res.data.data?.current_page || 1,
                    last_page: res.data.data?.last_page || 1,
                });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [getAuthHeaders]);

    useEffect(() => {
        fetchLogs(page);
    }, [page, fetchLogs]);

    return (
        <SuperAdminLayout>
            <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-4">
                <div className="mb-8">
                    <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                        <div className="p-2 bg-brand-primary/10 rounded-lg">
                            <FaHistory className="text-brand-primary" size={20} />
                        </div>
                        לוג התראות
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">היסטוריית כל ההתראות שנשלחו מהמערכת</p>
                </div>

                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                    {/* Table header */}
                    <div className="hidden md:grid grid-cols-12 gap-2 px-6 py-3 bg-gray-50 border-b border-gray-100 text-[10px] font-black uppercase tracking-widest text-gray-500">
                        <div className="col-span-2">תאריך</div>
                        <div className="col-span-3">כותרת</div>
                        <div className="col-span-3">תוכן</div>
                        <div className="col-span-2">יעד</div>
                        <div className="col-span-1">נשלח</div>
                        <div className="col-span-1">סטטוס</div>
                    </div>

                    {loading ? (
                        <div className="p-12 text-center text-gray-400">
                            <div className="w-8 h-8 border-2 border-brand-primary/20 border-t-brand-primary rounded-full animate-spin mx-auto mb-3" />
                            <p className="text-xs font-bold uppercase tracking-widest">טוען...</p>
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="p-12 text-center text-gray-300">
                            <FaPaperPlane size={32} className="mx-auto mb-3 opacity-20" />
                            <p className="text-xs font-bold uppercase tracking-widest">אין לוגים</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {logs.map((log) => (
                                <div key={log.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 px-6 py-4 hover:bg-gray-50/50 transition-colors items-start">
                                    <div className="col-span-2 text-xs text-gray-500">
                                        {new Date(log.created_at).toLocaleString('he-IL')}
                                    </div>
                                    <div className="col-span-3">
                                        <p className="text-sm font-bold text-gray-900 truncate">{log.title}</p>
                                        <p className="text-[10px] text-gray-400 font-mono">{log.channel} · {log.type}</p>
                                    </div>
                                    <div className="col-span-3 text-xs text-gray-600 line-clamp-2">{log.body}</div>
                                    <div className="col-span-2 text-xs text-gray-500 flex items-center gap-1">
                                        <FaStore size={10} className="text-gray-400" />
                                        {log.target_restaurant_ids?.length || 0} מסעדות
                                    </div>
                                    <div className="col-span-1 text-xs font-bold text-gray-700">
                                        {log.sent_ok}/{log.tokens_targeted}
                                    </div>
                                    <div className="col-span-1">
                                        {log.sent_ok > 0 ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-50 text-green-600 text-[10px] font-bold">
                                                <FaCheck size={8} /> נשלח
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-50 text-red-600 text-[10px] font-bold">
                                                <FaTimes size={8} /> נכשל
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Pagination */}
                    {pagination.last_page > 1 && (
                        <div className="flex items-center justify-center gap-4 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
                            <button
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={pagination.current_page <= 1}
                                className="p-2 rounded-lg border border-gray-200 hover:bg-white disabled:opacity-30 transition-colors"
                            >
                                <FaChevronRight size={12} />
                            </button>
                            <span className="text-xs font-bold text-gray-600">
                                עמוד {pagination.current_page} מתוך {pagination.last_page}
                            </span>
                            <button
                                onClick={() => setPage((p) => Math.min(pagination.last_page, p + 1))}
                                disabled={pagination.current_page >= pagination.last_page}
                                className="p-2 rounded-lg border border-gray-200 hover:bg-white disabled:opacity-30 transition-colors"
                            >
                                <FaChevronLeft size={12} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </SuperAdminLayout>
    );
}
