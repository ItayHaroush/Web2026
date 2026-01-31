import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FaWhatsapp, FaPhoneAlt, FaMask, FaShoppingBag } from 'react-icons/fa';
import { SiWaze } from 'react-icons/si';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CustomerLayout } from '../layouts/CustomerLayout';
import menuService from '../services/menuService';
import { UI_TEXT } from '../constants/ui';
import apiClient from '../services/apiClient';
import { resolveAssetUrl } from '../utils/assets';
import { API_BASE_URL, TENANT_HEADER } from '../constants/api';
import MenuItemModal from '../components/MenuItemModal';

/**
 * עמוד תפריט - עיצוב בסגנון Wolt
 */

export default function MenuPage() {
    const { tenantId, loginAsCustomer } = useAuth();
    const navigate = useNavigate();
    const params = useParams();
    const [searchParams] = useSearchParams();
    const { addToCart, setCustomerInfo, getItemCount } = useCart();
    const { addToast } = useToast();
    const [menu, setMenu] = useState([]);
    const [restaurant, setRestaurant] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeCategory, setActiveCategory] = useState(null);
    const [activeOrderId, setActiveOrderId] = useState(null);
    const [selectedMenuItem, setSelectedMenuItem] = useState(null);
    const [isPWA, setIsPWA] = useState(false);
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
        const checkPWA = window.matchMedia('(display-mode: standalone)').matches;
        setIsPWA(checkPWA);
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

        const savedOrderId = localStorage.getItem(`activeOrder_${effectiveTenantId}`);
        setActiveOrderId(savedOrderId || null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [effectiveTenantId, searchParams, setCustomerInfo]);

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
            console.log('🏪 Restaurant loaded:', currentRestaurant?.name, 'Logo:', currentRestaurant?.logo_url);
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

    const scrollToCategory = (categoryId) => {
        setActiveCategory(categoryId);
        categoryRefs.current[categoryId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const wazeLink = getWazeLink();
    const phoneHref = getPhoneHref();
    const totalCartItems = getItemCount();

    const isOpenNow = restaurant?.is_open_now ?? restaurant?.is_open;
    const canOrder = isOpenNow !== false;

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
                <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl">
                    המסעדה סגורה כרגע. אפשר לעיין בתפריט, אך לא ניתן לבצע הזמנה.
                </div>
            )}

            {/* כרטיסייה של הזמנה פעילה */}
            {activeOrderId && (
                <div className="mb-6 p-4 bg-gradient-to-r from-brand-primary to-brand-secondary rounded-2xl shadow-lg text-white cursor-pointer hover:shadow-xl transition-shadow"
                    onClick={() => navigate(`/${effectiveTenantId || tenantId || ''}/order-status/${activeOrderId}`)}>
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
                            {restaurant?.cuisine_type && (
                                <span className="inline-block bg-white/20 backdrop-blur-sm px-4 py-1 rounded-full text-sm">
                                    {restaurant.cuisine_type}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* כרטיס מידע צף */}
                {restaurant && (
                    <div className="mx-4 sm:mx-6 lg:mx-8 -mt-8 relative z-10">
                        <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-6 flex flex-wrap items-center justify-between gap-4">
                            <div className="flex items-start gap-4 flex-1">
                                {restaurant.logo_url && (
                                    <img
                                        src={resolveAssetUrl(restaurant.logo_url)}
                                        alt=""
                                        className="h-12 w-12 object-contain opacity-50 hidden sm:block"
                                    />
                                )}
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-sm text-gray-700">
                                        <span className="font-medium">{restaurant.address}</span>
                                        <a
                                            href={wazeLink || undefined}
                                            target="_blank"
                                            rel="noreferrer"
                                            className={`flex items-center justify-center h-9 w-9 rounded-full border text-base ${wazeLink ? 'bg-gray-50 text-blue-700 border-gray-200 hover:bg-gray-100' : 'bg-gray-100 text-gray-400 border-transparent cursor-not-allowed pointer-events-none'}`}
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
                            <div className={`px-4 py-2 rounded-full text-sm font-bold ${isOpenNow ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {isOpenNow ? '🟢 פתוח עכשיו' : '🔴 סגור'}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ניווט קטגוריות - למטה במובייל, למעלה בדסקטופ */}
            {menu.length > 0 && (
                <div className="fixed md:sticky bottom-0 md:top-16 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t md:border-t-0 md:border-b border-gray-200 shadow-lg pb-safe md:-mx-4 lg:-mx-8 md:mb-6">
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
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
                    <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
                        {restaurant?.logo_url && (
                            <img src={resolveAssetUrl(restaurant.logo_url)} alt="" className="h-20 w-20 mx-auto mb-4 opacity-30" />
                        )}
                        <p className="text-gray-500 text-lg">עדיין אין פריטים בתפריט</p>
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
                                    <h2 className="text-2xl sm:text-3xl font-bold text-brand-dark">{category.name}</h2>
                                    {category.description && (
                                        <p className="text-gray-500 text-sm mt-1">{category.description}</p>
                                    )}
                                </div>
                                <div className="hidden sm:block h-px flex-1 bg-gradient-to-l from-transparent via-gray-200 to-transparent"></div>
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
                                            className={`bg-white rounded-2xl shadow-sm transition-all duration-300 overflow-hidden group border border-gray-100 ${canOrder ? 'cursor-pointer hover:shadow-xl hover:border-brand-primary/30' : 'cursor-not-allowed opacity-80'}`}
                                        >
                                            {/* תמונה / לוגו placeholder */}
                                            <div className="relative h-44 bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden">
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
                                                    <h3 className="font-bold text-brand-dark group-hover:text-brand-primary transition-colors line-clamp-1">
                                                        {item.name}
                                                    </h3>
                                                    <span className="text-brand-primary font-bold whitespace-nowrap">
                                                        ₪{item.price}
                                                    </span>
                                                </div>
                                                {item.description && (
                                                    <p className="text-gray-500 text-sm line-clamp-2 leading-relaxed">
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

            {totalCartItems > 0 && (
                <button
                    onClick={() => navigate(`/${effectiveTenantId || tenantId || ''}/cart`)}
                    className="fixed bottom-20 md:bottom-6 left-4 md:left-6 z-50 bg-brand-primary text-white p-4 rounded-full shadow-xl hover:bg-brand-secondary transition-transform active:scale-95"
                    aria-label="מעבר לסל הקניות"
                >
                    <FaShoppingBag className="text-2xl" />
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold h-6 w-6 flex items-center justify-center rounded-full border-2 border-white">
                        {totalCartItems}
                    </span>
                </button>
            )}
        </CustomerLayout>
    );
}
