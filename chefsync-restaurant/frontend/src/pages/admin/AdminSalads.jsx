import { useEffect, useState } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import { useAdminAuth } from '../../context/AdminAuthContext';
import api from '../../services/apiClient';

export default function AdminSalads() {
    const { getAuthHeaders, isManager } = useAdminAuth();
    const [salads, setSalads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editSalad, setEditSalad] = useState(null);
    const [form, setForm] = useState({ name: '', price_delta: '0', is_active: true });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchSalads();
    }, []);

    const fetchSalads = async () => {
        try {
            const response = await api.get('/admin/salads', { headers: getAuthHeaders() });
            if (response.data.success) {
                setSalads(response.data.salads || []);
            }
        } catch (error) {
            console.error('Failed to load salads', error.response?.data || error.message);
        } finally {
            setLoading(false);
        }
    };

    const openModal = (salad = null) => {
        if (salad) {
            setEditSalad(salad);
            setForm({
                name: salad.name,
                price_delta: typeof salad.price_delta === 'number' ? salad.price_delta.toString() : salad.price_delta || '0',
                is_active: Boolean(salad.is_active),
            });
        } else {
            setEditSalad(null);
            setForm({ name: '', price_delta: '0', is_active: true });
        }
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setEditSalad(null);
        setForm({ name: '', price_delta: '0', is_active: true });
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!isManager()) return;

        const payload = {
            name: form.name.trim(),
            price_delta: Number(form.price_delta) || 0,
            is_active: form.is_active,
        };

        setSaving(true);
        try {
            if (editSalad) {
                await api.put(`/admin/salads/${editSalad.id}`, payload, { headers: getAuthHeaders() });
            } else {
                await api.post('/admin/salads', payload, { headers: getAuthHeaders() });
            }
            closeModal();
            fetchSalads();
        } catch (error) {
            console.error('Failed to save salad', error.response?.data || error.message);
            alert(error.response?.data?.message || 'נכשל בשמירת הסלט');
        } finally {
            setSaving(false);
        }
    };

    const toggleActive = async (salad) => {
        if (!isManager()) return;
        try {
            await api.put(`/admin/salads/${salad.id}`,
                { is_active: !salad.is_active },
                { headers: getAuthHeaders() }
            );
            fetchSalads();
        } catch (error) {
            console.error('Failed to toggle salad', error.response?.data || error.message);
        }
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
                    <h1 className="text-2xl font-bold text-gray-800">🥗 סלטים קבועים</h1>
                    <p className="text-gray-500">{salads.length} סלטים זמינים לכל מנות הכריך</p>
                </div>
                {isManager() && (
                    <button
                        onClick={() => openModal()}
                        className="bg-brand-primary text-white px-6 py-3 rounded-xl font-medium hover:bg-brand-dark transition-colors flex items-center gap-2"
                    >
                        ➕ הוסף סלט
                    </button>
                )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <table className="w-full text-right">
                    <thead className="bg-gray-50 text-gray-600 text-sm">
                        <tr>
                            <th className="py-3 px-4 font-medium">שם הסלט</th>
                            <th className="py-3 px-4 font-medium">תוספת מחיר</th>
                            <th className="py-3 px-4 font-medium">סטטוס</th>
                            {isManager() && <th className="py-3 px-4 font-medium text-center">פעולות</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {salads.length === 0 && (
                            <tr>
                                <td colSpan={isManager() ? 4 : 3} className="py-8 px-4 text-center text-gray-500">
                                    אין סלטים מוגדרים כרגע
                                </td>
                            </tr>
                        )}
                        {salads.map((salad) => (
                            <tr key={salad.id} className="border-t border-gray-100">
                                <td className="py-4 px-4">
                                    <p className="font-semibold text-gray-800">{salad.name}</p>
                                    <p className="text-sm text-gray-500">זמין לכל הפריטים עם בחירת סלטים</p>
                                </td>
                                <td className="py-4 px-4 text-gray-700 font-medium">
                                    {Number(salad.price_delta || 0).toLocaleString('he-IL', { style: 'currency', currency: 'ILS' })}
                                </td>
                                <td className="py-4 px-4">
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${salad.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                        {salad.is_active ? 'פעיל' : 'לא פעיל'}
                                    </span>
                                </td>
                                {isManager() && (
                                    <td className="py-4 px-4">
                                        <div className="flex flex-wrap gap-2 justify-end">
                                            <button
                                                onClick={() => toggleActive(salad)}
                                                className={`px-4 py-2 rounded-lg text-sm font-medium ${salad.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                                            >
                                                {salad.is_active ? 'השבת' : 'הפעל'}
                                            </button>
                                            <button
                                                onClick={() => openModal(salad)}
                                                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                                            >
                                                ערוך
                                            </button>
                                        </div>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {modalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full">
                        <div className="p-6 border-b flex items-center justify-between">
                            <h2 className="text-xl font-bold">{editSalad ? 'עריכת סלט' : 'סלט חדש'}</h2>
                            <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">שם הסלט</label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    required
                                    className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">תוספת מחיר (₪)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value={form.price_delta}
                                    onChange={(e) => setForm({ ...form, price_delta: e.target.value })}
                                    className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                />
                            </div>
                            <label className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    checked={form.is_active}
                                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                                    className="w-5 h-5 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                                />
                                <span className="text-sm text-gray-700">סלט פעיל</span>
                            </label>
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 bg-brand-primary text-white py-3 rounded-xl font-medium hover:bg-brand-dark disabled:opacity-60"
                                >
                                    {saving ? 'שומר...' : editSalad ? 'עדכן' : 'הוסף'}
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
