import React, { useState, useEffect, useCallback } from 'react';
import { useCustomer } from '../context/CustomerContext';
import { FcGoogle } from 'react-icons/fc';
import { FaLock, FaTimes } from 'react-icons/fa';

/**
 * Bottom Sheet להרשמת לקוח
 * מוצג אחרי הזמנה ראשונה / ביקור שלישי
 */
export default function CustomerRegistrationSheet({ isOpen, onClose }) {
    const { customer, loginWithGoogle, setPin, isRegistered } = useCustomer();
    const [mode, setMode] = useState('main'); // 'main' | 'pin'
    const [pinValue, setPinValue] = useState('');
    const [pinConfirm, setPinConfirm] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setMode('main');
            setPinValue('');
            setPinConfirm('');
            setError('');
        }
    }, [isOpen]);

    const handleGoogleLogin = useCallback(async () => {
        if (window.google?.accounts?.id) {
            window.google.accounts.id.prompt(async (notification) => {
                if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                    setError('לא ניתן להתחבר עם Google כרגע');
                }
            });
            // Google callback is handled via the global initialize callback
            // which calls loginWithGoogle with the credential token
        } else {
            setError('Google Sign-In לא זמין');
        }
    }, []);

    const handleSetPin = useCallback(async () => {
        if (pinValue.length !== 4 || !/^\d{4}$/.test(pinValue)) {
            setError('קוד PIN חייב להכיל 4 ספרות');
            return;
        }
        if (pinValue !== pinConfirm) {
            setError('הקודים לא תואמים');
            return;
        }

        setSaving(true);
        setError('');
        const result = await setPin(pinValue);
        setSaving(false);

        if (result.success) {
            onClose();
        } else {
            setError(result.message || 'שגיאה בשמירת PIN');
        }
    }, [pinValue, pinConfirm, setPin, onClose]);

    if (!isOpen || isRegistered) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />

            {/* Sheet */}
            <div className="relative w-full max-w-lg bg-white dark:bg-brand-dark-surface rounded-t-2xl shadow-2xl p-6 space-y-5 animate-slide-up z-10">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-black text-gray-900 dark:text-brand-dark-text">
                        {mode === 'main' ? 'שמור את ההזמנות שלך' : 'הגדרת קוד PIN'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
                        <FaTimes size={20} />
                    </button>
                </div>

                {mode === 'main' && (
                    <>
                        <p className="text-sm text-gray-600 dark:text-brand-dark-muted">
                            בפעם הבאה לא תצטרך למלא פרטים מחדש
                        </p>

                        <div className="space-y-3">
                            <button
                                onClick={handleGoogleLogin}
                                className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition"
                            >
                                <FcGoogle size={22} />
                                <span>המשך עם Google</span>
                            </button>

                            <button
                                onClick={() => setMode('pin')}
                                className="w-full flex items-center justify-center gap-3 bg-brand-primary/10 border-2 border-brand-primary/30 rounded-xl px-4 py-3 font-bold text-brand-primary hover:bg-brand-primary/20 transition"
                            >
                                <FaLock size={18} />
                                <span>הגדר קוד PIN</span>
                            </button>
                        </div>

                        <button
                            onClick={onClose}
                            className="w-full text-center text-sm text-gray-400 hover:text-gray-600 transition py-2"
                        >
                            אולי אחר כך
                        </button>
                    </>
                )}

                {mode === 'pin' && (
                    <>
                        <p className="text-sm text-gray-600 dark:text-brand-dark-muted">
                            בחר 4 ספרות לכניסה מהירה בפעם הבאה
                        </p>

                        <div className="space-y-3">
                            <input
                                type="tel"
                                maxLength={4}
                                value={pinValue}
                                onChange={(e) => setPinValue(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                placeholder="קוד PIN"
                                className="w-full text-center text-2xl tracking-[0.5em] font-bold border-2 border-gray-200 dark:border-brand-dark-border rounded-xl px-4 py-3 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none transition dark:bg-brand-dark-bg dark:text-brand-dark-text"
                                autoFocus
                            />
                            <input
                                type="tel"
                                maxLength={4}
                                value={pinConfirm}
                                onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                placeholder="אימות קוד PIN"
                                className="w-full text-center text-2xl tracking-[0.5em] font-bold border-2 border-gray-200 dark:border-brand-dark-border rounded-xl px-4 py-3 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none transition dark:bg-brand-dark-bg dark:text-brand-dark-text"
                            />

                            {error && (
                                <p className="text-sm text-red-600 text-center">{error}</p>
                            )}

                            <button
                                onClick={handleSetPin}
                                disabled={saving || pinValue.length !== 4 || pinConfirm.length !== 4}
                                className="w-full bg-brand-primary text-white rounded-xl px-4 py-3 font-bold hover:bg-brand-secondary transition disabled:opacity-50"
                            >
                                {saving ? 'שומר...' : 'שמור PIN'}
                            </button>

                            <button
                                onClick={() => { setMode('main'); setError(''); }}
                                className="w-full text-center text-sm text-gray-400 hover:text-gray-600 transition py-1"
                            >
                                חזרה
                            </button>
                        </div>
                    </>
                )}

                {error && mode === 'main' && (
                    <p className="text-sm text-red-600 text-center">{error}</p>
                )}
            </div>
        </div>
    );
}
