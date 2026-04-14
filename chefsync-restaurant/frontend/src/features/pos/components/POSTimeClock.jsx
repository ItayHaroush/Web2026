import { useState, useEffect, useRef, useCallback } from 'react';
import { FaClock, FaBackspace, FaCheckCircle, FaSignInAlt, FaSignOutAlt, FaTimes, FaPrint, FaUsers } from 'react-icons/fa';
import posApi from '../api/posApi';
import { useAdminAuth } from '../../../context/AdminAuthContext';

function formatMinutes(minutes) {
    if (!minutes && minutes !== 0) return '—';
    if (minutes < 60) return `${minutes} דקות`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (m === 0) return `${h} שעות`;
    return `${h} שעות ${m} דק׳`;
}

export default function POSTimeClock({ headers, posToken }) {
    const { getAuthHeaders } = useAdminAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [pin, setPin] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [clockedIn, setClockedIn] = useState([]);
    const [clockedInLoading, setClockedInLoading] = useState(false);
    const timerRef = useRef(null);

    const resetState = useCallback(() => {
        setPin('');
        setResult(null);
        setError('');
        setLoading(false);
    }, []);

    const handleClose = useCallback(() => {
        setIsOpen(false);
        resetState();
        if (timerRef.current) clearTimeout(timerRef.current);
    }, [resetState]);

    const fetchClockedIn = useCallback(async () => {
        setClockedInLoading(true);
        try {
            const res = await posApi.getClockedIn(headers || getAuthHeaders(), posToken);
            if (res.data.success) setClockedIn(res.data.employees || []);
        } catch (e) {
            console.error('Failed to fetch clocked-in:', e);
        } finally {
            setClockedInLoading(false);
        }
    }, [headers, posToken, getAuthHeaders]);

    useEffect(() => {
        if (isOpen) fetchClockedIn();
    }, [isOpen, fetchClockedIn]);

    const handleDigit = (d) => {
        if (pin.length >= 4 || loading || result) return;
        setError('');
        const newPin = pin + d;
        setPin(newPin);
        if (newPin.length === 4) submitPin(newPin);
    };

    const handleDelete = () => {
        if (loading || result) return;
        setPin((p) => p.slice(0, -1));
        setError('');
    };

    const submitPin = async (code) => {
        setLoading(true);
        setError('');
        try {
            const res = await posApi.clock(code, getAuthHeaders());
            if (res.data.success) {
                setResult(res.data);
                fetchClockedIn();
            } else {
                setError(res.data.message || 'שגיאה');
                setPin('');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'קוד PIN שגוי');
            setPin('');
        } finally {
            setLoading(false);
        }
    };

    const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

    return (
        <>
            <button
                onClick={() => { resetState(); setIsOpen(true); }}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-700/80 hover:bg-slate-600 text-slate-200 rounded-2xl text-sm font-bold transition-all active:scale-95 border border-slate-600/50"
            >
                <FaClock className="text-amber-400" />
                <span className="hidden sm:inline">שעון נוכחות</span>
                {clockedIn.length > 0 && (
                    <span className="bg-emerald-500 text-white text-xs font-black rounded-full w-5 h-5 flex items-center justify-center">
                        {clockedIn.length}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={handleClose}>
                    <div
                        className="bg-slate-800 rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-700 animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-8 pt-8 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-amber-500/20 rounded-xl">
                                    <FaClock className="text-amber-400 text-xl" />
                                </div>
                                <h2 className="text-2xl font-black text-white">שעון נוכחות</h2>
                            </div>
                            <button onClick={handleClose} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-700 transition-all">
                                <FaTimes size={18} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            {result ? (
                                <div className="px-8 pb-6 pt-4 text-center space-y-5 animate-in fade-in zoom-in-95 duration-500">
                                    <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center ${result.action === 'clock_in' ? 'bg-emerald-500/20' : 'bg-blue-500/20'}`}>
                                        {result.action === 'clock_in'
                                            ? <FaSignInAlt className="text-emerald-400 text-3xl" />
                                            : <FaSignOutAlt className="text-blue-400 text-3xl" />
                                        }
                                    </div>
                                    <div>
                                        <p className="text-2xl font-black text-white">{result.employee}</p>
                                        <p className={`text-lg font-bold mt-1 ${result.action === 'clock_in' ? 'text-emerald-400' : 'text-blue-400'}`}>
                                            {result.action === 'clock_in' ? 'כניסה' : 'יציאה'} — {result.time}
                                        </p>
                                    </div>

                                    {result.action === 'clock_out' && (
                                        <div className="bg-slate-900/60 rounded-2xl p-4 space-y-2 text-sm text-right">
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">משמרת</span>
                                                <span className="text-white font-bold">{result.clock_in_time} — {result.clock_out_time}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">זמן עבודה</span>
                                                <span className="text-white font-bold">{formatMinutes(result.raw_minutes)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">מעוגל (15 דק׳)</span>
                                                <span className="text-white font-bold">{formatMinutes(result.rounded_minutes)} ({result.total_hours} שעות)</span>
                                            </div>
                                            {result.total_pay != null && (
                                                <div className="flex justify-between border-t border-slate-700 pt-2 mt-2">
                                                    <span className="text-emerald-400 font-bold">לתשלום</span>
                                                    <span className="text-emerald-400 font-black text-lg">₪{result.total_pay}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex gap-3">
                                        <button
                                            onClick={handleClose}
                                            className="flex-1 py-3 bg-slate-700 text-white font-black rounded-2xl active:scale-95 transition-all hover:bg-slate-600 text-sm"
                                        >
                                            סגור
                                        </button>
                                    </div>

                                    {result.print_jobs > 0 && (
                                        <p className="text-emerald-400 text-xs text-center font-bold mt-2">
                                            <FaPrint className="inline ml-1" />
                                            נשלח למדפסת ({result.print_jobs} {result.print_jobs === 1 ? 'הדפסה' : 'הדפסות'})
                                        </p>
                                    )}
                                    {result.print_jobs === 0 && (
                                        <p className="text-amber-400/70 text-xs text-center mt-2">
                                            לא נמצאה מדפסת קופה פעילה
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <div className="px-8 pb-6 pt-2">
                                    <div className="flex justify-center gap-4 mb-5">
                                        {[0, 1, 2, 3].map((i) => (
                                            <div
                                                key={i}
                                                className={`w-5 h-5 rounded-full transition-all duration-200 ${
                                                    i < pin.length
                                                        ? 'bg-amber-400 scale-110 shadow-lg shadow-amber-400/30'
                                                        : 'bg-slate-600 border-2 border-slate-500'
                                                }`}
                                            />
                                        ))}
                                    </div>

                                    {error && (
                                        <p className="text-red-400 text-center text-sm font-bold mb-3 animate-in fade-in duration-300">{error}</p>
                                    )}

                                    {loading && (
                                        <div className="flex justify-center mb-3">
                                            <div className="w-8 h-8 border-3 border-amber-400 border-t-transparent rounded-full animate-spin" />
                                        </div>
                                    )}

                                    <div className="grid grid-cols-3 gap-3" dir="ltr">
                                        {digits.map((d, idx) => {
                                            if (d === '') return <div key={idx} />;
                                            if (d === 'del') {
                                                return (
                                                    <button
                                                        key={idx}
                                                        onClick={handleDelete}
                                                        className="h-14 rounded-2xl bg-slate-700/50 hover:bg-slate-600 text-slate-300 flex items-center justify-center transition-all active:scale-90"
                                                    >
                                                        <FaBackspace size={20} />
                                                    </button>
                                                );
                                            }
                                            return (
                                                <button
                                                    key={idx}
                                                    onClick={() => handleDigit(d)}
                                                    disabled={loading}
                                                    className="h-14 rounded-2xl bg-slate-700/80 hover:bg-slate-600 text-white text-2xl font-black transition-all active:scale-90 disabled:opacity-50 border border-slate-600/30"
                                                >
                                                    {d}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <p className="text-center text-slate-500 text-xs font-semibold mt-4">
                                        הקלד קוד PIN בן 4 ספרות לכניסה / יציאה
                                    </p>
                                </div>
                            )}

                            {/* Clocked-in employees list */}
                            {clockedIn.length > 0 && !result && (
                                <div className="px-8 pb-6">
                                    <div className="bg-slate-900/60 rounded-2xl border border-slate-700 overflow-hidden">
                                        <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-2">
                                            <FaUsers className="text-emerald-400 text-sm" />
                                            <span className="text-slate-300 text-sm font-black">
                                                עובדים במשמרת ({clockedIn.length})
                                            </span>
                                        </div>
                                        <div className="divide-y divide-slate-700/50 max-h-40 overflow-y-auto">
                                            {clockedIn.map((emp) => (
                                                <div key={emp.id} className="flex items-center justify-between px-4 py-2.5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                                        <span className="text-white text-sm font-bold">{emp.employee_name}</span>
                                                        <span className="text-slate-600 text-xs">
                                                            {emp.role === 'owner' ? 'בעלים' : emp.role === 'manager' ? 'מנהל' : 'עובד'}
                                                        </span>
                                                    </div>
                                                    <div className="text-left">
                                                        <span className="text-slate-400 text-xs font-semibold">
                                                            מ-{emp.clock_in} ({formatMinutes(emp.minutes_active)})
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="px-4 py-2 bg-slate-900/40">
                                            <p className="text-slate-600 text-xs text-center">הקלד PIN כדי לצאת מהמשמרת</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {clockedInLoading && clockedIn.length === 0 && !result && (
                                <div className="px-8 pb-6 text-center">
                                    <div className="w-6 h-6 border-2 border-slate-600 border-t-amber-400 rounded-full animate-spin mx-auto" />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
