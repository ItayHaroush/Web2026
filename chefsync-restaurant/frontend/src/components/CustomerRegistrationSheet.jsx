import React, { useState, useEffect, useCallback } from 'react';
import { useCustomer } from '../context/CustomerContext';
import { FcGoogle } from 'react-icons/fc';
import { FaLock, FaTimes } from 'react-icons/fa';

/**
 * Bottom Sheet להרשמת לקוח
 * מוצג אחרי הזמנה ראשונה / ביקור שלישי
 */
export default function CustomerRegistrationSheet({ isOpen, onClose }) {
    const { customer, loginWithGoogle, setPassword, isRegistered } = useCustomer();
    const [mode, setMode] = useState('main'); // 'main' | 'password'
    const [passwordValue, setPasswordValue] = useState('');
    const [passwordConfirm, setPasswordConfirm] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setMode('main');
            setPasswordValue('');
            setPasswordConfirm('');
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

    const handleSetPassword = useCallback(async () => {
        if (!passwordValue || passwordValue.length < 6) {
            setError('הסיסמה חייבת להכיל לפחות 6 תווים');
            return;
        }
        if (passwordValue !== passwordConfirm) {
            setError('הסיסמאות לא תואמות');
            return;
        }

        setSaving(true);
        setError('');
        const result = await setPassword(passwordValue, passwordConfirm);
        setSaving(false);

        if (result.success) {
            onClose();
        } else {
            setError(result.message || 'שגיאה בשמירת סיסמה');
        }
    }, [passwordValue, passwordConfirm, setPassword, onClose]);

    if (!isOpen || isRegistered) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />

            {/* Sheet */}
            <div className="relative w-full max-w-lg bg-white dark:bg-brand-dark-surface rounded-t-2xl shadow-2xl p-6 space-y-5 animate-slide-up z-10">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-black text-gray-900 dark:text-brand-dark-text">
                        {mode === 'main' ? 'שמור את ההזמנות שלך' : 'הגדרת סיסמה'}
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
                                onClick={() => setMode('password')}
                                className="w-full flex items-center justify-center gap-3 bg-brand-primary/10 border-2 border-brand-primary/30 rounded-xl px-4 py-3 font-bold text-brand-primary hover:bg-brand-primary/20 transition"
                            >
                                <FaLock size={18} />
                                <span>הגדר סיסמה</span>
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

                {mode === 'password' && (
                    <>
                        <p className="text-sm text-gray-600 dark:text-brand-dark-muted">
                            בחר סיסמה (לפחות 6 תווים) לכניסה מהירה בפעם הבאה
                        </p>

                        <div className="space-y-3">
                            <input
                                type="password"
                                value={passwordValue}
                                onChange={(e) => setPasswordValue(e.target.value)}
                                placeholder="סיסמה"
                                className="w-full border-2 border-gray-200 dark:border-brand-dark-border rounded-xl px-4 py-3 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none transition dark:bg-brand-dark-bg dark:text-brand-dark-text"
                                autoFocus
                            />
                            <input
                                type="password"
                                value={passwordConfirm}
                                onChange={(e) => setPasswordConfirm(e.target.value)}
                                placeholder="אימות סיסמה"
                                className="w-full border-2 border-gray-200 dark:border-brand-dark-border rounded-xl px-4 py-3 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none transition dark:bg-brand-dark-bg dark:text-brand-dark-text"
                            />

                            {error && (
                                <p className="text-sm text-red-600 text-center">{error}</p>
                            )}

                            <button
                                onClick={handleSetPassword}
                                disabled={saving || passwordValue.length < 6 || passwordValue !== passwordConfirm}
                                className="w-full bg-brand-primary text-white rounded-xl px-4 py-3 font-bold hover:bg-brand-secondary transition disabled:opacity-50"
                            >
                                {saving ? 'שומר...' : 'שמור סיסמה'}
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
