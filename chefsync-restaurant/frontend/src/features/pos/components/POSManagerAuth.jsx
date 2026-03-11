import { useState } from 'react';
import { FaBackspace, FaLock, FaTimes } from 'react-icons/fa';
import posApi from '../api/posApi';

/**
 * Reusable manager PIN verification modal.
 * Props:
 *  - title: string — modal title
 *  - subtitle: string — description text
 *  - headers: object — auth headers
 *  - onVerified: () => void — called when PIN is correct
 *  - onClose: () => void — called to dismiss modal
 */
export default function POSManagerAuth({ title, subtitle, headers, onVerified, onClose }) {
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

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
            await posApi.verifyManagerPin(code, headers);
            onVerified();
        } catch (err) {
            setError(err.response?.data?.message || 'קוד מנהל שגוי');
            setPin('');
        } finally {
            setLoading(false);
        }
    };

    const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[400] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-slate-800 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-700 animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
                <div className="p-8">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-amber-500/20 rounded-xl">
                                <FaLock className="text-amber-400 text-xl" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-white">{title || 'אישור מנהל'}</h2>
                                {subtitle && <p className="text-slate-400 text-sm mt-0.5">{subtitle}</p>}
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-700">
                            <FaTimes size={16} />
                        </button>
                    </div>

                    {/* PIN dots */}
                    <div className="flex justify-center gap-5 mb-6">
                        {[0, 1, 2, 3].map((i) => (
                            <div
                                key={i}
                                className={`w-4 h-4 rounded-full transition-all duration-200 ${i < pin.length
                                        ? 'bg-amber-400 scale-125 shadow-lg shadow-amber-400/40'
                                        : 'bg-slate-700 border-2 border-slate-600'
                                    }`}
                            />
                        ))}
                    </div>

                    {error && (
                        <p className="text-red-400 text-center text-sm font-bold mb-4 animate-in fade-in duration-300">{error}</p>
                    )}

                    {loading && (
                        <div className="flex justify-center mb-4">
                            <div className="w-7 h-7 border-3 border-amber-400 border-t-transparent rounded-full animate-spin" />
                        </div>
                    )}

                    {/* Keypad */}
                    <div className="grid grid-cols-3 gap-3 max-w-[240px] mx-auto" dir="ltr">
                        {digits.map((d, idx) => {
                            if (d === '') return <div key={idx} />;
                            if (d === 'del') {
                                return (
                                    <button
                                        key={idx}
                                        onClick={handleDelete}
                                        className="h-16 rounded-2xl bg-slate-700/60 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-all active:scale-90"
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
                                    className="h-16 rounded-2xl bg-slate-700/80 hover:bg-slate-600 text-white text-2xl font-black transition-all active:scale-90 disabled:opacity-50 border border-slate-600/30"
                                >
                                    {d}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
