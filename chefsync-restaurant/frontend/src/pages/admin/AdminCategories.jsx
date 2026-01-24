import { useState, useEffect } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import AdminLayout from '../../layouts/AdminLayout';
import api from '../../services/apiClient';
import { 
    FaChevronDown, 
    FaChevronUp, 
    FaSmile, 
    FaSearch, 
    FaTags, 
    FaPlus, 
    FaEdit, 
    FaTrash, 
    FaFolderOpen,
    FaInfoCircle,
    FaRegEdit,
    FaTimes,
    FaLayerGroup,
    FaCheckCircle
} from 'react-icons/fa';

const COMMON_EMOJIS = ['🍕', '🍔', '🍟', '🌭', '🥪', '🌮', '🌯', '🥗', '🍝', '🍜', '🍱', '🍣', '🥩', '🍗', '🍖', '🐟', '🍷', '🍺', '🥤', '☕', '🍰', '🍦', '🍧', '🍩', '🥦', '🍇', '🍉', '🥐', '🍳', '🧀'];
const EXTENDED_EMOJIS = [
    // פירות וירקות
    '🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠',
    // מאפים ומתוקים
    '🥐', '🥯', '🍞', '🥖', '🥨', '🥞', '🧇', '🧀', '🍖', '🍗', '🥩', '🥓', '🍔', '🍟', '🍕', '🌭', '🥪', '🌮', '🌯', '🫔', '🥙', '🧆', '🥚', '🍳', '🥘', '🍲', '🫕', '🥣', '🥗', '🍿', '🧈', '🧂', '🥫',
    // ארוחות
    '🍱', '🍘', '🍙', '🍚', '🍛', '🍜', '🍝', '🍠', '🍢', '🍣', '🍤', '🍥', '🥮', '🍡', '🥟', '🥠', '🥡', '🦀', '🦞', '🦐', '🦑', '🦪',
    // קינוחים
    '🍦', '🍧', '🍨', '🍩', '🍪', '🎂', '🍰', '🧁', '🥧', '🍫', '🍬', '🍭', '🍮', '🍯', '🍼', '🥛', '☕', '🫖', '🍵', '🍶', '🍾', '🍷', '🍸', '🍹', '🍺', '🍻', '🥂', '🥃', '🥤', '🧋', '🧃', '🧉', '🧊',
    // אחר
    '🥢', '🍽️', '🍴', '🥄'
];

export default function AdminCategories() {
    const { getAuthHeaders, isManager } = useAdminAuth();
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editCategory, setEditCategory] = useState(null);
    const [form, setForm] = useState({ name: '', description: '', icon: '📂', dish_type: 'both' });
    const [showIconPicker, setShowIconPicker] = useState(false);
    const [showAllIcons, setShowAllIcons] = useState(false);

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
        setForm({ name: '', description: '', icon: '📂', dish_type: 'both' });
        setShowIconPicker(false);
        setShowAllIcons(false);
        setShowModal(true);
    };

    const openEdit = (cat) => {
        setEditCategory(cat);
        setForm({
            name: cat.name,
            description: cat.description || '',
            icon: cat.icon || '📂',
            dish_type: cat.dish_type || 'both',
        });
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditCategory(null);
    };

    if (loading) {
        return (
            <AdminLayout>
                <div className="flex flex-col items-center justify-center h-96">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-brand-primary"></div>
                    <p className="mt-4 text-gray-500 font-black animate-pulse">טוען קטגוריות...</p>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="max-w-6xl mx-auto space-y-12 pb-32 animate-in fade-in duration-500">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 px-4">
                    <div className="flex items-center gap-6">
                        <div className="w-20 h-20 bg-emerald-50 rounded-[2.5rem] flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-100/50">
                            <FaTags size={32} />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black text-gray-900 tracking-tight">קטגוריות</h1>
                            <p className="text-gray-500 font-medium mt-1">
                                {categories.length} קטגוריות זמינות בתפריט המסעדה
                            </p>
                        </div>
                    </div>
                    {isManager() && (
                        <button
                            onClick={openNew}
                            className="w-full md:w-auto bg-brand-primary text-white px-10 py-5 rounded-[2rem] font-black hover:bg-brand-dark transition-all flex items-center justify-center gap-3 shadow-xl shadow-brand-primary/20 active:scale-95 group"
                        >
                            <FaPlus className="group-hover:rotate-90 transition-transform" />
                            הוספת קטגוריה
                        </button>
                    )}
                </div>

                {/* Categories Grid */}
                {categories.length === 0 ? (
                    <div className="bg-white rounded-[4rem] shadow-sm border-2 border-dashed border-gray-100 p-24 text-center flex flex-col items-center col-span-full max-w-xl mx-auto">
                        <div className="w-28 h-28 bg-gray-50 rounded-[3rem] flex items-center justify-center text-6xl mb-8 grayscale opacity-50">
                            <FaFolderOpen />
                        </div>
                        <h3 className="text-3xl font-black text-gray-900 mb-2">אין קטגוריות עדיין</h3>
                        <p className="text-gray-500 font-medium mb-12 text-lg leading-relaxed">הוסף את הקטגוריה הראשונה כדי להתחיל לסדר את התפריט שלך בצורה חכמה</p>
                        {isManager() && (
                            <button
                                onClick={openNew}
                                className="bg-brand-primary text-white px-12 py-5 rounded-[2rem] font-black hover:bg-brand-dark transition-all flex items-center gap-4 shadow-lg shadow-brand-primary/20"
                            >
                                <FaPlus /> הוספה עכשיו
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 px-4">
                        {categories.map((cat) => (
                            <div 
                                key={cat.id} 
                                className="group bg-white rounded-[3rem] shadow-sm border border-gray-100 p-10 flex flex-col gap-8 hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 relative overflow-hidden"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-6">
                                        <div className="w-20 h-20 bg-gray-50 rounded-[2rem] flex items-center justify-center text-4xl shadow-inner group-hover:scale-110 transition-transform duration-500">
                                            {cat.icon || '📁'}
                                        </div>
                                        <div>
                                            <h3 className="font-black text-gray-900 text-2xl leading-tight group-hover:text-brand-primary transition-colors">{cat.name}</h3>
                                            <div className="flex items-center gap-3 mt-2">
                                                <span className={`px-3 py-1 bg-gray-100 text-gray-500 rounded-lg text-[10px] font-black uppercase tracking-widest border border-gray-100`}>
                                                    {cat.dish_type === 'plate' ? '🥗 צלחת' : cat.dish_type === 'sandwich' ? '🌯 כריך' : '🥗🌯 הכל'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {cat.description && (
                                    <p className="text-gray-500 font-medium line-clamp-2 leading-relaxed text-sm">
                                        {cat.description}
                                    </p>
                                )}

                                <div className="mt-auto pt-8 border-t border-gray-50 flex items-center justify-between">
                                    <div className="flex items-center gap-3 text-gray-400">
                                        <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center">
                                            <FaLayerGroup size={12} className="text-gray-400" />
                                        </div>
                                        <span className="text-sm font-black tracking-tight">{cat.items_count || 0} פריטים</span>
                                    </div>

                                    {isManager() && (
                                        <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0 duration-300">
                                            <button
                                                onClick={() => openEdit(cat)}
                                                className="p-4 bg-blue-50 text-blue-600 rounded-2xl hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                                title="עריכה"
                                            >
                                                <FaEdit size={18} />
                                            </button>
                                            <button
                                                onClick={() => deleteCategory(cat.id)}
                                                className="p-4 bg-rose-50 text-rose-600 rounded-2xl hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                                                title="מחיקה"
                                            >
                                                <FaTrash size={18} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Modern Premium Modal */}
                {showModal && (
                    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
                        <div className="bg-white rounded-[3.5rem] shadow-2xl max-w-2xl w-full overflow-hidden border border-white/20 animate-in zoom-in-95 duration-300">
                            <div className="px-10 py-8 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between">
                                <div className="flex items-center gap-5">
                                    <div className="p-4 bg-brand-primary/10 rounded-[1.5rem] text-brand-primary shadow-sm">
                                        {editCategory ? <FaRegEdit size={24} /> : <FaPlus size={24} />}
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                                            {editCategory ? 'עריכת קטגוריה' : 'קטגוריה חדשה'}
                                        </h2>
                                        <p className="text-gray-500 font-medium text-sm mt-0.5">ניהול קבוצת פריטים בתפריט</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={closeModal} 
                                    className="p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-2xl transition-all"
                                >
                                    <FaTimes size={24} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-10 space-y-10 max-h-[75vh] overflow-y-auto custom-scrollbar">
                                <div className="grid grid-cols-1 gap-10">
                                    <div className="space-y-4">
                                        <label className="text-sm font-black text-gray-700 mr-2 uppercase tracking-widest flex items-center gap-2">
                                            <FaInfoCircle className="text-brand-primary" /> שם הקטגוריה
                                        </label>
                                        <input
                                            type="text"
                                            value={form.name}
                                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                                            required
                                            className="w-full px-8 py-5 bg-gray-50 border-none rounded-[1.5rem] focus:ring-4 focus:ring-brand-primary/10 text-gray-900 font-black transition-all text-lg"
                                            placeholder="למשל: המיוחדים שלנו, קינוחים..."
                                        />
                                    </div>

                                    <div className="space-y-4">
                                        <label className="text-sm font-black text-gray-700 mr-2 uppercase tracking-widest">
                                            תיאור קצר
                                        </label>
                                        <textarea
                                            value={form.description}
                                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                                            rows={2}
                                            className="w-full px-8 py-5 bg-gray-50 border-none rounded-[1.5rem] focus:ring-4 focus:ring-brand-primary/10 text-gray-900 font-bold transition-all resize-none leading-relaxed"
                                            placeholder="תיאור קצר שיעזור ללקוחות לבחור..."
                                        />
                                    </div>

                                    <div className="space-y-4">
                                        <label className="text-sm font-black text-gray-700 mr-2 uppercase tracking-widest flex items-center gap-2">
                                            <FaSmile className="text-amber-500" /> אייקון מייצג
                                        </label>
                                        <div className="space-y-6">
                                            <div className="flex gap-6">
                                                <div className="w-24 h-24 bg-gray-50 rounded-[2rem] flex items-center justify-center text-5xl shadow-inner border border-gray-100 shrink-0">
                                                    {form.icon}
                                                </div>
                                                <div className="flex-1 flex flex-col justify-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowIconPicker(!showIconPicker)}
                                                        className={`w-full py-5 rounded-[1.5rem] border-2 transition-all font-black flex items-center justify-center gap-3 text-lg ${
                                                            showIconPicker 
                                                                ? 'bg-brand-primary text-white border-brand-primary shadow-xl shadow-brand-primary/20' 
                                                                : 'bg-white text-gray-700 border-gray-100 hover:border-brand-primary/30 hover:bg-gray-50'
                                                        }`}
                                                    >
                                                        {showIconPicker ? <FaChevronUp /> : <FaSmile />}
                                                        {showIconPicker ? 'סגור בוחר אייקונים' : 'בחר אייקון מהרשימה'}
                                                    </button>
                                                </div>
                                            </div>

                                            {showIconPicker && (
                                                <div className="bg-gray-50 p-8 rounded-[3rem] border border-gray-100 animate-in slide-in-from-top-4 duration-500 overflow-hidden shadow-inner">
                                                    <div className="flex justify-between items-center mb-8">
                                                        <span className="text-xs font-black text-gray-400 uppercase tracking-widest bg-white px-4 py-2 rounded-full shadow-sm">מאוגר אייקונים</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowAllIcons(!showAllIcons)}
                                                            className="text-xs font-black text-brand-primary hover:text-brand-dark px-6 py-2 bg-brand-primary/10 rounded-xl transition-all active:scale-95"
                                                        >
                                                            {showAllIcons ? 'חזרה לפופולריים' : 'הצג את כל ה-Emoji'}
                                                        </button>
                                                    </div>

                                                    <div className="max-h-72 overflow-y-auto pr-2 custom-scrollbar">
                                                        <div className="grid grid-cols-6 sm:grid-cols-8 gap-4">
                                                            {(showAllIcons ? EXTENDED_EMOJIS : COMMON_EMOJIS).map((emoji, index) => (
                                                                <button
                                                                    key={`${emoji}-${index}`}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setForm({ ...form, icon: emoji });
                                                                        setShowIconPicker(false);
                                                                    }}
                                                                    className={`h-14 w-14 flex items-center justify-center text-3xl rounded-2xl transition-all ${
                                                                        form.icon === emoji
                                                                            ? 'bg-brand-primary text-white shadow-xl shadow-brand-primary/30 transform scale-110 rotate-3 z-10'
                                                                            : 'bg-white hover:bg-brand-primary/5 border border-white hover:border-brand-primary/20 shadow-sm'
                                                                    }`}
                                                                >
                                                                    {emoji}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <label className="text-sm font-black text-gray-700 mr-2 uppercase tracking-widest">
                                            סוג הגשה מועדף
                                        </label>
                                        <div className="grid grid-cols-3 gap-5">
                                            {[
                                                { id: 'both', label: 'גם וגם', icon: '🥗🌯', desc: 'כל סוגי המנות' },
                                                { id: 'plate', label: 'צלחת', icon: '🥗', desc: 'סלטים ומנות חמות' },
                                                { id: 'sandwich', label: 'כריך', icon: '🌯', desc: 'בתוך לחם' }
                                            ].map((type) => (
                                                <button
                                                    key={type.id}
                                                    type="button"
                                                    onClick={() => setForm({ ...form, dish_type: type.id })}
                                                    className={`group flex flex-col items-center justify-center gap-3 p-6 rounded-[2rem] border-2 transition-all duration-300 relative ${
                                                        form.dish_type === type.id
                                                            ? 'bg-brand-primary/5 border-brand-primary text-brand-primary shadow-lg shadow-brand-primary/5'
                                                            : 'bg-gray-50 border-transparent text-gray-400 hover:bg-gray-100'
                                                    }`}
                                                >
                                                    <span className={`text-4xl transition-transform duration-500 ${form.dish_type === type.id ? 'scale-110' : 'group-hover:scale-110'}`}>{type.icon}</span>
                                                    <div className="text-center">
                                                        <span className={`block font-black text-sm ${form.dish_type === type.id ? 'text-brand-primary' : 'text-gray-700'}`}>{type.label}</span>
                                                        <span className="text-[10px] opacity-60 font-medium">{type.desc}</span>
                                                    </div>
                                                    {form.dish_type === type.id && (
                                                        <div className="absolute -top-2 -right-2 bg-brand-primary text-white w-6 h-6 rounded-full flex items-center justify-center shadow-lg animate-in zoom-in">
                                                            <FaCheckCircle size={12} />
                                                        </div>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-6 pt-10">
                                    <button 
                                        type="submit" 
                                        className="flex-1 bg-brand-primary text-white py-6 rounded-[2rem] font-black text-xl hover:bg-brand-dark transition-all shadow-xl shadow-brand-primary/20 active:scale-95 flex items-center justify-center gap-4"
                                    >
                                        <FaCheckCircle size={22} />
                                        {editCategory ? 'עדכן קטגוריה' : 'צור קטגוריה'}
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={closeModal} 
                                        className="px-12 py-6 bg-gray-100 text-gray-700 rounded-[2rem] font-black hover:bg-gray-200 transition-all active:scale-95"
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
