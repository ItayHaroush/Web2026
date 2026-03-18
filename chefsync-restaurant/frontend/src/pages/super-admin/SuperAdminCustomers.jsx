import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import SuperAdminLayout from '../../layouts/SuperAdminLayout';
import { useAdminAuth } from '../../context/AdminAuthContext';
import api from '../../services/apiClient';
import {
    FaUsers, FaSearch, FaSpinner, FaChevronLeft, FaChevronRight,
    FaPhone, FaEnvelope, FaShoppingBag, FaClock, FaCheckCircle,
    FaTimes, FaEye, FaEdit, FaTrash, FaUserPlus
} from 'react-icons/fa';

export default function SuperAdminCustomers() {
    const navigate = useNavigate();
    const { getAuthHeaders } = useAdminAuth();
    const [customers, setCustomers] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState({});
    const [filters, setFilters] = useState({ registered_only: false, has_orders: false, has_email: false });
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [editForm, setEditForm] = useState({ name: '', email: '', phone: '' });
    const [saving, setSaving] = useState(false);

    const fetchStats = useCallback(async () => {
        try {
            const res = await api.get('/super-admin/customers/stats', { headers: getAuthHeaders() });
            if (res.data?.success) setStats(res.data.data);
        } catch {}
    }, [getAuthHeaders]);

    const fetchCustomers = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page, per_page: 25 });
            if (search) params.set('search', search);
            if (filters.registered_only) params.set('registered_only', '1');
            if (filters.has_orders) params.set('has_orders', '1');
            if (filters.has_email) params.set('has_email', '1');

            const res = await api.get(`/super-admin/customers?${params}`, { headers: getAuthHeaders() });
            if (res.data?.success) {
                setCustomers(res.data.data.data || []);
                setMeta({ lastPage: res.data.data.last_page, total: res.data.data.total, currentPage: res.data.data.current_page });
            }
        } catch {}
        setLoading(false);
    }, [getAuthHeaders, page, search, filters]);

    useEffect(() => { fetchStats(); }, [fetchStats]);
    useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

    const handleSearch = (e) => {
        e.preventDefault();
        setPage(1);
        fetchCustomers();
    };

    const startEdit = (c) => {
        setEditingCustomer(c);
        setEditForm({ name: c.name || '', email: c.email || '', phone: c.phone || '' });
    };

    const saveEdit = async () => {
        if (!editingCustomer) return;
        setSaving(true);
        try {
            const res = await api.put(`/super-admin/customers/${editingCustomer.id}`, editForm, { headers: getAuthHeaders() });
            if (res.data?.success) {
                setEditingCustomer(null);
                fetchCustomers();
            }
        } catch {}
        setSaving(false);
    };

    const deleteCustomer = async (id) => {
        if (!window.confirm('למחוק את הלקוח? פעולה זו אינה הפיכה.')) return;
        try {
            await api.delete(`/super-admin/customers/${id}`, { headers: getAuthHeaders() });
            fetchCustomers();
            fetchStats();
        } catch {}
    };

    return (
        <SuperAdminLayout>
            <div className="space-y-6" dir="rtl">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg">
                                <FaUsers size={18} />
                            </div>
                            ניהול לקוחות
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">כל משתמשי הקצה של המערכת</p>
                    </div>
                </div>

                {/* Stats */}
                {stats && (
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        {[
                            { label: 'סה״כ לקוחות', value: stats.total, color: 'text-indigo-600 bg-indigo-50' },
                            { label: 'רשומים', value: stats.registered, color: 'text-green-600 bg-green-50' },
                            { label: 'עם הזמנות', value: stats.withOrders, color: 'text-blue-600 bg-blue-50' },
                            { label: 'חדשים השבוע', value: stats.newThisWeek, color: 'text-purple-600 bg-purple-50' },
                            { label: 'חדשים החודש', value: stats.newThisMonth, color: 'text-orange-600 bg-orange-50' },
                        ].map(s => (
                            <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                                <p className="text-xl font-black text-gray-900">{s.value}</p>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mt-1">{s.label}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Search & Filters */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
                    <form onSubmit={handleSearch} className="flex gap-2">
                        <div className="relative flex-1">
                            <FaSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
                            <input
                                type="text"
                                placeholder="חפש לפי שם, טלפון או אימייל..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pr-9 pl-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 outline-none"
                            />
                        </div>
                        <button type="submit" className="bg-indigo-600 text-white px-4 rounded-xl text-sm font-bold hover:bg-indigo-700">
                            חפש
                        </button>
                    </form>
                    <div className="flex gap-2 flex-wrap">
                        {[
                            { key: 'registered_only', label: 'רשומים בלבד' },
                            { key: 'has_orders', label: 'עם הזמנות' },
                            { key: 'has_email', label: 'עם אימייל' },
                        ].map(f => (
                            <button
                                key={f.key}
                                onClick={() => { setFilters(prev => ({ ...prev, [f.key]: !prev[f.key] })); setPage(1); }}
                                className={`px-3 py-1 rounded-full text-xs font-bold transition ${filters[f.key] ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Customers table */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <FaSpinner className="animate-spin text-indigo-600" size={24} />
                        </div>
                    ) : customers.length === 0 ? (
                        <div className="text-center py-16">
                            <FaUsers className="mx-auto text-4xl text-gray-300 mb-3" />
                            <p className="text-gray-400 text-sm">לא נמצאו לקוחות</p>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-wider">
                                        <tr>
                                            <th className="text-right px-4 py-3">שם</th>
                                            <th className="text-right px-4 py-3">טלפון</th>
                                            <th className="text-right px-4 py-3">אימייל</th>
                                            <th className="text-center px-4 py-3">הזמנות</th>
                                            <th className="text-right px-4 py-3">הזמנה אחרונה</th>
                                            <th className="text-right px-4 py-3">רישום</th>
                                            <th className="text-center px-4 py-3">פעולות</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {customers.map(c => (
                                            <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="px-4 py-3 font-bold text-gray-900">{c.name}</td>
                                                <td className="px-4 py-3 text-gray-500 ltr text-right" dir="ltr">{c.phone}</td>
                                                <td className="px-4 py-3">
                                                    {c.email ? (
                                                        <span className="flex items-center gap-1 text-gray-600">
                                                            {c.email}
                                                            {c.email_verified_at
                                                                ? <FaCheckCircle className="text-green-500" size={10} />
                                                                : <FaClock className="text-amber-500" size={10} />
                                                            }
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-300">—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-center font-bold text-gray-900">{c.total_orders || 0}</td>
                                                <td className="px-4 py-3 text-gray-400 text-xs">
                                                    {c.last_order_at ? new Date(c.last_order_at).toLocaleDateString('he-IL') : '—'}
                                                </td>
                                                <td className="px-4 py-3 text-gray-400 text-xs">
                                                    {new Date(c.created_at).toLocaleDateString('he-IL')}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button
                                                            onClick={() => navigate(`/super-admin/customers/${c.id}`)}
                                                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                                                            title="צפה"
                                                        >
                                                            <FaEye size={12} />
                                                        </button>
                                                        <button
                                                            onClick={() => startEdit(c)}
                                                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                                            title="ערוך"
                                                        >
                                                            <FaEdit size={12} />
                                                        </button>
                                                        <button
                                                            onClick={() => deleteCustomer(c.id)}
                                                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                                                            title="מחק"
                                                        >
                                                            <FaTrash size={11} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            {meta.lastPage > 1 && (
                                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                                    <p className="text-xs text-gray-400">עמוד {meta.currentPage} מתוך {meta.lastPage} ({meta.total} לקוחות)</p>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => setPage(p => Math.max(1, p - 1))}
                                            disabled={page <= 1}
                                            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30"
                                        >
                                            <FaChevronRight size={12} />
                                        </button>
                                        <button
                                            onClick={() => setPage(p => Math.min(meta.lastPage, p + 1))}
                                            disabled={page >= meta.lastPage}
                                            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30"
                                        >
                                            <FaChevronLeft size={12} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Edit Modal */}
                {editingCustomer && (
                    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
                        <div className="fixed inset-0 bg-black/50" onClick={() => setEditingCustomer(null)} />
                        <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 z-10" dir="rtl">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-black text-gray-900">עריכת לקוח</h3>
                                <button onClick={() => setEditingCustomer(null)} className="text-gray-400 hover:text-gray-600">
                                    <FaTimes size={18} />
                                </button>
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1">שם</label>
                                    <input
                                        type="text"
                                        value={editForm.name}
                                        onChange={(e) => setEditForm(p => ({ ...p, name: e.target.value }))}
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1">טלפון</label>
                                    <input
                                        type="tel"
                                        dir="ltr"
                                        value={editForm.phone}
                                        onChange={(e) => setEditForm(p => ({ ...p, phone: e.target.value }))}
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1">אימייל</label>
                                    <input
                                        type="email"
                                        dir="ltr"
                                        value={editForm.email}
                                        onChange={(e) => setEditForm(p => ({ ...p, email: e.target.value }))}
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                                    />
                                </div>
                            </div>
                            <button
                                onClick={saveEdit}
                                disabled={saving}
                                className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition disabled:opacity-50"
                            >
                                {saving ? <FaSpinner className="animate-spin mx-auto" /> : 'שמור'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </SuperAdminLayout>
    );
}
