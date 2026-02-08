import { useState } from 'react';
import { FaCheck, FaTimes, FaSpinner, FaExclamationTriangle, FaShieldAlt } from 'react-icons/fa';

const RISK_CONFIG = {
    low: {
        color: 'green',
        bgClass: 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800',
        badgeClass: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
        btnClass: 'bg-green-600 hover:bg-green-700',
        label: 'סיכון נמוך',
    },
    medium: {
        color: 'yellow',
        bgClass: 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800',
        badgeClass: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
        btnClass: 'bg-yellow-600 hover:bg-yellow-700',
        label: 'סיכון בינוני',
    },
    high: {
        color: 'orange',
        bgClass: 'bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800',
        badgeClass: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
        btnClass: 'bg-orange-600 hover:bg-orange-700',
        label: 'סיכון גבוה',
    },
    critical: {
        color: 'red',
        bgClass: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800',
        badgeClass: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
        btnClass: 'bg-red-600 hover:bg-red-700',
        label: 'סיכון קריטי',
    },
};

export default function AgentActionCard({ action, onConfirm, onCancel, onOpenModal, disabled = false }) {
    const [isExecuting, setIsExecuting] = useState(false);
    const risk = RISK_CONFIG[action.risk] || RISK_CONFIG.medium;

    // High/critical risk actions open a modal instead
    const needsModal = action.approval_type === 'modal' || action.risk === 'high' || action.risk === 'critical';

    const handleConfirm = async () => {
        if (needsModal) {
            onOpenModal?.(action);
            return;
        }

        setIsExecuting(true);
        try {
            await onConfirm(action);
        } finally {
            setIsExecuting(false);
        }
    };

    // Format params for display
    const paramEntries = Object.entries(action.params || {}).filter(
        ([key]) => key !== 'id'
    );

    return (
        <div className={`mt-2 rounded-xl border p-3 ${risk.bgClass} transition-all`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <FaShieldAlt className="text-sm opacity-70" />
                    <span className="font-semibold text-sm">{action.display_name}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${risk.badgeClass}`}>
                    {risk.label}
                </span>
            </div>

            {/* Description */}
            {action.description && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                    {action.description}
                </p>
            )}

            {/* Params summary */}
            {paramEntries.length > 0 && (
                <div className="text-xs bg-white/50 dark:bg-black/20 rounded-lg p-2 mb-2 space-y-1">
                    {paramEntries.map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                            <span className="text-gray-500">{key}:</span>
                            <span className="font-medium">{String(value)}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 mt-2">
                <button
                    onClick={handleConfirm}
                    disabled={disabled || isExecuting}
                    className={`flex-1 ${risk.btnClass} text-white text-xs font-medium px-3 py-2 rounded-lg transition-all flex items-center justify-center gap-1 disabled:opacity-50`}
                >
                    {isExecuting ? (
                        <>
                            <FaSpinner className="animate-spin" />
                            <span>מבצע...</span>
                        </>
                    ) : needsModal ? (
                        <>
                            <FaExclamationTriangle />
                            <span>פרטים נוספים</span>
                        </>
                    ) : (
                        <>
                            <FaCheck />
                            <span>אשר ביצוע</span>
                        </>
                    )}
                </button>
                <button
                    onClick={() => onCancel?.(action)}
                    disabled={disabled || isExecuting}
                    className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition disabled:opacity-50 flex items-center gap-1"
                >
                    <FaTimes />
                    <span>ביטול</span>
                </button>
            </div>
        </div>
    );
}
