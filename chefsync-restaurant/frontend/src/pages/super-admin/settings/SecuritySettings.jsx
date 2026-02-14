import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import SuperAdminLayout from '../../../layouts/SuperAdminLayout';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import api from '../../../services/apiClient';
import { toast } from 'react-hot-toast';
import {
    FaLock,
    FaArrowRight,
    FaSave,
    FaSpinner,
    FaShieldAlt,
    FaExclamationTriangle,
    FaCheckCircle,
    FaTimesCircle,
    FaClock
} from 'react-icons/fa';

export default function SecuritySettings() {
    const { getAuthHeaders } = useAdminAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [auditLogs, setAuditLogs] = useState([]);
    const [logsLoading, setLogsLoading] = useState(true);
    const [form, setForm] = useState({
        rate_limit_per_minute: '60',
        ip_whitelist: '',
        session_timeout_minutes: '30'
    });

    useEffect(() => {
        fetchSettings();
        fetchAuditLogs();
    }, []);

    const fetchSettings = async () => {
        try {
            const response = await api.get('/super-admin/settings/security', {
                headers: getAuthHeaders()
            });
            if (response.data.success) {
                const settings = {};
                (response.data.data || response.data.settings || []).forEach(s => {
                    settings[s.key] = s.value;
                });
                setForm(prev => ({ ...prev, ...settings }));
            }
        } catch (error) {
            console.error('Failed to load security settings:', error);
            toast.error('שגיאה בטעינת הגדרות אבטחה');
        } finally {
            setLoading(false);
        }
    };

    const fetchAuditLogs = async () => {
        try {
            const response = await api.get('/super-admin/audit-log', {
                headers: getAuthHeaders(),
                params: { limit: 20 }
            });
            if (response.data.success) {
                const logs = response.data.data;
                setAuditLogs(Array.isArray(logs) ? logs : logs?.data || []);
            }
        } catch (error) {
            console.error('Failed to load audit logs:', error);
        } finally {
            setLogsLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const typeMap = {
                rate_limit_per_minute: 'integer',
                ip_whitelist: 'string',
                session_timeout_minutes: 'integer'
            };

            const settings = Object.entries(form).map(([key, value]) => ({
                key,
                value: String(value),
                type: typeMap[key] || 'string',
                group: 'security'
            }));

            const response = await api.post('/super-admin/settings', { settings }, {
                headers: getAuthHeaders()
            });

            if (response.data.success) {
                toast.success('הגדרות אבטחה נשמרו בהצלחה');
            }
        } catch (error) {
            console.error('Failed to save security settings:', error);
            toast.error(error.response?.data?.message || 'שגיאה בשמירת ההגדרות');
        } finally {
            setSaving(false);
        }
    };

    const getSeverityBadge = (severity) => {
        const styles = {
            critical: 'bg-red-100 text-red-700 border-red-200',
            error: 'bg-orange-100 text-orange-700 border-orange-200',
            warning: 'bg-yellow-100 text-yellow-700 border-yellow-200',
            info: 'bg-blue-100 text-blue-700 border-blue-200'
        };
        const labels = {
            critical: 'קריטי',
            error: 'שגיאה',
            warning: 'אזהרה',
            info: 'מידע'
        };
        return (
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase border ${styles[severity] || styles.info}`}>
                {labels[severity] || severity}
            </span>
        );
    };

    const getSeverityIcon = (severity) => {
        switch (severity) {
            case 'critical':
            case 'error':
                return <FaTimesCircle className="text-red-400" size={12} />;
            case 'warning':
                return <FaExclamationTriangle className="text-yellow-400" size={12} />;
            default:
                return <FaShieldAlt className="text-blue-400" size={12} />;
        }
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
                            <FaLock className="text-brand-primary" size={20} />
                        </div>
                        אבטחה והרשאות
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">הגבלות גישה, ניהול סשנים ולוג ביקורת מערכת</p>
                </div>

                {/* Settings Form */}
                <form onSubmit={handleSave} className="space-y-6">
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-6">
                        <h2 className="text-sm font-black text-gray-900 border-b border-gray-50 pb-3">
                            הגדרות אבטחה
                        </h2>

                        {/* Rate Limit */}
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-500 uppercase tracking-wider">
                                מגבלת בקשות לדקה (Rate Limit)
                            </label>
                            <input
                                type="number"
                                name="rate_limit_per_minute"
                                value={form.rate_limit_per_minute}
                                onChange={handleChange}
                                min="1"
                                max="1000"
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-sm font-medium"
                            />
                            <p className="text-[11px] text-gray-400 font-medium">מספר הבקשות המרבי לכתובת IP בדקה</p>
                        </div>

                        {/* IP Whitelist */}
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-500 uppercase tracking-wider">
                                רשימת IP מורשים (Whitelist)
                            </label>
                            <textarea
                                name="ip_whitelist"
                                value={form.ip_whitelist}
                                onChange={handleChange}
                                placeholder="192.168.1.1, 10.0.0.1, 172.16.0.0/16"
                                rows="3"
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-sm font-medium font-mono resize-none"
                            />
                            <p className="text-[11px] text-gray-400 font-medium">הפרד כתובות IP בפסיק. השאר ריק כדי לאפשר גישה מכל כתובת</p>
                        </div>

                        {/* Session Timeout */}
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-500 uppercase tracking-wider">
                                תוקף סשן (דקות)
                            </label>
                            <input
                                type="number"
                                name="session_timeout_minutes"
                                value={form.session_timeout_minutes}
                                onChange={handleChange}
                                min="5"
                                max="1440"
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-sm font-medium"
                            />
                            <p className="text-[11px] text-gray-400 font-medium">משך הזמן עד לנתק אוטומטי של סשן לא פעיל</p>
                        </div>
                    </div>

                    {/* Save Button */}
                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-6 py-3 bg-brand-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-brand-primary/90 transition-all shadow-lg shadow-brand-primary/20 disabled:opacity-50 flex items-center gap-2"
                        >
                            {saving ? (
                                <>
                                    <FaSpinner className="animate-spin" size={12} />
                                    שומר...
                                </>
                            ) : (
                                <>
                                    <FaSave size={12} />
                                    שמור הגדרות
                                </>
                            )}
                        </button>
                    </div>
                </form>

                {/* Audit Log Table */}
                <div className="mt-8 bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-sm font-black text-gray-900 flex items-center gap-2">
                            <FaShieldAlt className="text-brand-primary" size={14} />
                            לוג ביקורת אחרון
                        </h2>
                        <span className="text-[10px] font-black uppercase text-gray-400 bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
                            20 אחרונים
                        </span>
                    </div>

                    {logsLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <FaSpinner className="animate-spin text-gray-300" size={24} />
                        </div>
                    ) : auditLogs.length === 0 ? (
                        <div className="text-center py-8">
                            <FaCheckCircle className="mx-auto text-green-300 mb-3" size={32} />
                            <p className="text-sm text-gray-500 font-bold">אין אירועים בלוג</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-gray-100">
                                        <th className="text-right text-[10px] font-black text-gray-400 uppercase tracking-wider py-3 px-3">
                                            חומרה
                                        </th>
                                        <th className="text-right text-[10px] font-black text-gray-400 uppercase tracking-wider py-3 px-3">
                                            הודעה
                                        </th>
                                        <th className="text-right text-[10px] font-black text-gray-400 uppercase tracking-wider py-3 px-3">
                                            תאריך
                                        </th>
                                        <th className="text-right text-[10px] font-black text-gray-400 uppercase tracking-wider py-3 px-3">
                                            סטטוס
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {auditLogs.map((log, index) => (
                                        <tr
                                            key={log.id || index}
                                            className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors"
                                        >
                                            <td className="py-3 px-3">
                                                <div className="flex items-center gap-2">
                                                    {getSeverityIcon(log.severity)}
                                                    {getSeverityBadge(log.severity)}
                                                </div>
                                            </td>
                                            <td className="py-3 px-3">
                                                <p className="text-xs font-bold text-gray-700 max-w-[400px] truncate">
                                                    {log.message}
                                                </p>
                                            </td>
                                            <td className="py-3 px-3">
                                                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                                    <FaClock size={10} />
                                                    {new Date(log.created_at).toLocaleDateString('he-IL', {
                                                        day: '2-digit',
                                                        month: '2-digit',
                                                        year: '2-digit',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </div>
                                            </td>
                                            <td className="py-3 px-3">
                                                {log.resolved ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-green-100 text-green-700 border border-green-200">
                                                        <FaCheckCircle size={8} />
                                                        טופל
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-red-100 text-red-700 border border-red-200">
                                                        <FaTimesCircle size={8} />
                                                        פתוח
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </SuperAdminLayout>
    );
}
