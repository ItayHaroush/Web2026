import { useState, useEffect } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import AdminLayout from '../../layouts/AdminLayout';
import api from '../../services/apiClient';

export default function AdminCategories() {
    const { getAuthHeaders, isManager } = useAdminAuth();
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editCategory, setEditCategory] = useState(null);
    const [form, setForm] = useState({ name: '', description: '', icon: '📂' });

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            console.log('Fetching categories...');
            const response = await api.get('/admin/categories', { headers: getAuthHeaders() });
            console.log('Categories response:', response.data);

            if (response.data.success) {
                setCategories(response.data.categories || []);
                console.log('Set categories:', response.data.categories);
            }
        } catch (error) {
            console.error('Failed to fetch categories:', error);
            console.error('Error details:', error.response?.data);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editCategory) {
                await api.put(`/admin/categories/${editCategory.id}`, form, { headers: getAuthHeaders() });
            } else {
                await api.post('/admin/categories', form, { headers: getAuthHeaders() });
            }
            closeModal();
            fetchCategories();
        } catch (error) {
            console.error('Failed to save category:', error);
            alert('שגיאה בשמירת הקטגוריה');
        }
    };

    const deleteCategory = async (id) => {
        if (!confirm('למחוק את הקטגוריה?')) return;
        try {
            await api.delete(`/admin/categories/${id}`, { headers: getAuthHeaders() });
            fetchCategories();
        } catch (error) {
            console.error('Failed to delete category:', error);
            alert(error.response?.data?.message || 'שגיאה במחיקה');
        }
    };

    const openNew = () => {
        setEditCategory(null);
        setForm({ name: '', description: '', icon: '📂' });
        setShowModal(true);
    };

    const openEdit = (cat) => {
        setEditCategory(cat);
        setForm({ name: cat.name, description: cat.description || '', icon: cat.icon || '📂' });
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditCategory(null);
    };

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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">📁 קטגוריות</h1>
                    <p className="text-gray-500">{categories.length} קטגוריות פעילות</p>
                </div>
                {isManager() && (
                    <button
                        onClick={openNew}
                        className="bg-brand-primary text-white px-6 py-3 rounded-xl font-medium hover:bg-brand-dark transition-colors flex items-center gap-2"
                    >
                        ➕ קטגוריה
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map((cat) => (
                    <div key={cat.id} className="bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-3">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-2xl">{cat.icon || '📁'}</span>
                                <div>
                                    <p className="font-bold text-gray-800">{cat.name}</p>
                                    {cat.description && <p className="text-sm text-gray-500">{cat.description}</p>}
                                </div>
                            </div>
                            <span className="text-sm text-gray-500">{cat.items_count || 0} פריטים</span>
                        </div>

                        {isManager() && (
                            <div className="flex gap-2">
                                <button
                                    onClick={() => openEdit(cat)}
                                    className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200"
                                >
                                    ✏️ עריכה
                                </button>
                                <button
                                    onClick={() => deleteCategory(cat.id)}
                                    className="px-4 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                                >
                                    🗑️
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {categories.length === 0 && (
                <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-gray-500">
                    <span className="text-4xl mb-4 block">📭</span>
                    <p>אין קטגוריות</p>
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full">
                        <div className="p-6 border-b flex items-center justify-between">
                            <h2 className="text-xl font-bold">{editCategory ? 'עריכת קטגוריה' : 'קטגוריה חדשה'}</h2>
                            <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">שם</label>
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
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">אייקון (Emoji)</label>
                                <input
                                    type="text"
                                    value={form.icon}
                                    onChange={(e) => setForm({ ...form, icon: e.target.value })}
                                    maxLength={4}
                                    className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="submit" className="flex-1 bg-brand-primary text-white py-3 rounded-xl font-medium hover:bg-brand-dark">
                                    {editCategory ? 'עדכן' : 'הוסף'}
                                </button>
                                <button type="button" onClick={closeModal} className="px-6 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200">
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
