import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import SuperAdminLayout from '../../../layouts/SuperAdminLayout';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import api from '../../../services/apiClient';
import { toast } from 'react-hot-toast';
import {
    FaBell,
    FaArrowRight,
    FaSave,
    FaSpinner,
    FaEnvelope,
    FaSms,
    FaCheckCircle,
    FaTimesCircle,
    FaPaperPlane,
    FaEye,
    FaEyeSlash,
    FaServer
} from 'react-icons/fa';

export default function NotificationSettings() {
    const { getAuthHeaders } = useAdminAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [showSmtpPassword, setShowSmtpPassword] = useState(false);
    const [smtpStatus, setSmtpStatus] = useState(null);
    const [smsBalance, setSmsBalance] = useState(null);
    const [form, setForm] = useState({
        smtp_host: '',
        smtp_port: '587',
        smtp_username: '',
        smtp_password: '',
        smtp_encryption: 'tls'
    });

    useEffect(() => {
        fetchSettings();
        fetchSmtpStatus();
        fetchSmsBalance();
    }, []);

    const fetchSettings = async () => {
        try {
            const response = await api.get('/super-admin/settings/notifications', {
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
            console.error('Failed to load notification settings:', error);
            toast.error('שגיאה בטעינת הגדרות התראות');
        } finally {
            setLoading(false);
        }
    };

    const fetchSmtpStatus = async () => {
        try {
            const response = await api.get('/super-admin/smtp/status', {
                headers: getAuthHeaders()
            });
            if (response.data.success) {
                setSmtpStatus(response.data.data || response.data);
            }
        } catch (error) {
            console.error('Failed to fetch SMTP status:', error);
        }
    };

    const fetchSmsBalance = async () => {
        try {
            const response = await api.get('/super-admin/sms/balance', {
                headers: getAuthHeaders()
            });
            if (response.data.success) {
                setSmsBalance(response.data.data || response.data);
            }
        } catch (error) {
            console.error('Failed to fetch SMS balance:', error);
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
                smtp_host: 'string',
                smtp_port: 'integer',
                smtp_username: 'string',
                smtp_password: 'string',
                smtp_encryption: 'string'
            };

            const settings = Object.entries(form).map(([key, value]) => ({
                key,
                value: String(value),
                type: typeMap[key] || 'string',
                group: 'notifications'
            }));

            const response = await api.post('/super-admin/settings', { settings }, {
                headers: getAuthHeaders()
            });

            if (response.data.success) {
                toast.success('הגדרות התראות נשמרו בהצלחה');
                fetchSmtpStatus();
            }
        } catch (error) {
            console.error('Failed to save notification settings:', error);
            toast.error(error.response?.data?.message || 'שגיאה בשמירת ההגדרות');
        } finally {
            setSaving(false);
        }
    };

    const handleTestSmtp = async () => {
        setTesting(true);
        try {
            const response = await api.post('/super-admin/smtp/test', {}, {
                headers: getAuthHeaders()
            });
            if (response.data.success) {
                toast.success(response.data.message || 'אימייל בדיקה נשלח בהצלחה!');
            } else {
                toast.error(response.data.message || 'שליחת הבדיקה נכשלה');
            }
        } catch (error) {
            console.error('SMTP test failed:', error);
            toast.error(error.response?.data?.message || 'שגיאה בשליחת אימייל בדיקה');
        } finally {
            setTesting(false);
        }
    };

    const encryptionOptions = [
        { value: 'tls', label: 'TLS' },
        { value: 'ssl', label: 'SSL' },
        { value: 'none', label: 'ללא הצפנה' }
    ];

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
            <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-4">
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
                            <FaBell className="text-brand-primary" size={20} />
                        </div>
                        התראות מערכת
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">הגדרת שרת דוא״ל SMTP ומעקב אחר ספק SMS</p>
                </div>

                {/* Status Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {/* SMTP Status Card */}
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-blue-50 rounded-lg">
                                    <FaEnvelope className="text-blue-500" size={14} />
                                </div>
                                <span className="text-xs font-black text-gray-500 uppercase tracking-wider">סטטוס SMTP</span>
                            </div>
                            {smtpStatus?.connected ? (
                                <FaCheckCircle className="text-green-500" size={16} />
                            ) : (
                                <FaTimesCircle className="text-red-400" size={16} />
                            )}
                        </div>
                        {smtpStatus ? (
                            <div className="space-y-1">
                                <p className="text-sm font-black text-gray-900">
                                    {smtpStatus.host || 'לא מוגדר'}
                                </p>
                                <p className="text-xs text-gray-500">
                                    פורט: {smtpStatus.port || '-'} | הצפנה: {smtpStatus.encryption || '-'}
                                </p>
                                <p className={`text-xs font-bold ${smtpStatus.connected ? 'text-green-600' : 'text-red-500'}`}>
                                    {smtpStatus.connected ? 'מחובר ופעיל' : 'לא מחובר'}
                                </p>
                            </div>
                        ) : (
                            <p className="text-xs text-gray-400">טוען...</p>
                        )}
                    </div>

                    {/* SMS Status Card */}
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-purple-50 rounded-lg">
                                    <FaSms className="text-purple-500" size={14} />
                                </div>
                                <span className="text-xs font-black text-gray-500 uppercase tracking-wider">ספק SMS</span>
                            </div>
                            {smsBalance?.active ? (
                                <FaCheckCircle className="text-green-500" size={16} />
                            ) : (
                                <FaTimesCircle className="text-red-400" size={16} />
                            )}
                        </div>
                        {smsBalance ? (
                            <div className="space-y-1">
                                <p className="text-sm font-black text-gray-900">
                                    {smsBalance.provider_name || smsBalance.provider || 'ספק SMS'}
                                </p>
                                <p className="text-xs text-gray-500">
                                    {smsBalance.configured ? 'מוגדר ומחובר' : 'לא מוגדר'}
                                    {smsBalance.pilot_mode ? ' | מצב פיילוט (Twilio)' : ''}
                                </p>
                                <p className={`text-xs font-bold ${smsBalance.active ? 'text-green-600' : 'text-red-500'}`}>
                                    {smsBalance.active ? 'פעיל' : 'לא פעיל'}
                                </p>
                            </div>
                        ) : (
                            <p className="text-xs text-gray-400">טוען...</p>
                        )}
                    </div>
                </div>

                {/* SMTP Form */}
                <form onSubmit={handleSave} className="space-y-6">
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-6">
                        <div className="flex items-center justify-between border-b border-gray-50 pb-3">
                            <h2 className="text-sm font-black text-gray-900 flex items-center gap-2">
                                <FaServer className="text-gray-400" size={12} />
                                הגדרות שרת SMTP
                            </h2>
                            <button
                                type="button"
                                onClick={handleTestSmtp}
                                disabled={testing}
                                className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-blue-100 transition-all border border-blue-100 disabled:opacity-50 flex items-center gap-2"
                            >
                                {testing ? (
                                    <>
                                        <FaSpinner className="animate-spin" size={10} />
                                        בודק...
                                    </>
                                ) : (
                                    <>
                                        <FaPaperPlane size={10} />
                                        בדיקת חיבור
                                    </>
                                )}
                            </button>
                        </div>

                        {/* SMTP Host */}
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-500 uppercase tracking-wider">
                                כתובת שרת (Host)
                            </label>
                            <input
                                type="text"
                                name="smtp_host"
                                value={form.smtp_host}
                                onChange={handleChange}
                                placeholder="smtp.example.com"
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-sm font-medium font-mono"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* SMTP Port */}
                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-500 uppercase tracking-wider">
                                    פורט
                                </label>
                                <input
                                    type="number"
                                    name="smtp_port"
                                    value={form.smtp_port}
                                    onChange={handleChange}
                                    min="1"
                                    max="65535"
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-sm font-medium"
                                />
                            </div>

                            {/* SMTP Encryption */}
                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-500 uppercase tracking-wider">
                                    הצפנה
                                </label>
                                <select
                                    name="smtp_encryption"
                                    value={form.smtp_encryption}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-sm font-medium appearance-none"
                                >
                                    {encryptionOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* SMTP Username */}
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-500 uppercase tracking-wider">
                                שם משתמש
                            </label>
                            <input
                                type="text"
                                name="smtp_username"
                                value={form.smtp_username}
                                onChange={handleChange}
                                placeholder="user@example.com"
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-sm font-medium"
                            />
                        </div>

                        {/* SMTP Password */}
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-500 uppercase tracking-wider">
                                סיסמה
                            </label>
                            <div className="relative">
                                <input
                                    type={showSmtpPassword ? 'text' : 'password'}
                                    name="smtp_password"
                                    value={form.smtp_password}
                                    onChange={handleChange}
                                    placeholder="הזן סיסמת SMTP"
                                    className="w-full px-4 py-2.5 pl-12 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-sm font-medium"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    {showSmtpPassword ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
                                </button>
                            </div>
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
            </div>
        </SuperAdminLayout>
    );
}
