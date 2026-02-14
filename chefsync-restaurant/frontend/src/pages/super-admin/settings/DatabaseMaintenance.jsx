import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import SuperAdminLayout from '../../../layouts/SuperAdminLayout';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import api from '../../../services/apiClient';
import { toast } from 'react-hot-toast';
import {
    FaDatabase,
    FaArrowRight,
    FaSpinner,
    FaDownload,
    FaTrashAlt,
    FaCogs,
    FaTable,
    FaExclamationTriangle,
    FaCheckCircle,
    FaClock,
    FaTimes,
    FaHdd,
    FaBug
} from 'react-icons/fa';

export default function DatabaseMaintenance() {
    const { getAuthHeaders } = useAdminAuth();
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState(null);
    const [actionLoading, setActionLoading] = useState(null);

    // Modal states
    const [showBackupModal, setShowBackupModal] = useState(false);
    const [showClearLogsModal, setShowClearLogsModal] = useState(false);
    const [showOptimizeModal, setShowOptimizeModal] = useState(false);

    // Clear logs form
    const [clearLogsDays, setClearLogsDays] = useState(30);
    const [clearLogsTables, setClearLogsTables] = useState({
        order_events: true,
        system_errors: true,
        ai_usage_logs: true
    });

    useEffect(() => {
        fetchStatus();
    }, []);

    const fetchStatus = async () => {
        try {
            const response = await api.get('/super-admin/database/status', {
                headers: getAuthHeaders()
            });
            if (response.data.success) {
                setStatus(response.data.data || response.data);
            }
        } catch (error) {
            console.error('Failed to load database status:', error);
            toast.error('שגיאה בטעינת סטטוס בסיס הנתונים');
        } finally {
            setLoading(false);
        }
    };

    const handleBackup = async () => {
        setActionLoading('backup');
        try {
            const response = await api.post('/super-admin/database/backup', {}, {
                headers: getAuthHeaders()
            });
            if (response.data.success) {
                toast.success('גיבוי בוצע בהצלחה');
                setShowBackupModal(false);
                fetchStatus();
            }
        } catch (error) {
            console.error('Backup failed:', error);
            toast.error(error.response?.data?.message || 'שגיאה בביצוע גיבוי');
        } finally {
            setActionLoading(null);
        }
    };

    const handleClearLogs = async () => {
        const tables = Object.entries(clearLogsTables)
            .filter(([, checked]) => checked)
            .map(([table]) => table);

        if (tables.length === 0) {
            toast.error('יש לבחור לפחות טבלה אחת');
            return;
        }

        setActionLoading('clear-logs');
        try {
            const response = await api.post('/super-admin/database/clear-logs', {
                days: clearLogsDays,
                tables
            }, {
                headers: getAuthHeaders()
            });
            if (response.data.success) {
                toast.success('הלוגים נוקו בהצלחה');
                setShowClearLogsModal(false);
                fetchStatus();
            }
        } catch (error) {
            console.error('Clear logs failed:', error);
            toast.error(error.response?.data?.message || 'שגיאה בניקוי לוגים');
        } finally {
            setActionLoading(null);
        }
    };

    const handleOptimize = async () => {
        setActionLoading('optimize');
        try {
            const response = await api.post('/super-admin/database/optimize', {}, {
                headers: getAuthHeaders()
            });
            if (response.data.success) {
                toast.success('אופטימיזציה בוצעה בהצלחה');
                setShowOptimizeModal(false);
                fetchStatus();
            }
        } catch (error) {
            console.error('Optimize failed:', error);
            toast.error(error.response?.data?.message || 'שגיאה באופטימיזציה');
        } finally {
            setActionLoading(null);
        }
    };

    const toggleTable = (table) => {
        setClearLogsTables(prev => ({ ...prev, [table]: !prev[table] }));
    };

    const tableLabels = {
        order_events: 'אירועי הזמנות',
        system_errors: 'שגיאות מערכת',
        ai_usage_logs: 'לוגי שימוש AI'
    };

    if (loading) {
        return (
            <SuperAdminLayout>
                <div className="flex items-center justify-center min-h-[60vh]">
                    <FaSpinner className="animate-spin text-brand-primary" size={32} />
                </div>
            </SuperAdminLayout>
        );
    }

    return (
        <SuperAdminLayout>
            <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-4">
                {/* Back link */}
                <Link
                    to="/super-admin/settings"
                    className="inline-flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-brand-primary transition-colors mb-6"
                >
                    <FaArrowRight size={12} />
                    חזרה להגדרות
                </Link>

                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                        <div className="p-2.5 bg-brand-primary/10 rounded-xl">
                            <FaDatabase className="text-brand-primary" size={20} />
                        </div>
                        תחזוקת בסיס נתונים
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">גיבויים, ניקוי לוגים ואופטימיזציה של טבלאות</p>
                </div>

                {/* Status Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
                        <div className="flex items-center justify-between mb-3">
                            <div className="p-2 bg-blue-50 rounded-lg">
                                <FaTable className="text-blue-500" size={14} />
                            </div>
                        </div>
                        <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">טבלאות</p>
                        <p className="text-2xl font-black text-gray-900">{status?.table_count ?? '-'}</p>
                    </div>

                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
                        <div className="flex items-center justify-between mb-3">
                            <div className="p-2 bg-amber-50 rounded-lg">
                                <FaClock className="text-amber-500" size={14} />
                            </div>
                        </div>
                        <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">ממתינים בתור</p>
                        <p className="text-2xl font-black text-gray-900">{status?.queue_pending ?? '-'}</p>
                    </div>

                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
                        <div className="flex items-center justify-between mb-3">
                            <div className="p-2 bg-red-50 rounded-lg">
                                <FaExclamationTriangle className="text-red-500" size={14} />
                            </div>
                        </div>
                        <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">נכשלו בתור</p>
                        <p className="text-2xl font-black text-red-600">{status?.queue_failed ?? '-'}</p>
                    </div>

                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
                        <div className="flex items-center justify-between mb-3">
                            <div className="p-2 bg-orange-50 rounded-lg">
                                <FaBug className="text-orange-500" size={14} />
                            </div>
                        </div>
                        <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">שגיאות פתוחות</p>
                        <p className="text-2xl font-black text-orange-600">{status?.unresolved_errors ?? '-'}</p>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Backup */}
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 flex flex-col">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2.5 bg-blue-50 rounded-xl">
                                <FaDownload className="text-blue-500" size={16} />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-gray-900">גיבוי נתונים</h3>
                                <p className="text-[10px] text-gray-400 font-bold">יצירת גיבוי מלא של בסיס הנתונים</p>
                            </div>
                        </div>
                        {status?.last_backup && (
                            <p className="text-[10px] text-gray-400 mb-3 flex items-center gap-1">
                                <FaClock size={8} />
                                גיבוי אחרון: {new Date(status.last_backup).toLocaleDateString('he-IL')}
                            </p>
                        )}
                        <div className="mt-auto">
                            <button
                                onClick={() => setShowBackupModal(true)}
                                className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-wider hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                            >
                                <FaDownload size={12} />
                                הפעל גיבוי
                            </button>
                        </div>
                    </div>

                    {/* Clear Logs */}
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 flex flex-col">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2.5 bg-amber-50 rounded-xl">
                                <FaTrashAlt className="text-amber-500" size={16} />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-gray-900">ניקוי לוגים</h3>
                                <p className="text-[10px] text-gray-400 font-bold">מחיקת רשומות ישנות מטבלאות לוג</p>
                            </div>
                        </div>
                        <p className="text-[10px] text-gray-400 mb-3">
                            ניקוי לוגים ישנים יכול לשפר ביצועים ולפנות שטח אחסון
                        </p>
                        <div className="mt-auto">
                            <button
                                onClick={() => setShowClearLogsModal(true)}
                                className="w-full px-4 py-2.5 bg-amber-600 text-white rounded-xl font-black text-xs uppercase tracking-wider hover:bg-amber-700 transition-all flex items-center justify-center gap-2"
                            >
                                <FaTrashAlt size={12} />
                                נקה לוגים
                            </button>
                        </div>
                    </div>

                    {/* Optimize */}
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 flex flex-col">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2.5 bg-green-50 rounded-xl">
                                <FaCogs className="text-green-500" size={16} />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-gray-900">אופטימיזציה</h3>
                                <p className="text-[10px] text-gray-400 font-bold">אופטימיזציה ותיקון טבלאות</p>
                            </div>
                        </div>
                        <p className="text-[10px] text-gray-400 mb-3">
                            ביצוע OPTIMIZE TABLE ו-ANALYZE לשיפור ביצועי שאילתות
                        </p>
                        <div className="mt-auto">
                            <button
                                onClick={() => setShowOptimizeModal(true)}
                                className="w-full px-4 py-2.5 bg-green-600 text-white rounded-xl font-black text-xs uppercase tracking-wider hover:bg-green-700 transition-all flex items-center justify-center gap-2"
                            >
                                <FaCogs size={12} />
                                הפעל אופטימיזציה
                            </button>
                        </div>
                    </div>
                </div>

                {/* ====== MODALS ====== */}

                {/* Backup Confirmation Modal */}
                {showBackupModal && (
                    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-white/20 overflow-hidden">
                            <div className="p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 bg-blue-100 rounded-xl">
                                            <FaDownload className="text-blue-600" size={20} />
                                        </div>
                                        <h3 className="text-lg font-black text-gray-900">אישור גיבוי</h3>
                                    </div>
                                    <button
                                        onClick={() => setShowBackupModal(false)}
                                        className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-gray-600 transition-all"
                                    >
                                        <FaTimes size={16} />
                                    </button>
                                </div>

                                <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 mb-6">
                                    <p className="text-sm text-blue-800 font-bold leading-relaxed">
                                        פעולה זו תיצור גיבוי מלא של בסיס הנתונים. הגיבוי עשוי לקחת מספר דקות בהתאם לגודל הנתונים.
                                    </p>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowBackupModal(false)}
                                        className="flex-1 px-4 py-3 border border-gray-200 text-gray-600 rounded-2xl hover:bg-gray-50 transition-all font-black text-xs uppercase tracking-wider"
                                    >
                                        ביטול
                                    </button>
                                    <button
                                        onClick={handleBackup}
                                        disabled={actionLoading === 'backup'}
                                        className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all font-black text-xs uppercase tracking-wider disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {actionLoading === 'backup' ? (
                                            <>
                                                <FaSpinner className="animate-spin" size={12} />
                                                מגבה...
                                            </>
                                        ) : (
                                            <>
                                                <FaDownload size={12} />
                                                הפעל גיבוי
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Clear Logs Confirmation Modal */}
                {showClearLogsModal && (
                    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-white/20 overflow-hidden">
                            <div className="p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 bg-red-100 rounded-xl">
                                            <FaTrashAlt className="text-red-600" size={20} />
                                        </div>
                                        <h3 className="text-lg font-black text-gray-900">ניקוי לוגים</h3>
                                    </div>
                                    <button
                                        onClick={() => setShowClearLogsModal(false)}
                                        className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-gray-600 transition-all"
                                    >
                                        <FaTimes size={16} />
                                    </button>
                                </div>

                                <div className="bg-red-50 rounded-xl p-4 border border-red-100 mb-6">
                                    <div className="flex items-start gap-2">
                                        <FaExclamationTriangle className="text-red-500 mt-0.5 shrink-0" size={14} />
                                        <p className="text-sm text-red-800 font-bold leading-relaxed">
                                            פעולה זו תמחק רשומות לוג באופן בלתי הפיך. ודא שביצעת גיבוי לפני הניקוי.
                                        </p>
                                    </div>
                                </div>

                                {/* Days Input */}
                                <div className="space-y-2 mb-4">
                                    <label className="text-xs font-black text-gray-500 uppercase tracking-wider">
                                        מחק רשומות ישנות מ- (ימים)
                                    </label>
                                    <input
                                        type="number"
                                        value={clearLogsDays}
                                        onChange={(e) => setClearLogsDays(Number(e.target.value))}
                                        min="1"
                                        max="365"
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-red-200 focus:border-red-300 outline-none transition-all text-sm font-medium"
                                    />
                                </div>

                                {/* Table Checkboxes */}
                                <div className="space-y-2 mb-6">
                                    <label className="text-xs font-black text-gray-500 uppercase tracking-wider">
                                        טבלאות לניקוי
                                    </label>
                                    <div className="space-y-2">
                                        {Object.entries(tableLabels).map(([key, label]) => (
                                            <label
                                                key={key}
                                                className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 cursor-pointer hover:bg-gray-100 transition-all"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={clearLogsTables[key]}
                                                    onChange={() => toggleTable(key)}
                                                    className="w-4 h-4 rounded border-gray-300 text-red-500 focus:ring-red-500 transition-all cursor-pointer"
                                                />
                                                <span className="text-sm font-bold text-gray-700">{label}</span>
                                                <span className="text-[10px] font-mono text-gray-400 mr-auto">{key}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowClearLogsModal(false)}
                                        className="flex-1 px-4 py-3 border border-gray-200 text-gray-600 rounded-2xl hover:bg-gray-50 transition-all font-black text-xs uppercase tracking-wider"
                                    >
                                        ביטול
                                    </button>
                                    <button
                                        onClick={handleClearLogs}
                                        disabled={actionLoading === 'clear-logs'}
                                        className="flex-1 px-4 py-3 bg-red-600 text-white rounded-2xl hover:bg-red-700 transition-all font-black text-xs uppercase tracking-wider disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {actionLoading === 'clear-logs' ? (
                                            <>
                                                <FaSpinner className="animate-spin" size={12} />
                                                מנקה...
                                            </>
                                        ) : (
                                            <>
                                                <FaTrashAlt size={12} />
                                                מחק לוגים
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Optimize Confirmation Modal */}
                {showOptimizeModal && (
                    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-white/20 overflow-hidden">
                            <div className="p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 bg-red-100 rounded-xl">
                                            <FaCogs className="text-red-600" size={20} />
                                        </div>
                                        <h3 className="text-lg font-black text-gray-900">אישור אופטימיזציה</h3>
                                    </div>
                                    <button
                                        onClick={() => setShowOptimizeModal(false)}
                                        className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-gray-600 transition-all"
                                    >
                                        <FaTimes size={16} />
                                    </button>
                                </div>

                                <div className="bg-red-50 rounded-xl p-4 border border-red-100 mb-6">
                                    <div className="flex items-start gap-2">
                                        <FaExclamationTriangle className="text-red-500 mt-0.5 shrink-0" size={14} />
                                        <p className="text-sm text-red-800 font-bold leading-relaxed">
                                            פעולת אופטימיזציה עלולה לנעול טבלאות באופן זמני. מומלץ להפעיל בשעות של תעבורה נמוכה.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowOptimizeModal(false)}
                                        className="flex-1 px-4 py-3 border border-gray-200 text-gray-600 rounded-2xl hover:bg-gray-50 transition-all font-black text-xs uppercase tracking-wider"
                                    >
                                        ביטול
                                    </button>
                                    <button
                                        onClick={handleOptimize}
                                        disabled={actionLoading === 'optimize'}
                                        className="flex-1 px-4 py-3 bg-red-600 text-white rounded-2xl hover:bg-red-700 transition-all font-black text-xs uppercase tracking-wider disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {actionLoading === 'optimize' ? (
                                            <>
                                                <FaSpinner className="animate-spin" size={12} />
                                                מבצע...
                                            </>
                                        ) : (
                                            <>
                                                <FaCogs size={12} />
                                                הפעל אופטימיזציה
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </SuperAdminLayout>
    );
}
