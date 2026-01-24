import { useState, useEffect } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import AdminLayout from '../../layouts/AdminLayout';
import api from '../../services/apiClient';
import {
    FaUsers,
    FaUserPlus,
    FaUserShield,
    FaEnvelope,
    FaPhone,
    FaTrash,
    FaCheckCircle,
    FaTimesCircle,
    FaClock,
    FaLock,
    FaUserTag,
    FaToggleOn,
    FaToggleOff,
    FaTimes
} from 'react-icons/fa';

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
        if (!confirm('האם אתה בטוח שברצונך למחוק את העובד?')) return;
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
        { value: 'manager', label: 'מנהל צוות' },
        { value: 'employee', label: 'עובד מטבח/דלפק' },
        { value: 'delivery', label: 'שליח' },
    ];

    const roleMap = {
        owner: { label: 'בעלים', color: 'bg-indigo-50 text-indigo-700 border-indigo-100', icon: <FaUserShield className="text-[10px]" /> },
        manager: { label: 'מנהל', color: 'bg-blue-50 text-blue-700 border-blue-100', icon: <FaCheckCircle className="text-[10px]" /> },
        employee: { label: 'עובד', color: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: <FaUsers className="text-[10px]" /> },
        delivery: { label: 'שליח', color: 'bg-amber-50 text-amber-700 border-amber-100', icon: <FaClock className="text-[10px]" /> },
    };

    if (loading) {
        return (
            <AdminLayout>
                <div className="flex flex-col items-center justify-center h-96">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-brand-primary"></div>
                    <p className="mt-4 text-gray-500 font-black animate-pulse">טוען רשימת עובדים...</p>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="max-w-7xl mx-auto space-y-12 pb-40 animate-in fade-in duration-700">
                {/* Header Section - Modern SaaS Style */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 px-4">
                    <div className="flex items-center gap-6">
                        <div className="w-24 h-24 bg-indigo-50 rounded-[2.5rem] flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100/50">
                            <FaUsers size={36} />
                        </div>
                        <div>
                            <h1 className="text-5xl font-black text-gray-900 tracking-tight">צוות עובדים</h1>
                            <div className="flex items-center gap-4 mt-2">
                                <span className="flex items-center gap-2 px-4 py-1.5 bg-indigo-100/50 text-indigo-700 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-indigo-200/30">
                                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                                    {employees.length} חברי צוות
                                </span>
                                <span className="text-gray-300">/</span>
                                <p className="text-gray-500 font-bold text-sm">ניהול הרשאות, תפקידים וגישה לחנות</p>
                            </div>
                        </div>
                    </div>
                    {isManager() && (
                        <button
                            onClick={() => setShowModal(true)}
                            className="w-full md:w-auto bg-brand-primary text-white px-12 py-6 rounded-[2rem] font-black hover:bg-brand-dark transition-all flex items-center justify-center gap-4 shadow-2xl shadow-brand-primary/30 active:scale-95 group hover:-translate-y-1"
                        >
                            <div className="bg-white/20 p-2.5 rounded-xl group-hover:rotate-90 transition-transform">
                                <FaUserPlus size={16} />
                            </div>
                            <span className="text-lg">הוספת איש צוות</span>
                        </button>
                    )}
                </div>

                {/* Employees Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10 px-4">
                    {employees.map((emp) => {
                        const roleInfo = roleMap[emp.role] || { label: emp.role, color: 'bg-gray-50 text-gray-600', icon: null };
                        return (
                            <div
                                key={emp.id}
                                className={`group bg-white rounded-[3.5rem] shadow-xl shadow-gray-200/50 border border-gray-100 p-10 flex flex-col gap-8 hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 relative overflow-hidden ${!emp.is_active && 'opacity-60 grayscale-[0.6]'}`}
                            >
                                {/* Role Badge & Status Toggle */}
                                <div className="flex justify-between items-start">
                                    <div className={`flex items-center gap-3 px-4 py-2 rounded-2xl text-[10px] font-black border uppercase tracking-[0.15em] shadow-sm ${roleInfo.color}`}>
                                        {roleInfo.icon}
                                        {roleInfo.label}
                                    </div>

                                    {isManager() && emp.role !== 'owner' && (
                                        <button
                                            onClick={() => toggleActive(emp)}
                                            className={`p-3 rounded-2xl transition-all shadow-sm active:scale-90 ${emp.is_active ? 'text-emerald-500 bg-emerald-50 hover:bg-emerald-500 hover:text-white' : 'text-gray-400 bg-gray-50 hover:bg-gray-400 hover:text-white'}`}
                                            title={emp.is_active ? 'השבת עובד' : 'הפעל עובד'}
                                        >
                                            {emp.is_active ? <FaToggleOn size={24} /> : <FaToggleOff size={24} />}
                                        </button>
                                    )}
                                </div>

                                {/* User Info Card */}
                                <div className="flex flex-col items-center gap-6 py-4">
                                    <div className={`w-32 h-32 rounded-[3.5rem] flex items-center justify-center text-4xl font-black shadow-2xl transition-transform duration-500 group-hover:scale-105 group-hover:rotate-3 ${roleInfo.color} border-4 border-white`}>
                                        {emp.name.charAt(0)}
                                    </div>
                                    <div className="text-center">
                                        <h3 className="text-3xl font-black text-gray-900 group-hover:text-brand-primary transition-colors tracking-tight">{emp.name}</h3>
                                        {!emp.is_active && (
                                            <span className="text-rose-500 text-[10px] font-black uppercase mt-1 block tracking-widest">חשבון מושבת</span>
                                        )}
                                    </div>
                                </div>

                                {/* Contact Details */}
                                <div className="space-y-4 pt-6 mt-auto border-t border-gray-50 bg-gray-50/30 -mx-10 px-10 pb-6">
                                    <div className="flex items-center gap-4 text-gray-500 group/link">
                                        <div className="p-3 bg-white rounded-xl shadow-sm text-gray-400 group-hover/link:text-brand-primary group-hover/link:shadow-md transition-all">
                                            <FaEnvelope size={14} />
                                        </div>
                                        <span className="text-sm font-black truncate ltr tracking-tight">{emp.email}</span>
                                    </div>
                                    {emp.phone && (
                                        <div className="flex items-center gap-4 text-gray-500 group/link">
                                            <div className="p-3 bg-white rounded-xl shadow-sm text-gray-400 group-hover/link:text-brand-primary group-hover/link:shadow-md transition-all">
                                                <FaPhone size={14} />
                                            </div>
                                            <span className="text-sm font-black ltr tracking-tight">{emp.phone}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Actions Section */}
                                {isManager() && emp.role !== 'owner' && (
                                    <div className="flex flex-col gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-2">עדכון תפקיד</label>
                                            <select
                                                value={emp.role}
                                                onChange={(e) => updateRole(emp, e.target.value)}
                                                className="w-full px-6 py-4 bg-gray-50 border-none rounded-[1.5rem] text-xs font-black text-gray-700 focus:ring-4 focus:ring-brand-primary/10 cursor-pointer hover:bg-white hover:shadow-md transition-all appearance-none"
                                            >
                                                {roleOptions.map(opt => (
                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <button
                                            onClick={() => deleteEmployee(emp)}
                                            className="w-full flex items-center justify-center gap-3 py-4 bg-rose-50 text-rose-600 rounded-[1.5rem] text-xs font-black hover:bg-rose-600 hover:text-white transition-all active:scale-95 border border-rose-100/50"
                                        >
                                            <FaTrash size={14} />
                                            הסרה מהצוות
                                        </button>
                                    </div>
                                )}

                                {emp.role === 'owner' && (
                                    <div className="bg-indigo-50/50 p-6 rounded-[2rem] border border-indigo-100 text-center">
                                        <span className="text-[11px] font-black text-indigo-700 tracking-tight flex items-center justify-center gap-2 italic">
                                            <FaLock size={10} /> גישת מנהל מערכת ראשית
                                        </span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {employees.length === 0 && (
                    <div className="bg-white rounded-[4rem] shadow-sm border border-gray-100 p-24 text-center flex flex-col items-center max-w-2xl mx-auto col-span-full">
                        <div className="w-32 h-32 bg-gray-50 rounded-[4rem] flex items-center justify-center text-6xl mb-10 grayscale opacity-40">
                            <FaUserShield />
                        </div>
                        <h3 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">הצוות שלך מתחיל כאן</h3>
                        <p className="text-gray-500 font-medium mb-12 text-lg leading-relaxed">הוסף עובדים, מנהלים ושליחים כדי להפעיל את המערכת בצורה יעילה ומסונכרנת</p>
                        <button
                            onClick={() => setShowModal(true)}
                            className="bg-brand-primary text-white px-12 py-6 rounded-[2rem] font-black hover:bg-brand-dark transition-all flex items-center gap-4 shadow-2xl shadow-brand-primary/20 text-xl active:scale-95"
                        >
                            <FaUserPlus /> הוספת איש צוות ראשון
                        </button>
                    </div>
                )}

                {/* Modern Premium Modal */}
                {showModal && (
                    <div className="fixed inset-0 bg-gray-900/70 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-500">
                        <div className="bg-white rounded-[4rem] shadow-2xl max-w-2xl w-full overflow-hidden border border-white/20 animate-in zoom-in-95 duration-400 overflow-y-auto max-h-[92vh] custom-scrollbar">
                            <div className="px-12 py-10 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-xl z-20">
                                <div className="flex items-center gap-6">
                                    <div className="p-4 bg-brand-primary text-white rounded-[2rem] shadow-xl shadow-brand-primary/20">
                                        <FaUserPlus size={24} />
                                    </div>
                                    <div>
                                        <h2 className="text-3xl font-black text-gray-900 tracking-tight">צירוף איש צוות</h2>
                                        <p className="text-gray-500 font-bold text-sm mt-0.5 whitespace-nowrap">הגדרת הרשאות ופרטי גישה</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="p-4 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-[1.5rem] transition-all"
                                >
                                    <FaTimes size={24} />
                                </button>
                            </div>

                            <form onSubmit={createEmployee} className="p-12 space-y-12 pb-20">
                                <div className="space-y-10">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                        <div className="space-y-4">
                                            <label className="text-xs font-black text-gray-500 mr-2 uppercase tracking-[0.2em]">שם מלא</label>
                                            <input
                                                type="text"
                                                value={form.name}
                                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                                required
                                                className="w-full px-8 py-5 bg-gray-50 border-none rounded-[1.5rem] focus:ring-4 focus:ring-brand-primary/10 text-gray-900 font-black transition-all text-lg"
                                                placeholder="ישראל ישראלי"
                                            />
                                        </div>
                                        <div className="space-y-4">
                                            <label className="text-xs font-black text-gray-500 mr-2 uppercase tracking-[0.2em]">מספר טלפון</label>
                                            <input
                                                type="tel"
                                                value={form.phone}
                                                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                                className="w-full px-8 py-5 bg-gray-50 border-none rounded-[1.5rem] focus:ring-4 focus:ring-brand-primary/10 text-gray-900 font-black transition-all text-lg ltr"
                                                placeholder="050-0000000"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <label className="text-xs font-black text-gray-500 mr-2 uppercase tracking-[0.2em]">כתובת אימייל לכניסה</label>
                                        <input
                                            type="email"
                                            value={form.email}
                                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                                            required
                                            className="w-full px-8 py-5 bg-gray-50 border-none rounded-[1.5rem] focus:ring-4 focus:ring-brand-primary/10 text-gray-900 font-black transition-all text-lg ltr"
                                            placeholder="name@restaurant.com"
                                        />
                                    </div>

                                    <div className="space-y-6">
                                        <label className="text-xs font-black text-gray-500 mr-2 uppercase tracking-[0.2em]">תפקיד והרשאות</label>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                            {roleOptions.map((opt) => (
                                                <button
                                                    key={opt.value}
                                                    type="button"
                                                    onClick={() => setForm({ ...form, role: opt.value })}
                                                    className={`flex flex-col items-center justify-center p-8 rounded-[2.5rem] border-2 transition-all gap-4 relative group active:scale-95 ${form.role === opt.value ? 'bg-brand-primary/5 border-brand-primary text-brand-primary shadow-lg shadow-brand-primary/10' : 'bg-gray-50 border-transparent text-gray-400 hover:bg-gray-100'}`}
                                                >
                                                    <div className={`text-4xl transition-transform duration-500 ${form.role === opt.value ? 'scale-110' : 'group-hover:scale-110 grayscale opacity-40'}`}>
                                                        {opt.value === 'manager' && <FaUserShield />}
                                                        {opt.value === 'employee' && <FaUsers />}
                                                        {opt.value === 'delivery' && <FaClock />}
                                                    </div>
                                                    <div className="text-center">
                                                        <span className={`block font-black text-sm ${form.role === opt.value ? 'text-brand-primary' : 'text-gray-700'}`}>{opt.label}</span>
                                                    </div>
                                                    {form.role === opt.value && (
                                                        <div className="absolute top-4 right-4 text-brand-primary">
                                                            <FaCheckCircle size={16} />
                                                        </div>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pt-6">
                                        <div className="space-y-4">
                                            <label className="text-xs font-black text-gray-500 mr-2 uppercase tracking-[0.2em] flex items-center gap-2">
                                                <FaLock className="text-brand-primary" /> סיסמה חזקה
                                            </label>
                                            <input
                                                type="password"
                                                value={form.password}
                                                onChange={(e) => setForm({ ...form, password: e.target.value })}
                                                required
                                                className="w-full px-8 py-5 bg-gray-50 border-none rounded-[1.5rem] focus:ring-4 focus:ring-brand-primary/10 text-gray-900 font-black transition-all"
                                                placeholder="••••••••"
                                            />
                                        </div>
                                        <div className="space-y-4">
                                            <label className="text-xs font-black text-gray-500 mr-2 uppercase tracking-[0.2em]">אימות סיסמה</label>
                                            <input
                                                type="password"
                                                value={form.password_confirmation}
                                                onChange={(e) => setForm({ ...form, password_confirmation: e.target.value })}
                                                required
                                                className="w-full px-8 py-5 bg-gray-50 border-none rounded-[1.5rem] focus:ring-4 focus:ring-brand-primary/10 text-gray-900 font-black transition-all"
                                                placeholder="••••••••"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-6 pt-10 sticky bottom-0 bg-white/80 backdrop-blur-md z-10">
                                    <button
                                        type="submit"
                                        className="flex-[2] bg-gray-900 text-white py-6 rounded-[2rem] font-black text-xl hover:shadow-2xl hover:shadow-gray-200 hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-4"
                                    >
                                        <FaCheckCircle />
                                        יצירת חשבון עובד
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="flex-1 px-10 py-6 bg-gray-100 text-gray-600 rounded-[2rem] font-black hover:bg-gray-200 transition-all active:scale-95"
                                    >
                                        ביטול
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
