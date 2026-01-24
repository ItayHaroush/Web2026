import { useEffect, useState, useMemo, useCallback } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import { useAdminAuth } from '../../context/AdminAuthContext';
import api from '../../services/apiClient';
import DeliveryZoneMap from '../../components/DeliveryZoneMap';
import { 
    FaMapMarkedAlt, 
    FaPlus, 
    FaEdit, 
    FaTrash, 
    FaDrawPolygon, 
    FaCity, 
    FaRoute, 
    FaShekelSign,
    FaCheckCircle,
    FaTimesCircle,
    FaInfoCircle,
    FaLayerGroup,
    FaTimes,
    FaSave,
    FaUndo
} from 'react-icons/fa';

const emptyForm = {
    name: '',
    city_id: '',
    city_radius: 5,
    pricing_type: 'fixed',
    fixed_fee: '0',
    per_km_fee: '',
    tiered_fees: '',
    polygon: [],
    is_active: true,
};

const DEFAULT_CENTER = [32.0853, 34.7818];

export default function AdminDeliveryZones() {
    const { getAuthHeaders, isManager } = useAdminAuth();
    const [zones, setZones] = useState([]);
    const [cities, setCities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editZone, setEditZone] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [captureMapFunction, setCaptureMapFunction] = useState(null);

    // שומר על אותו אובייקט עיר כל עוד city_id לא השתנה
    const selectedCity = useMemo(() => {
        if (!form.city_id) return null;
        return cities.find(c => String(c.id) === String(form.city_id)) || null;
    }, [form.city_id, cities]);

    // פונקציה מייצבת לשינוי פוליגון - לא יוצר reference חדש בכל render
    const handlePolygonChange = useCallback((nextPolygon) => {
        setForm(prev => ({
            ...prev,
            polygon: nextPolygon,
            city_id: nextPolygon?.length >= 3 ? '' : prev.city_id // אפס עיר רק אם יש פוליגון
        }));
    }, []);

    const fetchZones = async () => {
        try {
            const response = await api.get('/admin/delivery-zones', { headers: getAuthHeaders() });
            if (response.data.success) {
                setZones(response.data.zones || []);
            }
        } catch (error) {
            console.error('Failed to fetch delivery zones', error.response?.data || error.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchCities = async () => {
        try {
            const response = await api.get('/cities');
            if (response.data.success) {
                setCities(response.data.data || []); // משונה מ-cities ל-data
            }
        } catch (error) {
            console.error('Failed to fetch cities', error);
        }
    };

    useEffect(() => {
        fetchZones();
        fetchCities();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const openNew = () => {
        setEditZone(null);
        setForm(emptyForm);
        setModalOpen(true);
    };

    const openEdit = (zone) => {
        setEditZone(zone);
        setForm({
            name: zone.name || '',
            city_id: zone.city_id || '',
            city_radius: zone.city_radius || 5,
            pricing_type: zone.pricing_type || 'fixed',
            fixed_fee: zone.fixed_fee ?? '0',
            per_km_fee: zone.per_km_fee ?? '',
            tiered_fees: zone.tiered_fees ? JSON.stringify(zone.tiered_fees, null, 2) : '',
            polygon: Array.isArray(zone.polygon) ? zone.polygon : [],
            is_active: Boolean(zone.is_active),
        });
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setEditZone(null);
        setForm(emptyForm);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isManager()) return;

        // polygon כבר מערך או ריק מה-form
        const polygon = Array.isArray(form.polygon) && form.polygon.length >= 3 ? form.polygon : null;

        console.log('🔍 handleSubmit:', {
            form_polygon: form.polygon,
            computed_polygon: polygon,
            city_id: form.city_id
        });

        // בדיקה: או שיש עיר נבחרת, או שיש פוליגון מוגדר
        if (!form.city_id && !polygon) {
            alert('יש לבחור עיר או לסמן אזור במפה (לפחות 3 נקודות)');
            return;
        }

        let tieredFees = null;

        if (form.pricing_type === 'per_km') {
            if (!form.per_km_fee || Number(form.per_km_fee) <= 0) {
                alert('יש להזין מחיר לק"מ גדול מ-0');
                return;
            }
        }

        if (form.pricing_type === 'tiered') {
            try {
                tieredFees = JSON.parse(form.tiered_fees || '[]');
            } catch (err) {
                alert('מדרגות מחיר לא תקינות (JSON)');
                return;
            }
            if (!Array.isArray(tieredFees) || tieredFees.length === 0) {
                alert('יש להזין מדרגות מחיר');
                return;
            }
        }

        // Capture map preview
        let previewImage = null;
        if (captureMapFunction) {
            try {
                previewImage = await captureMapFunction();
            } catch (error) {
                console.error('Failed to capture map:', error);
            }
        }

        const payload = {
            name: form.name,
            city_id: form.city_id || null,
            city_radius: form.city_id ? Number(form.city_radius) : null,
            pricing_type: form.pricing_type,
            // תמיד שולחים 0 ולא null כדי למנוע שגיאות SQL
            fixed_fee: form.pricing_type === 'fixed' ? Number(form.fixed_fee || 0) : 0,
            per_km_fee: form.pricing_type === 'per_km' ? Number(form.per_km_fee || 0) : 0,
            tiered_fees: form.pricing_type === 'tiered' ? tieredFees : null,
            polygon: polygon, // null או מערך עם לפחות נקודה אחת
            is_active: Boolean(form.is_active),
            preview_image: previewImage,
        };

        try {
            if (editZone) {
                await api.put(`/admin/delivery-zones/${editZone.id}`, payload, { headers: getAuthHeaders() });
            } else {
                await api.post('/admin/delivery-zones', payload, { headers: getAuthHeaders() });
            }
            closeModal();
            fetchZones();
        } catch (error) {
            const message = error.response?.data?.message || 'שגיאה בשמירת אזור משלוח';
            alert(message);
        }
    };

    const deleteZone = async (zoneId) => {
        if (!confirm('האם למחוק את אזור המשלוח?')) return;
        try {
            await api.delete(`/admin/delivery-zones/${zoneId}`, { headers: getAuthHeaders() });
            fetchZones();
        } catch (error) {
            alert(error.response?.data?.message || 'שגיאה במחיקת אזור');
        }
    };

    if (loading) {
        return (
            <AdminLayout>
                <div className="flex flex-col items-center justify-center h-96">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-brand-primary"></div>
                    <p className="mt-4 text-gray-500 font-black animate-pulse">טוען הגדרות משלוח...</p>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="max-w-7xl mx-auto space-y-8 pb-24 animate-in fade-in duration-500">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <h1 className="text-4xl font-black text-gray-900 flex items-center gap-3">
                            <span className="p-3 bg-brand-primary/10 rounded-2xl text-brand-primary">
                                <FaMapMarkedAlt size={32} />
                            </span>
                            אזורי משלוח
                        </h1>
                        <p className="text-gray-500 mt-2 mr-16 font-medium">
                            ניהול תמחור לפי מרחק, פוליגונים וערים לכל משלוח
                        </p>
                    </div>
                    {isManager() && (
                        <button
                            onClick={openNew}
                            className="w-full md:w-auto bg-brand-primary text-white px-8 py-4 rounded-[1.5rem] font-black hover:bg-brand-dark transition-all flex items-center justify-center gap-3 shadow-lg shadow-brand-primary/20 active:scale-95"
                        >
                            <FaPlus />
                            הוספת אזור משלוח
                        </button>
                    )}
                </div>

                {/* Zones Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-8">
                    {zones.length === 0 ? (
                        <div className="bg-white rounded-[3rem] shadow-sm border border-gray-100 p-16 text-center flex flex-col items-center col-span-full max-w-lg mx-auto">
                            <div className="w-24 h-24 bg-gray-50 rounded-[2rem] flex items-center justify-center text-5xl mb-6 grayscale opacity-50">
                                <FaDrawPolygon />
                            </div>
                            <h3 className="text-2xl font-black text-gray-900 mb-2">אין אזורי משלוח</h3>
                            <p className="text-gray-500 font-medium mb-8">הגדר אזורי משלוח כדי לאפשר ללקוחות להזמין מהבית</p>
                            {isManager() && (
                                <button
                                    onClick={openNew}
                                    className="bg-brand-primary text-white px-8 py-3 rounded-2xl font-black hover:bg-brand-dark transition-all flex items-center gap-2"
                                >
                                    <FaPlus /> התחלה עכשיו
                                </button>
                            )}
                        </div>
                    ) : (
                        zones.map((zone) => (
                            <div 
                                key={zone.id} 
                                className={`group bg-white rounded-[2.5rem] shadow-sm border border-gray-100 p-6 flex flex-col gap-5 hover:shadow-xl transition-all duration-300 relative overflow-hidden ${!zone.is_active && 'opacity-60 grayscale-[0.5]'}`}
                            >
                                {/* Active Badge Overflow */}
                                <div className={`absolute top-0 right-0 px-4 py-1.5 rounded-bl-2xl text-[10px] font-black uppercase tracking-widest ${zone.is_active ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                                    {zone.is_active ? 'פעיל' : 'כבוי'}
                                </div>

                                {zone.preview_image ? (
                                    <div className="w-full h-44 rounded-[1.5rem] overflow-hidden border border-gray-100 shadow-inner group-hover:scale-[1.02] transition-transform duration-500">
                                        <img
                                            src={zone.preview_image}
                                            alt={zone.name}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                ) : (
                                    <div className="w-full h-44 bg-gray-50 rounded-[1.5rem] border border-gray-100 flex items-center justify-center">
                                        <FaMapMarkedAlt size={48} className="text-gray-200" />
                                    </div>
                                )}

                                <div className="space-y-4">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h3 className="text-xl font-black text-gray-900 group-hover:text-brand-primary transition-colors">{zone.name}</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                                                    <FaRoute /> {zone.pricing_type === 'fixed' ? 'מחיר קבוע' : zone.pricing_type === 'per_km' ? 'לפי ק"מ' : 'מדרגות מחיר'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                        <div className="p-3 bg-white text-brand-primary rounded-xl shadow-sm ml-4">
                                            <FaShekelSign size={14} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">עלות משלוח</p>
                                            <p className="text-lg font-black text-gray-900">
                                                {zone.pricing_type === 'fixed' && `₪${Number(zone.fixed_fee || 0).toFixed(2)}`}
                                                {zone.pricing_type === 'per_km' && `₪${Number(zone.per_km_fee || 0).toFixed(2)} / ק"מ`}
                                                {zone.pricing_type === 'tiered' && `${Array.isArray(zone.tiered_fees) ? zone.tiered_fees.length : 0} מדרגות`}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-auto grid grid-cols-2 gap-3 pt-4 border-t border-gray-50">
                                    <button
                                        onClick={() => openEdit(zone)}
                                        className="flex items-center justify-center gap-2 py-3 bg-indigo-50 text-indigo-600 rounded-xl text-sm font-black hover:bg-indigo-600 hover:text-white transition-all shadow-sm active:scale-95"
                                    >
                                        <FaEdit size={14} /> עריכה
                                    </button>
                                    <button
                                        onClick={() => deleteZone(zone.id)}
                                        className="flex items-center justify-center gap-2 py-3 bg-red-50 text-red-600 rounded-xl text-sm font-black hover:bg-red-600 hover:text-white transition-all shadow-sm active:scale-95"
                                    >
                                        <FaTrash size={14} /> מחיקה
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Modal */}
                {modalOpen && (
                    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-300">
                        <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-4xl w-full h-[95vh] sm:h-auto sm:max-h-[90vh] flex flex-col overflow-hidden border border-white/20 animate-in zoom-in-95 duration-300">
                            {/* Modal Header */}
                            <div className="px-8 py-6 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-brand-primary/10 rounded-xl text-brand-primary">
                                        {editZone ? <FaEdit size={20} /> : <FaPlus size={20} />}
                                    </div>
                                    <h2 className="text-xl font-black text-gray-900">
                                        {editZone ? 'עריכת אזור משלוח' : 'הגדרת אזור משלוח חדש'}
                                    </h2>
                                </div>
                                <button 
                                    onClick={closeModal} 
                                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
                                >
                                    <FaTimes size={20} />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8 custom-scrollbar">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    <div className="space-y-6">
                                        <section className="space-y-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <FaInfoCircle className="text-indigo-500" />
                                                <h3 className="font-black text-gray-800 uppercase tracking-widest text-[10px]">מידע כללי</h3>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-black text-gray-700 mr-1">שם האזור</label>
                                                <input
                                                    type="text"
                                                    value={form.name}
                                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                                    required
                                                    className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-brand-primary text-gray-900 font-bold"
                                                    placeholder="למשל: תל אביב מרכז, אזור השרון..."
                                                />
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label className="text-sm font-black text-gray-700 mr-1">סוג תמחור</label>
                                                    <select
                                                        value={form.pricing_type}
                                                        onChange={(e) => setForm({ ...form, pricing_type: e.target.value })}
                                                        className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-brand-primary text-gray-900 font-bold cursor-pointer"
                                                    >
                                                        <option value="fixed">💰 מחיר קבוע</option>
                                                        <option value="per_km">📏 לפי ק"מ</option>
                                                        <option value="tiered">📊 מדרגות מחיר</option>
                                                    </select>
                                                </div>

                                                {form.pricing_type === 'fixed' && (
                                                    <div className="space-y-2">
                                                        <label className="text-sm font-black text-gray-700 mr-1">עלות משלוח (₪)</label>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            value={form.fixed_fee}
                                                            onChange={(e) => setForm({ ...form, fixed_fee: e.target.value })}
                                                            className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-brand-primary text-gray-900 font-bold"
                                                        />
                                                    </div>
                                                )}

                                                {form.pricing_type === 'per_km' && (
                                                    <div className="space-y-2">
                                                        <label className="text-sm font-black text-gray-700 mr-1">₪ לק"מ</label>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            min="0.01"
                                                            value={form.per_km_fee}
                                                            onChange={(e) => setForm({ ...form, per_km_fee: e.target.value })}
                                                            className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-brand-primary text-gray-900 font-bold"
                                                            placeholder="למשל: 3.50"
                                                            required
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-sm font-black text-gray-700 mr-1">שיון לעיר (אופציונלי)</label>
                                                <div className="relative">
                                                    <FaCity className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                                    <select
                                                        value={form.city_id}
                                                        onChange={(e) => setForm({ ...form, city_id: e.target.value })}
                                                        className="w-full pr-12 pl-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-brand-primary text-gray-900 font-bold cursor-pointer appearance-none"
                                                    >
                                                        <option value="">לפי מפה בלבד</option>
                                                        {cities.map(city => (
                                                            <option key={city.id} value={city.id}>
                                                                {city.hebrew_name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <p className="text-[10px] text-gray-400 font-bold mt-1 px-1 leading-relaxed">
                                                    אם מוגדרת עיר, המשלוח יתאפשר לכל כתובת בעיר. אם לא, יש לסמן ידנית במפה.
                                                </p>
                                            </div>

                                            {form.pricing_type === 'tiered' && (
                                                <div className="space-y-2 p-4 bg-brand-primary/5 rounded-2xl border border-brand-primary/10">
                                                    <label className="text-sm font-black text-brand-primary mr-1 flex items-center gap-2">
                                                        <FaLayerGroup /> מדרגות מחיר (JSON)
                                                    </label>
                                                    <textarea
                                                        rows={4}
                                                        value={form.tiered_fees}
                                                        onChange={(e) => setForm({ ...form, tiered_fees: e.target.value })}
                                                        className="w-full px-4 py-3 bg-white border-2 border-transparent focus:border-brand-primary rounded-xl font-mono text-xs leading-loose"
                                                        placeholder='[{"upto_km": 2, "fee": 10}, ...]'
                                                    />
                                                    <div className="bg-white/50 p-2 rounded-lg text-[9px] text-gray-500 font-bold">
                                                        דוגמה: {"{\"upto_km\": 5, \"fee\": 15} = עד 5 ק\"מ ב-15 ש\"ח"}
                                                    </div>
                                                </div>
                                            )}

                                            <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl cursor-pointer hover:bg-gray-100 transition-colors border border-transparent hover:border-gray-200 group w-fit">
                                                <div className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors ${form.is_active ? 'bg-brand-primary' : 'bg-gray-300'}`}>
                                                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${form.is_active ? '-translate-x-4' : 'translate-x-0'}`}></div>
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    className="hidden"
                                                    checked={form.is_active}
                                                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                                                />
                                                <span className="text-sm font-black text-gray-700">אזור פעיל למשלוחים</span>
                                            </label>
                                        </section>
                                    </div>

                                    <div className="flex flex-col h-full bg-gray-50 rounded-[2rem] p-4 lg:p-6 border border-gray-100 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <FaDrawPolygon className="text-brand-primary" />
                                                <h3 className="font-black text-gray-800 text-sm">הגדרת אזור במפה</h3>
                                            </div>
                                            <button 
                                                type="button" 
                                                onClick={() => setForm(prev => ({ ...prev, polygon: [] }))}
                                                className="text-[10px] font-black text-brand-primary hover:underline flex items-center gap-1"
                                            >
                                                <FaUndo size={10} /> נקה מפה
                                            </button>
                                        </div>
                                        
                                        <div className="flex-1 min-h-[300px] sm:min-h-[400px] relative rounded-2xl overflow-hidden shadow-inner border-4 border-white">
                                            <DeliveryZoneMap
                                                center={DEFAULT_CENTER}
                                                polygon={form.polygon}
                                                onPolygonChange={handlePolygonChange}
                                                selectedCity={selectedCity}
                                                cityRadius={form.city_radius}
                                                onRadiusChange={(radius) => setForm({ ...form, city_radius: radius })}
                                                onMapCaptured={(fn) => setCaptureMapFunction(() => fn)}
                                            />
                                            
                                            {/* Map hint for mobile */}
                                            <div className="absolute top-4 left-4 right-4 bg-black/50 backdrop-blur-md p-2 rounded-xl border border-white/10 flex items-center gap-2 pointer-events-none">
                                                <div className="w-2 h-2 rounded-full bg-brand-primary animate-pulse" />
                                                <span className="text-[9px] text-white font-black">לחץ על המפה לסימון נקודות או הזז את הצירים</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </form>

                            {/* Modal Footer */}
                            <div className="px-8 py-6 bg-gray-50 border-t border-gray-100 flex gap-4 flex-shrink-0">
                                <button 
                                    onClick={handleSubmit}
                                    type="button"
                                    className="flex-1 bg-brand-primary text-white py-4 rounded-2xl font-black text-lg hover:shadow-lg hover:shadow-brand-primary/20 hover:bg-brand-dark transition-all active:scale-95 flex items-center justify-center gap-3"
                                >
                                    <FaSave />
                                    {editZone ? 'שמור שינויים' : 'צור אזור משלוח'}
                                </button>
                                <button 
                                    onClick={closeModal} 
                                    type="button"
                                    className="px-8 py-4 bg-white border border-gray-100 text-gray-700 rounded-2xl font-black hover:bg-gray-50 transition-all active:scale-95"
                                >
                                    ביטול
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
