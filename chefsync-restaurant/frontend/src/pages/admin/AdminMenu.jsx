import { useState, useEffect } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import AdminLayout from '../../layouts/AdminLayout';
import api from '../../services/apiClient';
import { resolveAssetUrl } from '../../utils/assets';

export default function AdminMenu() {
    const { getAuthHeaders, isManager } = useAdminAuth();
    const [items, setItems] = useState([]);
    const [categories, setCategories] = useState([]);
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
        max_addons: '5',
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            console.log('Fetching menu items and categories...');
            const [itemsRes, categoriesRes] = await Promise.all([
                api.get('/admin/menu-items', { headers: getAuthHeaders() }),
                api.get('/admin/categories', { headers: getAuthHeaders() })
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
        } catch (error) {
            console.error('Failed to fetch data:', error);
            console.error('Error details:', error.response?.data);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (form.use_addons && (!form.max_addons || Number(form.max_addons) < 1)) {
            alert('אנא הזן מספר מקסימלי של סלטים לבחירה');
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
        formData.append('max_addons', form.use_addons ? (form.max_addons || '') : '');

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

        try {
            await api.delete(`/admin/menu-items/${id}`, { headers: getAuthHeaders() });
            fetchData();
        } catch (error) {
            console.error('Failed to delete item:', error);
        }
    };

    const openEditModal = (item) => {
        setEditItem(item);
        setForm({
            name: item.name,
            description: item.description || '',
            price: item.price,
            category_id: item.category_id,
            image: null,
            use_variants: Boolean(item.use_variants),
            use_addons: Boolean(item.use_addons),
            max_addons: item.max_addons ? String(item.max_addons) : '5',
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
            max_addons: '5',
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
            max_addons: '5',
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
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">🍽️ ניהול תפריט</h1>
                    <p className="text-gray-500">{items.length} פריטים</p>
                </div>
                {isManager() && (
                    <button
                        onClick={openNewModal}
                        className="bg-brand-primary text-white px-6 py-3 rounded-xl font-medium hover:bg-brand-dark transition-colors flex items-center gap-2"
                    >
                        <span>➕</span>
                        הוסף פריט
                    </button>
                )}
            </div>

            {/* פילטר קטגוריות */}
            <div className="bg-white rounded-2xl shadow-sm p-4 mb-6">
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setFilterCategory('')}
                        className={`px-4 py-2 rounded-xl font-medium transition-all ${filterCategory === ''
                            ? 'bg-brand-primary text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        הכל
                    </button>
                    {categories.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => setFilterCategory(cat.id.toString())}
                            className={`px-4 py-2 rounded-xl font-medium transition-all ${filterCategory === cat.id.toString()
                                ? 'bg-brand-primary text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            {cat.icon} {cat.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* רשימת פריטים */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(() => {
                    console.log('Rendering items. Total items:', items.length, 'Filtered items:', filteredItems.length);
                    console.log('Filter category:', filterCategory);
                    console.log('Filtered items:', filteredItems);
                    return filteredItems.map((item) => (
                        <div
                            key={item.id}
                            className={`bg-white rounded-2xl shadow-sm overflow-hidden ${!item.is_available ? 'opacity-60' : ''
                                }`}
                        >
                            {/* תמונה */}
                            <div className="h-40 bg-gray-100 relative">
                                {item.image_url ? (
                                    <img
                                        src={resolveAssetUrl(item.image_url)}
                                        alt={item.name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-4xl text-gray-300">
                                        🍽️
                                    </div>
                                )}
                                {!item.is_available && (
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                        <span className="bg-red-500 text-white px-4 py-2 rounded-full font-bold">
                                            לא זמין
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* תוכן */}
                            <div className="p-4">
                                <div className="flex items-start justify-between mb-2">
                                    <div>
                                        <h3 className="font-bold text-gray-800">{item.name}</h3>
                                        <p className="text-sm text-gray-500">{item.category?.name}</p>
                                    </div>
                                    <span className="text-lg font-bold text-brand-primary">₪{item.price}</span>
                                </div>

                                {item.description && (
                                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">{item.description}</p>
                                )}

                                {/* כפתורי פעולה */}
                                {isManager() && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => toggleAvailability(item)}
                                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${item.is_available
                                                ? 'bg-green-50 text-green-600 hover:bg-green-100'
                                                : 'bg-red-50 text-red-600 hover:bg-red-100'
                                                }`}
                                        >
                                            {item.is_available ? '✓ זמין' : '✕ לא זמין'}
                                        </button>
                                        <button
                                            onClick={() => openEditModal(item)}
                                            className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            onClick={() => deleteItem(item.id)}
                                            className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                })()}
            </div>

            {filteredItems.length === 0 && (
                <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-gray-500">
                    <span className="text-4xl mb-4 block">🍽️</span>
                    <p>אין פריטים להצגה</p>
                    {items.length > 0 && (
                        <p className="text-sm mt-2">יש {items.length} פריטים בסך הכל, אך הפילטר לא תואם</p>
                    )}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold">
                                    {editItem ? '✏️ עריכת פריט' : '➕ פריט חדש'}
                                </h2>
                                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                                    ✕
                                </button>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">שם הפריט</label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    required
                                    className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">תיאור</label>
                                <textarea
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    rows={3}
                                    className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">מחיר (₪)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={form.price}
                                        onChange={(e) => setForm({ ...form, price: e.target.value })}
                                        required
                                        className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">קטגוריה</label>
                                    <select
                                        value={form.category_id}
                                        onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                                        required
                                        className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                    >
                                        {categories.map((cat) => (
                                            <option key={cat.id} value={cat.id}>
                                                {cat.icon} {cat.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">תמונה</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => setForm({ ...form, image: e.target.files[0] })}
                                    className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                />
                            </div>

                            <div className="border-t border-gray-100 pt-4 space-y-4">
                                <h3 className="text-sm font-bold text-gray-700">אפשרויות למנה</h3>

                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={form.use_variants}
                                        onChange={(e) => setForm({ ...form, use_variants: e.target.checked })}
                                        className="mt-1 w-4 h-4 rounded"
                                    />
                                    <div>
                                        <p className="text-sm font-medium text-gray-800">🥙 בסיס כריך</p>
                                        <p className="text-xs text-gray-500">אם מסומן, יוצגו כל הבסיסים הפעילים (פיתה / בגט / לאפה וכו').</p>
                                    </div>
                                </label>

                                <div className="space-y-2">
                                    <label className="flex items-start gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={form.use_addons}
                                            onChange={(e) => setForm({ ...form, use_addons: e.target.checked })}
                                            className="mt-1 w-4 h-4 rounded"
                                        />
                                        <div>
                                            <p className="text-sm font-medium text-gray-800">🥗 סלטים</p>
                                            <p className="text-xs text-gray-500">הצגת רשימת הסלטים הגלובלית של המסעדה עבור מנה זו.</p>
                                        </div>
                                    </label>

                                    {form.use_addons && (
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">מקסימום סלטים לבחירה</label>
                                            <input
                                                type="number"
                                                min="1"
                                                max="20"
                                                value={form.max_addons}
                                                onChange={(e) => setForm({ ...form, max_addons: e.target.value })}
                                                className="w-full px-3 py-2 border rounded-lg text-sm"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="submit"
                                    className="flex-1 bg-brand-primary text-white py-3 rounded-xl font-medium hover:bg-brand-dark"
                                >
                                    {editItem ? 'עדכן' : 'הוסף'}
                                </button>
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="px-6 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200"
                                >
                                    ביטול
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}
