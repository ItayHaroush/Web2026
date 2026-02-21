import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { useRestaurantStatus } from '../../context/RestaurantStatusContext';
import AdminLayout from '../../layouts/AdminLayout';
import api from '../../services/apiClient';
import { resolveAssetUrl } from '../../utils/assets';
import AiDescriptionGenerator from '../../components/AiDescriptionGenerator';
import AiPriceRecommender from '../../components/AiPriceRecommender';
import AiImageEnhancer from '../../components/AiImageEnhancer';
import AiDineInRecommender from '../../components/AiDineInRecommender';
import {
    FaUtensils,
    FaPlus,
    FaEdit,
    FaTrash,
    FaPowerOff,
    FaImage,
    FaToggleOn,
    FaToggleOff,
    FaMagic,
    FaMoneyBillWave,
    FaSearch,
    FaLayerGroup,
    FaCheck,
    FaTimes,
    FaSync,
    FaEye,
    FaGripVertical,
    FaEyeSlash,
    FaBreadSlice,
    FaSave,
    FaArchive,
    FaUndo
} from 'react-icons/fa';

export default function AdminMenu() {
    const { getAuthHeaders, isManager } = useAdminAuth();
    const { restaurantStatus } = useRestaurantStatus();
    const isLocked = restaurantStatus?.is_approved === false;
    const [items, setItems] = useState([]);
    const [categories, setCategories] = useState([]);
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [filterCategory, setFilterCategory] = useState('');
    const [activeTab, setActiveTab] = useState('items');
    const [archivedItems, setArchivedItems] = useState([]);
    const [draggedCategory, setDraggedCategory] = useState(null);
    const [categoryBeingSorted, setCategoryBeingSorted] = useState([]);
    const [basePrices, setBasePrices] = useState([]);
    const [basePriceAdjustments, setBasePriceAdjustments] = useState({});
    const [loadingBasePrices, setLoadingBasePrices] = useState(false);
    const [savingBasePrices, setSavingBasePrices] = useState(false);

    const [form, setForm] = useState({
        name: '',
        description: '',
        price: '',
        category_id: '',
        image: null,
        use_variants: false,
        use_addons: false,
        addons_group_scope: [],
        dine_in_adjustment: '',
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            console.log('Fetching menu items, categories and groups...');
            const [itemsRes, categoriesRes, saladsRes] = await Promise.all([
                api.get('/admin/menu-items', { headers: getAuthHeaders() }),
                api.get('/admin/categories', { headers: getAuthHeaders() }),
                api.get('/admin/salads', { headers: getAuthHeaders() })
            ]);

            console.log('Items response:', itemsRes.data);
            console.log('Items array:', itemsRes.data.items);
            console.log('Categories response:', categoriesRes.data);
            console.log('Categories array:', categoriesRes.data.categories);

            if (itemsRes.data.success) {
                const itemsData = itemsRes.data.items || [];
                setItems(itemsData);
                console.log('Set items count:', itemsData.length);
                itemsData.forEach(item => {
                    console.log(`Item: ${item.name}, Category ID: ${item.category_id}, Category:`, item.category);
                });
            }
            if (categoriesRes.data.success) {
                const catsData = categoriesRes.data.categories || [];
                setCategories(catsData);
                console.log('Set categories count:', catsData.length);
            }
            if (saladsRes.data.success) {
                const groupsData = saladsRes.data.groups || [];
                setGroups(groupsData);
                console.log('Set groups count:', groupsData.length);
            }
        } catch (error) {
            console.error('Failed to fetch data:', error);
            console.error('Error details:', error.response?.data);
        } finally {
            setLoading(false);
        }
    };

    const fetchItemBasePrices = async (itemId) => {
        setLoadingBasePrices(true);
        try {
            const res = await api.get(`/admin/menu-items/${itemId}/base-prices`, { headers: getAuthHeaders() });
            if (res.data.success) {
                setBasePrices(res.data.bases || []);
                const adjustments = {};
                (res.data.bases || []).forEach(b => {
                    adjustments[b.base_id] = String(b.item_adjustment || 0);
                });
                setBasePriceAdjustments(adjustments);
            }
        } catch (error) {
            console.error('Failed to fetch item base prices:', error);
        } finally {
            setLoadingBasePrices(false);
        }
    };

    const handleApplyDineInAdjustments = async (adjustments) => {
        try {
            for (const adj of adjustments) {
                const value = Math.round(parseFloat(adj.recommended_dine_in_price || adj.suggested_adjustment || 0));

                // Match by ID if available, otherwise match by name
                let itemId = adj.item_id;
                let categoryId = adj.category_id;

                if (!itemId && adj.item_name) {
                    const match = items.find(i => i.name === adj.item_name);
                    if (match) itemId = match.id;
                }

                if (!categoryId && adj.category_name) {
                    const match = categories.find(c => c.name === adj.category_name);
                    if (match) categoryId = match.id;
                }

                if (itemId) {
                    await api.put(`/admin/menu-items/${itemId}`, { dine_in_adjustment: value }, { headers: getAuthHeaders() });
                } else if (categoryId) {
                    await api.put(`/admin/categories/${categoryId}`, { dine_in_adjustment: value }, { headers: getAuthHeaders() });
                }
            }
            await fetchData();
        } catch (error) {
            console.error('Failed to apply dine-in adjustments:', error);
            alert('שגיאה בהחלת ההתאמות');
        }
    };

    const saveItemBasePrices = async (itemId) => {
        setSavingBasePrices(true);
        try {
            const adjustments = basePrices.map(b => ({
                base_id: b.base_id,
                price_delta: Number(basePriceAdjustments[b.base_id] || 0),
            }));
            await api.post(`/admin/menu-items/${itemId}/base-prices`, { adjustments }, { headers: getAuthHeaders() });
        } catch (error) {
            console.error('Failed to save item base prices:', error);
            alert('שגיאה בשמירת התאמות מחירי בסיסים');
        } finally {
            setSavingBasePrices(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (isLocked) {
            alert('המסעדה ממתינה לאישור מנהל מערכת. פעולות על התפריט נעולות זמנית.');
            return;
        }

        const formData = new FormData();
        formData.append('name', form.name);
        formData.append('description', form.description || '');
        formData.append('price', form.price);
        formData.append('category_id', form.category_id);
        if (form.image) formData.append('image', form.image);
        formData.append('use_variants', form.use_variants ? '1' : '0');
        formData.append('use_addons', form.use_addons ? '1' : '0');

        // שליחת array של group IDs כ-JSON string
        const scopeValue = form.use_addons && form.addons_group_scope?.length
            ? JSON.stringify(form.addons_group_scope)
            : '';
        formData.append('addons_group_scope', scopeValue);

        if (form.dine_in_adjustment !== '' && form.dine_in_adjustment !== null) {
            formData.append('dine_in_adjustment', form.dine_in_adjustment);
        }

        console.log('📤 Submitting menu item:', {
            name: form.name,
            price: form.price,
            category_id: form.category_id,
            hasImage: !!form.image,
            isEdit: !!editItem,
        });

        try {
            let savedItemId = editItem?.id;
            if (editItem) {
                // ✅ Laravel PUT + multipart workaround
                formData.append('_method', 'PUT');
                const response = await api.post(`/admin/menu-items/${editItem.id}`, formData, {
                    headers: { ...getAuthHeaders(), 'Content-Type': 'multipart/form-data' }
                });
                console.log('✅ Update response:', response.data);
            } else {
                const response = await api.post('/admin/menu-items', formData, {
                    headers: { ...getAuthHeaders(), 'Content-Type': 'multipart/form-data' }
                });
                console.log('✅ Create response:', response.data);
                savedItemId = response.data.item?.id;
            }

            // שמור התאמות מחירי בסיסים אם יש
            if (form.use_variants && savedItemId && basePrices.length > 0) {
                await saveItemBasePrices(savedItemId);
            }

            closeModal();
            fetchData();
        } catch (error) {
            console.error('❌ Failed to save item:', error);
            console.error('❌ Error response:', error.response?.data);
            console.error('❌ Error status:', error.response?.status);
            alert(`שגיאה בשמירת הפריט: ${error.response?.data?.message || error.message}`);
        }
    };

    const toggleAvailability = async (item) => {
        if (isLocked) {
            alert('המסעדה ממתינה לאישור מנהל מערכת. פעולות על התפריט נעולות זמנית.');
            return;
        }
        try {
            await api.put(`/admin/menu-items/${item.id}`,
                { is_available: !item.is_available },
                { headers: getAuthHeaders() }
            );
            fetchData();
        } catch (error) {
            console.error('Failed to toggle availability:', error);
        }
    };

    const deleteItem = async (id) => {
        if (!confirm('האם אתה בטוח שברצונך להסיר פריט זה מהתפריט?')) return;

        if (isLocked) {
            alert('המסעדה ממתינה לאישור מנהל מערכת. פעולות על התפריט נעולות זמנית.');
            return;
        }

        try {
            const res = await api.delete(`/admin/menu-items/${id}`, { headers: getAuthHeaders() });
            if (res.data.archived) {
                alert('הפריט הועבר לארכיון כי הופיע בהזמנות קודמות. היסטוריית ההזמנות נשמרה.');
                fetchArchivedItems();
            }
            fetchData();
        } catch (error) {
            console.error('Failed to delete item:', error);
        }
    };

    const fetchArchivedItems = async () => {
        try {
            const res = await api.get('/admin/menu-items/archived', { headers: getAuthHeaders() });
            if (res.data.success) {
                setArchivedItems(res.data.items || []);
            }
        } catch (error) {
            console.error('Failed to fetch archived items:', error);
        }
    };

    const restoreItem = async (id) => {
        try {
            await api.post(`/admin/menu-items/${id}/restore`, {}, { headers: getAuthHeaders() });
            fetchArchivedItems();
            fetchData();
        } catch (error) {
            console.error('Failed to restore item:', error);
        }
    };

    const openEditModal = (item) => {
        setEditItem(item);

        // המרת addons_group_scope לפורמט הנכון
        let groupScope = [];
        if (item.addons_group_scope) {
            try {
                // אם זה JSON array
                groupScope = JSON.parse(item.addons_group_scope);
            } catch {
                // תאימות לאחור - ערכים ישנים
                if (item.addons_group_scope === 'both') {
                    groupScope = groups.map(g => g.id);
                } else if (item.addons_group_scope === 'salads') {
                    const saladsGroup = groups.find(g => g.name === 'סלטים קבועים');
                    if (saladsGroup) groupScope = [saladsGroup.id];
                } else if (item.addons_group_scope === 'hot') {
                    const hotGroup = groups.find(g => g.name === 'תוספות חמות');
                    if (hotGroup) groupScope = [hotGroup.id];
                }
            }
        }

        setForm({
            name: item.name,
            description: item.description || '',
            price: item.price,
            category_id: item.category_id,
            image: null,
            use_variants: Boolean(item.use_variants),
            use_addons: Boolean(item.use_addons),
            addons_group_scope: groupScope,
            dine_in_adjustment: item.dine_in_adjustment ?? '',
        });
        setShowModal(true);

        // טען מחירי בסיס ברמת פריט אם הפריט משתמש בבסיסים
        if (Boolean(item.use_variants)) {
            fetchItemBasePrices(item.id);
        } else {
            setBasePrices([]);
            setBasePriceAdjustments({});
        }
    };

    const openNewModal = () => {
        setEditItem(null);
        setBasePrices([]);
        setBasePriceAdjustments({});
        setForm({
            name: '',
            description: '',
            price: '',
            category_id: categories[0]?.id || '',
            image: null,
            use_variants: false,
            use_addons: false,
            addons_group_scope: [],
            dine_in_adjustment: '',
        });
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditItem(null);
        setForm({
            name: '',
            description: '',
            price: '',
            category_id: categories[0]?.id || '',
            image: null,
            use_variants: false,
            use_addons: false,
            addons_group_scope: [],
            dine_in_adjustment: '',
        });
    };

    // ===== פונקציות ניהול קטגוריות =====

    const handleCategoryDragStart = (e, category) => {
        setDraggedCategory(category);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleCategoryDragOver = (e, targetCategory) => {
        e.preventDefault();
        if (!draggedCategory || draggedCategory.id === targetCategory.id) return;

        const sortedCats = [...categories];
        const draggedIndex = sortedCats.findIndex(c => c.id === draggedCategory.id);
        const targetIndex = sortedCats.findIndex(c => c.id === targetCategory.id);

        sortedCats.splice(draggedIndex, 1);
        sortedCats.splice(targetIndex, 0, draggedCategory);

        setCategoryBeingSorted(sortedCats);
    };

    const handleCategoryDrop = async (e) => {
        e.preventDefault();
        if (!draggedCategory || categoryBeingSorted.length === 0) return;

        const reorderedCategories = categoryBeingSorted.map((cat, index) => ({
            id: cat.id,
            sort_order: index
        }));

        try {
            await api.post('/admin/categories/reorder', {
                categories: reorderedCategories
            }, { headers: getAuthHeaders() });

            setCategories(categoryBeingSorted);
            setCategoryBeingSorted([]);
            setDraggedCategory(null);
        } catch (error) {
            console.error('Failed to reorder categories:', error);
            alert('שגיאה בעדכון סדר הקטגוריות');
            setCategoryBeingSorted([]);
        }
    };

    const toggleCategoryActive = async (categoryId) => {
        try {
            const res = await api.patch(`/admin/categories/${categoryId}/toggle-active`, {}, {
                headers: getAuthHeaders()
            });

            if (res.data.success) {
                setCategories(prevCats =>
                    prevCats.map(cat =>
                        cat.id === categoryId
                            ? { ...cat, is_active: res.data.category.is_active }
                            : cat
                    )
                );
            }
        } catch (error) {
            console.error('Failed to toggle category:', error);
            alert('שגיאה בעדכון סטטוס הקטגוריה');
        }
    };

    const filteredItems = filterCategory
        ? items.filter(item => item.category_id === parseInt(filterCategory))
        : items;

    if (loading) {
        return (
            <AdminLayout>
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            {/* כותרת מודרנית */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4 sm:p-6 mb-6 overflow-hidden relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/5 rounded-full -mr-16 -mt-16 blur-2xl" />
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 relative z-10">
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                            <div className="w-10 h-10 bg-brand-primary text-white rounded-xl flex items-center justify-center shadow-lg shadow-brand-primary/20">
                                <FaUtensils size={18} />
                            </div>
                            ניהול תפריט
                        </h1>
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest mt-2 flex items-center gap-2">
                            {items.length} פריטים במערכת • {categories.length} קטגוריות
                        </p>
                    </div>
                    {activeTab === 'items' && (
                        <div className="flex items-center gap-3">
                            <AiDineInRecommender onApplyAdjustments={handleApplyDineInAdjustments} />
                            <button
                                onClick={() => setShowModal(true)}
                                disabled={isLocked}
                                className={`bg-brand-primary hover:bg-brand-primary/90 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-brand-primary/20 flex items-center gap-2 transition-all ${isLocked ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'
                                    }`}
                            >
                                <FaPlus />
                                הוסף פריט
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* טאבים - פריטים / קטגוריות */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-2 mb-6">
                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveTab('items')}
                        className={`flex-1 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all ${activeTab === 'items'
                            ? 'bg-gray-900 text-white shadow-lg'
                            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                            }`}
                    >
                        <FaUtensils className="inline mr-2" size={12} />
                        פריטי תפריט
                    </button>
                    <button
                        onClick={() => setActiveTab('categories')}
                        className={`flex-1 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all ${activeTab === 'categories'
                            ? 'bg-gray-900 text-white shadow-lg'
                            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                            }`}
                    >
                        <FaLayerGroup className="inline mr-2" size={12} />
                        ניהול קטגוריות
                    </button>
                    <button
                        onClick={() => { setActiveTab('archive'); fetchArchivedItems(); }}
                        className={`flex-1 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all ${activeTab === 'archive'
                            ? 'bg-gray-900 text-white shadow-lg'
                            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                            }`}
                    >
                        <FaArchive className="inline mr-2" size={12} />
                        ארכיון
                    </button>
                </div>
            </div>

            {/* תוכן לפי טאב */}
            {activeTab === 'items' ? (
                <>
                    {/* פילטר קטגוריות - טאבים מודרניים */}
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-2 mb-6 overflow-x-auto no-scrollbar">
                        <div className="flex items-center gap-1 min-w-max">
                            <button
                                onClick={() => setFilterCategory('')}
                                className={`px-4 py-2.5 rounded-2xl font-black text-[11px] uppercase tracking-wider transition-all flex items-center gap-2 group relative ${filterCategory === ''
                                    ? 'bg-gray-900 text-white shadow-lg'
                                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                                    }`}
                            >
                                <FaLayerGroup size={10} />
                                הכל
                            </button>
                            {categories.filter(c => c.is_active).map((cat) => (
                                <button
                                    key={cat.id}
                                    onClick={() => setFilterCategory(cat.id.toString())}
                                    className={`px-4 py-2.5 rounded-2xl font-black text-[11px] uppercase tracking-wider transition-all flex items-center gap-2 group relative ${filterCategory === cat.id.toString()
                                        ? 'bg-gray-900 text-white shadow-lg'
                                        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                                        }`}
                                >
                                    <span className="text-[14px]">{cat.icon}</span>
                                    {cat.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* רשימת פריטים - גריד מודרני */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredItems.map((item) => (
                            <div
                                key={item.id}
                                className={`bg-white rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 group overflow-hidden flex flex-col ${!item.is_available ? 'opacity-80' : ''
                                    }`}
                            >
                                {/* תמונה מודרנית */}
                                <div className="aspect-[4/3] bg-slate-50 relative overflow-hidden">
                                    {item.image_url ? (
                                        <img
                                            src={resolveAssetUrl(item.image_url)}
                                            alt={item.name}
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-200 gap-2">
                                            <FaImage size={40} className="opacity-20" />
                                            <span className="text-[10px] font-black uppercase tracking-widest">אין תמונה</span>
                                        </div>
                                    )}

                                    {/* באג' קטגוריה וזמינות */}
                                    <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none">
                                        <div className="bg-white/90 backdrop-blur px-2.5 py-1 rounded-lg shadow-sm">
                                            <p className="text-[10px] font-black text-gray-900 uppercase tracking-tight flex items-center gap-1.5">
                                                <span className="text-xs">{item.category?.icon}</span>
                                                {item.category?.name}
                                            </p>
                                        </div>
                                        {!item.is_available && (
                                            <div className="bg-red-500/90 backdrop-blur text-white px-3 py-1 rounded-lg shadow-lg">
                                                <p className="text-[10px] font-black uppercase tracking-widest">לא זמין</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* תוכן הפריט */}
                                <div className="p-5 flex-1 flex flex-col">
                                    <div className="flex items-start justify-between gap-3 mb-2">
                                        <div className="min-w-0">
                                            <h3 className="font-black text-gray-900 text-sm leading-tight truncate group-hover:text-brand-primary transition-colors">
                                                {item.name}
                                            </h3>
                                            <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-tight">
                                                ID: #{item.id}
                                            </p>
                                        </div>
                                        <div className="px-3 py-1 bg-brand-primary/10 text-brand-primary rounded-xl shrink-0">
                                            <span className="text-sm font-black">₪{item.price}</span>
                                        </div>
                                    </div>

                                    {item.description && (
                                        <p className="text-[11px] font-medium text-gray-500 line-clamp-2 mb-5 leading-relaxed">
                                            {item.description}
                                        </p>
                                    )}

                                    {/* כפתורי פעולה מודרניים */}
                                    {isManager() && (
                                        <div className="mt-auto flex gap-2">
                                            <button
                                                onClick={() => toggleAvailability(item)}
                                                disabled={isLocked}
                                                className={`flex-1 flex items-center justify-center gap-2 h-10 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-50 ${item.is_available
                                                    ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                                                    : 'bg-red-50 text-red-600 hover:bg-red-100'
                                                    }`}
                                            >
                                                {item.is_available ? <FaToggleOn size={14} /> : <FaToggleOff size={14} />}
                                                {item.is_available ? 'זמין' : 'כבוי'}
                                            </button>
                                            <button
                                                onClick={() => openEditModal(item)}
                                                disabled={isLocked}
                                                className="w-10 h-10 bg-slate-50 text-slate-500 rounded-xl flex items-center justify-center hover:bg-slate-100 hover:text-gray-900 transition-all disabled:opacity-50"
                                                title="ערוך פריט"
                                            >
                                                <FaEdit size={14} />
                                            </button>
                                            <button
                                                onClick={() => deleteItem(item.id)}
                                                disabled={isLocked}
                                                className="w-10 h-10 bg-red-50 text-red-400 rounded-xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-all disabled:opacity-50"
                                                title="הסר פריט"
                                            >
                                                <FaTrash size={12} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {filteredItems.length === 0 && (
                        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-20 text-center">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-dashed border-gray-200">
                                <FaUtensils size={32} className="text-gray-300" />
                            </div>
                            <h3 className="text-lg font-black text-gray-900 mb-2 uppercase tracking-tight">אין פריטים להצגה</h3>
                            <p className="text-xs font-bold text-gray-400 leading-relaxed max-w-[200px] mx-auto uppercase tracking-widest mt-4">
                                {items.length > 0 ? `יש ${items.length} פריטים בסך הכל, אך הפילטר לא תואם את הבחירה שלך` : 'לא נמצאו פריטים בתפריט. לחץ על הכפתור "הוסף פריט חדש" כדי להתחיל.'}
                            </p>
                        </div>
                    )}
                </>
            ) : activeTab === 'categories' ? (
                /* טאב ניהול קטגוריות */
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                    <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
                        <FaLayerGroup />
                        סידור וניהול קטגוריות
                    </h3>
                    <p className="text-sm text-gray-500 mb-6">
                        גרור את הקטגוריות לסידור מחדש. הקטגוריות יופיעו ללקוחות לפי הסדר הזה.
                    </p>

                    <div className="space-y-3">
                        {(categoryBeingSorted.length > 0 ? categoryBeingSorted : categories).map((cat) => (
                            <div
                                key={cat.id}
                                draggable
                                onDragStart={(e) => handleCategoryDragStart(e, cat)}
                                onDragOver={(e) => handleCategoryDragOver(e, cat)}
                                onDrop={handleCategoryDrop}
                                className={`bg-gray-50 rounded-2xl p-4 flex items-center justify-between gap-4 cursor-move hover:bg-gray-100 transition-all border ${draggedCategory?.id === cat.id ? 'border-brand-primary shadow-lg' : 'border-transparent'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <FaGripVertical className="text-gray-400" size={16} />
                                    <span className="text-2xl">{cat.icon}</span>
                                    <div>
                                        <h4 className="font-bold text-gray-900">{cat.name}</h4>
                                        <p className="text-xs text-gray-500">{cat.items_count || 0} פריטים</p>
                                    </div>
                                </div>

                                <button
                                    onClick={() => toggleCategoryActive(cat.id)}
                                    className={`px-4 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-2 ${cat.is_active
                                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                        : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                        }`}
                                >
                                    {cat.is_active ? (
                                        <>
                                            <FaEye size={12} />
                                            פעיל
                                        </>
                                    ) : (
                                        <>
                                            <FaEyeSlash size={12} />
                                            מוסתר
                                        </>
                                    )}
                                </button>
                            </div>
                        ))}
                    </div>

                    {categoryBeingSorted.length > 0 && (
                        <div className="mt-4 p-3 bg-blue-50 rounded-xl text-sm text-blue-700 flex items-center gap-2">
                            <FaSync className="animate-spin" size={12} />
                            שומר את הסדר החדש...
                        </div>
                    )}
                </div>
            ) : (
                /* טאב ארכיון */
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                    <h3 className="text-lg font-black text-gray-900 mb-2 flex items-center gap-2">
                        <FaArchive />
                        פריטים בארכיון
                    </h3>
                    <p className="text-sm text-gray-500 mb-6">
                        פריטים שהוסרו מהתפריט אך הופיעו בהזמנות קודמות. ניתן לשחזר אותם חזרה לתפריט.
                    </p>

                    {archivedItems.length === 0 ? (
                        <div className="text-center py-16">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <FaArchive size={24} className="text-gray-300" />
                            </div>
                            <p className="text-sm font-bold text-gray-400">אין פריטים בארכיון</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {archivedItems.map((item) => (
                                <div key={item.id} className="flex items-center justify-between bg-gray-50 rounded-2xl p-4 border border-gray-100">
                                    <div className="flex items-center gap-4">
                                        {item.image_url ? (
                                            <img src={resolveAssetUrl(item.image_url)} alt={item.name} className="w-12 h-12 rounded-xl object-cover opacity-60" />
                                        ) : (
                                            <div className="w-12 h-12 rounded-xl bg-gray-200 flex items-center justify-center">
                                                <FaUtensils size={16} className="text-gray-400" />
                                            </div>
                                        )}
                                        <div>
                                            <h4 className="font-bold text-gray-700">{item.name}</h4>
                                            <p className="text-xs text-gray-400">
                                                {item.category?.name || 'ללא קטגוריה'} • ₪{Number(item.price).toFixed(2)}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => restoreItem(item.id)}
                                        className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-600 rounded-xl font-bold text-xs hover:bg-emerald-100 transition-all"
                                    >
                                        <FaUndo size={12} />
                                        שחזר
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Modal הוספת/עריכת פריט */}
            {showModal && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] max-w-lg w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
                        <div className="p-6 border-b border-gray-100 bg-slate-50/50 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${editItem ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                    {editItem ? <FaEdit size={16} /> : <FaPlus size={16} />}
                                </div>
                                <h2 className="text-xl font-black text-gray-900">
                                    {editItem ? 'עריכת פריט' : 'הוספת פריט חדש'}
                                </h2>
                            </div>
                            <button onClick={closeModal} className="w-10 h-10 rounded-full bg-white border border-gray-100 text-gray-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-all shadow-sm">
                                <FaTimes size={14} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar p-6 sm:p-8 space-y-6">
                            <div className="space-y-4">
                                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                    <span className="w-1 h-1 bg-brand-primary rounded-full" />
                                    מידע בסיסי
                                </h3>

                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-black text-gray-500 uppercase tracking-tight mr-1">שם הפריט</label>
                                    <input
                                        type="text"
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        required
                                        className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-black focus:ring-2 focus:ring-brand-primary transition-all"
                                        placeholder="למשל: שווארמה בפיתה"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-black text-gray-500 uppercase tracking-tight mr-1">תיאור המנה</label>
                                    <textarea
                                        value={form.description}
                                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                                        rows={3}
                                        className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-black focus:ring-2 focus:ring-brand-primary transition-all resize-none"
                                        placeholder="מה יש במנה..."
                                    />
                                    <div className="pt-2">
                                        <AiDescriptionGenerator
                                            menuItem={{
                                                name: form.name,
                                                price: form.price,
                                                category_name: categories.find(c => c.id === parseInt(form.category_id))?.name || '',
                                            }}
                                            onDescriptionGenerated={(description) => {
                                                setForm({ ...form, description });
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-black text-gray-500 uppercase tracking-tight mr-1 text-right block">מחיר (₪)</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={form.price}
                                                onChange={(e) => setForm({ ...form, price: e.target.value })}
                                                required
                                                className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-black focus:ring-2 focus:ring-brand-primary transition-all"
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <div className="pt-1">
                                            <AiPriceRecommender
                                                itemData={{
                                                    name: form.name,
                                                    category_id: form.category_id,
                                                    category_name: categories.find(c => c.id == form.category_id)?.name || '',
                                                    description: form.description,
                                                    price: form.price,
                                                }}
                                                onPriceRecommended={(recommendedPrice) => {
                                                    setForm({ ...form, price: recommendedPrice.toString() });
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5 text-right w-full">
                                        <label className="text-[11px] font-black text-gray-500 uppercase tracking-tight mr-1 block">קטגוריה</label>
                                        <select
                                            value={form.category_id}
                                            onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                                            required
                                            className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-black appearance-none focus:ring-2 focus:ring-brand-primary transition-all pr-12 text-right"
                                            dir="rtl"
                                        >
                                            {categories.map((cat) => (
                                                <option key={cat.id} value={cat.id}>
                                                    {cat.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-black text-gray-500 uppercase tracking-tight mr-1">תמונת מנה</label>
                                    <div className="relative group">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => setForm({ ...form, image: e.target.files[0] })}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                        />
                                        <div className="w-full bg-slate-50 border-2 border-dashed border-gray-200 rounded-2xl px-5 py-8 text-center transition-all group-hover:border-brand-primary group-hover:bg-slate-100 flex flex-col items-center gap-2">
                                            <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-gray-400 group-hover:text-brand-primary group-hover:scale-110 transition-all">
                                                <FaImage size={18} />
                                            </div>
                                            <p className="text-xs font-black text-gray-500 uppercase tracking-widest mt-2">
                                                {form.image ? form.image.name : 'בחר תמונה או גרור לכאן'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* שיפור תמונה עם AI */}
                                <div className="space-y-1.5">
                                    <AiImageEnhancer
                                        onComplete={(imageUrl) => {
                                            console.log('✅ AI Enhanced Image:', imageUrl);
                                            // ✅ Refresh the menu items to show the new image
                                            fetchData();
                                        }}
                                        menuItem={editItem}
                                        buttonClassName="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all shadow-md text-xs font-bold"
                                    />
                                </div>

                            </div>

                            <div className="pt-6 border-t border-gray-100 space-y-6">
                                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                    <span className="w-1 h-1 bg-brand-primary rounded-full" />
                                    אפשרויות ותוספות
                                </h3>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <label className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl cursor-pointer hover:bg-slate-100 transition-all group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-orange-500 shadow-sm border border-orange-100">
                                                <FaLayerGroup size={16} />
                                            </div>
                                            <div>
                                                <p className="text-xs font-black text-gray-900 leading-none">בסיס מנה</p>
                                                <p className="text-[9px] font-bold text-gray-400 mt-1 uppercase tracking-tighter">פיתה / בגט / לאפה</p>
                                            </div>
                                        </div>
                                        <div className="relative flex items-center">
                                            <input
                                                type="checkbox"
                                                checked={form.use_variants}
                                                onChange={(e) => setForm({ ...form, use_variants: e.target.checked })}
                                                className="w-5 h-5 rounded-lg border-2 border-gray-300 checked:bg-brand-primary text-brand-primary focus:ring-offset-0 focus:ring-0 transition-all"
                                            />
                                        </div>
                                    </label>

                                    <label className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl cursor-pointer hover:bg-slate-100 transition-all group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-emerald-500 shadow-sm border border-emerald-100">
                                                <FaPlus size={16} />
                                            </div>
                                            <div>
                                                <p className="text-xs font-black text-gray-900 leading-none">תוספות</p>
                                                <p className="text-[9px] font-bold text-gray-400 mt-1 uppercase tracking-tighter">סלטים / רטבים / חם</p>
                                            </div>
                                        </div>
                                        <div className="relative flex items-center">
                                            <input
                                                type="checkbox"
                                                checked={form.use_addons}
                                                onChange={(e) => setForm({ ...form, use_addons: e.target.checked })}
                                                className="w-5 h-5 rounded-lg border-2 border-gray-300 checked:bg-brand-primary text-brand-primary focus:ring-offset-0 focus:ring-0 transition-all"
                                            />
                                        </div>
                                    </label>
                                </div>

                                {/* Item-level base pricing - visible when use_variants is on and editing an existing item */}
                                {form.use_variants && editItem && (
                                    <div className="bg-orange-50/50 rounded-2xl p-5 space-y-4 animate-in slide-in-from-top-2 duration-300 border border-orange-100/50">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <FaBreadSlice className="text-orange-500" size={14} />
                                                <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">התאמת מחירי בסיס למנה זו</p>
                                            </div>
                                        </div>

                                        {loadingBasePrices ? (
                                            <div className="flex items-center justify-center py-4">
                                                <div className="w-5 h-5 border-2 border-orange-300 border-t-orange-600 rounded-full animate-spin"></div>
                                                <span className="mr-2 text-xs text-gray-400 font-bold">טוען...</span>
                                            </div>
                                        ) : basePrices.length === 0 ? (
                                            <p className="text-xs text-gray-400 text-center py-2">אין בסיסים פעילים</p>
                                        ) : (
                                            <div className="space-y-2">
                                                {basePrices.map(base => {
                                                    const adj = Number(basePriceAdjustments[base.base_id] || 0);
                                                    const finalPrice = Number(base.category_price || 0) + adj;
                                                    return (
                                                        <div key={base.base_id} className="flex items-center gap-3 bg-white rounded-xl p-3 border border-gray-100">
                                                            <div className="flex-1 min-w-0">
                                                                <span className="text-xs font-black text-gray-800 block truncate">{base.base_name}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 shrink-0">
                                                                <span className="text-[10px] font-bold text-gray-400 whitespace-nowrap">
                                                                    קטגוריה: {Number(base.category_price) === 0 ? 'חינם' : `+${Number(base.category_price).toFixed(0)}`}
                                                                </span>
                                                                <input
                                                                    type="number"
                                                                    step="0.5"
                                                                    value={basePriceAdjustments[base.base_id] ?? '0'}
                                                                    onChange={(e) => setBasePriceAdjustments(prev => ({
                                                                        ...prev,
                                                                        [base.base_id]: e.target.value,
                                                                    }))}
                                                                    className="w-20 px-2 py-1.5 rounded-lg text-center font-black text-xs bg-slate-50 border-none focus:ring-2 focus:ring-orange-300/50"
                                                                    placeholder="0"
                                                                />
                                                                <span className={`text-xs font-black whitespace-nowrap min-w-[50px] text-left ${finalPrice > 0 ? 'text-emerald-600' : finalPrice < 0 ? 'text-rose-500' : 'text-gray-500'}`}>
                                                                    = {finalPrice === 0 ? 'חינם' : `${finalPrice > 0 ? '+' : ''}${finalPrice.toFixed(1)}`}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                <p className="text-[9px] text-gray-400 font-medium mt-1">התאמה 0 = ללא שינוי ממחיר הקטגוריה. ערך שלילי מוזיל, חיובי מייקר.</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {form.use_addons && (
                                    <div className="bg-slate-50 rounded-2xl p-5 space-y-4 animate-in slide-in-from-top-2 duration-300">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest block text-right">בחר קבוצות תוספות שיופיעו למנה זו</p>
                                        <div className="flex flex-wrap gap-2">
                                            {groups.map((group) => {
                                                const isSelected = form.addons_group_scope?.includes(group.id);
                                                return (
                                                    <button
                                                        key={group.id}
                                                        type="button"
                                                        onClick={() => {
                                                            const currentScope = form.addons_group_scope || [];
                                                            const newScope = isSelected
                                                                ? currentScope.filter(id => id !== group.id)
                                                                : [...currentScope, group.id];
                                                            setForm({ ...form, addons_group_scope: newScope });
                                                        }}
                                                        className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-tight transition-all ${isSelected
                                                            ? 'bg-gray-900 text-white shadow-md'
                                                            : 'bg-white text-gray-500 border border-gray-100'
                                                            }`}
                                                    >
                                                        {group.name}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* התאמות מחיר לפי מצב הזמנה */}
                                <div className="pt-6 border-t border-gray-100 space-y-4">
                                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                        <span className="w-1 h-1 bg-amber-500 rounded-full" />
                                        התאמות לפי מצב הזמנה
                                    </h3>

                                    <div className="bg-amber-50/50 rounded-2xl p-5 space-y-3 border border-amber-100/50">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-xs font-black text-gray-500">מחיר בסיס</span>
                                            <span className="text-sm font-black text-gray-800">{form.price || '0.00'} ₪</span>
                                        </div>

                                        <div className="space-y-2">
                                            {[
                                                { mode: 'pickup', label: 'איסוף עצמי', editable: false },
                                                { mode: 'delivery', label: 'משלוח', editable: false },
                                                { mode: 'takeaway', label: 'לקחת', editable: false },
                                            ].map(row => (
                                                <div key={row.mode} className="flex items-center justify-between bg-white rounded-xl p-3 border border-gray-100">
                                                    <span className="text-xs font-bold text-gray-700">{row.label}</span>
                                                    <span className="text-xs font-bold text-gray-400">0.00 ₪</span>
                                                </div>
                                            ))}
                                            <div className="flex items-center justify-between bg-white rounded-xl p-3 border border-amber-200">
                                                <span className="text-xs font-bold text-amber-700">לישיבה</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-gray-400">+</span>
                                                    <input
                                                        type="number"
                                                        step="0.5"
                                                        value={form.dine_in_adjustment}
                                                        onChange={(e) => setForm({ ...form, dine_in_adjustment: e.target.value })}
                                                        className="w-24 px-3 py-2 rounded-lg text-center font-black text-xs bg-slate-50 border-none focus:ring-2 focus:ring-amber-300/50"
                                                        placeholder="0.00"
                                                    />
                                                    <span className="text-[10px] font-bold text-gray-400">₪</span>
                                                </div>
                                            </div>
                                        </div>
                                        <p className="text-[9px] text-gray-400 font-medium mt-2">
                                            ריק = שימוש בברירת מחדל מהקטגוריה. הזן 0 לביטול מפורש.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </form>

                        <div className="p-6 bg-slate-50 flex gap-3 border-t border-gray-100 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-brand-primary/5 rounded-full -mr-12 -mt-12" />
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={isLocked}
                                className="flex-1 bg-gray-900 text-white py-4 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-xl hover:shadow-slate-200 transition-all active:scale-95 flex items-center justify-center gap-2.5 disabled:opacity-50 z-10"
                            >
                                <FaCheck size={12} />
                                {editItem ? 'שמור שינויים' : 'צור פריט חדש'}
                            </button>
                            <button
                                type="button"
                                onClick={closeModal}
                                className="px-8 py-4 bg-white text-gray-500 border border-gray-100 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] hover:bg-red-50 hover:text-red-500 hover:border-red-100 transition-all z-10"
                            >
                                ביטול
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}
