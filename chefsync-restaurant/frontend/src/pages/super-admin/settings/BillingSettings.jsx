import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import SuperAdminLayout from '../../../layouts/SuperAdminLayout';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import api from '../../../services/apiClient';
import { toast } from 'react-hot-toast';
import {
    FaCreditCard,
    FaArrowRight,
    FaSave,
    FaSpinner,
    FaEye,
    FaEyeSlash,
    FaToggleOn,
    FaToggleOff
} from 'react-icons/fa';

export default function BillingSettings() {
    const { getAuthHeaders } = useAdminAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showWebhookSecret, setShowWebhookSecret] = useState(false);
    const [form, setForm] = useState({
        hyp_master_account: '',
        hyp_webhook_secret: '',
        recurring_enabled: 'false',
        commission_model: 'percentage',
        flat_monthly_fee: '0',
        commission_percentage: '5',
        trial_duration_days: '14',
        grace_period_days: '3'
    });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const response = await api.get('/super-admin/settings/billing', {
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
            console.error('Failed to load billing settings:', error);
            toast.error('שגיאה בטעינת הגדרות סליקה');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const toggleRecurring = () => {
        setForm(prev => ({
            ...prev,
            recurring_enabled: prev.recurring_enabled === 'true' ? 'false' : 'true'
        }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const typeMap = {
                hyp_master_account: 'string',
                hyp_webhook_secret: 'string',
                recurring_enabled: 'boolean',
                commission_model: 'string',
                flat_monthly_fee: 'integer',
                commission_percentage: 'integer',
                trial_duration_days: 'integer',
                grace_period_days: 'integer'
            };

            const settings = Object.entries(form).map(([key, value]) => ({
                key,
                value: String(value),
                type: typeMap[key] || 'string',
                group: 'billing'
            }));

            const response = await api.post('/super-admin/settings', { settings }, {
                headers: getAuthHeaders()
            });

            if (response.data.success) {
                toast.success('הגדרות סליקה נשמרו בהצלחה');
            }
        } catch (error) {
            console.error('Failed to save billing settings:', error);
            toast.error(error.response?.data?.message || 'שגיאה בשמירת ההגדרות');
        } finally {
            setSaving(false);
        }
    };

    const commissionModels = [
        { value: 'flat', label: 'עמלה קבועה' },
        { value: 'percentage', label: 'אחוז מהמכירות' },
        { value: 'hybrid', label: 'משולב (קבוע + אחוז)' }
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
                            <FaCreditCard className="text-brand-primary" size={20} />
                        </div>
                        ניהול סליקה וחיוב
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">הגדרת חשבונות סליקה, עמלות ותנאי תשלום למסעדות</p>
                </div>

                <form onSubmit={handleSave} className="space-y-6">
                    {/* Payment Gateway Section */}
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-6">
                        <h2 className="text-sm font-black text-gray-900 border-b border-gray-50 pb-3">
                            שער תשלומים (HYP)
                        </h2>

                        {/* Master Account */}
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-500 uppercase tracking-wider">
                                חשבון מאסטר
                            </label>
                            <input
                                type="text"
                                name="hyp_master_account"
                                value={form.hyp_master_account}
                                onChange={handleChange}
                                placeholder="הזן מזהה חשבון מאסטר HYP"
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-sm font-medium"
                            />
                        </div>

                        {/* Webhook Secret */}
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-500 uppercase tracking-wider">
                                מפתח סודי (Webhook Secret)
                            </label>
                            <div className="relative">
                                <input
                                    type={showWebhookSecret ? 'text' : 'password'}
                                    name="hyp_webhook_secret"
                                    value={form.hyp_webhook_secret}
                                    onChange={handleChange}
                                    placeholder="הזן מפתח סודי"
                                    className="w-full px-4 py-2.5 pl-12 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-sm font-medium font-mono"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    {showWebhookSecret ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
                                </button>
                            </div>
                        </div>

                        {/* Recurring Toggle */}
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <div>
                                <p className="text-sm font-black text-gray-900">חיובים חוזרים</p>
                                <p className="text-xs text-gray-500 mt-0.5">אפשר חיוב אוטומטי חודשי למסעדות</p>
                            </div>
                            <button
                                type="button"
                                onClick={toggleRecurring}
                                className="transition-colors"
                            >
                                {form.recurring_enabled === 'true' ? (
                                    <FaToggleOn className="text-brand-primary" size={32} />
                                ) : (
                                    <FaToggleOff className="text-gray-300" size={32} />
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Commission Section */}
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-6">
                        <h2 className="text-sm font-black text-gray-900 border-b border-gray-50 pb-3">
                            מודל עמלות
                        </h2>

                        {/* Commission Model */}
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-500 uppercase tracking-wider">
                                סוג עמלה
                            </label>
                            <select
                                name="commission_model"
                                value={form.commission_model}
                                onChange={handleChange}
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-sm font-medium appearance-none"
                            >
                                {commissionModels.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Flat Fee */}
                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-500 uppercase tracking-wider">
                                    עמלה חודשית קבועה
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        name="flat_monthly_fee"
                                        value={form.flat_monthly_fee}
                                        onChange={handleChange}
                                        min="0"
                                        step="1"
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-sm font-medium"
                                        disabled={form.commission_model === 'percentage'}
                                    />
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-bold">&#8362;</span>
                                </div>
                            </div>

                            {/* Commission Percentage */}
                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-500 uppercase tracking-wider">
                                    אחוז עמלה
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        name="commission_percentage"
                                        value={form.commission_percentage}
                                        onChange={handleChange}
                                        min="0"
                                        max="100"
                                        step="0.1"
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-sm font-medium"
                                        disabled={form.commission_model === 'flat'}
                                    />
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-bold">%</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Trial & Grace Section */}
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-6">
                        <h2 className="text-sm font-black text-gray-900 border-b border-gray-50 pb-3">
                            תקופת ניסיון וגרייס
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Trial Duration */}
                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-500 uppercase tracking-wider">
                                    תקופת ניסיון (ימים)
                                </label>
                                <input
                                    type="number"
                                    name="trial_duration_days"
                                    value={form.trial_duration_days}
                                    onChange={handleChange}
                                    min="0"
                                    max="365"
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-sm font-medium"
                                />
                            </div>

                            {/* Grace Period */}
                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-500 uppercase tracking-wider">
                                    תקופת גרייס (ימים)
                                </label>
                                <input
                                    type="number"
                                    name="grace_period_days"
                                    value={form.grace_period_days}
                                    onChange={handleChange}
                                    min="0"
                                    max="90"
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-sm font-medium"
                                />
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
