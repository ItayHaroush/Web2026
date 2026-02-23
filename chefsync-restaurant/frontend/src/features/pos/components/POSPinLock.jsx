import { useState } from 'react';
import { FaBackspace, FaLock, FaCashRegister, FaArrowRight } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

export default function POSPinLock({ onUnlock, isRelock }) {
    const navigate = useNavigate();
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
            await onUnlock(code);
        } catch (err) {
            // #region agent log
            const _dbgPin = {status:err?.response?.status,msg:err?.response?.data?.message,hasResponse:!!err?.response,errMsg:err?.message};
            console.warn('[DEBUG-3267aa] POSPinLock caught error locally', _dbgPin);
            fetch('http://127.0.0.1:7242/ingest/e2a84354-28c6-4376-be2a-efdcd59b5972',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'3267aa'},body:JSON.stringify({sessionId:'3267aa',location:'POSPinLock.jsx:catch',message:'PIN error caught locally',data:_dbgPin,timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
            // #endregion
            const status = err?.response?.status;
            let msg = 'קוד PIN שגוי';

            if (err?.response?.data?.message) {
                msg = err.response.data.message;
            } else if (status === 404) {
                msg = 'המסעדה לא נמצאה — נסה להתחבר מחדש';
            } else if (status === 401) {
                msg = 'קוד PIN שגוי';
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

                {/* PIN dots */}
                <div className="flex justify-center gap-5 mb-8">
                    {[0, 1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className={`w-5 h-5 rounded-full transition-all duration-200 ${
                                i < pin.length
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
            </div>
        </div>
    );
}
