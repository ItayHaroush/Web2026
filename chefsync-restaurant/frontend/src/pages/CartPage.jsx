import React, { useState, useEffect, useMemo } from 'react';
import PhoneVerificationModal from '../components/PhoneVerificationModal';
import LocationPickerModal from '../components/LocationPickerModal';
import OrderConfirmationSheet from '../components/OrderConfirmationSheet';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useCustomer } from '../context/CustomerContext';
import { CustomerLayout } from '../layouts/CustomerLayout';
import { FaMask, FaBoxOpen, FaStickyNote, FaTimes, FaShoppingCart, FaUser, FaPhone, FaMapMarkerAlt, FaMoneyBillWave, FaCreditCard, FaTruck, FaStore, FaHome, FaEdit, FaComment, FaExclamationTriangle, FaGift, FaSearch, FaClock, FaPlus, FaMinus, FaStar } from 'react-icons/fa';
import orderService from '../services/orderService';
import menuService from '../services/menuService';
import { UI_TEXT } from '../constants/ui';
import DeliveryDetailsModal from '../components/DeliveryDetailsModal';
import { isValidIsraeliMobile } from '../utils/phone';
import apiClient from '../services/apiClient';
import { usePromotions } from '../context/PromotionContext';
import PromotionProgress from '../components/PromotionProgress';
import GiftSelectionModal from '../components/GiftSelectionModal';
import MenuItemModal from '../components/MenuItemModal';
import FutureOrderModal from '../components/FutureOrderModal';
import CartCheckoutWizard from '../components/CartCheckoutWizard';
import { resolveAssetUrl } from '../utils/assets';
import { notifyActiveOrdersStorageChanged } from '../utils/activeOrdersStorage';
import { computeClientPromotionDiscount } from '../utils/promotionDiscountPreview';

/**
 * עמוד סל קניות
 * @param {boolean} isPreviewMode - האם זה מצב תצוגה מקדימה (admin)
 */

export default function CartPage({ isPreviewMode: propIsPreviewMode = false }) {
    const navigate = useNavigate();
    const { tenantId } = useAuth();
    const { cartItems, removeFromCart, updateQuantity, getTotal, clearCart, customerInfo, setCustomerInfo, phoneVerified, setPhoneVerified, addToCart, scheduledFor, setScheduledFor } = useCart();
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [showPhoneModal, setShowPhoneModal] = useState(false);
    const [showDeliveryModal, setShowDeliveryModal] = useState(false);
    const [showLocationModal, setShowLocationModal] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [deliveryLocation, setDeliveryLocation] = useState(null);
    const [deliveryFee, setDeliveryFee] = useState(0);

    // מצב preview נקבע אך ורק מ-prop שמועבר ע"י AdminCartPreview
    const isPreviewMode = propIsPreviewMode;
    const [deliveryZoneAvailable, setDeliveryZoneAvailable] = useState(true);
    const [checkingZone, setCheckingZone] = useState(false);
    const [restaurant, setRestaurant] = useState(null);
    const [showNotesModal, setShowNotesModal] = useState(false);
    const [showMinimumModal, setShowMinimumModal] = useState(false);
    const [tempNotes, setTempNotes] = useState('');
    const [giftPromotion, setGiftPromotion] = useState(null);
    const { getAppliedPromotions, eligiblePromotions, selectedGifts } = usePromotions();
    const [menuCategories, setMenuCategories] = useState([]);
    const [promoCategoryModal, setPromoCategoryModal] = useState(null);
    const [promoMenuItem, setPromoMenuItem] = useState(null);
    const { isRecognized, customerToken, customer } = useCustomer();
    const [savedAddresses, setSavedAddresses] = useState([]);

    const isRegisteredCustomer = isRecognized && !!customer?.id;
    // הזמנה עתידית — זמינה גם כשהמסעדה פתוחה, כל עוד allow_future_orders פעיל
    const canFutureOrder = restaurant?.allow_future_orders && (restaurant?.accepts_credit_card || isRegisteredCustomer);

    const paymentMethodsPublic = restaurant?.available_payment_methods || ['cash'];
    const creditAvailableForCheckout = paymentMethodsPublic.includes('credit_card');
    /** תשלום אפקטיבי ל-UI ולשליחה — לא להציג/לשלוח אשראי אם המסעדה לא מציעה */
    const effectivePaymentMethod =
        creditAvailableForCheckout && customerInfo.payment_method === 'credit_card'
            ? 'credit_card'
            : 'cash';
    const [showFutureOrderModal, setShowFutureOrderModal] = useState(false);
    /** מודל: אחרי מפה / כתובת חסרה — להציע כתובת שמורה למשתמש רשום */
    const [showSavedAddressChoiceModal, setShowSavedAddressChoiceModal] = useState(false);
    /** כתובת שמורה שנבחרה — לרזולוציית lat/lng בשרת אם צריך */
    const [selectedCustomerAddressId, setSelectedCustomerAddressId] = useState(null);

    /** שלבי תשלום חכמים: 1=סל, 2=פרטים+סיכום, 3=סיום (בלי לשנות לוגיקת submit) */
    const [checkoutStep, setCheckoutStep] = useState(1);
    const goCheckoutStep = (step) => {
        setCheckoutStep(step);
        if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    useEffect(() => {
        setCheckoutStep(1);
    }, [tenantId]);

    // אשראי לא זמין למסעדה — לא להשאיר payment_method על credit_card (למשל אחרי בחירת עתידית כאורח)
    useEffect(() => {
        if (!restaurant) return;
        if (!creditAvailableForCheckout) {
            setCustomerInfo((prev) =>
                prev.payment_method === 'credit_card' ? { ...prev, payment_method: 'cash' } : prev
            );
        }
    }, [restaurant?.id, creditAvailableForCheckout, setCustomerInfo]);

    // Fetch menu for category quick-add modal
    useEffect(() => {
        menuService.getMenu()
            .then(data => setMenuCategories(data || []))
            .catch(() => { });
    }, []);

    // Fetch saved addresses for logged-in users
    useEffect(() => {
        if (!customerToken) return;
        apiClient.get('/customer/addresses', {
            headers: { Authorization: `Bearer ${customerToken}` },
        }).then(res => {
            if (res.data?.success) setSavedAddresses(res.data.data || []);
        }).catch(() => { });
    }, [customerToken]);

    const handlePromoCategoryAdd = (item) => {
        const category = menuCategories.find(cat => (cat.items || []).some(i => i.id === item.id));
        addToCart({
            menuItemId: item.id,
            categoryId: category?.id,
            name: item.name,
            price: item.price,
            variant: null,
            addons: [],
            qty: 1,
        });
    };

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

    /**
     * נקודת משלוח מפרופיל הלקוח (default_delivery_lat/lng) — בלי לפתוח מפה אם יש נ.צ. מעודכן.
     */
    const syncDeliveryFromCustomerProfile = React.useCallback(() => {
        if (!customer?.default_delivery_lat || !customer?.default_delivery_lng) {
            return false;
        }
        const lat = parseFloat(customer.default_delivery_lat);
        const lng = parseFloat(customer.default_delivery_lng);
        if (Number.isNaN(lat) || Number.isNaN(lng)) {
            return false;
        }

        let fullAddress = (customer.default_delivery_address || '').trim();
        const street = customer.default_delivery_street || '';
        const city = customer.default_delivery_city || '';
        const hn = customer.default_delivery_house_number || '';
        if (!fullAddress && (street || city)) {
            fullAddress = `${street} ${hn}, ${city}`.replace(/\s+/g, ' ').trim();
        }
        if (!fullAddress) {
            fullAddress = 'כתובת מפרופיל';
        }

        const locationData = {
            lat,
            lng,
            fullAddress,
            street,
            cityName: city,
            house_number: hn || '',
            needsCompletion: false,
        };
        setDeliveryLocation(locationData);
        setSelectedCustomerAddressId(null);
        try {
            localStorage.setItem('user_delivery_location', JSON.stringify(locationData));
        } catch {
            /* ignore */
        }

        setCustomerInfo((prev) => {
            if (prev.delivery_address?.trim()) {
                return prev;
            }
            const line = fullAddress === 'כתובת מפרופיל' ? '' : fullAddress;
            return line ? { ...prev, delivery_address: line } : prev;
        });
        return true;
    }, [customer, setCustomerInfo]);

    /** ניסיון לטעון מיקום מ-localStorage כשעוברים למשלוח (אחרי פרופיל) */
    const tryHydrateDeliveryFromLocalStorage = React.useCallback(() => {
        try {
            const stored = localStorage.getItem('user_delivery_location');
            if (!stored) {
                return false;
            }
            const parsed = JSON.parse(stored);
            const la = parseFloat(parsed.lat);
            const ln = parseFloat(parsed.lng);
            if (Number.isNaN(la) || Number.isNaN(ln)) {
                return false;
            }
            setDeliveryLocation(parsed);
            setSelectedCustomerAddressId(null);
            return true;
        } catch {
            return false;
        }
    }, []);

    /** החלת כתובת שמורה — מזינה כתובת, מיקום, localStorage ובדיקת אזור */
    const applySavedAddress = (addr) => {
        const fullAddress = `${addr.street} ${addr.house_number || ''}${addr.apartment ? `, דירה ${addr.apartment}` : ''}, ${addr.city}`.replace(/\s+/g, ' ').trim();
        setSelectedCustomerAddressId(addr.id ?? null);
        setCustomerInfo((prev) => ({
            ...prev,
            delivery_address: fullAddress,
            delivery_notes: addr.notes != null && String(addr.notes).trim() !== '' ? addr.notes : prev.delivery_notes,
        }));
        if (addr.lat != null && addr.lng != null) {
            const lat = parseFloat(addr.lat);
            const lng = parseFloat(addr.lng);
            const locationData = {
                lat,
                lng,
                cityName: addr.city || '',
                street: addr.street || '',
                house_number: addr.house_number || '',
                fullAddress,
                needsCompletion: false,
            };
            setDeliveryLocation(locationData);
            try {
                localStorage.setItem('user_delivery_location', JSON.stringify(locationData));
            } catch {
                /* ignore */
            }
            checkDeliveryZoneAvailability(lat, lng);
        } else {
            try {
                localStorage.removeItem('user_delivery_location');
            } catch {
                /* ignore */
            }
            setDeliveryLocation({
                fullAddress,
                street: addr.street || '',
                cityName: addr.city || '',
                house_number: addr.house_number || '',
                needsCompletion: true,
            });
            setDeliveryZoneAvailable(false);
            setDeliveryFee(0);
            setShowLocationModal(true);
        }
        setError(null);
        setShowSavedAddressChoiceModal(false);
    };

    // משלוח ללא מודל מפה אם יש נ.צ.: פרופיל → localStorage → כתובת שמורה כברירת מחדל
    React.useEffect(() => {
        if (customerInfo.delivery_method !== 'delivery') {
            return;
        }
        if (deliveryLocation?.lat != null && deliveryLocation?.lng != null) {
            return;
        }
        if (syncDeliveryFromCustomerProfile()) {
            return;
        }
        if (tryHydrateDeliveryFromLocalStorage()) {
            return;
        }
        const defAddr = savedAddresses.find((a) => a.is_default && a.lat != null && a.lng != null);
        if (defAddr) {
            applySavedAddress(defAddr);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- applySavedAddress יציב לוגית; נמנע לולאת רינדור
    }, [
        customerInfo.delivery_method,
        deliveryLocation?.lat,
        deliveryLocation?.lng,
        syncDeliveryFromCustomerProfile,
        tryHydrateDeliveryFromLocalStorage,
        savedAddresses,
    ]);

    const deliveryHasValidCoords =
        deliveryLocation?.lat != null &&
        deliveryLocation?.lng != null &&
        !Number.isNaN(parseFloat(deliveryLocation.lat)) &&
        !Number.isNaN(parseFloat(deliveryLocation.lng));

    const handleQuantityChange = (itemKey, newQuantity) => {
        if (newQuantity < 1) {
            removeFromCart(itemKey);
        } else {
            updateQuantity(itemKey, newQuantity);
        }
    };

    const handleProceedToConfirmation = async (e) => {
        e.preventDefault();
        setError(null);

        // בדוק שנתונים בסיסיים קיימים
        if (!customerInfo.name || !customerInfo.phone) {
            setError('אנא מלא שם וטלפון');
            return;
        }

        // בדיקת מינימום הזמנה למשלוח
        if (isBelowMinimum) {
            setShowMinimumModal(true);
            return;
        }

        // כשמסעדה סגורה — חובה לבחור זמן להזמנה עתידית
        if (canFutureOrder && !restaurant?.is_open_now && !scheduledFor) {
            setError('המסעדה סגורה. יש לבחור תאריך ושעה להזמנה עתידית.');
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
                setError(null);
                if (isRegisteredCustomer && savedAddresses.length > 0) {
                    setShowSavedAddressChoiceModal(true);
                    return;
                }
                setShowDeliveryModal(true);
                setError('נא להשלים כתובת משלוח מלאה (רחוב, מספר בית ועיר)');
                return;
            }
        }

        // דילוג OTP אם יש טוקן לקוח (כבר אומת בהרשמה)
        if (!phoneVerified && localStorage.getItem('customer_token')) {
            setPhoneVerified(true);
        }

        // אם הטלפון לא אומת, פתח modal
        if (!phoneVerified && !localStorage.getItem('customer_token')) {
            setShowPhoneModal(true);
            return;
        }

        // כל האימותים עברו - פתח מודל אישור
        setShowConfirmation(true);
    };

    const handleConfirmOrder = async () => {
        try {
            setSubmitting(true);

            const orderData = {
                customer_name: customerInfo.name,
                customer_phone: customerInfo.phone,
                delivery_method: customerInfo.delivery_method || 'pickup',
                payment_method: effectivePaymentMethod,
                delivery_address: customerInfo.delivery_method === 'delivery'
                    ? (customerInfo.delivery_address || deliveryLocation?.fullAddress || deliveryLocation?.address || 'מיקום GPS')
                    : undefined,
                delivery_city: customerInfo.delivery_method === 'delivery'
                    ? (deliveryLocation?.cityName || undefined)
                    : undefined,
                delivery_street: customerInfo.delivery_method === 'delivery'
                    ? (deliveryLocation?.street || undefined)
                    : undefined,
                delivery_house_number: customerInfo.delivery_method === 'delivery'
                    ? (deliveryLocation?.house_number || undefined)
                    : undefined,
                delivery_notes: customerInfo.delivery_notes || undefined,
                delivery_lat: customerInfo.delivery_method === 'delivery' ? deliveryLocation?.lat : undefined,
                delivery_lng: customerInfo.delivery_method === 'delivery' ? deliveryLocation?.lng : undefined,
                customer_address_id: customerInfo.delivery_method === 'delivery' ? (selectedCustomerAddressId ?? undefined) : undefined,
                items: cartItems.map((item) => ({
                    menu_item_id: item.menuItemId,
                    variant_id: item.variant?.id ?? null,
                    addons: (item.addons || []).map((addon) => ({
                        addon_id: addon.id,
                        on_side: addon.on_side || false,
                        quantity: addon.quantity || 1,
                    })),
                    qty: item.qty,
                })),
                // הוספת שדות test אם זה מצב preview
                is_test: isPreviewMode || false,
                test_note: isPreviewMode ? 'הזמנה מתצוגה מקדימה - Admin' : undefined,
                // מבצעים שהלקוח עומד בתנאים שלהם
                applied_promotions: getAppliedPromotions(),
                // הזמנה עתידית
                scheduled_for: scheduledFor || undefined,
            };
            console.log('📦 Sending order data:', orderData);
            console.log('📞 Customer info for SMS:', customerInfo);
            const response = await orderService.createOrder(orderData);
            const resolvedTenantSlug = tenantId || localStorage.getItem('tenantId');
            if (resolvedTenantSlug) {
                // Multi-order: שומר מערך של הזמנות פעילות
                const key = `activeOrders_${resolvedTenantSlug}`;
                let activeOrders = [];
                try { activeOrders = JSON.parse(localStorage.getItem(key)) || []; } catch { activeOrders = []; }
                if (!activeOrders.includes(response.data.id)) {
                    activeOrders.push(response.data.id);
                }
                localStorage.setItem(key, JSON.stringify(activeOrders));
                localStorage.setItem(`order_tenant_${response.data.id}`, resolvedTenantSlug);
                notifyActiveOrdersStorageChanged();
            }
            clearCart();
            setShowConfirmation(false);

            // התחברות אוטומטית של הלקוח אחרי הזמנה (אם לא מחובר)
            try {
                const { loginWithPhone, isRecognized } = window.__customerContext || {};
                // Alternative: use localStorage directly since context might not be available here
                if (!localStorage.getItem('customer_token') && customerInfo.phone && customerInfo.name) {
                    // נסה ליצור טוקן לקוח — כשלון שקט
                    apiClient.post('/customer/auth/phone', {
                        phone: customerInfo.phone,
                        name: customerInfo.name,
                    }).then(res => {
                        if (res.data?.success) {
                            localStorage.setItem('customer_token', res.data.data.token);
                            localStorage.setItem('customer_data', JSON.stringify(res.data.data.customer));
                        }
                    }).catch(() => { /* כשלון שקט */ });
                }
            } catch { /* ignore */ }

            // B2C: אם יש payment_url — redirect לדף תשלום HYP
            if (response.payment_url) {
                window.location.href = response.payment_url;
                return;
            }

            // ניווט שונה בהתאם למצב
            if (isPreviewMode) {
                navigate(`/admin/preview-order-status/${response.data.id}`);
            } else {
                navigate(`/${resolvedTenantSlug || ''}/order-status/${response.data.id}`);
            }
        } catch (err) {
            console.error('שגיאה בהגשת הזמנה:', err);
            setShowConfirmation(false);
            if (err.response?.status === 429 && err.response?.data?.error === 'orders_limit_reached') {
                setError('המסעדה הגיעה למגבלת ההזמנות החודשית. אנא נסו שוב מאוחר יותר.');
            } else {
                setError(err.response?.data?.message || 'שגיאה בהגשת ההזמנה');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const menuItemNameById = useMemo(() => {
        const m = new Map();
        for (const cat of menuCategories || []) {
            for (const item of cat.items || []) {
                m.set(Number(item.id), item.name);
            }
        }
        return m;
    }, [menuCategories]);

    if (cartItems.length === 0) {
        return (
            <CustomerLayout>
                <div className="space-y-6">
                    {restaurant && (
                        <div className="flex items-center gap-3 rounded-2xl border border-gray-200 dark:border-brand-dark-border bg-white dark:bg-brand-dark-surface px-3 py-2.5 sm:px-4 shadow-sm">
                            {restaurant.logo_url ? (
                                <img src={resolveAssetUrl(restaurant.logo_url)} alt="" className="h-11 w-11 sm:h-12 sm:w-12 object-contain rounded-xl bg-gray-50 dark:bg-brand-dark-bg p-1 shrink-0" />
                            ) : (
                                <div className="h-11 w-11 rounded-xl bg-brand-primary/15 flex items-center justify-center shrink-0">
                                    <FaStore className="text-brand-primary text-lg" />
                                </div>
                            )}
                            <div className="min-w-0 flex-1">
                                <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-brand-dark-muted">סל במסעדה</p>
                                <p className="font-black text-gray-900 dark:text-brand-dark-text truncate text-base sm:text-lg leading-tight">{restaurant.name}</p>
                            </div>
                        </div>
                    )}
                    <h1 className="text-3xl font-bold text-brand-primary">סל קניות</h1>

                    {/* באנר מצב תצוגה מקדימה */}
                    {isPreviewMode && (
                        <div className="bg-gradient-to-r from-purple-50 via-indigo-50 to-purple-50 border-2 border-purple-400 rounded-2xl p-4 shadow-lg">
                            <div className="flex items-center gap-3">
                                <div className="bg-purple-500 rounded-full p-3">
                                    <FaShoppingCart className="text-2xl text-white" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-purple-900 text-lg mb-1 flex items-center gap-2"><FaSearch className="text-purple-700" /> מצב תצוגה מקדימה</h3>
                                    <p className="text-sm text-purple-800">
                                        אתה צופה בסל כמנהל מסעדה. חזור לתפריט והוסף פריטים לסל.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="bg-orange-50 dark:bg-orange-900/20 border border-brand-primary/30 text-gray-900 dark:text-brand-dark-text px-6 py-8 rounded-lg text-center">
                        <p className="text-lg mb-4">{UI_TEXT.MSG_EMPTY_CART}</p>
                        <button
                            onClick={() => navigate(tenantId ? `/${tenantId}/menu` : '/')}
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
    const deliveryMinimum = parseFloat(restaurant?.delivery_minimum) || 0;

    // מבצעים שעומדים בתנאים
    const metPromotions = eligiblePromotions.filter(p => p.progress?.met);

    // חישוב הנחת מבצעים בצד הלקוח (לתצוגה — הבקאנד מחשב סופית)
    const promotionDiscount = computeClientPromotionDiscount(total, cartItems, metPromotions, menuCategories);
    const totalWithDelivery = total + deliveryFee - promotionDiscount;
    const isBelowMinimum = customerInfo.delivery_method === 'delivery' && deliveryMinimum > 0 && total < deliveryMinimum;
    // בניית רשימת מתנות נבחרות (עם שמות) מ-selectedGifts
    const selectedGiftItems = [];
    for (const promo of metPromotions) {
        const promoGifts = selectedGifts[String(promo.promotion_id)] || [];

        const allSpecific = (promo.rewards || []).every(r =>
            r.reward_type !== 'free_item' || r.reward_menu_item_id
        );

        if (allSpecific) {
            // פריטים ספציפיים — תמיד מוצגים כשעמד בתנאים (ללא צורך בבחירה ידנית)
            (promo.rewards || []).filter(r => r.reward_type === 'free_item').forEach(r => {
                const qty = r.max_selectable || 1;
                for (let i = 0; i < qty; i++) {
                    selectedGiftItems.push({
                        menu_item_id: r.reward_menu_item_id,
                        name: r.reward_menu_item_name || 'מתנה',
                    });
                }
            });
        } else if (promoGifts.length > 0) {
            promoGifts.forEach((itemId) => {
                const label = menuItemNameById.get(Number(itemId));
                selectedGiftItems.push({
                    menu_item_id: itemId,
                    name: label ? `מתנה: ${label}` : `מתנה ממבצע (${promo.name})`,
                });
            });
        }
    }

    return (
        <CustomerLayout>
            <div className="space-y-6">
                {showPhoneModal && (
                    <PhoneVerificationModal
                        phone={customerInfo.phone}
                        onVerified={(phone) => {
                            setPhoneVerified(true);
                            setShowPhoneModal(false);
                            // אחרי אימות טלפון מוצלח - פתח מודל אישור
                            setShowConfirmation(true);
                        }}
                        onClose={() => setShowPhoneModal(false)}
                        isPreviewMode={isPreviewMode}
                    />
                )}

                <LocationPickerModal
                    open={showLocationModal}
                    onClose={() => setShowLocationModal(false)}
                    onLocationSelected={(location) => {
                        setSelectedCustomerAddressId(null);
                        setDeliveryLocation(location);
                        setShowLocationModal(false);

                        const needsCompletion = !location.street || location.needsCompletion;

                        if (location.fullAddress) {
                            setCustomerInfo((prev) => ({ ...prev, delivery_address: location.fullAddress }));
                        }

                        if (needsCompletion && isRegisteredCustomer && savedAddresses.length > 0) {
                            setShowSavedAddressChoiceModal(true);
                            return;
                        }

                        if (needsCompletion) {
                            setTimeout(() => setShowDeliveryModal(true), 300);
                        }
                    }}
                />

                {/* משתמש רשום: להשתמש בכתובת שמורה או להשלים ידנית — לפני/במקום מודל פרטים */}
                {showSavedAddressChoiceModal && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-3">
                        <div
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="saved-addr-choice-title"
                            className="bg-white dark:bg-brand-dark-surface rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-brand-dark-border"
                        >
                            <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-brand-dark-border flex justify-between items-start gap-2">
                                <div>
                                    <h2 id="saved-addr-choice-title" className="text-lg font-black text-gray-900 dark:text-brand-dark-text">
                                        כתובת שמורה?
                                    </h2>
                                    <p className="text-sm text-gray-600 dark:text-brand-dark-muted mt-1">
                                        המיקום שנבחר דורש השלמת פרטים. אפשר להשתמש בכתובת מהחשבון שלך.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowSavedAddressChoiceModal(false)}
                                    className="shrink-0 w-9 h-9 rounded-full bg-gray-100 dark:bg-brand-dark-bg text-gray-600 dark:text-gray-300 hover:bg-gray-200 text-xl leading-none"
                                    aria-label="סגור"
                                >
                                    ×
                                </button>
                            </div>
                            <div className="p-4 sm:p-5 space-y-2">
                                {savedAddresses.map((addr) => (
                                    <button
                                        key={addr.id}
                                        type="button"
                                        onClick={() => applySavedAddress(addr)}
                                        className="w-full text-right rounded-xl border-2 border-gray-200 dark:border-brand-dark-border hover:border-brand-primary/60 hover:bg-orange-50 dark:hover:bg-orange-900/15 p-3 transition-all flex items-start gap-3"
                                    >
                                        <FaMapMarkerAlt className={`shrink-0 mt-0.5 ${addr.is_default ? 'text-brand-primary' : 'text-gray-400'}`} />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-bold text-gray-900 dark:text-brand-dark-text text-sm">{addr.label}</span>
                                                {addr.is_default && <FaStar className="text-amber-400 text-xs" />}
                                            </div>
                                            <p className="text-xs text-gray-600 dark:text-brand-dark-muted mt-0.5 break-words">
                                                {addr.street} {addr.house_number}
                                                {addr.apartment ? `, דירה ${addr.apartment}` : ''}, {addr.city}
                                            </p>
                                            {(!addr.lat || !addr.lng) && (
                                                <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-1">ללא נ.צ. במפה — ייתכן שתידרש בחירת מיקום מחדש לאימות אזור</p>
                                            )}
                                        </div>
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowSavedAddressChoiceModal(false);
                                        setShowDeliveryModal(true);
                                    }}
                                    className="w-full py-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-brand-dark-border text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-brand-dark-bg transition-colors"
                                >
                                    להשלים כתובת ידנית
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {restaurant && (
                    <div className="flex items-center gap-2 sm:gap-3 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-brand-dark-border bg-white dark:bg-brand-dark-surface px-2 py-2 sm:px-4 sm:py-3 shadow-sm">
                        {restaurant.logo_url ? (
                            <img
                                src={resolveAssetUrl(restaurant.logo_url)}
                                alt=""
                                className="h-9 w-9 sm:h-14 sm:w-14 object-contain rounded-lg sm:rounded-xl bg-gray-50 dark:bg-brand-dark-bg p-0.5 sm:p-1 shrink-0 ring-1 sm:ring-2 ring-brand-primary/10"
                            />
                        ) : (
                            <div className="h-9 w-9 sm:h-14 sm:w-14 rounded-lg sm:rounded-xl bg-brand-primary/15 flex items-center justify-center shrink-0 ring-1 sm:ring-2 ring-brand-primary/20">
                                <FaStore className="text-brand-primary text-base sm:text-xl" />
                            </div>
                        )}
                        <div className="min-w-0 flex-1">
                            <p className="text-[9px] sm:text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-brand-dark-muted leading-tight">הזמנה מ־</p>
                            <p className="font-black text-gray-900 dark:text-brand-dark-text truncate text-sm sm:text-xl leading-tight">{restaurant.name}</p>
                        </div>
                    </div>
                )}
                <div className="flex items-center gap-2 sm:gap-3">
                    <div className="p-2 sm:p-3 bg-orange-100 dark:bg-orange-900/30 rounded-xl sm:rounded-2xl">
                        <FaShoppingCart className="text-xl sm:text-2xl text-brand-primary" />
                    </div>
                    <h1 className="text-xl sm:text-3xl font-black text-gray-900 dark:text-brand-dark-text">סל קניות</h1>
                </div>

                <CartCheckoutWizard step={checkoutStep} onStepChange={goCheckoutStep} />

                {/* באנר מצב תצוגה מקדימה */}
                {isPreviewMode && (
                    <div className="bg-gradient-to-r from-purple-50 via-indigo-50 to-purple-50 border border-purple-400 sm:border-2 rounded-lg sm:rounded-2xl p-2 sm:p-4 shadow-sm sm:shadow-lg">
                        <div className="flex items-start gap-2 sm:gap-3">
                            <div className="bg-purple-500 rounded-full p-1.5 sm:p-3 shrink-0">
                                <FaShoppingCart className="text-sm sm:text-2xl text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-purple-900 text-xs sm:text-lg sm:mb-1 flex items-center gap-1 sm:gap-2 leading-snug">
                                    <FaSearch className="text-purple-700 shrink-0 text-[10px] sm:text-base" />
                                    <span className="truncate">תצוגה מקדימה — הזמנת דוגמה, ללא השפעה על דוחות.</span>
                                </h3>
                                <p className="hidden sm:block text-sm text-purple-800">
                                    אתה צופה בסל כמנהל מסעדה. ההזמנה תסומן כ-<strong>הזמנת דוגמה</strong> ולא תשפיע על מונים ודוחות.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* באנר דמו */}
                {restaurant?.is_demo && !isPreviewMode && (
                    <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-400 sm:border-2 rounded-lg sm:rounded-2xl p-2 sm:p-4 shadow-sm sm:shadow-lg">
                        <div className="flex items-start gap-2 sm:gap-3">
                            <div className="bg-amber-500 rounded-full p-1.5 sm:p-3 shrink-0 animate-pulse">
                                <FaMask className="text-sm sm:text-2xl text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-amber-900 text-xs sm:text-lg sm:mb-1 leading-snug truncate">דמו — ללא אימות טלפון, הכל לדוגמה.</h3>
                                <p className="hidden sm:block text-sm text-amber-800">
                                    זוהי הזמנת דמו - <strong>אין צורך באימות טלפון</strong>. כל השלבים מסומלצים.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-brand-dark-surface border border-gray-200 dark:border-brand-dark-border rounded-2xl p-4 sm:p-6 max-w-md w-full shadow-2xl mx-4">
                            <div className="text-center">
                                <div className="text-4xl sm:text-5xl mb-3 sm:mb-4 text-amber-500 flex justify-center"><FaExclamationTriangle /></div>
                                <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-brand-dark-text mb-2 sm:mb-3">שגיאה</h3>
                                <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 mb-4 sm:mb-6">{error}</p>
                                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                                    {!deliveryZoneAvailable && customerInfo.delivery_method === 'delivery' && (
                                        <button
                                            onClick={() => {
                                                setError(null);
                                                setShowLocationModal(true);
                                            }}
                                            className="w-full sm:flex-1 bg-brand-primary text-white px-4 py-2.5 sm:py-3 rounded-xl text-sm sm:text-base font-medium hover:bg-orange-700 transition"
                                        >
                                            <FaMapMarkerAlt className="inline" /> שנה מיקום
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
                    deliveryLocation={deliveryLocation}
                    savedAddresses={isRegisteredCustomer ? savedAddresses : []}
                    onApplySavedAddress={(addr) => {
                        applySavedAddress(addr);
                        setShowDeliveryModal(false);
                    }}
                    onSaved={() => {
                        // פרטי המשלוח נשמרו
                    }}
                />

                {/* שלב 1: פריטים ומבצעים */}
                {checkoutStep === 1 && (
                    <>
                <div className="max-sm:border border-gray-200 dark:border-brand-dark-border max-sm:rounded-lg max-sm:overflow-hidden max-sm:bg-white max-sm:dark:bg-brand-dark-surface sm:space-y-2">
                    {cartItems.map((item, itemIndex) => {
                        const addonsInside = (item.addons || []).filter(a => !a.on_side).map(a => (a.quantity || 1) > 1 ? `${a.name} ×${a.quantity}` : a.name);
                        const addonsOnSide = (item.addons || []).filter(a => a.on_side).map(a => (a.quantity || 1) > 1 ? `${a.name} ×${a.quantity}` : a.name);
                        return (
                            <div key={item.cartKey}>
                                {/* מובייל — שורה קומפקטית + שורת פירוט */}
                                <div
                                    className={`sm:hidden ${
                                        itemIndex < cartItems.length - 1
                                            ? 'border-b border-gray-200 dark:border-brand-dark-border'
                                            : ''
                                    }`}
                                >
                                    <div className="flex items-center gap-1.5 w-full px-2 py-2 min-h-[2.75rem]">
                                        <div className="flex items-center rounded-md bg-gray-100 dark:bg-brand-dark-border/50 p-0.5 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => handleQuantityChange(item.cartKey, item.qty - 1)}
                                                className="w-7 h-7 flex items-center justify-center rounded bg-white dark:bg-brand-dark-bg text-gray-700 dark:text-brand-dark-text text-sm font-bold active:bg-red-50"
                                            >
                                                −
                                            </button>
                                            <span className="w-6 text-center text-xs font-black text-gray-900 dark:text-brand-dark-text tabular-nums">{item.qty}</span>
                                            <button
                                                type="button"
                                                onClick={() => handleQuantityChange(item.cartKey, item.qty + 1)}
                                                className="w-7 h-7 flex items-center justify-center rounded bg-white dark:bg-brand-dark-bg text-gray-700 dark:text-brand-dark-text text-sm font-bold active:bg-green-50"
                                            >
                                                +
                                            </button>
                                        </div>
                                        <p className="flex-1 min-w-0 text-xs font-bold text-gray-900 dark:text-brand-dark-text leading-tight line-clamp-1" title={item.name}>
                                            {item.name}
                                        </p>
                                        <span className="shrink-0 text-xs font-black text-gray-900 dark:text-brand-dark-text tabular-nums">₪{item.totalPrice.toFixed(2)}</span>
                                        <button
                                            type="button"
                                            onClick={() => removeFromCart(item.cartKey)}
                                            className="shrink-0 w-7 h-7 flex items-center justify-center text-red-500 text-lg font-bold leading-none rounded-md active:bg-red-50 dark:active:bg-red-950/30"
                                            aria-label="הסר מהסל"
                                        >
                                            ×
                                        </button>
                                    </div>
                                    <div className="px-2 pb-2 pt-0 text-[10px] text-gray-600 dark:text-brand-dark-muted leading-snug space-y-0.5 bg-gray-50/70 dark:bg-brand-dark-bg/40">
                                        {item.variant?.name && (
                                            <p>
                                                <span className="font-semibold text-gray-500 dark:text-gray-400">סוג: </span>
                                                {item.variant.name}
                                            </p>
                                        )}
                                        {addonsInside.length > 0 && (
                                            <p>
                                                <span className="font-semibold text-gray-500 dark:text-gray-400">תוספות: </span>
                                                {addonsInside.join(' · ')}
                                            </p>
                                        )}
                                        {addonsOnSide.length > 0 && (
                                            <p className="text-orange-700 dark:text-orange-400">
                                                <FaBoxOpen className="inline align-middle ms-0.5" size={10} />
                                                בצד: {addonsOnSide.join(' · ')}
                                            </p>
                                        )}
                                        <p className="text-gray-500 dark:text-gray-500">
                                            ₪{item.unitPrice.toFixed(2)} ליחידה × {item.qty}
                                        </p>
                                    </div>
                                </div>

                                {/* טאבלט+ — כרטיס */}
                                <div className="hidden sm:block bg-white dark:bg-brand-dark-surface border-2 border-gray-200 dark:border-brand-dark-border rounded-2xl p-5 hover:shadow-lg transition-shadow">
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="flex-1 space-y-2">
                                            <h3 className="font-bold text-gray-900 dark:text-brand-dark-text text-lg">{item.name}</h3>
                                            {item.variant?.name && (
                                                <p className="text-sm text-brand-primary font-medium">סוג לחם: {item.variant.name}</p>
                                            )}
                                            {addonsInside.length > 0 && (
                                                <p className="text-sm text-gray-600 dark:text-brand-dark-muted">תוספות: {addonsInside.join(' · ')}</p>
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
                                            <div className="text-right">
                                                <p className="font-black text-xl text-gray-900 dark:text-brand-dark-text">
                                                    ₪{item.totalPrice.toFixed(2)}
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-1 bg-gray-100 dark:bg-brand-dark-border/50 rounded-xl p-1">
                                                <button
                                                    type="button"
                                                    onClick={() => handleQuantityChange(item.cartKey, item.qty - 1)}
                                                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-brand-dark-bg hover:bg-red-50 hover:text-red-600 text-gray-600 dark:text-brand-dark-muted font-bold transition-all shadow-sm"
                                                >
                                                    −
                                                </button>
                                                <span className="w-10 text-center font-bold text-gray-900 dark:text-brand-dark-text">{item.qty}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleQuantityChange(item.cartKey, item.qty + 1)}
                                                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-brand-dark-bg hover:bg-green-50 hover:text-green-600 text-gray-600 dark:text-brand-dark-muted font-bold transition-all shadow-sm"
                                                >
                                                    +
                                                </button>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => removeFromCart(item.cartKey)}
                                                className="text-red-500 hover:text-red-700 font-bold text-xl transition-colors"
                                                aria-label="הסר מהסל"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* מבצעים - התקדמות ובחירת מתנה */}
                <PromotionProgress
                    onSelectGift={(promo) => setGiftPromotion(promo)}
                    onNavigateToCategory={(categoryId) => {
                        const category = menuCategories.find(cat => cat.id === categoryId);
                        setPromoCategoryModal({
                            categoryId,
                            categoryName: category?.name || '',
                        });
                    }}
                />
                {giftPromotion && (
                    <GiftSelectionModal
                        promotion={giftPromotion}
                        onClose={() => setGiftPromotion(null)}
                    />
                )}
                        <button
                            type="button"
                            onClick={() => goCheckoutStep(2)}
                            className="w-full mt-4 py-4 rounded-xl font-black text-base sm:text-lg bg-gradient-to-r from-brand-primary to-orange-600 text-white shadow-lg hover:shadow-xl hover:from-orange-600 hover:to-orange-700 transition-all"
                        >
                            המשך לפרטים ומשלוח
                        </button>
                    </>
                )}

                {/* שלבים 2–3: סיכום + אותו טופס ואותו onSubmit */}
                {checkoutStep >= 2 && (
                <form id="cart-order-form" onSubmit={handleProceedToConfirmation} className="space-y-4 sm:space-y-6 bg-white dark:bg-brand-dark-surface border border-gray-200 dark:border-brand-dark-border p-4 sm:p-8 rounded-xl sm:rounded-2xl shadow-sm">
                <div className={checkoutStep !== 2 ? 'hidden' : 'block'}>
                {/* סכום ביניים */}
                <div className="bg-gradient-to-br from-brand-cream to-orange-50 dark:from-brand-dark-surface dark:to-orange-900/20 border border-gray-200 sm:border-2 dark:border-brand-dark-border rounded-xl sm:rounded-2xl p-3 sm:p-6 space-y-2 sm:space-y-3 text-sm sm:text-base">
                    <div className="flex justify-between items-center text-lg">
                        <span className="font-medium text-gray-700 dark:text-gray-300">סכום ביניים:</span>
                        <span className="font-bold text-gray-900 dark:text-brand-dark-text">₪{total.toFixed(2)}</span>
                    </div>

                    {customerInfo.delivery_method === 'delivery' && (
                        <div className="flex justify-between items-center text-lg">
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-700 dark:text-gray-300">דמי משלוח:</span>
                                {checkingZone && <span className="text-xs text-gray-500">⏳ בודק...</span>}
                            </div>
                            <span className="font-bold text-gray-900 dark:text-brand-dark-text">
                                {deliveryFee > 0 ? `₪${deliveryFee.toFixed(2)}` : checkingZone ? '...' : '₪0.00'}
                            </span>
                        </div>
                    )}

                    {metPromotions.map((promo) => {
                        const discountText = (promo.rewards || []).map(r => {
                            if (r.reward_type === 'discount_percent') return `${r.reward_value}% הנחה`;
                            if (r.reward_type === 'discount_fixed') return `₪${r.reward_value} הנחה`;
                            if (r.reward_type === 'free_item') return 'מתנה';
                            return 'הטבה';
                        }).join(' + ');
                        return (
                            <div key={promo.promotion_id} className="flex justify-between items-center text-base">
                                <span className="font-medium text-brand-primary dark:text-orange-400 flex items-center gap-1">
                                    <FaGift size={14} /> {promo.name}
                                </span>
                                <span className="font-bold text-brand-primary dark:text-orange-400 text-sm">
                                    {discountText}
                                </span>
                            </div>
                        );
                    })}

                    {promotionDiscount > 0 && (
                        <div className="flex justify-between items-center text-lg text-green-600 dark:text-green-400">
                            <span className="font-medium flex items-center gap-1"><FaGift size={14} /> הטבת מבצע</span>
                            <span className="font-bold">-₪{promotionDiscount.toFixed(2)}</span>
                        </div>
                    )}

                    <div className="flex justify-between items-center text-lg sm:text-2xl font-black border-t border-gray-300 dark:border-brand-dark-border sm:border-t-2 pt-2 sm:pt-3">
                        <span className="text-gray-900 dark:text-brand-dark-text">סה"כ לתשלום:</span>
                        <span className="text-brand-primary">₪{totalWithDelivery.toFixed(2)}</span>
                    </div>

                    {isBelowMinimum && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 space-y-1">
                            <div className="flex items-center gap-2 text-red-700 dark:text-red-400 text-sm font-medium">
                                <FaExclamationTriangle className="shrink-0" />
                                <span>מינימום הזמנה למשלוח: ₪{deliveryMinimum.toFixed(2)}</span>
                            </div>
                            <p className="text-red-600 dark:text-red-400 font-black text-base text-center">
                                חסרים ₪{(deliveryMinimum - total).toFixed(2)} להזמנה
                            </p>
                        </div>
                    )}

                    {/* כפתור הערות קטן וחמוד */}
                    <div className="flex justify-center mt-2 sm:mt-4">
                        <button
                            type="button"
                            onClick={() => {
                                const initialNotes = customerInfo?.delivery_notes || '';
                                setTempNotes(initialNotes);
                                setShowNotesModal(true);
                            }}
                            className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 font-medium text-xs sm:text-sm rounded-full transition-all shadow-sm hover:shadow-md active:scale-95"
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
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 sm:gap-2 bg-orange-50 dark:bg-orange-900/20 p-2 sm:p-3 rounded-md sm:rounded-lg text-xs sm:text-sm">
                            <div className="flex-1">
                                <p className="font-medium text-gray-900 dark:text-brand-dark-text text-xs sm:text-sm break-words">
                                    <FaMapMarkerAlt className="text-brand-primary inline shrink-0" /> {deliveryLocation.fullAddress ||
                                        (deliveryLocation.street && deliveryLocation.cityName
                                            ? `${deliveryLocation.street}, ${deliveryLocation.cityName}`
                                            : deliveryLocation.cityName || 'מיקום למשלוח')}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowLocationModal(true)}
                                className="text-brand-primary underline text-xs hover:text-orange-700 whitespace-nowrap self-end sm:self-auto"
                            >
                                שנה מיקום
                            </button>
                        </div>
                    )}
                </div>

                    <div className="flex items-center gap-2 pb-3 sm:pb-4 border-b border-gray-200 dark:border-brand-dark-border">
                        <FaUser className="text-brand-primary text-sm sm:text-base" />
                        <h2 className="text-base sm:text-xl font-black text-gray-900 dark:text-brand-dark-text">פרטים אישיים</h2>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-600 dark:text-brand-dark-muted uppercase tracking-wide mb-2">
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
                                className="w-full pr-10 pl-4 py-3 border-2 border-gray-200 dark:border-brand-dark-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all dark:bg-brand-dark-bg dark:text-brand-dark-text"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-600 dark:text-brand-dark-muted uppercase tracking-wide mb-2">
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
                                className="w-full pr-10 pl-4 py-3 border-2 border-gray-200 dark:border-brand-dark-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all dir-ltr text-right dark:bg-brand-dark-bg dark:text-brand-dark-text"
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <p className="block text-xs font-bold text-gray-600 dark:text-brand-dark-muted uppercase tracking-wide mb-3">שיטת קבלה</p>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <label className={`w-full sm:flex-1 border-2 rounded-xl p-4 cursor-pointer transition-all ${customerInfo.delivery_method === 'pickup' ? 'border-brand-primary bg-orange-50 dark:bg-orange-900/20 shadow-md' : 'border-gray-200 dark:border-brand-dark-border hover:border-gray-300'}`}>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="radio"
                                            name="delivery_method"
                                            value="pickup"
                                            checked={customerInfo.delivery_method === 'pickup'}
                                            onChange={(e) => setCustomerInfo({ ...customerInfo, delivery_method: e.target.value })}
                                            className="w-4 h-4"
                                        />
                                        <FaStore className={customerInfo.delivery_method === 'pickup' ? 'text-brand-primary' : 'text-gray-400'} />
                                        <span className="font-semibold text-gray-900 dark:text-brand-dark-text">איסוף עצמי</span>
                                    </div>
                                </label>
                                <label className={`w-full sm:flex-1 border-2 rounded-xl p-4 cursor-pointer transition-all ${customerInfo.delivery_method === 'delivery' ? 'border-brand-primary bg-orange-50 dark:bg-orange-900/20 shadow-md' : 'border-gray-200 dark:border-brand-dark-border hover:border-gray-300'}`}>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="radio"
                                            name="delivery_method"
                                            value="delivery"
                                            checked={customerInfo.delivery_method === 'delivery'}
                                            onChange={(e) => {
                                                setCustomerInfo({ ...customerInfo, delivery_method: e.target.value });
                                                if (e.target.value !== 'delivery') {
                                                    return;
                                                }
                                                if (deliveryHasValidCoords) {
                                                    return;
                                                }
                                                if (syncDeliveryFromCustomerProfile()) {
                                                    return;
                                                }
                                                if (tryHydrateDeliveryFromLocalStorage()) {
                                                    return;
                                                }
                                                const defAddr = savedAddresses.find(
                                                    (a) => a.is_default && a.lat != null && a.lng != null
                                                );
                                                if (defAddr) {
                                                    applySavedAddress(defAddr);
                                                    return;
                                                }
                                                setShowLocationModal(true);
                                            }}
                                            className="w-4 h-4"
                                        />
                                        <FaTruck className={customerInfo.delivery_method === 'delivery' ? 'text-brand-primary' : 'text-gray-400'} />
                                        <span className="font-semibold text-gray-900 dark:text-brand-dark-text">משלוח</span>
                                    </div>
                                </label>
                            </div>
                            {customerInfo.delivery_method === 'delivery' && (
                                <div className="mt-3 space-y-2">
                                    {/* כתובות שמורות */}
                                    {savedAddresses.length > 0 && (
                                        <div className="space-y-1.5">
                                            <p className="text-xs font-bold text-gray-500 dark:text-brand-dark-muted">כתובות שמורות</p>
                                            {savedAddresses.map(addr => (
                                                <button
                                                    key={addr.id}
                                                    type="button"
                                                    onClick={() => applySavedAddress(addr)}
                                                    className="w-full text-right border-2 rounded-xl p-3 transition-all flex items-center gap-2 hover:border-brand-primary/50 hover:bg-orange-50 dark:hover:bg-orange-900/10 border-gray-200 dark:border-brand-dark-border"
                                                >
                                                    <FaMapMarkerAlt className={`flex-shrink-0 ${addr.is_default ? 'text-brand-primary' : 'text-gray-400'}`} size={14} />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-bold text-sm text-gray-900 dark:text-brand-dark-text">{addr.label}</span>
                                                            {addr.is_default && <FaStar className="text-amber-400" size={10} />}
                                                        </div>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                                            {addr.street} {addr.house_number}{addr.apartment ? `, דירה ${addr.apartment}` : ''}, {addr.city}
                                                        </p>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {!deliveryHasValidCoords && (
                                        <button
                                            type="button"
                                            onClick={() => setShowLocationModal(true)}
                                            className="w-full text-sm bg-orange-50 dark:bg-orange-900/20 text-brand-primary px-3 py-2 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/30 flex items-center justify-center gap-2"
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
                                                    <div className={`border-2 rounded-xl p-3 ${isIncomplete ? 'bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-yellow-300 dark:border-yellow-700' : 'bg-gradient-to-r from-orange-50 to-brand-cream dark:from-orange-900/20 dark:to-brand-dark-surface border-brand-primary/30'}`}>
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="flex-1">
                                                                <p className="text-xs font-bold uppercase tracking-wide mb-1 flex items-center gap-1" style={{ color: isIncomplete ? '#b45309' : '#F97316' }}>
                                                                    <FaMapMarkerAlt /> כתובת משלוח
                                                                </p>
                                                                <p className="text-sm font-bold text-gray-900 dark:text-brand-dark-text">
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
                                                                    <p className="text-xs text-gray-600 dark:text-brand-dark-muted mt-1 flex items-center gap-1">
                                                                        <FaComment /> {customerInfo.delivery_notes}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => setShowDeliveryModal(true)}
                                                                className="px-3 py-1.5 bg-white dark:bg-brand-dark-bg hover:bg-orange-50 dark:hover:bg-orange-900/20 text-brand-primary text-xs font-bold rounded-lg border-2 border-brand-primary/30 hover:border-brand-primary transition-all whitespace-nowrap flex items-center gap-1"
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
                                            className="w-full bg-gray-900 hover:bg-black text-white px-4 py-3 rounded-xl font-bold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                                        >
                                            <FaHome /> הוסף פרטי משלוח
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="border-2 border-gray-200 dark:border-brand-dark-border rounded-xl p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
                            <div className="flex items-center gap-2 mb-2">
                                <FaMoneyBillWave className="text-green-600" />
                                <p className="text-xs font-bold text-gray-600 dark:text-brand-dark-muted uppercase tracking-wide">תשלום</p>
                            </div>
                            {(() => {
                                const availMethods = restaurant?.available_payment_methods || ['cash'];
                                const hasCreditCard = availMethods.includes('credit_card');
                                const hasCash = availMethods.includes('cash');

                                if (hasCreditCard && hasCash) {
                                    // Both methods available - show radio buttons
                                    return (
                                        <div className="space-y-2">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="payment_method"
                                                    value="cash"
                                                    checked={(customerInfo.payment_method || 'cash') === 'cash'}
                                                    onChange={() => setCustomerInfo(prev => ({ ...prev, payment_method: 'cash' }))}
                                                    className="accent-green-600"
                                                />
                                                <FaMoneyBillWave className="text-green-600" />
                                                <span className="font-bold text-gray-900 dark:text-brand-dark-text">מזומן</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="payment_method"
                                                    value="credit_card"
                                                    checked={customerInfo.payment_method === 'credit_card'}
                                                    onChange={() => setCustomerInfo(prev => ({ ...prev, payment_method: 'credit_card' }))}
                                                    className="accent-indigo-600"
                                                />
                                                <FaCreditCard className="text-indigo-600" />
                                                <span className="font-bold text-gray-900 dark:text-brand-dark-text">כרטיס אשראי</span>
                                            </label>
                                            <p className="text-xs text-gray-500 dark:text-brand-dark-muted mt-1">
                                                {(customerInfo.payment_method || 'cash') === 'cash'
                                                    ? 'תשלום בעת קבלת ההזמנה'
                                                    : 'תשלום מאובטח באשראי'}
                                            </p>
                                        </div>
                                    );
                                }

                                {/* TODO Phase 2: כשאשראי נבחר ולוחץ "שלם" -> הצגת HypPaymentModal עם iframe לסליקה */ }

                                // Default: cash only
                                return (
                                    <>
                                        <p className="text-gray-900 dark:text-brand-dark-text font-bold flex items-center gap-2">
                                            <FaMoneyBillWave className="text-green-600" />
                                            מזומן בלבד
                                        </p>
                                        <p className="text-xs text-gray-600 dark:text-brand-dark-muted mt-1">תשלום בעת איסוף/משלוח</p>
                                    </>
                                );
                            })()}
                        </div>
                    </div>

                    <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 mt-4 border-t border-gray-200 dark:border-brand-dark-border">
                        <button
                            type="button"
                            onClick={() => goCheckoutStep(1)}
                            className="flex-1 font-bold py-3.5 sm:py-4 rounded-xl text-center bg-gray-200 dark:bg-brand-dark-border text-gray-800 dark:text-brand-dark-text hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
                        >
                            חזור לסל
                        </button>
                        <button
                            type="button"
                            onClick={() => goCheckoutStep(3)}
                            className="flex-1 bg-gradient-to-r from-brand-primary to-orange-600 text-white font-black py-3.5 sm:py-4 rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg"
                        >
                            המשך לסיום והזמנה
                        </button>
                    </div>
                </div>

                <div className={checkoutStep !== 3 ? 'hidden' : 'block'}>
                    <div className="rounded-xl sm:rounded-2xl border-2 border-brand-primary/25 bg-gradient-to-br from-orange-50 to-brand-cream dark:from-orange-950/40 dark:to-brand-dark-surface p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                        <div>
                            <p className="text-xs font-bold text-gray-500 dark:text-brand-dark-muted uppercase tracking-wide">סיכום לפני שליחה</p>
                            <p className="text-lg sm:text-xl font-black text-gray-900 dark:text-brand-dark-text">
                                סה״כ לתשלום: <span className="text-brand-primary">₪{totalWithDelivery.toFixed(2)}</span>
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => goCheckoutStep(2)}
                            className="text-sm font-bold text-brand-primary hover:underline whitespace-nowrap self-start sm:self-auto"
                        >
                            עריכת פרטים וסיכום
                        </button>
                    </div>

                    {/* הזמנה עתידית — צבעים: סגור=ענבר, פתוח=ציאן (ניגודיות טובה בלייט/דארק) */}
                    {canFutureOrder && (
                        <div
                            className={
                                !restaurant?.is_open_now
                                    ? 'border-2 rounded-lg sm:rounded-xl p-3 sm:p-4 border-amber-400 dark:border-amber-500/50 bg-gradient-to-br from-amber-50 via-orange-50/90 to-amber-50 dark:from-amber-950/45 dark:via-orange-950/25 dark:to-amber-950/35 text-sm sm:text-base'
                                    : 'border-2 rounded-lg sm:rounded-xl p-3 sm:p-4 border-cyan-500 dark:border-cyan-400/55 bg-gradient-to-br from-cyan-50 via-teal-50/80 to-cyan-50/90 dark:from-cyan-950/45 dark:via-teal-950/30 dark:to-cyan-950/40 text-sm sm:text-base'
                            }
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <FaClock className={!restaurant?.is_open_now ? 'text-amber-700 dark:text-amber-300' : 'text-cyan-700 dark:text-cyan-300'} />
                                <p
                                    className={
                                        !restaurant?.is_open_now
                                            ? 'text-xs font-bold uppercase tracking-wide text-amber-900 dark:text-amber-100'
                                            : 'text-xs font-bold uppercase tracking-wide text-cyan-900 dark:text-cyan-100'
                                    }
                                >
                                    {!restaurant?.is_open_now ? 'המסעדה סגורה — הזמנה עתידית' : 'הזמנה עתידית'}
                                </p>
                            </div>

                            {scheduledFor ? (
                                <div className="flex items-center justify-between bg-white/90 dark:bg-brand-dark-bg rounded-lg px-3 py-2.5 border border-gray-200/90 dark:border-brand-dark-border">
                                    <div className="flex items-center gap-2">
                                        <FaClock className={!restaurant?.is_open_now ? 'text-amber-600 dark:text-amber-400' : 'text-cyan-600 dark:text-cyan-400'} size={12} />
                                        <span className="text-sm font-bold text-gray-800 dark:text-brand-dark-text">
                                            {new Date(scheduledFor).toLocaleDateString('he-IL', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowFutureOrderModal(true)}
                                        className={
                                            !restaurant?.is_open_now
                                                ? 'text-xs font-bold text-amber-700 dark:text-amber-300 hover:underline'
                                                : 'text-xs font-bold text-cyan-700 dark:text-cyan-300 hover:underline'
                                        }
                                    >
                                        שנה
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <p
                                        className={
                                            !restaurant?.is_open_now
                                                ? 'text-sm mb-3 text-amber-900 dark:text-amber-200'
                                                : 'text-sm mb-3 text-cyan-900 dark:text-cyan-100'
                                        }
                                    >
                                        {!restaurant?.is_open_now
                                            ? 'ניתן להזמין מראש — בחר תאריך ושעה.'
                                            : 'רוצה לקבל את ההזמנה בזמן אחר?'}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setShowFutureOrderModal(true)}
                                        className={
                                            !restaurant?.is_open_now
                                                ? 'w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-500'
                                                : 'w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors bg-cyan-600 text-white hover:bg-cyan-700 dark:bg-cyan-600 dark:hover:bg-cyan-500'
                                        }
                                    >
                                        <FaClock size={12} />
                                        בחר תאריך ושעה
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                    {/* כפתורים */}
                    <div className="flex flex-col sm:flex-row gap-3 mt-6">
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex-1 bg-gradient-to-r from-brand-primary to-orange-600 text-white font-black py-4 rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
                        >
                            {effectivePaymentMethod === 'credit_card' ? 'שלם באשראי' : 'המשך לאישור'}
                        </button>
                        <a
                            href={tenantId ? `/${tenantId}/menu` : '/'}
                            className={`flex-1 font-bold py-4 rounded-xl text-center transition-all ${isBelowMinimum ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 shadow-lg' : 'bg-gray-200 dark:bg-brand-dark-border text-gray-800 dark:text-brand-dark-text hover:bg-gray-300 dark:hover:bg-gray-600'}`}
                        >
                            {isBelowMinimum ? 'הוסף מוצר' : UI_TEXT.BTN_CANCEL}
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
                </div>
                </form>
                )}

                {/* מודל אישור הזמנה */}
                <OrderConfirmationSheet
                    open={showConfirmation}
                    onClose={() => setShowConfirmation(false)}
                    restaurantName={restaurant?.name}
                    restaurantLogoUrl={restaurant?.logo_url}
                    cartItems={cartItems}
                    subtotal={total}
                    deliveryFee={deliveryFee}
                    totalWithDelivery={totalWithDelivery}
                    customerName={customerInfo.name}
                    customerPhone={customerInfo.phone}
                    deliveryMethod={customerInfo.delivery_method || 'pickup'}
                    deliveryAddress={customerInfo.delivery_address}
                    deliveryNotes={customerInfo.delivery_notes}
                    paymentMethod={effectivePaymentMethod}
                    onConfirmOrder={handleConfirmOrder}
                    submitting={submitting}
                    onRemoveItem={removeFromCart}
                    promotionDiscount={promotionDiscount}
                    giftItems={selectedGiftItems}
                    metPromotions={metPromotions}
                />

                {/* מודל מינימום הזמנה */}
                {showMinimumModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-brand-dark-surface rounded-2xl shadow-2xl max-w-md w-full animate-fade-in">
                            <div className="bg-gradient-to-r from-red-500 to-orange-500 p-6 rounded-t-2xl relative">
                                <button
                                    onClick={() => setShowMinimumModal(false)}
                                    className="absolute top-4 left-4 text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-all"
                                >
                                    <FaTimes className="text-xl" />
                                </button>
                                <div className="flex items-center gap-3 justify-center">
                                    <FaExclamationTriangle className="text-white text-3xl" />
                                    <h3 className="text-2xl font-bold text-white">מינימום הזמנה</h3>
                                </div>
                            </div>
                            <div className="p-6 space-y-4 text-center">
                                <p className="text-gray-700 dark:text-gray-300 text-lg">
                                    מינימום הזמנה למשלוח: <span className="font-black text-brand-primary">₪{deliveryMinimum.toFixed(2)}</span>
                                </p>
                                <p className="text-red-600 dark:text-red-400 font-black text-xl">
                                    חסרים ₪{(deliveryMinimum - total).toFixed(2)} להזמנה
                                </p>
                                <p className="text-gray-500 dark:text-brand-dark-muted text-sm">
                                    הוסף עוד מוצרים לסל כדי להגיע למינימום
                                </p>
                                <div className="flex gap-3 pt-2">
                                    <button
                                        onClick={() => setShowMinimumModal(false)}
                                        className="flex-1 py-3 px-4 bg-gray-100 dark:bg-brand-dark-border text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                    >
                                        חזור לסל
                                    </button>
                                    <button
                                        onClick={() => navigate(`/${tenantId}/menu`)}
                                        className="flex-1 py-3 px-4 bg-gradient-to-r from-brand-primary to-orange-600 text-white font-bold rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all shadow-md hover:shadow-lg"
                                    >
                                        חזור לתפריט
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* מודל הערות למנה */}
                {showNotesModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-brand-dark-surface rounded-2xl shadow-2xl max-w-lg w-full animate-fade-in">
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
                                    className="w-full px-4 py-3 border-2 border-amber-200 dark:border-amber-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none text-gray-700 dark:text-brand-dark-text dark:bg-brand-dark-bg placeholder-gray-400"
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
                                        className="flex-1 py-3 px-4 bg-gray-100 dark:bg-brand-dark-border text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
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

                {/* מודל הוספה מהירה מקטגוריה (מבצעים) */}
                {promoCategoryModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-brand-dark-surface w-full max-w-lg rounded-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
                            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-100 dark:border-brand-dark-border shrink-0">
                                <h2 className="text-lg sm:text-xl font-black text-gray-900 dark:text-brand-dark-text">{promoCategoryModal.categoryName}</h2>
                                <button
                                    onClick={() => setPromoCategoryModal(null)}
                                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
                                >
                                    <FaTimes size={18} />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4">
                                {menuCategories.length === 0 ? (
                                    <div className="flex items-center justify-center py-12">
                                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand-primary"></div>
                                    </div>
                                ) : (() => {
                                    const categoryItems = menuCategories
                                        .flatMap(cat => (cat.items || []).map(item => ({ ...item, _catId: cat.id })))
                                        .filter(item => String(item._catId) === String(promoCategoryModal.categoryId) && item.is_available !== false);
                                    if (categoryItems.length === 0) {
                                        return <div className="text-center py-12 text-gray-400 dark:text-brand-dark-muted font-bold">אין פריטים בקטגוריה זו</div>;
                                    }
                                    return (
                                        <div className="grid grid-cols-2 gap-3">
                                            {categoryItems.map(item => {
                                                const itemCount = cartItems.filter(ci => ci.menuItemId === item.id).reduce((sum, ci) => sum + ci.qty, 0);
                                                const hasVariantsOrAddons = item.variants?.length > 0 || item.addon_groups?.length > 0;
                                                return (
                                                    <div
                                                        key={item.id}
                                                        className="bg-gray-50 dark:bg-brand-dark-border/50 rounded-xl border border-gray-100 dark:border-brand-dark-border overflow-hidden shadow-sm hover:shadow-lg hover:border-brand-primary/30 transition-all text-right relative"
                                                    >
                                                        {itemCount > 0 && (
                                                            <div className="absolute top-2 right-2 bg-brand-primary text-white text-xs font-black w-6 h-6 rounded-full flex items-center justify-center z-10 shadow-md">
                                                                {itemCount}
                                                            </div>
                                                        )}
                                                        <div className="cursor-pointer" onClick={() => hasVariantsOrAddons ? setPromoMenuItem(item) : null}>
                                                            {item.image_url ? (
                                                                <img src={resolveAssetUrl(item.image_url)} alt={item.name} className="w-full h-28 object-cover" />
                                                            ) : (
                                                                <div className="w-full h-28 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-brand-dark-border dark:to-brand-dark-bg flex items-center justify-center">
                                                                    <span className="text-3xl opacity-30">🍽</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="p-3">
                                                            <h3 className="font-black text-gray-900 dark:text-brand-dark-text text-sm truncate">{item.name}</h3>
                                                            <div className="flex items-center justify-between mt-2">
                                                                <span className="font-black text-brand-primary text-base">₪{item.price?.toFixed(2)}</span>
                                                                {hasVariantsOrAddons ? (
                                                                    <button
                                                                        onClick={() => setPromoMenuItem(item)}
                                                                        className="bg-brand-primary text-white w-8 h-8 rounded-full flex items-center justify-center shadow-md hover:bg-orange-600 active:scale-90 transition-all"
                                                                    >
                                                                        <FaPlus size={12} />
                                                                    </button>
                                                                ) : (
                                                                    <div className="flex items-center gap-1">
                                                                        {itemCount > 0 && (
                                                                            <button
                                                                                onClick={() => {
                                                                                    const cartItem = cartItems.find(ci => ci.menuItemId === item.id);
                                                                                    if (cartItem) handleQuantityChange(cartItem.cartKey, cartItem.qty - 1);
                                                                                }}
                                                                                className="w-7 h-7 flex items-center justify-center rounded-full bg-red-50 text-red-600 hover:bg-red-100 transition-all"
                                                                            >
                                                                                <FaMinus size={10} />
                                                                            </button>
                                                                        )}
                                                                        <button
                                                                            onClick={() => addToCart({
                                                                                menuItemId: item.id,
                                                                                categoryId: item._catId,
                                                                                name: item.name,
                                                                                price: item.price,
                                                                                variant: null,
                                                                                addons: [],
                                                                                qty: 1,
                                                                            })}
                                                                            className="bg-brand-primary text-white w-8 h-8 rounded-full flex items-center justify-center shadow-md hover:bg-orange-600 active:scale-90 transition-all"
                                                                        >
                                                                            <FaPlus size={12} />
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })()}
                            </div>
                            <div className="p-4 border-t border-gray-100 dark:border-brand-dark-border shrink-0">
                                <button
                                    onClick={() => setPromoCategoryModal(null)}
                                    className="w-full bg-gradient-to-r from-brand-primary to-orange-600 text-white font-black py-3.5 rounded-xl shadow-lg hover:shadow-xl active:scale-95 transition-all text-lg"
                                >
                                    סיימתי
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* MenuItemModal for promo category items */}
                {promoMenuItem && (
                    <MenuItemModal
                        item={promoMenuItem}
                        isOpen={true}
                        onClose={() => setPromoMenuItem(null)}
                        onAdd={(itemData) => {
                            addToCart(itemData);
                            setPromoMenuItem(null);
                        }}
                        isOrderingEnabled={true}
                    />
                )}
            </div>

            <FutureOrderModal
                isOpen={showFutureOrderModal}
                onClose={() => setShowFutureOrderModal(false)}
                deliveryMethod={customerInfo.delivery_method || 'pickup'}
                onConfirm={(isoString) => {
                    setScheduledFor(isoString);
                    // אשראי מקדים רק כשהמסעדה סגורה + אורח + המסעדה באמת מקבלת אשראי (אחרת נשבר שלב 3 / 422)
                    const needGuestPrepayCredit =
                        !isRegisteredCustomer &&
                        restaurant?.accepts_credit_card &&
                        restaurant?.is_open_now === false;
                    if (needGuestPrepayCredit) {
                        setCustomerInfo((prev) => ({ ...prev, payment_method: 'credit_card' }));
                    }
                    setShowFutureOrderModal(false);
                }}
                restaurant={restaurant}
                isRegisteredCustomer={isRegisteredCustomer}
            />
        </CustomerLayout>
    );
}
