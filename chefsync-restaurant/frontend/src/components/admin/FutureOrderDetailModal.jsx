import { useState } from 'react';
import { FaTimes, FaUser, FaPhone, FaMapMarkerAlt, FaClock, FaBan } from 'react-icons/fa';
import CancelOrderModal from '../CancelOrderModal';
import api from '../../services/apiClient';

/**
 * תצוגת פרטי הזמנה עתידית (דשבורד) — מבנה דומה לכרטיס הזמנה במסך ההזמנות.
 */
export default function FutureOrderDetailModal({ order, onClose, getAuthHeaders, onOrderCancelled }) {
    const [cancelOpen, setCancelOpen] = useState(false);
    const [cancelling, setCancelling] = useState(false);

    if (!order) return null;

    const items = order.items || [];
    const total = Number(order.total_amount ?? order.total ?? 0).toFixed(2);
    const scheduled = order.scheduled_for
        ? new Date(order.scheduled_for).toLocaleString('he-IL', {
              weekday: 'short',
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
          })
        : '—';

    const canCancel = order.status !== 'cancelled' && order.status !== 'delivered';

    const handleCancelConfirm = async (orderId, reason) => {
        setCancelling(true);
        try {
            const res = await api.patch(
                `/admin/orders/${orderId}/status`,
                { status: 'cancelled', cancellation_reason: reason },
                { headers: getAuthHeaders() }
            );
            if (res.data?.success) {
                onOrderCancelled?.();
                onClose();
            } else {
                alert(res.data?.message || 'לא ניתן לבטל את ההזמנה');
            }
        } catch (e) {
            alert(e.response?.data?.message || 'שגיאה בביטול ההזמנה');
        } finally {
            setCancelling(false);
        }
    };

    return (
        <>
            <div
                className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/50"
                role="dialog"
                aria-modal="true"
                onClick={onClose}
            >
                <div
                    className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col border border-gray-100 dark:border-gray-800"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
                        <div>
                            <p className="text-xs font-black text-indigo-600 uppercase tracking-wide">הזמנה עתידית</p>
                            <p className="text-lg font-black text-gray-900 dark:text-white">#{order.id}</p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
                            aria-label="סגור"
                        >
                            <FaTimes />
                        </button>
                    </div>

                    <div className="overflow-y-auto flex-1 p-4 space-y-4">
                        <div className="flex items-start gap-2 text-sm">
                            <FaClock className="text-indigo-500 mt-0.5 shrink-0" />
                            <div>
                                <p className="font-black text-gray-900 dark:text-white">מתוכננת ל</p>
                                <p className="font-bold text-gray-700 dark:text-gray-300">{scheduled}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-2 text-sm">
                            <FaUser className="text-gray-400 mt-0.5 shrink-0" />
                            <div>
                                <p className="font-black text-gray-900 dark:text-white">{order.customer_name || '—'}</p>
                                {order.customer_phone && (
                                    <p className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400 font-bold mt-0.5">
                                        <FaPhone className="text-xs" />
                                        {order.customer_phone}
                                    </p>
                                )}
                            </div>
                        </div>
                        {order.delivery_method === 'delivery' && order.delivery_address && (
                            <div className="flex items-start gap-2 text-sm">
                                <FaMapMarkerAlt className="text-orange-500 mt-0.5 shrink-0" />
                                <p className="font-bold text-gray-700 dark:text-gray-300">{order.delivery_address}</p>
                            </div>
                        )}

                        <div className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider px-3 py-2 bg-gray-50 dark:bg-gray-800/50">
                                פריטים
                            </p>
                            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                                {items.length === 0 ? (
                                    <li className="px-3 py-4 text-sm text-gray-500 text-center">אין פריטים בטעינה</li>
                                ) : (
                                    items.map((line) => {
                                        const name = line.menu_item?.name || line.name || 'פריט';
                                        const qty = line.quantity ?? 1;
                                        const price = Number(line.price_at_order ?? 0).toFixed(2);
                                        return (
                                            <li key={line.id ?? `${name}-${qty}`} className="px-3 py-2.5 flex justify-between gap-2 text-sm">
                                                <span className="font-bold text-gray-900 dark:text-white">
                                                    {name} ×{qty}
                                                </span>
                                                <span className="font-black text-gray-700 dark:text-gray-300 shrink-0">₪{price}</span>
                                            </li>
                                        );
                                    })
                                )}
                            </ul>
                        </div>

                        <div className="flex justify-between items-center pt-2 border-t border-gray-100 dark:border-gray-800">
                            <span className="font-black text-gray-600 dark:text-gray-400">סה״כ</span>
                            <span className="text-xl font-black text-gray-900 dark:text-white">₪{total}</span>
                        </div>
                    </div>

                    <div className="p-4 border-t border-gray-100 dark:border-gray-800 shrink-0 flex flex-col sm:flex-row gap-2">
                        {canCancel && (
                            <button
                                type="button"
                                disabled={cancelling}
                                onClick={() => setCancelOpen(true)}
                                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm bg-red-50 dark:bg-red-900/25 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50"
                            >
                                <FaBan />
                                ביטול הזמנה
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 rounded-xl font-bold text-sm bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700"
                        >
                            סגור
                        </button>
                    </div>
                </div>
            </div>

            <CancelOrderModal
                isOpen={cancelOpen}
                onClose={() => setCancelOpen(false)}
                onConfirm={handleCancelConfirm}
                orderId={order.id}
                orderName={order.customer_name}
            />
        </>
    );
}
