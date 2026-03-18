import React, { useState } from 'react';
import { FaTimes, FaBan } from 'react-icons/fa';

const CANCELLATION_REASONS = [
    'הלקוח ביקש לבטל',
    'פריט חסר במלאי',
    'זמן הכנה ארוך מדי',
    'כתובת משלוח לא תקינה',
    'בעיית תשלום',
    'הזמנה כפולה',
    'המסעדה סגורה',
    'טעות בהזמנה',
];

export default function CancelOrderModal({ isOpen, onClose, onConfirm, orderId, orderName }) {
    const [selectedReason, setSelectedReason] = useState('');
    const [customReason, setCustomReason] = useState('');
    const [isCustom, setIsCustom] = useState(false);

    if (!isOpen) return null;

    const reason = isCustom ? customReason.trim() : selectedReason;
    const canSubmit = reason.length > 0;

    const handleConfirm = () => {
        if (!canSubmit) return;
        onConfirm(orderId, reason);
        setSelectedReason('');
        setCustomReason('');
        setIsCustom(false);
        onClose();
    };

    const handleClose = () => {
        setSelectedReason('');
        setCustomReason('');
        setIsCustom(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" dir="rtl">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
                {/* Header */}
                <div className="bg-red-50 dark:bg-red-900/30 px-5 py-4 flex items-center justify-between border-b border-red-100 dark:border-red-800/50">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 bg-red-100 dark:bg-red-800/50 rounded-xl flex items-center justify-center">
                            <FaBan className="text-red-500" size={16} />
                        </div>
                        <div>
                            <h3 className="font-black text-gray-900 dark:text-white text-base">ביטול הזמנה</h3>
                            {orderName && <p className="text-xs text-gray-500 dark:text-gray-400">הזמנה #{orderId}</p>}
                        </div>
                    </div>
                    <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 transition">
                        <FaTimes size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
                    <p className="text-sm font-bold text-gray-700 dark:text-gray-300">בחר סיבת ביטול:</p>

                    <div className="space-y-2">
                        {CANCELLATION_REASONS.map((reason) => (
                            <button
                                key={reason}
                                onClick={() => { setSelectedReason(reason); setIsCustom(false); }}
                                className={`w-full text-right px-4 py-3 rounded-xl text-sm font-medium transition-all border ${
                                    !isCustom && selectedReason === reason
                                        ? 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 ring-1 ring-red-200 dark:ring-red-800'
                                        : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                            >
                                {reason}
                            </button>
                        ))}

                        {/* Custom reason */}
                        <button
                            onClick={() => { setIsCustom(true); setSelectedReason(''); }}
                            className={`w-full text-right px-4 py-3 rounded-xl text-sm font-medium transition-all border ${
                                isCustom
                                    ? 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 ring-1 ring-red-200 dark:ring-red-800'
                                    : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                        >
                            אחר — אכתוב סיבה
                        </button>

                        {isCustom && (
                            <textarea
                                autoFocus
                                value={customReason}
                                onChange={(e) => setCustomReason(e.target.value)}
                                placeholder="הזן סיבת ביטול..."
                                className="w-full px-4 py-3 border-2 border-red-200 dark:border-red-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-300 dark:focus:ring-red-700 resize-none dark:bg-gray-800 dark:text-white"
                                rows={3}
                                maxLength={500}
                            />
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-5 pb-5 pt-2 flex gap-2">
                    <button
                        onClick={handleConfirm}
                        disabled={!canSubmit}
                        className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm"
                    >
                        בטל הזמנה
                    </button>
                    <button
                        onClick={handleClose}
                        className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold py-3 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-95 transition-all text-sm"
                    >
                        חזור
                    </button>
                </div>
            </div>
        </div>
    );
}
