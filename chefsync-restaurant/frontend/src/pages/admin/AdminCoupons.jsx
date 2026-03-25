import { useState, useEffect, useCallback, useMemo } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import MobileAddFab from '../../components/admin/MobileAddFab';
import { FaTicketAlt, FaPlus, FaEdit, FaTrash, FaToggleOn, FaToggleOff, FaTimes } from 'react-icons/fa';
import { useAdminAuth } from '../../context/AdminAuthContext';
import promotionService from '../../services/promotionService';
import apiClient from '../../services/apiClient';
import { resolveAssetUrl } from '../../utils/assets';
import { compressPromotionImage } from '../../utils/compressPromotionImage';

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
    image: null,
    imagePreview: null,
    removeImage: false,
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
    show_menu_banner: true,
    show_entry_popup: true,
    rules: [{ required_category_id: '', min_quantity: 1 }],
    rewards: [{
        reward_type: 'free_item',
        reward_category_id: '',
        reward_menu_item_id: '',
        reward_value: '',
        max_selectable: 1,
        discount_scope: 'whole_cart',
        discount_menu_item_ids: [],
        _mode: 'specific',
    }],
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
                return `${r.reward_value}% הנחה${r.discount_scope === 'selected_items' ? ' (על פריטים נבחרים)' : ''}`;
            case 'discount_fixed':
                return `${r.reward_value} ש"ח הנחה${r.discount_scope === 'selected_items' ? ' ליחידה (פריטים נבחרים)' : ''}`;
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
    const [promoWizardStep, setPromoWizardStep] = useState(1);
    const [form, setForm] = useState(emptyForm());
    const [serverErrors, setServerErrors] = useState({});

    const formErrors = useMemo(() => {
        const err = {};
        if (!form.name?.trim()) err.name = 'נא למלא שם מבצע';
        const rules = form.rules || [];
        const validRuleCount = rules.filter((r) => {
            const cid = r.required_category_id;
            return cid !== '' && cid != null && Number(cid) > 0;
        }).length;
        if (rules.length > 0 && validRuleCount === 0) {
            err.rules_global = 'נא לבחור קטגוריה בכל תנאי';
        }
        rules.forEach((rule, i) => {
            if (!rule.required_category_id || Number(rule.required_category_id) <= 0) {
                err[`rules.${i}.required_category_id`] = 'בחר קטגוריה';
            }
            if (!rule.min_quantity || Number(rule.min_quantity) < 1) {
                err[`rules.${i}.min_quantity`] = 'מינימום 1';
            }
        });
        (form.rewards || []).forEach((reward, i) => {
            if (reward.reward_type === 'discount_percent' || reward.reward_type === 'discount_fixed') {
                const v = reward.reward_value;
                if (v === '' || v === null || v === undefined || Number(v) < 0) {
                    err[`rewards.${i}.reward_value`] = 'נא למלא ערך הנחה תקין';
                }
                if (reward.discount_scope === 'selected_items' && (!reward.discount_menu_item_ids || reward.discount_menu_item_ids.length === 0)) {
                    err[`rewards.${i}.discount_menu_item_ids`] = 'נא לבחור לפחות מוצר אחד';
                }
            }
            if (reward.reward_type === 'fixed_price') {
                const v = reward.reward_value;
                if (v === '' || v === null || v === undefined || Number(v) < 0) {
                    err[`rewards.${i}.reward_value`] = 'נא למלא מחיר תקין';
                }
            }
            if (reward.reward_type === 'free_item') {
                if (reward._mode === 'specific' && !reward.reward_menu_item_id) {
                    err[`rewards.${i}.free`] = 'נא לבחור מוצר מתנה';
                }
                if (reward._mode === 'category' && !reward.reward_category_id) {
                    err[`rewards.${i}.free`] = 'נא לבחור קטגוריית מתנה';
                }
            }
        });
        return err;
    }, [form]);

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
        setServerErrors({});
        setPromoWizardStep(1);
        setModalOpen(true);
    };

    const openEdit = (promo) => {
        setEditingPromo(promo);
        let rules = (promo.rules || []).map(r => ({
            required_category_id: r.required_category_id || '',
            min_quantity: r.min_quantity || 1,
        }));
        if (rules.length === 0) {
            rules = [{ required_category_id: '', min_quantity: 1 }];
        }
        let rewards = (promo.rewards || []).map(r => ({
            reward_type: r.reward_type || 'free_item',
            reward_category_id: r.reward_category_id || '',
            reward_menu_item_id: r.reward_menu_item_id || '',
            reward_value: r.reward_value ?? '',
            max_selectable: r.max_selectable || 1,
            discount_scope: r.discount_scope || 'whole_cart',
            discount_menu_item_ids: Array.isArray(r.discount_menu_item_ids) ? r.discount_menu_item_ids : [],
            _mode: r.reward_menu_item_id ? 'specific' : (r.reward_category_id ? 'category' : 'specific'),
        }));
        if (rewards.length === 0) {
            rewards = [{
                reward_type: 'free_item',
                reward_category_id: '',
                reward_menu_item_id: '',
                reward_value: '',
                max_selectable: 1,
                discount_scope: 'whole_cart',
                discount_menu_item_ids: [],
                _mode: 'specific',
            }];
        }
        setForm({
            name: promo.name || '',
            description: promo.description || '',
            image: null,
            imagePreview: null,
            removeImage: false,
            start_at: promo.start_at ? promo.start_at.slice(0, 16) : '',
            end_at: promo.end_at ? promo.end_at.slice(0, 16) : '',
            active_hours_start: (promo.active_hours_start || '').slice(0, 5),
            active_hours_end: (promo.active_hours_end || '').slice(0, 5),
            active_days: promo.active_days || null,
            is_active: promo.is_active,
            priority: promo.priority || 0,
            auto_apply: promo.auto_apply ?? true,
            gift_required: promo.gift_required ?? false,
            stackable: promo.stackable ?? false,
            show_menu_banner: promo.show_menu_banner !== false,
            show_entry_popup: promo.show_entry_popup !== false,
            rules,
            rewards,
        });
        setServerErrors({});
        setPromoWizardStep(1);
        setModalOpen(true);
    };

    const goPromoWizardNext = () => {
        if (!editingPromo && promoWizardStep === 1) {
            if (!form.name?.trim()) return;
        }
        if (!editingPromo && promoWizardStep === 2) {
            const validRuleCount = (form.rules || []).filter((r) => {
                const cid = r.required_category_id;
                return cid !== '' && cid != null && Number(cid) > 0;
            }).length;
            if (validRuleCount === 0) return;
        }
        setPromoWizardStep((s) => Math.min(3, s + 1));
    };

    const goPromoWizardPrev = () => setPromoWizardStep((s) => Math.max(1, s - 1));

    const handleSave = async () => {
        if (Object.keys(formErrors).length > 0) {
            return;
        }
        try {
            setSaving(true);
            setServerErrors({});
            const { imagePreview, removeImage, ...rest } = form;
            const validRules = (form.rules || []).filter((r) => {
                const cid = r.required_category_id;
                return cid !== '' && cid != null && Number(cid) > 0;
            });
            const payload = {
                ...rest,
                rules: validRules,
                start_at: form.start_at || null,
                end_at: form.end_at || null,
                active_hours_start: form.active_hours_start || null,
                active_hours_end: form.active_hours_end || null,
                active_days: form.active_days,
                rewards: form.rewards.map(({ _mode, ...r }) => r),
                remove_image: removeImage || false,
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
            const st = err.response?.status;
            if (err.response?.data?.errors && typeof err.response.data.errors === 'object') {
                setServerErrors(err.response.data.errors);
            }
            if (st === 413) {
                alert('הבקשה גדולה מדי לשרת (לרוב תמונה). התמונה מכווצת אוטומטית — נסה שוב; אם נמשך, השתמש בתמונה קטנה יותר או בקש מהתמיכה להגדיל את מגבלת ההעלאה בשרת.');
            } else {
                const msgs = err.response?.data?.errors && typeof err.response.data.errors === 'object'
                    ? Object.values(err.response.data.errors).flat().filter(Boolean)
                    : [];
                alert(msgs[0] || err.response?.data?.message || 'שגיאה בשמירה');
            }
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
        setForm(f => ({
            ...f,
            rewards: [...f.rewards, {
                reward_type: 'free_item',
                reward_category_id: '',
                reward_menu_item_id: '',
                reward_value: '',
                max_selectable: 1,
                discount_scope: 'whole_cart',
                discount_menu_item_ids: [],
                _mode: 'specific',
            }],
        }));
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

    const setRewardTypeAt = (index, reward_type) => {
        setForm((f) => {
            const rewards = [...f.rewards];
            const r = { ...rewards[index], reward_type };
            if (reward_type !== 'discount_percent' && reward_type !== 'discount_fixed') {
                r.discount_scope = 'whole_cart';
                r.discount_menu_item_ids = [];
            }
            rewards[index] = r;
            return { ...f, rewards };
        });
    };

    const canPromoWizardNext = () => {
        if (editingPromo) return false;
        if (promoWizardStep === 1) return !!form.name?.trim();
        if (promoWizardStep === 2) {
            return (form.rules || []).some((r) => {
                const cid = r.required_category_id;
                return cid !== '' && cid != null && Number(cid) > 0;
            });
        }
        return true;
    };

    const serverErrorText = (key) => {
        const e = serverErrors[key];
        if (!e) return null;
        return Array.isArray(e) ? e[0] : String(e);
    };

    return (
        <AdminLayout>
            <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8 pb-28 sm:pb-32 animate-in fade-in duration-500 w-full min-w-0 overflow-x-hidden">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 px-4">
                    <div className="flex items-start sm:items-center gap-3 sm:gap-5 min-w-0">
                        <div className="w-12 h-12 sm:w-16 sm:h-16 bg-emerald-50 rounded-xl sm:rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-100/50 shrink-0">
                            <FaTicketAlt className="text-xl sm:text-[28px]" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight break-words">מבצעים</h1>
                            <p className="text-gray-500 font-medium mt-1 text-sm sm:text-base">יצירה וניהול מבצעים ללקוחות</p>
                        </div>
                    </div>
                    {isManager() && (
                        <button
                            onClick={openCreate}
                            className="hidden md:flex w-full md:w-auto bg-brand-primary text-white px-8 py-4 rounded-2xl font-bold hover:bg-brand-dark transition-all items-center justify-center gap-3 shadow-lg active:scale-95"
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
                    <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-gray-100 p-8 sm:p-12 text-center mx-4">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500 mx-auto mb-4 sm:mb-6">
                            <FaTicketAlt className="text-2xl sm:text-[28px]" />
                        </div>
                        <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">אין מבצעים עדיין</h2>
                        <p className="text-gray-500 text-sm sm:text-base px-2">לחצ/י על &quot;מבצע חדש&quot; כדי ליצור את המבצע הראשון</p>
                    </div>
                ) : (
                    <div className="space-y-3 sm:space-y-4 px-3 sm:px-4">
                        {promotions.map(promo => {
                            const status = getPromotionStatus(promo);
                            return (
                                <div key={promo.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
                                    <div className="flex flex-col gap-4">
                                        <div className="flex-1 min-w-0 w-full">
                                            <div className="flex flex-wrap items-center gap-2 mb-2">
                                                <h3 className="text-base sm:text-lg font-bold text-gray-900 break-words flex-1 min-w-0">{promo.name}</h3>
                                                <span className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${status.color}`}>
                                                    {status.label}
                                                </span>
                                                {promo.priority > 0 && (
                                                    <span className="text-xs text-gray-400 shrink-0">עדיפות: {promo.priority}</span>
                                                )}
                                            </div>
                                            {promo.description && (
                                                <p className="text-sm text-gray-500 mb-2 break-words">{promo.description}</p>
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
                                            <div className="flex items-center justify-end sm:justify-start gap-2 pt-2 sm:pt-0 border-t border-gray-50 sm:border-0 shrink-0 -mx-1 px-1">
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggle(promo.id)}
                                                    className={`p-2.5 sm:p-2 rounded-xl transition-colors ${promo.is_active ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-50'}`}
                                                    title={promo.is_active ? 'השבת' : 'הפעל'}
                                                >
                                                    {promo.is_active ? <FaToggleOn size={22} /> : <FaToggleOff size={22} />}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => openEdit(promo)}
                                                    className="p-2.5 sm:p-2 rounded-xl text-blue-600 hover:bg-blue-50 transition-colors"
                                                    title="ערוך"
                                                >
                                                    <FaEdit size={16} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(promo.id)}
                                                    className="p-2.5 sm:p-2 rounded-xl text-red-500 hover:bg-red-50 transition-colors"
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
                {isManager() && !modalOpen && (
                    <MobileAddFab label="מבצע חדש" onClick={openCreate} />
                )}
            </div>

            {/* Modal */}
            {modalOpen && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
                    <div className="bg-white rounded-t-[1.75rem] sm:rounded-3xl shadow-2xl w-full max-w-2xl my-0 sm:my-8 relative max-h-[min(92dvh,90vh)] flex flex-col min-h-0">
                        {/* Modal Header */}
                        <div className="sticky top-0 bg-white rounded-t-[1.75rem] sm:rounded-t-3xl border-b border-gray-100 px-4 sm:px-6 py-4 flex items-center justify-between z-10 shrink-0">
                            <div className="min-w-0">
                                <h2 className="text-xl font-bold text-gray-900">
                                    {editingPromo ? 'עריכת מבצע' : 'מבצע חדש'}
                                </h2>
                                {!editingPromo && (
                                    <p className="text-[11px] font-bold text-gray-400 mt-1">
                                        שלב {promoWizardStep} מתוך 3 — פרטים · תנאים · פרסים
                                    </p>
                                )}
                            </div>
                            <button type="button" onClick={() => { setModalOpen(false); setPromoWizardStep(1); setServerErrors({}); }} className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-50 shrink-0">
                                <FaTimes size={18} />
                            </button>
                        </div>

                        <div className="p-4 sm:p-6 space-y-6 flex-1 overflow-y-auto min-h-0">
                            {/* Part 1: Basic Details */}
                            {(editingPromo || promoWizardStep === 1) && (
                            <div className="space-y-4">
                                <h3 className="font-bold text-gray-800 border-b border-gray-100 pb-2">פרטים בסיסיים</h3>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">שם המבצע *</label>
                                    <input
                                        type="text"
                                        value={form.name}
                                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                        className={`w-full min-w-0 border rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none text-base ${formErrors.name || serverErrorText('name') ? 'border-red-300' : 'border-gray-200'}`}
                                        placeholder="למשל: קנה 2 פיצות וקבל קינוח"
                                    />
                                    {(formErrors.name || serverErrorText('name')) && (
                                        <p className="text-xs text-red-600 mt-1 font-medium">{formErrors.name || serverErrorText('name')}</p>
                                    )}
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

                                {/* תמונת מבצע */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">תמונת מבצע</label>
                                    <p className="text-xs text-gray-500 mb-2">תמונות גדולות נדחסות אוטומטית לפני השליחה כדי למנוע שגיאת העלאה.</p>
                                    {(form.imagePreview || (editingPromo?.image_url && !form.removeImage)) && (
                                        <div className="relative inline-block mb-2">
                                            <img
                                                src={form.imagePreview || resolveAssetUrl(editingPromo?.image_url)}
                                                alt="תמונת מבצע"
                                                className="w-32 h-20 object-cover rounded-xl border border-gray-200"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setForm(f => ({ ...f, image: null, imagePreview: null, removeImage: true }))}
                                                className="absolute -top-2 -right-2 bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs"
                                            >
                                                <FaTimes size={8} />
                                            </button>
                                        </div>
                                    )}
                                    <input
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp,image/gif"
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            const maxBytes = 12 * 1024 * 1024;
                                            if (file.size > maxBytes) {
                                                alert('הקובץ גדול מדי (מקסימום 12MB לפני דחיסה)');
                                                e.target.value = '';
                                                return;
                                            }
                                            if (!file.type.startsWith('image/')) {
                                                alert('יש לבחור קובץ תמונה');
                                                e.target.value = '';
                                                return;
                                            }
                                            try {
                                                const processed = await compressPromotionImage(file);
                                                setForm(f => ({
                                                    ...f,
                                                    image: processed,
                                                    imagePreview: URL.createObjectURL(processed),
                                                    removeImage: false,
                                                }));
                                            } catch (err) {
                                                console.error(err);
                                                alert('לא ניתן לעבד את התמונה. נסה קובץ אחר.');
                                                e.target.value = '';
                                            }
                                        }}
                                        className="w-full min-w-0 text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-brand-primary/10 file:text-brand-primary hover:file:bg-brand-primary/20"
                                    />
                                </div>

                                {/* תקופת המבצע */}
                                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">תקופת המבצע</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="min-w-0">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">מתאריך</label>
                                            <input type="datetime-local" dir="ltr" value={form.start_at} onChange={e => setForm(f => ({ ...f, start_at: e.target.value }))}
                                                className="w-full min-w-0 max-w-full box-border border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none text-base bg-white" />
                                        </div>
                                        <div className="min-w-0">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">עד תאריך</label>
                                            <input type="datetime-local" dir="ltr" value={form.end_at} onChange={e => setForm(f => ({ ...f, end_at: e.target.value }))}
                                                className="w-full min-w-0 max-w-full box-border border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none text-base bg-white" />
                                        </div>
                                    </div>
                                </div>

                                {/* שעות פעילות יומיות */}
                                <div className="bg-blue-50 rounded-xl p-4 space-y-3">
                                    <p className="text-xs font-bold text-blue-600 uppercase tracking-wide">שעות פעילות יומיות</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="min-w-0">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">משעה</label>
                                            <input type="time" dir="ltr" value={form.active_hours_start} onChange={e => setForm(f => ({ ...f, active_hours_start: e.target.value }))}
                                                className="w-full min-w-0 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none text-base bg-white" />
                                        </div>
                                        <div className="min-w-0">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">עד שעה</label>
                                            <input type="time" dir="ltr" value={form.active_hours_end} onChange={e => setForm(f => ({ ...f, active_hours_end: e.target.value }))}
                                                className="w-full min-w-0 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none text-base bg-white" />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">ימים פעילים</label>
                                    <div className="flex flex-wrap gap-2">
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

                                <div className="rounded-xl border border-orange-100 bg-orange-50/50 p-4 space-y-3">
                                    <p className="text-xs font-bold text-orange-800 uppercase tracking-wide">תצוגה בתפריט לקוח</p>
                                    <label className="flex items-center gap-2 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={form.show_menu_banner}
                                            onChange={e => setForm(f => ({ ...f, show_menu_banner: e.target.checked }))}
                                            className="w-5 h-5 rounded-lg border-gray-300 text-brand-primary focus:ring-brand-primary/20"
                                        />
                                        <span className="text-sm font-medium text-gray-800">הצג באנר מבצעים מעל התפריט</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={form.show_entry_popup}
                                            onChange={e => setForm(f => ({ ...f, show_entry_popup: e.target.checked }))}
                                            className="w-5 h-5 rounded-lg border-gray-300 text-brand-primary focus:ring-brand-primary/20"
                                        />
                                        <span className="text-sm font-medium text-gray-800">הצג חלון כניסה עם מבצעים (פעם אחת לדפדפן)</span>
                                    </label>
                                </div>
                            </div>
                            )}

                            {(editingPromo || promoWizardStep === 2) && (
                            <div className="space-y-4">
                                <h3 className="font-bold text-gray-800 border-b border-gray-100 pb-2">תנאים (AND)</h3>
                                {(formErrors.rules_global || serverErrorText('rules')) && (
                                    <p className="text-sm text-red-600 font-medium">{formErrors.rules_global || serverErrorText('rules')}</p>
                                )}
                                {form.rules.map((rule, i) => (
                                    <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-3 bg-gray-50 rounded-xl p-3 min-w-0">
                                        <input
                                            type="number"
                                            value={rule.min_quantity}
                                            onChange={e => updateRule(i, 'min_quantity', parseInt(e.target.value, 10) || 1)}
                                            className={`w-20 border rounded-lg px-3 py-2 text-center focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none ${formErrors[`rules.${i}.min_quantity`] || serverErrorText(`rules.${i}.min_quantity`) ? 'border-red-300' : 'border-gray-200'}`}
                                            min={1}
                                        />
                                        <span className="text-sm text-gray-500 font-medium">פריטים מ-</span>
                                        <select
                                            value={rule.required_category_id === '' ? '' : String(rule.required_category_id)}
                                            onChange={e => updateRule(i, 'required_category_id', e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                                            className={`flex-1 min-w-0 border rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none text-base ${formErrors[`rules.${i}.required_category_id`] || serverErrorText(`rules.${i}.required_category_id`) ? 'border-red-300' : 'border-gray-200'}`}
                                        >
                                            <option value="">בחר קטגוריה</option>
                                            {categories.map(cat => (
                                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                                            ))}
                                        </select>
                                        {form.rules.length > 1 && (
                                            <button type="button" onClick={() => removeRule(i)} className="p-2 text-red-400 hover:text-red-600 self-end sm:self-auto">
                                                <FaTimes size={14} />
                                            </button>
                                        )}
                                        {(formErrors[`rules.${i}.required_category_id`] || formErrors[`rules.${i}.min_quantity`] || serverErrorText(`rules.${i}.required_category_id`) || serverErrorText(`rules.${i}.min_quantity`)) && (
                                            <p className="text-xs text-red-600 sm:col-span-full w-full">
                                                {formErrors[`rules.${i}.required_category_id`] || serverErrorText(`rules.${i}.required_category_id`) || formErrors[`rules.${i}.min_quantity`] || serverErrorText(`rules.${i}.min_quantity`)}
                                            </p>
                                        )}
                                    </div>
                                ))}
                                <button onClick={addRule} className="text-sm text-brand-primary font-bold hover:underline">
                                    + הוסף תנאי
                                </button>
                            </div>
                            )}

                            {(editingPromo || promoWizardStep === 3) && (
                            <div className="space-y-4">
                                <h3 className="font-bold text-gray-800 border-b border-gray-100 pb-2">פרסים</h3>
                                {form.rewards.map((reward, i) => (
                                    <div key={i} className="bg-gray-50 rounded-xl p-4 space-y-3">
                                        <div className="flex items-center gap-3">
                                            <select
                                                value={reward.reward_type}
                                                onChange={e => setRewardTypeAt(i, e.target.value)}
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

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
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
                                            <div className="space-y-3">
                                                {(reward.reward_type === 'discount_percent' || reward.reward_type === 'discount_fixed') && (
                                                    <div>
                                                        <p className="text-xs font-bold text-gray-600 mb-2">היקף ההנחה</p>
                                                        <div className="flex flex-wrap gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setForm((f) => {
                                                                        const rewards = [...f.rewards];
                                                                        rewards[i] = {
                                                                            ...rewards[i],
                                                                            discount_scope: 'whole_cart',
                                                                            discount_menu_item_ids: [],
                                                                        };
                                                                        return { ...f, rewards };
                                                                    });
                                                                }}
                                                                className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${(reward.discount_scope || 'whole_cart') === 'whole_cart' ? 'bg-brand-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                                            >
                                                                כל הסל
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => updateReward(i, 'discount_scope', 'selected_items')}
                                                                className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${reward.discount_scope === 'selected_items' ? 'bg-brand-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                                            >
                                                                מוצרים נבחרים
                                                            </button>
                                                        </div>
                                                        {reward.discount_scope === 'selected_items' && (
                                                            <div className="mt-2">
                                                                <label className="block text-xs text-gray-500 mb-1">בחר מוצרים (Ctrl/Cmd לבחירה מרובה)</label>
                                                                <select
                                                                    multiple
                                                                    size={Math.min(8, Math.max(4, menuItems.length))}
                                                                    value={(reward.discount_menu_item_ids || []).map(String)}
                                                                    onChange={(e) => {
                                                                        const selected = Array.from(e.target.selectedOptions, (opt) => parseInt(opt.value, 10));
                                                                        updateReward(i, 'discount_menu_item_ids', selected);
                                                                    }}
                                                                    className={`w-full border rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none ${formErrors[`rewards.${i}.discount_menu_item_ids`] || serverErrorText(`rewards.${i}.discount_menu_item_ids`) ? 'border-red-300' : 'border-gray-200'}`}
                                                                >
                                                                    {menuItems.map((item) => (
                                                                        <option key={item.id} value={item.id}>
                                                                            {item.name} ({item.category_name})
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                                {(formErrors[`rewards.${i}.discount_menu_item_ids`] || serverErrorText(`rewards.${i}.discount_menu_item_ids`)) && (
                                                                    <p className="text-xs text-red-600 mt-1">{formErrors[`rewards.${i}.discount_menu_item_ids`] || serverErrorText(`rewards.${i}.discount_menu_item_ids`)}</p>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                <div>
                                                    <label className="block text-xs text-gray-500 mb-1">
                                                        {reward.reward_type === 'discount_percent' ? 'אחוז הנחה' : reward.reward_type === 'discount_fixed' ? 'סכום הנחה ליחידה (ש"ח)' : 'מחיר קבוע (ש"ח)'}
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={reward.reward_value}
                                                        onChange={e => updateReward(i, 'reward_value', e.target.value)}
                                                        className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none ${formErrors[`rewards.${i}.reward_value`] || serverErrorText(`rewards.${i}.reward_value`) ? 'border-red-300' : 'border-gray-200'}`}
                                                        min={0}
                                                        step={reward.reward_type === 'discount_percent' ? 1 : 0.01}
                                                    />
                                                    {(formErrors[`rewards.${i}.reward_value`] || serverErrorText(`rewards.${i}.reward_value`)) && (
                                                        <p className="text-xs text-red-600 mt-1">{formErrors[`rewards.${i}.reward_value`] || serverErrorText(`rewards.${i}.reward_value`)}</p>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        {reward.reward_type === 'free_item' && (formErrors[`rewards.${i}.free`] || serverErrorText(`rewards.${i}.reward_menu_item_id`) || serverErrorText(`rewards.${i}.reward_category_id`)) && (
                                            <p className="text-xs text-red-600">{formErrors[`rewards.${i}.free`] || serverErrorText(`rewards.${i}.reward_menu_item_id`) || serverErrorText(`rewards.${i}.reward_category_id`)}</p>
                                        )}
                                    </div>
                                ))}
                                <button onClick={addReward} className="text-sm text-brand-primary font-bold hover:underline">
                                    + הוסף פרס
                                </button>
                            </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="sticky bottom-0 bg-white rounded-b-[1.75rem] sm:rounded-b-3xl border-t border-gray-100 px-4 sm:px-6 py-4 flex flex-col sm:flex-row flex-wrap justify-end gap-2 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
                            {!editingPromo && promoWizardStep > 1 && (
                                <button
                                    type="button"
                                    onClick={goPromoWizardPrev}
                                    className="order-2 sm:order-1 px-6 py-3 rounded-xl border border-gray-200 text-gray-700 font-bold hover:bg-gray-50 w-full sm:w-auto"
                                >
                                    הקודם
                                </button>
                            )}
                            {!editingPromo && promoWizardStep < 3 && (
                                <button
                                    type="button"
                                    onClick={goPromoWizardNext}
                                    disabled={!canPromoWizardNext()}
                                    className="order-1 sm:order-2 flex-1 sm:flex-none px-6 py-3 rounded-xl bg-brand-primary text-white font-bold hover:bg-brand-dark min-w-[8rem] disabled:opacity-40 disabled:pointer-events-none"
                                >
                                    הבא
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => { setModalOpen(false); setPromoWizardStep(1); setServerErrors({}); }}
                                className="order-3 px-6 py-3 rounded-xl text-gray-600 font-bold hover:bg-gray-50 w-full sm:w-auto"
                            >
                                ביטול
                            </button>
                            {(editingPromo || promoWizardStep === 3) && (
                                <button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={saving || !form.name?.trim() || Object.keys(formErrors).length > 0}
                                    className="order-1 sm:order-4 px-8 py-3 rounded-xl bg-gray-900 text-white font-bold hover:bg-black transition-colors disabled:opacity-50 w-full sm:w-auto"
                                >
                                    {saving ? 'שומר...' : editingPromo ? 'עדכן' : 'צור מבצע'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}
