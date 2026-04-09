import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { useRestaurantStatus } from '../../context/RestaurantStatusContext';
import AdminLayout from '../../layouts/AdminLayout';
import api from '../../services/apiClient';
import { resolveAssetUrl } from '../../utils/assets';
import { QRCodeCanvas } from 'qrcode.react';
import {
    FaStore,
    FaClock,
    FaMapMarkerAlt,
    FaPhone,
    FaInfoCircle,
    FaCheckCircle,
    FaTimesCircle,
    FaSave,
    FaQrcode,
    FaShareAlt,
    FaCamera,
    FaClipboard,
    FaChevronDown,
    FaChevronUp,
    FaGlobe,
    FaLock,
    FaUndo,
    FaEye,
    FaPizzaSlice,
    FaHamburger,
    FaUtensils,
    FaConciergeBell,
    FaShieldAlt,
    FaChair,
    FaTrashAlt,
} from 'react-icons/fa';
import { GiKebabSpit, GiChefToque } from 'react-icons/gi';

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
    const navigate = useNavigate();
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
    const [resettingDineIn, setResettingDineIn] = useState(false);
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
                is_open_now: restaurant.is_open_now ?? restaurant.is_open,
                is_override: overrideStatus,
                is_approved: restaurant.is_approved ?? false,
            });
        }
    }, [restaurant?.is_open, restaurant?.is_open_now, restaurant?.is_approved, overrideStatus, setRestaurantStatus]);

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
                    // המרה מפורשת לבוליאן כדי להימנע מבעיות עם 0/1
                    is_open: Boolean(response.data.restaurant.is_open),
                    is_override_status: Boolean(response.data.restaurant.is_override_status),
                    is_approved: Boolean(response.data.restaurant.is_approved),
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
                    is_open_now: Boolean(response.data.restaurant.is_open_now ?? normalized.is_open),
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

            // שלח את דגל תמחור ישיבה
            formData.append('enable_dine_in_pricing', restaurant.enable_dine_in_pricing ? '1' : '0');
            formData.append('allow_future_orders', restaurant.allow_future_orders ? '1' : '0');

            // ✅ שלח את כל השדות בלי לדלג על ריקים
            const fieldsToSend = [
                'name',
                'description',
                'phone',
                'owner_contact_phone',
                'address',
                'restaurant_type',
                'cuisine_type',
                'share_incentive_text',
                'delivery_time_minutes',
                'delivery_time_note',
                'pickup_time_minutes',
                'pickup_time_note',
                'kosher_type',
                'kosher_certificate',
                'kosher_notes',
                'common_allergens',
                'allergen_notes',
                'delivery_minimum',
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
                setRestaurant({ ...normalized });
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

    const resetDineInAdjustments = async () => {
        if (!isOwner()) {
            alert('רק בעל המסעדה יכול לאפס התאמות');
            return;
        }
        if (!confirm('זה יאפס את כל התאמות המחיר לישיבה (בקטגוריות ובפריטים) ויכבה את הפיצ׳ר. להמשיך?')) {
            return;
        }
        setResettingDineIn(true);
        try {
            await api.post('/admin/restaurant/reset-dine-in-adjustments', null, { headers: getAuthHeaders() });
            setRestaurant(prev => ({ ...prev, enable_dine_in_pricing: false }));
            alert('כל ההתאמות אופסו בהצלחה');
        } catch (error) {
            console.error('Failed to reset dine-in adjustments:', error);
            alert('שגיאה באיפוס ההתאמות');
        } finally {
            setResettingDineIn(false);
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
                <div className="p-8 text-center text-gray-500 font-bold">לא נמצאו נתוני מסעדה</div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="max-w-5xl mx-auto space-y-6 pb-20 animate-in fade-in duration-500">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-4xl font-black text-gray-900 flex items-center gap-3">
                            <span className="p-3 bg-brand-primary/10 rounded-2xl text-brand-primary">
                                <FaStore size={32} />
                            </span>
                            פרטי מסעדה
                        </h1>
                        <p className="text-gray-500 mt-2 mr-16 font-medium">
                            ניהול הגדרות בסיסיות, שעות פעילות וסטטוס פתיחה
                        </p>
                    </div>
                </div>

                <form onSubmit={save} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column: Essential Info */}
                    <div className="lg:col-span-2 space-y-6">
                        <section className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 p-8 hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                                    <FaInfoCircle size={20} />
                                </div>
                                <h3 className="text-xl font-black text-gray-900">מידע בסיסי</h3>
                            </div>

                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-black text-gray-700 mr-1 flex items-center gap-2">
                                            שם המסעדה
                                        </label>
                                        <input
                                            type="text"
                                            value={restaurant.name || ''}
                                            onChange={(e) => handleChange('name', e.target.value)}
                                            required
                                            className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-brand-primary text-gray-900 font-bold transition-all"
                                            placeholder="שם המסעדה..."
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-black text-gray-700 mr-1 flex items-center gap-2">
                                            טלפון
                                        </label>
                                        <div className="relative">
                                            <FaPhone className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                            <input
                                                type="text"
                                                value={restaurant.phone || ''}
                                                onChange={(e) => handleChange('phone', e.target.value)}
                                                className="w-full pr-12 pl-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-brand-primary text-gray-900 font-bold transition-all ltr"
                                                placeholder="050-0000000"
                                            />
                                        </div>
                                    </div>
                                    <div className="md:col-span-2 space-y-2">
                                        <label className="text-sm font-black text-gray-700 mr-1">פלאפון בעלים לדוחות / וואטסאפ (אופציונלי)</label>
                                        <div className="relative">
                                            <FaPhone className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500" />
                                            <input
                                                type="text"
                                                value={restaurant.owner_contact_phone || ''}
                                                onChange={(e) => handleChange('owner_contact_phone', e.target.value)}
                                                className="w-full pr-12 pl-5 py-4 bg-emerald-50/40 border border-emerald-100 rounded-2xl focus:ring-2 focus:ring-emerald-500/30 text-gray-900 font-bold transition-all ltr"
                                                placeholder="נייד לקבלת דוחות — עדיפות על טלפון המסעדה"
                                            />
                                        </div>
                                        <p className="text-xs text-gray-500 leading-relaxed">
                                            אם ממולא, המערכת (כולל סופר־אדמין) תשתמש במספר זה לקישורי וואטסאפ לדוחות יומיים.
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-black text-gray-700 mr-1">תיאור המסעדה</label>
                                    <textarea
                                        value={restaurant.description || ''}
                                        onChange={(e) => handleChange('description', e.target.value)}
                                        rows={3}
                                        className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-brand-primary text-gray-900 font-bold transition-all resize-none"
                                        placeholder="ספר קצת על המסעדה שלך..."
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-black text-gray-700 mr-1">סוג מסעדה (לתוצאות AI)</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { value: 'pizza', label: 'פיצה', icon: FaPizzaSlice, color: 'text-orange-600' },
                                            { value: 'shawarma', label: 'שווארמה', icon: GiKebabSpit, color: 'text-amber-600' },
                                            { value: 'burger', label: 'המבורגר', icon: FaHamburger, color: 'text-red-600' },
                                            { value: 'bistro', label: 'ביסטרו', icon: GiChefToque, color: 'text-purple-600' },
                                            { value: 'catering', label: 'קייטרינג', icon: FaConciergeBell, color: 'text-blue-600' },
                                            { value: 'general', label: 'כללי', icon: FaUtensils, color: 'text-gray-600' },
                                        ].map(type => {
                                            const Icon = type.icon;
                                            return (
                                                <button
                                                    key={type.value}
                                                    type="button"
                                                    onClick={() => handleChange('restaurant_type', type.value)}
                                                    className={`p-3 rounded-xl border-2 transition-all ${(restaurant.restaurant_type || 'general') === type.value
                                                        ? 'border-brand-primary bg-brand-primary/10 shadow-md'
                                                        : 'border-gray-200 hover:border-brand-primary/50'
                                                        }`}
                                                >
                                                    <Icon className={`text-2xl mb-1 mx-auto ${type.color}`} />
                                                    <div className="text-xs font-medium text-gray-900">{type.label}</div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {(!restaurant.restaurant_type || restaurant.restaurant_type === 'general') && (
                                        <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800">
                                            💡 בחר סוג ספציפי לשיפור תיאורי AI
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-black text-gray-700 mr-1">תיאור סוג מטבח (טקסט חופשי)</label>
                                    <input
                                        type="text"
                                        value={restaurant.cuisine_type || ''}
                                        onChange={(e) => handleChange('cuisine_type', e.target.value)}
                                        className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-brand-primary text-gray-900 font-bold transition-all"
                                        placeholder="לדוגמה: מטבח יפני, מטבח תימני, ווגן..."
                                    />
                                    <p className="text-xs text-gray-500 mr-1">מוצג ליד שם המסעדה (אופציונלי)</p>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-black text-gray-700 mr-1">משפט פתיחה בעמוד QR</label>
                                    <textarea
                                        value={restaurant.share_incentive_text || ''}
                                        onChange={(e) => handleChange('share_incentive_text', e.target.value)}
                                        rows={2}
                                        placeholder="למשל: הרעב מתחיל כאן..."
                                        className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-brand-primary text-gray-900 font-bold transition-all resize-none"
                                    />
                                    <p className="text-xs text-gray-400 font-medium mr-1 select-none">אפשר להכניס שורות חדשות עם Enter</p>
                                </div>
                            </div>
                        </section>

                        {/* Location Details */}
                        <section className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 p-8 hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                                    <FaMapMarkerAlt size={20} />
                                </div>
                                <h3 className="text-xl font-black text-gray-900">מיקום וכתובת</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-black text-gray-700 mr-1">כתובת המסעדה</label>
                                    <input
                                        type="text"
                                        value={restaurant.address || ''}
                                        onChange={(e) => handleChange('address', e.target.value)}
                                        className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-brand-primary text-gray-900 font-bold transition-all"
                                        placeholder="למשל: הרצל 1, תל אביב"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-black text-gray-700 mr-1 opacity-60">עיר (לא ניתן לעריכה)</label>
                                    <input
                                        type="text"
                                        value={restaurant.city || ''}
                                        disabled
                                        className="w-full px-5 py-4 bg-gray-100 border-none rounded-2xl text-gray-500 font-bold cursor-not-allowed"
                                    />
                                </div>
                            </div>
                        </section>

                        {/* Prep Times Section */}
                        <section className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 p-8">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                                    <FaClock size={20} />
                                </div>
                                <h3 className="text-xl font-black text-gray-900">זמני הכנה (בדקות)</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4 p-5 bg-gray-50 rounded-3xl border border-gray-100">
                                    <h4 className="font-black text-gray-800 flex items-center gap-2">
                                        🚀 משלוחים
                                    </h4>
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-gray-500 mr-1">זמן משוער</label>
                                            <input
                                                type="number"
                                                min="1"
                                                max="240"
                                                value={restaurant.delivery_time_minutes ?? ''}
                                                onChange={(e) => handleChange('delivery_time_minutes', e.target.value)}
                                                className="w-full px-4 py-3 bg-white border-2 border-transparent focus:border-brand-primary rounded-xl focus:outline-none text-gray-900 font-black text-center text-xl"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-gray-500 mr-1">הערה (כוכבית)</label>
                                            <input
                                                type="text"
                                                value={restaurant.delivery_time_note || ''}
                                                onChange={(e) => handleChange('delivery_time_note', e.target.value)}
                                                placeholder="* יתכנו עיכובים בעומס"
                                                className="w-full px-4 py-3 bg-white border-none rounded-xl focus:ring-2 focus:ring-brand-primary text-gray-700 font-medium text-sm"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4 p-5 bg-gray-50 rounded-3xl border border-gray-100">
                                    <h4 className="font-black text-gray-800 flex items-center gap-2">
                                        🥡 איסוף עצמי
                                    </h4>
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-gray-500 mr-1">זמן משוער</label>
                                            <input
                                                type="number"
                                                min="1"
                                                max="240"
                                                value={restaurant.pickup_time_minutes ?? ''}
                                                onChange={(e) => handleChange('pickup_time_minutes', e.target.value)}
                                                className="w-full px-4 py-3 bg-white border-2 border-transparent focus:border-brand-primary rounded-xl focus:outline-none text-gray-900 font-black text-center text-xl"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-gray-500 mr-1">הערה (כוכבית)</label>
                                            <input
                                                type="text"
                                                value={restaurant.pickup_time_note || ''}
                                                onChange={(e) => handleChange('pickup_time_note', e.target.value)}
                                                placeholder="* זמן הכנה מהיר במיוחד"
                                                className="w-full px-4 py-3 bg-white border-none rounded-xl focus:ring-2 focus:ring-brand-primary text-gray-700 font-medium text-sm"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* הגדרות הזמנה נוספות */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
                                <div className="space-y-2 p-5 bg-gray-50 rounded-3xl border border-gray-100">
                                    <h4 className="font-black text-gray-800 flex items-center gap-2">
                                        💰 מינימום הזמנה למשלוח
                                    </h4>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl font-black text-gray-500">₪</span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="1"
                                            value={restaurant.delivery_minimum ?? 0}
                                            onChange={(e) => handleChange('delivery_minimum', e.target.value)}
                                            className="w-full px-4 py-3 bg-white border-2 border-transparent focus:border-brand-primary rounded-xl focus:outline-none text-gray-900 font-black text-center text-xl"
                                        />
                                    </div>
                                    <p className="text-xs text-gray-500">0 = ללא מינימום</p>
                                </div>

                                <div className="space-y-2 p-5 bg-gray-50 rounded-3xl border border-gray-100">
                                    <h4 className="font-black text-gray-800 flex items-center gap-2">
                                        🕐 הזמנות עתידיות
                                    </h4>
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={!!restaurant.allow_future_orders}
                                            onChange={(e) => handleChange('allow_future_orders', e.target.checked)}
                                            className="w-5 h-5 rounded accent-brand-primary"
                                        />
                                        <span className="font-bold text-gray-700">אפשר הזמנה מראש כשהמסעדה סגורה</span>
                                    </label>
                                    <p className="text-xs text-gray-500">לקוחות יוכלו להזמין מראש ולשלם באשראי גם כשהמסעדה סגורה</p>
                                </div>
                            </div>
                        </section>

                        <section className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 p-8">
                            <h3 className="text-xl font-black text-gray-900 mb-2">מסוף Z-Credit (קופה / קיוסק)</h3>
                            <p className="text-sm text-gray-500 mb-4">
                                הגדרת מספר מסוף, PinPad ומסופונים נפרדים לכל קופה או קיוסק — בדף{' '}
                                <strong className="text-gray-700">הגדרות תשלום</strong>.
                            </p>
                            <button
                                type="button"
                                onClick={() => navigate('/admin/payment-settings')}
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-black bg-violet-600 text-white hover:bg-violet-700 transition-colors"
                            >
                                פתח הגדרות תשלום ו-Z-Credit
                            </button>
                        </section>
                    </div>

                    {/* Right Column: Profile & Status */}
                    <div className="space-y-6">
                        {/* Status Card */}
                        <section className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 p-6 overflow-hidden relative">
                            <div className="relative z-10">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-2">
                                        <div className={`p-2 rounded-xl ${restaurant.is_open_now ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                                            <FaClock />
                                        </div>
                                        <h3 className="font-black text-gray-900">סטטוס פתיחה</h3>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-wider uppercase ${overrideStatus ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                                        }`}>
                                        {overrideStatus ? '🔒 כפוי ידנית' : '✨ חישוב אוטומטי'}
                                    </span>
                                </div>

                                {/* תגית חג פעיל */}
                                {restaurant.active_holiday_info && (
                                    <div className={`mb-4 p-3 rounded-2xl border flex items-center gap-3 ${restaurant.active_holiday_info.response_status === 'closed'
                                            ? 'bg-red-50 border-red-200'
                                            : restaurant.active_holiday_info.response_status === 'special_hours'
                                                ? 'bg-blue-50 border-blue-200'
                                                : restaurant.active_holiday_info.response_status === 'open'
                                                    ? 'bg-green-50 border-green-200'
                                                    : 'bg-purple-50 border-purple-200'
                                        }`}>
                                        <span className="text-2xl">🕎</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-black text-gray-900">
                                                {restaurant.active_holiday_info.holiday_name}
                                            </p>
                                            <p className="text-[11px] text-gray-500">
                                                {restaurant.active_holiday_info.hebrew_date_info}
                                                {' · '}
                                                <span className={`font-black ${restaurant.active_holiday_info.response_status === 'closed' ? 'text-red-600' :
                                                        restaurant.active_holiday_info.response_status === 'special_hours' ? 'text-blue-600' :
                                                            restaurant.active_holiday_info.response_status === 'open' ? 'text-green-600' :
                                                                'text-purple-600'
                                                    }`}>
                                                    {restaurant.active_holiday_info.response_label}
                                                    {restaurant.active_holiday_info.response_status === 'special_hours' &&
                                                        restaurant.active_holiday_info.open_time && restaurant.active_holiday_info.close_time &&
                                                        ` (${restaurant.active_holiday_info.open_time?.slice(0, 5)}–${restaurant.active_holiday_info.close_time?.slice(0, 5)})`
                                                    }
                                                </span>
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <div className="flex flex-col items-center gap-4 py-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (overrideStatus && isApproved) {
                                                const newVal = !restaurant.is_open;
                                                handleChange('is_open', newVal);
                                                // עדכן גם is_open_now מקומית כי במצב כפייה הם זהים
                                                handleChange('is_open_now', newVal);
                                            }
                                        }}
                                        disabled={!overrideStatus || !isApproved}
                                        className={`w-full py-8 rounded-[2rem] flex flex-col items-center justify-center gap-3 transition-all transform active:scale-95 ${(overrideStatus ? restaurant.is_open : restaurant.is_open_now)
                                            ? 'bg-green-500 text-white shadow-[0_10px_30px_-10px_rgba(34,197,94,0.5)] border-b-4 border-green-700'
                                            : 'bg-red-500 text-white shadow-[0_10px_30px_-10px_rgba(239,68,68,0.5)] border-b-4 border-red-700'
                                            } ${(!overrideStatus || !isApproved) && 'opacity-80 saturate-50 grayscale-[0.2]'}`}
                                    >
                                        <span className="text-4xl">
                                            {(overrideStatus ? restaurant.is_open : restaurant.is_open_now) ? <FaCheckCircle /> : <FaTimesCircle />}
                                        </span>
                                        <span className="text-2xl font-black">
                                            {(overrideStatus ? restaurant.is_open : restaurant.is_open_now) ? 'פתוח להזמנות' : 'סגור להזמנות'}
                                        </span>
                                    </button>

                                    {!isApproved && (
                                        <div className="w-full p-4 bg-amber-50 rounded-2xl border border-amber-100 animate-pulse">
                                            <p className="text-xs text-amber-800 font-black text-center flex items-center justify-center gap-2">
                                                <FaLock /> ממתין לאישור מנהל
                                            </p>
                                        </div>
                                    )}

                                    {isApproved && (
                                        <div className="w-full space-y-3">
                                            <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl cursor-pointer hover:bg-gray-100 transition-colors border border-transparent hover:border-gray-200 group">
                                                <div className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors ${overrideStatus ? 'bg-brand-primary' : 'bg-gray-300'}`}>
                                                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${overrideStatus ? '-translate-x-4' : 'translate-x-0'}`}></div>
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    className="hidden"
                                                    checked={overrideStatus}
                                                    onChange={(e) => {
                                                        setOverrideStatus(e.target.checked);
                                                        if (!e.target.checked) setRestaurant((prev) => ({ ...prev, is_open: calculatedStatus }));
                                                    }}
                                                />
                                                <span className="text-sm font-black text-gray-700 group-hover:text-gray-900">כפיית סטטוס ידנית</span>
                                            </label>

                                            {overrideStatus && (
                                                <button
                                                    type="button"
                                                    onClick={clearOverride}
                                                    className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl text-sm font-black transition-all"
                                                >
                                                    <FaUndo size={14} /> בטל כפייה
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </section>

                        {/* Logo Card */}
                        <section className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 p-6">
                            <h3 className="font-black text-gray-900 mb-6 flex items-center gap-2">
                                <FaCamera className="text-indigo-500" /> לוגו המסעדה
                            </h3>
                            <div className="flex flex-col items-center gap-6">
                                <div className="relative group">
                                    <div className="w-40 h-40 rounded-[2.5rem] overflow-hidden bg-gray-50 border-4 border-white shadow-xl flex items-center justify-center transition-transform hover:scale-105">
                                        {logoPreview ? (
                                            <img src={logoPreview} alt="logo" className="w-full h-full object-contain p-4" />
                                        ) : (
                                            <FaStore size={60} className="text-gray-200" />
                                        )}
                                    </div>
                                    <label className="absolute -bottom-2 -right-2 bg-brand-primary text-white p-3 rounded-2xl shadow-lg cursor-pointer hover:bg-brand-dark transition-all hover:scale-110">
                                        <FaCamera size={20} />
                                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleLogo(e.target.files[0])} />
                                    </label>
                                </div>
                                <p className="text-[10px] text-gray-400 font-bold text-center">מומלץ: תמונה ריבועית על רקע לבן/שקוף</p>
                            </div>
                        </section>

                        {/* Dine-In Pricing Toggle */}
                        <section className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 p-6">
                            <h3 className="font-black text-gray-900 mb-4 flex items-center gap-2">
                                <FaChair className="text-amber-500" /> תמחור ישיבה במקום
                            </h3>
                            <p className="text-xs text-gray-500 mb-4">
                                הפעלת תוספת מחיר אוטומטית להזמנות &quot;לשבת במקום&quot; בקיוסק
                            </p>

                            <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl cursor-pointer hover:bg-gray-100 transition-colors border border-transparent hover:border-gray-200 group">
                                <div className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors ${restaurant.enable_dine_in_pricing ? 'bg-amber-500' : 'bg-gray-300'}`}>
                                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${restaurant.enable_dine_in_pricing ? '-translate-x-4' : 'translate-x-0'}`}></div>
                                </div>
                                <input
                                    type="checkbox"
                                    className="hidden"
                                    checked={!!restaurant.enable_dine_in_pricing}
                                    onChange={(e) => handleChange('enable_dine_in_pricing', e.target.checked)}
                                />
                                <span className="text-sm font-black text-gray-700 group-hover:text-gray-900">
                                    {restaurant.enable_dine_in_pricing ? 'מופעל' : 'כבוי'}
                                </span>
                            </label>

                            {restaurant.enable_dine_in_pricing && (
                                <div className="mt-3 space-y-3">
                                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-xs text-amber-800">
                                        התאמות המחיר מוגדרות בניהול קטגוריות ופריטי תפריט
                                    </div>
                                    <button
                                        type="button"
                                        onClick={resetDineInAdjustments}
                                        disabled={resettingDineIn}
                                        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-red-50 hover:bg-red-100 text-red-600 rounded-2xl text-sm font-black transition-all disabled:opacity-50"
                                    >
                                        <FaTrashAlt size={12} />
                                        {resettingDineIn ? 'מאפס...' : 'איפוס כל ההתאמות'}
                                    </button>
                                </div>
                            )}
                        </section>
                    </div>

                    {/* Full Width Sections */}
                    <div className="lg:col-span-3 space-y-6">
                        {/* Operating Hours */}
                        <section className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 p-8">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                                        <FaGlobe size={20} />
                                    </div>
                                    <h3 className="text-xl font-black text-gray-900">ימי פתיחה ושעות פעילות</h3>
                                </div>
                            </div>

                            <div className="bg-gray-50 rounded-3xl p-6 mb-8 border border-gray-100">
                                <h4 className="font-black text-gray-800 mb-4 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-brand-primary"></span>
                                    שעות פתיחה קבועות (ברירת מחדל לכל הימים)
                                </h4>
                                <div className="grid grid-cols-2 gap-6 max-w-sm">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-gray-500 mr-2">פתיחה</label>
                                        <input
                                            type="time"
                                            dir="ltr"
                                            value={restaurant.operating_hours?.default?.open || restaurant.operating_hours?.open || '09:00'}
                                            onChange={(e) => handleOperatingHoursChange('open', e.target.value)}
                                            className="w-full px-5 py-3 bg-white border-none rounded-2xl text-gray-900 font-black text-center text-lg shadow-sm"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-gray-500 mr-2">סגירה</label>
                                        <input
                                            type="time"
                                            dir="ltr"
                                            value={restaurant.operating_hours?.default?.close || restaurant.operating_hours?.close || '23:00'}
                                            onChange={(e) => handleOperatingHoursChange('close', e.target.value)}
                                            className="w-full px-5 py-3 bg-white border-none rounded-2xl text-gray-900 font-black text-center text-lg shadow-sm"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                                {DAYS_OF_WEEK.map((day) => {
                                    const dayCfg = restaurant.operating_hours?.days?.[day] || {};
                                    const isOpenDay = restaurant.operating_days?.[day] ?? false;
                                    const panelOpen = openDayPanels[day] || false;
                                    return (
                                        <div
                                            key={day}
                                            className={`rounded-3xl border transition-all duration-300 ${isOpenDay
                                                ? 'bg-white border-brand-primary'
                                                : 'bg-gray-50 border-gray-100 opacity-60 grayscale-[0.5]'
                                                }`}
                                        >
                                            <div className="p-4 flex items-center justify-between gap-3">
                                                <label className="flex items-center gap-3 cursor-pointer select-none">
                                                    <div
                                                        className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors ${isOpenDay ? 'bg-brand-primary' : 'bg-gray-300'}`}
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            handleOperatingDaysChange(day, !isOpenDay);
                                                        }}
                                                    >
                                                        <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${isOpenDay ? '-translate-x-4' : 'translate-x-0'}`}></div>
                                                    </div>
                                                    <span className="text-lg font-black text-gray-800">{day}</span>
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleDayPanel(day)}
                                                    className={`p-2 rounded-xl transition-colors ${panelOpen ? 'bg-brand-primary text-white' : 'text-brand-primary hover:bg-brand-primary/10'}`}
                                                >
                                                    {panelOpen ? <FaChevronUp /> : <FaChevronDown />}
                                                </button>
                                            </div>

                                            {panelOpen && (
                                                <div className="px-4 pb-6 pt-2 space-y-4 border-t border-gray-50 border-dashed animate-in slide-in-from-top-2 duration-200">
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-black text-gray-400 mr-2">פתיחה</label>
                                                            <input
                                                                type="time"
                                                                dir="ltr"
                                                                value={dayCfg.open || restaurant.operating_hours?.default?.open || '09:00'}
                                                                onChange={(e) => handleDayHoursChange(day, 'open', e.target.value)}
                                                                disabled={!isOpenDay}
                                                                className="w-full px-2 py-2 bg-gray-50 border-none rounded-xl text-center font-black text-sm"
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-black text-gray-400 mr-2">סגירה</label>
                                                            <input
                                                                type="time"
                                                                dir="ltr"
                                                                value={dayCfg.close || restaurant.operating_hours?.default?.close || '23:00'}
                                                                onChange={(e) => handleDayHoursChange(day, 'close', e.target.value)}
                                                                disabled={!isOpenDay}
                                                                className="w-full px-2 py-2 bg-gray-50 border-none rounded-xl text-center font-black text-sm"
                                                            />
                                                        </div>
                                                    </div>
                                                    <label className="flex items-center gap-2 group cursor-pointer pt-2 border-t border-gray-50">
                                                        <input
                                                            type="checkbox"
                                                            checked={!!dayCfg.closed || !isOpenDay}
                                                            onChange={(e) => handleDayHoursChange(day, 'closed', e.target.checked)}
                                                            className="w-4 h-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                                                        />
                                                        <span className="text-xs font-black text-gray-500 group-hover:text-gray-700">סגור ביום זה</span>
                                                    </label>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </section>

                        {/* Kosher & Allergens Section */}
                        <section className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 p-8 space-y-8">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center">
                                    <FaShieldAlt className="text-gray-900" size={18} />
                                </div>
                                <h3 className="text-xl font-black text-gray-900">כשרות ואלרגנים</h3>
                            </div>

                            {/* Kosher Section */}
                            <div className="space-y-6">
                                <h4 className="text-lg font-black text-gray-800">כשרות</h4>

                                <div className="space-y-3">
                                    <label className="text-sm font-black text-gray-700 mr-1">סוג כשרות</label>
                                    <select
                                        value={restaurant.kosher_type || 'none'}
                                        onChange={(e) => setRestaurant({ ...restaurant, kosher_type: e.target.value })}
                                        className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl font-bold text-gray-700 focus:ring-2 focus:ring-brand-primary/20"
                                    >
                                        <option value="none">ללא כשרות</option>
                                        <option value="kosher">כשר</option>
                                        <option value="mehadrin">כשר למהדרין</option>
                                        <option value="badatz">בד"ץ</option>
                                    </select>
                                </div>

                                {restaurant.kosher_type && restaurant.kosher_type !== 'none' && (
                                    <>
                                        <div className="space-y-3">
                                            <label className="text-sm font-black text-gray-700 mr-1">גוף הכשרות / רבנות</label>
                                            <input
                                                type="text"
                                                value={restaurant.kosher_certificate || ''}
                                                onChange={(e) => setRestaurant({ ...restaurant, kosher_certificate: e.target.value })}
                                                placeholder="לדוגמה: רבנות ירושלים, בד&quot;ץ העדה החרדית"
                                                className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl font-bold text-gray-700 placeholder:text-gray-400 focus:ring-2 focus:ring-brand-primary/20"
                                            />
                                        </div>

                                        <div className="space-y-3">
                                            <label className="text-sm font-black text-gray-700 mr-1">הערות נוספות לגבי כשרות</label>
                                            <textarea
                                                value={restaurant.kosher_notes || ''}
                                                onChange={(e) => setRestaurant({ ...restaurant, kosher_notes: e.target.value })}
                                                placeholder="לדוגמה: פרווה, חלבי, בשרי, פת ישראל, בד&quot;ץ לפסח"
                                                rows={3}
                                                className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl font-bold text-gray-700 placeholder:text-gray-400 focus:ring-2 focus:ring-brand-primary/20 resize-none"
                                            />
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Allergens Section */}
                            <div className="space-y-6 pt-8 border-t border-gray-100">
                                <h4 className="text-lg font-black text-gray-800">אלרגנים נפוצים</h4>

                                <div className="space-y-3">
                                    <label className="text-sm font-black text-gray-700 mr-1">בחר אלרגנים נפוצים במסעדה</label>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        {[
                                            { value: 'gluten', label: 'גלוטן' },
                                            { value: 'dairy', label: 'חלב' },
                                            { value: 'eggs', label: 'ביצים' },
                                            { value: 'fish', label: 'דגים' },
                                            { value: 'shellfish', label: 'פירות ים' },
                                            { value: 'nuts', label: 'אגוזים' },
                                            { value: 'peanuts', label: 'בוטנים' },
                                            { value: 'soy', label: 'סויה' },
                                            { value: 'sesame', label: 'שומשום' },
                                        ].map((allergen) => {
                                            let allergens = [];
                                            const rawAllergens = restaurant.common_allergens;
                                            if (Array.isArray(rawAllergens)) {
                                                allergens = rawAllergens;
                                            } else if (typeof rawAllergens === 'string' && rawAllergens.trim()) {
                                                try {
                                                    const parsed = JSON.parse(rawAllergens);
                                                    allergens = Array.isArray(parsed) ? parsed : [];
                                                } catch {
                                                    allergens = rawAllergens.split(',').map((item) => item.trim()).filter(Boolean);
                                                }
                                            }
                                            const isChecked = allergens.includes(allergen.value);

                                            return (
                                                <label key={allergen.value} className={`flex items-center gap-2.5 p-3 rounded-xl cursor-pointer transition-all border ${isChecked ? 'bg-gray-900 border-gray-900' : 'bg-white border-gray-200 hover:border-gray-300'
                                                    }`}>
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={(e) => {
                                                            let updatedAllergens = [...allergens];
                                                            if (e.target.checked) {
                                                                updatedAllergens.push(allergen.value);
                                                            } else {
                                                                updatedAllergens = updatedAllergens.filter(a => a !== allergen.value);
                                                            }
                                                            setRestaurant({ ...restaurant, common_allergens: JSON.stringify(updatedAllergens) });
                                                        }}
                                                        className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                                                    />
                                                    <span className={`text-sm font-bold ${isChecked ? 'text-white' : 'text-gray-700'
                                                        }`}>{allergen.label}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-sm font-black text-gray-700 mr-1">הערות נוספות לגבי אלרגנים</label>
                                    <textarea
                                        value={restaurant.allergen_notes || ''}
                                        onChange={(e) => setRestaurant({ ...restaurant, allergen_notes: e.target.value })}
                                        placeholder="לדוגמה: ניתן להכין מנות ללא גלוטן בהזמנה מראש, השף רגיש לטיפול באלרגנים"
                                        rows={3}
                                        className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl font-bold text-gray-700 placeholder:text-gray-400 focus:ring-2 focus:ring-brand-primary/20 resize-none"
                                    />
                                </div>
                            </div>
                        </section>
                    </div>
                </form>

                {/* Floating Action Bar */}
                <div className="fixed bottom-8 left-4 sm:left-8 lg:left-1/2 lg:-translate-x-1/2 w-[calc(100%-2rem)] sm:w-auto lg:w-full lg:max-w-4xl z-30">
                    <div className="bg-white/80 backdrop-blur-xl border border-white/20 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.15)] rounded-[2rem] p-4 flex gap-4">
                        <button
                            type="button"
                            onClick={save}
                            disabled={saving}
                            className="flex-1 bg-brand-primary text-white py-4 rounded-2xl font-black text-lg hover:shadow-[0_10px_20px_-5px_rgba(var(--brand-primary-rgb),0.4)] hover:bg-brand-dark transition-all flex items-center justify-center gap-3 disabled:opacity-50 active:scale-95"
                        >
                            <FaSave />
                            {saving ? 'שומר שינויים...' : 'שמור הגדרות'}
                        </button>
                        <button
                            type="button"
                            onClick={fetchRestaurant}
                            className="px-8 py-4 bg-white border border-gray-100 text-gray-700 rounded-2xl font-black hover:bg-gray-50 transition-all active:scale-95"
                        >
                            רענן
                        </button>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}