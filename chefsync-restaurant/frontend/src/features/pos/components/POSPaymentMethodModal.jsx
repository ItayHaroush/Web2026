import { FaMoneyBillWave, FaCreditCard, FaTimes, FaPause, FaRandom, FaShoppingBag, FaChair } from 'react-icons/fa';

export default function POSPaymentMethodModal({ total, orderType = 'takeaway', onOrderTypeChange, onSelect, onClose }) {
    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[300] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-700 animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-8 pt-8 pb-4">
                    <div>
                        <h2 className="text-2xl font-black text-white">בחר אמצעי תשלום</h2>
                        <p className="text-slate-400 text-sm mt-1">
                            סה״כ: <span className="text-orange-400 font-black">₪{total.toFixed(2)}</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-700 transition-all">
                        <FaTimes size={18} />
                    </button>
                </div>

                <div className="px-8 pb-2">
                    <p className="text-slate-500 text-xs font-bold mb-2">סוג שירות</p>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => onOrderTypeChange?.('dine_in')}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black border transition-all active:scale-95 ${orderType === 'dine_in'
                                ? 'bg-green-500/20 border-green-500/50 text-green-400'
                                : 'bg-slate-700/40 border-slate-600/50 text-slate-400 hover:text-white'
                                }`}
                        >
                            <FaChair className="text-lg" />
                            לשבת
                        </button>
                        <button
                            type="button"
                            onClick={() => onOrderTypeChange?.('takeaway')}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black border transition-all active:scale-95 ${orderType === 'takeaway'
                                ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
                                : 'bg-slate-700/40 border-slate-600/50 text-slate-400 hover:text-white'
                                }`}
                        >
                            <FaShoppingBag className="text-lg" />
                            לקחת
                        </button>
                    </div>
                </div>

                <div className="px-8 pb-8 space-y-3 pt-4">
                    <button
                        onClick={() => onSelect('cash')}
                        className="w-full flex items-center gap-4 p-5 bg-slate-700/50 hover:bg-emerald-500/10 border border-slate-600/50 hover:border-emerald-500/40 rounded-2xl transition-all active:scale-95 group"
                    >
                        <div className="p-3 bg-emerald-500/20 rounded-xl group-hover:bg-emerald-500/30 transition-colors">
                            <FaMoneyBillWave className="text-emerald-400 text-2xl" />
                        </div>
                        <div className="text-right">
                            <p className="text-white font-black text-lg">מזומן</p>
                            <p className="text-slate-400 text-sm">תשלום במזומן עם חישוב עודף</p>
                        </div>
                    </button>

                    <button
                        onClick={() => onSelect('credit')}
                        className="w-full flex items-center gap-4 p-5 bg-slate-700/50 hover:bg-blue-500/10 border border-slate-600/50 hover:border-blue-500/40 rounded-2xl transition-all active:scale-95 group"
                    >
                        <div className="p-3 bg-blue-500/20 rounded-xl group-hover:bg-blue-500/30 transition-colors">
                            <FaCreditCard className="text-blue-400 text-2xl" />
                        </div>
                        <div className="text-right">
                            <p className="text-white font-black text-lg">כרטיס אשראי</p>
                            <p className="text-slate-400 text-sm">חיוב דרך PinPad</p>
                        </div>
                    </button>

                    <button
                        onClick={() => onSelect('split')}
                        className="w-full flex items-center gap-4 p-5 bg-slate-700/50 hover:bg-indigo-500/10 border border-slate-600/50 hover:border-indigo-500/40 rounded-2xl transition-all active:scale-95 group"
                    >
                        <div className="p-3 bg-indigo-500/20 rounded-xl group-hover:bg-indigo-500/30 transition-colors">
                            <FaRandom className="text-indigo-400 text-2xl" />
                        </div>
                        <div className="text-right">
                            <p className="text-white font-black text-lg">תשלום מפוצל</p>
                            <p className="text-slate-400 text-sm">חלוקה בין מזומן לאשראי</p>
                        </div>
                    </button>

                    <button
                        onClick={() => onSelect('hold')}
                        className="w-full flex items-center gap-4 p-5 bg-slate-700/50 hover:bg-amber-500/10 border border-slate-600/50 hover:border-amber-500/40 rounded-2xl transition-all active:scale-95 group"
                    >
                        <div className="p-3 bg-amber-500/20 rounded-xl group-hover:bg-amber-500/30 transition-colors">
                            <FaPause className="text-amber-400 text-2xl" />
                        </div>
                        <div className="text-right">
                            <p className="text-white font-black text-lg">השהה חשבון</p>
                            <p className="text-slate-400 text-sm">צור הזמנה ושלם מאוחר יותר</p>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
}
