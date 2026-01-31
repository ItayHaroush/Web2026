import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { useRestaurantStatus } from '../../context/RestaurantStatusContext';
import AdminLayout from '../../layouts/AdminLayout';
import api from '../../services/apiClient';
import { resolveAssetUrl } from '../../utils/assets';
import AiDescriptionGenerator from '../../components/AiDescriptionGenerator';
import AiPriceRecommender from '../../components/AiPriceRecommender';
import AiImageEnhancer from '../../components/AiImageEnhancer';
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
    FaSync
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

    const [form, setForm] = useState({
        name: '',
        description: '',
        price: '',
        category_id: '',
        image: null,
        use_variants: false,
        use_addons: false,
        addons_group_scope: [],
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

        console.log('📤 Submitting menu item:', {
            name: form.name,
            price: form.price,
            category_id: form.category_id,
            hasImage: !!form.image,
            isEdit: !!editItem,
        });

        try {
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
        if (!confirm('האם אתה בטוח שברצונך למחוק פריט זה?')) return;

        if (isLocked) {
            alert('המסעדה ממתינה לאישור מנהל מערכת. פעולות על התפריט נעולות זמנית.');
            return;
        }

        try {
            await api.delete(`/admin/menu-items/${id}`, { headers: getAuthHeaders() });
            fetchData();
        } catch (error) {
            console.error('Failed to delete item:', error);
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
        });
        setShowModal(true);
    };

    const openNewModal = () => {
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
        });
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
                            {items.length} פריטים במערכת
                        </p>
                    </div>
                    {isManager() && (
                        <button
                            onClick={openNewModal}
                            disabled={isLocked}
                            className="w-full sm:w-auto px-6 py-3.5 bg-gray-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-xl hover:shadow-slate-200 transition-all active:scale-95 flex items-center justify-center gap-2.5 disabled:opacity-50"
                        >
                            <FaPlus size={10} />
                            הוסף פריט חדש
                        </button>
                    )}
                </div>
            </div>

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
                    {categories.map((cat) => (
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
                                        title="מחק פריט"
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

            {/* Modal - מודרני ומרווח */}
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
