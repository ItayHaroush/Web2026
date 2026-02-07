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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-brand-dark-surface rounded-2xl shadow-2xl w-full max-w-lg mx-2 sm:mx-4 max-h-[95vh] overflow-y-auto animate-in zoom-in-95 duration-200">
                {/* כותרת */}
                <div className="bg-white dark:bg-brand-dark-surface border-b border-gray-100 dark:border-brand-dark-border rounded-t-2xl p-4 sm:p-6">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2 sm:gap-3">
                            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-50 dark:bg-brand-dark-bg rounded-full flex items-center justify-center">
                                <FaHome size={16} className="sm:w-5 sm:h-5 text-gray-900 dark:text-brand-primary" />
                            </div>
                            <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-brand-dark-text">פרטי משלוח</h3>
                        </div>
                        <button
                            onClick={handleClose}
                            type="button"
                            className="w-8 h-8 rounded-full bg-gray-50 dark:bg-brand-dark-bg hover:bg-gray-100 dark:hover:bg-brand-dark-border text-gray-500 dark:text-gray-400 flex items-center justify-center transition-colors text-xl"
                        >
                            ×
                        </button>
                    </div>
                </div>

                <div className="p-4 sm:p-6">
                    <div className="mb-4 p-2.5 sm:p-3 bg-gray-50 dark:bg-brand-dark-bg border-r-4 border-gray-900 dark:border-brand-primary rounded-lg">
                        <p className="text-sm text-gray-700 dark:text-gray-300 font-medium flex items-center gap-2">
                            <FaLightbulb className="text-gray-900 dark:text-brand-primary" /> נא למלא כתובת מלאה לצורך משלוח מדויק
                        </p>
                    </div>

                    <form onSubmit={handleSave} className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                שם רחוב <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={street}
                                onChange={(e) => setStreet(e.target.value)}
                                placeholder="לדוגמה: חביבה רייק"
                                className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary transition-all ${errors.street ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:border-gray-300 dark:bg-brand-dark-bg dark:border-brand-dark-border dark:text-brand-dark-text'
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
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                מספר בית/דירה <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={houseNumber}
                                onChange={(e) => setHouseNumber(e.target.value)}
                                placeholder="לדוגמה: 3 או 15א' או 10/5"
                                className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary transition-all ${errors.houseNumber ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:border-gray-300 dark:bg-brand-dark-bg dark:border-brand-dark-border dark:text-brand-dark-text'
                                    }`}
                                required
                            />
                            {errors.houseNumber && (
                                <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                                    <FaExclamationTriangle /> {errors.houseNumber}
                                </p>
                            )}
                            <p className="mt-1.5 text-xs text-gray-500 dark:text-brand-dark-muted">
                                ניתן להזין מספר בית, דירה, או שילוב (למשל: 10/5 לבניין/דירה)
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                עיר <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={city}
                                onChange={(e) => setCity(e.target.value)}
                                placeholder="לדוגמה: עפולה"
                                className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary transition-all ${errors.city ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:border-gray-300 dark:bg-brand-dark-bg dark:border-brand-dark-border dark:text-brand-dark-text'
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
                            <div className="p-4 bg-gray-50 dark:bg-brand-dark-bg border border-gray-200 dark:border-brand-dark-border rounded-xl">
                                <div className="flex items-start gap-2">
                                    <div className="w-6 h-6 bg-brand-primary rounded-full flex items-center justify-center mt-0.5">
                                        <FaCheck className="text-white text-xs" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-gray-500 dark:text-brand-dark-muted uppercase tracking-wide mb-1">כתובת מלאה</p>
                                        <p className="text-base font-bold text-gray-900 dark:text-brand-dark-text">
                                            {street} {houseNumber}, {city}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                הערות לשליח <span className="text-gray-400 dark:text-gray-500 text-xs">(אופציונלי)</span>
                            </label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={3}
                                className="w-full px-4 py-3 border-2 border-gray-200 hover:border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary transition-all dark:bg-brand-dark-bg dark:border-brand-dark-border dark:text-brand-dark-text"
                                placeholder="לדוגמה: דירה 4, קוד שער 1234, קומה 2"
                            />
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2">
                            <button
                                type="button"
                                onClick={handleClose}
                                className="w-full sm:flex-1 px-4 py-3 rounded-xl border-2 border-gray-300 dark:border-brand-dark-border text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-50 dark:hover:bg-brand-dark-border/50 transition-colors text-sm sm:text-base"
                            >
                                ביטול
                            </button>
                            <button
                                type="submit"
                                className="w-full sm:flex-1 px-4 py-3 rounded-xl bg-brand-primary text-white font-bold hover:bg-brand-secondary transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 text-sm sm:text-base"
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
