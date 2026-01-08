import React, { useState, useRef } from 'react';
import { requestPhoneCode, verifyPhoneCode } from '../services/phoneAuthService';

export default function PhoneVerificationModal({ phone, onVerified, onClose }) {
  const [step, setStep] = useState('input'); // input | sent | verifying | verified
  const [inputPhone, setInputPhone] = useState(phone || '');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [timer, setTimer] = useState(0);
  const [resendDisabled, setResendDisabled] = useState(false);
  const timerRef = useRef();

  // שליחת קוד
  const handleSend = async () => {
    setError('');
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
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-xs">
        <button className="absolute top-2 left-2 text-gray-400" onClick={onClose}>✕</button>
        <h2 className="text-lg font-bold mb-2 text-center">אימות טלפון</h2>
        {step === 'input' && (
          <>
            <input
              className="w-full border rounded px-3 py-2 mb-3 text-right"
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
              className="w-full border rounded px-3 py-2 mb-3 text-center tracking-widest text-lg"
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
