import React, { useState } from 'react';
import PhoneVerificationModal from '../components/PhoneVerificationModal';
import LocationPickerModal from '../components/LocationPickerModal';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { CustomerLayout } from '../layouts/CustomerLayout';
import { FaMask, FaBoxOpen, FaStickyNote, FaTimes, FaShoppingCart, FaUser, FaPhone, FaMapMarkerAlt, FaMoneyBillWave, FaCreditCard, FaTruck, FaStore, FaHome, FaEdit, FaComment, FaExclamationTriangle } from 'react-icons/fa';
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
    const [showNotesModal, setShowNotesModal] = useState(false);
    const [tempNotes, setTempNotes] = useState('');

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

        // בדיקת מיקום ופרטי משלוח
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

            // ולידציה קפדנית של כתובת מלאה
            const address = customerInfo.delivery_address || '';
            const hasStreet = address && !address.match(/^[^,]+$/); // יש פסיק = יש יותר מחלק אחד
            const parts = address.split(',').map(p => p.trim());
            const hasMultipleParts = parts.length >= 2;
            const hasNumber = /\d/.test(address); // בדיקה שיש מספר בכתובת

            // בדיקה שיש רחוב + מספר בית + עיר (לא רק עיר או רחוב בלי מספר)
            if (!address || !hasStreet || !hasMultipleParts || !hasNumber) {
                setShowDeliveryModal(true);
                setError('נא להשלים כתובת משלוח מלאה (רחוב, מספר בית ועיר)');
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
                    addons: (item.addons || []).map((addon) => ({
                        addon_id: addon.id,
                        on_side: addon.on_side || false
                    })),
                    qty: item.qty,
                })),
            };
            console.log('📦 Sending order data:', orderData);
            console.log('📞 Customer info for SMS:', customerInfo);
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

                        // בדיקה אם המיקום חסר פרטים (רק עיר ללא רחוב)
                        const needsCompletion = !location.street || location.needsCompletion;

                        // Update delivery address automatically from location
                        if (location.fullAddress) {
                            setCustomerInfo({ ...customerInfo, delivery_address: location.fullAddress });
                        }

                        // אם חסרים פרטים, פתח מיד את מודל פרטי המשלוח
                        if (needsCompletion) {
                            setTimeout(() => {
                                setShowDeliveryModal(true);
                            }, 300); // המתנה קצרה לסגירת המודל הקודם
                        }
                    }}
                />
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-100 rounded-2xl">
                        <FaShoppingCart className="text-2xl text-blue-600" />
                    </div>
                    <h1 className="text-3xl font-black text-gray-900">סל קניות</h1>
                </div>

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
                    setCustomerInfo={setCustomerInfo} deliveryLocation={deliveryLocation} onSaved={() => {
                        // אחרי שמירת פרטי משלוח אפשר להתקדם לשלב אישור
                        setSubmitStep('confirm');
                    }}
                />

                {/* פריטים בסל */}
                <div className="space-y-2">
                    {cartItems.map((item) => {
                        const addonsInside = (item.addons || []).filter(a => !a.on_side).map(a => a.name);
                        const addonsOnSide = (item.addons || []).filter(a => a.on_side).map(a => a.name);

                        return (
                            <div
                                key={item.cartKey}
                                className="bg-white border-2 border-gray-200 rounded-2xl p-5 hover:shadow-lg transition-shadow"
                            >
                                <div className="flex justify-between items-start gap-4">
                                    <div className="flex-1 space-y-2">
                                        <h3 className="font-bold text-gray-900 text-lg">{item.name}</h3>
                                        {item.variant?.name && (
                                            <p className="text-sm text-blue-600 font-medium">סוג לחם: {item.variant.name}</p>
                                        )}
                                        {addonsInside.length > 0 && (
                                            <p className="text-sm text-gray-600">תוספות: {addonsInside.join(' · ')}</p>
                                        )}
                                        {addonsOnSide.length > 0 && (
                                            <p className="text-sm text-orange-600 font-medium flex items-center gap-1">
                                                <FaBoxOpen />
                                                <span>בצד: {addonsOnSide.join(' · ')}</span>
                                            </p>
                                        )}
                                        <p className="text-xs text-gray-500">₪{item.unitPrice.toFixed(2)} ליחידה</p>
                                    </div>

                                    <div className="flex flex-col items-end gap-3">
                                        {/* מחיר כולל */}
                                        <div className="text-right">
                                            <p className="font-black text-xl text-gray-900">
                                                ₪{item.totalPrice.toFixed(2)}
                                            </p>
                                        </div>

                                        {/* קוביית כמות משופרת */}
                                        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
                                            <button
                                                onClick={() => handleQuantityChange(item.cartKey, item.qty - 1)}
                                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white hover:bg-red-50 hover:text-red-600 text-gray-600 font-bold transition-all shadow-sm"
                                            >
                                                −
                                            </button>
                                            <span className="w-10 text-center font-bold text-gray-900">{item.qty}</span>
                                            <button
                                                onClick={() => handleQuantityChange(item.cartKey, item.qty + 1)}
                                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white hover:bg-green-50 hover:text-green-600 text-gray-600 font-bold transition-all shadow-sm"
                                            >
                                                +
                                            </button>
                                        </div>

                                        {/* הסרה */}
                                        <button
                                            onClick={() => removeFromCart(item.cartKey)}
                                            className="text-red-500 hover:text-red-700 font-bold text-xl transition-colors"
                                        >
                                            ×
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* סכום ביניים */}
                <div className="bg-gradient-to-br from-gray-50 to-blue-50 border-2 border-gray-200 rounded-2xl p-6 space-y-3">
                    <div className="flex justify-between items-center text-lg">
                        <span className="font-medium text-gray-700">סכום ביניים:</span>
                        <span className="font-bold text-gray-900">₪{total.toFixed(2)}</span>
                    </div>

                    {customerInfo.delivery_method === 'delivery' && (
                        <div className="flex justify-between items-center text-lg">
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-700">דמי משלוח:</span>
                                {checkingZone && <span className="text-xs text-gray-500">⏳ בודק...</span>}
                            </div>
                            <span className="font-bold text-gray-900">
                                {deliveryFee > 0 ? `₪${deliveryFee.toFixed(2)}` : checkingZone ? '...' : '₪0.00'}
                            </span>
                        </div>
                    )}

                    <div className="flex justify-between items-center text-2xl font-black border-t-2 border-gray-300 pt-3">
                        <span className="text-gray-900">סה"כ לתשלום:</span>
                        <span className="text-blue-600">₪{totalWithDelivery.toFixed(2)}</span>
                    </div>

                    {/* כפתור הערות קטן וחמוד */}
                    <div className="flex justify-center mt-4">
                        <button
                            type="button"
                            onClick={() => {
                                const initialNotes = customerInfo?.delivery_notes || '';
                                setTempNotes(initialNotes);
                                setShowNotesModal(true);
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 font-medium text-sm rounded-full transition-all shadow-sm hover:shadow-md active:scale-95"
                        >
                            <FaStickyNote className="text-amber-600" />
                            <span>{customerInfo?.delivery_notes ? 'ערוך הערה' : 'הוסף הערה'}</span>
                            {customerInfo?.delivery_notes && (
                                <span className="bg-amber-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                                    ✓
                                </span>
                            )}
                        </button>
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
                <form id="cart-order-form" onSubmit={handleSubmitOrder} className="space-y-6 bg-white border border-gray-200 p-6 sm:p-8 rounded-2xl shadow-sm">
                    <div className="flex items-center gap-2 pb-4 border-b border-gray-200">
                        <FaUser className="text-blue-600" />
                        <h2 className="text-xl font-black text-gray-900">פרטים אישיים</h2>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
                            שם מלא*
                        </label>
                        <div className="relative">
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                                <FaUser />
                            </div>
                            <input
                                type="text"
                                value={customerInfo.name}
                                onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                                placeholder="הקלד את שמך המלא"
                                className="w-full pr-10 pl-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
                            טלפון*
                        </label>
                        <div className="relative">
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                                <FaPhone />
                            </div>
                            <input
                                type="tel"
                                value={customerInfo.phone}
                                onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                                placeholder="050-1234567"
                                className="w-full pr-10 pl-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all dir-ltr text-right"
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <p className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-3">שיטת קבלה</p>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <label className={`w-full sm:flex-1 border-2 rounded-xl p-4 cursor-pointer transition-all ${customerInfo.delivery_method === 'pickup' ? 'border-blue-500 bg-blue-50 shadow-md' : 'border-gray-200 hover:border-gray-300'}`}>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="radio"
                                            name="delivery_method"
                                            value="pickup"
                                            checked={customerInfo.delivery_method === 'pickup'}
                                            onChange={(e) => setCustomerInfo({ ...customerInfo, delivery_method: e.target.value })}
                                            className="w-4 h-4"
                                        />
                                        <FaStore className={customerInfo.delivery_method === 'pickup' ? 'text-blue-600' : 'text-gray-400'} />
                                        <span className="font-semibold text-gray-900">איסוף עצמי</span>
                                    </div>
                                </label>
                                <label className={`w-full sm:flex-1 border-2 rounded-xl p-4 cursor-pointer transition-all ${customerInfo.delivery_method === 'delivery' ? 'border-blue-500 bg-blue-50 shadow-md' : 'border-gray-200 hover:border-gray-300'}`}>
                                    <div className="flex items-center gap-3">
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
                                            className="w-4 h-4"
                                        />
                                        <FaTruck className={customerInfo.delivery_method === 'delivery' ? 'text-blue-600' : 'text-gray-400'} />
                                        <span className="font-semibold text-gray-900">משלוח</span>
                                    </div>
                                </label>
                            </div>
                            {customerInfo.delivery_method === 'delivery' && (
                                <div className="mt-3 space-y-2">
                                    {!deliveryLocation && (
                                        <button
                                            type="button"
                                            onClick={() => setShowLocationModal(true)}
                                            className="w-full text-sm bg-blue-50 text-blue-700 px-3 py-2 rounded-lg hover:bg-blue-100 flex items-center justify-center gap-2"
                                        >
                                            <FaMapMarkerAlt /> בחר מיקום למשלוח
                                        </button>
                                    )}

                                    {/* תצוגת כתובת קיימת או כפתור הוספה */}
                                    {customerInfo.delivery_address ? (
                                        <>
                                            {(() => {
                                                const address = customerInfo.delivery_address;
                                                const parts = address.split(',').map(p => p.trim());
                                                const hasNumber = /\d/.test(address);
                                                const isIncomplete = parts.length < 2 || !address.includes(',') || !hasNumber;

                                                return (
                                                    <div className={`border-2 rounded-xl p-3 ${isIncomplete ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-300' : 'bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200'}`}>
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="flex-1">
                                                                <p className="text-xs font-bold uppercase tracking-wide mb-1 flex items-center gap-1" style={{ color: isIncomplete ? '#b45309' : '#2563eb' }}>
                                                                    <FaMapMarkerAlt /> כתובת משלוח
                                                                </p>
                                                                <p className="text-sm font-bold text-gray-900">
                                                                    {customerInfo.delivery_address}
                                                                </p>
                                                                {isIncomplete && (
                                                                    <div className="mt-2 flex items-start gap-1 text-xs text-orange-700 bg-orange-100 p-2 rounded-lg">
                                                                        <FaExclamationTriangle className="mt-0.5" />
                                                                        <span>
                                                                            <strong>כתובת לא מלאה!</strong> נדרש רחוב + מספר בית + עיר
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                {customerInfo.delivery_notes && (
                                                                    <p className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                                                                        <FaComment /> {customerInfo.delivery_notes}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => setShowDeliveryModal(true)}
                                                                className="px-3 py-1.5 bg-white hover:bg-blue-50 text-blue-600 text-xs font-bold rounded-lg border-2 border-blue-200 hover:border-blue-300 transition-all whitespace-nowrap flex items-center gap-1"
                                                            >
                                                                <FaEdit /> ערוך
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => setShowDeliveryModal(true)}
                                            className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white px-4 py-3 rounded-xl font-bold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                                        >
                                            <FaHome /> הוסף פרטי משלוח
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="border-2 border-gray-200 rounded-xl p-4 bg-gradient-to-br from-green-50 to-emerald-50">
                            <div className="flex items-center gap-2 mb-2">
                                <FaMoneyBillWave className="text-green-600" />
                                <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">תשלום</p>
                            </div>
                            <p className="text-gray-900 font-bold flex items-center gap-2">
                                <FaCreditCard className="text-green-600" />
                                מזומן בלבד
                            </p>
                            <p className="text-xs text-gray-600 mt-1">תשלום בעת איסוף/משלוח</p>
                        </div>
                    </div>

                    {/* כפתורים */}
                    <div className="flex flex-col sm:flex-row gap-3 mt-6">
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-black py-4 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
                        >
                            {submitting
                                ? 'שולח...'
                                : submitStep === 'payment'
                                    ? 'שלם עכשיו'
                                    : 'שלח הזמנה'}
                        </button>
                        <a
                            href={tenantId ? `/${tenantId}/menu` : '/'}
                            className="flex-1 bg-gray-200 text-gray-800 font-bold py-4 rounded-xl text-center hover:bg-gray-300 transition-all"
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

                {/* מודל הערות למנה */}
                {showNotesModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full animate-fade-in">
                            {/* כותרת המודל */}
                            <div className="bg-gradient-to-r from-amber-500 to-yellow-500 p-6 rounded-t-2xl relative">
                                <button
                                    onClick={() => setShowNotesModal(false)}
                                    className="absolute top-4 left-4 text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-all"
                                >
                                    <FaTimes className="text-xl" />
                                </button>
                                <div className="flex items-center gap-3 justify-center">
                                    <FaStickyNote className="text-white text-3xl" />
                                    <h3 className="text-2xl font-bold text-white">הערה להזמנה</h3>
                                </div>
                                <p className="text-white text-opacity-90 text-sm text-center mt-2">
                                    הוסף הוראות מיוחדות, העדפות או בקשות להזמנה שלך
                                </p>
                            </div>

                            {/* תוכן המודל */}
                            <div className="p-6 space-y-4">
                                <textarea
                                    value={tempNotes}
                                    onChange={(e) => setTempNotes(e.target.value)}
                                    placeholder="הוסף כאן את ההערות שלך..."
                                    className="w-full px-4 py-3 border-2 border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none text-gray-700 placeholder-gray-400"
                                    rows={3}
                                    maxLength={30}
                                    autoFocus
                                />
                                <div className="flex justify-between items-center text-xs">
                                    <span className={`font-medium ${tempNotes.length >= 25 ? 'text-orange-600' : 'text-gray-500'}`}>
                                        {tempNotes.length}/30 תווים
                                    </span>
                                    {tempNotes.length > 0 && (
                                        <button
                                            onClick={() => setTempNotes('')}
                                            className="text-red-500 hover:text-red-700 font-medium"
                                        >
                                            נקה הכל
                                        </button>
                                    )}
                                </div>

                                {/* כפתורים */}
                                <div className="flex gap-3 pt-2">
                                    <button
                                        onClick={() => setShowNotesModal(false)}
                                        className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors"
                                    >
                                        ביטול
                                    </button>
                                    <button
                                        onClick={() => {
                                            setCustomerInfo({ ...customerInfo, delivery_notes: tempNotes });
                                            setShowNotesModal(false);
                                        }}
                                        className="flex-1 py-3 px-4 bg-gradient-to-r from-amber-500 to-yellow-500 text-white font-bold rounded-lg hover:from-amber-600 hover:to-yellow-600 transition-all shadow-md hover:shadow-lg"
                                    >
                                        שמור הערה
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </CustomerLayout>
    );
}
