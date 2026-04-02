import { useState, useEffect, useCallback } from 'react';
import SuperAdminLayout from '../../layouts/SuperAdminLayout';
import holidayService from '../../services/holidayService';
import { FaCalendarAlt, FaPlus, FaEdit, FaTrash, FaTimes, FaEye, FaCheck, FaQuestion, FaDatabase, FaBell } from 'react-icons/fa';

const TYPE_LABELS = {
    full_closure: 'סגירה מלאה',
    half_day: 'חצי יום',
    eve: 'ערב חג',
    info_only: 'מידע בלבד',
};

const TYPE_COLORS = {
    full_closure: 'bg-red-100 text-red-700',
    half_day: 'bg-orange-100 text-orange-700',
    eve: 'bg-yellow-100 text-yellow-700',
    info_only: 'bg-blue-100 text-blue-700',
};

const EMPTY_FORM = {
    name: '',
    hebrew_date_info: '',
    start_date: '',
    end_date: '',
    year: new Date().getFullYear(),
    type: 'full_closure',
    description: '',
};

export default function SuperAdminHolidays() {
    const [holidays, setHolidays] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [responseView, setResponseView] = useState(null);
    const [responseData, setResponseData] = useState(null);
    const [responseLoading, setResponseLoading] = useState(false);
    const [seeding, setSeeding] = useState(false);
    const [notifying, setNotifying] = useState(null);
    const [showSeedModal, setShowSeedModal] = useState(false);
    const [availableHolidays, setAvailableHolidays] = useState([]);
    const [selectedSeedIndices, setSelectedSeedIndices] = useState(new Set());
    const [loadingAvailable, setLoadingAvailable] = useState(false);

    const fetchHolidays = useCallback(async () => {
        setLoading(true);
        try {
            const res = await holidayService.getHolidays(selectedYear);
            setHolidays(res.data || []);
        } catch (e) {
            console.error('שגיאה בטעינת חגים:', e);
        } finally {
            setLoading(false);
        }
    }, [selectedYear]);

    useEffect(() => { fetchHolidays(); }, [fetchHolidays]);

    const openCreate = () => {
        setEditing(null);
        setForm({ ...EMPTY_FORM, year: selectedYear });
        setShowModal(true);
    };

    const openEdit = (h) => {
        setEditing(h);
        setForm({
            name: h.name,
            hebrew_date_info: h.hebrew_date_info || '',
            start_date: h.start_date?.slice(0, 10) || '',
            end_date: h.end_date?.slice(0, 10) || '',
            year: h.year,
            type: h.type,
            description: h.description || '',
        });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (editing) {
                await holidayService.updateHoliday(editing.id, form);
            } else {
                await holidayService.createHoliday(form);
            }
            setShowModal(false);
            fetchHolidays();
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.message || 'שגיאה בשמירה');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('למחוק חג זה?')) return;
        try {
            await holidayService.deleteHoliday(id);
            fetchHolidays();
        } catch (e) {
            console.error(e);
        }
    };

    const viewResponses = async (holiday) => {
        setResponseView(holiday);
        setResponseLoading(true);
        try {
            const res = await holidayService.getHolidayResponses(holiday.id);
            setResponseData(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setResponseLoading(false);
        }
    };

    const isCurrentHoliday = (h) => {
        const today = new Date().toISOString().slice(0, 10);
        return h.start_date?.slice(0, 10) <= today && h.end_date?.slice(0, 10) >= today;
    };

    const openSeedModal = async () => {
        setShowSeedModal(true);
        setLoadingAvailable(true);
        try {
            const res = await holidayService.getAvailableHolidays();
            const list = res.data || [];
            setAvailableHolidays(list);
            // בחר אוטומטית רק חגים שלא קיימים
            setSelectedSeedIndices(new Set(list.filter(h => !h.already_exists).map(h => h.index)));
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingAvailable(false);
        }
    };

    const handleSeedSelected = async () => {
        if (selectedSeedIndices.size === 0) return;
        setSeeding(true);
        try {
            const res = await holidayService.seedHolidays([...selectedSeedIndices]);
            alert(res.message || 'חגים נטענו בהצלחה');
            setShowSeedModal(false);
            fetchHolidays();
        } catch (e) {
            console.error(e);
            alert(e.response?.data?.message || 'שגיאה בטעינת חגים');
        } finally {
            setSeeding(false);
        }
    };

    const toggleSeedIndex = (idx) => {
        setSelectedSeedIndices(prev => {
            const next = new Set(prev);
            next.has(idx) ? next.delete(idx) : next.add(idx);
            return next;
        });
    };

    const toggleAllSeed = () => {
        const notExisting = availableHolidays.filter(h => !h.already_exists);
        if (selectedSeedIndices.size === notExisting.length) {
            setSelectedSeedIndices(new Set());
        } else {
            setSelectedSeedIndices(new Set(notExisting.map(h => h.index)));
        }
    };

    const handleNotify = async (holiday) => {
        if (!confirm(`לשלוח התראה לכל המסעדות לגבי "${holiday.name}"?`)) return;
        setNotifying(holiday.id);
        try {
            const res = await holidayService.notifyRestaurants(holiday.id);
            alert(res.message || 'התראה נשלחה');
        } catch (e) {
            console.error(e);
            alert(e.response?.data?.message || 'שגיאה בשליחת התראה');
        } finally {
            setNotifying(null);
        }
    };

    return (
        <SuperAdminLayout>
            <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-4">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                            <div className="p-2 bg-purple-100 rounded-lg">
                                <FaCalendarAlt className="text-purple-600" size={20} />
                            </div>
                            חגים ומועדים
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">ניהול חגים ישראליים ומעקב תגובות מסעדות</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <select
                            value={selectedYear}
                            onChange={e => setSelectedYear(parseInt(e.target.value))}
                            className="border rounded-xl px-3 py-2 text-sm font-bold"
                        >
                            {[2025, 2026, 2027, 2028].map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                        <button
                            onClick={openSeedModal}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors"
                        >
                            <FaDatabase size={14} />
                            טען חגים
                        </button>
                        <button
                            onClick={openCreate}
                            className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-xl font-bold hover:bg-brand-dark transition-colors"
                        >
                            <FaPlus size={14} />
                            חג חדש
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-12 text-gray-400">טוען...</div>
                ) : holidays.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                        <FaCalendarAlt size={48} className="mx-auto mb-4 opacity-30" />
                        <p>אין חגים לשנת {selectedYear}</p>
                    </div>
                ) : (
                    <div className="grid gap-3">
                        {holidays.map((h) => (
                            <div
                                key={h.id}
                                className={`bg-white rounded-2xl border p-4 flex items-center gap-4 transition-all ${isCurrentHoliday(h) ? 'border-purple-300 shadow-md ring-1 ring-purple-200' : 'border-gray-200'
                                    }`}
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-bold text-gray-900">{h.name}</h3>
                                        {isCurrentHoliday(h) && (
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-bold animate-pulse">
                                                עכשיו
                                            </span>
                                        )}
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${TYPE_COLORS[h.type]}`}>
                                            {TYPE_LABELS[h.type]}
                                        </span>
                                    </div>
                                    {h.hebrew_date_info && (
                                        <p className="text-xs text-gray-500">{h.hebrew_date_info}</p>
                                    )}
                                    <p className="text-[10px] text-gray-400 mt-1">
                                        {new Date(h.start_date).toLocaleDateString('he-IL')}
                                        {h.start_date !== h.end_date && ` — ${new Date(h.end_date).toLocaleDateString('he-IL')}`}
                                    </p>
                                    {h.description && <p className="text-xs text-gray-500 mt-1">{h.description}</p>}
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <button
                                        onClick={() => handleNotify(h)}
                                        disabled={notifying === h.id}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-600 rounded-xl text-xs font-bold hover:bg-amber-100 disabled:opacity-50"
                                        title="שלח התראה למסעדות"
                                    >
                                        <FaBell size={12} />
                                        {notifying === h.id ? 'שולח...' : 'התראה'}
                                    </button>
                                    <button
                                        onClick={() => viewResponses(h)}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-purple-50 text-purple-600 rounded-xl text-xs font-bold hover:bg-purple-100"
                                    >
                                        <FaEye size={12} />
                                        תגובות
                                    </button>
                                    <button onClick={() => openEdit(h)} className="p-2 hover:bg-gray-100 rounded-lg">
                                        <FaEdit size={14} className="text-gray-500" />
                                    </button>
                                    <button onClick={() => handleDelete(h.id)} className="p-2 hover:bg-red-50 rounded-lg">
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
                    <div className="bg-white rounded-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 border-b">
                            <h2 className="font-black text-lg">{editing ? 'עריכת חג' : 'חג חדש'}</h2>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><FaTimes /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">שם החג *</label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                                    required
                                    className="w-full border rounded-xl px-3 py-2 text-sm"
                                    placeholder="פסח"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">תאריך עברי</label>
                                <input
                                    type="text"
                                    value={form.hebrew_date_info}
                                    onChange={e => setForm(p => ({ ...p, hebrew_date_info: e.target.value }))}
                                    className="w-full border rounded-xl px-3 py-2 text-sm"
                                    placeholder="ט״ו ניסן"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">מתאריך *</label>
                                    <input
                                        type="date"
                                        value={form.start_date}
                                        onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
                                        required
                                        className="w-full border rounded-xl px-3 py-2 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">עד תאריך *</label>
                                    <input
                                        type="date"
                                        value={form.end_date}
                                        onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))}
                                        required
                                        className="w-full border rounded-xl px-3 py-2 text-sm"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">שנה *</label>
                                    <input
                                        type="number"
                                        value={form.year}
                                        onChange={e => setForm(p => ({ ...p, year: parseInt(e.target.value) }))}
                                        required
                                        className="w-full border rounded-xl px-3 py-2 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">סוג *</label>
                                    <select
                                        value={form.type}
                                        onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                                        className="w-full border rounded-xl px-3 py-2 text-sm"
                                    >
                                        <option value="full_closure">סגירה מלאה</option>
                                        <option value="half_day">חצי יום</option>
                                        <option value="eve">ערב חג</option>
                                        <option value="info_only">מידע בלבד</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">תיאור</label>
                                <textarea
                                    value={form.description}
                                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                                    rows={2}
                                    className="w-full border rounded-xl px-3 py-2 text-sm"
                                    placeholder="פרטים נוספים..."
                                />
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

            {/* מודל תגובות מסעדות */}
            {responseView && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { setResponseView(null); setResponseData(null); }}>
                    <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white rounded-t-2xl">
                            <div>
                                <h2 className="font-black text-lg">תגובות — {responseView.name}</h2>
                                {responseData?.stats && (
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        {responseData.stats.responded} הגיבו מתוך {responseData.stats.total}
                                    </p>
                                )}
                            </div>
                            <button onClick={() => { setResponseView(null); setResponseData(null); }} className="p-2 hover:bg-gray-100 rounded-lg"><FaTimes /></button>
                        </div>
                        <div className="p-4">
                            {responseLoading ? (
                                <div className="text-center py-8 text-gray-400">טוען...</div>
                            ) : (
                                <>
                                    {responseData?.responded?.length > 0 && (
                                        <div className="mb-4">
                                            <h3 className="font-bold text-sm text-gray-700 mb-2 flex items-center gap-1">
                                                <FaCheck className="text-green-500" size={12} />
                                                הגיבו ({responseData.responded.length})
                                            </h3>
                                            <div className="space-y-2">
                                                {responseData.responded.map(r => (
                                                    <div key={r.id} className="flex items-center gap-3 bg-green-50 rounded-xl p-3">
                                                        <span className="font-bold text-sm">{r.restaurant?.name}</span>
                                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${r.status === 'closed' ? 'bg-red-100 text-red-600' :
                                                                r.status === 'open' ? 'bg-green-100 text-green-600' :
                                                                    'bg-blue-100 text-blue-600'
                                                            }`}>
                                                            {r.status === 'closed' ? 'סגור' : r.status === 'open' ? 'פתוח רגיל' : `${r.open_time?.slice(0, 5)}–${r.close_time?.slice(0, 5)}`}
                                                        </span>
                                                        {r.note && <span className="text-xs text-gray-500">{r.note}</span>}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {responseData?.not_responded?.length > 0 && (
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <h3 className="font-bold text-sm text-gray-700 flex items-center gap-1">
                                                    <FaQuestion className="text-amber-500" size={12} />
                                                    לא הגיבו ({responseData.not_responded.length})
                                                </h3>
                                                <button
                                                    onClick={() => handleNotify(responseView)}
                                                    disabled={notifying === responseView?.id}
                                                    className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-600 rounded-xl text-xs font-bold hover:bg-amber-100 disabled:opacity-50 transition-colors"
                                                >
                                                    <FaBell size={11} />
                                                    {notifying === responseView?.id ? 'שולח...' : 'שלח תזכורת'}
                                                </button>
                                            </div>
                                            <div className="space-y-1">
                                                {responseData.not_responded.map(r => (
                                                    <div key={r.id} className="flex items-center gap-3 bg-gray-50 rounded-xl p-2.5">
                                                        <span className="text-sm text-gray-600">{r.name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* מודל בחירת חגים לטעינה */}
            {showSeedModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowSeedModal(false)}>
                    <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
                            <div>
                                <h2 className="font-black text-lg flex items-center gap-2">
                                    <FaDatabase className="text-green-600" size={16} />
                                    טעינת חגים ישראליים
                                </h2>
                                <p className="text-xs text-gray-500 mt-0.5">בחרו אילו חגים להוסיף למערכת</p>
                            </div>
                            <button onClick={() => setShowSeedModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><FaTimes /></button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-4">
                            {loadingAvailable ? (
                                <div className="text-center py-8 text-gray-400">טוען רשימת חגים...</div>
                            ) : availableHolidays.length === 0 ? (
                                <div className="text-center py-8 text-gray-400">לא נמצאו חגים זמינים</div>
                            ) : (
                                <>
                                    {/* Select all toggle */}
                                    <button
                                        onClick={toggleAllSeed}
                                        className="mb-3 text-sm font-bold text-brand-primary hover:underline"
                                    >
                                        {selectedSeedIndices.size === availableHolidays.filter(h => !h.already_exists).length
                                            ? 'בטל הכל'
                                            : 'בחר הכל'}
                                    </button>

                                    <div className="space-y-2">
                                        {availableHolidays.map((h) => {
                                            const checked = selectedSeedIndices.has(h.index);
                                            return (
                                                <label
                                                    key={h.index}
                                                    className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                                                        h.already_exists
                                                            ? 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
                                                            : checked
                                                            ? 'border-green-400 bg-green-50'
                                                            : 'border-gray-200 hover:border-gray-300'
                                                    }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        disabled={h.already_exists}
                                                        onChange={() => toggleSeedIndex(h.index)}
                                                        className="w-4 h-4 rounded accent-green-600"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-sm text-gray-900">{h.name}</span>
                                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${TYPE_COLORS[h.type]}`}>
                                                                {TYPE_LABELS[h.type]}
                                                            </span>
                                                            {h.already_exists && (
                                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 font-bold">
                                                                    קיים
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            {h.hebrew_date_info && (
                                                                <span className="text-[11px] text-gray-500">{h.hebrew_date_info}</span>
                                                            )}
                                                            <span className="text-[10px] text-gray-400">
                                                                {new Date(h.start_date).toLocaleDateString('he-IL')}
                                                                {h.start_date !== h.end_date && ` — ${new Date(h.end_date).toLocaleDateString('he-IL')}`}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t flex gap-2 flex-shrink-0">
                            <button
                                onClick={handleSeedSelected}
                                disabled={seeding || selectedSeedIndices.size === 0}
                                className="flex-1 bg-green-600 text-white rounded-xl py-2.5 font-bold hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <FaCheck size={12} />
                                {seeding ? 'טוען...' : `טען ${selectedSeedIndices.size} חגים`}
                            </button>
                            <button
                                onClick={() => setShowSeedModal(false)}
                                className="px-4 py-2.5 border rounded-xl font-bold text-gray-600 hover:bg-gray-50"
                            >
                                ביטול
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </SuperAdminLayout>
    );
}
