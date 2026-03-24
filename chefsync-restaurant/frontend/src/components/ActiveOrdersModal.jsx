import React from 'react';
import { FaTimes, FaClock, FaChevronLeft, FaShoppingBag } from 'react-icons/fa';

const STATUS_LABELS = {
    pending: { label: 'ממתינה', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
    awaiting_payment: { label: 'ממתין לתשלום', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' },
    received: { label: 'התקבלה', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
    preparing: { label: 'בהכנה', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' },
    ready: { label: 'מוכנה', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
    delivering: { label: 'במשלוח', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
    delivered: { label: 'נמסרה', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
    cancelled: { label: 'בוטלה', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
};

/**
 * מודל רשימת הזמנות פעילות — נפתח כשיש יותר מהזמנה אחת
 */
export default function ActiveOrdersModal({ isOpen, onClose, orders, onOrderClick }) {
    if (!isOpen || !orders?.length) return null;

    return (
        <div className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center p-4" onClick={onClose}>
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
            <div
                className="relative bg-white dark:bg-brand-dark-surface rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden animate-slideUp"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-brand-dark-border">
                    <div className="flex items-center gap-2">
                        <FaShoppingBag className="text-brand-primary text-lg" />
                        <h2 className="text-lg font-bold text-gray-900 dark:text-brand-dark-text">
                            הזמנות פעילות ({orders.length})
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-gray-100 dark:bg-brand-dark-border flex items-center justify-center hover:bg-gray-200 dark:hover:bg-brand-dark-bg transition-colors"
                    >
                        <FaTimes className="text-sm text-gray-500 dark:text-brand-dark-muted" />
                    </button>
                </div>

                {/* Orders List */}
                <div className="overflow-y-auto max-h-[60vh] p-4 space-y-3">
                    {orders.map((order) => {
                        const statusInfo = STATUS_LABELS[order.status] || STATUS_LABELS.pending;
                        const isFuture = order.is_future_order;
                        const scheduledTime = order.scheduled_for
                            ? new Date(order.scheduled_for).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })
                            : null;

                        return (
                            <button
                                key={order.id}
                                onClick={() => onOrderClick(order.id)}
                                className="w-full p-4 bg-gray-50 dark:bg-brand-dark-bg rounded-2xl border border-gray-100 dark:border-brand-dark-border hover:border-brand-primary/40 hover:bg-gray-100 dark:hover:bg-brand-dark-border transition-all text-right"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-gray-900 dark:text-brand-dark-text">
                                            הזמנה #{order.id}
                                        </span>
                                        {isFuture && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-bold">
                                                <FaClock className="text-[10px]" />
                                                עתידית
                                            </span>
                                        )}
                                    </div>
                                    <FaChevronLeft className="text-gray-400 dark:text-brand-dark-muted text-sm" />
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${statusInfo.color}`}>
                                        {statusInfo.label}
                                    </span>
                                    {scheduledTime && (
                                        <span className="text-xs text-gray-500 dark:text-brand-dark-muted">
                                            מתוכנן ל-{scheduledTime}
                                        </span>
                                    )}
                                    {order.total_amount && (
                                        <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                                            ₪{order.total_amount}
                                        </span>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
