import { useState, useEffect } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import AdminLayout from '../../layouts/AdminLayout';
import { FaNetworkWired, FaPlus, FaEdit, FaTrash, FaPowerOff, FaCopy, FaCheck, FaTimes, FaExclamationTriangle, FaRedo, FaPrint } from 'react-icons/fa';
import {
    getPrintDevices,
    registerPrintDevice,
    updatePrintDevice,
    deletePrintDevice,
    togglePrintDevice,
    getFailedPrintJobs,
    retryPrintJob,
    deletePrintJob,
    clearFailedPrintJobs,
} from '../../services/printDeviceService';

const ROLE_LABELS = {
    kitchen: 'מטבח',
    receipt: 'קופה / אישור',
    bar: 'בר',
    general: 'כללי',
};

const ROLE_COLORS = {
    kitchen: 'bg-orange-100 text-orange-700 border-orange-200',
    receipt: 'bg-blue-100 text-blue-700 border-blue-200',
    bar: 'bg-purple-100 text-purple-700 border-purple-200',
    general: 'bg-gray-100 text-gray-700 border-gray-200',
};

// סטטוס חיבור — מסונכרן עם PrintDevice::connection_status בבקאנד
const STATUS_META = {
    online: {
        label: 'מחובר',
        dot: 'bg-green-500 animate-pulse',
        text: 'text-green-600',
        ring: 'ring-green-100',
        emoji: '🟢',
    },
    bridge_offline: {
        label: 'הגשר אופליין',
        dot: 'bg-red-500',
        text: 'text-red-600',
        ring: 'ring-red-100',
        emoji: '🔴',
    },
    printer_offline: {
        label: 'מדפסת לא מגיבה',
        dot: 'bg-amber-500 animate-pulse',
        text: 'text-amber-600',
        ring: 'ring-amber-100',
        emoji: '⚠️',
    },
    disabled: {
        label: 'כבוי',
        dot: 'bg-gray-300',
        text: 'text-gray-400',
        ring: 'ring-gray-100',
        emoji: '⚪',
    },
};

const DEFAULT_FORM = {
    name: '',
    role: 'kitchen',
    printer_ip: '',
    printer_port: 9100,
};

export default function AdminPrintDevices() {
    const { isManager } = useAdminAuth();
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editDevice, setEditDevice] = useState(null);
    const [form, setForm] = useState({ ...DEFAULT_FORM });
    const [newToken, setNewToken] = useState(null);
    const [copiedToken, setCopiedToken] = useState(false);
    const [failedJobs, setFailedJobs] = useState([]);
    const [retryingJobId, setRetryingJobId] = useState(null);
    const [deletingJobId, setDeletingJobId] = useState(null);
    const [clearingJobs, setClearingJobs] = useState(false);

    useEffect(() => {
        fetchDevices();
        fetchFailedJobs();
        // ריענון אוטומטי כל 10 שניות — הסטטוס משתנה כשהגשר עולה/יורד
        const id = setInterval(() => {
            fetchDevices();
            fetchFailedJobs();
        }, 10000);
        return () => clearInterval(id);
    }, []);

    const fetchDevices = async () => {
        try {
            const res = await getPrintDevices();
            if (res.success) setDevices(res.devices || []);
        } catch (error) {
            console.error('Failed to fetch print devices:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchFailedJobs = async () => {
        try {
            const res = await getFailedPrintJobs();
            if (res.success) setFailedJobs(res.jobs || []);
        } catch (error) {
            console.error('Failed to fetch failed print jobs:', error);
        }
    };

    const handleRetryJob = async (jobId) => {
        setRetryingJobId(jobId);
        try {
            await retryPrintJob(jobId);
            setFailedJobs((prev) => prev.filter((j) => j.id !== jobId));
            fetchDevices();
        } catch (error) {
            console.error('Failed to retry print job:', error);
            alert(error.response?.data?.message || 'שגיאה בהדפסה מחדש');
        } finally {
            setRetryingJobId(null);
        }
    };

    const handleDeleteJob = async (jobId) => {
        setDeletingJobId(jobId);
        try {
            await deletePrintJob(jobId);
            setFailedJobs((prev) => prev.filter((j) => j.id !== jobId));
        } catch (error) {
            console.error('Failed to delete print job:', error);
            alert(error.response?.data?.message || 'שגיאה במחיקה');
        } finally {
            setDeletingJobId(null);
        }
    };

    const handleClearFailedJobs = async () => {
        if (!confirm('למחוק את כל ההדפסות שנכשלו? פעולה זו אינה ניתנת לביטול.')) return;
        setClearingJobs(true);
        try {
            await clearFailedPrintJobs();
            setFailedJobs([]);
        } catch (error) {
            console.error('Failed to clear print jobs:', error);
            alert(error.response?.data?.message || 'שגיאה במחיקה');
        } finally {
            setClearingJobs(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editDevice) {
                await updatePrintDevice(editDevice.id, form);
                closeModal();
            } else {
                const res = await registerPrintDevice(form);
                if (res.device_token) {
                    setNewToken(res.device_token);
                } else {
                    closeModal();
                }
            }
            fetchDevices();
        } catch (error) {
            console.error('Failed to save device:', error);
            alert(error.response?.data?.message || 'שגיאה בשמירה');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('למחוק את מכשיר ההדפסה?')) return;
        try {
            await deletePrintDevice(id);
            fetchDevices();
        } catch (error) {
            console.error('Failed to delete device:', error);
            alert(error.response?.data?.message || 'שגיאה במחיקה');
        }
    };

    const handleToggle = async (id) => {
        try {
            await togglePrintDevice(id);
            fetchDevices();
        } catch (error) {
            console.error('Failed to toggle device:', error);
        }
    };

    const copyToken = () => {
        if (newToken) {
            navigator.clipboard.writeText(newToken);
            setCopiedToken(true);
            setTimeout(() => setCopiedToken(false), 2000);
        }
    };

    const openNew = () => {
        setEditDevice(null);
        setForm({ ...DEFAULT_FORM });
        setNewToken(null);
        setCopiedToken(false);
        setShowModal(true);
    };

    const openEdit = (device) => {
        setEditDevice(device);
        setForm({
            name: device.name,
            role: device.role || 'kitchen',
            printer_ip: device.printer_ip || '',
            printer_port: device.printer_port || 9100,
        });
        setNewToken(null);
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditDevice(null);
        setNewToken(null);
        setCopiedToken(false);
    };

    const timeAgo = (dateStr) => {
        if (!dateStr) return null;
        const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
        if (diff < 60) return 'לפני שניות';
        if (diff < 3600) return `לפני ${Math.floor(diff / 60)} דק'`;
        if (diff < 86400) return `לפני ${Math.floor(diff / 3600)} שעות`;
        return `לפני ${Math.floor(diff / 86400)} ימים`;
    };

    if (loading) {
        return (
            <AdminLayout>
                <div className="flex flex-col items-center justify-center h-96">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-500"></div>
                    <p className="mt-4 text-gray-500 font-black animate-pulse">טוען גשרי הדפסה...</p>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="max-w-6xl mx-auto space-y-12 pb-32 animate-in fade-in duration-500">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 px-4">
                    <div className="flex items-center gap-6">
                        <div className="w-20 h-20 bg-indigo-50 rounded-[2.5rem] flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100/50">
                            <FaNetworkWired size={30} />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black text-gray-900 tracking-tight">גשרי הדפסה</h1>
                            <p className="text-gray-500 font-medium mt-1">
                                {devices.length} מכשירים רשומים — הדפסה אוטומטית למדפסות רשת
                            </p>
                        </div>
                    </div>
                    {isManager() && (
                        <button
                            onClick={openNew}
                            className="w-full md:w-auto px-10 py-5 rounded-[2rem] font-black transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95 group bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-600/20"
                        >
                            <FaPlus className="group-hover:rotate-90 transition-transform" />
                            מכשיר חדש
                        </button>
                    )}
                </div>

                {/* Global health summary — מציג זריזות אם משהו לא בסדר */}
                {devices.length > 0 && (() => {
                    const active = devices.filter(d => d.is_active);
                    const offline = active.filter(d => (d.connection_status || (d.is_connected ? 'online' : 'bridge_offline')) === 'bridge_offline');
                    const warn = active.filter(d => (d.connection_status || '') === 'printer_offline');
                    const ok = active.filter(d => (d.connection_status || (d.is_connected ? 'online' : '')) === 'online');
                    if (offline.length === 0 && warn.length === 0) return null;
                    return (
                        <div className={`mx-4 p-5 rounded-[2rem] border flex items-start gap-4 ${offline.length > 0 ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'}`}>
                            <FaExclamationTriangle className={`mt-1 flex-shrink-0 ${offline.length > 0 ? 'text-red-500' : 'text-amber-500'}`} size={20} />
                            <div>
                                <p className={`font-black ${offline.length > 0 ? 'text-red-700' : 'text-amber-700'}`}>
                                    {offline.length > 0
                                        ? `${offline.length} גשרי הדפסה אופליין — עבודות הדפסה חדשות יסומנו ככשלון`
                                        : `${warn.length} מדפסות לא מגיבות`}
                                </p>
                                <p className={`text-xs mt-1 ${offline.length > 0 ? 'text-red-500' : 'text-amber-600'}`}>
                                    סטטוס נוכחי: {ok.length} תקינים • {warn.length} מדפסת לא מגיבה • {offline.length} גשר אופליין
                                </p>
                            </div>
                        </div>
                    );
                })()}

                {/* תור הדפסה שנכשל — הדפסה חוזרת ידנית (אף הזמנה לא הולכת לאיבוד) */}
                {failedJobs.length > 0 && (
                    <div className="mx-4 bg-white rounded-[2rem] border-2 border-red-100 shadow-sm overflow-hidden">
                        <div className="bg-red-50 px-6 py-4 flex items-center justify-between gap-3 border-b border-red-100">
                            <div className="flex items-center gap-3 min-w-0">
                                <FaExclamationTriangle className="text-red-500 flex-shrink-0" size={18} />
                                <div className="min-w-0">
                                    <h3 className="font-black text-red-700">הדפסות שנכשלו ({failedJobs.length})</h3>
                                    <p className="text-xs text-red-500 mt-0.5">ההזמנות נשמרו ולא אבדו — ניתן להדפיס מחדש ידנית</p>
                                </div>
                            </div>
                            <button
                                onClick={handleClearFailedJobs}
                                disabled={clearingJobs}
                                className="flex-shrink-0 px-4 py-2.5 rounded-xl font-bold text-sm bg-red-100 text-red-700 hover:bg-red-200 transition-all flex items-center gap-2 disabled:opacity-50"
                            >
                                {clearingJobs ? <FaRedo className="animate-spin" size={12} /> : <FaTrash size={12} />}
                                נקה הכל
                            </button>
                        </div>
                        <div className="divide-y divide-gray-50">
                            {failedJobs.map((job) => (
                                <div key={job.id} className="px-6 py-4 flex items-center justify-between gap-4">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-black text-gray-900">
                                                {job.order_id ? `הזמנה #${job.order_id}` : `עבודה #${job.id}`}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${ROLE_COLORS[job.role] || ROLE_COLORS.general}`}>
                                                {ROLE_LABELS[job.role] || job.role || 'כללי'}
                                            </span>
                                            {job.retry_count > 0 && (
                                                <span className="text-[11px] text-gray-400">{job.retry_count} ניסיונות</span>
                                            )}
                                        </div>
                                        {job.error_message && (
                                            <p className="text-xs text-red-500 mt-1 truncate">{job.error_message}</p>
                                        )}
                                        <p className="text-[11px] text-gray-400 mt-0.5">
                                            {job.printer_name ? `${job.printer_name} · ` : ''}{timeAgo(job.failed_at)}
                                        </p>
                                    </div>
                                    <div className="flex-shrink-0 flex items-center gap-2">
                                        <button
                                            onClick={() => handleRetryJob(job.id)}
                                            disabled={retryingJobId === job.id}
                                            className="px-5 py-2.5 rounded-xl font-bold text-sm bg-indigo-600 text-white hover:bg-indigo-500 transition-all flex items-center gap-2 disabled:opacity-50"
                                        >
                                            {retryingJobId === job.id ? <FaRedo className="animate-spin" size={12} /> : <FaPrint size={12} />}
                                            הדפס מחדש
                                        </button>
                                        <button
                                            onClick={() => handleDeleteJob(job.id)}
                                            disabled={deletingJobId === job.id}
                                            title="מחק התראה"
                                            className="px-3 py-2.5 rounded-xl font-bold text-sm bg-red-50 text-red-600 hover:bg-red-100 transition-all flex items-center disabled:opacity-50"
                                        >
                                            {deletingJobId === job.id ? <FaRedo className="animate-spin" size={12} /> : <FaTrash size={12} />}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Devices Grid */}
                {devices.length === 0 ? (
                    <div className="bg-white rounded-[4rem] shadow-sm border-2 border-dashed border-gray-100 p-24 text-center flex flex-col items-center col-span-full max-w-xl mx-auto">
                        <div className="w-28 h-28 bg-gray-50 rounded-[3rem] flex items-center justify-center text-6xl mb-8 grayscale opacity-50">
                            <FaNetworkWired />
                        </div>
                        <h3 className="text-3xl font-black text-gray-900 mb-2">אין מכשירי הדפסה עדיין</h3>
                        <p className="text-gray-500 font-medium mb-12 text-lg leading-relaxed">
                            רשמו מכשיר אנדרואיד שמשמש כגשר הדפסה למדפסת רשת מקומית
                        </p>
                        {isManager() && (
                            <button
                                onClick={openNew}
                                className="bg-indigo-600 text-white px-12 py-5 rounded-[2rem] font-black hover:bg-indigo-500 transition-all flex items-center gap-4 shadow-lg shadow-indigo-600/20"
                            >
                                <FaPlus /> רישום מכשיר ראשון
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 px-4">
                        {devices.map((device) => {
                            const status = device.connection_status
                                || (device.is_active === false
                                    ? 'disabled'
                                    : (device.is_connected ? 'online' : 'bridge_offline'));
                            const meta = STATUS_META[status] || STATUS_META.bridge_offline;
                            const printerKnown = device.printer_connected;
                            const pendingJobs = device.pending_jobs_count || 0;
                            return (
                                <div key={device.id} className="bg-white rounded-[2rem] shadow-sm border border-gray-100 p-8 hover:shadow-md transition-all">
                                    {/* Header */}
                                    <div className="flex items-start justify-between mb-6">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${device.is_active ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-400'}`}>
                                                <FaNetworkWired size={22} />
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-black text-gray-900">{device.name}</h3>
                                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                                    <span className={`px-3 py-0.5 rounded-full text-xs font-bold border ${ROLE_COLORS[device.role] || ROLE_COLORS.general}`}>
                                                        {ROLE_LABELS[device.role] || device.role}
                                                    </span>
                                                    <span className={`flex items-center gap-1 text-xs font-bold ${meta.text}`}>
                                                        <span className={`w-2 h-2 rounded-full ${meta.dot}`}></span>
                                                        {meta.label}
                                                    </span>
                                                    {device.agent_version && (
                                                        <span className="text-[10px] font-mono text-gray-400" dir="ltr">v{device.agent_version}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        {!device.is_active && (
                                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-600 border border-red-100">
                                                כבוי
                                            </span>
                                        )}
                                    </div>

                                    {/* Status banners — bridge / printer state */}
                                    {status === 'bridge_offline' && device.is_active && (
                                        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 flex items-start gap-2">
                                            <FaExclamationTriangle className="text-red-500 mt-0.5 flex-shrink-0" size={14} />
                                            <div className="text-xs">
                                                <p className="text-red-700 font-bold">הגשר לא שולח heartbeat</p>
                                                <p className="text-red-500 mt-0.5">בדקו שהאפליקציה רצה במכשיר ושיש חיבור אינטרנט. עבודות הדפסה חדשות ייכשלו עד שהגשר יחזור.</p>
                                            </div>
                                        </div>
                                    )}
                                    {status === 'printer_offline' && (
                                        <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-100 flex items-start gap-2">
                                            <FaExclamationTriangle className="text-amber-500 mt-0.5 flex-shrink-0" size={14} />
                                            <div className="text-xs">
                                                <p className="text-amber-700 font-bold">המדפסת לא מגיבה</p>
                                                <p className="text-amber-600 mt-0.5">{device.printer_last_error || 'הגשר לא הצליח לפתוח חיבור TCP. בדקו חשמל / רשת / IP.'}</p>
                                            </div>
                                        </div>
                                    )}
                                    {pendingJobs > 0 && (
                                        <div className="mb-4 p-3 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-between">
                                            <span className="text-xs font-bold text-indigo-700">{pendingJobs} עבודות הדפסה ממתינות</span>
                                            <span className="text-[10px] text-indigo-400">יודפסו אוטומטית כשהגשר יחזור</span>
                                        </div>
                                    )}

                                    {/* Details */}
                                    <div className="space-y-2 text-sm text-gray-600 mb-6">
                                        {device.printer_ip && (
                                            <div className="flex items-center justify-between">
                                                <span className="font-medium">מדפסת:</span>
                                                <span className="font-mono text-gray-800" dir="ltr">{device.printer_ip}:{device.printer_port || 9100}</span>
                                            </div>
                                        )}
                                        {printerKnown !== null && printerKnown !== undefined && (
                                            <div className="flex items-center justify-between">
                                                <span className="font-medium">בדיקת TCP:</span>
                                                <span className={`font-bold ${printerKnown ? 'text-green-600' : 'text-amber-600'}`}>
                                                    {printerKnown ? '✓ נגישה' : '✗ לא מגיבה'}
                                                    {device.printer_last_check_at && (
                                                        <span className="text-gray-400 font-normal mr-2">({timeAgo(device.printer_last_check_at)})</span>
                                                    )}
                                                </span>
                                            </div>
                                        )}
                                        {device.last_seen_at && (
                                            <div className="flex items-center justify-between">
                                                <span className="font-medium">heartbeat אחרון:</span>
                                                <span>{timeAgo(device.last_seen_at)}</span>
                                            </div>
                                        )}
                                        {device.last_successful_print_at && (
                                            <div className="flex items-center justify-between">
                                                <span className="font-medium">הדפסה אחרונה:</span>
                                                <span className="text-green-600 font-bold">{timeAgo(device.last_successful_print_at)}</span>
                                            </div>
                                        )}
                                        {device.consecutive_failures > 0 && (
                                            <div className="flex items-center justify-between">
                                                <span className="font-medium">כשלים רצופים:</span>
                                                <span className="text-red-600 font-bold">
                                                    {device.consecutive_failures}
                                                    {device.last_retry_count ? ` · ${device.last_retry_count} ניסיונות אחרונים` : ''}
                                                </span>
                                            </div>
                                        )}
                                        {device.last_error_message && (
                                            <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-100 flex items-start gap-2">
                                                <FaExclamationTriangle className="text-red-500 mt-0.5 flex-shrink-0" size={14} />
                                                <div>
                                                    <p className="text-red-700 text-xs font-bold">{device.last_error_message}</p>
                                                    {device.last_error_at && (
                                                        <p className="text-red-400 text-xs mt-0.5">{timeAgo(device.last_error_at)}</p>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    {isManager() && (
                                        <div className="flex items-center gap-3 border-t border-gray-50 pt-5">
                                            <button
                                                onClick={() => openEdit(device)}
                                                className="flex-1 py-3 rounded-xl font-bold text-sm bg-gray-50 text-gray-700 hover:bg-gray-100 transition-all flex items-center justify-center gap-2"
                                            >
                                                <FaEdit size={12} /> עריכה
                                            </button>
                                            <button
                                                onClick={() => handleToggle(device.id)}
                                                className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${device.is_active ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}
                                            >
                                                <FaPowerOff size={12} /> {device.is_active ? 'כבה' : 'הפעל'}
                                            </button>
                                            <button
                                                onClick={() => handleDelete(device.id)}
                                                className="py-3 px-4 rounded-xl font-bold text-sm bg-red-50 text-red-600 hover:bg-red-100 transition-all"
                                            >
                                                <FaTrash size={12} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Create/Edit Modal */}
                {showModal && (
                    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={closeModal}>
                        <div className="bg-white rounded-[2rem] shadow-2xl max-w-lg w-full p-8" onClick={e => e.stopPropagation()}>
                            {newToken ? (
                                /* Token Display */
                                <div className="text-center space-y-6">
                                    <div className="w-20 h-20 bg-green-50 rounded-[2rem] flex items-center justify-center text-green-600 mx-auto">
                                        <FaCheck size={32} />
                                    </div>
                                    <h2 className="text-2xl font-black text-gray-900">המכשיר נרשם בהצלחה!</h2>
                                    <p className="text-gray-500">העתיקו את הטוקן והזינו אותו באפליקציית ה-Agent במכשיר:</p>
                                    <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-3 border border-gray-200">
                                        <code className="flex-1 text-sm font-mono text-gray-800 break-all select-all" dir="ltr">{newToken}</code>
                                        <button
                                            onClick={copyToken}
                                            className={`p-3 rounded-xl transition-all ${copiedToken ? 'bg-green-100 text-green-600' : 'bg-white text-gray-500 hover:bg-gray-100'}`}
                                        >
                                            {copiedToken ? <FaCheck size={16} /> : <FaCopy size={16} />}
                                        </button>
                                    </div>
                                    <p className="text-xs text-red-500 font-bold">שימו לב: הטוקן מוצג פעם אחת בלבד ולא ניתן לשחזרו</p>
                                    <button
                                        onClick={closeModal}
                                        className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-500 transition-all"
                                    >
                                        סגור
                                    </button>
                                </div>
                            ) : (
                                /* Form */
                                <form onSubmit={handleSubmit} className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-2xl font-black text-gray-900">
                                            {editDevice ? 'עריכת מכשיר' : 'רישום מכשיר חדש'}
                                        </h2>
                                        <button type="button" onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-xl">
                                            <FaTimes />
                                        </button>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">שם המכשיר</label>
                                        <input
                                            type="text"
                                            value={form.name}
                                            onChange={e => setForm({ ...form, name: e.target.value })}
                                            placeholder="טאבלט מטבח"
                                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">תפקיד</label>
                                        <select
                                            value={form.role}
                                            onChange={e => setForm({ ...form, role: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                                        >
                                            <option value="kitchen">מטבח</option>
                                            <option value="receipt">קופה / אישור</option>
                                            <option value="bar">בר</option>
                                            <option value="general">כללי</option>
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="col-span-2">
                                            <label className="block text-sm font-bold text-gray-700 mb-2">כתובת IP מדפסת</label>
                                            <input
                                                type="text"
                                                value={form.printer_ip}
                                                onChange={e => setForm({ ...form, printer_ip: e.target.value })}
                                                placeholder="192.168.1.100"
                                                dir="ltr"
                                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">פורט</label>
                                            <input
                                                type="number"
                                                value={form.printer_port}
                                                onChange={e => setForm({ ...form, printer_port: parseInt(e.target.value) || 9100 })}
                                                dir="ltr"
                                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                                            />
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-500 transition-all"
                                    >
                                        {editDevice ? 'עדכן מכשיר' : 'רשום מכשיר'}
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
