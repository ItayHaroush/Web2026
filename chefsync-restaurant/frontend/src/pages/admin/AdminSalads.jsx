import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import { useAdminAuth } from '../../context/AdminAuthContext';
import api from '../../services/apiClient';
import { 
    FaPlus, 
    FaClock, 
    FaInfoCircle, 
    FaRoute, 
    FaCheckCircle,
    FaSave,
    FaTrash,
    FaEdit,
    FaLayerGroup,
    FaCogs,
    FaTimes,
    FaChevronLeft,
    FaChevronRight,
    FaMagic,
    FaListUl
} from 'react-icons/fa';

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
    const [updatingGroup, setUpdatingGroup] = useState(null);

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
                        min_selections: typeof group.min_selections === 'number' ? String(group.min_selections) : '0',
                        max_selections: group.max_selections === null || group.max_selections === undefined
                            ? ''
                            : String(group.max_selections),
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
        
        setUpdatingGroup(groupId);
        try {
            await api.put(`/admin/addon-groups/${groupId}`,
                {
                    sort_order: Number(edit.sort_order) || 0,
                    is_active: Boolean(edit.is_active),
                    min_selections: Number(edit.min_selections) || 0,
                    max_selections: edit.max_selections === '' ? null : Number(edit.max_selections),
                },
                { headers: getAuthHeaders() }
            );
            fetchSalads();
        } catch (error) {
            console.error('Failed to update group', error.response?.data || error.message);
        } finally {
            setUpdatingGroup(null);
        }
    };

    const deleteSalad = async (id) => {
        if (!confirm('האם אתה בטוח שברצונך למחוק תוספת זו?')) return;
        try {
            await api.delete(`/admin/salads/${id}`, { headers: getAuthHeaders() });
            fetchSalads();
        } catch (error) {
            console.error('Failed to delete salad', error);
        }
    };

    const visibleSalads = selectedGroupId
        ? salads.filter((salad) => String(salad.addon_group_id) === String(selectedGroupId))
        : salads;

    const selectedGroup = useMemo(() => {
        return groups.find(g => String(g.id) === selectedGroupId);
    }, [groups, selectedGroupId]);

    const categoryNameById = useMemo(() => {
        return categories.reduce((acc, category) => {
            acc[category.id] = category.name;
            return acc;
        }, {});
    }, [categories]);

    if (loading) {
        return (
            <AdminLayout>
                <div className="flex flex-col items-center justify-center h-96">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-brand-primary"></div>
                    <p className="mt-4 text-gray-500 font-black animate-pulse text-lg">טוען תוספות וחוקי בחירה...</p>
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
                        <div className="w-24 h-24 bg-emerald-50 rounded-[2.5rem] flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-100/50">
                            <FaListUl size={36} />
                        </div>
                        <div>
                            <h1 className="text-5xl font-black text-gray-900 tracking-tight">ניהול תוספות</h1>
                            <div className="flex items-center gap-4 mt-2">
                                <span className="flex items-center gap-2 px-4 py-1.5 bg-emerald-100/50 text-emerald-700 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-emerald-200/30">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                    {salads.length} פריטים במערכת
                                </span>
                                <span className="text-gray-300">/</span>
                                <p className="text-gray-500 font-bold text-sm">ניהול סלטים, ממרחים וחוקי בחירה ללקוח</p>
                            </div>
                        </div>
                    </div>
                    {isManager() && (
                        <button
                            onClick={() => openModal()}
                            className="w-full md:w-auto bg-brand-primary text-white px-12 py-6 rounded-[2rem] font-black hover:bg-brand-dark transition-all flex items-center justify-center gap-4 shadow-2xl shadow-brand-primary/30 active:scale-95 group hover:-translate-y-1"
                        >
                            <div className="bg-white/20 p-2.5 rounded-xl group-hover:rotate-90 transition-transform">
                                <FaPlus size={16} />
                            </div>
                            <span className="text-lg">הוספת פריט חדש</span>
                        </button>
                    )}
                </div>

                {/* Main Configuration Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 px-4">
                    
                    {/* Sidebar: Group Selector (3 Columns) */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="flex items-center gap-3 px-2">
                            <FaLayerGroup className="text-brand-primary" />
                            <h3 className="text-lg font-black text-gray-900 uppercase tracking-wider">קבוצות תוספות</h3>
                        </div>
                        
                        <div className="flex flex-col gap-3">
                            {groups.map((group) => (
                                <button
                                    key={group.id}
                                    onClick={() => setSelectedGroupId(String(group.id))}
                                    className={`relative flex items-center justify-between p-6 rounded-[2rem] border-2 transition-all duration-300 text-right group ${selectedGroupId === String(group.id) ? 'border-brand-primary bg-brand-primary/[0.04] shadow-xl shadow-brand-primary/5 -translate-x-2' : 'border-gray-50 bg-white hover:border-gray-200 hover:bg-gray-50'}`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black transition-all ${selectedGroupId === String(group.id) ? 'bg-brand-primary text-white shadow-lg' : 'bg-gray-100 text-gray-400'}`}>
                                            {group.sort_order}
                                        </div>
                                        <div>
                                            <span className={`block font-black text-lg transition-colors ${selectedGroupId === String(group.id) ? 'text-brand-primary' : 'text-gray-700'}`}>
                                                {group.name}
                                            </span>
                                            <span className="text-xs font-bold text-gray-400">
                                                {salads.filter(s => String(s.addon_group_id) === String(group.id)).length} פריטים
                                            </span>
                                        </div>
                                    </div>
                                    <div className={`transition-all ${selectedGroupId === String(group.id) ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'}`}>
                                        <FaChevronLeft className="text-brand-primary" />
                                    </div>
                                </button>
                            ))}
                        </div>
                        
                        {/* Group Rules Info */}
                        <div className="bg-amber-50/50 rounded-[2.5rem] p-8 border border-amber-100/50 space-y-4">
                            <div className="flex items-center gap-3 text-amber-700">
                                <FaInfoCircle size={20} />
                                <h4 className="font-black">טיפ למנהלים</h4>
                            </div>
                            <p className="text-sm font-medium text-amber-900/70 leading-relaxed">
                                הגדר פריטים כ"כלולים" במנה ע"י קביעת מחיר 0. פריטים אלו יופיעו כברירת מחדל או בחירה חופשית ללא תשלום.
                            </p>
                        </div>
                    </div>

                    {/* Content Area: Selected Group Settings & Items (8 Columns) */}
                    <div className="lg:col-span-8 space-y-10">
                        {/* Group Settings Card */}
                        {selectedGroup && (
                            <div className="bg-white rounded-[3rem] shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden animate-in slide-in-from-left duration-500">
                                <div className="p-8 border-b border-gray-50 bg-gray-50/30 flex justify-between items-center">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-brand-primary text-white rounded-2xl shadow-lg">
                                            <FaCogs size={20} />
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-black text-gray-900">הגדרות וחוקי קבוצה</h2>
                                            <p className="text-gray-500 font-medium text-xs">שליטה על כמות הבחירות של הלקוח ב{selectedGroup.name}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => updateGroup(selectedGroup.id)}
                                        disabled={updatingGroup === selectedGroup.id}
                                        className="flex items-center gap-3 bg-emerald-500 text-white px-8 py-3.5 rounded-2xl font-black hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
                                    >
                                        {updatingGroup === selectedGroup.id ? (
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        ) : (
                                            <>
                                                <FaSave size={16} />
                                                שמור שינויים
                                            </>
                                        )}
                                    </button>
                                </div>

                                <div className="p-10 grid grid-cols-1 md:grid-cols-3 gap-8">
                                    <div className="space-y-3">
                                        <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mr-2 flex items-center gap-2">
                                            <FaMagic className="text-blue-400" /> מינימום בחירה
                                        </label>
                                        <input
                                            type="number"
                                            value={groupEdits[selectedGroup.id]?.min_selections ?? '0'}
                                            onChange={(e) => setGroupEdits((prev) => ({
                                                ...prev,
                                                [selectedGroup.id]: { ...prev[selectedGroup.id], min_selections: e.target.value },
                                            }))}
                                            className="w-full px-6 py-4 bg-gray-50 border-none rounded-[1.5rem] focus:ring-4 focus:ring-brand-primary/10 text-gray-900 font-extrabold text-center text-xl"
                                        />
                                        <p className="text-[10px] text-gray-400 text-center font-bold">למשל: 1 מחייב בחירה אחת</p>
                                    </div>
                                    
                                    <div className="space-y-3">
                                        <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mr-2 flex items-center gap-2">
                                            <FaMagic className="text-blue-400" /> מקסימום בחירה
                                        </label>
                                        <input
                                            type="number"
                                            value={groupEdits[selectedGroup.id]?.max_selections ?? ''}
                                            onChange={(e) => setGroupEdits((prev) => ({
                                                ...prev,
                                                [selectedGroup.id]: { ...prev[selectedGroup.id], max_selections: e.target.value },
                                            }))}
                                            className="w-full px-6 py-4 bg-gray-50 border-none rounded-[1.5rem] focus:ring-4 focus:ring-brand-primary/10 text-gray-900 font-extrabold text-center text-xl"
                                            placeholder="∞"
                                        />
                                        <p className="text-[10px] text-gray-400 text-center font-bold">ריק = ללא הגבלה</p>
                                    </div>

                                    <div className="space-y-4">
                                        <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mr-2 flex items-center gap-2">
                                            סדר תצוגה בתפריט
                                        </label>
                                        <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-[2rem] border border-gray-100 shadow-inner">
                                            <button 
                                                onClick={() => {
                                                    const current = Number(groupEdits[selectedGroup.id]?.sort_order || 0);
                                                    setGroupEdits(prev => ({ ...prev, [selectedGroup.id]: { ...prev[selectedGroup.id], sort_order: Math.max(0, current - 1) } }));
                                                }}
                                                className="w-14 h-14 bg-white text-gray-900 rounded-[1.5rem] flex items-center justify-center hover:bg-brand-primary hover:text-white transition-all shadow-sm group/btn active:scale-90"
                                            >
                                                <FaChevronRight size={14} className="group-hover/btn:scale-125 transition-transform" />
                                            </button>
                                            
                                            <div className="flex-1 text-center py-2">
                                                <div className="text-[10px] font-black text-brand-primary/50 uppercase tracking-widest mb-0.5">
                                                    {selectedGroup.name}
                                                </div>
                                                <div className="flex items-center justify-center gap-2">
                                                    <span className="text-gray-400 font-bold text-xs italic">מיקום</span>
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        value={groupEdits[selectedGroup.id]?.sort_order ?? '0'}
                                                        readOnly
                                                        className="w-12 bg-transparent border-none text-center font-black text-2xl text-gray-900 focus:ring-0 p-0"
                                                    />
                                                </div>
                                            </div>

                                            <button 
                                                onClick={() => {
                                                    const current = Number(groupEdits[selectedGroup.id]?.sort_order || 0);
                                                    setGroupEdits(prev => ({ ...prev, [selectedGroup.id]: { ...prev[selectedGroup.id], sort_order: current + 1 } }));
                                                }}
                                                className="w-14 h-14 bg-white text-gray-900 rounded-[1.5rem] flex items-center justify-center hover:bg-brand-primary hover:text-white transition-all shadow-sm group/btn active:scale-90"
                                            >
                                                <FaChevronLeft size={14} className="group-hover/btn:scale-125 transition-transform" />
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-gray-400 text-center font-bold">החצים משנים את סדר הופעת הקבוצה ללקוח</p>
                                    </div>
                                </div>
                                
                                <div className="p-8 pt-0 flex justify-center">
                                    <label className="flex items-center gap-4 px-8 py-4 bg-gray-50 rounded-[2rem] cursor-pointer hover:bg-gray-100 transition-all border border-gray-100">
                                        <div className={`w-12 h-7 flex items-center rounded-full p-1 transition-colors ${groupEdits[selectedGroup.id]?.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                                            <div className={`bg-white w-5 h-5 rounded-full shadow transform transition-transform ${groupEdits[selectedGroup.id]?.is_active ? '-translate-x-5' : 'translate-x-0'}`}></div>
                                        </div>
                                        <input
                                            type="checkbox"
                                            className="hidden"
                                            checked={groupEdits[selectedGroup.id]?.is_active ?? true}
                                            onChange={(e) => {
                                                const val = e.target.checked;
                                                setGroupEdits(prev => ({ ...prev, [selectedGroup.id]: { ...prev[selectedGroup.id], is_active: val } }));
                                            }}
                                        />
                                        <span className="text-sm font-black text-gray-700">הצג קבוצה זו ללקוח</span>
                                    </label>
                                </div>
                            </div>
                        )}

                        {/* Items Sub-Grid */}
                        <div className="space-y-6">
                            <div className="flex items-center justify-between px-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-8 bg-brand-primary rounded-full"></div>
                                    <h2 className="text-2xl font-black text-gray-900 italic tracking-tight">
                                        פריטים ב{selectedGroup?.name || '...'}
                                    </h2>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                                {visibleSalads.length === 0 ? (
                                    <div className="col-span-full py-28 text-center bg-white rounded-[4rem] border-2 border-dashed border-gray-100 flex flex-col items-center justify-center animate-pulse">
                                        <div className="w-24 h-24 bg-gray-50 rounded-[3rem] flex items-center justify-center mb-8 text-gray-200">
                                            <FaPlus size={36} />
                                        </div>
                                        <h3 className="text-2xl font-black text-gray-900">הקבוצה כרגע ריקה</h3>
                                        <p className="text-gray-500 mt-2 font-medium">זה הזמן להוסיף את התוספת המנצחת שלך!</p>
                                        <button 
                                            onClick={() => openModal()}
                                            className="mt-8 px-8 py-3 bg-brand-primary text-white rounded-2xl font-black hover:bg-brand-dark transition-all shadow-lg shadow-brand-primary/20"
                                        >
                                            הוספה מהירה
                                        </button>
                                    </div>
                                ) : (
                                    visibleSalads.map((salad) => (
                                        <div 
                                            key={salad.id} 
                                            className={`group bg-white rounded-[3rem] shadow-sm border border-gray-100 p-8 flex flex-col gap-8 hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 relative overflow-hidden ${!salad.is_active && 'opacity-60 grayscale-[0.6]'}`}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-2xl shadow-inner transition-all group-hover:scale-110 group-hover:rotate-6 ${salad.is_active ? 'bg-brand-primary/10 text-brand-primary' : 'bg-gray-100 text-gray-400'}`}>
                                                    <FaPlus className="bg-white/50 p-1.5 rounded-lg" size={24} />
                                                </div>
                                                <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${salad.is_active ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                                                    {salad.is_active ? '● פעיל' : '○ כבוי'}
                                                </div>
                                            </div>

                                            <div>
                                                <h3 className="text-2xl font-black text-gray-900 group-hover:text-brand-primary transition-colors leading-tight mb-3 tracking-tight">{salad.name}</h3>
                                                <div className="flex flex-wrap gap-2">
                                                    {Array.isArray(salad.category_ids) && salad.category_ids.length > 0 ? (
                                                        salad.category_ids.slice(0, 3).map((id) => (
                                                            <span key={id} className="px-3 py-1 rounded-xl bg-gray-50 text-gray-400 text-[9px] font-black border border-gray-100/50 uppercase tracking-tighter">
                                                                {categoryNameById[id] || `#${id}`}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="flex items-center gap-1.5 text-[10px] text-brand-primary/60 font-black bg-brand-primary/5 px-2.5 py-1 rounded-lg">
                                                            <FaRoute size={10} /> מופיע בכל התפריט
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="pt-6 border-t border-gray-50/50 flex flex-col gap-2">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-black text-gray-400 uppercase tracking-widest mr-1">עלות בחירה</span>
                                                    <span className={`text-2xl font-black ${Number(salad.price_delta) > 0 ? 'text-brand-primary' : 'text-emerald-500'}`}>
                                                        {Number(salad.price_delta || 0) === 0 ? 'חינם' : `₪${Number(salad.price_delta).toFixed(1)}`}
                                                    </span>
                                                </div>
                                            </div>

                                            {isManager() && (
                                                <div className="grid grid-cols-2 gap-3 mt-2 transform translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                                                    <button
                                                        onClick={() => openModal(salad)}
                                                        className="flex items-center justify-center gap-2 py-4 bg-gray-900 text-white rounded-[1.5rem] text-xs font-black hover:bg-black transition-all active:scale-95 shadow-lg shadow-gray-200"
                                                    >
                                                        <FaEdit size={14} />
                                                        עריכה
                                                    </button>
                                                    <button
                                                        onClick={() => deleteSalad(salad.id)}
                                                        className="flex items-center justify-center gap-2 py-4 bg-rose-50 text-rose-600 rounded-[1.5rem] text-xs font-black hover:bg-rose-600 hover:text-white transition-all active:scale-95 border border-rose-100"
                                                    >
                                                        <FaTrash size={14} />
                                                        מחיקה
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Premium Modal Design */}
                {modalOpen && (
                    <div className="fixed inset-0 bg-gray-900/70 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-500">
                        <div className="bg-white rounded-[4rem] shadow-2xl max-w-2xl w-full overflow-hidden border border-white/20 animate-in zoom-in-95 duration-400 overflow-y-auto max-h-[92vh] custom-scrollbar">
                            <div className="px-12 py-10 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-xl z-20">
                                <div className="flex items-center gap-6">
                                    <div className="p-4 bg-brand-primary text-white rounded-[2rem] shadow-xl shadow-brand-primary/20">
                                        <FaPlus size={24} />
                                    </div>
                                    <div>
                                        <h2 className="text-3xl font-black text-gray-900 tracking-tight">
                                            {editSalad ? 'עריכת פריט' : 'הוספת תוספת'}
                                        </h2>
                                        <p className="text-gray-500 font-bold text-sm mt-0.5 whitespace-nowrap">ניהול קטלוג התוספות והסלטים שלך</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={closeModal} 
                                    className="p-4 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-[1.5rem] transition-all"
                                >
                                    <FaTimes size={24} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-12 space-y-12 pb-20">
                                <div className="space-y-10">
                                    {/* Primary Info */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                        <div className="space-y-4">
                                            <label className="text-xs font-black text-gray-500 mr-2 uppercase tracking-[0.2em] flex items-center gap-2">
                                                <FaLayerGroup className="text-brand-primary" /> קבוצת השתייכות
                                            </label>
                                            <select
                                                value={form.group_id}
                                                onChange={(e) => setForm({ ...form, group_id: e.target.value })}
                                                className="w-full px-8 py-5 bg-gray-50 border-none rounded-[1.5rem] focus:ring-4 focus:ring-brand-primary/10 text-gray-900 font-black appearance-none transition-all cursor-pointer text-lg"
                                            >
                                                {groups.map((group) => (
                                                    <option key={group.id} value={group.id}>{group.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="space-y-4">
                                            <label className="text-xs font-black text-gray-500 mr-2 uppercase tracking-[0.2em]">שם התוספת / סלט</label>
                                            <input
                                                type="text"
                                                value={form.name}
                                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                                required
                                                className="w-full px-8 py-5 bg-gray-50 border-none rounded-[1.5rem] focus:ring-4 focus:ring-brand-primary/10 text-gray-900 font-black transition-all text-lg"
                                                placeholder="למשל: חומוס בייתי"
                                            />
                                        </div>
                                    </div>

                                    {/* Price and Visibility */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                        <div className="space-y-4">
                                            <label className="text-xs font-black text-gray-500 mr-2 uppercase tracking-[0.2em]">מחיר תוספת (₪)</label>
                                            <div className="relative">
                                                <div className="absolute left-8 top-1/2 -translate-y-1/2 font-black text-gray-300 text-2xl">₪</div>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.5"
                                                    value={form.price_delta}
                                                    onChange={(e) => setForm({ ...form, price_delta: e.target.value })}
                                                    className="w-full pl-16 pr-8 py-5 bg-gray-50 border-none rounded-[1.5rem] focus:ring-4 focus:ring-brand-primary/10 text-gray-900 font-black text-xl"
                                                />
                                            </div>
                                            <p className="text-[10px] text-gray-400 mr-2 font-bold italic">הזן '0' אם הבחירה כלולה במחיר המנה</p>
                                        </div>

                                        <div className="space-y-4">
                                            <label className="text-xs font-black text-gray-500 mr-2 uppercase tracking-[0.2em]">סטטוס תצוגה</label>
                                            <label className="flex items-center gap-5 p-5 bg-emerald-50 rounded-[1.5rem] cursor-pointer hover:bg-emerald-100 transition-all border border-emerald-100 group h-full max-h-[68px]">
                                                <div className={`w-12 h-7 flex items-center rounded-full p-1 transition-colors ${form.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                                                    <div className={`bg-white w-5 h-5 rounded-full shadow transform transition-transform ${form.is_active ? '-translate-x-5' : 'translate-x-0'}`}></div>
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    className="hidden"
                                                    checked={form.is_active}
                                                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                                                />
                                                <span className="text-sm font-black text-emerald-900">זמין לבחירה</span>
                                            </label>
                                        </div>
                                    </div>

                                    {/* Category Mapping */}
                                    <div className="space-y-6">
                                        <div className="flex justify-between items-end mr-2">
                                            <label className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                                <FaMagic className="text-brand-primary" /> מופיע בקטגוריות:
                                            </label>
                                            <span className="text-[10px] text-brand-primary font-black bg-brand-primary/5 px-3 py-1 rounded-full border border-brand-primary/10">
                                                {form.category_ids.length === 0 ? 'מופיע בכל המנות' : `נבחר: ${form.category_ids.length}`}
                                            </span>
                                        </div>
                                        <div className="bg-gray-50/50 rounded-[3rem] p-8 max-h-72 overflow-y-auto grid grid-cols-2 sm:grid-cols-4 gap-4 custom-scrollbar border border-gray-100">
                                            {categories.map((cat) => (
                                                <label 
                                                    key={cat.id} 
                                                    className={`flex flex-col items-center justify-center p-5 rounded-[2rem] cursor-pointer border-2 transition-all gap-2 relative group-active:scale-95 ${form.category_ids.includes(String(cat.id)) ? 'border-brand-primary bg-brand-primary/5 text-brand-primary shadow-lg shadow-brand-primary/5' : 'border-white bg-white hover:border-gray-200 text-gray-400'}`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        className="hidden"
                                                        checked={form.category_ids.includes(String(cat.id))}
                                                        onChange={(e) => {
                                                            const next = e.target.checked
                                                                ? [...form.category_ids, String(cat.id)]
                                                                : form.category_ids.filter((id) => id !== String(cat.id));
                                                            setForm({ ...form, category_ids: next });
                                                        }}
                                                    />
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${form.category_ids.includes(String(cat.id)) ? 'bg-brand-primary text-white scale-110' : 'bg-gray-100'}`}>
                                                        {form.category_ids.includes(String(cat.id)) ? <FaCheckCircle size={14} /> : <span className="text-lg opacity-50">{cat.icon || '📂'}</span>}
                                                    </div>
                                                    <span className="text-[11px] font-black text-center leading-tight tracking-tight">{cat.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-6 pt-10 sticky bottom-0 bg-white/80 backdrop-blur-md z-10">
                                    <button 
                                        type="submit" 
                                        disabled={saving}
                                        className="flex-[2] bg-gray-900 text-white py-6 rounded-[2rem] font-black text-xl hover:shadow-2xl hover:shadow-gray-200 hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-4 disabled:opacity-50"
                                    >
                                        {saving ? (
                                            <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        ) : (
                                            <>
                                                <FaSave />
                                                שמור תוספת
                                            </>
                                        )}
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={closeModal} 
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
