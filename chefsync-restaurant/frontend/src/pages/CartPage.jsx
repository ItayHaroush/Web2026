import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { CustomerLayout } from '../layouts/CustomerLayout';
import orderService from '../services/orderService';
import { UI_TEXT } from '../constants/ui';

/**
 * עמוד סל קניות
 */

export default function CartPage() {
    const navigate = useNavigate();
    const { tenantId } = useAuth();
    const { cartItems, removeFromCart, updateQuantity, getTotal, clearCart, customerInfo, setCustomerInfo } = useCart();
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const handleQuantityChange = (itemId, newQuantity) => {
        if (newQuantity < 1) {
            removeFromCart(itemId);
        } else {
            updateQuantity(itemId, newQuantity);
        }
    };

    const handleSubmitOrder = async (e) => {
        e.preventDefault();

        try {
            setSubmitting(true);
            setError(null);

            // בדוק שנתונים בסיסיים קיימים
            if (!customerInfo.name || !customerInfo.phone) {
                setError('אנא מלא שם וטלפון');
                return;
            }

            // הכן נתוני ההזמנה
            const orderData = {
                customer_name: customerInfo.name,
                customer_phone: customerInfo.phone,
                items: cartItems.map((item) => ({
                    menu_item_id: item.id,
                    quantity: item.quantity,
                })),
            };

            // שלח את ההזמנה
            const response = await orderService.createOrder(orderData);

            // סיים בהצלחה
            clearCart();
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
                <h1 className="text-3xl font-bold text-brand-primary">סל קניות</h1>

                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-900 px-4 py-3 rounded">
                        {error}
                    </div>
                )}

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
                <form onSubmit={handleSubmitOrder} className="space-y-4 bg-gray-50 p-6 rounded-lg">
                    <h2 className="text-xl font-bold text-gray-900">פרטים אישיים</h2>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            שם מלא*
                        </label>
                        <input
                            type="text"
                            value={customerInfo.name}
                            onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                            placeholder="דוד כהן"
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

                    {/* כפתורים */}
                    <div className="flex gap-3 mt-6">
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex-1 bg-brand-primary text-white font-bold py-4 rounded-lg hover:bg-gray-800 transition disabled:opacity-50"
                        >
                            {submitting ? 'שולח...' : UI_TEXT.BTN_CHECKOUT}
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
