import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import { useAdminAuth } from '../../context/AdminAuthContext';
import api from '../../services/apiClient';

export default function AdminSalads() {
    const { getAuthHeaders, isManager } = useAdminAuth();
    const [salads, setSalads] = useState([]);
    const [groups, setGroups] = useState([]);
    const [categories, setCategories] = useState([]);
    const [selectedGroupId, setSelectedGroupId] = useState('');
    const [groupEdits, setGroupEdits] = useState({});
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editSalad, setEditSalad] = useState(null);
    const [form, setForm] = useState({
        name: '',
        price_delta: '0',
        is_active: true,
        group_id: '',
        category_ids: [],
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchSalads();
    }, []);

    const fetchSalads = async () => {
        try {
            const [saladsRes, categoriesRes] = await Promise.all([
                api.get('/admin/salads', { headers: getAuthHeaders() }),
                api.get('/admin/categories', { headers: getAuthHeaders() }),
            ]);

            if (saladsRes.data.success) {
                setSalads(saladsRes.data.salads || []);
                const fetchedGroups = saladsRes.data.groups || [];
                setGroups(fetchedGroups);
                if (!selectedGroupId && fetchedGroups.length) {
                    setSelectedGroupId(String(fetchedGroups[0].id));
                }
                const groupState = fetchedGroups.reduce((acc, group) => {
                    acc[group.id] = {
                        sort_order: group.sort_order ?? 0,
                        is_active: Boolean(group.is_active),
                    };
                    return acc;
                }, {});
                setGroupEdits(groupState);
            }

            if (categoriesRes.data.success) {
                setCategories(categoriesRes.data.categories || []);
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
                group_id: String(salad.addon_group_id || selectedGroupId || ''),
                category_ids: Array.isArray(salad.category_ids) ? salad.category_ids.map(String) : [],
            });
        } else {
            setEditSalad(null);
            setForm({
                name: '',
                price_delta: '0',
                is_active: true,
                group_id: String(selectedGroupId || ''),
                category_ids: [],
            });
        }
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setEditSalad(null);
        setForm({
            name: '',
            price_delta: '0',
            is_active: true,
            group_id: String(selectedGroupId || ''),
            category_ids: [],
        });
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!isManager()) return;

        const payload = {
            name: form.name.trim(),
            price_delta: Number(form.price_delta) || 0,
            is_active: form.is_active,
            group_id: form.group_id || null,
            category_ids: form.category_ids?.length ? form.category_ids.map(Number) : [],
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
            alert(error.response?.data?.message || 'נכשל בשמירת התוספת');
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

    const updateGroup = async (groupId) => {
        if (!isManager()) return;
        const edit = groupEdits[groupId];
        if (!edit) return;
        try {
            await api.put(`/admin/addon-groups/${groupId}`,
                { sort_order: Number(edit.sort_order) || 0, is_active: Boolean(edit.is_active) },
                { headers: getAuthHeaders() }
            );
            fetchSalads();
        } catch (error) {
            console.error('Failed to update group', error.response?.data || error.message);
        }
    };

    const visibleSalads = selectedGroupId
        ? salads.filter((salad) => String(salad.addon_group_id) === String(selectedGroupId))
        : salads;

    const groupNameById = useMemo(() => {
        return groups.reduce((acc, group) => {
            acc[group.id] = group.name;
            return acc;
        }, {});
    }, [groups]);

    const categoryNameById = useMemo(() => {
        return categories.reduce((acc, category) => {
            acc[category.id] = category.name;
            return acc;
        }, {});
    }, [categories]);

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
                    <h1 className="text-2xl font-bold text-gray-800">➕ תוספות</h1>
                    <p className="text-gray-500">{salads.length} תוספות מוגדרות במסעדה</p>
                </div>
                {isManager() && (
                    <button
                        onClick={() => openModal()}
                        className="bg-brand-primary text-white px-6 py-3 rounded-xl font-medium hover:bg-brand-dark transition-colors flex items-center gap-2"
                    >
                        ➕ הוסף תוספת
                    </button>
                )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-4 mb-6 space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <label className="text-sm font-medium text-gray-700">קבוצת תוספות להצגה</label>
                    <select
                        value={selectedGroupId}
                        onChange={(e) => setSelectedGroupId(e.target.value)}
                        className="px-3 py-2 border rounded-lg text-sm"
                    >
                        {groups.map((group) => (
                            <option key={group.id} value={group.id}>{group.name}</option>
                        ))}
                    </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {groups.map((group) => (
                        <div key={group.id} className="border rounded-xl p-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-semibold text-gray-800">{group.name}</p>
                                    <p className="text-xs text-gray-500">סדר הצגה: {group.sort_order}</p>
                                </div>
                                <button
                                    onClick={() => updateGroup(group.id)}
                                    className="text-xs px-3 py-1 rounded-lg border border-gray-300"
                                >
                                    שמור סדר
                                </button>
                            </div>
                            <div className="mt-3 flex items-center gap-3">
                                <input
                                    type="number"
                                    min="0"
                                    value={groupEdits[group.id]?.sort_order ?? 0}
                                    onChange={(e) => setGroupEdits((prev) => ({
                                        ...prev,
                                        [group.id]: { ...prev[group.id], sort_order: e.target.value },
                                    }))}
                                    className="w-24 px-2 py-1 border rounded-lg text-sm"
                                />
                                <label className="flex items-center gap-2 text-sm text-gray-600">
                                    <input
                                        type="checkbox"
                                        checked={groupEdits[group.id]?.is_active ?? true}
                                        onChange={(e) => setGroupEdits((prev) => ({
                                            ...prev,
                                            [group.id]: { ...prev[group.id], is_active: e.target.checked },
                                        }))}
                                    />
                                    פעיל
                                </label>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <table className="w-full text-right">
                    <thead className="bg-gray-50 text-gray-600 text-sm">
                        <tr>
                            <th className="py-3 px-4 font-medium">שם התוספת</th>
                            <th className="py-3 px-4 font-medium">תוספת מחיר</th>
                            <th className="py-3 px-4 font-medium">קטגוריות</th>
                            <th className="py-3 px-4 font-medium">סטטוס</th>
                            {isManager() && <th className="py-3 px-4 font-medium text-center">פעולות</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {salads.length === 0 && (
                            <tr>
                                <td colSpan={isManager() ? 5 : 4} className="py-8 px-4 text-center text-gray-500">
                                    אין תוספות מוגדרות כרגע
                                </td>
                            </tr>
                        )}
                        {visibleSalads.map((salad) => (
                            <tr key={salad.id} className="border-t border-gray-100">
                                <td className="py-4 px-4">
                                    <p className="font-semibold text-gray-800">{salad.name}</p>
                                    <p className="text-sm text-gray-500">{groupNameById[salad.addon_group_id] || 'קבוצה לא ידועה'}</p>
                                </td>
                                <td className="py-4 px-4 text-gray-700 font-medium">
                                    {Number(salad.price_delta || 0).toLocaleString('he-IL', { style: 'currency', currency: 'ILS' })}
                                </td>
                                <td className="py-4 px-4">
                                    {Array.isArray(salad.category_ids) && salad.category_ids.length > 0 ? (
                                        <div className="flex flex-wrap gap-1 text-xs">
                                            {salad.category_ids.map((id) => (
                                                <span key={id} className="px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                                                    {categoryNameById[id] || `#${id}`}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="text-xs text-gray-500">כל הקטגוריות</span>
                                    )}
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
                            <h2 className="text-xl font-bold">{editSalad ? 'עריכת תוספת' : 'תוספת חדשה'}</h2>
                            <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">קבוצת תוספות</label>
                                <select
                                    value={form.group_id}
                                    onChange={(e) => setForm({ ...form, group_id: e.target.value })}
                                    className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                >
                                    {groups.map((group) => (
                                        <option key={group.id} value={group.id}>{group.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">שם התוספת</label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    required
                                    className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">קטגוריות מתאימות</label>
                                <div className="border rounded-xl p-3 max-h-40 overflow-auto space-y-2">
                                    {categories.length === 0 && (
                                        <p className="text-sm text-gray-500">אין קטגוריות זמינות</p>
                                    )}
                                    {categories.map((cat) => (
                                        <label key={cat.id} className="flex items-center gap-2 text-sm text-gray-700">
                                            <input
                                                type="checkbox"
                                                checked={form.category_ids.includes(String(cat.id))}
                                                onChange={(e) => {
                                                    const next = e.target.checked
                                                        ? [...form.category_ids, String(cat.id)]
                                                        : form.category_ids.filter((id) => id !== String(cat.id));
                                                    setForm({ ...form, category_ids: next });
                                                }}
                                            />
                                            <span>{cat.name}</span>
                                        </label>
                                    ))}
                                </div>
                                <p className="text-xs text-gray-500 mt-1">אם לא מסומן כלום — התוספת תופיע בכל הקטגוריות.</p>
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
                                <span className="text-sm text-gray-700">תוספת פעילה</span>
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
