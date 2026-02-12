import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import { FaTicketAlt, FaPlus, FaEdit, FaTrash, FaToggleOn, FaToggleOff, FaTimes } from 'react-icons/fa';
import { useAdminAuth } from '../../context/AdminAuthContext';
import promotionService from '../../services/promotionService';
import apiClient from '../../services/apiClient';

const DAY_NAMES = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

const REWARD_TYPE_LABELS = {
    free_item: 'פריט חינם',
    discount_percent: 'הנחה באחוזים',
    discount_fixed: 'הנחה בשקלים',
    fixed_price: 'מחיר קבוע',
};

const emptyForm = () => ({
    name: '',
    description: '',
    start_at: '',
    end_at: '',
    active_hours_start: '',
    active_hours_end: '',
    active_days: null,
    is_active: true,
    priority: 0,
    auto_apply: true,
    gift_required: false,
    stackable: false,
    rules: [{ required_category_id: '', min_quantity: 1 }],
    rewards: [{ reward_type: 'free_item', reward_category_id: '', reward_menu_item_id: '', reward_value: '', max_selectable: 1, _mode: 'specific' }],
});

function getPromotionStatus(promo) {
    if (!promo.is_active) return { label: 'לא פעיל', color: 'bg-gray-100 text-gray-600' };
    const now = new Date();
    if (promo.start_at && new Date(promo.start_at) > now) return { label: 'מתוכנן', color: 'bg-blue-100 text-blue-700' };
    if (promo.end_at && new Date(promo.end_at) < now) return { label: 'פג תוקף', color: 'bg-red-100 text-red-600' };
    return { label: 'פעיל', color: 'bg-green-100 text-green-700' };
}

function summarizeRules(rules) {
    if (!rules || rules.length === 0) return 'ללא תנאים';
    return rules.map(r => `${r.min_quantity} מ-${r.category?.name || 'קטגוריה'}`).join(' + ');
}

function summarizeRewards(rewards) {
    if (!rewards || rewards.length === 0) return 'ללא פרס';
    return rewards.map(r => {
        switch (r.reward_type) {
            case 'free_item':
                return `פריט חינם מ-${r.reward_category?.name || 'קטגוריה'}`;
            case 'discount_percent':
                return `${r.reward_value}% הנחה`;
            case 'discount_fixed':
                return `${r.reward_value} ש"ח הנחה`;
            case 'fixed_price':
                return `מחיר קבוע ${r.reward_value} ש"ח`;
            default:
                return r.reward_type;
        }
    }).join(', ');
}

export default function AdminCoupons() {
    const { isManager, getAuthHeaders } = useAdminAuth();

    const [promotions, setPromotions] = useState([]);
    const [categories, setCategories] = useState([]);
    const [menuItems, setMenuItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingPromo, setEditingPromo] = useState(null);
    const [form, setForm] = useState(emptyForm());

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [promosRes, catsRes, menuRes] = await Promise.all([
                promotionService.getPromotions(),
                apiClient.get('/admin/categories', { headers: getAuthHeaders() }),
                apiClient.get('/menu'),
            ]);
            setPromotions(promosRes.data || []);
            setCategories(catsRes.data?.categories || catsRes.data?.data || []);
            // שליפת פריטי תפריט מכל הקטגוריות
            const cats = menuRes.data?.data || [];
            const allItems = (Array.isArray(cats) ? cats : []).flatMap(cat =>
                (cat.items || []).map(item => ({ ...item, category_name: cat.name }))
            );
            setMenuItems(allItems);
        } catch (err) {
            console.error('Failed to load promotions', err);
        } finally {
            setLoading(false);
        }
    }, [getAuthHeaders]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const openCreate = () => {
        setEditingPromo(null);
        setForm(emptyForm());
        setModalOpen(true);
    };

    const openEdit = (promo) => {
        setEditingPromo(promo);
        setForm({
            name: promo.name || '',
            description: promo.description || '',
            start_at: promo.start_at ? promo.start_at.slice(0, 16) : '',
            end_at: promo.end_at ? promo.end_at.slice(0, 16) : '',
            active_hours_start: promo.active_hours_start || '',
            active_hours_end: promo.active_hours_end || '',
            active_days: promo.active_days || null,
            is_active: promo.is_active,
            priority: promo.priority || 0,
            auto_apply: promo.auto_apply ?? true,
            gift_required: promo.gift_required ?? false,
            stackable: promo.stackable ?? false,
            rules: (promo.rules || []).map(r => ({
                required_category_id: r.required_category_id || '',
                min_quantity: r.min_quantity || 1,
            })),
            rewards: (promo.rewards || []).map(r => ({
                reward_type: r.reward_type || 'free_item',
                reward_category_id: r.reward_category_id || '',
                reward_menu_item_id: r.reward_menu_item_id || '',
                reward_value: r.reward_value || '',
                max_selectable: r.max_selectable || 1,
                _mode: r.reward_menu_item_id ? 'specific' : (r.reward_category_id ? 'category' : 'specific'),
            })),
        });
        if (form.rules.length === 0) setForm(f => ({ ...f, rules: [{ required_category_id: '', min_quantity: 1 }] }));
        if (form.rewards.length === 0) setForm(f => ({ ...f, rewards: [{ reward_type: 'free_item', reward_category_id: '', reward_menu_item_id: '', reward_value: '', max_selectable: 1, _mode: 'specific' }] }));
        setModalOpen(true);
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const payload = {
                ...form,
                start_at: form.start_at || null,
                end_at: form.end_at || null,
                active_hours_start: form.active_hours_start || null,
                active_hours_end: form.active_hours_end || null,
                active_days: form.active_days,
                rewards: form.rewards.map(({ _mode, ...rest }) => rest),
            };
            if (editingPromo) {
                await promotionService.updatePromotion(editingPromo.id, payload);
            } else {
                await promotionService.createPromotion(payload);
            }
            setModalOpen(false);
            fetchData();
        } catch (err) {
            console.error('Save failed', err);
            alert(err.response?.data?.message || 'שגיאה בשמירה');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('למחוק את המבצע?')) return;
        try {
            await promotionService.deletePromotion(id);
            fetchData();
        } catch (err) {
            console.error('Delete failed', err);
        }
    };

    const handleToggle = async (id) => {
        try {
            await promotionService.togglePromotion(id);
            fetchData();
        } catch (err) {
            console.error('Toggle failed', err);
        }
    };

    // Form helpers
    const updateRule = (index, field, value) => {
        setForm(f => {
            const rules = [...f.rules];
            rules[index] = { ...rules[index], [field]: value };
            return { ...f, rules };
        });
    };

    const addRule = () => {
        setForm(f => ({ ...f, rules: [...f.rules, { required_category_id: '', min_quantity: 1 }] }));
    };

    const removeRule = (index) => {
        setForm(f => ({ ...f, rules: f.rules.filter((_, i) => i !== index) }));
    };

    const updateReward = (index, field, value) => {
        setForm(f => {
            const rewards = [...f.rewards];
            rewards[index] = { ...rewards[index], [field]: value };
            return { ...f, rewards };
        });
    };

    const addReward = () => {
        setForm(f => ({ ...f, rewards: [...f.rewards, { reward_type: 'free_item', reward_category_id: '', reward_menu_item_id: '', reward_value: '', max_selectable: 1, _mode: 'specific' }] }));
    };

    const removeReward = (index) => {
        setForm(f => ({ ...f, rewards: f.rewards.filter((_, i) => i !== index) }));
    };

    const toggleDay = (day) => {
        setForm(f => {
            const current = f.active_days || [];
            const next = current.includes(day) ? current.filter(d => d !== day) : [...current, day];
            return { ...f, active_days: next.length > 0 ? next : null };
        });
    };

    return (
        <AdminLayout>
            <div className="max-w-6xl mx-auto space-y-8 pb-32 animate-in fade-in duration-500">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 px-4">
                    <div className="flex items-center gap-5">
                        <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-100/50">
                            <FaTicketAlt size={28} />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-gray-900 tracking-tight">מבצעים</h1>
                            <p className="text-gray-500 font-medium mt-1">יצירה וניהול מבצעים ללקוחות</p>
                        </div>
                    </div>
                    {isManager() && (
                        <button
                            onClick={openCreate}
                            className="w-full md:w-auto bg-brand-primary text-white px-8 py-4 rounded-2xl font-bold hover:bg-brand-dark transition-all flex items-center justify-center gap-3 shadow-lg active:scale-95"
                        >
                            <FaPlus />
                            מבצע חדש
                        </button>
                    )}
                </div>

                {/* List */}
                {loading ? (
                    <div className="text-center py-20 text-gray-400">טוען מבצעים...</div>
                ) : promotions.length === 0 ? (
                    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-12 text-center mx-4">
                        <div className="w-20 h-20 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500 mx-auto mb-6">
                            <FaTicketAlt size={28} />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2">אין מבצעים עדיין</h2>
                        <p className="text-gray-500">לחצ/י על "מבצע חדש" כדי ליצור את המבצע הראשון</p>
                    </div>
                ) : (
                    <div className="space-y-4 px-4">
                        {promotions.map(promo => {
                            const status = getPromotionStatus(promo);
                            return (
                                <div key={promo.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                                    <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 mb-2">
                                                <h3 className="text-lg font-bold text-gray-900 truncate">{promo.name}</h3>
                                                <span className={`text-xs font-bold px-3 py-1 rounded-full ${status.color}`}>
                                                    {status.label}
                                                </span>
                                                {promo.priority > 0 && (
                                                    <span className="text-xs text-gray-400">עדיפות: {promo.priority}</span>
                                                )}
                                            </div>
                                            {promo.description && (
                                                <p className="text-sm text-gray-500 mb-2">{promo.description}</p>
                                            )}
                                            <div className="flex flex-wrap gap-2 text-xs">
                                                <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium">
                                                    {summarizeRules(promo.rules)}
                                                </span>
                                                <span className="bg-purple-50 text-purple-700 px-3 py-1 rounded-full font-medium">
                                                    {summarizeRewards(promo.rewards)}
                                                </span>
                                                {promo.gift_required && (
                                                    <span className="bg-yellow-50 text-yellow-700 px-3 py-1 rounded-full font-medium">
                                                        בחירת מתנה חובה
                                                    </span>
                                                )}
                                                {promo.stackable && (
                                                    <span className="bg-gray-50 text-gray-600 px-3 py-1 rounded-full font-medium">
                                                        ניתן לשילוב
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {isManager() && (
                                            <div className="flex items-center gap-2 shrink-0">
                                                <button
                                                    onClick={() => handleToggle(promo.id)}
                                                    className={`p-2 rounded-xl transition-colors ${promo.is_active ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-50'}`}
                                                    title={promo.is_active ? 'השבת' : 'הפעל'}
                                                >
                                                    {promo.is_active ? <FaToggleOn size={22} /> : <FaToggleOff size={22} />}
                                                </button>
                                                <button
                                                    onClick={() => openEdit(promo)}
                                                    className="p-2 rounded-xl text-blue-600 hover:bg-blue-50 transition-colors"
                                                    title="ערוך"
                                                >
                                                    <FaEdit size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(promo.id)}
                                                    className="p-2 rounded-xl text-red-500 hover:bg-red-50 transition-colors"
                                                    title="מחק"
                                                >
                                                    <FaTrash size={14} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Modal */}
            {modalOpen && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl my-8 relative">
                        {/* Modal Header */}
                        <div className="sticky top-0 bg-white rounded-t-3xl border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
                            <h2 className="text-xl font-bold text-gray-900">
                                {editingPromo ? 'עריכת מבצע' : 'מבצע חדש'}
                            </h2>
                            <button onClick={() => setModalOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-50">
                                <FaTimes size={18} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                            {/* Part 1: Basic Details */}
                            <div className="space-y-4">
                                <h3 className="font-bold text-gray-800 border-b border-gray-100 pb-2">פרטים בסיסיים</h3>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">שם המבצע *</label>
                                    <input
                                        type="text"
                                        value={form.name}
                                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                        className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none"
                                        placeholder="למשל: קנה 2 פיצות וקבל קינוח"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">תיאור</label>
                                    <textarea
                                        value={form.description}
                                        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                        className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none"
                                        rows={2}
                                        placeholder="תיאור קצר שיופיע ללקוח"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">מתאריך</label>
                                        <input type="datetime-local" value={form.start_at} onChange={e => setForm(f => ({ ...f, start_at: e.target.value }))}
                                            className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">עד תאריך</label>
                                        <input type="datetime-local" value={form.end_at} onChange={e => setForm(f => ({ ...f, end_at: e.target.value }))}
                                            className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none text-sm" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">משעה</label>
                                        <input type="time" value={form.active_hours_start} onChange={e => setForm(f => ({ ...f, active_hours_start: e.target.value }))}
                                            className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">עד שעה</label>
                                        <input type="time" value={form.active_hours_end} onChange={e => setForm(f => ({ ...f, active_hours_end: e.target.value }))}
                                            className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none" />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">ימים פעילים</label>
                                    <div className="flex gap-2">
                                        {DAY_NAMES.map((name, i) => (
                                            <button
                                                key={i}
                                                type="button"
                                                onClick={() => toggleDay(i)}
                                                className={`w-10 h-10 rounded-xl text-sm font-bold transition-colors ${(form.active_days || []).includes(i)
                                                    ? 'bg-brand-primary text-white'
                                                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                                    }`}
                                            >
                                                {name}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1">השאר ריק = כל הימים</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">עדיפות</label>
                                        <input type="number" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: parseInt(e.target.value) || 0 }))}
                                            className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none"
                                            min={0} />
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-6">
                                    {[
                                        { key: 'is_active', label: 'פעיל' },
                                        { key: 'auto_apply', label: 'הפעלה אוטומטית' },
                                        { key: 'gift_required', label: 'בחירת מתנה חובה' },
                                        { key: 'stackable', label: 'ניתן לשילוב' },
                                    ].map(({ key, label }) => (
                                        <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={form[key]}
                                                onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))}
                                                className="w-5 h-5 rounded-lg border-gray-300 text-brand-primary focus:ring-brand-primary/20"
                                            />
                                            <span className="text-sm font-medium text-gray-700">{label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Part 2: Rules */}
                            <div className="space-y-4">
                                <h3 className="font-bold text-gray-800 border-b border-gray-100 pb-2">תנאים (AND)</h3>
                                {form.rules.map((rule, i) => (
                                    <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                                        <input
                                            type="number"
                                            value={rule.min_quantity}
                                            onChange={e => updateRule(i, 'min_quantity', parseInt(e.target.value) || 1)}
                                            className="w-20 border border-gray-200 rounded-lg px-3 py-2 text-center focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none"
                                            min={1}
                                        />
                                        <span className="text-sm text-gray-500 font-medium">פריטים מ-</span>
                                        <select
                                            value={rule.required_category_id}
                                            onChange={e => updateRule(i, 'required_category_id', parseInt(e.target.value) || '')}
                                            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none"
                                        >
                                            <option value="">בחר קטגוריה</option>
                                            {categories.map(cat => (
                                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                                            ))}
                                        </select>
                                        {form.rules.length > 1 && (
                                            <button onClick={() => removeRule(i)} className="p-2 text-red-400 hover:text-red-600">
                                                <FaTimes size={14} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button onClick={addRule} className="text-sm text-brand-primary font-bold hover:underline">
                                    + הוסף תנאי
                                </button>
                            </div>

                            {/* Part 3: Rewards */}
                            <div className="space-y-4">
                                <h3 className="font-bold text-gray-800 border-b border-gray-100 pb-2">פרסים</h3>
                                {form.rewards.map((reward, i) => (
                                    <div key={i} className="bg-gray-50 rounded-xl p-4 space-y-3">
                                        <div className="flex items-center gap-3">
                                            <select
                                                value={reward.reward_type}
                                                onChange={e => updateReward(i, 'reward_type', e.target.value)}
                                                className="border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none"
                                            >
                                                {Object.entries(REWARD_TYPE_LABELS).map(([val, label]) => (
                                                    <option key={val} value={val}>{label}</option>
                                                ))}
                                            </select>
                                            {form.rewards.length > 1 && (
                                                <button onClick={() => removeReward(i)} className="p-2 text-red-400 hover:text-red-600 mr-auto">
                                                    <FaTimes size={14} />
                                                </button>
                                            )}
                                        </div>

                                        {reward.reward_type === 'free_item' && (
                                            <div className="space-y-3">
                                                {/* בחירת סוג: מוצר ספציפי או קטגוריה */}
                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => { updateReward(i, '_mode', 'specific'); updateReward(i, 'reward_category_id', ''); }}
                                                        className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${reward._mode === 'specific' ? 'bg-brand-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                                    >
                                                        מוצר ספציפי
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => { updateReward(i, '_mode', 'category'); updateReward(i, 'reward_menu_item_id', ''); }}
                                                        className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${reward._mode === 'category' ? 'bg-brand-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                                    >
                                                        בחירה מקטגוריה
                                                    </button>
                                                </div>

                                                <div className="grid grid-cols-2 gap-3">
                                                    {reward._mode === 'specific' ? (
                                                        <div>
                                                            <label className="block text-xs text-gray-500 mb-1">בחר מוצר</label>
                                                            <select
                                                                value={reward.reward_menu_item_id}
                                                                onChange={e => {
                                                                    updateReward(i, 'reward_menu_item_id', parseInt(e.target.value) || '');
                                                                    updateReward(i, 'reward_category_id', '');
                                                                }}
                                                                className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none"
                                                            >
                                                                <option value="">בחר מוצר</option>
                                                                {menuItems.map(item => (
                                                                    <option key={item.id} value={item.id}>
                                                                        {item.name} ({item.category_name})
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    ) : (
                                                        <div>
                                                            <label className="block text-xs text-gray-500 mb-1">קטגוריית הפרס</label>
                                                            <select
                                                                value={reward.reward_category_id}
                                                                onChange={e => updateReward(i, 'reward_category_id', parseInt(e.target.value) || '')}
                                                                className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none"
                                                            >
                                                                <option value="">בחר קטגוריה</option>
                                                                {categories.map(cat => (
                                                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    )}
                                                    <div>
                                                        <label className="block text-xs text-gray-500 mb-1">כמות</label>
                                                        <input
                                                            type="number"
                                                            value={reward.max_selectable}
                                                            onChange={e => updateReward(i, 'max_selectable', parseInt(e.target.value) || 1)}
                                                            className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none"
                                                            min={1}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {(reward.reward_type === 'discount_percent' || reward.reward_type === 'discount_fixed' || reward.reward_type === 'fixed_price') && (
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">
                                                    {reward.reward_type === 'discount_percent' ? 'אחוז הנחה' : reward.reward_type === 'discount_fixed' ? 'סכום הנחה (ש"ח)' : 'מחיר קבוע (ש"ח)'}
                                                </label>
                                                <input
                                                    type="number"
                                                    value={reward.reward_value}
                                                    onChange={e => updateReward(i, 'reward_value', e.target.value)}
                                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none"
                                                    min={0}
                                                    step={reward.reward_type === 'discount_percent' ? 1 : 0.01}
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}
                                <button onClick={addReward} className="text-sm text-brand-primary font-bold hover:underline">
                                    + הוסף פרס
                                </button>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="sticky bottom-0 bg-white rounded-b-3xl border-t border-gray-100 px-6 py-4 flex justify-end gap-3">
                            <button
                                onClick={() => setModalOpen(false)}
                                className="px-6 py-3 rounded-xl text-gray-600 font-bold hover:bg-gray-50 transition-colors"
                            >
                                ביטול
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving || !form.name}
                                className="px-8 py-3 rounded-xl bg-brand-primary text-white font-bold hover:bg-brand-dark transition-colors disabled:opacity-50"
                            >
                                {saving ? 'שומר...' : editingPromo ? 'עדכן' : 'צור מבצע'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}
