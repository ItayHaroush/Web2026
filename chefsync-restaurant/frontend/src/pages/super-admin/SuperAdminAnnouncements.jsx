import { useState, useEffect, useCallback } from 'react';
import SuperAdminLayout from '../../layouts/SuperAdminLayout';
import announcementService from '../../services/announcementService';
import { FaBullhorn, FaPlus, FaEdit, FaTrash, FaToggleOn, FaToggleOff, FaTimes, FaImage } from 'react-icons/fa';

const POSITION_LABELS = {
    top_banner: 'באנר עליון',
    popup: 'פופאפ בכניסה',
    hero_overlay: 'הירו — שכבה עליונה',
};

const EMPTY_FORM = {
    title: '',
    body: '',
    image: null,
    link_url: '',
    start_at: '',
    end_at: '',
    is_active: true,
    position: 'top_banner',
    priority: 0,
};

export default function SuperAdminAnnouncements() {
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [imagePreview, setImagePreview] = useState(null);
    const [saving, setSaving] = useState(false);

    const fetchAnnouncements = useCallback(async () => {
        setLoading(true);
        try {
            const res = await announcementService.getAnnouncements();
            setAnnouncements(res.data?.data || res.data || []);
        } catch (e) {
            console.error('שגיאה בטעינת הודעות:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchAnnouncements(); }, [fetchAnnouncements]);

    const openCreate = () => {
        setEditing(null);
        setForm(EMPTY_FORM);
        setImagePreview(null);
        setShowModal(true);
    };

    const openEdit = (a) => {
        setEditing(a);
        setForm({
            title: a.title,
            body: a.body || '',
            image: null,
            link_url: a.link_url || '',
            start_at: a.start_at?.slice(0, 16) || '',
            end_at: a.end_at?.slice(0, 16) || '',
            is_active: a.is_active,
            position: a.position,
            priority: a.priority || 0,
        });
        setImagePreview(a.image_url || null);
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (editing) {
                await announcementService.updateAnnouncement(editing.id, form);
            } else {
                await announcementService.createAnnouncement(form);
            }
            setShowModal(false);
            fetchAnnouncements();
        } catch (err) {
            console.error('שגיאה בשמירה:', err);
            alert(err.response?.data?.message || 'שגיאה בשמירה');
        } finally {
            setSaving(false);
        }
    };

    const handleToggle = async (id) => {
        try {
            await announcementService.toggleAnnouncement(id);
            fetchAnnouncements();
        } catch (e) {
            console.error(e);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('למחוק הודעה זו?')) return;
        try {
            await announcementService.deleteAnnouncement(id);
            fetchAnnouncements();
        } catch (e) {
            console.error(e);
        }
    };

    const handleImageChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            setForm(p => ({ ...p, image: file }));
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const isActiveNow = (a) => {
        const now = new Date();
        return a.is_active && new Date(a.start_at) <= now && new Date(a.end_at) >= now;
    };

    return (
        <SuperAdminLayout>
            <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-4">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                            <div className="p-2 bg-amber-100 rounded-lg">
                                <FaBullhorn className="text-amber-600" size={20} />
                            </div>
                            הודעות כלליות
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">באנרים והודעות שמוצגים לכל הלקוחות באתר</p>
                    </div>
                    <button
                        onClick={openCreate}
                        className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-xl font-bold hover:bg-brand-dark transition-colors"
                    >
                        <FaPlus size={14} />
                        הודעה חדשה
                    </button>
                </div>

                {loading ? (
                    <div className="text-center py-12 text-gray-400">טוען...</div>
                ) : announcements.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                        <FaBullhorn size={48} className="mx-auto mb-4 opacity-30" />
                        <p>אין הודעות כלליות</p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {announcements.map((a) => (
                            <div
                                key={a.id}
                                className={`bg-white rounded-2xl border p-4 flex items-center gap-4 transition-all ${isActiveNow(a) ? 'border-green-300 shadow-sm' : 'border-gray-200'
                                    }`}
                            >
                                {a.image_url && (
                                    <img
                                        src={a.image_url}
                                        alt=""
                                        className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
                                    />
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-bold text-gray-900 truncate">{a.title}</h3>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isActiveNow(a) ? 'bg-green-100 text-green-700' : a.is_active ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'
                                            }`}>
                                            {isActiveNow(a) ? 'פעיל עכשיו' : a.is_active ? 'ממתין' : 'כבוי'}
                                        </span>
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-bold">
                                            {POSITION_LABELS[a.position]}
                                        </span>
                                    </div>
                                    {a.body && <p className="text-xs text-gray-500 truncate">{a.body}</p>}
                                    <p className="text-[10px] text-gray-400 mt-1">
                                        {new Date(a.start_at).toLocaleDateString('he-IL')} — {new Date(a.end_at).toLocaleDateString('he-IL')}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <button onClick={() => handleToggle(a.id)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title={a.is_active ? 'כיבוי' : 'הפעלה'}>
                                        {a.is_active ? <FaToggleOn size={20} className="text-green-500" /> : <FaToggleOff size={20} className="text-gray-400" />}
                                    </button>
                                    <button onClick={() => openEdit(a)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="עריכה">
                                        <FaEdit size={14} className="text-gray-500" />
                                    </button>
                                    <button onClick={() => handleDelete(a.id)} className="p-2 hover:bg-red-50 rounded-lg transition-colors" title="מחיקה">
                                        <FaTrash size={14} className="text-red-400" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* מודל יצירה/עריכה */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
                    <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 border-b">
                            <h2 className="font-black text-lg">{editing ? 'עריכת הודעה' : 'הודעה חדשה'}</h2>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><FaTimes /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">כותרת *</label>
                                <input
                                    type="text"
                                    value={form.title}
                                    onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                                    required
                                    maxLength={150}
                                    className="w-full border rounded-xl px-3 py-2 text-sm"
                                    placeholder="חג פסח כשר ושמח!"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">תוכן (אופציונלי)</label>
                                <textarea
                                    value={form.body}
                                    onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
                                    maxLength={1000}
                                    rows={3}
                                    className="w-full border rounded-xl px-3 py-2 text-sm"
                                    placeholder="תוכן ההודעה..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">תמונה</label>
                                <div className="flex items-center gap-3">
                                    {imagePreview && (
                                        <img src={imagePreview} alt="" className="w-20 h-20 rounded-xl object-cover" />
                                    )}
                                    <label className="flex items-center gap-2 px-3 py-2 border rounded-xl cursor-pointer hover:bg-gray-50 text-sm">
                                        <FaImage className="text-gray-400" />
                                        {imagePreview ? 'החלפת תמונה' : 'העלאת תמונה'}
                                        <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                                    </label>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">קישור (אופציונלי)</label>
                                <input
                                    type="url"
                                    value={form.link_url}
                                    onChange={e => setForm(p => ({ ...p, link_url: e.target.value }))}
                                    className="w-full border rounded-xl px-3 py-2 text-sm"
                                    placeholder="https://..."
                                    dir="ltr"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">מתאריך *</label>
                                    <input
                                        type="datetime-local"
                                        value={form.start_at}
                                        onChange={e => setForm(p => ({ ...p, start_at: e.target.value }))}
                                        required
                                        className="w-full border rounded-xl px-3 py-2 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">עד תאריך *</label>
                                    <input
                                        type="datetime-local"
                                        value={form.end_at}
                                        onChange={e => setForm(p => ({ ...p, end_at: e.target.value }))}
                                        required
                                        className="w-full border rounded-xl px-3 py-2 text-sm"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">מיקום</label>
                                    <select
                                        value={form.position}
                                        onChange={e => setForm(p => ({ ...p, position: e.target.value }))}
                                        className="w-full border rounded-xl px-3 py-2 text-sm"
                                    >
                                        <option value="top_banner">באנר עליון</option>
                                        <option value="popup">פופאפ בכניסה</option>
                                        <option value="hero_overlay">הירו — שכבה</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">עדיפות</label>
                                    <input
                                        type="number"
                                        value={form.priority}
                                        onChange={e => setForm(p => ({ ...p, priority: parseInt(e.target.value) || 0 }))}
                                        min={0}
                                        max={100}
                                        className="w-full border rounded-xl px-3 py-2 text-sm"
                                    />
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="is_active"
                                    checked={form.is_active}
                                    onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
                                    className="rounded"
                                />
                                <label htmlFor="is_active" className="text-sm font-bold text-gray-700">פעיל</label>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 bg-brand-primary text-white rounded-xl py-2.5 font-bold hover:bg-brand-dark transition-colors disabled:opacity-50"
                                >
                                    {saving ? 'שומר...' : editing ? 'עדכון' : 'יצירה'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2.5 border rounded-xl font-bold text-gray-600 hover:bg-gray-50"
                                >
                                    ביטול
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </SuperAdminLayout>
    );
}
