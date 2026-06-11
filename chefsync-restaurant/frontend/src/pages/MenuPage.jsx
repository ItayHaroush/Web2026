import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { FaWhatsapp, FaPhoneAlt, FaShoppingBag, FaTruck, FaClock, FaShieldAlt, FaExclamationTriangle, FaInfoCircle, FaCreditCard, FaMoneyBillWave, FaGift, FaTimes, FaPlus, FaArrowLeft, FaChevronLeft, FaTag, FaCheckCircle, FaHistory, FaMapMarkerAlt, FaMask, FaSearch } from 'react-icons/fa';
import { SiWaze } from 'react-icons/si';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { useCustomer } from '../context/CustomerContext';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CustomerLayout } from '../layouts/CustomerLayout';
import menuService from '../services/menuService';
import promotionService from '../services/promotionService';
import { UI_TEXT } from '../constants/ui';
import apiClient from '../services/apiClient';
import { resolveAssetUrl } from '../utils/assets';
import { API_BASE_URL, TENANT_HEADER } from '../constants/api';
import MenuItemModal from '../components/MenuItemModal';
import FutureOrderModal from '../components/FutureOrderModal';
import LocationPickerModal from '../components/LocationPickerModal';
import TopDismissibleBanner from '../components/TopDismissibleBanner';
import { getSuggestions } from '../components/SuggestionCards';
import { sumAddonsBilledWithGroupRules } from '../utils/cart';
import { MenuSeo } from '../components/seo/RestaurantSeo';

const MENU_DAY_ORDER_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const DEFAULT_MENU_OPEN = '09:00';
const DEFAULT_MENU_CLOSE = '23:00';

const ENGLISH_DAY_TO_HEBREW = {
    sunday: 'ראשון',
    monday: 'שני',
    tuesday: 'שלישי',
    wednesday: 'רביעי',
    thursday: 'חמישי',
    friday: 'שישי',
    saturday: 'שבת',
};

/** תצוגת שעות ללקוח — מיזוג יום + default כמו ב-backend (אובייקט יום ללא זמנים עדיין יורש מ-default) */
function normalizeOperatingHoursForCustomerDisplay(raw) {
    let oh = raw;
    if (oh == null) return null;
    if (typeof oh === 'string') {
        try {
            oh = JSON.parse(oh);
        } catch {
            return null;
        }
    }
    if (typeof oh !== 'object' || oh === null || Array.isArray(oh)) return null;

    const out = { ...oh };

    if ((!out.default || typeof out.default !== 'object') && typeof out.open === 'string' && typeof out.close === 'string') {
        out.default = { open: out.open, close: out.close };
    }

    out.default = out.default && typeof out.default === 'object' ? out.default : {};

    let days = out.days;
    if (days == null) {
        out.days = {};
    } else if (Array.isArray(days)) {
        const mapped = {};
        MENU_DAY_ORDER_HE.forEach((heName, idx) => {
            const slot = days[idx];
            if (slot && typeof slot === 'object') mapped[heName] = slot;
        });
        out.days = mapped;
    } else if (typeof days === 'object') {
        const mapped = {};
        Object.entries(days).forEach(([key, v]) => {
            if (!v || typeof v !== 'object') return;
            const lower = typeof key === 'string' ? key.trim().toLowerCase() : key;
            const hebrewKey = ENGLISH_DAY_TO_HEBREW[lower] ?? key;
            mapped[hebrewKey] = v;
        });
        out.days = mapped;
    } else {
        out.days = {};
    }

    out.special_days =
        out.special_days && typeof out.special_days === 'object' && !Array.isArray(out.special_days)
            ? out.special_days
            : {};

    return out;
}

function trimTimeForDisplay(t) {
    if (t == null || t === '') return '';
    const s = String(t).trim();
    return s.length >= 5 ? s.slice(0, 5) : s;
}

function resolveDayHoursMerged(oh, hebrewDay) {
    if (!oh) return { closed: false, open: '', close: '' };
    const def = oh.default || {};
    const fallbackOpen = trimTimeForDisplay(def.open ?? oh.open ?? DEFAULT_MENU_OPEN);
    const fallbackClose = trimTimeForDisplay(def.close ?? oh.close ?? DEFAULT_MENU_CLOSE);
    const dayCfg = oh.days?.[hebrewDay];
    const closed = !!(dayCfg && dayCfg.closed);
    const open = trimTimeForDisplay(dayCfg?.open ?? fallbackOpen);
    const close = trimTimeForDisplay(dayCfg?.close ?? fallbackClose);
    return { closed, open, close };
}

function hasOperatingHoursToShowInMenu(ohNormalized) {
    if (!ohNormalized) return false;
    const defOpen = trimTimeForDisplay(ohNormalized.default?.open ?? ohNormalized.open ?? DEFAULT_MENU_OPEN);
    const defClose = trimTimeForDisplay(ohNormalized.default?.close ?? ohNormalized.close ?? DEFAULT_MENU_CLOSE);
    if (defOpen && defClose) return true;
    return MENU_DAY_ORDER_HE.some((day) => {
        const h = resolveDayHoursMerged(ohNormalized, day);
        return h.closed || (h.open && h.close);
    });
}

/**
 * עמוד תפריט - עיצוב בסגנון Wolt
 * @param {boolean} isPreviewMode - האם זה מצב תצוגה מקדימה (admin)
 */

export default function MenuPage({ isPreviewMode = false }) {
    const { tenantId, loginAsCustomer } = useAuth();
    const navigate = useNavigate();
    const params = useParams();
    const [searchParams] = useSearchParams();
    const { addToCart, clearCart, setCustomerInfo, getItemCount, cartItems, setScheduledFor, scheduledFor, currentTenantId } = useCart();
    const { addToast } = useToast();
    const { customer, isRecognized, openOrderHistory } = useCustomer();
    const [menu, setMenu] = useState([]);
    const [restaurant, setRestaurant] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeCategory, setActiveCategory] = useState(null);
    const [selectedMenuItem, setSelectedMenuItem] = useState(null);
    const [isPWA, setIsPWA] = useState(false);
    const [showFutureOrderModal, setShowFutureOrderModal] = useState(false);
    const [futureOrderApproved, setFutureOrderApproved] = useState(!!scheduledFor);
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [activePromotions, setActivePromotions] = useState([]);
    const [showSuggestionModal, setShowSuggestionModal] = useState(false);
    const [frozenSuggestions, setFrozenSuggestions] = useState([]);
    const [suggestionMenuItem, setSuggestionMenuItem] = useState(null);
    const [suggestionAddonPicker, setSuggestionAddonPicker] = useState(null);
    const [suggestionSelectedAddons, setSuggestionSelectedAddons] = useState({});
    const [showPromoPopup, setShowPromoPopup] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    /** תגית מיקום המשתמש בהירו — לחיצה פותחת מודל שינוי מיקום */
    const [showLocationModal, setShowLocationModal] = useState(false);
    const [userDeliveryLocation, setUserDeliveryLocation] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('user_delivery_location') || 'null');
        } catch {
            return null;
        }
    });
    const userLocationLabel = userDeliveryLocation?.fullAddress
        || (userDeliveryLocation?.street && userDeliveryLocation?.cityName
            ? `${userDeliveryLocation.street}, ${userDeliveryLocation.cityName}`
            : userDeliveryLocation?.cityName)
        || '';

    // סנכרון תגית המיקום — מכל מקום שבו המשתמש שינה מיקום (מודל בנאבבר / בסל וכו')
    useEffect(() => {
        const onLocationChanged = (e) => {
            const location = e.detail;
            if (!location) return;
            setUserDeliveryLocation(location);
            if (location.fullAddress) {
                setCustomerInfo((prev) => ({ ...prev, delivery_address: location.fullAddress }));
            }
        };
        window.addEventListener('user-location-changed', onLocationChanged);
        return () => window.removeEventListener('user-location-changed', onLocationChanged);
    }, [setCustomerInfo]);

    // אם המשתמש כבר אישר הרשאת מיקום ואין מיקום שמור — משתמשים במיקום הנוכחי אוטומטית (בלי לפתוח בקשה)
    useEffect(() => {
        if (userDeliveryLocation?.lat || isPreviewMode) return;
        if (!navigator.geolocation || !navigator.permissions?.query) return;

        let cancelled = false;
        navigator.permissions.query({ name: 'geolocation' }).then((status) => {
            if (cancelled || status.state !== 'granted') return;
            navigator.geolocation.getCurrentPosition(async (pos) => {
                if (cancelled) return;
                const { latitude: lat, longitude: lng } = pos.coords;
                let city = '';
                let road = '';
                let houseNumber = '';
                try {
                    const res = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=he&addressdetails=1&zoom=18`
                    );
                    const data = await res.json();
                    city = data.address?.city || data.address?.town || data.address?.village || '';
                    road = data.address?.road || '';
                    houseNumber = data.address?.house_number || '';
                } catch { /* נשמור נ.צ. גם בלי כתובת */ }
                if (cancelled) return;
                const fullAddress = [road ? `${road} ${houseNumber}`.trim() : '', city].filter(Boolean).join(', ');
                const locationData = {
                    lat,
                    lng,
                    cityName: city,
                    street: road,
                    house_number: houseNumber,
                    fullAddress,
                    needsCompletion: !road || !city || !houseNumber,
                };
                try { localStorage.setItem('user_delivery_location', JSON.stringify(locationData)); } catch { /* ignore */ }
                setUserDeliveryLocation(locationData);
            }, () => { /* המשתמש יבחר ידנית */ }, { timeout: 8000, maximumAge: 300000 });
        }).catch(() => { /* permissions API לא נתמך */ });

        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const bannerPromotions = useMemo(
        () => activePromotions.filter((p) => p.show_menu_banner !== false),
        [activePromotions]
    );
    const popupPromotions = useMemo(
        () => activePromotions.filter((p) => p.show_entry_popup !== false),
        [activePromotions]
    );
    /** פופ־אפ עליון: מסעדה סגורה (במקום טוסט) */
    const [closedRestaurantNotice, setClosedRestaurantNotice] = useState(null);
    const [itemAvailabilityNotice, setItemAvailabilityNotice] = useState(null);

    const [reorderDialog, setReorderDialog] = useState(null);
    const [pendingReorderItems, setPendingReorderItems] = useState(null);
    /** פופ־אפ «הזמנות שלי» — נסגר ב־X ונשמר לסשן לפי מסעדה */
    const [ordersHintDismissed, setOrdersHintDismissed] = useState(false);
    /** מודל הסבר מסעדת דמו — נסגר רק בלחיצת אישור (פעם אחת לסשן) */
    const [showDemoDisclaimerModal, setShowDemoDisclaimerModal] = useState(false);
    const categoryRefs = useRef({});
    const tabRefs = useRef({});
    const searchBarRef = useRef(null);
    const searchInputRef = useRef(null);

    const loadReorderItems = useCallback((items, shouldClear) => {
        if (shouldClear) clearCart();

        items.forEach((item) => {
            const cartItem = {
                menu_item_id: item.menu_item_id,
                name: item.name,
                price: item.price,
                image_url: item.image_url,
                quantity: item.quantity || 1,
                variant: item.variant_id ? { id: item.variant_id, name: item.variant_name || '' } : null,
                addons: item.addons || [],
            };
            addToCart(cartItem);
        });

        const unavailable = localStorage.getItem('reorder_unavailable');
        if (unavailable) {
            try {
                const names = JSON.parse(unavailable);
                if (names.length > 0) {
                    addToast(`פריטים לא זמינים: ${names.join(', ')}`, 'warning');
                }
            } catch { }
            localStorage.removeItem('reorder_unavailable');
        }

        addToast(`${items.length} פריטים ${shouldClear ? 'נטענו' : 'נוספו'} לסל`, 'success');
    }, [clearCart, addToCart, addToast]);

    // שלב 1: קריאת פריטי הזמנה חוזרת מ-localStorage ושמירה ב-state
    const pickupReorderItems = useCallback(() => {
        const raw = localStorage.getItem('reorder_items');
        if (!raw) return;
        try {
            const items = JSON.parse(raw);
            if (Array.isArray(items) && items.length > 0) {
                setPendingReorderItems(items);
            }
        } catch { }
        localStorage.removeItem('reorder_items');
        localStorage.removeItem('reorder_tenant');
    }, []);

    useEffect(() => {
        pickupReorderItems();
        window.addEventListener('reorder_items_ready', pickupReorderItems);
        return () => window.removeEventListener('reorder_items_ready', pickupReorderItems);
    }, [pickupReorderItems]);

    // שלב 2: עיבוד פריטי הזמנה חוזרת אחרי שמידע המסעדה נטען
    useEffect(() => {
        if (!pendingReorderItems || !restaurant) return;

        const isOpen = isPreviewMode ? true : ((restaurant.is_open_now ?? restaurant.is_open) !== false);
        const allowsFuture = allowsFutureOrders;

        if (isOpen || (allowsFuture && futureOrderApproved)) {
            // אם הסל שייך למסעדה אחרת — ניקוי מאולץ; לא מציגים "הוסף לסל הקיים"
            const cartIsFromOtherRestaurant =
                cartItems.length > 0 && currentTenantId && currentTenantId !== effectiveTenantId;

            if (cartItems.length > 0 && !cartIsFromOtherRestaurant) {
                setReorderDialog({ items: pendingReorderItems });
            } else {
                loadReorderItems(pendingReorderItems, cartIsFromOtherRestaurant);
            }
            setPendingReorderItems(null);
        } else if (!isOpen && allowsFuture && !futureOrderApproved) {
            setShowFutureOrderModal(true);
        } else {
            setClosedRestaurantNotice('נסה שוב בשעות הפעילות, או בדוק אם קיימת הזמנה מראש.');
            setPendingReorderItems(null);
            localStorage.removeItem('reorder_unavailable');
        }
    }, [pendingReorderItems, restaurant, futureOrderApproved]); // eslint-disable-line react-hooks/exhaustive-deps

    const effectiveTenantId = useMemo(() => {
        const fromUrl = params?.tenantId;
        if (fromUrl) return fromUrl;
        if (tenantId) return tenantId;
        const fromStorage = localStorage.getItem('tenantId');
        if (fromStorage) return fromStorage;
        const match = window.location.pathname.match(/^\/([^\/]+)\/menu/);
        return match?.[1] || '';
    }, [params?.tenantId, tenantId]);

    useEffect(() => {
        if (!effectiveTenantId) return;
        try {
            setOrdersHintDismissed(sessionStorage.getItem(`menu_orders_hint_${effectiveTenantId}`) === '1');
        } catch {
            setOrdersHintDismissed(false);
        }
    }, [effectiveTenantId]);

    const dismissOrdersHint = useCallback(() => {
        if (effectiveTenantId) {
            try {
                sessionStorage.setItem(`menu_orders_hint_${effectiveTenantId}`, '1');
            } catch { /* ignore */ }
        }
        setOrdersHintDismissed(true);
    }, [effectiveTenantId]);

    const acknowledgeDemoDisclaimer = useCallback(() => {
        if (effectiveTenantId) {
            try {
                sessionStorage.setItem(`demo_menu_ack_${effectiveTenantId}`, '1');
            } catch { /* ignore */ }
        }
        setShowDemoDisclaimerModal(false);
    }, [effectiveTenantId]);

    useEffect(() => {
        if (!restaurant?.is_demo || !effectiveTenantId || isPreviewMode) {
            setShowDemoDisclaimerModal(false);
            return;
        }
        try {
            if (sessionStorage.getItem(`demo_menu_ack_${effectiveTenantId}`) === '1') {
                setShowDemoDisclaimerModal(false);
                return;
            }
        } catch { /* ignore */ }
        setShowDemoDisclaimerModal(true);
    }, [restaurant?.is_demo, effectiveTenantId, isPreviewMode]);

    const getWazeLink = () => {
        const query = [restaurant?.address, restaurant?.city].filter(Boolean).join(', ');
        if (!query) return '';
        // navigate=yes מבקש פתיחה ישירה לניווט באפליקציה אם מותקנת
        return `https://waze.com/ul?q=${encodeURIComponent(query)}&navigate=yes`;
    };

    const getPhoneHref = () => {
        if (!restaurant?.phone) return '';
        const sanitized = restaurant.phone.replace(/[^\d+]/g, '');
        return sanitized ? `tel:${sanitized}` : '';
    };

    // זיהוי PWA mode
    useEffect(() => {
        try {
            const checkPWA = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
            setIsPWA(checkPWA || false);
        } catch (e) {
            // Fallback if matchMedia not supported
            setIsPWA(false);
        }
    }, []);

    // מעקב אחר גלילה לעדכון קטגוריה פעילה
    useEffect(() => {
        const handleScroll = () => {
            const scrollPosition = window.scrollY + 200; // offset for header

            for (const category of menu) {
                const element = categoryRefs.current[category.id];
                if (!element) continue;

                const { offsetTop, offsetHeight } = element;
                if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
                    setActiveCategory(category.id);
                    break;
                }
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [menu]);

    // גלילת טאב פעיל למרכז בר הקטגוריות
    useEffect(() => {
        const tab = tabRefs.current[activeCategory];
        if (activeCategory && tab) {
            const container = tab.parentElement;
            if (container) {
                const scrollLeft = tab.offsetLeft - container.offsetWidth / 2 + tab.offsetWidth / 2;
                container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
            }
        }
    }, [activeCategory]);

    // הגדרת header למצב preview + ניקוי defense-in-depth
    useEffect(() => {
        if (isPreviewMode) {
            // header מיוחד ל-apiClient כדי שה-backend יזהה מצב preview
            apiClient.defaults.headers.common['X-Preview-Mode'] = 'true';
        } else {
            // defense-in-depth: אם אנחנו ב-route ציבורי, נקה שאריות
            localStorage.removeItem('isPreviewMode');
        }
    }, [isPreviewMode]);

    useEffect(() => {
        if (!effectiveTenantId) return;
        // URL tenant must always win
        const previousTenant = localStorage.getItem('tenantId');
        localStorage.setItem('tenantId', effectiveTenantId);
        if (previousTenant !== effectiveTenantId) {
            // אירוע מותאם למערכות אחרות (CartContext) להגיב לשינוי מסעדה
            window.dispatchEvent(new CustomEvent('tenant_changed', { detail: effectiveTenantId }));
        }
        if (params?.tenantId && params.tenantId !== tenantId) {
            loginAsCustomer(params.tenantId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [effectiveTenantId]);

    useEffect(() => {
        if (!effectiveTenantId) return;

        const type = searchParams.get('type');
        if (type === 'delivery' || type === 'pickup') {
            setCustomerInfo((prev) => ({ ...prev, delivery_method: type }));
        }

        loadRestaurantInfo();
        loadMenu();
        loadPromotions();

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [effectiveTenantId, searchParams, setCustomerInfo]);

    // גלילה לקטגוריה לפי query param (מהסל בחזרה לתפריט)
    useEffect(() => {
        const scrollToId = searchParams.get('scrollTo');
        if (scrollToId && menu.length > 0) {
            setTimeout(() => scrollToCategory(Number(scrollToId)), 300);
        }
    }, [menu, searchParams]);

    // הגדרת קטגוריה פעילה ראשונה
    useEffect(() => {
        if (menu.length > 0 && !activeCategory) {
            setActiveCategory(menu[0].id);
        }
    }, [menu]);

    const loadRestaurantInfo = async () => {
        try {
            const response = await apiClient.get(`/restaurants/by-tenant/${encodeURIComponent(effectiveTenantId)}`);
            const currentRestaurant = response.data?.data || null;
            setRestaurant(currentRestaurant);
            // שמור את שם המסעדה ל-localStorage לשימוש בסל
            if (currentRestaurant?.name) {
                localStorage.setItem(`restaurant_name_${effectiveTenantId}`, currentRestaurant.name);
            }
        } catch (err) {
            console.error('שגיאה בטעינת מידע מסעדה:', err);
        }
    };

    const loadMenu = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await menuService.getMenu();
            setMenu(data);
        } catch (err) {
            console.error('שגיאה בטעינת תפריט:', err);
            setError('לא הצלחנו לטעון את התפריט. אנא נסה שוב.');
        } finally {
            setLoading(false);
        }
    };

    const loadPromotions = async () => {
        const isEmbed = new URLSearchParams(window.location.search).has('embed');
        try {
            const result = await promotionService.getActivePromotions();
            const promos = result?.data || [];
            setActivePromotions(promos);
            if (!isEmbed) {
                const key = `promoPopupShown_${effectiveTenantId}`;
                const popupEligible = promos.filter((p) => p.show_entry_popup !== false);
                if (popupEligible.length > 0 && !localStorage.getItem(key)) {
                    localStorage.setItem(key, '1');
                    setShowPromoPopup(true);
                }
            }
        } catch (err) {
            // silently fail — promotions are non-critical
        }
    };

    const scrollToCategory = (categoryId) => {
        setActiveCategory(categoryId);
        categoryRefs.current[categoryId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const wazeLink = getWazeLink();
    const phoneHref = getPhoneHref();
    const totalCartItems = getItemCount();
    const cartTotalPrice = useMemo(
        () => cartItems.reduce((sum, item) => sum + (Number(item.totalPrice) || 0), 0),
        [cartItems]
    );

    // תוצאות חיפוש — מוצגות בפאנל נפתח מתחת לשורת החיפוש, בלי להעלים את התפריט
    const searchResults = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return [];
        const results = [];
        for (const category of menu) {
            for (const item of category.items || []) {
                if (
                    (item.name || '').toLowerCase().includes(q) ||
                    (item.description || '').toLowerCase().includes(q)
                ) {
                    results.push({ ...item, category_name: category.name });
                }
            }
        }
        return results;
    }, [menu, searchQuery]);

    /** גלילה חזרה לשורת החיפוש של המסעדה + פוקוס על השדה */
    const focusMenuSearch = () => {
        const el = searchBarRef.current;
        if (!el) return;
        const top = el.getBoundingClientRect().top + window.scrollY - 80;
        window.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
        setTimeout(() => searchInputRef.current?.focus({ preventScroll: true }), 350);
    };

    // פתיחת שורת החיפוש מאייקון החיפוש בנאבבר הראשי
    useEffect(() => {
        const onOpenSearch = () => focusMenuSearch();
        window.addEventListener('open-menu-search', onOpenSearch);
        return () => window.removeEventListener('open-menu-search', onOpenSearch);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const allergensList = useMemo(() => {
        const raw = restaurant?.common_allergens;
        if (!raw) return [];
        if (Array.isArray(raw)) return raw;
        if (typeof raw === 'string') {
            try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) return parsed;
            } catch {
                return raw.split(',').map((item) => item.trim()).filter(Boolean);
            }
        }
        return [];
    }, [restaurant?.common_allergens]);

    const displayOperatingHours = useMemo(
        () => normalizeOperatingHoursForCustomerDisplay(restaurant?.operating_hours),
        [restaurant?.operating_hours],
    );

    const isOpenNow = restaurant?.is_open_now ?? restaurant?.is_open;
    const deliveryMinAmount = restaurant ? (parseFloat(restaurant.delivery_minimum) || 0) : 0;
    const canOrder = isPreviewMode ? true : (isOpenNow !== false);
    const isRegisteredCustomer = isRecognized && !!customer?.id;

    // בדיקה: האם המסעדה סגורה היום בגלל חג — חסימת הזמנה עתידית
    const activeHolidayClosure = useMemo(() => {
        const closures = restaurant?.holiday_closures || [];
        if (closures.length === 0) return null;
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        return closures.find(h => h.status === 'closed' && h.start_date <= todayStr && h.end_date >= todayStr) || null;
    }, [restaurant?.holiday_closures]);

    const allowsFutureOrders = restaurant?.allow_future_orders && (restaurant?.accepts_credit_card || isRegisteredCustomer) && !activeHolidayClosure;
    // כשהמסעדה סגורה — הזמנה עתידית היא הדרך היחידה
    const canPreOrder = !canOrder && allowsFutureOrders;
    // כשהמסעדה פתוחה — אפשר לתזמן הזמנה עתידית (אופציונלי)
    const canScheduleFuture = canOrder && allowsFutureOrders;

    /** תגית בכרטיס פרטי המסעדה — פותחת מודל; נקרא פעמיים (מובייל/דסקטופ) כדי ליצור אלמנטים נפרדים */
    const renderFutureOrderRestaurantTag = () => {
        if (!allowsFutureOrders) return null;
        const scheduledLabel = scheduledFor
            ? new Date(scheduledFor).toLocaleDateString('he-IL', {
                weekday: 'short',
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
            })
            : '';

        if (futureOrderApproved && scheduledFor) {
            return (
                <div className="inline-flex max-w-full min-w-0 items-stretch overflow-hidden rounded-full border border-slate-200/95 bg-white shadow-sm dark:border-slate-600 dark:bg-slate-900/95">
                    <button
                        type="button"
                        onClick={() => setShowFutureOrderModal(true)}
                        className="flex max-w-[11rem] min-w-0 items-center gap-1 rounded-r-none px-2.5 py-1.5 text-xs font-bold leading-tight text-brand-primary hover:bg-slate-50 dark:text-orange-300 dark:hover:bg-slate-800/80"
                    >
                        <FaCheckCircle className="h-3 w-3 shrink-0 text-brand-primary dark:text-orange-400" aria-hidden />
                        <span className="truncate">{scheduledLabel}</span>
                    </button>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setFutureOrderApproved(false);
                            setScheduledFor(null);
                        }}
                        className="flex shrink-0 items-center justify-center rounded-l-none border-r border-slate-200/90 bg-slate-100 px-2 text-slate-700 hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                        aria-label="ביטול תזמון הזמנה עתידית"
                    >
                        <FaTimes className="h-3 w-3" />
                    </button>
                </div>
            );
        }

        return (
            <button
                type="button"
                onClick={() => setShowFutureOrderModal(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/95 bg-white px-3 py-1.5 text-xs font-black text-brand-primary shadow-sm transition hover:border-brand-primary/35 hover:shadow dark:border-slate-600 dark:bg-slate-900/95 dark:text-orange-300"
            >
                <FaClock className="h-3 w-3 shrink-0 text-brand-primary dark:text-orange-400" aria-hidden />
                <span>הזמנה עתידית</span>
            </button>
        );
    };

    const handleOpenItemModal = (menuItem) => {
        // ✅ בדיקת זמינות לפי שעה/יום (מהשרת) — אם הפריט אינו זמין כרגע, נחסום
        if (menuItem && menuItem.is_available_now === false) {
            setItemAvailabilityNotice(menuItem.unavailable_reason || 'הפריט אינו זמין כרגע');
            return;
        }
        if (!canOrder && !canPreOrder) {
            setClosedRestaurantNotice('לא ניתן להזמין כרגע — המסעדה סגורה.');
            return;
        }
        // הזמנה עתידית (מסעדה סגורה) — חייב לאשר תאריך/שעה לפני הוספה לסל
        if (canPreOrder && !futureOrderApproved) {
            setShowFutureOrderModal(true);
            return;
        }
        setSelectedMenuItem(menuItem);
    };

    const handleCloseModal = () => setSelectedMenuItem(null);

    const handleAddFromModal = (cartPayload) => {
        addToCart(cartPayload);
    };

    const currentSuggestions = useMemo(() => {
        if (menu.length === 0 || cartItems.length === 0) return [];
        return getSuggestions(menu, cartItems);
    }, [menu, cartItems]);

    const handleCartClick = () => {
        if (currentSuggestions.length > 0) {
            setFrozenSuggestions(currentSuggestions);
            setShowSuggestionModal(true);
        } else {
            navigate(`/${effectiveTenantId || tenantId || ''}/cart`);
        }
    };

    const hasRequiredAddonGroups = (item) => {
        return (item.addon_groups || []).some(g => g.is_required || (g.min_select && g.min_select > 0));
    };

    const handleSuggestionQuickAdd = (item) => {
        if (hasRequiredAddonGroups(item)) {
            setSuggestionAddonPicker(item);
            const defaults = {};
            (item.addon_groups || []).forEach(g => { defaults[g.id] = []; });
            setSuggestionSelectedAddons(defaults);
            return;
        }
        const category = menu.find(cat => (cat.items || []).some(i => i.id === item.id));
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

    const handleAddonPickerConfirm = () => {
        if (!suggestionAddonPicker) return;
        const item = suggestionAddonPicker;
        const category = menu.find(cat => (cat.items || []).some(i => i.id === item.id));
        const addons = [];
        (item.addon_groups || []).forEach(g => {
            (suggestionSelectedAddons[g.id] || []).forEach(addonId => {
                const addon = (g.addons || []).find(a => a.id === addonId);
                if (addon) addons.push({ id: addon.id, name: addon.name, price_delta: addon.price_delta || 0, quantity: 1 });
            });
        });
        addToCart({
            menuItemId: item.id,
            categoryId: category?.id,
            name: item.name,
            price: item.price,
            variant: null,
            addons,
            qty: 1,
        });
        setSuggestionAddonPicker(null);
        setSuggestionSelectedAddons({});
    };

    const toggleSuggestionAddon = (group, addonId) => {
        setSuggestionSelectedAddons(prev => {
            const current = prev[group.id] || [];
            const isSelected = current.includes(addonId);
            const maxAllowed = group.max_select || (group.selection_type === 'single' ? 1 : null);
            if (isSelected) {
                return { ...prev, [group.id]: current.filter(id => id !== addonId) };
            }
            if (maxAllowed && maxAllowed === 1) {
                return { ...prev, [group.id]: [addonId] };
            }
            if (maxAllowed && current.length >= maxAllowed) {
                return prev;
            }
            return { ...prev, [group.id]: [...current, addonId] };
        });
    };

    const goToCart = () => {
        setShowSuggestionModal(false);
        navigate(`/${effectiveTenantId || tenantId || ''}/cart`);
    };

    if (loading) {
        return (
            <CustomerLayout>
                <div className="flex justify-center items-center h-64">
                    <p className="text-lg text-gray-600">{UI_TEXT.MSG_LOADING}</p>
                </div>
            </CustomerLayout>
        );
    }

    if (error) {
        return (
            <CustomerLayout>
                <div className="bg-red-100 border border-red-400 text-red-900 px-4 py-3 rounded">
                    <p>{error}</p>
                    <button
                        onClick={loadMenu}
                        className="mt-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition"
                    >
                        נסה שוב
                    </button>
                </div>
            </CustomerLayout>
        );
    }

    return (
        <CustomerLayout>
            {!isPreviewMode && restaurant && (
                <MenuSeo restaurant={restaurant} menuSections={menu} />
            )}

            <TopDismissibleBanner
                open={!!closedRestaurantNotice}
                onClose={() => setClosedRestaurantNotice(null)}
                title="המסעדה סגורה כעת"
                message={closedRestaurantNotice || undefined}
                variant="error"
            />

            <TopDismissibleBanner
                open={!!itemAvailabilityNotice}
                onClose={() => setItemAvailabilityNotice(null)}
                title="הפריט אינו זמין כעת"
                message={itemAvailabilityNotice || undefined}
                variant="warning"
            />

            {!isPreviewMode && restaurant?.is_approved === false && (
                <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-500/35 dark:bg-amber-950/25">
                    <p className="text-sm font-bold text-amber-900 dark:text-amber-100">
                        המסעדה ממתינה לאישור מנהל המערכת
                    </p>
                    <p className="mt-1 text-xs font-medium leading-relaxed text-amber-800 dark:text-amber-200/95">
                        ניתן לעיין בתפריט ולבנות סל לצורך בדיקה. השלמת הזמנה תתאפשר לאחר האישור — עד אז תוצג הודעה בשלב התשלום.
                    </p>
                </div>
            )}

            {/* פופ־אפ עליון-ימני — לקוח מזוהה */}
            {isRecognized && customer?.name && !isPreviewMode && !ordersHintDismissed && (
                <div
                    className="fixed top-3 right-3 sm:top-4 sm:right-4 z-[100] w-[min(calc(100vw-1.5rem),19rem)] motion-reduce:animate-none animate-menu-orders-hint-in pointer-events-none"
                    dir="ltr"
                >
                    <div
                        className="pointer-events-auto relative overflow-hidden rounded-2xl border border-brand-primary/25 bg-white/95 dark:bg-slate-900 dark:border-slate-600 shadow-2xl shadow-brand-primary/15 dark:shadow-black/50 backdrop-blur-md dark:backdrop-blur-none ring-1 ring-black/5 dark:ring-slate-500/40"
                        role="dialog"
                        aria-labelledby="menu-orders-hint-title"
                        dir="rtl"
                    >
                        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-l from-brand-primary via-orange-400 to-brand-secondary" aria-hidden />
                        <button
                            type="button"
                            onClick={dismissOrdersHint}
                            className="absolute top-2 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                            aria-label="סגור הודעה"
                        >
                            <FaTimes className="h-3.5 w-3.5" />
                        </button>
                        <div className="p-4 pt-10 pl-4 pr-10 sm:pt-11">
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-primary/15 text-brand-primary dark:bg-orange-500/25 dark:text-orange-300" aria-hidden>
                                    <FaHistory className="h-4 w-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p id="menu-orders-hint-title" className="text-sm font-black leading-snug text-gray-900 dark:text-white">
                                        היי {customer.name}
                                    </p>
                                    <p className="mt-1 text-xs font-medium leading-relaxed text-gray-600 dark:text-slate-300">
                                        רוצה לראות את ההזמנות הקודמות?
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={openOrderHistory}
                                className="mt-3 w-full rounded-xl bg-brand-primary py-2.5 text-sm font-black text-white shadow-md transition hover:bg-brand-secondary active:scale-[0.98]"
                            >
                                ההזמנות שלי
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {!canOrder && restaurant && (
                <div className="mb-6 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 flex items-center gap-3">
                        <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse shrink-0" />
                        <p className="text-red-800 dark:text-red-400 font-bold flex-1">
                            {activeHolidayClosure ? `המסעדה סגורה — ${activeHolidayClosure.name}` : 'המסעדה סגורה כרגע'}
                        </p>
                    </div>
                    {activeHolidayClosure && !canPreOrder && (
                        <div className="px-4 py-2.5 bg-amber-50/80 dark:bg-amber-900/15 border-t border-amber-200/80 dark:border-amber-500/25">
                            <p className="text-amber-900 dark:text-amber-200/95 text-xs sm:text-sm font-medium leading-snug">
                                המסעדה סגורה לרגל {activeHolidayClosure.name}. לא ניתן לבצע הזמנות עתידיות ליום זה. מוזמנים לחזור לאחר החג!
                            </p>
                        </div>
                    )}
                    {canPreOrder && !futureOrderApproved && (
                        <div className="px-4 py-2.5 bg-amber-50/80 dark:bg-amber-900/15 border-t border-amber-200/80 dark:border-amber-500/25">
                            <p className="text-amber-900 dark:text-amber-200/95 text-xs sm:text-sm font-medium leading-snug">
                                ניתן להזמין מראש — בחרו מועד בלחיצה על התגית <strong>״הזמנה עתידית״</strong> בכרטיס פרטי המסעדה למטה.
                                {!isRegisteredCustomer && restaurant?.accepts_credit_card && (
                                    <span className="block mt-1 text-[11px] opacity-90">התשלום יתבצע באשראי.</span>
                                )}
                            </p>
                        </div>
                    )}
                    {canPreOrder && futureOrderApproved && (
                        <div className="px-4 py-2.5 bg-emerald-50/90 dark:bg-emerald-900/20 border-t border-emerald-200 dark:border-emerald-600/30 flex items-center gap-2">
                            <FaCheckCircle className="text-emerald-600 dark:text-emerald-400 shrink-0 w-4 h-4" aria-hidden />
                            <p className="text-emerald-900 dark:text-emerald-200/95 text-xs sm:text-sm font-medium">
                                ניתן להוסיף מוצרים לסל להזמנה המתוזמנת.{!isRegisteredCustomer && restaurant?.accepts_credit_card ? ' התשלום יתבצע באשראי.' : ''}
                            </p>
                        </div>
                    )}
                    {!canPreOrder && (
                        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/30 border-t border-gray-200 dark:border-gray-700">
                            <p className="text-gray-600 dark:text-gray-400 text-sm">
                                אפשר לעיין בתפריט, אך לא ניתן לבצע הזמנה כרגע.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Hero Section - סגנון Wolt (מובייל: גובה דינמי — בלי חיתוך לוגו/תגית) */}
            <div className="relative -mx-4 sm:-mx-6 lg:-mx-8 -mt-8 mb-8">
                <div
                    className={`relative h-auto overflow-hidden ${restaurant?.menu_hero_background_url
                        ? 'min-h-[17rem] sm:h-96 sm:min-h-0'
                        : 'min-h-[13rem] sm:h-72 sm:min-h-0 bg-gradient-to-br from-brand-dark via-brand-primary to-brand-secondary'
                        }`}
                >
                    {restaurant?.menu_hero_background_url && (
                        <>
                            <div
                                className="absolute inset-0 bg-cover bg-center"
                                style={{
                                    backgroundImage: `url(${resolveAssetUrl(restaurant.menu_hero_background_url)})`,
                                }}
                            />
                            {/* גרדיאנט עדין — רק כדי שהטקסט יהיה קריא, בלי להסתיר את התמונה */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/5" aria-hidden />
                            {restaurant?.logo_url && (
                                <div className="absolute bottom-3 left-3 z-20 h-14 w-14 rounded-2xl bg-white/50 p-1.5 backdrop-blur-sm border border-white/40 shadow-xl sm:bottom-6 sm:left-6 sm:h-20 sm:w-20 sm:p-2 lg:bottom-12">
                                    <img
                                        src={resolveAssetUrl(restaurant.logo_url)}
                                        alt={restaurant?.name}
                                        className="h-full w-full object-contain"
                                    />
                                </div>
                            )}
                        </>
                    )}

                    {/* תגית מיקום המשתמש — למעלה מימין, שקופה; לחיצה פותחת מודל שינוי מיקום */}
                    {!isPreviewMode && (
                        <button
                            type="button"
                            onClick={() => setShowLocationModal(true)}
                            className="absolute top-12 right-3 z-20 inline-flex max-w-[70vw] items-center gap-1.5 rounded-full border border-white/30 bg-white/15 px-3 py-1.5 text-[11px] font-bold text-white shadow-lg backdrop-blur-md transition hover:bg-white/25 sm:top-12 sm:right-4 sm:max-w-sm sm:px-3.5 sm:text-xs"
                            aria-label="שינוי מיקום למשלוח"
                        >
                            <FaMapMarkerAlt className="h-3 w-3 shrink-0 text-white/90" aria-hidden />
                            <span className="truncate">{userLocationLabel || 'בחירת מיקום למשלוח'}</span>
                        </button>
                    )}

                    {/* לוגואים מעומעמים ברקע — רק כשאין תמונת רקע מותאמת */}
                    {!restaurant?.menu_hero_background_url && restaurant?.logo_url && (
                        <>
                            <div
                                className="absolute -top-10 -right-10 w-64 h-64 opacity-10"
                                style={{
                                    backgroundImage: `url(${resolveAssetUrl(restaurant.logo_url)})`,
                                    backgroundSize: 'contain',
                                    backgroundRepeat: 'no-repeat'
                                }}
                            />
                            <div
                                className="absolute -bottom-10 -left-10 w-48 h-48 opacity-10"
                                style={{
                                    backgroundImage: `url(${resolveAssetUrl(restaurant.logo_url)})`,
                                    backgroundSize: 'contain',
                                    backgroundRepeat: 'no-repeat'
                                }}
                            />
                            <div
                                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 opacity-5"
                                style={{
                                    backgroundImage: `url(${resolveAssetUrl(restaurant.logo_url)})`,
                                    backgroundSize: 'contain',
                                    backgroundRepeat: 'no-repeat',
                                    backgroundPosition: 'center'
                                }}
                            />
                        </>
                    )}

                    {/* תוכן ה-Hero — מובייל: בלוק יחסי + ריווח אנכי | sm+: ממורכז באבסולוט */}
                    <div className={`relative z-10 flex flex-col items-center justify-center px-4 pt-10 pb-6 text-center text-white sm:absolute sm:inset-0 sm:min-h-0 sm:py-8 sm:pt-14 sm:pb-8 ${restaurant?.menu_hero_background_url ? 'min-h-[17rem]' : 'min-h-[13rem]'}`}>
                        <div className="flex w-full max-w-lg flex-col items-center">
                            {/* לוגו ממורכז — רק כשאין תמונת הירו (כשיש הירו הלוגו מוצג כתג בפינה) */}
                            {restaurant?.logo_url && !restaurant?.menu_hero_background_url && (
                                <div className="mb-4 flex justify-center sm:mb-5">
                                    <div className="rounded-2xl bg-white p-2.5 shadow-2xl sm:p-3">
                                        <img
                                            src={resolveAssetUrl(restaurant.logo_url)}
                                            alt={restaurant?.name}
                                            className="h-14 w-14 object-contain sm:h-20 sm:w-20"
                                        />
                                    </div>
                                </div>
                            )}
                            <h1 className="mb-2 px-1 text-xl font-bold drop-shadow-lg sm:text-4xl">
                                {restaurant?.name || 'תפריט המסעדה'}
                            </h1>
                            {(restaurant?.cuisine_type || restaurant?.restaurant_type) && (
                                <span className="inline-block max-w-[95vw] whitespace-normal break-words text-center leading-snug bg-white/20 px-3 py-1.5 text-xs font-bold backdrop-blur-sm rounded-full sm:max-w-lg sm:px-4 sm:text-sm">
                                    {restaurant.cuisine_type || (restaurant.restaurant_type ? ({
                                        pizza: 'פיצה',
                                        shawarma: 'שווארמה',
                                        burger: 'המבורגר',
                                        bistro: 'ביסטרו',
                                        catering: 'קייטרינג',
                                        general: 'כללי'
                                    }[restaurant.restaurant_type] || restaurant.restaurant_type) : '')}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* כרטיס מידע צף */}
                {restaurant && (
                    <div className="mx-4 sm:mx-6 lg:mx-8 mt-0 sm:-mt-2 lg:-mt-8 relative z-10">
                        <div className="bg-white dark:bg-brand-dark-surface rounded-2xl shadow-xl border border-gray-100/90 dark:border-brand-dark-border px-3 py-3 sm:px-4 sm:py-3.5">
                            {/* שורה עליונה: 3 בעמודה — פתוח · משלוחים · איסוף */}
                            <div className="grid grid-cols-3 gap-2 sm:gap-2">
                                <div className="flex min-w-0 items-center justify-center gap-1 rounded-full border border-slate-200/95 bg-white px-2 py-1.5 text-center text-xs font-black shadow-sm dark:border-slate-600 dark:bg-slate-900/95">
                                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${isOpenNow ? 'animate-pulse bg-emerald-500' : 'bg-rose-500'}`} />
                                    <span className="truncate text-slate-800 dark:text-slate-100">{isOpenNow ? 'פתוח' : 'סגור'}</span>
                                </div>

                                {restaurant.has_delivery ? (
                                    <div
                                        className="flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-full border border-slate-200/95 bg-white px-2 py-1.5 shadow-sm dark:border-slate-600 dark:bg-slate-900/95"
                                        aria-label={
                                            deliveryMinAmount > 0
                                                ? `משלוח זמין, מינימום למשלוח ₪${deliveryMinAmount.toFixed(0)}`
                                                : 'משלוח זמין, ללא מינימום למשלוח'
                                        }
                                    >
                                        <div className="flex items-center justify-center gap-1 text-xs font-black text-slate-800 dark:text-slate-100">
                                            <FaTruck className="h-4 w-4 shrink-0 text-slate-600 dark:text-slate-400 sm:h-3 sm:w-3" aria-hidden />
                                            <span className="truncate hidden sm:inline">משלוח זמין</span>
                                        </div>
                                        <span className="hidden text-[10px] font-bold leading-none text-slate-600 dark:text-slate-400 sm:block">
                                            {deliveryMinAmount > 0 ? `מינימום למשלוח: ₪${deliveryMinAmount.toFixed(0)}` : 'ללא מינימום למשלוח'}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="rounded-full border border-transparent min-h-[2.25rem]" aria-hidden />
                                )}

                                {restaurant.has_pickup ? (
                                    <div
                                        className="inline-flex min-w-0 items-center justify-center gap-1 rounded-full border border-slate-200/95 bg-white px-2.5 py-1.5 shadow-sm dark:border-slate-600 dark:bg-slate-900/95"
                                        aria-label="איסוף עצמי זמין"
                                    >
                                        <FaShoppingBag className="h-4 w-4 shrink-0 text-slate-600 dark:text-slate-400 sm:h-3 sm:w-3" aria-hidden />
                                        <span className="hidden truncate text-xs font-black text-slate-800 dark:text-slate-100 sm:inline">איסוף עצמי זמין</span>
                                    </div>
                                ) : (
                                    <div className="rounded-full border border-transparent min-h-[2.25rem]" aria-hidden />
                                )}
                            </div>

                            <div className="my-3 flex items-center gap-3 sm:my-4">
                                <span className="h-px flex-1 bg-gray-200 dark:bg-brand-dark-border" />
                                <span className="shrink-0 px-1 text-[10px] font-black tracking-[0.2em] text-gray-400 dark:text-gray-500">··</span>
                                <span className="h-px flex-1 bg-gray-200 dark:bg-brand-dark-border" />
                            </div>

                            {/* שורה שנייה: הזמנה עתידית · מידע נוסף */}
                            <div className="flex flex-wrap items-center justify-center gap-2">
                                {allowsFutureOrders && renderFutureOrderRestaurantTag()}
                                <button
                                    type="button"
                                    onClick={() => setShowInfoModal(true)}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/95 bg-white px-3 py-1.5 text-xs font-black text-brand-primary shadow-sm transition hover:border-brand-primary/35 hover:shadow dark:border-slate-600 dark:bg-slate-900/95 dark:text-orange-300"
                                >
                                    <FaInfoCircle className="h-3 w-3 shrink-0 text-brand-primary dark:text-orange-400" aria-hidden />
                                    מידע נוסף
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* שורת חיפוש בתפריט — סגנון Wolt, תוצאות בפאנל נפתח בלי להעלים את התפריט */}
            {menu.length > 0 && (
                <div ref={searchBarRef} className="relative z-[45] mb-6">
                    <div className="relative">
                        <FaSearch className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-brand-dark-muted" aria-hidden />
                        <input
                            ref={searchInputRef}
                            type="search"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={`חיפוש ב- ${restaurant?.name || 'תפריט'}`}
                            aria-label="חיפוש בתפריט"
                            className="w-full rounded-full bg-gray-100 dark:bg-brand-dark-surface border border-transparent dark:border-brand-dark-border py-3 pr-11 pl-10 text-sm font-medium text-gray-800 dark:text-brand-dark-text placeholder:text-gray-400 dark:placeholder:text-brand-dark-muted outline-none transition focus:border-brand-primary/40 focus:bg-white dark:focus:bg-brand-dark-bg focus:ring-2 focus:ring-brand-primary/20"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute left-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
                                aria-label="נקה חיפוש"
                            >
                                <FaTimes size={14} />
                            </button>
                        )}
                    </div>

                    {/* פאנל תוצאות חיפוש — צף מעל התפריט */}
                    {searchQuery.trim() && (
                        <div className="absolute top-full right-0 left-0 mt-2 max-h-[60vh] overflow-y-auto rounded-2xl bg-white dark:bg-brand-dark-surface border border-gray-100 dark:border-brand-dark-border shadow-2xl">
                            {searchResults.length === 0 ? (
                                <div className="p-6 text-center">
                                    <FaSearch className="mx-auto mb-2 text-2xl text-gray-300 dark:text-brand-dark-muted" aria-hidden />
                                    <p className="text-sm font-bold text-gray-500 dark:text-brand-dark-muted">לא נמצאו תוצאות עבור ״{searchQuery}״</p>
                                </div>
                            ) : (
                                <ul className="divide-y divide-gray-100 dark:divide-brand-dark-border">
                                    {searchResults.map((item) => {
                                        const itemAvailableNow = item.is_available_now !== false;
                                        return (
                                            <li key={`search-${item.id}`}>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        handleOpenItemModal(item);
                                                        setSearchQuery('');
                                                    }}
                                                    className={`flex w-full items-center gap-3 p-3 text-right transition hover:bg-gray-50 dark:hover:bg-brand-dark-bg ${!itemAvailableNow ? 'opacity-60' : ''}`}
                                                >
                                                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-brand-dark-border">
                                                        {item.image_url ? (
                                                            <img src={resolveAssetUrl(item.image_url)} alt="" loading="lazy" className="h-full w-full object-cover" />
                                                        ) : restaurant?.logo_url ? (
                                                            <img src={resolveAssetUrl(restaurant.logo_url)} alt="" className="h-full w-full object-contain p-1.5 opacity-30" />
                                                        ) : null}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate text-sm font-bold text-brand-dark dark:text-brand-dark-text">{item.name}</p>
                                                        <p className="truncate text-xs text-gray-500 dark:text-brand-dark-muted">{item.category_name}</p>
                                                    </div>
                                                    <span className="shrink-0 text-sm font-bold text-brand-primary">₪{item.price}</span>
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* באנר מבצעים פעילים — שורה אחת, קוביות + גלילה אופקית */}
            {bannerPromotions.length > 0 && (
                <div className="mb-6 -mx-1 px-1">
                    <div className="flex flex-row gap-3 overflow-x-auto pb-1 snap-x snap-mandatory [scrollbar-width:thin]">
                        {bannerPromotions.map((promo) => {
                            const rewardText = promo.rewards?.map(r => {
                                if (r.reward_type === 'free_item' && r.reward_menu_item_name) return `${r.reward_menu_item_name} במתנה`;
                                if (r.reward_type === 'free_item' && r.reward_category_name) return `${r.reward_category_name} במתנה`;
                                if (r.reward_type === 'discount_percent') return `${r.reward_value}% הנחה${r.discount_scope === 'selected_items' ? ' (נבחרים)' : ''}`;
                                if (r.reward_type === 'discount_fixed') return `₪${r.reward_value} הנחה${r.discount_scope === 'selected_items' ? ' ליחידה' : ''}`;
                                if (r.reward_type === 'fixed_price') return `במחיר מיוחד ₪${r.reward_value}`;
                                return 'הטבה מיוחדת';
                            }).join(' + ') || 'הטבה מיוחדת';

                            const ruleCategory = promo.rules?.[0];

                            return (
                                <button
                                    key={promo.id}
                                    type="button"
                                    onClick={() => {
                                        if (ruleCategory?.required_category_id) {
                                            scrollToCategory(ruleCategory.required_category_id);
                                        }
                                    }}
                                    className="snap-start shrink-0 w-[min(76vw,210px)] sm:w-[220px] rounded-2xl overflow-hidden border border-orange-200/80 dark:border-orange-900/40 bg-gradient-to-b from-amber-500 to-orange-600 text-white shadow-lg shadow-orange-500/25 text-right flex flex-col transition-all hover:shadow-xl hover:brightness-105 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                                >
                                    {promo.image_url ? (
                                        <div className="relative h-24 sm:h-28 w-full shrink-0">
                                            <img
                                                src={resolveAssetUrl(promo.image_url)}
                                                alt={promo.name}
                                                className="absolute inset-0 h-full w-full object-cover"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-orange-900/90 via-orange-900/20 to-transparent" />
                                        </div>
                                    ) : (
                                        <div className="h-24 sm:h-28 shrink-0 flex items-center justify-center bg-white/10">
                                            <FaTag className="text-3xl text-white/90" aria-hidden />
                                        </div>
                                    )}
                                    <div className="p-3 flex flex-col gap-1 min-w-0 flex-1">
                                        <p className="font-black text-xs sm:text-sm leading-snug line-clamp-2">{promo.name}</p>
                                        <p className="text-[10px] sm:text-xs font-bold text-white/90 leading-snug line-clamp-3">{rewardText}</p>
                                        {ruleCategory?.required_category_id && (
                                            <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-black text-white/80">
                                                <FaChevronLeft className="text-[10px] opacity-80" aria-hidden />
                                                לקטגוריה
                                            </span>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ניווט קטגוריות - דבוק למעלה בסגנון Wolt */}
            {menu.length > 0 && (
                <div className="sticky top-16 z-40 bg-white/95 dark:bg-brand-dark-bg/95 backdrop-blur-md border-b border-gray-200 dark:border-brand-dark-border -mx-4 sm:-mx-6 lg:-mx-8 mb-6">
                    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
                        <div className="flex items-center gap-2">
                            <div className="flex flex-1 gap-2 overflow-x-auto scrollbar-hide">
                            {menu.map((category) => (
                                <button
                                    key={category.id}
                                    ref={el => tabRefs.current[category.id] = el}
                                    onClick={() => scrollToCategory(category.id)}
                                    className={`
                                        flex items-center gap-2 px-3 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-all duration-300
                                        ${activeCategory === category.id
                                            ? 'bg-brand-primary text-white shadow-md'
                                            : 'bg-gray-100 dark:bg-brand-dark-border text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-500'
                                        }
                                        ${isPWA ? 'pwa:px-5 pwa:py-3.5 pwa:text-base pwa:font-bold pwa:shadow-lg' : ''}
                                        ${isPWA && activeCategory === category.id ? 'pwa:bg-orange-600' : ''}
                                    `}
                                    style={isPWA ? {
                                        padding: activeCategory === category.id ? '0.875rem 1.25rem' : '0.75rem 1.25rem',
                                        fontSize: '1rem',
                                        fontWeight: '700'
                                    } : {}}
                                >
                                    {restaurant?.logo_url && activeCategory === category.id && (
                                        <img src={resolveAssetUrl(restaurant.logo_url)} alt="" className="h-4 w-4 object-contain opacity-90" />
                                    )}
                                    <span>{category.name}</span>
                                    <span className="text-xs opacity-70">({category.items?.length || 0})</span>
                                </button>
                            ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* תוכן התפריט — ריווח תחתון מול בר הסל הצף */}
            <div className="space-y-8 md:space-y-10 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]">
                {menu.length === 0 ? (
                    <div className="bg-white dark:bg-brand-dark-surface rounded-2xl shadow-sm p-12 text-center">
                        {restaurant?.logo_url && (
                            <img src={resolveAssetUrl(restaurant.logo_url)} alt="" className="h-20 w-20 mx-auto mb-4 opacity-30" />
                        )}
                        <p className="text-gray-500 dark:text-brand-dark-muted text-lg">עדיין אין פריטים בתפריט</p>
                    </div>
                ) : (
                    menu.map((category) => (
                        <div
                            key={category.id}
                            ref={el => categoryRefs.current[category.id] = el}
                            className="scroll-mt-32"
                        >
                            {/* כותרת קטגוריה - סגנון Wolt */}
                            <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
                                {restaurant?.logo_url && (
                                    <div className="bg-gradient-to-br from-brand-primary/20 to-brand-secondary/20 p-2 sm:p-3 rounded-xl shrink-0">
                                        <img
                                            src={resolveAssetUrl(restaurant.logo_url)}
                                            alt=""
                                            className="h-6 w-6 sm:h-8 sm:w-8 object-contain"
                                        />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <h2 className="text-lg sm:text-3xl font-bold text-brand-dark dark:text-brand-dark-text">{category.name}</h2>
                                    {category.description && (
                                        <p className="text-gray-500 dark:text-brand-dark-muted text-xs sm:text-sm mt-1 line-clamp-2 sm:line-clamp-none">{category.description}</p>
                                    )}
                                </div>
                                <div className="hidden sm:block h-px flex-1 bg-gradient-to-l from-transparent via-gray-200 dark:via-brand-dark-border to-transparent"></div>
                            </div>

                            {/* רשימת מנות - שורות בסגנון Wolt */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                                {category.items.length === 0 ? (
                                    <p className="text-gray-400 italic col-span-full text-center py-8">אין פריטים זמינים</p>
                                ) : (
                                    category.items.map((item) => {
                                        const itemAvailableNow = item.is_available_now !== false;
                                        const itemUnavailableReason = item.unavailable_reason || 'הפריט אינו זמין כרגע';
                                        const isDrinkCategory = category.name?.includes('שתיי') || category.name?.includes('שתיה') || category.name?.includes('משק');
                                        return (
                                            <div
                                                key={item.id}
                                                onClick={() => {
                                                    handleOpenItemModal({ ...item, category_name: category.name });
                                                }}
                                                className={`group relative flex items-stretch justify-between gap-3 bg-white dark:bg-brand-dark-surface rounded-2xl border border-gray-100 dark:border-brand-dark-border p-3 shadow-[0_2px_10px_rgba(0,0,0,0.04)] transition-all duration-300 ${!itemAvailableNow ? 'cursor-not-allowed opacity-70' : (canOrder || canPreOrder) ? 'cursor-pointer hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:border-brand-primary/25' : 'cursor-not-allowed opacity-80'}`}
                                            >
                                                {/* פרטי המנה — צד ימין */}
                                                <div className="flex min-w-0 flex-1 flex-col py-0.5">
                                                    <h3 className={`text-sm sm:text-base font-bold leading-snug line-clamp-2 transition-colors ${itemAvailableNow ? 'text-brand-dark dark:text-brand-dark-text group-hover:text-brand-primary' : 'text-gray-500 dark:text-brand-dark-muted'}`}>
                                                        {item.name}
                                                    </h3>
                                                    {item.description && (
                                                        <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-brand-dark-muted line-clamp-2 leading-snug">
                                                            {item.description}
                                                        </p>
                                                    )}
                                                    <div className="mt-auto pt-2 flex flex-wrap items-center gap-2">
                                                        <span className={`text-sm sm:text-base font-bold whitespace-nowrap ${itemAvailableNow ? 'text-brand-dark dark:text-brand-dark-text' : 'text-gray-400 line-through'}`}>
                                                            ₪{item.price}
                                                        </span>
                                                        {item.tag && itemAvailableNow && (
                                                            <span className="inline-flex items-center rounded-full bg-brand-cream dark:bg-brand-primary/20 px-2 py-0.5 text-[10px] font-black text-brand-muted dark:text-orange-300">
                                                                {item.tag}
                                                            </span>
                                                        )}
                                                        {!itemAvailableNow && (
                                                            <span className="inline-flex items-center gap-1 text-[11px] font-black text-rose-600">
                                                                <FaClock size={10} />
                                                                {itemUnavailableReason}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* תמונה — צד שמאל, עם כפתור + בפינה */}
                                                <div className="relative h-24 w-24 sm:h-28 sm:w-28 shrink-0 self-center">
                                                    <div className="h-full w-full overflow-hidden rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-brand-dark-border/50 dark:to-brand-dark-bg">
                                                        {item.image_url ? (
                                                            <img
                                                                src={resolveAssetUrl(item.image_url)}
                                                                alt={item.name}
                                                                loading="lazy"
                                                                className={`h-full w-full ${isDrinkCategory ? 'object-contain scale-110 bg-white dark:bg-brand-dark-surface' : 'object-cover'} transition-transform duration-500 ${itemAvailableNow ? (isDrinkCategory ? 'group-hover:scale-[1.18]' : 'group-hover:scale-105') : 'grayscale'}`}
                                                            />
                                                        ) : restaurant?.logo_url ? (
                                                            <div className="flex h-full w-full items-center justify-center p-4">
                                                                <img
                                                                    src={resolveAssetUrl(restaurant.logo_url)}
                                                                    alt=""
                                                                    className="h-full w-full object-contain opacity-20"
                                                                />
                                                            </div>
                                                        ) : null}

                                                        {/* שכבת "אינו זמין" */}
                                                        {!itemAvailableNow && (
                                                            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-slate-900/50 backdrop-blur-[1px]">
                                                                <FaClock className="text-xl text-white drop-shadow" aria-hidden />
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* כפתור + בפינת התמונה — סגנון Wolt */}
                                                    {itemAvailableNow && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleOpenItemModal({ ...item, category_name: category.name });
                                                            }}
                                                            disabled={!canOrder && !canPreOrder}
                                                            aria-label={`הוספת ${item.name} לסל`}
                                                            className={`absolute top-0 left-0 z-20 flex h-8 w-8 items-center justify-center rounded-tl-xl rounded-br-xl text-white shadow-md transition-all ${(canOrder || canPreOrder) ? 'bg-brand-primary hover:bg-brand-secondary active:scale-95' : 'bg-gray-400 cursor-not-allowed'}`}
                                                        >
                                                            <FaPlus size={12} aria-hidden />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* מודל שינוי מיקום למשלוח — נפתח מתגית המיקום בהירו (העדכון מגיע דרך אירוע user-location-changed) */}
            <LocationPickerModal
                open={showLocationModal}
                onClose={() => setShowLocationModal(false)}
                onLocationSelected={() => setShowLocationModal(false)}
            />

            <MenuItemModal
                item={selectedMenuItem}
                isOpen={Boolean(selectedMenuItem)}
                onClose={handleCloseModal}
                onAdd={handleAddFromModal}
                isOrderingEnabled={canOrder || (canPreOrder && futureOrderApproved) || (canScheduleFuture && futureOrderApproved)}
            />

            {/* מודל מסעדת דמו — אישור מפורש (מסך מלא / bottom sheet במובייל) */}
            {!isPreviewMode && showDemoDisclaimerModal && restaurant?.is_demo && (
                <div
                    className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center sm:p-4"
                    dir="rtl"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="demo-disclaimer-title"
                >
                    <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-md" aria-hidden />
                    <div className="relative w-full sm:max-w-md animate-slide-up sm:animate-none">
                        <div className="bg-white dark:bg-brand-dark-surface rounded-t-[1.75rem] sm:rounded-3xl shadow-2xl border border-amber-200/80 dark:border-amber-900/40 overflow-hidden ring-1 ring-black/5">
                            <div className="relative bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 px-6 pt-8 pb-10 text-white">
                                <div className="absolute inset-0 opacity-25 bg-[radial-gradient(circle_at_20%_20%,white,transparent_45%),radial-gradient(circle_at_80%_0%,white,transparent_40%)]" />
                                <div className="relative flex flex-col items-center text-center gap-3">
                                    <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 shadow-lg">
                                        <FaMask className="text-4xl text-white drop-shadow" aria-hidden />
                                    </div>
                                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/90">סביבת הדגמה</p>
                                    <h2 id="demo-disclaimer-title" className="text-2xl sm:text-[1.65rem] font-black leading-tight px-1">
                                        מסעדה לדוגמה
                                    </h2>
                                </div>
                            </div>
                            <div className="px-5 sm:px-6 pt-2 pb-6 sm:pb-7 -mt-6 relative">
                                <div className="rounded-2xl bg-amber-50/95 dark:bg-amber-950/35 border border-amber-200/90 dark:border-amber-800/50 p-4 sm:p-5 shadow-sm">
                                    <p className="text-sm text-amber-950 dark:text-amber-100/95 leading-relaxed font-medium text-center">
                                        זוהי <strong>מסעדת דמו</strong> לצורכי הדגמה והיכרות עם המערכת בלבד.
                                        <span className="block mt-2 text-amber-900/90 dark:text-amber-200/90 text-[13px]">
                                            הזמנות ותשלומים כאן אינם אמיתיים ואינם נשלחים לטיפול עסקי.
                                        </span>
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={acknowledgeDemoDisclaimer}
                                    className="mt-5 w-full py-3.5 rounded-2xl font-black text-base text-white bg-gradient-to-l from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 dark:from-amber-500 dark:to-orange-600 shadow-lg shadow-orange-500/25 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                                >
                                    <FaCheckCircle className="text-xl opacity-95" aria-hidden />
                                    הבנתי, המשך לתפריט
                                </button>
                                <p className="text-center text-[11px] text-gray-400 dark:text-gray-500 mt-3 font-medium">
                                    לחיצה מהווה אישור שהבנתם שמדובר בסביבת הדגמה
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* מודל מידע נוסף */}
            {showInfoModal && restaurant && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowInfoModal(false)}>
                    <div className="bg-white dark:bg-brand-dark-surface rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        {/* כותרת */}
                        <div className="bg-white dark:bg-brand-dark-surface p-5 border-b border-gray-100 dark:border-brand-dark-border rounded-t-2xl sticky top-0 z-10">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gray-50 dark:bg-brand-dark-border rounded-full flex items-center justify-center">
                                        <FaInfoCircle className="text-gray-900 dark:text-brand-dark-text" size={18} />
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-brand-dark-text">מידע נוסף</h3>
                                </div>
                                <button
                                    onClick={() => setShowInfoModal(false)}
                                    className="w-8 h-8 rounded-full bg-gray-50 dark:bg-brand-dark-border hover:bg-gray-100 dark:hover:bg-gray-500 text-gray-500 dark:text-gray-400 flex items-center justify-center transition-colors"
                                >
                                    ×
                                </button>
                            </div>
                        </div>

                        {/* תוכן */}
                        <div className="p-6 space-y-6">
                            {/* יצירת קשר, כתובת וניווט */}
                            {(restaurant.address || restaurant.city || restaurant.phone || wazeLink) && (
                                <div className="space-y-4 rounded-2xl border border-gray-200/90 bg-gray-50/90 p-4 dark:border-brand-dark-border dark:bg-brand-dark-bg/90">
                                    <div className="flex items-center gap-2 border-b border-gray-200/80 pb-2 dark:border-brand-dark-border">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary dark:bg-brand-primary/20 dark:text-orange-300">
                                            <FaMapMarkerAlt className="h-4 w-4" aria-hidden />
                                        </div>
                                        <h4 className="text-sm font-black text-gray-900 dark:text-brand-dark-text">כתובת ויצירת קשר</h4>
                                    </div>
                                    {(restaurant.address || restaurant.city) && (
                                        <p className="text-sm font-medium leading-relaxed text-gray-700 dark:text-brand-dark-muted">
                                            {[restaurant.address, restaurant.city].filter(Boolean).join(', ')}
                                        </p>
                                    )}
                                    <div className="flex flex-wrap gap-2">
                                        {wazeLink && (
                                            <a
                                                href={wazeLink}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex flex-1 min-w-[8.5rem] items-center justify-center gap-2 rounded-xl bg-[#33CCFF]/15 px-3 py-2.5 text-sm font-black text-sky-800 ring-1 ring-sky-400/30 transition hover:bg-[#33CCFF]/25 dark:text-sky-200 dark:ring-sky-500/40"
                                            >
                                                <SiWaze className="h-4 w-4 text-[#33CCFF]" aria-hidden />
                                                פתח ב-Waze
                                            </a>
                                        )}
                                        {phoneHref && restaurant.phone && (
                                            <a
                                                href={phoneHref}
                                                className="inline-flex flex-1 min-w-[8.5rem] items-center justify-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-black text-emerald-800 ring-1 ring-emerald-200/90 transition hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-800/50"
                                            >
                                                <FaPhoneAlt className="h-3.5 w-3.5" aria-hidden />
                                                <span dir="ltr" className="truncate">{restaurant.phone}</span>
                                            </a>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* כשרות */}
                            {(restaurant.kosher_type || restaurant.kosher_certificate || restaurant.kosher_notes) && (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <FaShieldAlt className="text-gray-400 dark:text-gray-500" size={14} />
                                        <h4 className="text-sm font-bold text-gray-900 dark:text-brand-dark-text">כשרות</h4>
                                    </div>
                                    <div className="pl-6 space-y-2">
                                        {restaurant.kosher_type && (
                                            <div className="flex items-start">
                                                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-brand-dark-border px-2.5 py-1 rounded-md border border-gray-200 dark:border-brand-dark-border">
                                                    {restaurant.kosher_type === 'kosher' && 'כשר'}
                                                    {restaurant.kosher_type === 'mehadrin' && 'כשר למהדרין'}
                                                    {restaurant.kosher_type === 'non-kosher' && 'לא כשר'}
                                                </span>
                                            </div>
                                        )}
                                        {restaurant.kosher_certificate && (
                                            <p className="text-xs text-gray-600 dark:text-brand-dark-muted">
                                                <span className="font-semibold text-gray-900 dark:text-brand-dark-text">תעודה:</span> {restaurant.kosher_certificate}
                                            </p>
                                        )}
                                        {restaurant.kosher_notes && (
                                            <p className="text-xs text-gray-500 dark:text-brand-dark-muted leading-relaxed">
                                                {restaurant.kosher_notes}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* אלרגנים נפוצים */}
                            {(allergensList.length > 0 || restaurant.allergen_notes) && (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <FaExclamationTriangle className="text-gray-400 dark:text-gray-500" size={14} />
                                        <h4 className="text-sm font-bold text-gray-900 dark:text-brand-dark-text">אלרגנים נפוצים</h4>
                                    </div>
                                    <div className="pl-6 space-y-3">
                                        {allergensList.length > 0 && (
                                            <div className="flex flex-wrap gap-2">
                                                {allergensList.map((allergen, idx) => (
                                                    <span key={idx} className="text-xs text-gray-600 dark:text-brand-dark-muted bg-gray-50 dark:bg-brand-dark-border/50 border border-gray-100 dark:border-brand-dark-border px-2.5 py-1 rounded-md">
                                                        {allergen === 'gluten' && 'גלוטן'}
                                                        {allergen === 'dairy' && 'חלב'}
                                                        {allergen === 'eggs' && 'ביצים'}
                                                        {allergen === 'nuts' && 'אגוזים'}
                                                        {allergen === 'peanuts' && 'בוטנים'}
                                                        {allergen === 'soy' && 'סויה'}
                                                        {allergen === 'fish' && 'דגים'}
                                                        {allergen === 'shellfish' && 'פירות ים'}
                                                        {allergen === 'sesame' && 'שומשום'}
                                                        {!['gluten', 'dairy', 'eggs', 'nuts', 'peanuts', 'soy', 'fish', 'shellfish', 'sesame'].includes(allergen) && allergen}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        {restaurant.allergen_notes && (
                                            <p className="text-xs text-gray-500 dark:text-brand-dark-muted leading-relaxed">
                                                {restaurant.allergen_notes}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* משלוח ואיסוף */}
                            {(restaurant.has_delivery || restaurant.has_pickup) && (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <FaTruck className="text-gray-400 dark:text-gray-500" size={14} />
                                        <h4 className="text-sm font-bold text-gray-900 dark:text-brand-dark-text">משלוח ואיסוף</h4>
                                    </div>
                                    <div className="pl-6 space-y-1.5 text-sm leading-snug text-gray-800 dark:text-brand-dark-muted">
                                        <p className="flex flex-wrap items-center justify-start gap-x-3 gap-y-1 text-gray-800 dark:text-brand-dark-muted">
                                            {restaurant.has_delivery && (
                                                <span>
                                                    משלוח{' '}
                                                    <span className="font-black text-brand-primary dark:text-orange-300">זמין</span>
                                                </span>
                                            )}
                                            {restaurant.has_delivery && restaurant.has_pickup && (
                                                <span className="text-gray-400 dark:text-gray-500 font-light select-none" aria-hidden>
                                                    |
                                                </span>
                                            )}
                                            {restaurant.has_pickup && (
                                                <span>
                                                    איסוף עצמי{' '}
                                                    <span className="font-black text-brand-primary dark:text-orange-300">זמין</span>
                                                </span>
                                            )}
                                        </p>
                                        {restaurant.has_delivery && deliveryMinAmount > 0 && (
                                            <p className="text-gray-600 dark:text-gray-400 pr-1">
                                                מינימום למשלוח:{' '}
                                                <span className="font-bold text-gray-900 dark:text-brand-dark-text">
                                                    ₪{deliveryMinAmount.toFixed(0)}
                                                </span>
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* אמצעי תשלום */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <FaCreditCard className="text-gray-400 dark:text-gray-500" size={14} />
                                    <h4 className="text-sm font-bold text-gray-900 dark:text-brand-dark-text">אמצעי תשלום</h4>
                                </div>
                                <div className="pl-6 flex flex-wrap gap-2">
                                    {(restaurant.available_payment_methods || ['cash']).includes('cash') && (
                                        <span className="text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 px-2.5 py-1 rounded-md flex items-center gap-1.5">
                                            <FaMoneyBillWave size={10} />
                                            מזומן
                                        </span>
                                    )}
                                    {restaurant.available_payment_methods?.includes('credit_card') && (
                                        <span className="text-xs text-brand-muted dark:text-orange-200 bg-brand-light dark:bg-brand-primary/20 border border-brand-primary/20 dark:border-brand-primary/40 px-2.5 py-1 rounded-md flex items-center gap-1.5">
                                            <FaCreditCard size={10} className="text-brand-primary dark:text-orange-300" />
                                            כרטיס אשראי
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* מפריד */}
                            <div className="border-t border-gray-100 dark:border-brand-dark-border my-2"></div>

                            {/* שעות פתיחה */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <FaClock className="text-gray-400 dark:text-gray-500" size={14} />
                                    <h4 className="text-sm font-bold text-gray-900 dark:text-brand-dark-text">שעות פתיחה</h4>
                                </div>

                                <div className="pl-6 space-y-4">
                                    {/* סטטוס נוכחי */}
                                    <div className="flex items-center gap-2">
                                        <span className={`w-2 h-2 rounded-full ${isOpenNow ? 'bg-green-500' : 'bg-red-500'}`} />
                                        <p className={`text-sm font-medium ${isOpenNow ? 'text-green-600' : 'text-red-500'}`}>
                                            {isOpenNow ? 'פתוח עכשיו' : 'סגור עכשיו'}
                                        </p>
                                    </div>

                                    {/* שעות שבועיות — מיזוג יום + default + ברירות תואמות לאדמין כשחסרים מחרוזות ב-API */}
                                    {!hasOperatingHoursToShowInMenu(displayOperatingHours) ? (
                                        <p className="text-xs text-gray-400 dark:text-gray-500 italic">לא עודכנו שעות פעילות</p>
                                    ) : (
                                        <div className="space-y-1.5 text-sm">
                                            {MENU_DAY_ORDER_HE.map((day, index) => {
                                                const { closed, open, close } = resolveDayHoursMerged(displayOperatingHours, day);
                                                const isToday = new Date().getDay() === index;
                                                const line = closed ? 'סגור' : open && close ? `${open} - ${close}` : '-';

                                                return (
                                                    <div key={day} className={`flex justify-between ${isToday ? 'font-bold text-gray-900 dark:text-brand-dark-text' : 'text-gray-500 dark:text-brand-dark-muted'}`}>
                                                        <span>{day}</span>
                                                        <span className={closed ? 'text-gray-400 dark:text-gray-500' : ''}>
                                                            {line}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* הערות שעות */}
                                    {displayOperatingHours?.special_days && Object.keys(displayOperatingHours.special_days).length > 0 && (
                                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                                            * ייתכנו שינויים בימים מיוחדים
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* כפתור סגירה */}
                        <div className="p-4 border-t border-gray-100 dark:border-brand-dark-border">
                            <button
                                onClick={() => setShowInfoModal(false)}
                                className="w-full py-3 bg-gray-900 dark:bg-brand-dark-border text-white font-bold rounded-xl hover:bg-black dark:hover:bg-gray-600 transition-all text-sm"
                            >
                                סגור
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* בר סל תחתון — סגנון Wolt */}
            {totalCartItems > 0 && (
                <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-[60] px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
                    <button
                        onClick={handleCartClick}
                        aria-label="מעבר לסל הקניות"
                        className="pointer-events-auto mx-auto flex w-full max-w-xl items-center justify-between gap-3 rounded-2xl bg-brand-primary px-4 py-3.5 text-white shadow-[0_8px_30px_rgba(0,0,0,0.25)] transition-all hover:bg-brand-secondary active:scale-[0.99]"
                    >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/25 text-sm font-black">
                            {totalCartItems}
                        </span>
                        <span className="flex items-center gap-2 text-sm sm:text-base font-bold">
                            <FaShoppingBag aria-hidden />
                            הצגת פריטים
                        </span>
                        <span className="text-sm sm:text-base font-black whitespace-nowrap" dir="ltr">
                            ₪ {cartTotalPrice.toFixed(2)}
                        </span>
                    </button>
                </div>
            )}

            {/* Suggestion Modal - before going to cart */}
            {showSuggestionModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-brand-dark-surface w-full max-w-lg rounded-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-100 dark:border-brand-dark-border shrink-0">
                            <h2 className="text-lg sm:text-xl font-black text-gray-900 dark:text-brand-dark-text">רגע לפני הסל...</h2>
                            <button
                                onClick={goToCart}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
                            >
                                <FaTimes size={18} />
                            </button>
                        </div>

                        {/* Suggestions */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {frozenSuggestions.map((suggestion) => {
                                const Icon = suggestion.icon;
                                return (
                                    <div key={suggestion.type} className="bg-gradient-to-l from-brand-light to-orange-50/80 dark:from-brand-primary/15 dark:to-orange-950/30 rounded-2xl p-3 sm:p-4 border border-brand-primary/15 dark:border-brand-primary/35">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="bg-brand-primary/15 dark:bg-brand-primary/25 p-2 rounded-xl">
                                                <Icon className="text-brand-primary dark:text-orange-300" size={16} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-800 dark:text-gray-200 text-sm">{suggestion.title}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">{suggestion.subtitle}</p>
                                            </div>
                                        </div>

                                        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
                                            {suggestion.items.map((item) => {
                                                const itemQty = cartItems.filter(ci => ci.menuItemId === item.id).reduce((s, ci) => s + ci.qty, 0);
                                                return (
                                                    <div
                                                        key={item.id}
                                                        className="flex-shrink-0 w-24 sm:w-28 bg-white dark:bg-brand-dark-surface rounded-2xl border-none overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] transition-all duration-300 cursor-pointer relative"
                                                        onClick={() => handleSuggestionQuickAdd(item)}
                                                    >
                                                        {itemQty > 0 && (
                                                            <div className="absolute top-1 right-1 bg-brand-primary text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center z-10 shadow-md">
                                                                {itemQty}
                                                            </div>
                                                        )}
                                                        <div className="h-16 sm:h-20 bg-gray-50 dark:bg-brand-dark-border/50 overflow-hidden relative">
                                                            {item.image_url ? (
                                                                <img src={resolveAssetUrl(item.image_url)} alt="" className="w-full h-full object-cover" />
                                                            ) : restaurant?.logo_url ? (
                                                                <div className="absolute inset-0 flex items-center justify-center p-3">
                                                                    <img src={resolveAssetUrl(restaurant.logo_url)} alt="" className="w-full h-full object-contain opacity-15" />
                                                                </div>
                                                            ) : null}
                                                            <button
                                                                className="absolute bottom-1 left-1 bg-brand-primary text-white w-6 h-6 rounded-full flex items-center justify-center shadow-md"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleSuggestionQuickAdd(item);
                                                                }}
                                                            >
                                                                <FaPlus size={10} />
                                                            </button>
                                                        </div>
                                                        <div className="p-2">
                                                            <p className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">{item.name}</p>
                                                            <p className="text-xs text-brand-primary font-bold">{item.price} ₪</p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Inline Addon Picker */}
                        {suggestionAddonPicker && (
                            <div className="mx-3 mb-2 bg-white dark:bg-brand-dark-surface border border-brand-primary/30 rounded-xl shadow-md overflow-hidden">
                                <div className="px-3 py-2 bg-brand-primary/10 flex items-center justify-between">
                                    <span className="font-black text-gray-900 dark:text-brand-dark-text text-xs">{suggestionAddonPicker.name} · <span className="text-brand-primary">₪{suggestionAddonPicker.price}</span></span>
                                    <button onClick={() => { setSuggestionAddonPicker(null); setSuggestionSelectedAddons({}); }} className="text-gray-400 p-0.5">
                                        <FaTimes size={12} />
                                    </button>
                                </div>
                                <div className="px-3 py-2 space-y-2">
                                    {(suggestionAddonPicker.addon_groups || []).filter(g => g.is_required || (g.min_select && g.min_select > 0)).map(group => {
                                        const selected = suggestionSelectedAddons[group.id] || [];
                                        const minReq = group.min_select || 1;
                                        const isValid = selected.length >= minReq;
                                        return (
                                            <div key={group.id}>
                                                <p className={`text-[11px] font-bold mb-1 ${isValid ? 'text-green-600' : 'text-red-500'}`}>
                                                    {group.name} <span className="font-normal">(בחר {minReq})</span>
                                                </p>
                                                <div className="flex flex-wrap gap-1">
                                                    {(group.addons || []).map(addon => {
                                                        const isSel = selected.includes(addon.id);
                                                        return (
                                                            <button
                                                                key={addon.id}
                                                                onClick={() => toggleSuggestionAddon(group, addon.id)}
                                                                className={`px-2 py-0.5 rounded-md text-[11px] font-bold border transition-all ${isSel
                                                                    ? 'bg-brand-primary text-white border-brand-primary'
                                                                    : 'bg-gray-50 dark:bg-brand-dark-border text-gray-600 dark:text-brand-dark-text border-gray-200 dark:border-brand-dark-border'
                                                                    }`}
                                                            >
                                                                {addon.name}{addon.price_delta > 0 && ` +₪${addon.price_delta}`}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="px-3 pb-2">
                                    <button
                                        onClick={handleAddonPickerConfirm}
                                        disabled={(suggestionAddonPicker.addon_groups || []).filter(g => g.is_required || (g.min_select && g.min_select > 0)).some(g => (suggestionSelectedAddons[g.id] || []).length < (g.min_select || 1))}
                                        className="w-full py-1.5 rounded-lg font-black text-xs transition-all disabled:bg-gray-200 disabled:text-gray-400 dark:disabled:bg-brand-dark-border dark:disabled:text-brand-dark-muted bg-brand-primary text-white active:scale-95"
                                    >
                                        הוסף לסל ·  ₪{(() => {
                                            const extrasAddons = (suggestionAddonPicker.addon_groups || []).flatMap(g =>
                                                (suggestionSelectedAddons[g.id] || []).map(id => {
                                                    const addon = (g.addons || []).find(a => a.id === id);
                                                    return {
                                                        price_delta: addon?.price_delta || 0,
                                                        quantity: 1,
                                                        addon_group_id: g.id,
                                                        first_addon_unit_free: Boolean(g.first_addon_unit_free),
                                                    };
                                                }),
                                            );
                                            return (suggestionAddonPicker.price + sumAddonsBilledWithGroupRules(extrasAddons)).toFixed(2);
                                        })()}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Footer */}
                        <div className="p-4 border-t border-gray-100 dark:border-brand-dark-border shrink-0">
                            <button
                                onClick={goToCart}
                                className="w-full bg-gradient-to-r from-brand-primary to-orange-600 text-white font-black py-3.5 rounded-xl shadow-lg hover:shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 text-lg"
                            >
                                <FaArrowLeft size={16} />
                                המשך לסל
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* פופאפ מבצע בכניסה לתפריט */}
            {showPromoPopup && popupPromotions.length > 0 && (() => {
                const allFullImage = popupPromotions.every(p => p.image_display_full && p.image_url);

                if (allFullImage) {
                    // מצב תמונה בלבד — ללא מסגרת, header או footer
                    return (
                        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setShowPromoPopup(false)}>
                            <div className="relative w-full max-w-md" onClick={e => e.stopPropagation()}>
                                {popupPromotions.map((promo) => (
                                    <img
                                        key={promo.id}
                                        src={resolveAssetUrl(promo.image_url)}
                                        alt={promo.name}
                                        className="w-full rounded-2xl shadow-2xl"
                                    />
                                ))}
                                <button
                                    onClick={() => setShowPromoPopup(false)}
                                    className="absolute top-3 right-3 bg-black/50 hover:bg-black/70 text-white w-9 h-9 rounded-full flex items-center justify-center transition-colors shadow-lg"
                                >
                                    <FaTimes size={14} />
                                </button>
                            </div>
                        </div>
                    );
                }

                // מצב רגיל — כרטיסיות עם header ו-footer
                return (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowPromoPopup(false)}>
                        <div className="bg-white dark:bg-brand-dark-card rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in" onClick={e => e.stopPropagation()}>
                            {/* Header */}
                            <div className="bg-gradient-to-l from-amber-500 to-orange-500 p-4 flex items-center justify-between">
                                <div className="flex items-center gap-2 text-white">
                                    <FaTag className="text-xl" />
                                    <h3 className="font-black text-lg">מבצעים פעילים</h3>
                                </div>
                                <button onClick={() => setShowPromoPopup(false)} className="text-white/80 hover:text-white p-1">
                                    <FaTimes size={20} />
                                </button>
                            </div>

                            {/* Promotions list */}
                            <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
                                {popupPromotions.map((promo) => {
                                    const rewardText = promo.rewards?.map(r => {
                                        if (r.reward_type === 'free_item' && r.reward_menu_item_name) return `${r.reward_menu_item_name} במתנה`;
                                        if (r.reward_type === 'free_item' && r.reward_category_name) return `${r.reward_category_name} במתנה`;
                                        if (r.reward_type === 'discount_percent') return `${r.reward_value}% הנחה${r.discount_scope === 'selected_items' ? ' (פריטים נבחרים)' : ''}`;
                                        if (r.reward_type === 'discount_fixed') return `₪${r.reward_value} הנחה${r.discount_scope === 'selected_items' ? ' ליחידה (נבחרים)' : ''}`;
                                        if (r.reward_type === 'fixed_price') return `במחיר מיוחד ₪${r.reward_value}`;
                                        return 'הטבה מיוחדת';
                                    }).join(' + ') || 'הטבה מיוחדת';

                                    return (
                                        <div key={promo.id} className="rounded-2xl border border-orange-100 dark:border-brand-dark-border overflow-hidden">
                                            {promo.image_url && (
                                                <img
                                                    src={resolveAssetUrl(promo.image_url)}
                                                    alt={promo.name}
                                                    className="w-full h-44 object-cover"
                                                />
                                            )}
                                            <div className="p-4">
                                                <h4 className="font-black text-base text-gray-800 dark:text-white">{promo.name}</h4>
                                                <p className="text-sm text-orange-600 dark:text-orange-400 font-bold mt-1">{rewardText}</p>
                                                {promo.description && (
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{promo.description}</p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Footer */}
                            <div className="p-4 border-t border-gray-100 dark:border-brand-dark-border">
                                <button
                                    onClick={() => setShowPromoPopup(false)}
                                    className="w-full bg-gradient-to-r from-brand-primary to-orange-600 text-white font-black py-3 rounded-xl shadow-lg hover:shadow-xl active:scale-95 transition-all text-base"
                                >
                                    לצפייה בתפריט
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* דיאלוג הזמנה חוזרת כשיש פריטים בסל */}
            {reorderDialog && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" dir="rtl">
                    <div className="bg-white dark:bg-brand-dark-surface rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
                        <div className="p-5 space-y-3 text-center">
                            <div className="w-14 h-14 mx-auto bg-brand-primary/10 rounded-full flex items-center justify-center">
                                <FaShoppingBag className="text-brand-primary text-2xl" />
                            </div>
                            <h3 className="text-lg font-black text-gray-900 dark:text-brand-dark-text">יש פריטים בסל</h3>
                            <p className="text-sm text-gray-500 dark:text-brand-dark-muted leading-relaxed">
                                בסל שלך יש כבר {cartItems.length} פריטים.
                                <br />מה תרצה לעשות עם ההזמנה הקודמת?
                            </p>
                        </div>
                        <div className="border-t border-gray-100 dark:border-brand-dark-border p-4 space-y-2">
                            <button
                                onClick={() => {
                                    const items = reorderDialog.items;
                                    setReorderDialog(null);
                                    loadReorderItems(items, true);
                                }}
                                className="w-full py-3 rounded-xl font-bold text-sm bg-brand-primary text-white hover:bg-brand-secondary active:scale-95 transition-all"
                            >
                                נקה סל וטען הזמנה חדשה
                            </button>
                            <button
                                onClick={() => {
                                    const items = reorderDialog.items;
                                    setReorderDialog(null);
                                    loadReorderItems(items, false);
                                }}
                                className="w-full py-3 rounded-xl font-bold text-sm bg-gray-100 dark:bg-brand-dark-border text-gray-700 dark:text-brand-dark-text hover:bg-gray-200 dark:hover:bg-gray-600 active:scale-95 transition-all"
                            >
                                הוסף לסל הקיים
                            </button>
                            <button
                                onClick={() => {
                                    setReorderDialog(null);
                                    localStorage.removeItem('reorder_items');
                                    localStorage.removeItem('reorder_tenant');
                                    localStorage.removeItem('reorder_unavailable');
                                }}
                                className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 transition"
                            >
                                ביטול
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* מודל הזמנה עתידית */}
            <FutureOrderModal
                isOpen={showFutureOrderModal}
                onClose={() => {
                    setShowFutureOrderModal(false);
                    if (pendingReorderItems) {
                        addToast('ההזמנה החוזרת בוטלה', 'info');
                        setPendingReorderItems(null);
                        localStorage.removeItem('reorder_unavailable');
                    }
                }}
                onConfirm={(isoString) => {
                    setScheduledFor(isoString);
                    if (!isRegisteredCustomer) {
                        setCustomerInfo(prev => ({ ...prev, payment_method: 'credit_card' }));
                    }
                    setFutureOrderApproved(true);
                    setShowFutureOrderModal(false);
                    addToast('הזמנה עתידית אושרה — ניתן להוסיף מוצרים', 'success');
                }}
                restaurant={restaurant}
                isRegisteredCustomer={isRegisteredCustomer}
            />

        </CustomerLayout>
    );
}
