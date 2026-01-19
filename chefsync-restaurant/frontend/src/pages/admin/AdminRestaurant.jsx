import { useState, useEffect, useRef } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { useRestaurantStatus } from '../../context/RestaurantStatusContext';
import AdminLayout from '../../layouts/AdminLayout';
import api from '../../services/apiClient';
import { resolveAssetUrl } from '../../utils/assets';
import { QRCodeCanvas } from 'qrcode.react';

const DAYS_OF_WEEK = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

// חשב סטטוס פתיחה: יום מיוחד (תאריך) > שעות יום ספציפי > ברירת מחדל
const calculateIsOpen = (operatingDays = {}, operatingHours = {}) => {
    const now = new Date();
    const todayDate = now.toISOString().slice(0, 10);
    const hebrewDays = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    const currentDayName = hebrewDays[now.getDay()];

    const defaultHours = operatingHours.default || operatingHours;
    const specialDays = operatingHours.special_days || {};
    const perDay = operatingHours.days || {};

    if (specialDays[todayDate]) {
        const special = specialDays[todayDate];
        if (special.closed) return false;
        const open = special.open ?? defaultHours?.open ?? '00:00';
        const close = special.close ?? defaultHours?.close ?? '23:59';
        return isTimeInRange(now, open, close);
    }

    if (perDay[currentDayName]) {
        const dayCfg = perDay[currentDayName];
        if (dayCfg.closed) return false;
        const open = dayCfg.open ?? defaultHours?.open ?? '00:00';
        const close = dayCfg.close ?? defaultHours?.close ?? '23:59';
        return isTimeInRange(now, open, close);
    }

    if (Object.keys(operatingDays).length > 0 && !operatingDays[currentDayName]) {
        return false;
    }

    if (!defaultHours?.open || !defaultHours?.close) {
        return true;
    }

    return isTimeInRange(now, defaultHours.open, defaultHours.close);
};

const isTimeInRange = (now, open, close) => {
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
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
    const [openDayPanels, setOpenDayPanels] = useState({});
    const shareQrRef = useRef(null);

    const normalizeOperatingHours = (oh) => {
        if (!oh) return {};
        if (oh.default || oh.special_days || oh.days) return oh;
        if (oh.open && oh.close) {
            return { default: { open: oh.open, close: oh.close }, special_days: {}, days: {} };
        }
        return oh;
    };

    // ודא שתמיד יש מבנה מלא לפני שליחה
    const buildOperatingHoursPayload = (operatingHours = {}, operatingDays = {}) => {
        const normalized = normalizeOperatingHours(operatingHours);
        const defaultOpen = normalized.default?.open ?? normalized.open ?? null;
        const defaultClose = normalized.default?.close ?? normalized.close ?? null;

        // השלם ימים חסרים עם מצב סגור/פתוח לפי operating_days
        const daysMap = { ...(normalized.days || {}) };
        Object.entries(operatingDays || {}).forEach(([day, isOpen]) => {
            daysMap[day] = {
                ...(daysMap[day] || {}),
                closed: !isOpen,
                open: daysMap[day]?.open ?? defaultOpen,
                close: daysMap[day]?.close ?? defaultClose,
            };
        });

        return {
            default: {
                open: defaultOpen,
                close: defaultClose,
            },
            special_days: normalized.special_days || {},
            days: daysMap,
        };
    };

    useEffect(() => {
        fetchRestaurant();
    }, []);

    useEffect(() => {
        // שדרנו את סטטוס הקנייה לContext לשימוש בכל העמוד
        if (restaurant) {
            setRestaurantStatus({
                is_open: restaurant.is_open,
                is_override: overrideStatus,
                is_approved: restaurant.is_approved ?? false,
            });
        }
    }, [restaurant?.is_open, restaurant?.is_approved, overrideStatus, setRestaurantStatus]);

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
                const normalized = {
                    ...response.data.restaurant,
                    operating_hours: normalizeOperatingHours(response.data.restaurant.operating_hours),
                };
                normalized.operating_hours = buildOperatingHoursPayload(
                    normalized.operating_hours,
                    normalized.operating_days || {}
                );
                console.log('📩 Fetched restaurant:', normalized);
                setRestaurant(normalized);
                setLogoPreview(normalized.logo_url ? resolveAssetUrl(normalized.logo_url) : null);
                setOverrideStatus(normalized.is_override_status || false);
                setRestaurantStatus({
                    is_open: normalized.is_open,
                    is_override: normalized.is_override_status || false,
                    is_approved: normalized.is_approved ?? false,
                });
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
            operating_hours: {
                default: prev.operating_hours?.default || prev.operating_hours || {},
                special_days: prev.operating_hours?.special_days || {},
                days: {
                    ...(prev.operating_hours?.days || {}),
                    [day]: {
                        ...(prev.operating_hours?.days?.[day] || {}),
                        closed: !checked,
                    },
                },
            },
        }));
    };

    const handleOperatingHoursChange = (field, value) => {
        setRestaurant((prev) => ({
            ...prev,
            operating_hours: {
                default: {
                    ...(prev.operating_hours?.default || prev.operating_hours || {}),
                    [field]: value,
                },
                special_days: prev.operating_hours?.special_days || {},
                days: prev.operating_hours?.days || {},
            },
        }));
    };

    const handleDayHoursChange = (day, field, value) => {
        setRestaurant((prev) => ({
            ...prev,
            operating_hours: {
                default: prev.operating_hours?.default || prev.operating_hours || {},
                special_days: prev.operating_hours?.special_days || {},
                days: {
                    ...(prev.operating_hours?.days || {}),
                    [day]: {
                        ...(prev.operating_hours?.days?.[day] || {}),
                        [field]: field === 'closed' ? Boolean(value) : value,
                    },
                },
            },
        }));
    };

    const toggleDayPanel = (day) => {
        setOpenDayPanels((prev) => ({ ...prev, [day]: !prev[day] }));
    };

    const handleLogo = (file) => {
        setRestaurant((prev) => ({ ...prev, logo: file }));
        setLogoPreview(URL.createObjectURL(file));
    };

    const isApproved = restaurant?.is_approved ?? false;

    const save = async (e) => {
        e.preventDefault();
        if (!isOwner()) {
            alert('רק בעל המסעדה יכול לעדכן פרטים');
            return;
        }
        setSaving(true);
        try {
            const formData = new FormData();

            // חשוב: שלח תמיד את דגל הכפייה כדי שיהיה אפשר לבטל כפייה בצורה מפורשת
            formData.append('is_override_status', overrideStatus ? '1' : '0');

            // ✅ שלח את כל השדות בלי לדלג על ריקים
            const fieldsToSend = [
                'name',
                'description',
                'phone',
                'address',
                'share_incentive_text',
                'delivery_time_minutes',
                'delivery_time_note',
                'pickup_time_minutes',
                'pickup_time_note',
            ];
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
            if (overrideStatus && isApproved) {
                const isOpenValue = restaurant.is_open === true ? '1' : '0';
                formData.append('is_open', isOpenValue);
                console.log('🔒 Overriding status to:', isOpenValue);
            } else {
                console.log('📅 Using calculated status');
            }

            // תמיד שלח את operating_days ו-operating_hours (מסודרות)
            if (restaurant.operating_days && Object.keys(restaurant.operating_days).length > 0) {
                formData.append('operating_days', JSON.stringify(restaurant.operating_days));
                console.log('📅 Operating days:', restaurant.operating_days);
            }

            const sanitizedHours = buildOperatingHoursPayload(
                restaurant.operating_hours,
                restaurant.operating_days
            );
            formData.append('operating_hours', JSON.stringify(sanitizedHours));
            console.log('🕐 Operating hours (sanitized):', sanitizedHours);

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
                const normalized = {
                    ...response.data.restaurant,
                    operating_hours: normalizeOperatingHours(response.data.restaurant.operating_hours),
                };
                // ודא שהשעות מוצגות עם ברירת מחדל אם חסר
                normalized.operating_hours = buildOperatingHoursPayload(
                    normalized.operating_hours,
                    normalized.operating_days || {}
                );
                console.log('✅ Updating state with:', normalized);
                setRestaurant(normalized);
                setLogoPreview(normalized.logo_url ? resolveAssetUrl(normalized.logo_url) : null);
            }

            alert('נשמר בהצלחה');
        } catch (error) {
            console.error('Failed to save restaurant:', error);
            alert(error.response?.data?.message || 'שגיאה בשמירה');
        } finally {
            setSaving(false);
        }
    };

    const getShareLink = () => {
        if (!restaurant?.slug) return '';
        return `${window.location.origin}/r/${restaurant.slug}`;
    };

    const downloadShareQrPng = () => {
        const canvas = shareQrRef.current;
        if (!canvas) return;
        canvas.toBlob((blob) => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${restaurant?.slug || 'restaurant'}-qr.png`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        });
    };

    const clearOverride = async () => {
        if (!isOwner()) {
            alert('רק בעל המסעדה יכול לבטל כפייה');
            return;
        }
        setSaving(true);
        try {
            await api.post('/admin/restaurant/override/clear', null, { headers: getAuthHeaders() });
            await fetchRestaurant();
            alert('כפייה בוטלה וחזרנו לאוטומטי');
        } catch (error) {
            console.error('Failed to clear override:', error);
            alert('לא הצלחנו לבטל כפייה. נסה שוב.');
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
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">משפט פתיחה בעמוד QR</label>
                                <textarea
                                    value={restaurant.share_incentive_text || ''}
                                    onChange={(e) => handleChange('share_incentive_text', e.target.value)}
                                    rows={3}
                                    placeholder="הרעב מתחיל כאן..."
                                    className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                />
                                <p className="text-xs text-gray-500 mt-1">אפשר להכניס שורות חדשות עם Enter</p>
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
                                disabled
                            />
                            <p className="text-xs text-gray-500 mt-1">עיר לא ניתנת לעריכה.</p>
                        </div>
                    </div>

                    <div className="border-t pt-4 space-y-3">
                        <h3 className="text-sm font-bold text-gray-700">⏱️ זמני הכנה (בדקות)</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">משלוח - זמן משוער</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="240"
                                    value={restaurant.delivery_time_minutes ?? ''}
                                    onChange={(e) => handleChange('delivery_time_minutes', e.target.value)}
                                    className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">משלוח - כוכבית</label>
                                <input
                                    type="text"
                                    value={restaurant.delivery_time_note || ''}
                                    onChange={(e) => handleChange('delivery_time_note', e.target.value)}
                                    placeholder="* יתכנו עיכובים"
                                    className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">איסוף עצמי - זמן משוער</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="240"
                                    value={restaurant.pickup_time_minutes ?? ''}
                                    onChange={(e) => handleChange('pickup_time_minutes', e.target.value)}
                                    className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">איסוף עצמי - כוכבית</label>
                                <input
                                    type="text"
                                    value={restaurant.pickup_time_note || ''}
                                    onChange={(e) => handleChange('pickup_time_note', e.target.value)}
                                    placeholder="* זמן הכנה עשוי להשתנות"
                                    className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                />
                            </div>
                        </div>
                    </div>

                    {/* ימי פתיחה + שעות לפי יום */}
                    <div className="border-t pt-4 space-y-4">
                        <h3 className="text-sm font-bold text-gray-700">📅 ימי פתיחה ושעות</h3>

                        {/* שעות ברירת מחדל */}
                        <div className="grid grid-cols-2 gap-4 sm:w-96 md:w-[28rem] items-start default-hours-row">
                            <div>
                                <label className="block text-sm text-gray-700 mb-1">שעת פתיחה (ברירת מחדל)</label>
                                <input
                                    type="time"
                                    value={restaurant.operating_hours?.default?.open || restaurant.operating_hours?.open || '09:00'}
                                    onChange={(e) => handleOperatingHoursChange('open', e.target.value)}
                                    className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary time-ltr"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-700 mb-1">שעת סגירה (ברירת מחדל)</label>
                                <input
                                    type="time"
                                    value={restaurant.operating_hours?.default?.close || restaurant.operating_hours?.close || '23:00'}
                                    onChange={(e) => handleOperatingHoursChange('close', e.target.value)}
                                    className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary time-ltr"
                                />
                            </div>
                        </div>

                        {/* שעות מותאמות לפי יום */}
                        <div className="space-y-2">
                            {DAYS_OF_WEEK.map((day) => {
                                const dayCfg = restaurant.operating_hours?.days?.[day] || {};
                                const isOpenDay = restaurant.operating_days?.[day] ?? false;
                                const panelOpen = openDayPanels[day] || false;
                                return (
                                    <div key={day} className="border rounded-xl p-3 bg-gray-50">
                                        <div className="flex items-center justify-between gap-2">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={isOpenDay}
                                                    onChange={(e) => handleOperatingDaysChange(day, e.target.checked)}
                                                    className="w-4 h-4 rounded"
                                                />
                                                <span className="text-sm text-gray-800" onClick={() => toggleDayPanel(day)}>
                                                    {day}
                                                </span>
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => toggleDayPanel(day)}
                                                className="text-xs text-brand-primary underline"
                                            >
                                                {panelOpen ? 'סגור שעות' : 'הגדר שעות'}
                                            </button>
                                        </div>
                                        {panelOpen && (
                                            <div className="mt-3 grid grid-cols-2 gap-3 sm:w-80">
                                                <div>
                                                    <label className="block text-xs text-gray-600 mb-1">פתיחה</label>
                                                    <input
                                                        type="time"
                                                        value={dayCfg.open || restaurant.operating_hours?.default?.open || '09:00'}
                                                        onChange={(e) => handleDayHoursChange(day, 'open', e.target.value)}
                                                        disabled={!isOpenDay}
                                                        className="w-full px-3 py-2 border rounded-lg text-sm time-ltr"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-600 mb-1">סגירה</label>
                                                    <input
                                                        type="time"
                                                        value={dayCfg.close || restaurant.operating_hours?.default?.close || '23:00'}
                                                        onChange={(e) => handleDayHoursChange(day, 'close', e.target.value)}
                                                        disabled={!isOpenDay}
                                                        className="w-full px-3 py-2 border rounded-lg text-sm time-ltr"
                                                    />
                                                </div>
                                                <label className="flex items-center gap-2 text-xs text-gray-600 col-span-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={!!dayCfg.closed || !isOpenDay}
                                                        onChange={(e) => handleDayHoursChange(day, 'closed', e.target.checked)}
                                                        className="w-4 h-4"
                                                    />
                                                    סגור ביום זה (גובר על שעות)
                                                </label>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
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
                                        disabled={!overrideStatus || !isApproved}
                                        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${restaurant.is_open
                                            ? 'bg-green-100 text-green-700'
                                            : 'bg-red-100 text-red-700'
                                            } ${(!overrideStatus || !isApproved) && 'opacity-70 cursor-not-allowed'}`}
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
                                    disabled={!isApproved}
                                    className="w-4 h-4 rounded"
                                />
                                <span className="text-sm text-gray-600">אפשר כפיית סטטוס ידנית</span>
                            </label>

                            {overrideStatus && (
                                <button
                                    type="button"
                                    onClick={clearOverride}
                                    disabled={saving || !isApproved}
                                    className="inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-60"
                                >
                                    בטל כפייה (חזור לאוטומטי)
                                </button>
                            )}

                            {!isApproved && (
                                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                                    פתיחה וסגירה ידנית תתאפשר רק לאחר אישור מנהל מערכת.
                                </p>
                            )}
                        </div>
                    </div>

                    {/* לינק ישיר לתפריט */}
                    <div className="border-t pt-4">
                        <h3 className="text-sm font-bold text-gray-700 mb-3">🔗 לינק ישיר לדף המסעדה</h3>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                readOnly
                                value={`${window.location.origin}/${restaurant.tenant_id}/menu`}
                                className="flex-1 px-4 py-3 border rounded-xl bg-gray-50 text-gray-600 text-sm"
                            />
                            <button
                                type="button"
                                onClick={() => {
                                    const link = `${window.location.origin}/${restaurant.tenant_id}/menu`;
                                    navigator.clipboard.writeText(link);
                                    alert('הלינק הועתק ללוח!');
                                }}
                                className="px-6 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 whitespace-nowrap"
                            >
                                📋 העתק
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            שתפו לינק זה עם לקוחות לגישה ישירה לדף המסעדה המלא (תמונה, פרטים ותפריט)
                        </p>
                    </div>

                    {/* עמוד שיתוף + QR */}
                    <div className="border-t pt-4">
                        <h3 className="text-sm font-bold text-gray-700 mb-3">🔗 עמוד שיתוף / QR</h3>
                        <div className="flex flex-col lg:flex-row gap-3 items-stretch">
                            <div className="flex-1">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        readOnly
                                        value={getShareLink()}
                                        className="flex-1 px-4 py-3 border rounded-xl bg-gray-50 text-gray-600 text-sm"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const link = getShareLink();
                                            if (!link) return;
                                            navigator.clipboard.writeText(link);
                                            alert('הלינק הועתק ללוח!');
                                        }}
                                        className="px-6 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-black whitespace-nowrap"
                                    >
                                        📋 העתק
                                    </button>
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const link = getShareLink();
                                            if (!link) return;
                                            window.open(link, '_blank', 'noopener,noreferrer');
                                        }}
                                        className="px-4 py-2 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600"
                                    >
                                        👁️ תצוגה מקדימה
                                    </button>
                                    <button
                                        type="button"
                                        onClick={downloadShareQrPng}
                                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200"
                                    >
                                        ⬇️ הורדת QR (PNG)
                                    </button>
                                </div>

                                <p className="text-xs text-gray-500 mt-2">
                                    זה העמוד שמתאים להדפסה/שיתוף בוואטסאפ. QR יוביל לעמוד הזה.
                                </p>
                            </div>

                            <div className="flex items-center justify-center p-3 border rounded-xl bg-white">
                                <QRCodeCanvas value={getShareLink()} size={120} includeMargin ref={shareQrRef} />
                            </div>
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
