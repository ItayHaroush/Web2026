import { useState, useEffect } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import AdminLayout from '../../layouts/AdminLayout';
import { FaTv, FaPlus, FaCrown } from 'react-icons/fa';
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
import ScreenCard from '../../components/display-screen/admin/ScreenCard';
import ScreenFormModal from '../../components/display-screen/admin/ScreenFormModal';
import ScreenItemsModal from '../../components/display-screen/admin/ScreenItemsModal';

const DEFAULT_FORM = {
    name: '',
    display_type: 'static',
    design_preset: 'classic',
    content_mode: 'auto_available',
    refresh_interval: 30,
    rotation_speed: 5,
    aspect_ratio: '16:9',
    design_options: null,
};

export default function AdminDisplayScreens() {
    const { isManager } = useAdminAuth();
    const [screens, setScreens] = useState([]);
    const [limits, setLimits] = useState({});
    const [tier, setTier] = useState('basic');
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editScreen, setEditScreen] = useState(null);
    const [form, setForm] = useState({ ...DEFAULT_FORM });
    const [copiedId, setCopiedId] = useState(null);

    // Items modal state
    const [showItemsModal, setShowItemsModal] = useState(false);
    const [itemsScreenId, setItemsScreenId] = useState(null);
    const [allMenuItems, setAllMenuItems] = useState([]);
    const [selectedItems, setSelectedItems] = useState([]);
    const [itemsLoading, setItemsLoading] = useState(false);

    useEffect(() => { fetchScreens(); }, []);

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

    // --- CRUD handlers ---
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
        try { await deleteScreen(id); fetchScreens(); }
        catch (error) { console.error('Failed to delete screen:', error); alert(error.response?.data?.message || 'שגיאה במחיקה'); }
    };

    const handleToggle = async (id) => {
        try { await toggleScreen(id); fetchScreens(); }
        catch (error) { console.error('Failed to toggle screen:', error); }
    };

    const handleRegenerate = async (id) => {
        if (!confirm('לחדש את הקישור? הקישור הקודם יפסיק לעבוד.')) return;
        try { await regenerateToken(id); fetchScreens(); }
        catch (error) { console.error('Failed to regenerate token:', error); }
    };

    const copyLink = (screen) => {
        const url = `${window.location.origin}/screen/${screen.token}`;
        navigator.clipboard.writeText(url).then(() => {
            setCopiedId(screen.id);
            setTimeout(() => setCopiedId(null), 2000);
        });
    };

    // --- Modal open/close ---
    const openNew = () => {
        setEditScreen(null);
        setForm({ ...DEFAULT_FORM });
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
            aspect_ratio: screen.aspect_ratio || '16:9',
            design_options: screen.design_options || null,
        });
        setShowModal(true);
    };

    const closeModal = () => { setShowModal(false); setEditScreen(null); };

    // --- Items modal handlers ---
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
            if (exists) return prev.filter(i => i.menu_item_id !== menuItem.id);
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
            return {
                ...item,
                badge: badges.includes(badgeId) ? badges.filter(b => b !== badgeId) : [...badges, badgeId],
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
                            className={`w-full md:w-auto px-10 py-5 rounded-[2rem] font-black transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95 group ${
                                canCreateMore
                                    ? 'bg-brand-primary text-white hover:bg-brand-dark shadow-brand-primary/20'
                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                            }`}
                        >
                            <FaPlus className="group-hover:rotate-90 transition-transform" />
                            {canCreateMore ? 'מסך חדש' : 'הגעתם למגבלה'}
                        </button>
                    )}
                </div>

                {/* Tier Upgrade Banner */}
                {tier === 'basic' && (
                    <div className="mx-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-3xl p-6 shadow-lg">
                        <div className="flex items-center gap-4 flex-wrap">
                            <div className="w-14 h-14 bg-indigo-500 rounded-2xl flex items-center justify-center text-white shadow-lg">
                                <FaCrown size={24} />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-xl font-black text-gray-900">שדרגו ל-Pro</h3>
                                <p className="text-gray-600 font-medium mt-1">
                                    עד 5 מסכים, קרוסלה, 7 עיצובים נוספים, לוגו, מבצעים, גופנים, רקעים מותאמים, ווידג׳טים ועוד
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
                            <ScreenCard
                                key={screen.id}
                                screen={screen}
                                copiedId={copiedId}
                                isManager={isManager()}
                                onEdit={openEdit}
                                onDelete={handleDelete}
                                onToggle={handleToggle}
                                onRegenerate={handleRegenerate}
                                onCopyLink={copyLink}
                                onOpenItems={openItemsModal}
                            />
                        ))}
                    </div>
                )}

                {/* Create/Edit Modal */}
                {showModal && (
                    <ScreenFormModal
                        form={form}
                        setForm={setForm}
                        editScreen={editScreen}
                        tier={tier}
                        onSubmit={handleSubmit}
                        onClose={closeModal}
                    />
                )}

                {/* Item Selection Modal */}
                <ScreenItemsModal
                    show={showItemsModal}
                    loading={itemsLoading}
                    allMenuItems={allMenuItems}
                    selectedItems={selectedItems}
                    tier={tier}
                    onToggleItem={toggleItem}
                    onToggleBadge={toggleBadge}
                    onMoveItem={moveItem}
                    onSave={saveItems}
                    onClose={() => { setShowItemsModal(false); setItemsScreenId(null); }}
                />
            </div>
        </AdminLayout>
    );
}
