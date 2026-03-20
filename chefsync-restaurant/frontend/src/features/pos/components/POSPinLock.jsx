import { useState, useEffect } from 'react';
import { FaBackspace, FaLock, FaCashRegister, FaArrowRight } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import posApi from '../api/posApi';

export default function POSPinLock({ onUnlock, isRelock, headers }) {
    const navigate = useNavigate();
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [bypassHours, setBypassHours] = useState(0); // 0 = no bypass
    const [paymentTerminals, setPaymentTerminals] = useState([]);
    const [paymentTerminalId, setPaymentTerminalId] = useState('');

    useEffect(() => {
        if (!headers?.Authorization || isRelock) return;
        let cancelled = false;
        (async () => {
            try {
                const res = await posApi.getPaymentTerminals(headers);
                if (!cancelled && res.data?.success && Array.isArray(res.data.terminals)) {
                    setPaymentTerminals(res.data.terminals);
                }
            } catch {
                /* ignore */
            }
        })();
        return () => { cancelled = true; };
    }, [headers, isRelock]);

    const handleDigit = (d) => {
        if (pin.length >= 4 || loading) return;
        setError('');
        const newPin = pin + d;
        setPin(newPin);
        if (newPin.length === 4) submit(newPin);
    };

    const handleDelete = () => {
        if (loading) return;
        setPin(p => p.slice(0, -1));
        setError('');
    };

    const submit = async (code) => {
        setLoading(true);
        try {
            if (isRelock) {
                await onUnlock(code);
            } else {
                const tid = paymentTerminalId === '' ? null : Number(paymentTerminalId);
                await onUnlock(code, bypassHours, tid);
            }
        } catch (err) {
            const status = err?.response?.status;
            let msg = 'קוד PIN שגוי';

            if (err?.response?.data?.message) {
                msg = err.response.data.message;
            } else if (status === 422 || status === 401) {
                msg = 'קוד PIN שגוי';
            } else if (status === 404) {
                msg = 'המסעדה לא נמצאה — נסה להתחבר מחדש';
            } else if (status >= 500) {
                msg = 'שגיאת שרת — נסה שוב';
            } else if (!err?.response) {
                msg = 'אין חיבור לשרת';
            }

            setError(msg);
            setPin('');
        } finally {
            setLoading(false);
        }
    };

    const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

    return (
        <div className="fixed inset-0 bg-[#0f172a] flex items-center justify-center z-[500]">
            <div className="w-full max-w-md px-8">
                {/* Back button */}
                <div className="flex justify-center mb-6">
                    <button
                        onClick={() => navigate('/admin/dashboard')}
                        className="flex items-center gap-2 px-5 py-2.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-xl transition-all text-sm font-bold"
                    >
                        <FaArrowRight />
                        חזרה לפאנל ניהול
                    </button>
                </div>

                {/* Logo area */}
                <div className="text-center mb-10">
                    <div className="w-24 h-24 mx-auto bg-gradient-to-br from-orange-500 to-amber-500 rounded-3xl flex items-center justify-center shadow-2xl shadow-orange-500/30 mb-6">
                        <FaCashRegister className="text-white text-4xl" />
                    </div>
                    <h1 className="text-4xl font-black text-white tracking-tight">POS Lite</h1>
                    <p className="text-slate-400 font-semibold mt-2">
                        {isRelock ? 'המסך ננעל — הקלד PIN' : 'הקלד קוד PIN לכניסה'}
                    </p>
                </div>

                {!isRelock && paymentTerminals.length > 0 && (
                    <div className="mb-6 max-w-xs mx-auto">
                        <label className="block text-xs font-bold text-slate-500 mb-2 text-center">מסופון תשלומים (Z-Credit)</label>
                        <select
                            value={paymentTerminalId}
                            onChange={(e) => setPaymentTerminalId(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 text-white font-bold text-sm"
                        >
                            <option value="">ברירת מחדל (מסעדה / מערכת)</option>
                            {paymentTerminals.map((t) => (
                                <option key={t.id} value={String(t.id)}>{t.name}</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* PIN dots */}
                <div className="flex justify-center gap-5 mb-8">
                    {[0, 1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className={`w-5 h-5 rounded-full transition-all duration-200 ${i < pin.length
                                    ? 'bg-orange-400 scale-125 shadow-lg shadow-orange-400/40'
                                    : 'bg-slate-700 border-2 border-slate-600'
                                }`}
                        />
                    ))}
                </div>

                {error && (
                    <p className="text-red-400 text-center text-sm font-bold mb-6 animate-in fade-in duration-300">{error}</p>
                )}

                {loading && (
                    <div className="flex justify-center mb-6">
                        <div className="w-8 h-8 border-3 border-orange-400 border-t-transparent rounded-full animate-spin" />
                    </div>
                )}

                {/* Keypad */}
                <div className="grid grid-cols-3 gap-4 max-w-xs mx-auto" dir="ltr">
                    {digits.map((d, idx) => {
                        if (d === '') return <div key={idx} />;
                        if (d === 'del') {
                            return (
                                <button
                                    key={idx}
                                    onClick={handleDelete}
                                    className="h-20 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-all active:scale-90 border border-slate-700/50"
                                >
                                    <FaBackspace size={24} />
                                </button>
                            );
                        }
                        return (
                            <button
                                key={idx}
                                onClick={() => handleDigit(d)}
                                disabled={loading}
                                className="h-20 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-white text-3xl font-black transition-all active:scale-90 disabled:opacity-50 border border-slate-700/50"
                            >
                                {d}
                            </button>
                        );
                    })}
                </div>

                {/* Bypass option — only on initial login, not relock */}
                {!isRelock && (
                    <div className="mt-6 flex justify-center">
                        <label className="flex items-center gap-3 cursor-pointer select-none">
                            <div
                                onClick={() => setBypassHours(bypassHours > 0 ? 0 : 4)}
                                className={`w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center ${bypassHours > 0
                                        ? 'bg-orange-500 border-orange-500'
                                        : 'border-slate-600 hover:border-slate-500'
                                    }`}
                            >
                                {bypassHours > 0 && (
                                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                            </div>
                            <span className="text-slate-400 text-sm font-semibold">
                                זכור אותי ל-4 שעות
                            </span>
                        </label>
                    </div>
                )}
            </div>
        </div>
    );
}
