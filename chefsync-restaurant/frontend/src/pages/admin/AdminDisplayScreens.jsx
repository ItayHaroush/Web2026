import { useState, useEffect } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import AdminLayout from '../../layouts/AdminLayout';
import {
    FaTv,
    FaPlus,
    FaEdit,
    FaTrash,
    FaTimes,
    FaCheckCircle,
    FaInfoCircle,
    FaCopy,
    FaSync,
    FaToggleOn,
    FaToggleOff,
    FaExternalLinkAlt,
    FaCrown,
    FaLink,
    FaListUl,
    FaChevronDown,
    FaChevronUp,
    FaGripVertical,
    FaCheck
} from 'react-icons/fa';
import {
    getScreens,
    createScreen,
    updateScreen,
    deleteScreen,
    toggleScreen,
    regenerateToken,
    getScreenItems,
    updateScreenItems,
    getMenuItemsForSelection
} from '../../services/displayScreenService';

const DESIGN_PRESETS = [
    { id: 'classic', label: 'קלאסי', desc: 'רקע בהיר, כרטיסים פשוטים', tier: 'all', color: 'bg-amber-100 text-amber-700' },
    { id: 'minimal', label: 'מינימלי', desc: 'לבן, רשימה טקסטואלית', tier: 'all', color: 'bg-gray-200 text-gray-600' },
    { id: 'menuboard', label: 'לוח מחירים', desc: 'טקסט בלבד, 21:9 אופטימלי', tier: 'all', color: 'bg-yellow-100 text-yellow-800' },
    { id: 'modern', label: 'מודרני', desc: 'גרדיאנט, כרטיסים מעוגלים', tier: 'pro', color: 'bg-gradient-to-br from-blue-400 to-purple-500 text-white' },
    { id: 'dark', label: 'כהה', desc: 'רקע כהה, קונטרסט גבוה', tier: 'pro', color: 'bg-gray-800 text-white' },
    { id: 'workers', label: 'פועלים', desc: 'בולט, מנות גדולות, גברי', tier: 'pro', color: 'bg-orange-600 text-white' },
    { id: 'grill', label: 'גריל', desc: 'אש, בשרים, עשן', tier: 'pro', color: 'bg-red-700 text-white' },
    { id: 'family', label: 'משפחתי', desc: 'חם, צבעוני, ידידותי', tier: 'pro', color: 'bg-pink-100 text-pink-700' },
    { id: 'pizzeria', label: 'פיצריה', desc: 'איטלקי, אדום-ירוק', tier: 'pro', color: 'bg-green-600 text-white' },
    { id: 'homecooking', label: 'אוכל ביתי', desc: 'כפרי, חם, נוסטלגי', tier: 'pro', color: 'bg-amber-700 text-white' },
];

const BADGE_OPTIONS = [
    { id: 'spicy', label: '🌶 חריף', emoji: '🌶' },
    { id: 'recommended', label: '⭐ מומלץ', emoji: '⭐' },
    { id: 'new', label: '🆕 חדש', emoji: '🆕' },
    { id: 'value', label: '💰 משתלם', emoji: '💰' },
];

const PROMO_ICONS = ['🔥', '⭐', '🎉', '💥', '🏷️', '❤️', '👑', '🍽️'];

const getScreenViewUrl = (token) => `${window.location.origin}/screen/${token}`;

export default function AdminDisplayScreens() {
    const { getAuthHeaders, isManager } = useAdminAuth();
    const [screens, setScreens] = useState([]);
    const [limits, setLimits] = useState({});
    const [tier, setTier] = useState('basic');
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editScreen, setEditScreen] = useState(null);
    const [form, setForm] = useState({
        name: '',
        display_type: 'static',
        design_preset: 'classic',
        content_mode: 'auto_available',
        refresh_interval: 30,
        rotation_speed: 5,
        design_options: null,
    });
    const [copiedId, setCopiedId] = useState(null);
    const [showItemsModal, setShowItemsModal] = useState(false);
    const [itemsScreenId, setItemsScreenId] = useState(null);
    const [allMenuItems, setAllMenuItems] = useState([]);
    const [selectedItems, setSelectedItems] = useState([]);
    const [itemsLoading, setItemsLoading] = useState(false);

    useEffect(() => {
        fetchScreens();
    }, []);

    const fetchScreens = async () => {
        try {
            const res = await getScreens();
            if (res.success) {
                setScreens(res.data.screens || []);
                setTier(res.data.tier || 'basic');
                setLimits(res.data.limits || {});
            }
        } catch (error) {
            console.error('Failed to fetch screens:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editScreen) {
                await updateScreen(editScreen.id, form);
            } else {
                await createScreen(form);
            }
            closeModal();
            fetchScreens();
        } catch (error) {
            console.error('Failed to save screen:', error);
            alert(error.response?.data?.message || 'שגיאה בשמירה');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('למחוק את מסך התצוגה?')) return;
        try {
            await deleteScreen(id);
            fetchScreens();
        } catch (error) {
            console.error('Failed to delete screen:', error);
            alert(error.response?.data?.message || 'שגיאה במחיקה');
        }
    };

    const handleToggle = async (id) => {
        try {
            await toggleScreen(id);
            fetchScreens();
        } catch (error) {
            console.error('Failed to toggle screen:', error);
        }
    };

    const handleRegenerate = async (id) => {
        if (!confirm('לחדש את הקישור? הקישור הקודם יפסיק לעבוד.')) return;
        try {
            await regenerateToken(id);
            fetchScreens();
        } catch (error) {
            console.error('Failed to regenerate token:', error);
        }
    };

    const copyLink = (screen) => {
        const url = getScreenViewUrl(screen.token);
        navigator.clipboard.writeText(url).then(() => {
            setCopiedId(screen.id);
            setTimeout(() => setCopiedId(null), 2000);
        });
    };

    const openNew = () => {
        setEditScreen(null);
        setForm({
            name: '',
            display_type: 'static',
            design_preset: 'classic',
            content_mode: 'auto_available',
            refresh_interval: 30,
            rotation_speed: 5,
            design_options: null,
        });
        setShowModal(true);
    };

    const openEdit = (screen) => {
        setEditScreen(screen);
        setForm({
            name: screen.name,
            display_type: screen.display_type,
            design_preset: screen.design_preset,
            content_mode: screen.content_mode,
            refresh_interval: screen.refresh_interval,
            rotation_speed: screen.rotation_speed,
            design_options: screen.design_options || null,
        });
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditScreen(null);
    };

    // --- Item Selection Modal ---
    const openItemsModal = async (screenId) => {
        setItemsScreenId(screenId);
        setItemsLoading(true);
        setShowItemsModal(true);
        try {
            const [itemsRes, menuRes] = await Promise.all([
                getScreenItems(screenId),
                getMenuItemsForSelection()
            ]);
            setSelectedItems(
                (itemsRes.data || []).map((item, idx) => ({
                    menu_item_id: item.menu_item_id,
                    sort_order: item.sort_order ?? idx,
                    name: item.name,
                    price: item.price,
                    category: item.category,
                    badge: item.badge || [],
                }))
            );
            // menuRes = { success, items: [...] }
            const items = menuRes.items || menuRes.data?.items || menuRes.data || [];
            setAllMenuItems(Array.isArray(items) ? items : []);
        } catch (error) {
            console.error('Failed to load items:', error);
        } finally {
            setItemsLoading(false);
        }
    };

    const toggleItem = (menuItem) => {
        setSelectedItems(prev => {
            const exists = prev.find(i => i.menu_item_id === menuItem.id);
            if (exists) {
                return prev.filter(i => i.menu_item_id !== menuItem.id);
            }
            return [...prev, {
                menu_item_id: menuItem.id,
                sort_order: prev.length,
                name: menuItem.name,
                price: menuItem.price,
                category: menuItem.category?.name || menuItem.category_name || '',
                badge: [],
            }];
        });
    };

    const toggleBadge = (menuItemId, badgeId) => {
        setSelectedItems(prev => prev.map(item => {
            if (item.menu_item_id !== menuItemId) return item;
            const badges = item.badge || [];
            const has = badges.includes(badgeId);
            return {
                ...item,
                badge: has ? badges.filter(b => b !== badgeId) : [...badges, badgeId],
            };
        }));
    };

    const moveItem = (index, direction) => {
        setSelectedItems(prev => {
            const next = [...prev];
            const newIndex = index + direction;
            if (newIndex < 0 || newIndex >= next.length) return prev;
            [next[index], next[newIndex]] = [next[newIndex], next[index]];
            return next.map((item, i) => ({ ...item, sort_order: i }));
        });
    };

    const saveItems = async () => {
        try {
            await updateScreenItems(
                itemsScreenId,
                selectedItems.map((item, i) => ({
                    menu_item_id: item.menu_item_id,
                    sort_order: i,
                    badge: item.badge || [],
                }))
            );
            setShowItemsModal(false);
            setItemsScreenId(null);
        } catch (error) {
            console.error('Failed to save items:', error);
            alert('שגיאה בשמירת הפריטים');
        }
    };

    const allowedPresets = DESIGN_PRESETS.filter(
        p => tier === 'pro' || p.tier === 'all'
    );

    const canCreateMore = screens.length < (limits.max_screens || 1);

    if (loading) {
        return (
            <AdminLayout>
                <div className="flex flex-col items-center justify-center h-96">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-brand-primary"></div>
                    <p className="mt-4 text-gray-500 font-black animate-pulse">טוען מסכי תצוגה...</p>
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
                            <FaTv size={32} />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black text-gray-900 tracking-tight">מסכי תצוגה</h1>
                            <p className="text-gray-500 font-medium mt-1">
                                {screens.length} / {limits.max_screens || 1} מסכים פעילים
                            </p>
                        </div>
                    </div>
                    {isManager() && (
                        <button
                            onClick={canCreateMore ? openNew : undefined}
                            disabled={!canCreateMore}
                            className={`w-full md:w-auto px-10 py-5 rounded-[2rem] font-black transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95 group ${canCreateMore
                                    ? 'bg-brand-primary text-white hover:bg-brand-dark shadow-brand-primary/20'
                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                                }`}
                        >
                            <FaPlus className="group-hover:rotate-90 transition-transform" />
                            {canCreateMore ? 'מסך חדש' : 'הגעתם למגבלה'}
                        </button>
                    )}
                </div>

                {/* Tier Upgrade Banner (Basic) */}
                {tier === 'basic' && (
                    <div className="mx-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-3xl p-6 shadow-lg">
                        <div className="flex items-center gap-4 flex-wrap">
                            <div className="w-14 h-14 bg-indigo-500 rounded-2xl flex items-center justify-center text-white shadow-lg">
                                <FaCrown size={24} />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-xl font-black text-gray-900">שדרגו ל-Pro</h3>
                                <p className="text-gray-600 font-medium mt-1">
                                    עד 5 מסכים, קרוסלה, 7 עיצובים נוספים, לוגו, מבצעים, תגי פריטים וללא ברנדינג
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Screens Grid */}
                {screens.length === 0 ? (
                    <div className="bg-white rounded-[4rem] shadow-sm border-2 border-dashed border-gray-100 p-24 text-center flex flex-col items-center col-span-full max-w-xl mx-auto">
                        <div className="w-28 h-28 bg-gray-50 rounded-[3rem] flex items-center justify-center text-6xl mb-8 grayscale opacity-50">
                            <FaTv />
                        </div>
                        <h3 className="text-3xl font-black text-gray-900 mb-2">אין מסכי תצוגה עדיין</h3>
                        <p className="text-gray-500 font-medium mb-12 text-lg leading-relaxed">
                            צרו מסך תצוגה דיגיטלי להצגת התפריט על טאבלט או מסך TV
                        </p>
                        {isManager() && (
                            <button
                                onClick={openNew}
                                className="bg-brand-primary text-white px-12 py-5 rounded-[2rem] font-black hover:bg-brand-dark transition-all flex items-center gap-4 shadow-lg shadow-brand-primary/20"
                            >
                                <FaPlus /> יצירת מסך ראשון
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 px-4">
                        {screens.map((screen) => (
                            <div
                                key={screen.id}
                                className={`group bg-white rounded-[3rem] shadow-sm border p-8 flex flex-col gap-6 hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 relative overflow-hidden ${!screen.is_active ? 'border-gray-200 opacity-60' : 'border-gray-100'
                                    }`}
                            >
                                {/* Header */}
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 h-16 bg-indigo-50 rounded-[1.5rem] flex items-center justify-center text-indigo-600 shadow-inner group-hover:scale-110 transition-transform duration-500">
                                            <FaTv size={24} />
                                        </div>
                                        <div>
                                            <h3 className="font-black text-gray-900 text-xl leading-tight group-hover:text-indigo-600 transition-colors">
                                                {screen.name}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-1.5">
                                                <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${screen.display_type === 'rotating'
                                                        ? 'bg-purple-50 text-purple-600 border-purple-100'
                                                        : 'bg-gray-100 text-gray-500 border-gray-100'
                                                    }`}>
                                                    {screen.display_type === 'rotating' ? 'קרוסלה' : 'סטטי'}
                                                </span>
                                                <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${screen.content_mode === 'manual'
                                                        ? 'bg-amber-50 text-amber-600 border-amber-100'
                                                        : 'bg-teal-50 text-teal-600 border-teal-100'
                                                    }`}>
                                                    {screen.content_mode === 'manual' ? 'ידני' : 'אוטומטי'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    {/* Status */}
                                    <div className="flex items-center gap-2">
                                        <span className={`w-2.5 h-2.5 rounded-full ${screen.is_connected ? 'bg-green-500 animate-pulse' : 'bg-red-400'}`}></span>
                                        <span className={`text-xs font-black ${screen.is_connected ? 'text-green-600' : 'text-red-400'}`}>
                                            {screen.is_connected ? 'מחובר' : 'מנותק'}
                                        </span>
                                    </div>
                                </div>

                                {/* Info */}
                                <div className="flex items-center gap-3 text-sm text-gray-500">
                                    <span className="font-bold">עיצוב: {DESIGN_PRESETS.find(p => p.id === screen.design_preset)?.label || screen.design_preset}</span>
                                    <span>|</span>
                                    <span className="font-bold">רענון: {screen.refresh_interval}s</span>
                                    {screen.display_type === 'rotating' && (
                                        <>
                                            <span>|</span>
                                            <span className="font-bold">סיבוב: {screen.rotation_speed}s</span>
                                        </>
                                    )}
                                </div>

                                {/* Link */}
                                <div className="flex items-center gap-2 bg-gray-50 rounded-2xl p-3">
                                    <input
                                        type="text"
                                        value={getScreenViewUrl(screen.token)}
                                        readOnly
                                        className="flex-1 bg-transparent border-none text-sm text-gray-600 font-mono truncate focus:outline-none"
                                        dir="ltr"
                                    />
                                    <button
                                        onClick={() => copyLink(screen)}
                                        className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-xl transition-all"
                                        title="העתק קישור"
                                    >
                                        {copiedId === screen.id ? <FaCheck size={14} /> : <FaCopy size={14} />}
                                    </button>
                                    <a
                                        href={getScreenViewUrl(screen.token)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-xl transition-all"
                                        title="פתח בחלון חדש"
                                    >
                                        <FaExternalLinkAlt size={14} />
                                    </a>
                                </div>

                                {/* Actions */}
                                {isManager() && (
                                    <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-50">
                                        <button
                                            onClick={() => openEdit(screen)}
                                            className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all text-sm font-black"
                                        >
                                            <FaEdit size={14} /> ערוך
                                        </button>
                                        {screen.content_mode === 'manual' && (
                                            <button
                                                onClick={() => openItemsModal(screen.id)}
                                                className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-600 hover:text-white transition-all text-sm font-black"
                                            >
                                                <FaListUl size={14} /> תוכן
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleToggle(screen.id)}
                                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all text-sm font-black ${screen.is_active
                                                    ? 'bg-orange-50 text-orange-600 hover:bg-orange-600 hover:text-white'
                                                    : 'bg-green-50 text-green-600 hover:bg-green-600 hover:text-white'
                                                }`}
                                        >
                                            {screen.is_active ? <FaToggleOff size={14} /> : <FaToggleOn size={14} />}
                                            {screen.is_active ? 'השבת' : 'הפעל'}
                                        </button>
                                        <button
                                            onClick={() => handleRegenerate(screen.id)}
                                            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all text-sm font-black"
                                        >
                                            <FaSync size={14} /> חדש קישור
                                        </button>
                                        <button
                                            onClick={() => handleDelete(screen.id)}
                                            className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all text-sm font-black"
                                        >
                                            <FaTrash size={14} /> מחק
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Create/Edit Modal */}
                {showModal && (
                    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
                        <div className="bg-white rounded-[3.5rem] shadow-2xl max-w-2xl w-full overflow-hidden border border-white/20 animate-in zoom-in-95 duration-300">
                            <div className="px-10 py-8 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between">
                                <div className="flex items-center gap-5">
                                    <div className="p-4 bg-indigo-100 rounded-[1.5rem] text-indigo-600 shadow-sm">
                                        {editScreen ? <FaEdit size={24} /> : <FaPlus size={24} />}
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                                            {editScreen ? 'עריכת מסך' : 'מסך חדש'}
                                        </h2>
                                        <p className="text-gray-500 font-medium text-sm mt-0.5">הגדרות מסך תצוגה דיגיטלי</p>
                                    </div>
                                </div>
                                <button
                                    onClick={closeModal}
                                    className="p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-2xl transition-all"
                                >
                                    <FaTimes size={24} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-10 space-y-10 max-h-[75vh] overflow-y-auto custom-scrollbar">
                                {/* Name */}
                                <div className="space-y-4">
                                    <label className="text-sm font-black text-gray-700 mr-2 uppercase tracking-widest flex items-center gap-2">
                                        <FaInfoCircle className="text-indigo-500" /> שם המסך
                                    </label>
                                    <input
                                        type="text"
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        required
                                        className="w-full px-8 py-5 bg-gray-50 border-none rounded-[1.5rem] focus:ring-4 focus:ring-indigo-500/10 text-gray-900 font-black transition-all text-lg"
                                        placeholder='למשל: מסך דלפק, מסך קיר...'
                                    />
                                </div>

                                {/* Display Type */}
                                <div className="space-y-4">
                                    <label className="text-sm font-black text-gray-700 mr-2 uppercase tracking-widest">
                                        סוג תצוגה
                                    </label>
                                    <div className="grid grid-cols-2 gap-5">
                                        {[
                                            { id: 'static', label: 'סטטי', desc: 'כל הפריטים ברשת', icon: '🖥️', disabled: false },
                                            { id: 'rotating', label: 'קרוסלה', desc: 'שקפים מתחלפים', icon: '🎠', disabled: tier === 'basic' },
                                        ].map((type) => (
                                            <button
                                                key={type.id}
                                                type="button"
                                                disabled={type.disabled}
                                                onClick={() => !type.disabled && setForm({ ...form, display_type: type.id })}
                                                className={`group flex flex-col items-center justify-center gap-3 p-6 rounded-[2rem] border-2 transition-all duration-300 relative ${form.display_type === type.id
                                                        ? 'bg-indigo-50 border-indigo-500 text-indigo-600 shadow-lg shadow-indigo-500/5'
                                                        : type.disabled
                                                            ? 'bg-gray-50 border-transparent text-gray-300 cursor-not-allowed'
                                                            : 'bg-gray-50 border-transparent text-gray-400 hover:bg-gray-100'
                                                    }`}
                                            >
                                                <span className="text-4xl">{type.icon}</span>
                                                <div className="text-center">
                                                    <span className={`block font-black text-sm ${form.display_type === type.id ? 'text-indigo-600' : ''}`}>{type.label}</span>
                                                    <span className="text-[10px] opacity-60 font-medium">{type.desc}</span>
                                                </div>
                                                {type.disabled && (
                                                    <span className="absolute top-2 left-2 text-[9px] font-black bg-purple-100 text-purple-600 px-2 py-0.5 rounded-lg">PRO</span>
                                                )}
                                                {form.display_type === type.id && (
                                                    <div className="absolute -top-2 -right-2 bg-indigo-500 text-white w-6 h-6 rounded-full flex items-center justify-center shadow-lg animate-in zoom-in">
                                                        <FaCheckCircle size={12} />
                                                    </div>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Design Preset */}
                                <div className="space-y-4">
                                    <label className="text-sm font-black text-gray-700 mr-2 uppercase tracking-widest">
                                        עיצוב
                                    </label>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                        {DESIGN_PRESETS.map((preset) => {
                                            const disabled = tier === 'basic' && preset.tier === 'pro';
                                            return (
                                                <button
                                                    key={preset.id}
                                                    type="button"
                                                    disabled={disabled}
                                                    onClick={() => !disabled && setForm({ ...form, design_preset: preset.id })}
                                                    className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-right ${form.design_preset === preset.id
                                                            ? 'bg-indigo-50 border-indigo-500'
                                                            : disabled
                                                                ? 'bg-gray-50 border-transparent opacity-40 cursor-not-allowed'
                                                                : 'bg-gray-50 border-transparent hover:bg-gray-100'
                                                        }`}
                                                >
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black ${preset.color}`}>
                                                        {preset.label.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className="font-black text-sm text-gray-800">{preset.label}</div>
                                                        <div className="text-[10px] text-gray-400 font-medium">{preset.desc}</div>
                                                    </div>
                                                    {disabled && <span className="mr-auto text-[9px] font-black bg-purple-100 text-purple-600 px-2 py-0.5 rounded-lg">PRO</span>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Content Mode */}
                                <div className="space-y-4">
                                    <label className="text-sm font-black text-gray-700 mr-2 uppercase tracking-widest">
                                        מצב תוכן
                                    </label>
                                    <div className="grid grid-cols-2 gap-5">
                                        {[
                                            { id: 'auto_available', label: 'אוטומטי', desc: 'כל הפריטים הזמינים' },
                                            { id: 'manual', label: 'ידני', desc: 'בחירה ידנית + סידור' },
                                        ].map((mode) => (
                                            <button
                                                key={mode.id}
                                                type="button"
                                                onClick={() => setForm({ ...form, content_mode: mode.id })}
                                                className={`p-5 rounded-2xl border-2 transition-all text-center ${form.content_mode === mode.id
                                                        ? 'bg-indigo-50 border-indigo-500 text-indigo-600'
                                                        : 'bg-gray-50 border-transparent text-gray-400 hover:bg-gray-100'
                                                    }`}
                                            >
                                                <div className="font-black text-sm">{mode.label}</div>
                                                <div className="text-[10px] opacity-60 font-medium mt-1">{mode.desc}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Refresh Interval */}
                                <div className="space-y-4">
                                    <label className="text-sm font-black text-gray-700 mr-2 uppercase tracking-widest">
                                        מרווח רענון (שניות)
                                    </label>
                                    <input
                                        type="number"
                                        min={10}
                                        max={300}
                                        value={form.refresh_interval}
                                        onChange={(e) => setForm({ ...form, refresh_interval: parseInt(e.target.value) || 30 })}
                                        className="w-full px-8 py-5 bg-gray-50 border-none rounded-[1.5rem] focus:ring-4 focus:ring-indigo-500/10 text-gray-900 font-black transition-all"
                                    />
                                </div>

                                {/* Rotation Speed (only for rotating) */}
                                {form.display_type === 'rotating' && (
                                    <div className="space-y-4">
                                        <label className="text-sm font-black text-gray-700 mr-2 uppercase tracking-widest">
                                            מהירות סיבוב (שניות לשקף)
                                        </label>
                                        <input
                                            type="number"
                                            min={3}
                                            max={30}
                                            value={form.rotation_speed}
                                            onChange={(e) => setForm({ ...form, rotation_speed: parseInt(e.target.value) || 5 })}
                                            className="w-full px-8 py-5 bg-gray-50 border-none rounded-[1.5rem] focus:ring-4 focus:ring-indigo-500/10 text-gray-900 font-black transition-all"
                                        />
                                    </div>
                                )}

                                {/* Logo Overlay - Pro Only */}
                                {tier === 'pro' && (
                                    <div className="space-y-4 bg-indigo-50/50 rounded-[2rem] p-6 border border-indigo-100">
                                        <div className="flex items-center justify-between">
                                            <label className="text-sm font-black text-gray-700 uppercase tracking-widest flex items-center gap-2">
                                                <FaCrown className="text-purple-500" /> לוגו שכבת-על
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const opts = form.design_options || {};
                                                    const overlay = opts.logo_overlay || {};
                                                    setForm({
                                                        ...form,
                                                        design_options: {
                                                            ...opts,
                                                            logo_overlay: {
                                                                ...overlay,
                                                                enabled: !overlay.enabled,
                                                                position: overlay.position || 'top-right',
                                                                opacity: overlay.opacity || 8,
                                                            },
                                                        },
                                                    });
                                                }}
                                                className={`p-2 rounded-xl transition-all ${form.design_options?.logo_overlay?.enabled
                                                    ? 'text-indigo-600 bg-indigo-100'
                                                    : 'text-gray-400 bg-gray-100'}`}
                                            >
                                                {form.design_options?.logo_overlay?.enabled ? <FaToggleOn size={24} /> : <FaToggleOff size={24} />}
                                            </button>
                                        </div>
                                        {form.design_options?.logo_overlay?.enabled && (
                                            <div className="space-y-4 mt-2">
                                                <div className="grid grid-cols-2 gap-3">
                                                    {['top-right', 'top-left'].map(pos => (
                                                        <button
                                                            key={pos}
                                                            type="button"
                                                            onClick={() => setForm({
                                                                ...form,
                                                                design_options: {
                                                                    ...form.design_options,
                                                                    logo_overlay: { ...form.design_options.logo_overlay, position: pos },
                                                                },
                                                            })}
                                                            className={`p-3 rounded-xl border-2 text-sm font-black transition-all ${form.design_options.logo_overlay.position === pos
                                                                ? 'bg-indigo-50 border-indigo-400 text-indigo-600'
                                                                : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                                                        >
                                                            {pos === 'top-right' ? 'ימין למעלה' : 'שמאל למעלה'}
                                                        </button>
                                                    ))}
                                                </div>
                                                <div>
                                                    <label className="text-xs font-black text-gray-500 mb-1 block">
                                                        שקיפות: {form.design_options.logo_overlay.opacity * 10}%
                                                    </label>
                                                    <input
                                                        type="range"
                                                        min={5}
                                                        max={10}
                                                        value={form.design_options.logo_overlay.opacity}
                                                        onChange={(e) => setForm({
                                                            ...form,
                                                            design_options: {
                                                                ...form.design_options,
                                                                logo_overlay: { ...form.design_options.logo_overlay, opacity: parseInt(e.target.value) },
                                                            },
                                                        })}
                                                        className="w-full accent-indigo-500"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Promotion Mode - Pro Only */}
                                {tier === 'pro' && (
                                    <div className="space-y-4 bg-amber-50/50 rounded-[2rem] p-6 border border-amber-100">
                                        <div className="flex items-center justify-between">
                                            <label className="text-sm font-black text-gray-700 uppercase tracking-widest flex items-center gap-2">
                                                <FaCrown className="text-purple-500" /> מבצע / קידום
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const opts = form.design_options || {};
                                                    const promo = opts.promotion || {};
                                                    setForm({
                                                        ...form,
                                                        design_options: {
                                                            ...opts,
                                                            promotion: {
                                                                ...promo,
                                                                enabled: !promo.enabled,
                                                                text: promo.text || '',
                                                                icon: promo.icon || '🔥',
                                                                display_mode: promo.display_mode || 'tag',
                                                            },
                                                        },
                                                    });
                                                }}
                                                className={`p-2 rounded-xl transition-all ${form.design_options?.promotion?.enabled
                                                    ? 'text-amber-600 bg-amber-100'
                                                    : 'text-gray-400 bg-gray-100'}`}
                                            >
                                                {form.design_options?.promotion?.enabled ? <FaToggleOn size={24} /> : <FaToggleOff size={24} />}
                                            </button>
                                        </div>
                                        {form.design_options?.promotion?.enabled && (
                                            <div className="space-y-4 mt-2">
                                                <input
                                                    type="text"
                                                    maxLength={100}
                                                    value={form.design_options.promotion.text || ''}
                                                    onChange={(e) => setForm({
                                                        ...form,
                                                        design_options: {
                                                            ...form.design_options,
                                                            promotion: { ...form.design_options.promotion, text: e.target.value },
                                                        },
                                                    })}
                                                    placeholder="טקסט המבצע, למשל: 10% הנחה היום!"
                                                    className="w-full px-6 py-4 bg-white border border-amber-200 rounded-2xl focus:ring-4 focus:ring-amber-500/10 text-gray-900 font-bold transition-all"
                                                />
                                                <div>
                                                    <label className="text-xs font-black text-gray-500 mb-2 block">אייקון</label>
                                                    <div className="flex gap-2 flex-wrap">
                                                        {PROMO_ICONS.map(icon => (
                                                            <button
                                                                key={icon}
                                                                type="button"
                                                                onClick={() => setForm({
                                                                    ...form,
                                                                    design_options: {
                                                                        ...form.design_options,
                                                                        promotion: { ...form.design_options.promotion, icon },
                                                                    },
                                                                })}
                                                                className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all ${form.design_options.promotion.icon === icon
                                                                    ? 'bg-amber-200 border-2 border-amber-400 scale-110'
                                                                    : 'bg-white border border-gray-200 hover:bg-gray-50'}`}
                                                            >
                                                                {icon}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    {[
                                                        { id: 'tag', label: 'תג ליד פריט' },
                                                        { id: 'bar', label: 'בר עליון קבוע' },
                                                    ].map(mode => (
                                                        <button
                                                            key={mode.id}
                                                            type="button"
                                                            onClick={() => setForm({
                                                                ...form,
                                                                design_options: {
                                                                    ...form.design_options,
                                                                    promotion: { ...form.design_options.promotion, display_mode: mode.id },
                                                                },
                                                            })}
                                                            className={`p-3 rounded-xl border-2 text-sm font-black transition-all ${form.design_options.promotion.display_mode === mode.id
                                                                ? 'bg-amber-50 border-amber-400 text-amber-600'
                                                                : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                                                        >
                                                            {mode.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Submit */}
                                <div className="flex gap-6 pt-10">
                                    <button
                                        type="submit"
                                        className="flex-1 bg-brand-primary text-white py-6 rounded-[2rem] font-black text-xl hover:bg-brand-dark transition-all shadow-xl shadow-brand-primary/20 active:scale-95 flex items-center justify-center gap-4"
                                    >
                                        <FaCheckCircle size={22} />
                                        {editScreen ? 'עדכן מסך' : 'צור מסך'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={closeModal}
                                        className="px-12 py-6 bg-gray-100 text-gray-700 rounded-[2rem] font-black hover:bg-gray-200 transition-all active:scale-95"
                                    >
                                        ביטול
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Item Selection Modal */}
                {showItemsModal && (
                    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
                        <div className="bg-white rounded-[3.5rem] shadow-2xl max-w-4xl w-full overflow-hidden border border-white/20 animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
                            <div className="px-10 py-8 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-5">
                                    <div className="p-4 bg-amber-100 rounded-[1.5rem] text-amber-600 shadow-sm">
                                        <FaListUl size={24} />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black text-gray-900 tracking-tight">בחירת פריטים</h2>
                                        <p className="text-gray-500 font-medium text-sm mt-0.5">בחרו פריטים וסדרו אותם לפי העדפה</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => { setShowItemsModal(false); setItemsScreenId(null); }}
                                    className="p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-2xl transition-all"
                                >
                                    <FaTimes size={24} />
                                </button>
                            </div>

                            {itemsLoading ? (
                                <div className="flex items-center justify-center py-20">
                                    <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-amber-500"></div>
                                </div>
                            ) : (
                                <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">
                                    {/* Left: All menu items */}
                                    <div className="flex-1 border-l border-gray-100 overflow-y-auto p-6 custom-scrollbar">
                                        <h3 className="font-black text-gray-700 mb-4 text-sm uppercase tracking-widest">כל הפריטים</h3>
                                        {allMenuItems.length === 0 ? (
                                            <p className="text-gray-400 text-center py-10">אין פריטי תפריט</p>
                                        ) : (
                                            <div className="space-y-2">
                                                {allMenuItems.map((item) => {
                                                    const isSelected = selectedItems.some(s => s.menu_item_id === item.id);
                                                    return (
                                                        <button
                                                            key={item.id}
                                                            type="button"
                                                            onClick={() => toggleItem(item)}
                                                            className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all text-right ${isSelected
                                                                    ? 'bg-amber-50 border-2 border-amber-300'
                                                                    : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                                                                }`}
                                                        >
                                                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${isSelected ? 'bg-amber-500 text-white' : 'bg-gray-200'
                                                                }`}>
                                                                {isSelected && <FaCheck size={10} />}
                                                            </div>
                                                            {item.image_url && (
                                                                <img src={item.image_url} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0" />
                                                            )}
                                                            <div className="flex-1 min-w-0">
                                                                <div className="font-black text-sm text-gray-800 truncate">{item.name}</div>
                                                                <div className="text-[10px] text-gray-400 font-medium">
                                                                    {item.category?.name || item.category_name || ''} | {item.price} ₪
                                                                </div>
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Right: Selected items with reorder */}
                                    <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50 custom-scrollbar">
                                        <h3 className="font-black text-gray-700 mb-4 text-sm uppercase tracking-widest">
                                            נבחרו ({selectedItems.length})
                                        </h3>
                                        {selectedItems.length === 0 ? (
                                            <p className="text-gray-400 text-center py-10 text-sm">לחצו על פריטים מהרשימה להוספה</p>
                                        ) : (
                                            <div className="space-y-2">
                                                {selectedItems.map((item, index) => (
                                                    <div
                                                        key={item.menu_item_id}
                                                        className="p-3 bg-white rounded-2xl border border-gray-100 shadow-sm"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex flex-col gap-0.5 shrink-0">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => moveItem(index, -1)}
                                                                    disabled={index === 0}
                                                                    className="p-1 text-gray-300 hover:text-gray-600 disabled:opacity-30 transition-colors"
                                                                >
                                                                    <FaChevronUp size={10} />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => moveItem(index, 1)}
                                                                    disabled={index === selectedItems.length - 1}
                                                                    className="p-1 text-gray-300 hover:text-gray-600 disabled:opacity-30 transition-colors"
                                                                >
                                                                    <FaChevronDown size={10} />
                                                                </button>
                                                            </div>
                                                            <span className="text-xs font-black text-gray-300 w-5 text-center">{index + 1}</span>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="font-black text-sm text-gray-800 truncate">{item.name}</div>
                                                                <div className="text-[10px] text-gray-400">{item.category} | {item.price} ₪</div>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleItem({ id: item.menu_item_id })}
                                                                className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                                            >
                                                                <FaTimes size={12} />
                                                            </button>
                                                        </div>
                                                        {/* Badge toggles - Pro Only */}
                                                        {tier === 'pro' && (
                                                            <div className="flex gap-1.5 mt-2 mr-10">
                                                                {BADGE_OPTIONS.map(badge => {
                                                                    const active = (item.badge || []).includes(badge.id);
                                                                    return (
                                                                        <button
                                                                            key={badge.id}
                                                                            type="button"
                                                                            onClick={() => toggleBadge(item.menu_item_id, badge.id)}
                                                                            className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all ${active
                                                                                ? 'bg-amber-100 border border-amber-300 text-amber-700'
                                                                                : 'bg-gray-100 border border-transparent text-gray-400 hover:bg-gray-200'}`}
                                                                            title={badge.label}
                                                                        >
                                                                            {badge.emoji}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Save Button */}
                            <div className="p-6 border-t border-gray-100 flex gap-4 shrink-0">
                                <button
                                    onClick={saveItems}
                                    className="flex-1 bg-brand-primary text-white py-4 rounded-2xl font-black text-lg hover:bg-brand-dark transition-all shadow-xl shadow-brand-primary/20 active:scale-95 flex items-center justify-center gap-3"
                                >
                                    <FaCheckCircle size={18} /> שמור פריטים
                                </button>
                                <button
                                    onClick={() => { setShowItemsModal(false); setItemsScreenId(null); }}
                                    className="px-8 py-4 bg-gray-100 text-gray-700 rounded-2xl font-black hover:bg-gray-200 transition-all active:scale-95"
                                >
                                    ביטול
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
