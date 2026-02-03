import React, { useState, useEffect } from 'react';
import { FaHome, FaLightbulb, FaCheck, FaExclamationTriangle, FaSave, FaComment } from 'react-icons/fa';

export default function DeliveryDetailsModal({ open, onClose, customerInfo, setCustomerInfo, onSaved, deliveryLocation }) {
    const [street, setStreet] = useState('');
    const [houseNumber, setHouseNumber] = useState('');
    const [city, setCity] = useState('');
    const [notes, setNotes] = useState('');
    const [errors, setErrors] = useState({});
    const [initialized, setInitialized] = useState(false);

    useEffect(() => {
        if (open && !initialized) {
            // ניסיון לפרק כתובת קיימת
            const existingAddress = customerInfo.delivery_address || '';
            if (existingAddress) {
                const parts = existingAddress.split(',').map(p => p.trim());
                if (parts.length >= 2) {
                    const streetPart = parts[0];
                    const streetMatch = streetPart.match(/^(.+?)\s+(\d+.*)$/);
                    if (streetMatch) {
                        setStreet(streetMatch[1]);
                        setHouseNumber(streetMatch[2]);
                    } else {
                        setStreet(streetPart);
                    }
                    setCity(parts[parts.length - 1]);
                } else {
                    setStreet(existingAddress);
                }
            } else if (deliveryLocation) {
                // אם אין כתובת קיימת אבל יש מיקום, נמלא ממנו
                setStreet(deliveryLocation.street || '');
                setCity(deliveryLocation.cityName || '');
                // אם יש fullAddress, ננסה לחלץ מספר בית
                if (deliveryLocation.fullAddress && deliveryLocation.street) {
                    const streetPart = deliveryLocation.fullAddress.split(',')[0]?.trim() || '';
                    const numberMatch = streetPart.replace(deliveryLocation.street, '').trim();
                    if (numberMatch) {
                        setHouseNumber(numberMatch);
                    }
                }
            }
            setNotes(customerInfo.delivery_notes || '');
            setInitialized(true);
        } else if (!open) {
            // איפוס כשהמודל נסגר
            setInitialized(false);
        }
    }, [open]);

    if (!open) return null;

    const handleClose = () => {
        // אם סוגרים ללא כתובת, חזור לאיסוף עצמי
        if (!customerInfo.delivery_address) {
            setCustomerInfo({
                ...customerInfo,
                delivery_method: 'pickup'
            });
        }
        setErrors({});
        onClose();
    };

    const validateAddress = () => {
        const newErrors = {};

        if (!street.trim()) {
            newErrors.street = 'חובה להזין שם רחוב';
        }

        if (!houseNumber.trim()) {
            newErrors.houseNumber = 'חובה להזין מספר בית / דירה';
        } else if (!/\d/.test(houseNumber)) {
            // בדיקה שיש לפחות ספרה אחת במספר הבית
            newErrors.houseNumber = 'צריך מספר בית / דירה (חייב להכיל מספר)';
        }

        if (!city.trim()) {
            newErrors.city = 'חובה להזין שם עיר';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = (e) => {
        e.preventDefault();

        if (!validateAddress()) {
            return;
        }

        const fullAddress = `${street.trim()} ${houseNumber.trim()}, ${city.trim()}`;

        setCustomerInfo({
            ...customerInfo,
            delivery_method: 'delivery',
            delivery_address: fullAddress,
            delivery_notes: notes.trim(),
        });

        if (onSaved) {
            onSaved({
                delivery_address: fullAddress,
                delivery_notes: notes.trim(),
            });
        }

        setErrors({});
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 animate-in zoom-in-95 duration-200">
                {/* כותרת עם גרדיאנט */}
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-t-2xl p-6">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center text-white">
                                <FaHome size={20} />
                            </div>
                            <h3 className="text-xl font-bold text-white">פרטי משלוח</h3>
                        </div>
                        <button
                            onClick={handleClose}
                            type="button"
                            className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors text-xl"
                        >
                            ×
                        </button>
                    </div>
                </div>

                <div className="p-6">
                    <div className="mb-4 p-3 bg-blue-50 border-r-4 border-blue-500 rounded-lg">
                        <p className="text-sm text-blue-800 font-medium flex items-center gap-2">
                            <FaLightbulb className="text-blue-600" /> נא למלא כתובת מלאה לצורך משלוח מדויק
                        </p>
                    </div>

                    <form onSubmit={handleSave} className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                שם רחוב <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={street}
                                onChange={(e) => setStreet(e.target.value)}
                                placeholder="לדוגמה: חביבה רייק"
                                className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${errors.street ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:border-gray-300'
                                    }`}
                                required
                            />
                            {errors.street && (
                                <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                                    <FaExclamationTriangle /> {errors.street}
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                מספר בית/דירה <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={houseNumber}
                                onChange={(e) => setHouseNumber(e.target.value)}
                                placeholder="לדוגמה: 3 או 15א' או 10/5"
                                className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${errors.houseNumber ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:border-gray-300'
                                    }`}
                                required
                            />
                            {errors.houseNumber && (
                                <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                                    <FaExclamationTriangle /> {errors.houseNumber}
                                </p>
                            )}
                            <p className="mt-1.5 text-xs text-gray-500">
                                ניתן להזין מספר בית, דירה, או שילוב (למשל: 10/5 לבניין/דירה)
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                עיר <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={city}
                                onChange={(e) => setCity(e.target.value)}
                                placeholder="לדוגמה: עפולה"
                                className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${errors.city ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:border-gray-300'
                                    }`}
                                required
                            />
                            {errors.city && (
                                <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                                    <FaExclamationTriangle /> {errors.city}
                                </p>
                            )}
                        </div>

                        {/* תצוגה מקדימה של הכתובת המלאה */}
                        {street && houseNumber && city && (
                            <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl">
                                <div className="flex items-start gap-2">
                                    <FaCheck className="text-green-600 text-xl mt-1" />
                                    <div>
                                        <p className="text-xs font-bold text-green-700 uppercase tracking-wide mb-1">כתובת מלאה</p>
                                        <p className="text-base font-bold text-gray-900">
                                            {street} {houseNumber}, {city}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                הערות לשליח <span className="text-gray-400 text-xs">(אופציונלי)</span>
                            </label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={3}
                                className="w-full px-4 py-3 border-2 border-gray-200 hover:border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                placeholder="לדוגמה: דירה 4, קוד שער 1234, קומה 2"
                            />
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={handleClose}
                                className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-300 text-gray-700 font-bold hover:bg-gray-50 transition-colors"
                            >
                                ביטול
                            </button>
                            <button
                                type="submit"
                                className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                            >
                                <FaSave /> שמירה
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
