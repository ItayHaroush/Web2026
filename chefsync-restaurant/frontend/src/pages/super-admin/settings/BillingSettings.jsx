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
    FaToggleOn,
    FaToggleOff,
    FaEdit,
    FaTimes,
    FaPlus,
    FaBrain,
    FaStar,
    FaCheck
} from 'react-icons/fa';

const DEFAULT_TIERS = {
    basic: {
        label: 'בייסיק',
        monthly: 450,
        yearly: 4500,
        ai_credits: 0,
        trial_ai_credits: 0,
        features: ['תפריט דיגיטלי', 'ניהול הזמנות', 'דוחות בסיסיים'],
    },
    pro: {
        label: 'פרו',
        monthly: 600,
        yearly: 5000,
        ai_credits: 500,
        trial_ai_credits: 50,
        features: ['תפריט דיגיטלי', 'ניהול הזמנות', 'דוחות מתקדמים', 'AI מתקדם', 'תמיכה מועדפת'],
    },
};

export default function BillingSettings() {
    const { getAuthHeaders } = useAdminAuth();
    const [loading, setLoading] = useState(true);
    const [savingTiers, setSavingTiers] = useState(false);
    const [savingSettings, setSavingSettings] = useState(false);
    const [tiers, setTiers] = useState(DEFAULT_TIERS);
    const [editingTier, setEditingTier] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [newFeature, setNewFeature] = useState('');

    const [settings, setSettings] = useState({
        recurring_enabled: 'false',
        trial_duration_days: '14',
        grace_period_days: '3'
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [tiersRes, settingsRes] = await Promise.all([
                api.get('/super-admin/pricing-tiers', { headers: getAuthHeaders() }),
                api.get('/super-admin/settings/billing', { headers: getAuthHeaders() }),
            ]);

            if (tiersRes.data.success && tiersRes.data.data) {
                setTiers(tiersRes.data.data);
            }

            if (settingsRes.data.success) {
                const s = {};
                (settingsRes.data.data || []).forEach(item => {
                    s[item.key] = item.value;
                });
                setSettings(prev => ({ ...prev, ...s }));
            }
        } catch (error) {
            console.error('Failed to load billing settings:', error);
            toast.error('שגיאה בטעינת הגדרות');
        } finally {
            setLoading(false);
        }
    };

    const startEdit = (tierKey) => {
        setEditingTier(tierKey);
        setEditForm({ ...tiers[tierKey] });
        setNewFeature('');
    };

    const cancelEdit = () => {
        setEditingTier(null);
        setEditForm({});
        setNewFeature('');
    };

    const handleEditChange = (field, value) => {
        setEditForm(prev => ({ ...prev, [field]: value }));
    };

    const addFeature = () => {
        if (!newFeature.trim()) return;
        setEditForm(prev => ({
            ...prev,
            features: [...(prev.features || []), newFeature.trim()],
        }));
        setNewFeature('');
    };

    const removeFeature = (index) => {
        setEditForm(prev => ({
            ...prev,
            features: prev.features.filter((_, i) => i !== index),
        }));
    };

    const saveTier = async () => {
        if (!editingTier) return;
        setSavingTiers(true);

        const updatedTiers = {
            ...tiers,
            [editingTier]: {
                label: editForm.label,
                monthly: Number(editForm.monthly),
                yearly: Number(editForm.yearly),
                ai_credits: Number(editForm.ai_credits),
                trial_ai_credits: Number(editForm.trial_ai_credits),
                features: editForm.features || [],
            },
        };

        try {
            const res = await api.put('/super-admin/pricing-tiers', { tiers: updatedTiers }, {
                headers: getAuthHeaders(),
            });

            if (res.data.success) {
                setTiers(updatedTiers);
                setEditingTier(null);
                setEditForm({});
                toast.success('המחירים עודכנו בהצלחה');
            }
        } catch (error) {
            console.error('Failed to save pricing:', error);
            toast.error(error.response?.data?.message || 'שגיאה בשמירת המחירים');
        } finally {
            setSavingTiers(false);
        }
    };

    const saveSettings = async () => {
        setSavingSettings(true);
        try {
            const typeMap = {
                recurring_enabled: 'boolean',
                trial_duration_days: 'integer',
                grace_period_days: 'integer',
            };

            const payload = Object.entries(settings)
                .filter(([key]) => typeMap[key])
                .map(([key, value]) => ({
                    key,
                    value: String(value),
                    type: typeMap[key],
                    group: 'billing',
                }));

            const res = await api.post('/super-admin/settings', { settings: payload }, {
                headers: getAuthHeaders(),
            });

            if (res.data.success) {
                toast.success('הגדרות נשמרו בהצלחה');
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'שגיאה בשמירת ההגדרות');
        } finally {
            setSavingSettings(false);
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
                        ניהול חבילות וחיוב
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">הגדרת חבילות מחירים, תקופת ניסיון וגרייס</p>
                </div>

                {/* ==================== PRICING TIERS ==================== */}
                <div className="mb-8">
                    <h2 className="text-lg font-black text-gray-900 mb-4">חבילות מחירים</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {Object.entries(tiers).map(([key, tier]) => (
                            <TierCard
                                key={key}
                                tierKey={key}
                                tier={tier}
                                isEditing={editingTier === key}
                                editForm={editForm}
                                newFeature={newFeature}
                                setNewFeature={setNewFeature}
                                onStartEdit={() => startEdit(key)}
                                onCancelEdit={cancelEdit}
                                onEditChange={handleEditChange}
                                onAddFeature={addFeature}
                                onRemoveFeature={removeFeature}
                                onSave={saveTier}
                                saving={savingTiers}
                                isPro={key === 'pro'}
                            />
                        ))}
                    </div>
                </div>

                {/* ==================== GENERAL SETTINGS ==================== */}
                <div className="space-y-6">
                    <h2 className="text-lg font-black text-gray-900">הגדרות כלליות</h2>

                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-6">
                        {/* Recurring Toggle */}
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <div>
                                <p className="text-sm font-black text-gray-900">חיובים חוזרים (HYP)</p>
                                <p className="text-xs text-gray-500 mt-0.5">אפשר חיוב אוטומטי חודשי למסעדות</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSettings(prev => ({
                                    ...prev,
                                    recurring_enabled: prev.recurring_enabled === 'true' ? 'false' : 'true'
                                }))}
                                className="transition-colors"
                            >
                                {settings.recurring_enabled === 'true' ? (
                                    <FaToggleOn className="text-brand-primary" size={32} />
                                ) : (
                                    <FaToggleOff className="text-gray-300" size={32} />
                                )}
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Trial Duration */}
                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-500 uppercase tracking-wider">
                                    תקופת ניסיון (ימים)
                                </label>
                                <input
                                    type="number"
                                    value={settings.trial_duration_days}
                                    onChange={(e) => setSettings(prev => ({ ...prev, trial_duration_days: e.target.value }))}
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
                                    value={settings.grace_period_days}
                                    onChange={(e) => setSettings(prev => ({ ...prev, grace_period_days: e.target.value }))}
                                    min="0"
                                    max="90"
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-sm font-medium"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Save Settings Button */}
                    <div className="flex justify-end">
                        <button
                            onClick={saveSettings}
                            disabled={savingSettings}
                            className="px-6 py-3 bg-brand-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-brand-primary/90 transition-all shadow-lg shadow-brand-primary/20 disabled:opacity-50 flex items-center gap-2"
                        >
                            {savingSettings ? (
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
                </div>
            </div>
        </SuperAdminLayout>
    );
}

function TierCard({
    tierKey,
    tier,
    isEditing,
    editForm,
    newFeature,
    setNewFeature,
    onStartEdit,
    onCancelEdit,
    onEditChange,
    onAddFeature,
    onRemoveFeature,
    onSave,
    saving,
    isPro,
}) {
    const data = isEditing ? editForm : tier;
    const borderColor = isPro ? 'border-brand-primary' : 'border-gray-200';
    const headerBg = isPro ? 'bg-brand-primary text-white' : 'bg-gray-100 text-gray-900';

    return (
        <div className={`bg-white rounded-3xl border-2 ${borderColor} shadow-sm overflow-hidden relative`}>
            {/* Header */}
            <div className={`${headerBg} px-6 py-4 flex items-center justify-between`}>
                <div className="flex items-center gap-2">
                    {isPro ? <FaStar size={16} /> : <FaCreditCard size={16} />}
                    {isEditing ? (
                        <input
                            type="text"
                            value={data.label}
                            onChange={(e) => onEditChange('label', e.target.value)}
                            className={`bg-transparent border-b ${isPro ? 'border-white/50 text-white placeholder-white/50' : 'border-gray-400 text-gray-900'} outline-none font-black text-lg w-32`}
                        />
                    ) : (
                        <span className="font-black text-lg">{data.label}</span>
                    )}
                </div>
                {!isEditing ? (
                    <button
                        onClick={onStartEdit}
                        className={`p-2 rounded-lg transition-colors ${isPro ? 'hover:bg-white/20 text-white' : 'hover:bg-gray-200 text-gray-600'}`}
                    >
                        <FaEdit size={14} />
                    </button>
                ) : (
                    <button
                        onClick={onCancelEdit}
                        className={`p-2 rounded-lg transition-colors ${isPro ? 'hover:bg-white/20 text-white' : 'hover:bg-gray-200 text-gray-600'}`}
                    >
                        <FaTimes size={14} />
                    </button>
                )}
            </div>

            <div className="p-6 space-y-5">
                {/* Prices */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">חודשי</label>
                        {isEditing ? (
                            <div className="relative">
                                <input
                                    type="number"
                                    value={data.monthly}
                                    onChange={(e) => onEditChange('monthly', e.target.value)}
                                    min="0"
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-primary/20"
                                />
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-bold">&#8362;</span>
                            </div>
                        ) : (
                            <p className="text-xl font-black text-gray-900">&#8362;{data.monthly}<span className="text-xs text-gray-400 font-medium">/חודש</span></p>
                        )}
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">שנתי</label>
                        {isEditing ? (
                            <div className="relative">
                                <input
                                    type="number"
                                    value={data.yearly}
                                    onChange={(e) => onEditChange('yearly', e.target.value)}
                                    min="0"
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-primary/20"
                                />
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-bold">&#8362;</span>
                            </div>
                        ) : (
                            <p className="text-xl font-black text-gray-900">&#8362;{data.yearly}<span className="text-xs text-gray-400 font-medium">/שנה</span></p>
                        )}
                    </div>
                </div>

                {/* AI Credits */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider flex items-center gap-1">
                            <FaBrain size={10} /> קרדיטים AI
                        </label>
                        {isEditing ? (
                            <input
                                type="number"
                                value={data.ai_credits}
                                onChange={(e) => onEditChange('ai_credits', e.target.value)}
                                min="0"
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-primary/20"
                            />
                        ) : (
                            <p className="text-sm font-bold text-gray-700">{data.ai_credits || 'ללא'}</p>
                        )}
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">קרדיטים בניסיון</label>
                        {isEditing ? (
                            <input
                                type="number"
                                value={data.trial_ai_credits}
                                onChange={(e) => onEditChange('trial_ai_credits', e.target.value)}
                                min="0"
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-primary/20"
                            />
                        ) : (
                            <p className="text-sm font-bold text-gray-700">{data.trial_ai_credits || 'ללא'}</p>
                        )}
                    </div>
                </div>

                {/* Features */}
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">תכונות</label>
                    <ul className="space-y-1.5">
                        {(data.features || []).map((feature, i) => (
                            <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                                <FaCheck size={10} className={isPro ? 'text-brand-primary' : 'text-green-500'} />
                                <span className="flex-1">{feature}</span>
                                {isEditing && (
                                    <button
                                        onClick={() => onRemoveFeature(i)}
                                        className="text-red-400 hover:text-red-600 transition-colors"
                                    >
                                        <FaTimes size={10} />
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                    {isEditing && (
                        <div className="flex gap-2 mt-2">
                            <input
                                type="text"
                                value={newFeature}
                                onChange={(e) => setNewFeature(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), onAddFeature())}
                                placeholder="תכונה חדשה..."
                                className="flex-1 px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-xs outline-none focus:ring-2 focus:ring-brand-primary/20"
                            />
                            <button
                                onClick={onAddFeature}
                                className="px-3 py-1.5 bg-brand-primary/10 text-brand-primary rounded-lg text-xs font-bold hover:bg-brand-primary/20 transition-colors"
                            >
                                <FaPlus size={10} />
                            </button>
                        </div>
                    )}
                </div>

                {/* Save Button (editing mode) */}
                {isEditing && (
                    <button
                        onClick={onSave}
                        disabled={saving}
                        className="w-full py-2.5 bg-brand-primary text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-brand-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {saving ? (
                            <>
                                <FaSpinner className="animate-spin" size={12} />
                                שומר...
                            </>
                        ) : (
                            <>
                                <FaSave size={12} />
                                שמור שינויים
                            </>
                        )}
                    </button>
                )}
            </div>
        </div>
    );
}
