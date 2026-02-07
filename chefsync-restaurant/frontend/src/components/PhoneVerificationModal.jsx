import React, { useState, useRef, useEffect } from 'react';
import { requestPhoneCode, verifyPhoneCode } from '../services/phoneAuthService';
import { isValidIsraeliMobile } from '../utils/phone';

export default function PhoneVerificationModal({ phone, onVerified, onClose, isPreviewMode = false }) {
    const [step, setStep] = useState('input'); // input | sent | verifying | verified
    const [inputPhone, setInputPhone] = useState(phone || '');
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [timer, setTimer] = useState(0);
    const [resendDisabled, setResendDisabled] = useState(false);
    const timerRef = useRef();

    // במצב preview - דלג אוטומטית על האימות
    useEffect(() => {
        if (isPreviewMode && inputPhone) {
            // המתן רגע קטן כדי שהמשתמש יראה את ה-modal
            const timeout = setTimeout(() => {
                onVerified(inputPhone);
            }, 1500);
            return () => clearTimeout(timeout);
        }
    }, [isPreviewMode, inputPhone, onVerified]);

    // במצב preview - הצג modal מיוחד
    if (isPreviewMode) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white dark:bg-brand-dark-surface rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
                    <button
                        onClick={onClose}
                        className="absolute top-4 left-4 text-gray-400 hover:text-gray-600 text-2xl font-bold"
                    >
                        ×
                    </button>

                    <div className="text-center">
                        <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>

                        <h3 className="text-xl font-bold text-gray-900 dark:text-brand-dark-text mb-2">מצב תצוגה מקדימה</h3>
                        <p className="text-gray-600 mb-4">
                            במצב תצוגה מקדימה, אימות טלפון מדולג אוטומטית
                        </p>
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                            <p className="text-sm text-purple-700 font-semibold">
                                מספר טלפון: {inputPhone || phone}
                            </p>
                            <p className="text-xs text-purple-600 mt-1">
                                ✓ אושר אוטומטית (לא נשלח SMS אמיתי)
                            </p>
                        </div>

                        <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                            <span>ממשיך לשלב הבא...</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // שליחת קוד
    const handleSend = async () => {
        setError('');
        if (!isValidIsraeliMobile(inputPhone)) {
            setError('מספר טלפון לא תקין (נייד ישראלי בלבד)');
            return;
        }
        try {
            await requestPhoneCode(inputPhone);
            setStep('sent');
            setResendDisabled(true);
            setTimer(60);
            timerRef.current = setInterval(() => {
                setTimer(t => {
                    if (t <= 1) {
                        clearInterval(timerRef.current);
                        setResendDisabled(false);
                        return 0;
                    }
                    return t - 1;
                });
            }, 1000);
        } catch (e) {
            setError(e?.response?.data?.message || 'שגיאה בשליחת קוד');
        }
    };

    // אימות קוד
    const handleVerify = async () => {
        setError('');
        setStep('verifying');
        try {
            const res = await verifyPhoneCode(inputPhone, code);
            if (res.verified) {
                setStep('verified');
                onVerified(inputPhone);
            } else {
                setError('קוד שגוי');
                setStep('sent');
            }
        } catch (e) {
            setError(e?.response?.data?.message || 'שגיאה באימות');
            setStep('sent');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-brand-dark-surface rounded-2xl shadow-xl p-4 sm:p-6 w-full max-w-xs mx-4">
                <button className="absolute top-2 left-2 text-gray-400 relative" onClick={onClose}>✕</button>
                <h2 className="text-base sm:text-lg font-bold mb-2 text-center dark:text-brand-dark-text">אימות טלפון</h2>
                {step === 'input' && (
                    <>
                        <input
                            className="w-full border dark:bg-brand-dark-bg dark:border-brand-dark-border dark:text-brand-dark-text rounded px-3 py-2 mb-3 text-right"
                            placeholder="מספר טלפון"
                            value={inputPhone}
                            onChange={e => setInputPhone(e.target.value)}
                            dir="ltr"
                        />
                        <button className="w-full bg-brand-primary text-white rounded py-2 font-bold" onClick={handleSend}>
                            שלח קוד אימות
                        </button>
                    </>
                )}
                {step === 'sent' && (
                    <>
                        <div className="mb-2 text-center">הוזן קוד ל־SMS</div>
                        <input
                            className="w-full border dark:bg-brand-dark-bg dark:border-brand-dark-border dark:text-brand-dark-text rounded px-3 py-2 mb-3 text-center tracking-widest text-lg"
                            placeholder="הזן קוד"
                            value={code}
                            onChange={e => setCode(e.target.value)}
                            maxLength={6}
                            dir="ltr"
                            inputMode="numeric"
                        />
                        <button className="w-full bg-brand-primary text-white rounded py-2 font-bold mb-2" onClick={handleVerify}>
                            אמת קוד
                        </button>
                        <button className="w-full text-brand-primary underline text-sm" onClick={handleSend} disabled={resendDisabled}>
                            {resendDisabled ? `שלח שוב בעוד ${timer} שניות` : 'שלח שוב קוד'}
                        </button>
                    </>
                )}
                {step === 'verifying' && (
                    <div className="text-center py-6">מאמת...</div>
                )}
                {step === 'verified' && (
                    <div className="text-center py-6 text-green-600 font-bold">הטלפון אומת בהצלחה!</div>
                )}
                {error && <div className="text-red-500 text-sm mt-2 text-center">{error}</div>}
            </div>
        </div>
    );
}
