import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaTimes, FaTrash, FaUser, FaPhone, FaStore, FaTruck, FaMapMarkerAlt, FaMoneyBillWave, FaCreditCard, FaComment, FaBoxOpen, FaSpinner, FaCheckCircle, FaGift } from 'react-icons/fa';
import { resolveAssetUrl } from '../utils/assets';

/**
 * מודל אישור הזמנה - Bottom Sheet
 * מציג סיכום מלא של ההזמנה לפני שליחה
 */
export default function OrderConfirmationSheet({
    open,
    onClose,
    restaurantName,
    restaurantLogoUrl,
    cartItems,
    subtotal,
    deliveryFee,
    totalWithDelivery,
    customerName,
    customerPhone,
    deliveryMethod,
    deliveryAddress,
    deliveryNotes,
    paymentMethod,
    onConfirmOrder,
    submitting,
    onRemoveItem,
    promotionDiscount = 0,
    giftItems = [],
    metPromotions = [],
}) {
    // נעילת גלילת רקע כשהמודל פתוח
    useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [open]);

    // סגירת המודל אם הסל התרוקן
    useEffect(() => {
        if (open && cartItems.length === 0) {
            onClose();
        }
    }, [open, cartItems.length, onClose]);

    if (!open) return null;

    const isCash = paymentMethod !== 'credit_card';
    const isDelivery = deliveryMethod === 'delivery';

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-brand-dark-surface w-full sm:max-w-lg rounded-t-[1.5rem] sm:rounded-t-[2rem] max-h-[90vh] flex flex-col animate-in slide-in-from-bottom duration-300 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
                dir="rtl"
            >
                {/* Drag Handle + Close */}
                <div className="relative pt-3 pb-2 shrink-0">
                    <div className="w-10 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto" />
                    <button
                        onClick={onClose}
                        className="absolute top-3 left-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-brand-dark-border text-gray-500 dark:text-gray-400 transition-colors"
                        aria-label="סגור"
                    >
                        <FaTimes size={16} />
                    </button>
                </div>

                {/* כותרת מסעדה */}
                <div className="px-5 pb-4 shrink-0 border-b border-gray-100 dark:border-brand-dark-border">
                    <div className="flex items-center gap-3">
                        {restaurantLogoUrl && (
                            <img
                                src={resolveAssetUrl(restaurantLogoUrl)}
                                alt={restaurantName}
                                className="w-10 h-10 rounded-full object-cover border-2 border-gray-100 dark:border-brand-dark-border"
                            />
                        )}
                        <div>
                            <p className="text-xs text-gray-500 dark:text-brand-dark-muted font-medium">אישור הזמנה</p>
                            <h2 className="text-lg font-black text-gray-900 dark:text-brand-dark-text">{restaurantName || 'המסעדה'}</h2>
                        </div>
                        <FaCheckCircle className="text-green-500 mr-auto" size={20} />
                    </div>
                </div>

                {/* תוכן גלילה */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                    {/* רשימת פריטים */}
                    <div>
                        <h3 className="text-sm font-bold text-gray-500 dark:text-brand-dark-muted uppercase tracking-wide mb-3">פריטים בהזמנה</h3>
                        <div className="space-y-3">
                            {cartItems.map((item) => {
                                const addonsInside = (item.addons || []).filter(a => !a.on_side).map(a => a.name);
                                const addonsOnSide = (item.addons || []).filter(a => a.on_side).map(a => a.name);

                                return (
                                    <div key={item.cartKey} className="flex justify-between items-start gap-3 py-2 border-b border-gray-50 dark:border-brand-dark-border/50 last:border-0">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-gray-900 dark:text-brand-dark-text text-sm">{item.name}</p>
                                            {item.variant?.name && (
                                                <p className="text-xs text-brand-primary font-medium mt-0.5">{item.variant.name}</p>
                                            )}
                                            {addonsInside.length > 0 && (
                                                <p className="text-xs text-gray-500 dark:text-brand-dark-muted mt-0.5">
                                                    {addonsInside.join(' \u00b7 ')}
                                                </p>
                                            )}
                                            {addonsOnSide.length > 0 && (
                                                <p className="text-xs text-orange-600 font-medium mt-0.5 flex items-center gap-1">
                                                    <FaBoxOpen size={10} />
                                                    <span>{addonsOnSide.join(' \u00b7 ')}</span>
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex items-start gap-2 shrink-0">
                                            <div className="text-left">
                                                <p className="font-black text-gray-900 dark:text-brand-dark-text text-sm">
                                                    {'\u20aa'}{item.totalPrice.toFixed(2)}
                                                </p>
                                                {item.qty > 1 && (
                                                    <p className="text-xs text-gray-400 mt-0.5">
                                                        {item.qty} x {'\u20aa'}{item.unitPrice.toFixed(2)}
                                                    </p>
                                                )}
                                            </div>
                                            {onRemoveItem && (
                                                <button
                                                    onClick={() => onRemoveItem(item.cartKey)}
                                                    className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors mt-0.5"
                                                    aria-label={`הסר ${item.name}`}
                                                >
                                                    <FaTrash size={12} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {/* פריטי מתנה ממבצע */}
                        {giftItems.length > 0 && (
                            <div className="mt-3 space-y-2">
                                {giftItems.map((gift, i) => (
                                    <div key={`gift-${i}`} className="flex justify-between items-center py-2 border-b border-brand-primary/20 dark:border-orange-900/30 last:border-0">
                                        <div className="flex items-center gap-2">
                                            <FaGift className="text-brand-primary" size={12} />
                                            <span className="font-bold text-brand-primary dark:text-orange-400 text-sm">{gift.name}</span>
                                            <span className="bg-brand-light text-brand-primary text-xs px-2 py-0.5 rounded-full font-bold">מתנה</span>
                                        </div>
                                        <span className="font-bold text-brand-primary text-sm">{'\u20aa'}0.00</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* סיכום מחירים */}
                    <div className="bg-gradient-to-br from-gray-50 to-orange-50/50 dark:from-brand-dark-bg dark:to-orange-900/10 rounded-xl p-4 space-y-2">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-600 dark:text-gray-400">סכום ביניים</span>
                            <span className="font-bold text-gray-900 dark:text-brand-dark-text">{'\u20aa'}{subtotal.toFixed(2)}</span>
                        </div>
                        {isDelivery && (
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600 dark:text-gray-400">דמי משלוח</span>
                                <span className="font-bold text-gray-900 dark:text-brand-dark-text">
                                    {deliveryFee > 0 ? `${'\u20aa'}${deliveryFee.toFixed(2)}` : 'חינם'}
                                </span>
                            </div>
                        )}
                        {promotionDiscount > 0 && (
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-brand-primary dark:text-orange-400 flex items-center gap-1">
                                    <FaGift size={12} />
                                    הנחת מבצע
                                </span>
                                <span className="font-bold text-brand-primary dark:text-orange-400">
                                    -{'\u20aa'}{promotionDiscount.toFixed(2)}
                                </span>
                            </div>
                        )}
                        {!promotionDiscount && giftItems.length > 0 && (
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-brand-primary dark:text-orange-400 flex items-center gap-1">
                                    <FaGift size={12} />
                                    מבצע פעיל
                                </span>
                                <span className="font-bold text-brand-primary dark:text-orange-400 text-sm">
                                    ההנחה תחושב בהזמנה
                                </span>
                            </div>
                        )}
                        <div className="flex justify-between items-center text-lg font-black border-t border-gray-200 dark:border-brand-dark-border pt-2 mt-1">
                            <span className="text-gray-900 dark:text-brand-dark-text">{"סה\"כ לתשלום"}</span>
                            <span className="text-brand-primary">{'\u20aa'}{totalWithDelivery.toFixed(2)}</span>
                        </div>
                    </div>

                    {/* פרטי לקוח */}
                    <div className="space-y-2.5">
                        <h3 className="text-sm font-bold text-gray-500 dark:text-brand-dark-muted uppercase tracking-wide">פרטי ההזמנה</h3>

                        <div className="flex items-center gap-3 text-sm">
                            <FaUser className="text-gray-400 shrink-0" size={14} />
                            <span className="text-gray-600 dark:text-gray-400 w-16 shrink-0">שם</span>
                            <span className="font-bold text-gray-900 dark:text-brand-dark-text">{customerName}</span>
                        </div>

                        <div className="flex items-center gap-3 text-sm">
                            <FaPhone className="text-gray-400 shrink-0" size={14} />
                            <span className="text-gray-600 dark:text-gray-400 w-16 shrink-0">טלפון</span>
                            <span className="font-bold text-gray-900 dark:text-brand-dark-text" dir="ltr">{customerPhone}</span>
                        </div>

                        <div className="flex items-center gap-3 text-sm">
                            {isDelivery
                                ? <FaTruck className="text-brand-primary shrink-0" size={14} />
                                : <FaStore className="text-brand-primary shrink-0" size={14} />
                            }
                            <span className="text-gray-600 dark:text-gray-400 w-16 shrink-0">קבלה</span>
                            <span className="font-bold text-gray-900 dark:text-brand-dark-text">
                                {isDelivery ? 'משלוח' : 'איסוף עצמי'}
                            </span>
                        </div>

                        {isDelivery && deliveryAddress && (
                            <div className="flex items-start gap-3 text-sm">
                                <FaMapMarkerAlt className="text-gray-400 shrink-0 mt-0.5" size={14} />
                                <span className="text-gray-600 dark:text-gray-400 w-16 shrink-0">כתובת</span>
                                <span className="font-medium text-gray-900 dark:text-brand-dark-text">{deliveryAddress}</span>
                            </div>
                        )}

                        {deliveryNotes && (
                            <div className="flex items-start gap-3 text-sm">
                                <FaComment className="text-gray-400 shrink-0 mt-0.5" size={14} />
                                <span className="text-gray-600 dark:text-gray-400 w-16 shrink-0">הערות</span>
                                <span className="font-medium text-gray-700 dark:text-gray-300">{deliveryNotes}</span>
                            </div>
                        )}

                        <div className="flex items-center gap-3 text-sm">
                            {isCash
                                ? <FaMoneyBillWave className="text-green-600 shrink-0" size={14} />
                                : <FaCreditCard className="text-indigo-600 shrink-0" size={14} />
                            }
                            <span className="text-gray-600 dark:text-gray-400 w-16 shrink-0">תשלום</span>
                            <span className="font-bold text-gray-900 dark:text-brand-dark-text">
                                {isCash ? 'מזומן' : 'כרטיס אשראי'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Footer קבוע */}
                <div className="shrink-0 border-t border-gray-200 dark:border-brand-dark-border px-5 py-4 bg-white dark:bg-brand-dark-surface rounded-t-none space-y-3">
                    <button
                        onClick={onConfirmOrder}
                        disabled={submitting}
                        className="w-full bg-gradient-to-r from-brand-primary to-orange-600 text-white font-black py-4 rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg"
                    >
                        {submitting ? (
                            <>
                                <FaSpinner className="animate-spin" />
                                שולח הזמנה...
                            </>
                        ) : isCash ? (
                            'אשר ושלח הזמנה'
                        ) : (
                            'המשך לתשלום'
                        )}
                    </button>

                    <p className="text-center text-xs text-gray-400 dark:text-brand-dark-muted">
                        שליחת הזמנה מהווה הסכמה ל{' '}
                        <Link to="/legal/end-user" className="text-brand-primary hover:underline font-semibold">
                            תנאי השימוש
                        </Link>
                        {' '}ו{' '}
                        <Link to="/legal/privacy" className="text-brand-primary hover:underline font-semibold">
                            מדיניות הפרטיות
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
