import { useState, useEffect } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { useRestaurantStatus } from '../../context/RestaurantStatusContext';
import AdminLayout from '../../layouts/AdminLayout';
import api from '../../services/apiClient';
import { resolveAssetUrl } from '../../utils/assets';

const DAYS_OF_WEEK = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

// חשב אם המסעדה פתוחה בהתאם לימי פתיחה ושעות פתיחה
const calculateIsOpen = (operatingDays = {}, operatingHours = {}) => {
    const now = new Date();
    const hebrewDays = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    const currentDayName = hebrewDays[now.getDay()];

    // בדוק אם היום הנוכחי הוא יום פתיחה
    if (Object.keys(operatingDays).length > 0 && !operatingDays[currentDayName]) {
        return false;
    }

    // אם אין שעות מוגדרות, המסעדה פתוחה ביום זה
    if (!operatingHours.open || !operatingHours.close) {
        return true;
    }

    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const open = operatingHours.open;
    const close = operatingHours.close;

    // אם שעת הסגירה קטנה משעת הפתיחה (פתוח בין לילה)
    if (close < open) {
        return currentTime >= open || currentTime <= close;
    }

    return currentTime >= open && currentTime <= close;
};

export default function AdminRestaurant() {
    const { getAuthHeaders, isOwner } = useAdminAuth();
    const { setRestaurantStatus } = useRestaurantStatus();
    const [restaurant, setRestaurant] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [logoPreview, setLogoPreview] = useState(null);
    const [overrideStatus, setOverrideStatus] = useState(false);
    const [calculatedStatus, setCalculatedStatus] = useState(false);
    const [justFetched, setJustFetched] = useState(false);

    useEffect(() => {
        fetchRestaurant();
    }, []);

    useEffect(() => {
        // שדרנו את סטטוס הקנייה לContext לשימוש בכל העמוד
        if (restaurant) {
            setRestaurantStatus({
                is_open: restaurant.is_open,
                is_override: overrideStatus,
            });
        }
    }, [restaurant?.is_open, overrideStatus, setRestaurantStatus]);

    useEffect(() => {
        // רק חשב את הסטטוס המחושב לצורך תצוגה - אל תשנה את restaurant.is_open!
        if (restaurant && Object.keys(restaurant).length > 0) {
            const calculated = calculateIsOpen(restaurant.operating_days || {}, restaurant.operating_hours || {});
            setCalculatedStatus(calculated);
            console.log('📊 Calculated:', calculated, 'DB is_open:', restaurant.is_open, 'Is Overridden:', restaurant.is_override_status);
        }
    }, [restaurant?.operating_days, restaurant?.operating_hours, restaurant?.is_open]);

    const fetchRestaurant = async () => {
        try {
            const response = await api.get('/admin/restaurant', { headers: getAuthHeaders() });
            if (response.data.success) {
                console.log('📩 Fetched restaurant:', response.data.restaurant);
                setRestaurant(response.data.restaurant);
                setLogoPreview(response.data.restaurant.logo_url ? resolveAssetUrl(response.data.restaurant.logo_url) : null);
                // עדכן את overrideStatus בהתאם ל-is_override_status מהשרת
                setOverrideStatus(response.data.restaurant.is_override_status || false);
            }
        } catch (error) {
            console.error('Failed to fetch restaurant:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (field, value) => {
        setRestaurant((prev) => ({ ...prev, [field]: value }));
    };

    const handleOperatingDaysChange = (day, checked) => {
        setRestaurant((prev) => ({
            ...prev,
            operating_days: {
                ...prev.operating_days,
                [day]: checked,
            },
        }));
    };

    const handleOperatingHoursChange = (field, value) => {
        setRestaurant((prev) => ({
            ...prev,
            operating_hours: {
                ...prev.operating_hours,
                [field]: value,
            },
        }));
    };

    const handleLogo = (file) => {
        setRestaurant((prev) => ({ ...prev, logo: file }));
        setLogoPreview(URL.createObjectURL(file));
    };

    const save = async (e) => {
        e.preventDefault();
        if (!isOwner()) {
            alert('רק בעל המסעדה יכול לעדכן פרטים');
            return;
        }
        setSaving(true);
        try {
            const formData = new FormData();

            // ✅ שלח את כל השדות בלי לדלג על ריקים
            const fieldsToSend = ['name', 'description', 'phone', 'address', 'city'];
            fieldsToSend.forEach((field) => {
                const value = restaurant[field];
                // שלח גם ריקים/null - תן לבקאנד להחליט מה לעשות
                if (value !== undefined) {
                    formData.append(field, value || '');
                }
            });

            // 🔍 DEBUG - בדוק מה בדיוק ב-FormData
            const formDataLog = {};
            for (let [key, value] of formData.entries()) {
                formDataLog[key] = value;
            }
            console.log('📤 FormData entries:', formDataLog);
            console.log('📤 restaurant state:', restaurant);

            console.log('📤 Sending form fields:', fieldsToSend.reduce((acc, f) => {
                acc[f] = restaurant[f];
                return acc;
            }, {}));

            // שלח את is_open רק אם הוא מעודכן ידנית (overrideStatus = true)
            if (overrideStatus) {
                const isOpenValue = restaurant.is_open === true ? '1' : '0';
                formData.append('is_open', isOpenValue);
                console.log('🔒 Overriding status to:', isOpenValue);
            } else {
                console.log('📅 Using calculated status');
            }

            // תמיד שלח את operating_days ו-operating_hours
            if (restaurant.operating_days && Object.keys(restaurant.operating_days).length > 0) {
                formData.append('operating_days', JSON.stringify(restaurant.operating_days));
                console.log('📅 Operating days:', restaurant.operating_days);
            }
            if (restaurant.operating_hours && Object.keys(restaurant.operating_hours).length > 0) {
                formData.append('operating_hours', JSON.stringify(restaurant.operating_hours));
                console.log('🕐 Operating hours:', restaurant.operating_hours);
            }

            if (restaurant.logo) {
                formData.append('logo', restaurant.logo);
            }

            // ✅ Laravel PUT + multipart workaround
            formData.append('_method', 'PUT');

            console.log('✅ About to send POST request with _method=PUT...');
            const response = await api.post('/admin/restaurant', formData, {
                headers: { ...getAuthHeaders(), 'Content-Type': 'multipart/form-data' },
            });
            
            // ✅ עדכן state עם הנתונים שחזרו מהשרת
            if (response.data.success && response.data.restaurant) {
                console.log('✅ Updating state with:', response.data.restaurant);
                setRestaurant(response.data.restaurant);
                setLogoPreview(response.data.restaurant.logo_url ? resolveAssetUrl(response.data.restaurant.logo_url) : null);
            }
            
            alert('נשמר בהצלחה');
        } catch (error) {
            console.error('Failed to save restaurant:', error);
            alert(error.response?.data?.message || 'שגיאה בשמירה');
        } finally {
            setSaving(false);
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

    if (!restaurant) {
        return (
            <AdminLayout>
                <div className="p-8 text-center text-gray-500">לא נמצאו נתוני מסעדה</div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="max-w-3xl mx-auto">
                <h1 className="text-2xl font-bold text-gray-800 mb-6">🏪 פרטי מסעדה</h1>
                <form onSubmit={save} className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row gap-6">
                        <div className="flex-1 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">שם</label>
                                <input
                                    type="text"
                                    value={restaurant.name || ''}
                                    onChange={(e) => handleChange('name', e.target.value)}
                                    required
                                    className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">תיאור</label>
                                <textarea
                                    value={restaurant.description || ''}
                                    onChange={(e) => handleChange('description', e.target.value)}
                                    rows={3}
                                    className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                />
                            </div>
                        </div>
                        <div className="w-full sm:w-48">
                            <div className="bg-gray-50 rounded-2xl p-4 text-center">
                                {logoPreview ? (
                                    <img src={logoPreview} alt="logo" className="w-32 h-32 object-contain mx-auto mb-2" />
                                ) : (
                                    <div className="w-32 h-32 mx-auto bg-white border rounded-2xl flex items-center justify-center text-3xl">🏪</div>
                                )}
                                <label className="block mt-3 text-sm font-medium text-brand-primary cursor-pointer">
                                    העלאת לוגו
                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleLogo(e.target.files[0])} />
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">טלפון</label>
                            <input
                                type="text"
                                value={restaurant.phone || ''}
                                onChange={(e) => handleChange('phone', e.target.value)}
                                className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">כתובת</label>
                            <input
                                type="text"
                                value={restaurant.address || ''}
                                onChange={(e) => handleChange('address', e.target.value)}
                                className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary"
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">עיר</label>
                            <input
                                type="text"
                                value={restaurant.city || ''}
                                onChange={(e) => handleChange('city', e.target.value)}
                                className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary"
                            />
                        </div>
                    </div>

                    {/* ימי פתיחה */}
                    <div className="border-t pt-4">
                        <h3 className="text-sm font-bold text-gray-700 mb-3">📅 ימי פתיחה</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {DAYS_OF_WEEK.map((day, index) => (
                                <label key={day} className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={restaurant.operating_days?.[day] || false}
                                        onChange={(e) => handleOperatingDaysChange(day, e.target.checked)}
                                        className="w-4 h-4 rounded"
                                    />
                                    <span className="text-sm text-gray-700">{day}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* שעות פתיחה */}
                    <div className="border-t pt-4">
                        <h3 className="text-sm font-bold text-gray-700 mb-3">🕐 שעות פתיחה</h3>
                        <div className="grid grid-cols-2 gap-4 sm:w-80">
                            <div>
                                <label className="block text-sm text-gray-700 mb-1">שעת פתיחה</label>
                                <input
                                    type="time"
                                    value={restaurant.operating_hours?.open || '09:00'}
                                    onChange={(e) => handleOperatingHoursChange('open', e.target.value)}
                                    className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-700 mb-1">שעת סגירה</label>
                                <input
                                    type="time"
                                    value={restaurant.operating_hours?.close || '23:00'}
                                    onChange={(e) => handleOperatingHoursChange('close', e.target.value)}
                                    className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                />
                            </div>
                        </div>
                    </div>

                    {/* סטטוס פתיחה */}
                    <div className="border-t pt-4">
                        <h3 className="text-sm font-bold text-gray-700 mb-4">🚪 סטטוס פתיחה</h3>

                        <div className="space-y-3">
                            {/* הצגת הסטטוס הנוכחי */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (overrideStatus) {
                                                handleChange('is_open', !restaurant.is_open);
                                            }
                                        }}
                                        disabled={!overrideStatus}
                                        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${restaurant.is_open
                                            ? 'bg-green-100 text-green-700'
                                            : 'bg-red-100 text-red-700'
                                            } ${!overrideStatus && 'opacity-70 cursor-not-allowed'}`}
                                    >
                                        {restaurant.is_open ? '✓ פתוח' : '✗ סגור'}
                                    </button>
                                    {/* סטטוס קונקרטי */}
                                    <span className="text-xs font-semibold">
                                        {overrideStatus
                                            ? '🔒 מכופה ידנית'
                                            : `📅 חישוב: ${calculatedStatus ? '✓ פתוח' : '✗ סגור'}`
                                        }
                                    </span>
                                </div>
                            </div>

                            {/* כפיית סטטוס ידנית */}
                            <label className="flex items-center gap-2 cursor-pointer py-2">
                                <input
                                    type="checkbox"
                                    checked={overrideStatus}
                                    onChange={(e) => {
                                        setOverrideStatus(e.target.checked);
                                        if (!e.target.checked) {
                                            // חזור לסטטוס מחושב
                                            setRestaurant((prev) => ({ ...prev, is_open: calculatedStatus }));
                                        }
                                    }}
                                    className="w-4 h-4 rounded"
                                />
                                <span className="text-sm text-gray-600">אפשר כפיית סטטוס ידנית</span>
                            </label>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2 border-t">
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 bg-brand-primary text-white py-3 rounded-xl font-medium hover:bg-brand-dark disabled:opacity-50"
                        >
                            {saving ? 'שומר...' : 'שמור'}
                        </button>
                        <button
                            type="button"
                            onClick={fetchRestaurant}
                            className="px-6 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200"
                        >
                            רענן
                        </button>
                    </div>
                </form>
            </div>
        </AdminLayout>
    );
}
