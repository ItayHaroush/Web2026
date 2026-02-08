import { useState } from 'react';
import {
    FaExclamationTriangle,
    FaCheck,
    FaTimes,
    FaSpinner,
    FaSkullCrossbones
} from 'react-icons/fa';

export default function AgentActionModal({ action, onConfirm, onClose }) {
    const [isExecuting, setIsExecuting] = useState(false);

    if (!action) return null;

    const isCritical = action.risk === 'critical';

    const handleConfirm = async () => {
        setIsExecuting(true);
        try {
            await onConfirm(action);
            onClose();
        } catch (err) {
            console.error('Action execution failed:', err);
        } finally {
            setIsExecuting(false);
        }
    };

    // Format params for display
    const paramEntries = Object.entries(action.params || {});

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
             onClick={(e) => { if (e.target === e.currentTarget && !isExecuting) onClose(); }}>
            <div className={`w-full max-w-md mx-4 rounded-2xl shadow-2xl overflow-hidden ${
                isCritical
                    ? 'bg-red-50 dark:bg-red-950 border-2 border-red-300 dark:border-red-800'
                    : 'bg-orange-50 dark:bg-orange-950 border-2 border-orange-300 dark:border-orange-800'
            }`}>
                {/* Header */}
                <div className={`p-4 ${
                    isCritical
                        ? 'bg-red-600'
                        : 'bg-orange-600'
                } text-white`}>
                    <div className="flex items-center gap-3">
                        {isCritical
                            ? <FaSkullCrossbones className="text-2xl" />
                            : <FaExclamationTriangle className="text-2xl" />
                        }
                        <div>
                            <h3 className="font-bold text-lg">
                                {isCritical ? 'פעולה קריטית!' : 'אישור פעולה'}
                            </h3>
                            <p className="text-sm opacity-90">
                                {action.display_name}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4">
                    {/* Description */}
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                        {action.description}
                    </p>

                    {/* Warning for critical */}
                    {isCritical && (
                        <div className="bg-red-100 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-800 dark:text-red-200 flex items-start gap-2">
                            <FaExclamationTriangle className="text-red-600 mt-0.5 shrink-0" />
                            <span>
                                <strong>שים לב:</strong> פעולה זו עלולה להיות בלתי הפיכה. ודא שאתה בטוח לפני ביצוע.
                            </span>
                        </div>
                    )}

                    {/* Params */}
                    {paramEntries.length > 0 && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
                            <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                                פרמטרים
                            </div>
                            {paramEntries.map(([key, value]) => (
                                <div key={key} className="px-3 py-2 flex justify-between text-sm">
                                    <span className="text-gray-500 dark:text-gray-400">{key}</span>
                                    <span className="font-medium text-gray-800 dark:text-gray-200">
                                        {typeof value === 'boolean'
                                            ? (value ? 'כן' : 'לא')
                                            : String(value)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Action ID reference */}
                    <div className="text-xs text-gray-400 text-center">
                        {action.action_id}
                    </div>
                </div>

                {/* Footer buttons */}
                <div className="p-4 bg-white/50 dark:bg-black/20 border-t border-gray-200 dark:border-gray-700 flex gap-3">
                    <button
                        onClick={handleConfirm}
                        disabled={isExecuting}
                        className={`flex-1 ${
                            isCritical
                                ? 'bg-red-600 hover:bg-red-700'
                                : 'bg-orange-600 hover:bg-orange-700'
                        } text-white font-medium px-4 py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50`}
                    >
                        {isExecuting ? (
                            <>
                                <FaSpinner className="animate-spin" />
                                <span>מבצע פעולה...</span>
                            </>
                        ) : (
                            <>
                                <FaCheck />
                                <span>אשר וביצע</span>
                            </>
                        )}
                    </button>
                    <button
                        onClick={onClose}
                        disabled={isExecuting}
                        className="px-4 py-3 text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-600 transition font-medium disabled:opacity-50 flex items-center gap-2"
                    >
                        <FaTimes />
                        <span>ביטול</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
