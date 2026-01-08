import React, { useState } from 'react';
import PhoneVerificationModal from '../components/PhoneVerificationModal';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { CustomerLayout } from '../layouts/CustomerLayout';
import orderService from '../services/orderService';
import { UI_TEXT } from '../constants/ui';
import DeliveryDetailsModal from '../components/DeliveryDetailsModal';

/**
 * עמוד סל קניות
 */

export default function CartPage() {
    const navigate = useNavigate();
    const { tenantId } = useAuth();
    const { cartItems, removeFromCart, updateQuantity, getTotal, clearCart, customerInfo, setCustomerInfo, phoneVerified, setPhoneVerified } = useCart();
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [showPhoneModal, setShowPhoneModal] = useState(false);
    const [showDeliveryModal, setShowDeliveryModal] = useState(false);
    const [submitStep, setSubmitStep] = useState('payment'); // payment -> confirm

    const handleQuantityChange = (itemId, newQuantity) => {
        if (newQuantity < 1) {
            removeFromCart(itemId);
        } else {
            updateQuantity(itemId, newQuantity);
        }
    };

    const handleSubmitOrder = async (e) => {
        e.preventDefault();
        setError(null);

        // בדוק שנתונים בסיסיים קיימים
        if (!customerInfo.name || !customerInfo.phone) {
            setError('אנא מלא שם וטלפון');
            return;
        }

        if (customerInfo.delivery_method === 'delivery' && !customerInfo.delivery_address) {
            setShowDeliveryModal(true);
            setError('');
            setSubmitStep('payment');
            return;
        }

        // אם הטלפון לא אומת, פתח modal
        if (!phoneVerified) {
            setShowPhoneModal(true);
            return;
        }

        // שלב ראשון: הכנה (ללא שליחה)
        if (submitStep === 'payment') {
            setSubmitStep('confirm');
            setError('');
            return;
        }

        try {
            setSubmitting(true);
            const orderData = {
                customer_name: customerInfo.name,
                customer_phone: customerInfo.phone,
                delivery_method: customerInfo.delivery_method || 'pickup',
                payment_method: customerInfo.payment_method || 'cash',
                delivery_address: customerInfo.delivery_address || undefined,
                delivery_notes: customerInfo.delivery_notes || undefined,
                items: cartItems.map((item) => ({
                    menu_item_id: item.id,
                    quantity: item.quantity,
                })),
            };
            const response = await orderService.createOrder(orderData);
            localStorage.setItem(`activeOrder_${tenantId}`, response.data.id);
            clearCart();
            setSubmitStep('payment');
            navigate(`/order-status/${response.data.id}`);
        } catch (err) {
            console.error('שגיאה בהגשת הזמנה:', err);
            setError(err.response?.data?.message || 'שגיאה בהגשת ההזמנה');
        } finally {
            setSubmitting(false);
        }
    };

    if (cartItems.length === 0) {
        return (
            <CustomerLayout>
                <div className="space-y-6">
                    <h1 className="text-3xl font-bold text-brand-primary">סל קניות</h1>

                    <div className="bg-blue-50 border border-blue-200 text-blue-900 px-6 py-8 rounded-lg text-center">
                        <p className="text-lg mb-4">{UI_TEXT.MSG_EMPTY_CART}</p>
                        <button
                            onClick={() => navigate('/menu')}
                            className="bg-brand-primary text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition inline-block"
                        >
                            חזור לתפריט
                        </button>
                    </div>
                </div>
            </CustomerLayout>
        );
    }

    const total = getTotal();

    return (
        <CustomerLayout>
            <div className="space-y-6">
                {showPhoneModal && (
                    <PhoneVerificationModal
                        phone={customerInfo.phone}
                        onVerified={(phone) => {
                            setPhoneVerified(true);
                            setShowPhoneModal(false);
                        }}
                        onClose={() => setShowPhoneModal(false)}
                    />
                )}
                <h1 className="text-3xl font-bold text-brand-primary">סל קניות</h1>

                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-900 px-4 py-3 rounded">
                        {error}
                    </div>
                )}

                <DeliveryDetailsModal
                    open={showDeliveryModal}
                    onClose={() => {
                        setShowDeliveryModal(false);
                    }}
                    customerInfo={customerInfo}
                    setCustomerInfo={setCustomerInfo}
                    onSaved={() => {
                        // אחרי שמירת פרטי משלוח אפשר להתקדם לשלב אישור
                        setSubmitStep('confirm');
                    }}
                />

                {/* פריטים בסל */}
                <div className="space-y-2">
                    {cartItems.map((item) => (
                        <div
                            key={item.id}
                            className="bg-white border border-gray-200 rounded-lg p-4 flex justify-between items-center"
                        >
                            <div className="flex-1">
                                <h3 className="font-semibold text-gray-900">{item.name}</h3>
                                <p className="text-gray-600 text-sm">₪{item.price} למנה</p>
                            </div>

                            <div className="flex items-center gap-4">
                                {/* כמות */}
                                <div className="flex items-center gap-2 border border-gray-300 rounded">
                                    <button
                                        onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                                        className="px-3 py-1 text-gray-600 hover:bg-gray-100"
                                    >
                                        −
                                    </button>
                                    <span className="px-3 py-1 min-w-[40px] text-center">{item.quantity}</span>
                                    <button
                                        onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                                        className="px-3 py-1 text-gray-600 hover:bg-gray-100"
                                    >
                                        +
                                    </button>
                                </div>

                                {/* מחיר כולל לפריט */}
                                <div className="min-w-[80px] text-right">
                                    <p className="font-semibold text-brand-accent">
                                        ₪{(item.price * item.quantity).toFixed(2)}
                                    </p>
                                </div>

                                {/* הסרה */}
                                <button
                                    onClick={() => removeFromCart(item.id)}
                                    className="text-red-600 hover:text-red-800 font-semibold"
                                >
                                    ×
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* סכום ביניים */}
                <div className="border-t-2 border-gray-300 pt-4">
                    <div className="flex justify-between items-center text-2xl font-bold">
                        <span>סך הכל:</span>
                        <span className="text-brand-accent">₪{total.toFixed(2)}</span>
                    </div>
                </div>

                {/* טופס פרטים אישיים */}
                <form id="cart-order-form" onSubmit={handleSubmitOrder} className="space-y-4 bg-gray-50 p-6 rounded-lg">
                    <h2 className="text-xl font-bold text-gray-900">פרטים אישיים</h2>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            שם מלא*
                        </label>
                        <input
                            type="text"
                            value={customerInfo.name}
                            onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                            placeholder="הקלד את שמך המלא"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            טלפון*
                        </label>
                        <input
                            type="tel"
                            value={customerInfo.phone}
                            onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                            placeholder="050-1234567"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <p className="block text-sm font-medium text-gray-700 mb-2">שיטת קבלה</p>
                            <div className="flex gap-3">
                                <label className={`flex-1 border rounded-lg p-3 cursor-pointer ${customerInfo.delivery_method === 'pickup' ? 'border-brand-primary bg-brand-primary/5' : 'border-gray-300'}`}>
                                    <input
                                        type="radio"
                                        name="delivery_method"
                                        value="pickup"
                                        checked={customerInfo.delivery_method === 'pickup'}
                                        onChange={(e) => setCustomerInfo({ ...customerInfo, delivery_method: e.target.value })}
                                        className="mr-2"
                                    />
                                    איסוף עצמי
                                </label>
                                <label className={`flex-1 border rounded-lg p-3 cursor-pointer ${customerInfo.delivery_method === 'delivery' ? 'border-brand-primary bg-brand-primary/5' : 'border-gray-300'}`}>
                                    <input
                                        type="radio"
                                        name="delivery_method"
                                        value="delivery"
                                        checked={customerInfo.delivery_method === 'delivery'}
                                        onChange={(e) => {
                                            setCustomerInfo({ ...customerInfo, delivery_method: e.target.value });
                                            setShowDeliveryModal(true);
                                        }}
                                        className="mr-2"
                                    />
                                    משלוח
                                </label>
                            </div>
                            {customerInfo.delivery_method === 'delivery' && (
                                <button
                                    type="button"
                                    onClick={() => setShowDeliveryModal(true)}
                                    className="mt-3 text-sm text-brand-primary underline"
                                >
                                    עריכת פרטי משלוח
                                </button>
                            )}
                        </div>

                        <div className="border rounded-lg p-3 bg-white">
                            <p className="text-sm font-medium text-gray-700">תשלום</p>
                            <p className="text-gray-800 font-semibold">מזומן בלבד בעת איסוף/משלוח</p>
                        </div>
                    </div>

                    {/* כפתורים */}
                    <div className="flex gap-3 mt-6">
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex-1 bg-brand-primary text-white font-bold py-4 rounded-lg hover:bg-gray-800 transition disabled:opacity-50"
                        >
                            {submitting
                                ? 'שולח...'
                                : submitStep === 'payment'
                                    ? 'שלם עכשיו'
                                    : 'שלח הזמנה'}
                        </button>
                        <a
                            href="/menu"
                            className="flex-1 bg-gray-300 text-gray-800 font-bold py-4 rounded-lg text-center hover:bg-gray-400 transition"
                        >
                            {UI_TEXT.BTN_CANCEL}
                        </a>
                    </div>
                </form>
            </div>
        </CustomerLayout>
    );
}
