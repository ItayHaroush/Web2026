import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import SuperAdminLayout from '../../../layouts/SuperAdminLayout';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import api from '../../../services/apiClient';
import { toast } from 'react-hot-toast';
import {
    FaGlobe,
    FaArrowRight,
    FaSave,
    FaSpinner
} from 'react-icons/fa';

export default function RegionalSettings() {
    const { getAuthHeaders } = useAdminAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        default_language: 'he',
        default_currency: 'ILS',
        timezone: 'Asia/Jerusalem',
        vat_percentage: '17',
        date_format: 'DD/MM/YYYY'
    });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const response = await api.get('/super-admin/settings/regional', {
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
            console.error('Failed to load regional settings:', error);
            toast.error('שגיאה בטעינת הגדרות אזוריות');
        } finally {
            setLoading(false);
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
            const settings = Object.entries(form).map(([key, value]) => ({
                key,
                value: String(value),
                type: key === 'vat_percentage' ? 'integer' : 'string',
                group: 'regional'
            }));

            const response = await api.post('/super-admin/settings', { settings }, {
                headers: getAuthHeaders()
            });

            if (response.data.success) {
                toast.success('ההגדרות האזוריות נשמרו בהצלחה');
            }
        } catch (error) {
            console.error('Failed to save regional settings:', error);
            toast.error(error.response?.data?.message || 'שגיאה בשמירת ההגדרות');
        } finally {
            setSaving(false);
        }
    };

    const languageOptions = [
        { value: 'he', label: 'עברית' },
        { value: 'en', label: 'אנגלית' },
        { value: 'ar', label: 'ערבית' }
    ];

    const currencyOptions = [
        { value: 'ILS', label: 'שקל ישראלי (ILS)' },
        { value: 'USD', label: 'דולר אמריקאי (USD)' },
        { value: 'EUR', label: 'אירו (EUR)' }
    ];

    const timezoneOptions = [
        { value: 'Asia/Jerusalem', label: 'ישראל (Asia/Jerusalem)' },
        { value: 'Europe/London', label: 'לונדון (Europe/London)' },
        { value: 'America/New_York', label: 'ניו יורק (America/New_York)' },
        { value: 'Europe/Berlin', label: 'ברלין (Europe/Berlin)' }
    ];

    const dateFormatOptions = [
        { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
        { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
        { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' }
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
                            <FaGlobe className="text-brand-primary" size={20} />
                        </div>
                        הגדרות אזוריות
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">שפה, מטבע, אזור זמן ופורמט תאריך ברירת מחדל במערכת</p>
                </div>

                {/* Form */}
                <form onSubmit={handleSave}>
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-6">
                        {/* Language */}
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-500 uppercase tracking-wider">
                                שפת ברירת מחדל
                            </label>
                            <select
                                name="default_language"
                                value={form.default_language}
                                onChange={handleChange}
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-sm font-medium appearance-none"
                            >
                                {languageOptions.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Currency */}
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-500 uppercase tracking-wider">
                                מטבע ברירת מחדל
                            </label>
                            <select
                                name="default_currency"
                                value={form.default_currency}
                                onChange={handleChange}
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-sm font-medium appearance-none"
                            >
                                {currencyOptions.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Timezone */}
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-500 uppercase tracking-wider">
                                אזור זמן
                            </label>
                            <select
                                name="timezone"
                                value={form.timezone}
                                onChange={handleChange}
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-sm font-medium appearance-none"
                            >
                                {timezoneOptions.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* VAT */}
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-500 uppercase tracking-wider">
                                אחוז מע״מ
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    name="vat_percentage"
                                    value={form.vat_percentage}
                                    onChange={handleChange}
                                    min="0"
                                    max="100"
                                    step="0.1"
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-sm font-medium"
                                />
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-bold">%</span>
                            </div>
                        </div>

                        {/* Date Format */}
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-500 uppercase tracking-wider">
                                פורמט תאריך
                            </label>
                            <select
                                name="date_format"
                                value={form.date_format}
                                onChange={handleChange}
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-sm font-medium appearance-none"
                            >
                                {dateFormatOptions.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Save Button */}
                    <div className="mt-6 flex justify-end">
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
