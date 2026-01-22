import { useEffect, useState, useMemo, useCallback } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import { useAdminAuth } from '../../context/AdminAuthContext';
import api from '../../services/apiClient';
import DeliveryZoneMap from '../../components/DeliveryZoneMap';

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
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">🚚 אזורי משלוח</h1>
                    <p className="text-gray-500">ניהול אזורי משלוח ותמחור</p>
                </div>
                {isManager() && (
                    <button
                        onClick={openNew}
                        className="bg-brand-primary text-white px-6 py-3 rounded-xl font-medium hover:bg-brand-dark"
                    >
                        ➕ אזור חדש
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {zones.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-gray-500 md:col-span-2">
                        אין אזורי משלוח מוגדרים
                    </div>
                ) : (
                    zones.map((zone) => (
                        <div key={zone.id} className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
                            {zone.preview_image && (
                                <div className="w-full h-32 rounded-lg overflow-hidden border border-gray-200 mb-2">
                                    <img
                                        src={zone.preview_image}
                                        alt={`Preview of ${zone.name}`}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            )}
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="font-semibold text-gray-800">{zone.name}</h3>
                                    <p className="text-xs text-gray-500">סוג תמחור: {zone.pricing_type}</p>
                                </div>
                                <span className={`text-xs px-2 py-1 rounded-full ${zone.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                    {zone.is_active ? 'פעיל' : 'לא פעיל'}
                                </span>
                            </div>
                            <div className="text-sm text-gray-600">
                                {zone.pricing_type === 'fixed' && <>מחיר קבוע: ₪{Number(zone.fixed_fee || 0).toFixed(2)}</>}
                                {zone.pricing_type === 'per_km' && <>מחיר לק"מ: ₪{Number(zone.per_km_fee || 0).toFixed(2)}</>}
                                {zone.pricing_type === 'tiered' && <>מדרגות מחיר: {Array.isArray(zone.tiered_fees) ? zone.tiered_fees.length : 0}</>}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => openEdit(zone)}
                                    className="flex-1 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
                                >
                                    ✏️ ערוך
                                </button>
                                <button
                                    onClick={() => deleteZone(zone.id)}
                                    className="px-4 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                                >
                                    🗑️
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {modalOpen && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b flex items-center justify-between">
                            <h2 className="text-xl font-bold">{editZone ? 'עריכת אזור' : 'אזור משלוח חדש'}</h2>
                            <button onClick={closeModal} className="text-gray-400">✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">שם אזור</label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    className="w-full px-4 py-3 border rounded-xl"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">סוג תמחור</label>
                                <select
                                    value={form.pricing_type}
                                    onChange={(e) => {
                                        // שומר את הפוליגון הקיים כשמשנים סוג תמחור
                                        setForm({ ...form, pricing_type: e.target.value });
                                    }}
                                    className="w-full px-4 py-3 border rounded-xl"
                                >
                                    <option value="fixed">קבוע</option>
                                    <option value="per_km">לפי ק"מ</option>
                                    <option value="tiered">מדרגות</option>
                                </select>
                            </div>

                            {form.pricing_type === 'fixed' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">מחיר קבוע (₪)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={form.fixed_fee}
                                        onChange={(e) => setForm({ ...form, fixed_fee: e.target.value })}
                                        className="w-full px-4 py-3 border rounded-xl"
                                    />
                                </div>
                            )}

                            {form.pricing_type === 'per_km' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">מחיר לק"מ (₪)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        value={form.per_km_fee}
                                        onChange={(e) => {
                                            // שומר את הפוליגון הקיים
                                            setForm({ ...form, per_km_fee: e.target.value });
                                        }}
                                        className="w-full px-4 py-3 border rounded-xl"
                                        placeholder="לדוגמה: 3.50"
                                        required
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        המחיר יוכפל במספר הקילומטרים מהמסעדה ללקוח
                                    </p>
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">עיר (אופציונלי)</label>
                                <select
                                    value={form.city_id}
                                    onChange={(e) => setForm({ ...form, city_id: e.target.value })}
                                    className="w-full px-4 py-3 border rounded-xl"
                                >
                                    <option value="">ללא עיר מסוימת - לפי מפה בלבד</option>
                                    {cities.map(city => (
                                        <option key={city.id} value={city.id}>
                                            {city.hebrew_name} ({city.name})
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-gray-500 mt-1">אם מוגדרת עיר, אז המשלוח יהיה לכל הכתובות בעיר זו. אם לא, המשלוח יקבע לפי המלבן במפה. (העיר תוצג בכחול על המפה)</p>
                            </div>

                            {form.pricing_type === 'tiered' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">מדרגות מחיר לפי מרחק</label>
                                    <p className="text-xs text-gray-500 mb-2">
                                        הזן JSON עם מדרגות מחיר. כל מדרגה מגדירה מחיר עד מרחק מסוים.<br />
                                        <strong>דוגמה:</strong> עד 2 ק"מ = ₪10, עד 5 ק"מ = ₪15, מעל 5 ק"ם = ₪20
                                    </p>
                                    <textarea
                                        rows={6}
                                        value={form.tiered_fees}
                                        onChange={(e) => setForm({ ...form, tiered_fees: e.target.value })}
                                        className="w-full px-4 py-3 border rounded-xl font-mono text-sm"
                                        placeholder='[
  { "upto_km": 2, "fee": 10 },
  { "upto_km": 5, "fee": 15 },
  { "upto_km": 999, "fee": 20 }
]'
                                    />
                                    <p className="text-xs text-gray-400 mt-1">
                                        💡 טיפ: המדרגה האחרונה היא למרחקים גדולים (לדוגמה: 999 ק"מ)
                                    </p>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">בחירת אזור במפה (אופציונלי אם יש עיר)</label>
                                <p className="text-xs text-gray-500 mb-2">סמן מלבן כדי להגדיר את אזור המשלוח. אם נבחרה עיר למעלה, הפוליגון אינו חובה.</p>
                                <DeliveryZoneMap
                                    center={DEFAULT_CENTER}
                                    polygon={form.polygon}
                                    onPolygonChange={handlePolygonChange}
                                    selectedCity={selectedCity}
                                    cityRadius={form.city_radius}
                                    onRadiusChange={(radius) => setForm({ ...form, city_radius: radius })}
                                    onMapCaptured={(fn) => setCaptureMapFunction(() => fn)}
                                />
                            </div>

                            <label className="flex items-center gap-2 text-sm text-gray-700">
                                <input
                                    type="checkbox"
                                    checked={form.is_active}
                                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                                />
                                פעיל
                            </label>

                            <div className="flex justify-end gap-3">
                                <button type="button" onClick={closeModal} className="px-4 py-2 rounded-lg border">
                                    ביטול
                                </button>
                                <button type="submit" className="px-4 py-2 rounded-lg bg-brand-primary text-white">
                                    שמירה
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}
