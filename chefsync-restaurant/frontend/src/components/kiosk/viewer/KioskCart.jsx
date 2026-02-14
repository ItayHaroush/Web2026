import { useState } from 'react';
import { FaTimes, FaMinus, FaPlus, FaTrash, FaPaperPlane, FaMoneyBillWave, FaCreditCard, FaCashRegister } from 'react-icons/fa';

export default function KioskCart({ items, totalPrice, requireName, onUpdateQty, onRemove, onSubmit, onClose, submitting, acceptedPaymentMethods }) {
    const [customerName, setCustomerName] = useState('');
    const [nameError, setNameError] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState('cash');

    const hasCreditOption = (acceptedPaymentMethods || []).includes('credit_card');

    const handleSubmit = () => {
        if (!customerName.trim()) {
            setNameError(true);
            return;
        }
        setNameError(false);
        onSubmit(customerName.trim(), selectedPayment);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center">
            <div className="bg-white w-full sm:max-w-2xl rounded-t-[1.5rem] sm:rounded-t-[2rem] max-h-[90vh] flex flex-col animate-in slide-in-from-bottom duration-300">
                {/* Header */}
                <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-100 shrink-0">
                    <h2 className="text-xl sm:text-2xl font-black text-gray-900">הסל שלך</h2>
                    <button
                        onClick={onClose}
                        className="p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
                    >
                        <FaTimes size={20} />
                    </button>
                </div>

                {/* Items */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
                    {items.length === 0 ? (
                        <div className="text-center py-16 text-gray-400">
                            <span className="text-5xl block mb-4">🛒</span>
                            <p className="font-bold text-lg">הסל ריק</p>
                            <p className="text-sm mt-1">הוסיפו פריטים מהתפריט</p>
                        </div>
                    ) : (
                        items.map(item => (
                            <div key={item.cartKey} className="bg-gray-50 rounded-2xl p-4">
                                <div className="flex items-start gap-3">
                                    {item.imageUrl && (
                                        <img src={item.imageUrl} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-black text-gray-900 text-sm">{item.name}</h3>
                                        {item.variant && (
                                            <p className="text-xs text-gray-500 mt-0.5">{item.variant.name}</p>
                                        )}
                                        {item.addons.length > 0 && (
                                            <p className="text-xs text-gray-400 mt-0.5">
                                                {item.addons.map(a => a.name + (a.on_side ? ' (בצד)' : '')).join(', ')}
                                            </p>
                                        )}
                                        <p className="font-black text-amber-600 text-sm mt-1">{item.totalPrice.toFixed(2)} ₪</p>
                                    </div>
                                    <button
                                        onClick={() => onRemove(item.cartKey)}
                                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all shrink-0"
                                    >
                                        <FaTrash size={14} />
                                    </button>
                                </div>
                                <div className="flex items-center gap-3 mt-3 mr-[68px]">
                                    <button
                                        onClick={() => onUpdateQty(item.cartKey, item.qty - 1)}
                                        className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 active:scale-95 transition-all"
                                    >
                                        <FaMinus size={10} />
                                    </button>
                                    <span className="font-black text-gray-900 w-6 text-center">{item.qty}</span>
                                    <button
                                        onClick={() => onUpdateQty(item.cartKey, item.qty + 1)}
                                        className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 active:scale-95 transition-all"
                                    >
                                        <FaPlus size={10} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}

                    {/* Customer name */}
                    {items.length > 0 && (
                        <div className="mt-4">
                            <label className="text-sm font-black text-gray-700 mb-2 block">שם *</label>
                            <input
                                type="text"
                                value={customerName}
                                onChange={(e) => { setCustomerName(e.target.value); setNameError(false); }}
                                placeholder="הכנס את שמך..."
                                className={`w-full px-4 py-3 bg-gray-50 border rounded-xl font-bold text-gray-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 transition-all ${nameError ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
                                maxLength={100}
                            />
                            {nameError && (
                                <p className="text-red-500 text-xs font-bold mt-1">נא להזין שם</p>
                            )}
                        </div>
                    )}

                    {/* Payment method selection — pay at register */}
                    {items.length > 0 && (
                        <div className="mt-4">
                            <div className="flex items-center gap-2 mb-3">
                                <FaCashRegister className="text-gray-600" size={16} />
                                <label className="text-sm font-black text-gray-700">תשלום בקופה</label>
                            </div>
                            <div className={`grid ${hasCreditOption ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
                                <button
                                    onClick={() => setSelectedPayment('cash')}
                                    className={`flex flex-col items-center gap-2 p-3 sm:p-4 rounded-xl border-2 transition-all active:scale-95 ${selectedPayment === 'cash'
                                            ? 'border-amber-500 bg-amber-50 text-amber-700 shadow-md shadow-amber-500/10'
                                            : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                                        }`}
                                >
                                    <FaMoneyBillWave size={22} />
                                    <span className="text-xs sm:text-sm font-bold text-center leading-tight">מזומן</span>
                                </button>
                                {hasCreditOption && (
                                    <button
                                        onClick={() => setSelectedPayment('credit_card')}
                                        className={`flex flex-col items-center gap-2 p-3 sm:p-4 rounded-xl border-2 transition-all active:scale-95 ${selectedPayment === 'credit_card'
                                                ? 'border-amber-500 bg-amber-50 text-amber-700 shadow-md shadow-amber-500/10'
                                                : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        <FaCreditCard size={22} />
                                        <span className="text-xs sm:text-sm font-bold text-center leading-tight">אשראי</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer */}
                {items.length > 0 && (
                    <div className="p-4 sm:p-6 border-t border-gray-100 space-y-3 sm:space-y-4 shrink-0">
                        <div className="flex items-center justify-between">
                            <span className="text-base sm:text-lg font-black text-gray-700">סה"כ</span>
                            <span className="text-xl sm:text-2xl font-black text-gray-900">{totalPrice.toFixed(2)} ₪</span>
                        </div>
                        <button
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="w-full bg-green-500 hover:bg-green-400 disabled:bg-gray-300 text-white font-black text-lg sm:text-xl py-4 sm:py-5 rounded-2xl shadow-xl shadow-green-500/20 active:scale-95 transition-all flex items-center justify-center gap-3"
                        >
                            {submitting ? (
                                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-white" />
                            ) : (
                                <>
                                    <FaPaperPlane size={18} />
                                    שלח הזמנה
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
