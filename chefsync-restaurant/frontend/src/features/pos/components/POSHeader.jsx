import { useState, useEffect } from 'react';
import { FaLock, FaSignOutAlt, FaCashRegister } from 'react-icons/fa';
import POSTimeClock from './POSTimeClock';

export default function POSHeader({ posUser, shift, onLock, onExit, headers, posToken }) {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const interval = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <header className="bg-slate-800 border-b border-slate-700/50 px-6 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4">
                <div className="bg-gradient-to-br from-orange-500 to-amber-500 p-2.5 rounded-xl">
                    <FaCashRegister className="text-white text-lg" />
                </div>
                <div>
                    <h1 className="text-white font-black text-lg leading-tight">POS Lite</h1>
                    <p className="text-slate-400 text-xs font-semibold">{posUser?.name || '—'}</p>
                </div>

                {shift && (
                    <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-4 py-1.5 rounded-xl mr-4">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-emerald-400 text-xs font-black">משמרת פתוחה</span>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-4">
                {/* Clock */}
                <div className="text-white font-mono text-2xl font-bold tracking-wider">
                    {time.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                </div>

                <div className="w-px h-8 bg-slate-700" />

                <POSTimeClock headers={headers} posToken={posToken} />

                <button
                    onClick={onLock}
                    className="flex items-center gap-2 px-4 py-2.5 bg-slate-700/80 hover:bg-slate-600 text-slate-200 rounded-xl text-sm font-bold transition-all active:scale-95 border border-slate-600/50"
                    title="נעילת מסך"
                >
                    <FaLock />
                    <span className="hidden sm:inline">נעילה</span>
                </button>

                <button
                    onClick={onExit}
                    className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-sm font-bold transition-all active:scale-95 border border-red-500/30"
                    title="יציאה מהקופה"
                >
                    <FaSignOutAlt />
                    <span className="hidden sm:inline">יציאה</span>
                </button>
            </div>
        </header>
    );
}
