import React, { useState } from 'react';
import PhoneVerificationModal from '../components/PhoneVerificationModal';
import LocationPickerModal from '../components/LocationPickerModal';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { CustomerLayout } from '../layouts/CustomerLayout';
import { FaMask } from 'react-icons/fa';
import orderService from '../services/orderService';
import { UI_TEXT } from '../constants/ui';
import DeliveryDetailsModal from '../components/DeliveryDetailsModal';
import { isValidIsraeliMobile } from '../utils/phone';
import apiClient from '../services/apiClient';

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
    const [showLocationModal, setShowLocationModal] = useState(false);
    const [submitStep, setSubmitStep] = useState('payment'); // payment -> confirm
    const [deliveryLocation, setDeliveryLocation] = useState(null);
    const [deliveryFee, setDeliveryFee] = useState(0);
    const [deliveryZoneAvailable, setDeliveryZoneAvailable] = useState(true);
    const [checkingZone, setCheckingZone] = useState(false);
    const [restaurant, setRestaurant] = useState(null);

    // Fetch restaurant info
    React.useEffect(() => {
        if (tenantId) {
            apiClient.get(`/restaurants/by-tenant/${encodeURIComponent(tenantId)}`)
                .then(response => setRestaurant(response.data?.data))
                .catch(err => console.error('Failed to load restaurant:', err));
        }
    }, [tenantId]);

    React.useEffect(() => {
        // Load saved delivery location
        try {
            const stored = localStorage.getItem('user_delivery_location');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed.lat && parsed.lng) {
                    setDeliveryLocation(parsed);
                }
            }
        } catch (e) {
            console.warn('Failed to load saved location', e);
        }
    }, []);

    // Check delivery zone when location or delivery method changes
    React.useEffect(() => {
        if (customerInfo.delivery_method === 'delivery' && deliveryLocation?.lat && deliveryLocation?.lng) {
            checkDeliveryZoneAvailability(deliveryLocation.lat, deliveryLocation.lng);
        } else {
            setDeliveryFee(0);
            setDeliveryZoneAvailable(true); // Reset to true for pickup or no location
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [deliveryLocation, customerInfo.delivery_method]);

    const checkDeliveryZoneAvailability = async (lat, lng) => {
        try {
            setCheckingZone(true);
            setError(null);
            const result = await orderService.checkDeliveryZone(lat, lng);
            if (result.available) {
                setDeliveryFee(result.fee || 0);
                setDeliveryZoneAvailable(true);
            } else {
                setDeliveryFee(0);
                setDeliveryZoneAvailable(false);
                setError(result.message || 'אזור לא מכוסה במשלוחים');
            }
        } catch (err) {
            console.error('Error checking delivery zone:', err);
            setDeliveryZoneAvailable(false);
            setError('שגיאה בבדיקת אזור משלוח');
            setDeliveryFee(0);
        } finally {
            setCheckingZone(false);
        }
    };

    const handleQuantityChange = (itemKey, newQuantity) => {
        if (newQuantity < 1) {
            removeFromCart(itemKey);
        } else {
            updateQuantity(itemKey, newQuantity);
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

        if (!isValidIsraeliMobile(customerInfo.phone)) {
            setError('מספר טלפון לא תקין (נייד ישראלי בלבד)');
            return;
        }

        // בדיקת מיקום למשלוח
        if (customerInfo.delivery_method === 'delivery') {
            if (!deliveryLocation?.lat || !deliveryLocation?.lng) {
                setShowLocationModal(true);
                setError('נא לבחור מיקום למשלוח');
                return;
            }

            // בדיקה שהאזור זמין
            if (!deliveryZoneAvailable) {
                setError('הכתובת מחוץ לאזורי המשלוח של המסעדה. אנא בחר מיקום אחר.');
                return;
            }

            if (!customerInfo.delivery_address) {
                setShowDeliveryModal(true);
                setError('');
                setSubmitStep('payment');
                return;
            }
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
                delivery_address: customerInfo.delivery_method === 'delivery'
                    ? (customerInfo.delivery_address || deliveryLocation?.address || 'מיקום GPS')
                    : undefined,
                delivery_notes: customerInfo.delivery_notes || undefined,
                delivery_lat: customerInfo.delivery_method === 'delivery' ? deliveryLocation?.lat : undefined,
                delivery_lng: customerInfo.delivery_method === 'delivery' ? deliveryLocation?.lng : undefined,
                items: cartItems.map((item) => ({
                    menu_item_id: item.menuItemId,
                    variant_id: item.variant?.id ?? null,
                    addons: (item.addons || []).map((addon) => ({ addon_id: addon.id })),
                    qty: item.qty,
                })),
            };
            console.log('📦 Sending order data:', orderData);
            console.log('🛒 Customer info:', customerInfo);
            const response = await orderService.createOrder(orderData);
            const resolvedTenantSlug = tenantId || localStorage.getItem('tenantId');
            if (resolvedTenantSlug) {
                localStorage.setItem(`activeOrder_${resolvedTenantSlug}`, response.data.id);
                localStorage.setItem(`order_tenant_${response.data.id}`, resolvedTenantSlug);
            }
            clearCart();
            setSubmitStep('payment');
            navigate(`/${resolvedTenantSlug || ''}/order-status/${response.data.id}`);
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
    const totalWithDelivery = total + deliveryFee;

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

                <LocationPickerModal
                    open={showLocationModal}
                    onClose={() => setShowLocationModal(false)}
                    onLocationSelected={(location) => {
                        setDeliveryLocation(location);
                        setShowLocationModal(false);
                        // Update delivery address automatically from location
                        if (location.fullAddress) {
                            setCustomerInfo({ ...customerInfo, delivery_address: location.fullAddress });
                        }
                    }}
                />
                <h1 className="text-3xl font-bold text-brand-primary">סל קניות</h1>

                {/* באנר דמו */}
                {restaurant?.is_demo && (
                    <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border-2 border-amber-400 rounded-2xl p-4 shadow-lg">
                        <div className="flex items-center gap-3">
                            <div className="bg-amber-500 rounded-full p-3 animate-pulse">
                                <FaMask className="text-2xl text-white" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-amber-900 text-lg mb-1">הזמנה להמחשה</h3>
                                <p className="text-sm text-amber-800">
                                    זוהי הזמנת דמו - <strong>אין צורך באימות טלפון</strong>. כל השלבים מסומלצים.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl p-4 sm:p-6 max-w-md w-full shadow-2xl mx-4">
                            <div className="text-center">
                                <div className="text-4xl sm:text-5xl mb-3 sm:mb-4">⚠️</div>
                                <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-2 sm:mb-3">שגיאה</h3>
                                <p className="text-sm sm:text-base text-gray-700 mb-4 sm:mb-6">{error}</p>
                                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                                    {!deliveryZoneAvailable && customerInfo.delivery_method === 'delivery' && (
                                        <button
                                            onClick={() => {
                                                setError(null);
                                                setShowLocationModal(true);
                                            }}
                                            className="w-full sm:flex-1 bg-blue-600 text-white px-4 py-2.5 sm:py-3 rounded-xl text-sm sm:text-base font-medium hover:bg-blue-700 transition"
                                        >
                                            📍 שנה מיקום
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setError(null)}
                                        className="w-full sm:flex-1 bg-brand-primary text-white px-4 py-2.5 sm:py-3 rounded-xl text-sm sm:text-base font-medium hover:bg-brand-dark transition"
                                    >
                                        הבנתי
                                    </button>
                                </div>
                            </div>
                        </div>
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
                    {cartItems.map((item) => {
                        const addonNames = (item.addons || []).map((addon) => addon.name).join(' · ');
                        return (
                            <div
                                key={item.cartKey}
                                className="bg-white border border-gray-200 rounded-lg p-4 flex justify-between items-center"
                            >
                                <div className="flex-1 space-y-1">
                                    <h3 className="font-semibold text-gray-900">{item.name}</h3>
                                    {item.variant?.name && (
                                        <p className="text-sm text-brand-primary">סוג לחם: {item.variant.name}</p>
                                    )}
                                    {addonNames && (
                                        <p className="text-xs text-gray-500">תוספות: {addonNames}</p>
                                    )}
                                    <p className="text-xs text-gray-400">₪{item.unitPrice.toFixed(2)} ליחידה</p>
                                </div>

                                <div className="flex items-center gap-4">
                                    {/* כמות */}
                                    <div className="flex items-center gap-2 border border-gray-300 rounded">
                                        <button
                                            onClick={() => handleQuantityChange(item.cartKey, item.qty - 1)}
                                            className="px-3 py-1 text-gray-600 hover:bg-gray-100"
                                        >
                                            −
                                        </button>
                                        <span className="px-3 py-1 min-w-[40px] text-center">{item.qty}</span>
                                        <button
                                            onClick={() => handleQuantityChange(item.cartKey, item.qty + 1)}
                                            className="px-3 py-1 text-gray-600 hover:bg-gray-100"
                                        >
                                            +
                                        </button>
                                    </div>

                                    {/* מחיר כולל לפריט */}
                                    <div className="min-w-[80px] text-right">
                                        <p className="font-semibold text-brand-accent">
                                            ₪{item.totalPrice.toFixed(2)}
                                        </p>
                                    </div>

                                    {/* הסרה */}
                                    <button
                                        onClick={() => removeFromCart(item.cartKey)}
                                        className="text-red-600 hover:text-red-800 font-semibold"
                                    >
                                        ×
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* סכום ביניים */}
                <div className="border-t-2 border-gray-300 pt-4 space-y-2">
                    <div className="flex justify-between items-center text-lg">
                        <span>סכום ביניים:</span>
                        <span className="text-gray-700">₪{total.toFixed(2)}</span>
                    </div>

                    {customerInfo.delivery_method === 'delivery' && (
                        <div className="flex justify-between items-center text-lg">
                            <div className="flex items-center gap-2">
                                <span>דמי משלוח:</span>
                                {checkingZone && <span className="text-xs text-gray-500">⏳ בודק...</span>}
                            </div>
                            <span className="text-gray-700">
                                {deliveryFee > 0 ? `₪${deliveryFee.toFixed(2)}` : checkingZone ? '...' : '₪0.00'}
                            </span>
                        </div>
                    )}

                    <div className="flex justify-between items-center text-2xl font-bold border-t pt-2">
                        <span>סה"כ לתשלום:</span>
                        <span className="text-brand-accent">₪{totalWithDelivery.toFixed(2)}</span>
                    </div>

                    {deliveryLocation && customerInfo.delivery_method === 'delivery' && (
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-blue-50 p-3 rounded-lg text-sm">
                            <div className="flex-1">
                                <p className="font-medium text-blue-900 text-xs sm:text-sm break-words">
                                    📍 {deliveryLocation.fullAddress ||
                                        (deliveryLocation.street && deliveryLocation.cityName
                                            ? `${deliveryLocation.street}, ${deliveryLocation.cityName}`
                                            : deliveryLocation.cityName || 'מיקום למשלוח')}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowLocationModal(true)}
                                className="text-blue-700 underline text-xs hover:text-blue-900 whitespace-nowrap self-end sm:self-auto"
                            >
                                שנה מיקום
                            </button>
                        </div>
                    )}
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
                            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                                <label className={`w-full sm:flex-1 border rounded-lg p-3 cursor-pointer text-sm sm:text-base ${customerInfo.delivery_method === 'pickup' ? 'border-brand-primary bg-brand-primary/5' : 'border-gray-300'}`}>
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
                                <label className={`w-full sm:flex-1 border rounded-lg p-3 cursor-pointer text-sm sm:text-base ${customerInfo.delivery_method === 'delivery' ? 'border-brand-primary bg-brand-primary/5' : 'border-gray-300'}`}>
                                    <input
                                        type="radio"
                                        name="delivery_method"
                                        value="delivery"
                                        checked={customerInfo.delivery_method === 'delivery'}
                                        onChange={(e) => {
                                            setCustomerInfo({ ...customerInfo, delivery_method: e.target.value });
                                            if (!deliveryLocation) {
                                                setShowLocationModal(true);
                                            }
                                        }}
                                        className="mr-2"
                                    />
                                    משלוח
                                </label>
                            </div>
                            {customerInfo.delivery_method === 'delivery' && (
                                <div className="mt-3 space-y-2">
                                    {!deliveryLocation && (
                                        <button
                                            type="button"
                                            onClick={() => setShowLocationModal(true)}
                                            className="w-full text-sm bg-blue-50 text-blue-700 px-3 py-2 rounded-lg hover:bg-blue-100"
                                        >
                                            📍 בחר מיקום למשלוח
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => setShowDeliveryModal(true)}
                                        className="text-sm text-brand-primary underline"
                                    >
                                        עריכת פרטי משלוח
                                    </button>
                                </div>
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
                            href={tenantId ? `/${tenantId}/menu` : '/'}
                            className="flex-1 bg-gray-300 text-gray-800 font-bold py-4 rounded-lg text-center hover:bg-gray-400 transition"
                        >
                            {UI_TEXT.BTN_CANCEL}
                        </a>
                    </div>

                    <div className="mt-3 text-center text-xs text-gray-500">
                        שליחת הזמנה מהווה הסכמה ל{' '}
                        <Link to="/legal/end-user" className="text-brand-primary hover:underline font-semibold">
                            תנאי השימוש למשתמשי קצה
                        </Link>
                        {' '}ו{' '}
                        <Link to="/legal/privacy" className="text-brand-primary hover:underline font-semibold">
                            מדיניות הפרטיות
                        </Link>
                        .
                    </div>
                </form>
            </div>
        </CustomerLayout>
    );
}
