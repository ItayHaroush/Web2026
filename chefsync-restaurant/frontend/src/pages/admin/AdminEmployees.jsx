import { useState, useEffect } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import AdminLayout from '../../layouts/AdminLayout';
import api from '../../services/apiClient';

export default function AdminEmployees() {
    const { getAuthHeaders, isManager } = useAdminAuth();
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({
        name: '',
        email: '',
        phone: '',
        role: 'employee',
        password: '',
        password_confirmation: '',
    });

    useEffect(() => {
        fetchEmployees();
    }, []);

    const fetchEmployees = async () => {
        try {
            const response = await api.get('/admin/employees', { headers: getAuthHeaders() });
            if (response.data.success) setEmployees(response.data.employees);
        } catch (error) {
            console.error('Failed to fetch employees:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleActive = async (employee) => {
        try {
            await api.put(`/admin/employees/${employee.id}`, { is_active: !employee.is_active }, { headers: getAuthHeaders() });
            fetchEmployees();
        } catch (error) {
            console.error('Failed to toggle active:', error);
        }
    };

    const updateRole = async (employee, newRole) => {
        try {
            await api.put(`/admin/employees/${employee.id}`, { role: newRole }, { headers: getAuthHeaders() });
            fetchEmployees();
        } catch (error) {
            console.error('Failed to update role:', error);
        }
    };

    const deleteEmployee = async (employee) => {
        if (!confirm('למחוק את העובד?')) return;
        try {
            await api.delete(`/admin/employees/${employee.id}`, { headers: getAuthHeaders() });
            fetchEmployees();
        } catch (error) {
            alert(error.response?.data?.message || 'שגיאה במחיקה');
        }
    };

    const createEmployee = async (e) => {
        e.preventDefault();
        try {
            await api.post('/auth/register', form, { headers: getAuthHeaders() });
            setShowModal(false);
            setForm({ name: '', email: '', phone: '', role: 'employee', password: '', password_confirmation: '' });
            fetchEmployees();
        } catch (error) {
            alert(error.response?.data?.message || 'שגיאה בהוספת עובד');
        }
    };

    const roleOptions = [
        { value: 'manager', label: 'מנהל' },
        { value: 'employee', label: 'עובד' },
        { value: 'delivery', label: 'שליח' },
    ];

    const roleBadge = (role) => {
        const map = {
            owner: 'bg-purple-100 text-purple-700',
            manager: 'bg-blue-100 text-blue-700',
            employee: 'bg-green-100 text-green-700',
            delivery: 'bg-orange-100 text-orange-700',
        };
        return map[role] || 'bg-gray-100 text-gray-700';
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
                    <h1 className="text-2xl font-bold text-gray-800">👥 עובדים</h1>
                    <p className="text-gray-500">{employees.length} עובדים</p>
                </div>
                {isManager() && (
                    <button
                        onClick={() => setShowModal(true)}
                        className="bg-brand-primary text-white px-6 py-3 rounded-xl font-medium hover:bg-brand-dark transition-colors flex items-center gap-2"
                    >
                        ➕ עובד חדש
                    </button>
                )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="divide-y">
                    {employees.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            <span className="text-4xl mb-4 block">📭</span>
                            <p>אין עובדים</p>
                        </div>
                    ) : (
                        employees.map((emp) => (
                            <div key={emp.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-brand-primary/10 rounded-xl flex items-center justify-center font-bold text-brand-primary">
                                        {emp.name?.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-800">{emp.name}</p>
                                        <p className="text-sm text-gray-500">{emp.email}</p>
                                        {emp.phone && <p className="text-sm text-gray-500">{emp.phone}</p>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${roleBadge(emp.role)}`}>
                                        {roleOptions.find(r => r.value === emp.role)?.label || emp.role}
                                    </span>
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${emp.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        {emp.is_active ? 'פעיל' : 'מושהה'}
                                    </span>
                                    {isManager() && emp.role !== 'owner' && (
                                        <div className="flex gap-2">
                                            <select
                                                value={emp.role}
                                                onChange={(e) => updateRole(emp, e.target.value)}
                                                className="px-3 py-2 border rounded-lg text-sm"
                                            >
                                                {roleOptions.map((r) => (
                                                    <option key={r.value} value={r.value}>{r.label}</option>
                                                ))}
                                            </select>
                                            <button
                                                onClick={() => toggleActive(emp)}
                                                className={`px-3 py-2 rounded-lg text-sm ${emp.is_active ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}
                                            >
                                                {emp.is_active ? 'השבת' : 'הפעל'}
                                            </button>
                                            <button
                                                onClick={() => deleteEmployee(emp)}
                                                className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-lg w-full overflow-y-auto max-h-[90vh]">
                        <div className="p-6 border-b flex items-center justify-between">
                            <h2 className="text-xl font-bold">➕ עובד חדש</h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                        <form onSubmit={createEmployee} className="p-6 space-y-4">
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
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">אימייל</label>
                                    <input
                                        type="email"
                                        value={form.email}
                                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                                        required
                                        dir="ltr"
                                        className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">טלפון</label>
                                    <input
                                        type="text"
                                        value={form.phone}
                                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                        className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">סיסמה</label>
                                    <input
                                        type="password"
                                        value={form.password}
                                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                                        required
                                        className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">אישור סיסמה</label>
                                    <input
                                        type="password"
                                        value={form.password_confirmation}
                                        onChange={(e) => setForm({ ...form, password_confirmation: e.target.value })}
                                        required
                                        className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">תפקיד</label>
                                <select
                                    value={form.role}
                                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                                    className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                >
                                    {roleOptions.map((r) => (
                                        <option key={r.value} value={r.value}>{r.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button type="submit" className="flex-1 bg-brand-primary text-white py-3 rounded-xl font-medium hover:bg-brand-dark">
                                    הוסף עובד
                                </button>
                                <button type="button" onClick={() => setShowModal(false)} className="px-6 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200">
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
