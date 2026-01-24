import { useEffect, useState } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import { useAdminAuth } from '../../context/AdminAuthContext';
import api from '../../services/apiClient';
import {
    FaBreadSlice,
    FaPlus,
    FaEdit,
    FaTrash,
    FaCheckCircle,
    FaTimesCircle,
    FaStar,
    FaToggleOn,
    FaToggleOff,
    FaTimes,
    FaSave,
    FaInfoCircle
} from 'react-icons/fa';

export default function AdminBases() {
    const { getAuthHeaders, isManager } = useAdminAuth();
    const [bases, setBases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editBase, setEditBase] = useState(null);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ name: '', price_delta: '0', is_active: true, is_default: false });

    useEffect(() => {
        fetchBases();
    }, []);

    const fetchBases = async () => {
        try {
            const response = await api.get('/admin/bases', { headers: getAuthHeaders() });
            if (response.data.success) {
                setBases(response.data.bases || []);
            }
        } catch (error) {
            console.error('Failed to load bases', error.response?.data || error.message);
        } finally {
            setLoading(false);
        }
    };

    const openModal = (base = null) => {
        if (base) {
            setEditBase(base);
            setForm({
                name: base.name,
                price_delta: typeof base.price_delta === 'number' ? base.price_delta.toString() : base.price_delta || '0',
                is_active: Boolean(base.is_active),
                is_default: Boolean(base.is_default),
            });
        } else {
            setEditBase(null);
            setForm({ name: '', price_delta: '0', is_active: true, is_default: bases.length === 0 });
        }
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setEditBase(null);
        setForm({ name: '', price_delta: '0', is_active: true, is_default: bases.length === 0 });
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!isManager()) return;

        const payload = {
            name: form.name.trim(),
            price_delta: Number(form.price_delta) || 0,
            is_active: form.is_active,
            is_default: form.is_default,
        };

        setSaving(true);
        try {
            if (editBase) {
                await api.put(`/admin/bases/${editBase.id}`, payload, { headers: getAuthHeaders() });
            } else {
                await api.post('/admin/bases', payload, { headers: getAuthHeaders() });
            }
            closeModal();
            fetchBases();
        } catch (error) {
            console.error('Failed to save base', error.response?.data || error.message);
            alert(error.response?.data?.message || 'שגיאה בשמירת הבסיס');
        } finally {
            setSaving(false);
        }
    };

    const toggleActive = async (base) => {
        if (!isManager()) return;
        try {
            await api.put(`/admin/bases/${base.id}`,
                { is_active: !base.is_active },
                { headers: getAuthHeaders() }
            );
            fetchBases();
        } catch (error) {
            console.error('Failed to toggle base', error.response?.data || error.message);
        }
    };

    const markAsDefault = async (base) => {
        if (!isManager() || base.is_default) return;
        try {
            await api.put(`/admin/bases/${base.id}`,
                { is_default: true },
                { headers: getAuthHeaders() }
            );
            fetchBases();
        } catch (error) {
            console.error('Failed to set default base', error.response?.data || error.message);
        }
    };

    if (loading) {
        return (
            <AdminLayout>
                <div className="flex flex-col items-center justify-center h-96">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-brand-primary"></div>
                    <p className="mt-4 text-gray-500 font-black animate-pulse">טוען בסיסים...</p>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="max-w-5xl mx-auto space-y-8 pb-32 animate-in fade-in duration-500">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 px-4">
                    <div className="flex items-center gap-5">
                        <div className="w-20 h-20 bg-amber-50 rounded-[2.5rem] flex items-center justify-center text-amber-600 shadow-sm border border-amber-100/50">
                            <FaBreadSlice size={32} />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black text-gray-900 tracking-tight">בסיסי כריך</h1>
                            <p className="text-gray-500 font-medium mt-1">ניהול בסיסים זמינים, תמחור וברירת מחדל</p>
                        </div>
                    </div>
                    {isManager() && (
                        <button
                            onClick={() => openModal()}
                            className="w-full md:w-auto bg-brand-primary text-white px-10 py-5 rounded-[2rem] font-black hover:bg-brand-dark transition-all flex items-center justify-center gap-3 shadow-xl shadow-brand-primary/20 active:scale-95 group"
                        >
                            <FaPlus className="group-hover:rotate-90 transition-transform" />
                            הוספת בסיס חדש
                        </button>
                    )}
                </div>

                {/* Bases Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 px-4">
                    {bases.length === 0 ? (
                        <div className="bg-white rounded-[4rem] shadow-sm border-2 border-dashed border-gray-100 p-20 text-center flex flex-col items-center col-span-full max-w-lg mx-auto">
                            <div className="w-24 h-24 bg-gray-50 rounded-[2.5rem] flex items-center justify-center text-5xl mb-8 grayscale opacity-50">
                                <FaBreadSlice />
                            </div>
                            <h3 className="text-2xl font-black text-gray-900 mb-2">אין בסיסים מוגדרים</h3>
                            <p className="text-gray-500 font-medium mb-10 text-lg leading-relaxed">הוסף בסיסים (צרפתית, דגנים, ללא גלוטן...) כדי להתחיל לסדר את התפריט</p>
                            {isManager() && (
                                <button
                                    onClick={() => openModal()}
                                    className="bg-brand-primary text-white px-10 py-4 rounded-[1.5rem] font-black hover:bg-brand-dark transition-all flex items-center gap-3 shadow-lg shadow-brand-primary/20"
                                >
                                    <FaPlus /> התחלה עכשיו
                                </button>
                            )}
                        </div>
                    ) : (
                        bases.map((base) => (
                            <div
                                key={base.id}
                                className={`group bg-white rounded-[3rem] shadow-sm border border-gray-100 p-10 flex flex-col gap-8 hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 relative overflow-hidden ${!base.is_active && 'opacity-60 grayscale-[0.5]'}`}
                            >
                                {/* Default Star Overflow */}
                                {base.is_default && (
                                    <div className="absolute top-0 right-0 bg-amber-500 text-white px-6 py-2 rounded-bl-[1.5rem] text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-lg">
                                        <FaStar size={12} className="animate-pulse" /> ברירת מחדל
                                    </div>
                                )}

                                <div className="flex items-center gap-6">
                                    <div className={`w-18 h-18 lg:w-20 lg:h-20 rounded-[2rem] flex items-center justify-center text-3xl shadow-inner transition-transform duration-500 group-hover:scale-110 ${base.is_active ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-400'}`}>
                                        <FaBreadSlice />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-2xl font-black text-gray-900 group-hover:text-brand-primary transition-colors">{base.name}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="px-3 py-1 bg-gray-50 text-gray-400 rounded-lg text-[10px] font-black uppercase tracking-widest border border-gray-100">
                                                בסיס גלובלי
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6 pt-6 border-t border-gray-50">
                                    <div className="flex items-center justify-between px-2">
                                        <span className="text-sm font-black text-gray-400 uppercase tracking-widest">תוספת מחיר</span>
                                        <span className={`text-2xl font-black tracking-tighter ${Number(base.price_delta) > 0 ? 'text-emerald-600' : 'text-gray-900'}`}>
                                            {Number(base.price_delta) === 0 ? 'חינם' : `+ ₪${Number(base.price_delta).toFixed(2)}`}
                                        </span>
                                    </div>

                                    {!base.is_default && isManager() && base.is_active && (
                                        <button
                                            onClick={() => markAsDefault(base)}
                                            className="w-full py-4 px-6 rounded-[1.5rem] border-2 border-dashed border-gray-100 text-gray-400 text-xs font-black uppercase tracking-widest hover:border-amber-400 hover:text-amber-500 transition-all hover:bg-amber-50 flex items-center justify-center gap-2"
                                        >
                                            <FaStar size={12} />
                                            קבע כברירת מחדל
                                        </button>
                                    )}
                                </div>

                                {isManager() && (
                                    <div className="grid grid-cols-2 gap-4 mt-auto pt-4 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                                        <button
                                            onClick={() => openModal(base)}
                                            className="flex items-center justify-center gap-3 py-4 bg-gray-50 text-gray-700 rounded-2xl text-sm font-black hover:bg-gray-200 transition-all active:scale-95 shadow-sm"
                                        >
                                            <FaEdit size={16} /> עריכה
                                        </button>
                                        <button
                                            onClick={() => toggleActive(base)}
                                            className={`flex items-center justify-center gap-3 py-4 rounded-2xl text-sm font-black transition-all active:scale-95 shadow-sm ${base.is_active ? 'bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white'}`}
                                        >
                                            {base.is_active ? <><FaToggleOn size={18} /> השבת</> : <><FaToggleOff size={18} /> הפעל</>}
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* Modern Modal */}
                {modalOpen && (
                    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
                        <div className="bg-white rounded-[3.5rem] shadow-2xl max-w-xl w-full overflow-hidden border border-white/20 animate-in zoom-in-95 duration-300">
                            <div className="px-10 py-8 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between">
                                <div className="flex items-center gap-5">
                                    <div className="p-4 bg-brand-primary/10 rounded-[1.5rem] text-brand-primary shadow-sm">
                                        {editBase ? <FaEdit size={24} /> : <FaPlus size={24} />}
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                                            {editBase ? 'עריכת בסיס' : 'הוספת בסיס חדש'}
                                        </h2>
                                        <p className="text-gray-500 font-medium text-sm">הגדרת שם, מחיר וסטטוס</p>
                                    </div>
                                </div>
                                <button
                                    onClick={closeModal}
                                    className="p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-2xl transition-all"
                                >
                                    <FaTimes size={24} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-10 space-y-8">
                                <div className="space-y-3">
                                    <label className="text-sm font-black text-gray-700 mr-2 uppercase tracking-widest flex items-center gap-2">
                                        <FaInfoCircle className="text-indigo-500" /> שם הבסיס
                                    </label>
                                    <input
                                        type="text"
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        required
                                        className="w-full px-6 py-5 bg-gray-50 border-none rounded-[1.5rem] focus:ring-4 focus:ring-brand-primary/10 text-gray-900 font-black transition-all"
                                        placeholder="למשל: לחם צרפתי, לחם דגנים..."
                                    />
                                </div>

                                <div className="space-y-3">
                                    <label className="text-sm font-black text-gray-700 mr-2 uppercase tracking-widest">תוספת מחיר (₪)</label>
                                    <div className="relative">
                                        <div className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-gray-400">₪</div>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.5"
                                            value={form.price_delta}
                                            onChange={(e) => setForm({ ...form, price_delta: e.target.value })}
                                            className="w-full px-6 py-5 bg-gray-50 border-none rounded-[1.5rem] focus:ring-4 focus:ring-brand-primary/10 text-gray-900 font-black"
                                        />
                                    </div>
                                </div>

                                <div className="bg-gray-50 rounded-[2.5rem] p-8 space-y-6">
                                    <label className="flex items-center gap-4 p-5 bg-white rounded-3xl cursor-pointer hover:bg-gray-50 transition-all border border-transparent hover:border-gray-200 group shadow-sm">
                                        <div className={`w-12 h-7 flex items-center rounded-full p-1 transition-colors ${form.is_default ? 'bg-amber-500' : 'bg-gray-300'}`}>
                                            <div className={`bg-white w-5 h-5 rounded-full shadow-lg transform transition-transform ${form.is_default ? '-translate-x-5' : 'translate-x-0'}`}></div>
                                        </div>
                                        <input
                                            type="checkbox"
                                            className="hidden"
                                            checked={form.is_default}
                                            onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                                        />
                                        <div>
                                            <span className="block text-sm font-black text-gray-700">הגדר כברירת מחדל</span>
                                            <span className="text-[10px] font-medium text-gray-400">הבסיס שייבחר אוטומטית לכל מנה חדשה</span>
                                        </div>
                                    </label>

                                    <label className="flex items-center gap-4 p-5 bg-white rounded-3xl cursor-pointer hover:bg-gray-50 transition-all border border-transparent hover:border-gray-200 group shadow-sm">
                                        <div className={`w-12 h-7 flex items-center rounded-full p-1 transition-colors ${form.is_active ? 'bg-brand-primary' : 'bg-gray-300'}`}>
                                            <div className={`bg-white w-5 h-5 rounded-full shadow-lg transform transition-transform ${form.is_active ? '-translate-x-5' : 'translate-x-0'}`}></div>
                                        </div>
                                        <input
                                            type="checkbox"
                                            className="hidden"
                                            checked={form.is_active}
                                            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                                        />
                                        <div>
                                            <span className="block text-sm font-black text-gray-700">בסיס פעיל למכירה</span>
                                            <span className="text-[10px] font-medium text-gray-400">האם הלקוחות יכולים לראות ולבחור בבסיס זה</span>
                                        </div>
                                    </label>
                                </div>

                                <div className="flex gap-4 pt-4">
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="flex-1 bg-brand-primary text-white py-5 rounded-[1.5rem] font-black text-lg hover:shadow-2xl hover:shadow-brand-primary/20 hover:bg-brand-dark transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
                                    >
                                        <FaSave />
                                        {saving ? 'שומר...' : editBase ? 'עדכון בסיס' : 'הוספת בסיס'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={closeModal}
                                        className="px-10 py-5 bg-gray-100 text-gray-700 rounded-[1.5rem] font-black hover:bg-gray-200 transition-all active:scale-95"
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
