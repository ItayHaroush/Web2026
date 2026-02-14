import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FaWhatsapp, FaPhoneAlt, FaMask, FaShoppingBag, FaTruck, FaClock, FaShieldAlt, FaExclamationTriangle, FaInfoCircle, FaCreditCard, FaMoneyBillWave, FaGift, FaTimes, FaPlus, FaArrowLeft } from 'react-icons/fa';
import { SiWaze } from 'react-icons/si';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CustomerLayout } from '../layouts/CustomerLayout';
import menuService from '../services/menuService';
import promotionService from '../services/promotionService';
import { UI_TEXT } from '../constants/ui';
import apiClient from '../services/apiClient';
import { resolveAssetUrl } from '../utils/assets';
import { API_BASE_URL, TENANT_HEADER } from '../constants/api';
import MenuItemModal from '../components/MenuItemModal';
import { getSuggestions } from '../components/SuggestionCards';

/**
 * עמוד תפריט - עיצוב בסגנון Wolt
 * @param {boolean} isPreviewMode - האם זה מצב תצוגה מקדימה (admin)
 */

export default function MenuPage({ isPreviewMode = false }) {
    const { tenantId, loginAsCustomer } = useAuth();
    const navigate = useNavigate();
    const params = useParams();
    const [searchParams] = useSearchParams();
    const { addToCart, setCustomerInfo, getItemCount, cartItems } = useCart();
    const { addToast } = useToast();
    const [menu, setMenu] = useState([]);
    const [restaurant, setRestaurant] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeCategory, setActiveCategory] = useState(null);
    const [activeOrderId, setActiveOrderId] = useState(null);
    const [selectedMenuItem, setSelectedMenuItem] = useState(null);
    const [isPWA, setIsPWA] = useState(false);
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [activePromotions, setActivePromotions] = useState([]);
    const [showSuggestionModal, setShowSuggestionModal] = useState(false);
    const [suggestionMenuItem, setSuggestionMenuItem] = useState(null);
    const categoryRefs = useRef({});

    const effectiveTenantId = useMemo(() => {
        const fromUrl = params?.tenantId;
        if (fromUrl) return fromUrl;
        if (tenantId) return tenantId;
        const fromStorage = localStorage.getItem('tenantId');
        if (fromStorage) return fromStorage;
        const match = window.location.pathname.match(/^\/([^\/]+)\/menu/);
        return match?.[1] || '';
    }, [params?.tenantId, tenantId]);

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
        localStorage.setItem('tenantId', effectiveTenantId);
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

        const savedOrderId = localStorage.getItem(`activeOrder_${effectiveTenantId}`);
        setActiveOrderId(savedOrderId || null);
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
        try {
            const result = await promotionService.getActivePromotions();
            setActivePromotions(result?.data || []);
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

    const isOpenNow = restaurant?.is_open_now ?? restaurant?.is_open;
    // במצב פריוויו - תמיד לאפשר הזמנה (להתעלם מסטטוס פתיחה)
    const canOrder = isPreviewMode ? true : (isOpenNow !== false);

    const handleOpenItemModal = (menuItem) => {
        if (!canOrder) {
            addToast('המסעדה סגורה כרגע', 'error');
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
            setShowSuggestionModal(true);
        } else {
            navigate(`/${effectiveTenantId || tenantId || ''}/cart`);
        }
    };

    const handleSuggestionQuickAdd = (item) => {
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
        addToast(`${item.name} נוסף לסל`, 'success');
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
            {!canOrder && restaurant && (
                <div className="mb-6 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-800 dark:text-red-400 px-4 py-3 rounded-xl">
                    המסעדה סגורה כרגע. אפשר לעיין בתפריט, אך לא ניתן לבצע הזמנה.
                </div>
            )}

            {/* כרטיסייה של הזמנה פעילה */}
            {activeOrderId && (
                <div className="mb-6 p-4 bg-gradient-to-r from-brand-primary to-brand-secondary rounded-2xl shadow-lg text-white cursor-pointer hover:shadow-xl transition-shadow"
                    onClick={() => navigate(isPreviewMode ? `/admin/preview-order-status/${activeOrderId}` : `/${effectiveTenantId || tenantId || ''}/order-status/${activeOrderId}`)}>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-semibold mb-1">📍 הזמנה בעיצומה</p>
                            <p className="text-sm opacity-90">הזמנה #{activeOrderId}</p>
                        </div>
                        <div className="text-2xl">👉</div>
                    </div>
                    <p className="text-xs opacity-75 mt-2">לחץ כדי לראות סטטוס מלא</p>
                </div>
            )}

            {/* באנר דמו */}
            {restaurant?.is_demo && (
                <div className="mb-6 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-400 rounded-2xl shadow-lg">
                    <div className="flex items-start gap-3">
                        <FaMask className="text-3xl text-orange-500" />
                        <div className="flex-1">
                            <h3 className="font-bold text-amber-900 mb-1">מסעדה לדוגמא</h3>
                            <p className="text-sm text-amber-800">
                                זוהי מסעדת דמו לצורכי הדגמה בלבד. ההזמנות כאן אינן אמיתיות.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Hero Section - סגנון Wolt */}
            <div className="relative -mx-4 sm:-mx-6 lg:-mx-8 -mt-8 mb-8">
                {/* רקע עם לוגו גדול */}
                <div className="relative h-48 sm:h-72 bg-gradient-to-br from-brand-dark via-brand-primary to-brand-secondary overflow-hidden">
                    {/* לוגואים מעומעמים ברקע */}
                    {restaurant?.logo_url && (
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

                    {/* תוכן ה-Hero */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center text-white px-4">
                            {restaurant?.logo_url && (
                                <div className="mb-4 flex justify-center">
                                    <div className="bg-white p-3 rounded-2xl shadow-2xl">
                                        <img
                                            src={resolveAssetUrl(restaurant.logo_url)}
                                            alt={restaurant?.name}
                                            className="h-16 w-16 sm:h-20 sm:w-20 object-contain"
                                        />
                                    </div>
                                </div>
                            )}
                            <h1 className="text-3xl sm:text-4xl font-bold mb-2 drop-shadow-lg">
                                {restaurant?.name || 'תפריט המסעדה'}
                            </h1>
                            {(restaurant?.cuisine_type || restaurant?.restaurant_type) && (
                                <span className="inline-block bg-white/20 backdrop-blur-sm px-4 py-1 rounded-full text-sm font-bold">
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
                        <div className="bg-white dark:bg-brand-dark-surface rounded-2xl shadow-xl p-4 sm:p-6">
                            {/* מבנה מובייל - שני שורות */}
                            <div className="lg:hidden space-y-3">
                                {/* שורה ראשונה: כתובת+וויז לצד טלפון+חיוג */}
                                <div className="flex items-center justify-between gap-3">
                                    {/* כתובת + וויז */}
                                    <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 flex-1 min-w-0">
                                        <span className="font-medium truncate">{restaurant.address}</span>
                                        <a
                                            href={wazeLink || undefined}
                                            target="_blank"
                                            rel="noreferrer"
                                            className={`flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full border text-base ${wazeLink ? 'bg-gray-50 dark:bg-brand-dark-border text-brand-primary border-gray-200 dark:border-brand-dark-border hover:bg-gray-100 dark:hover:bg-gray-500' : 'bg-gray-100 text-gray-400 border-transparent cursor-not-allowed pointer-events-none'}`}
                                            aria-label="פתח ב-Waze"
                                        >
                                            <SiWaze className="h-4 w-4" />
                                        </a>
                                    </div>

                                    {/* טלפון + חיוג */}
                                    {restaurant.phone && (
                                        <div className="flex items-center gap-2 text-sm text-brand-primary font-semibold flex-shrink-0">
                                            <span className="text-xs sm:text-sm">{restaurant.phone}</span>
                                            <a
                                                href={phoneHref || undefined}
                                                className={`flex items-center justify-center h-8 w-8 rounded-full border text-base ${phoneHref ? 'bg-gray-50 text-emerald-700 border-gray-200 hover:bg-gray-100' : 'bg-gray-100 text-gray-400 border-transparent cursor-not-allowed pointer-events-none'}`}
                                                aria-label="חייג למסעדה"
                                            >
                                                <FaPhoneAlt className="h-3.5 w-3.5" />
                                            </a>
                                        </div>
                                    )}
                                </div>

                                {/* שורה שנייה: מידע נוסף + סטטוס + משלוחים/איסוף */}
                                <div className="flex items-center gap-2 text-xs flex-wrap">
                                    {/* כפתור מידע נוסף */}
                                    <button
                                        onClick={() => setShowInfoModal(true)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30 rounded-lg text-brand-primary transition-colors font-medium"
                                    >
                                        <FaInfoCircle className="w-3 h-3" />
                                        <span>מידע נוסף</span>
                                    </button>

                                    {/* סטטוס פתיחה */}
                                    <div className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 ${isOpenNow ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${isOpenNow ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                                        {isOpenNow ? 'פתוח עכשיו' : 'סגור'}
                                    </div>

                                    {/* משלוחים/איסוף */}
                                    {restaurant.has_delivery && (
                                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 dark:bg-orange-900/20 text-brand-primary rounded-full text-xs font-bold">
                                            <FaTruck className="w-3 h-3" />
                                            <span>משלוחים</span>
                                        </div>
                                    )}
                                    {restaurant.has_pickup && (
                                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full text-xs font-bold">
                                            <FaShoppingBag className="w-3 h-3" />
                                            <span>איסוף עצמי</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* מבנה דסקטופ - שורה אחת */}
                            <div className="hidden lg:flex items-center justify-between gap-4">
                                {/* פרטים */}
                                <div className="flex items-start gap-4 flex-1">
                                    {restaurant.logo_url && (
                                        <img
                                            src={resolveAssetUrl(restaurant.logo_url)}
                                            alt=""
                                            className="h-12 w-12 object-contain opacity-50"
                                        />
                                    )}
                                    <div className="space-y-2 flex-1">
                                        <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                            <span className="font-medium">{restaurant.address}</span>
                                            <a
                                                href={wazeLink || undefined}
                                                target="_blank"
                                                rel="noreferrer"
                                                className={`flex items-center justify-center h-9 w-9 rounded-full border text-base ${wazeLink ? 'bg-gray-50 dark:bg-brand-dark-border text-brand-primary border-gray-200 dark:border-brand-dark-border hover:bg-gray-100 dark:hover:bg-gray-500' : 'bg-gray-100 text-gray-400 border-transparent cursor-not-allowed pointer-events-none'}`}
                                                aria-label="פתח ב-Waze"
                                            >
                                                <SiWaze className="h-5 w-5" />
                                            </a>
                                        </div>
                                        {restaurant.phone && (
                                            <div className="flex items-center gap-2 text-sm text-brand-primary font-semibold">
                                                <span>{restaurant.phone}</span>
                                                <a
                                                    href={phoneHref || undefined}
                                                    className={`flex items-center justify-center h-9 w-9 rounded-full border text-base ${phoneHref ? 'bg-gray-50 text-emerald-700 border-gray-200 hover:bg-gray-100' : 'bg-gray-100 text-gray-400 border-transparent cursor-not-allowed pointer-events-none'}`}
                                                    aria-label="חייג למסעדה"
                                                >
                                                    <FaPhoneAlt className="h-4 w-4" />
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* סטטוס + אייקונים */}
                                <div className="flex flex-wrap items-center gap-2">
                                    {/* סטטוס פתיחה */}
                                    <div className={`px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 ${isOpenNow ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        <span className={`w-2 h-2 rounded-full ${isOpenNow ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                                        {isOpenNow ? 'פתוח עכשיו' : 'סגור'}
                                    </div>

                                    {/* משלוחים/איסוף */}
                                    {(restaurant.has_delivery || restaurant.has_pickup) && (
                                        <div className="flex items-center gap-2 text-xs text-gray-600 font-bold">
                                            {restaurant.has_delivery && (
                                                <div className="flex items-center gap-1.5 px-3 py-2 bg-orange-50 dark:bg-orange-900/20 text-brand-primary rounded-full">
                                                    <FaTruck className="w-3 h-3" />
                                                    <span>משלוחים</span>
                                                </div>
                                            )}
                                            {restaurant.has_pickup && (
                                                <div className="flex items-center gap-1.5 px-3 py-2 bg-purple-50 text-purple-700 rounded-full">
                                                    <FaShoppingBag className="w-3 h-3" />
                                                    <span>איסוף עצמי</span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* כפתור מידע נוסף */}
                                    <button
                                        onClick={() => setShowInfoModal(true)}
                                        className="flex items-center gap-2 px-4 py-2 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30 text-brand-primary rounded-full text-sm font-bold transition-colors"
                                    >
                                        <FaInfoCircle className="w-3 h-3" />
                                        <span>מידע נוסף</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* באנר מבצעים פעילים */}
            {activePromotions.length > 0 && (
                <div className="mb-6 space-y-2">
                    {activePromotions.map((promo) => {
                        const rewardText = promo.rewards?.map(r => {
                            if (r.reward_type === 'free_item' && r.reward_menu_item_name) return `${r.reward_menu_item_name} במתנה`;
                            if (r.reward_type === 'free_item' && r.reward_category_name) return `${r.reward_category_name} במתנה`;
                            if (r.reward_type === 'discount_percent') return `${r.reward_value}% הנחה`;
                            if (r.reward_type === 'discount_fixed') return `₪${r.reward_value} הנחה`;
                            if (r.reward_type === 'fixed_price') return `במחיר מיוחד ₪${r.reward_value}`;
                            return 'הטבה מיוחדת';
                        }).join(' + ') || 'הטבה מיוחדת';

                        const ruleCategory = promo.rules?.[0];

                        return (
                            <button
                                key={promo.id}
                                onClick={() => {
                                    if (ruleCategory?.required_category_id) {
                                        scrollToCategory(ruleCategory.required_category_id);
                                    }
                                }}
                                className="w-full bg-gradient-to-l from-amber-500 to-orange-500 rounded-2xl p-4 flex items-center gap-3 text-white shadow-lg shadow-orange-500/20 hover:shadow-xl hover:from-amber-400 hover:to-orange-400 transition-all active:scale-[0.98]"
                            >
                                <div className="bg-white/20 backdrop-blur-sm p-2.5 rounded-xl shrink-0">
                                    <FaGift className="text-lg" />
                                </div>
                                <div className="flex-1 text-right min-w-0">
                                    <p className="font-black text-sm sm:text-base truncate">{promo.name}</p>
                                    <p className="text-xs sm:text-sm opacity-90 truncate">{rewardText}</p>
                                </div>
                                <span className="text-white/80 text-lg shrink-0">👈</span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* ניווט קטגוריות - למטה במובייל, למעלה בדסקטופ */}
            {menu.length > 0 && (
                <div className="fixed md:sticky bottom-0 md:top-16 left-0 right-0 z-40 bg-white/95 dark:bg-brand-dark-bg/95 backdrop-blur-md border-t md:border-t-0 md:border-b border-gray-200 dark:border-brand-dark-border shadow-lg pb-safe md:-mx-4 lg:-mx-8 md:mb-6">
                    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
                        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                            {menu.map((category) => (
                                <button
                                    key={category.id}
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
            )}

            {/* תוכן התפריט */}
            <div className="space-y-10 pb-24 md:pb-0">
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
                            <div className="flex items-center gap-4 mb-6">
                                {restaurant?.logo_url && (
                                    <div className="bg-gradient-to-br from-brand-primary/20 to-brand-secondary/20 p-3 rounded-xl">
                                        <img
                                            src={resolveAssetUrl(restaurant.logo_url)}
                                            alt=""
                                            className="h-8 w-8 object-contain"
                                        />
                                    </div>
                                )}
                                <div className="flex-1">
                                    <h2 className="text-2xl sm:text-3xl font-bold text-brand-dark dark:text-brand-dark-text">{category.name}</h2>
                                    {category.description && (
                                        <p className="text-gray-500 dark:text-brand-dark-muted text-sm mt-1">{category.description}</p>
                                    )}
                                </div>
                                <div className="hidden sm:block h-px flex-1 bg-gradient-to-l from-transparent via-gray-200 dark:via-brand-dark-border to-transparent"></div>
                            </div>

                            {/* Grid של מנות - סגנון Wolt */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {category.items.length === 0 ? (
                                    <p className="text-gray-400 italic col-span-full text-center py-8">אין פריטים זמינים</p>
                                ) : (
                                    category.items.map((item) => (
                                        <div
                                            key={item.id}
                                            onClick={() => {
                                                handleOpenItemModal(item);
                                            }}
                                            className={`bg-white dark:bg-brand-dark-surface rounded-2xl shadow-sm transition-all duration-300 overflow-hidden group border border-gray-100 dark:border-brand-dark-border ${canOrder ? 'cursor-pointer hover:shadow-xl hover:border-brand-primary/30' : 'cursor-not-allowed opacity-80'}`}
                                        >
                                            {/* תמונה / לוגו placeholder */}
                                            <div className="relative h-44 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-brand-dark-border/50 dark:to-brand-dark-bg overflow-hidden">
                                                {item.image_url ? (
                                                    <img
                                                        src={resolveAssetUrl(item.image_url)}
                                                        alt={item.name}
                                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                                    />
                                                ) : restaurant?.logo_url ? (
                                                    <div className="absolute inset-0 flex items-center justify-center p-6">
                                                        <img
                                                            src={resolveAssetUrl(restaurant.logo_url)}
                                                            alt=""
                                                            className="w-full h-full object-contain opacity-20"
                                                        />
                                                    </div>
                                                ) : null}

                                                {/* כפתור הוספה מהיר */}
                                                <div className="absolute bottom-3 left-3 right-3">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleOpenItemModal(item);
                                                        }}
                                                        disabled={!canOrder}
                                                        className={`w-full text-white py-2.5 rounded-xl font-bold shadow-lg transform translate-y-2 opacity-0 transition-all duration-300 flex items-center justify-center gap-2 ${canOrder ? 'bg-brand-primary hover:bg-brand-secondary group-hover:translate-y-0 group-hover:opacity-100' : 'bg-gray-400 cursor-not-allowed'}`}
                                                    >
                                                        <span>הוסף</span>
                                                        <span className="bg-white/20 px-2 py-0.5 rounded-lg text-sm">₪{item.price}</span>
                                                    </button>
                                                </div>
                                            </div>

                                            {/* פרטי המנה */}
                                            <div className="p-4">
                                                <div className="flex justify-between items-start gap-2 mb-2">
                                                    <h3 className="font-bold text-brand-dark dark:text-brand-dark-text group-hover:text-brand-primary transition-colors line-clamp-1">
                                                        {item.name}
                                                    </h3>
                                                    <span className="text-brand-primary font-bold whitespace-nowrap">
                                                        ₪{item.price}
                                                    </span>
                                                </div>
                                                {item.description && (
                                                    <p className="text-gray-500 dark:text-brand-dark-muted text-sm line-clamp-2 leading-relaxed">
                                                        {item.description}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            <MenuItemModal
                item={selectedMenuItem}
                isOpen={Boolean(selectedMenuItem)}
                onClose={handleCloseModal}
                onAdd={handleAddFromModal}
                isOrderingEnabled={canOrder}
            />

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

                            {/* אמצעי תשלום */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <FaCreditCard className="text-gray-400 dark:text-gray-500" size={14} />
                                    <h4 className="text-sm font-bold text-gray-900 dark:text-brand-dark-text">אמצעי תשלום</h4>
                                </div>
                                <div className="pl-6 flex flex-wrap gap-2">
                                    <span className="text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 px-2.5 py-1 rounded-md flex items-center gap-1.5">
                                        <FaMoneyBillWave size={10} />
                                        מזומן
                                    </span>
                                    {restaurant.available_payment_methods?.includes('credit_card') && (
                                        <span className="text-xs text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 px-2.5 py-1 rounded-md flex items-center gap-1.5">
                                            <FaCreditCard size={10} />
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

                                    {/* שעות שבועיות */}
                                    {(() => {
                                        const hasAnyValidHours = restaurant.operating_hours &&
                                            (restaurant.operating_hours.days || restaurant.operating_hours.default) &&
                                            ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'].some(day => {
                                                const dayHours = restaurant.operating_hours?.days?.[day] || restaurant.operating_hours?.default;
                                                return dayHours && (dayHours.open || dayHours.close || dayHours.closed);
                                            });

                                        if (!hasAnyValidHours) {
                                            return <p className="text-xs text-gray-400 dark:text-gray-500 italic">לא עודכנו שעות פעילות</p>;
                                        }

                                        return (
                                            <div className="space-y-1.5 text-sm">
                                                {['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'].map((day, index) => {
                                                    const dayHours = restaurant.operating_hours?.days?.[day] || restaurant.operating_hours?.default;
                                                    const isClosed = dayHours?.closed;
                                                    const isToday = new Date().getDay() === index;
                                                    const hasValidHours = dayHours && dayHours.open && dayHours.close;

                                                    return (
                                                        <div key={day} className={`flex justify-between ${isToday ? 'font-bold text-gray-900 dark:text-brand-dark-text' : 'text-gray-500 dark:text-brand-dark-muted'}`}>
                                                            <span>{day}</span>
                                                            <span className={isClosed ? 'text-gray-400 dark:text-gray-500' : ''}>
                                                                {isClosed ? 'סגור' : (hasValidHours ? `${dayHours.open} - ${dayHours.close}` : '-')}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })()}

                                    {/* הערות שעות */}
                                    {restaurant.operating_hours?.special_days && Object.keys(restaurant.operating_hours.special_days).length > 0 && (
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

            {totalCartItems > 0 && (
                <button
                    onClick={handleCartClick}
                    className="fixed bottom-20 md:bottom-6 left-4 md:left-6 z-[60] bg-brand-primary text-white p-4 rounded-full shadow-xl hover:bg-brand-secondary transition-transform active:scale-95"
                    aria-label="מעבר לסל הקניות"
                >

                    <FaShoppingBag className="text-2xl" />
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold h-6 w-6 flex items-center justify-center rounded-full border-2 border-white">
                        {totalCartItems}
                    </span>
                </button>
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
                            {currentSuggestions.map((suggestion) => {
                                const Icon = suggestion.icon;
                                return (
                                    <div key={suggestion.type} className="bg-gradient-to-l from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-4 border border-blue-100 dark:border-blue-800/30">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="bg-blue-100 dark:bg-blue-800/30 p-2 rounded-xl">
                                                <Icon className="text-blue-600 dark:text-blue-400" size={16} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-800 dark:text-gray-200 text-sm">{suggestion.title}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">{suggestion.subtitle}</p>
                                            </div>
                                        </div>

                                        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
                                            {suggestion.items.map((item) => (
                                                <div
                                                    key={item.id}
                                                    className="flex-shrink-0 w-28 bg-white dark:bg-brand-dark-surface rounded-xl border border-gray-100 dark:border-brand-dark-border overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                                                    onClick={() => {
                                                        if (item.use_variants || item.use_addons) {
                                                            setSuggestionMenuItem(item);
                                                        } else {
                                                            handleSuggestionQuickAdd(item);
                                                        }
                                                    }}
                                                >
                                                    <div className="h-20 bg-gray-50 dark:bg-brand-dark-border/50 overflow-hidden relative">
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
                                                                if (item.use_variants || item.use_addons) {
                                                                    setSuggestionMenuItem(item);
                                                                } else {
                                                                    handleSuggestionQuickAdd(item);
                                                                }
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
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

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

            {/* MenuItemModal for suggestion items */}
            {suggestionMenuItem && (
                <MenuItemModal
                    item={suggestionMenuItem}
                    isOpen={true}
                    onClose={() => setSuggestionMenuItem(null)}
                    onAdd={(itemData) => {
                        addToCart(itemData);
                        setSuggestionMenuItem(null);
                        addToast(`${itemData.name || suggestionMenuItem.name} נוסף לסל`, 'success');
                    }}
                    isOrderingEnabled={true}
                />
            )}
        </CustomerLayout>
    );
}
