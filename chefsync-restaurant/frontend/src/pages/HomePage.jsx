import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { CustomerLayout } from '../layouts/CustomerLayout';
import { Link, useNavigate } from 'react-router-dom';
import { getAllRestaurants, getCities } from '../services/restaurantService';
import LocationPickerModal from '../components/LocationPickerModal';
import apiClient from '../services/apiClient';
import logo from '../images/ChefSyncLogoIcon.png';
import { resolveAssetUrl } from '../utils/assets';
import announcementService from '../services/announcementService';
import { PRODUCT_BYLINE_HE, PRODUCT_NAME } from '../constants/brand';
import { HomeSeo } from '../components/seo/RestaurantSeo';
import {
    FaRocket,
    FaUserShield,
    FaMobileAlt,
    FaMask,
    FaMapMarkerAlt,
    FaUtensils,
    FaArrowLeft,
    FaStore,
    FaClock,
    FaCircle,
    FaTruck,
    FaShoppingBag,
    FaCalendarAlt,
    FaSearch,
    FaUserPlus,
    FaBell,
    FaTimes
} from 'react-icons/fa';
import { HiGlobeAlt, HiLocationMarker } from 'react-icons/hi';

/**
 * עמוד בית - בחירת מסעדה מרשימה
 */

export default function HomePage() {
    const { loginAsCustomer, tenantId } = useAuth();
    const [restaurants, setRestaurants] = useState([]);
    const [cities, setCities] = useState([]);
    const [selectedCity, setSelectedCity] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [userLocation, setUserLocation] = useState(null);
    const [currentCityName, setCurrentCityName] = useState('');
    const [closestRestaurantId, setClosestRestaurantId] = useState(null);
    const [autoSelectedCity, setAutoSelectedCity] = useState(false);
    const [showLocationModal, setShowLocationModal] = useState(false);
    const [deliveryLocation, setDeliveryLocation] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const searchRef = useRef(null);
    const debounceRef = useRef(null);
    const [announcements, setAnnouncements] = useState([]);
    const [dismissedPopup, setDismissedPopup] = useState(false);
    const [dismissedHeroOverlay, setDismissedHeroOverlay] = useState(false);
    const [dismissedBanners, setDismissedBanners] = useState([]);
    const navigate = useNavigate();

    // Feature Carousel Logic
    const [activeFeature, setActiveFeature] = useState(0);

    // חיפוש מנות
    const doMenuSearch = useCallback(async (q) => {
        if (q.trim().length < 2) { setSearchResults([]); return; }
        setSearchLoading(true);
        try {
            const params = { q: q.trim() };
            if (selectedCity) params.city = selectedCity;
            const res = await apiClient.get('/menu-search', { params });
            setSearchResults(res.data?.data || []);
        } catch { setSearchResults([]); } finally { setSearchLoading(false); }
    }, [selectedCity]);

    const handleSearchInput = (e) => {
        const val = e.target.value;
        setSearchQuery(val);
        setSearchOpen(true);
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => doMenuSearch(val), 350);
    };

    const handleSearchItemClick = (item) => {
        if (item.restaurant_tenant_id) {
            loginAsCustomer(item.restaurant_tenant_id);
            setTimeout(() => navigate(`/${item.restaurant_tenant_id}/menu`), 100);
        }
        setSearchOpen(false);
        setSearchQuery('');
    };

    // סגור דרופדאון בלחיצה מחוץ
    useEffect(() => {
        const handler = (e) => {
            if (searchRef.current && !searchRef.current.contains(e.target)) setSearchOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);
    const features = [
        {
            icon: FaRocket,
            title: 'מהיר ופשוט',
            description: 'בוחרים מסעדה, מזמינים ומשלמים — אפשר כאורח בלי טופס ארוך, או עם חשבון לחוויה מהירה יותר בפעם הבאה.',
            colors: 'from-orange-400 to-red-500'
        },
        {
            icon: FaUserPlus,
            title: 'חשבון אישי — לגמרי אופציונלי',
            description: 'נרשמים פעם אחת (טלפון וסיסמה), שומרים כתובת ומועדפים, רואים הזמנות קודמות וממשיכים מהר מהשורה.',
            colors: 'from-violet-500 to-purple-600'
        },
        {
            icon: FaBell,
            title: 'התראות על ההזמנה',
            description: 'אם תבקשו — נעדכן אתכם כשההזמנה מאושרת, בהכנה, בדרך או מוכנה לאיסוף — בלי להיתקע בטלפון.',
            colors: 'from-sky-400 to-blue-600'
        },
        {
            icon: FaUserShield,
            title: 'פרטיות ובקרה',
            description: 'רק מה שחייבים לטובת האספקה והתשלום — וברירת מחדל מינימליסטית. אפשר תמיד לפתוח פרופיל ולנהל פרטים.',
            colors: 'from-amber-400 to-orange-500'
        },
        {
            icon: FaMobileAlt,
            title: 'אפליקציה מהדפדפן',
            description: 'מסך שמתאים לנייד ולמחשב. אפשר להתקין לימין המסך (PWA) ולחזור למסעדות שאהבתם בקליק.',
            colors: 'from-emerald-400 to-teal-500'
        }
    ];

    useEffect(() => {
        const interval = setInterval(() => {
            setActiveFeature(prev => (prev + 1) % features.length);
        }, 4000);
        return () => clearInterval(interval);
    }, []);

    // טען הודעות כלליות
    useEffect(() => {
        announcementService.getActiveAnnouncements()
            .then(res => {
                if (res.success && Array.isArray(res.data)) {
                    setAnnouncements(res.data);
                }
            })
            .catch(err => console.warn('Failed to load announcements', err));
    }, []);

    // טען מיקום שמור למשלוח
    useEffect(() => {
        try {
            const saved = localStorage.getItem('user_delivery_location');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.lat && parsed.lng) {
                    setDeliveryLocation(parsed);
                }
            }
        } catch (e) {
            console.warn('Failed to load delivery location', e);
        }
    }, []);

    // טען מיקום נוכחי
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;

                    setUserLocation({ lat, lng });
                    localStorage.setItem('user_location', JSON.stringify({ lat, lng }));

                    // קבל שם עיר אמיתי מקואורדינטות (Reverse Geocoding)
                    try {
                        const response = await fetch(
                            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=he`
                        );
                        const data = await response.json();
                        const city = data.address?.city || data.address?.town || data.address?.village || '';
                        if (city) {
                            setCurrentCityName(city);
                        }
                    } catch (error) {
                        if (import.meta.env.DEV) {
                            console.log('Could not get city name from coordinates:', error);
                        }
                    }
                },
                (error) => {
                    if (import.meta.env.DEV) {
                        console.log('Location access denied or unavailable:', error);
                    }
                }
            );
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [selectedCity, userLocation]);

    // חישוב מרחק בין שתי נקודות (בק"מ)
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371; // רדיוס כדור הארץ בק"מ
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);

            // טען מסעדות
            const result = await getAllRestaurants(selectedCity || null);
            if (import.meta.env.DEV) {
                console.log('Restaurants loaded:', result);
            }

            let restaurantsList = result.data || [];

            // אם יש מיקום משתמש, חשב מרחק ומיין
            if (userLocation && restaurantsList.length > 0) {
                restaurantsList = restaurantsList.map(restaurant => ({
                    ...restaurant,
                    distance: restaurant.latitude && restaurant.longitude
                        ? calculateDistance(
                            userLocation.lat,
                            userLocation.lng,
                            restaurant.latitude,
                            restaurant.longitude
                        )
                        : null
                })).sort((a, b) => {
                    if (a.distance === null) return 1;
                    if (b.distance === null) return -1;
                    return a.distance - b.distance;
                });

                // בחירה אוטומטית של העיר הקרובה ביותר (רק בפעם הראשונה)
                if (!autoSelectedCity && !selectedCity && restaurantsList.length > 0 && restaurantsList[0].distance !== null) {
                    const closestRestaurant = restaurantsList[0];
                    setSelectedCity(closestRestaurant.city);
                    setAutoSelectedCity(true);
                }
            }

            setRestaurants(restaurantsList);

            // טען רשימת ערים
            if (cities.length === 0) {
                const citiesList = await getCities();
                if (import.meta.env.DEV) {
                    console.log('Cities loaded:', citiesList);
                }
                setCities(citiesList);
            }
        } catch (err) {
            console.error('Error loading data:', err);
            setError('שגיאה בטעינת המסעדות: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRestaurantClick = (restaurant) => {
        loginAsCustomer(restaurant.tenant_id);
        // חכה רגע קצר כדי לוודא שה-localStorage התעדכן
        setTimeout(() => {
            navigate(`/${restaurant.tenant_id}/menu`);
        }, 100);
    };

    const handleAdminLogin = () => {
        navigate('/admin/login');
    };

    if (loading) {
        return (
            <CustomerLayout>
                <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto mb-4"></div>
                        <p className="text-gray-600 dark:text-brand-dark-muted">טוען מסעדות...</p>
                    </div>
                </div>
            </CustomerLayout>
        );
    }

    if (error) {
        return (
            <CustomerLayout>
                <div className="text-center py-12">
                    <p className="text-red-600 mb-4">{error}</p>
                    <button onClick={loadData} className="bg-brand-primary text-white px-6 py-2 rounded-lg">
                        נסה שוב
                    </button>
                </div>
            </CustomerLayout>
        );
    }

    const heroOverlay = !dismissedHeroOverlay ? announcements.find(a => a.position === 'hero_overlay') : null;
    const bannerAnnouncements = announcements.filter(a => a.position === 'top_banner' || a.position === 'banner');
    const popupAnnouncement = !dismissedPopup ? announcements.find(a => a.position === 'popup') : null;

    return (
        <CustomerLayout>
            <HomeSeo />
            {/* פופאפ הודעה כללית */}
            {popupAnnouncement && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setDismissedPopup(true)}>
                    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden relative" onClick={e => e.stopPropagation()}>
                        <button
                            onClick={() => setDismissedPopup(true)}
                            className="absolute top-3 left-3 z-10 w-8 h-8 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center transition-colors text-lg leading-none cursor-pointer"
                        >
                            ×
                        </button>
                        {popupAnnouncement.image_url && (
                            <div className="bg-gray-100">
                                <img src={popupAnnouncement.image_url} alt={popupAnnouncement.title} className="w-full h-auto max-h-[60vh] object-contain" />
                            </div>
                        )}
                        <div className="p-6">
                            <h3 className="font-black text-xl text-gray-900 mb-2">{popupAnnouncement.title}</h3>
                            {popupAnnouncement.body && <p className="text-gray-500 text-sm leading-relaxed mb-5">{popupAnnouncement.body}</p>}
                            <button onClick={() => setDismissedPopup(true)} className="w-full bg-brand-primary text-white font-bold py-3 rounded-xl hover:opacity-90 transition-opacity cursor-pointer">הבנתי</button>
                        </div>
                    </div>
                </div>
            )}

            <LocationPickerModal
                open={showLocationModal}
                onClose={() => setShowLocationModal(false)}
                onLocationSelected={(location) => {
                    setDeliveryLocation(location);
                    setShowLocationModal(false);
                }}
            />

            {/* הודעת שכבה עליונה — מעל הכל */}
            {heroOverlay && (
                <div className="relative -mx-6 lg:-mx-8 z-40 -mt-[calc(env(safe-area-inset-top,0px)+3.75rem)] sm:-mt-[calc(env(safe-area-inset-top,0px)+5.75rem)] -mb-px bg-gradient-to-r from-brand-primary to-brand-secondary text-white px-4 py-3 pt-[calc(env(safe-area-inset-top,0px)+4rem)] sm:pt-[calc(env(safe-area-inset-top,0px)+6rem)] flex items-center gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                        <FaBell className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm">{heroOverlay.title}</p>
                        {heroOverlay.body && <p className="text-white/90 text-xs leading-snug mt-0.5">{heroOverlay.body}</p>}
                    </div>
                    {heroOverlay.link_url && (
                        <a href={heroOverlay.link_url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 text-white text-xs font-bold hover:underline">פרטים &larr;</a>
                    )}
                    <button onClick={() => setDismissedHeroOverlay(true)} className="flex-shrink-0 w-7 h-7 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors cursor-pointer" aria-label="סגור">
                        <FaTimes className="w-3 h-3 text-white" />
                    </button>
                </div>
            )}

            {/* Hero — צמוד לנב; בדסקטופ נמשך מאחורי הנאבבר */}
            <div className="relative -mx-4 sm:-mx-6 lg:-mx-8 mt-0 sm:-mt-[5.75rem] mb-6">
                <div className="relative min-h-[16rem] h-auto sm:h-[calc(460px+5.75rem)] sm:min-h-0 bg-gradient-to-br from-brand-dark via-brand-primary to-brand-secondary overflow-hidden rounded-b-2xl sm:rounded-none">
                    {/* אפקט עומק וגרדיאנט מודרני (Mesh Gradient Style) */}
                    <div className="absolute inset-0 opacity-30">
                        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[80%] bg-white/20 rounded-full blur-[120px] animate-pulse"></div>
                        <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[70%] bg-brand-accent/20 rounded-full blur-[100px]"></div>
                        {/* תבנית נקודות עדינה לרקע */}
                        <div className="absolute inset-0 opacity-[0.1]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>
                    </div>

                    {/* שורה עליונה: אדמין (ימין ב-RTL) + מיקום קומפקטי (שמאל ב-RTL) — בלי flex-1 על המיקום */}
                    <div className="relative z-30 flex w-full flex-nowrap items-center justify-between gap-2 px-4 pb-1 pt-1 sm:absolute sm:inset-x-0 sm:top-0 sm:gap-3 sm:p-6 sm:pb-0 sm:pt-[calc(5.75rem+1.5rem)]">
                        <button
                            type="button"
                            onClick={handleAdminLogin}
                            aria-label="כניסת מנהלים"
                            className="shrink-0 bg-white/95 backdrop-blur-md text-brand-dark p-2 sm:px-4 sm:py-2.5 rounded-xl shadow-lg border border-white/80 hover:shadow-xl transition-all flex items-center gap-1.5 text-sm font-semibold cursor-pointer"
                        >
                            <FaUserShield className="text-brand-primary shrink-0 text-base sm:text-base" />
                            <span className="hidden sm:inline">כניסת מנהלים</span>
                        </button>

                        {currentCityName && (
                            <button
                                type="button"
                                onClick={() => setShowLocationModal(true)}
                                className="shrink min-w-0 max-w-[11rem] sm:max-w-[13rem] inline-flex items-center gap-1 sm:gap-1.5 backdrop-blur-md bg-white/90 text-brand-dark px-2 py-1.5 sm:px-3 sm:py-2 rounded-full text-xs sm:text-sm hover:bg-white shadow-md font-semibold transition-all cursor-pointer group"
                            >
                                <HiLocationMarker className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-brand-primary group-hover:animate-bounce shrink-0" />
                                <span className="truncate min-w-0 text-right">
                                    {deliveryLocation?.fullAddress ||
                                        (deliveryLocation?.street && deliveryLocation?.cityName
                                            ? `${deliveryLocation.street}, ${deliveryLocation.cityName}`
                                            : deliveryLocation?.cityName || currentCityName)}
                                </span>
                            </button>
                        )}
                    </div>

                    {/* תוכן מרכזי — מובייל: זרימה יחסית; sm+: ממורכז אבסולוט */}
                    <div className="relative z-10 flex flex-col items-center justify-center px-4 pb-6 pt-2 sm:absolute sm:inset-0 sm:pb-0 sm:pt-0 sm:flex sm:items-center sm:justify-center">
                        <div className="text-center w-full max-w-4xl flex flex-col items-center sm:px-6">

                            {/* אפקט הילה מרכזי מודגש */}
                            <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 sm:w-80 sm:h-80 bg-brand-primary/20 blur-[120px] -z-10 rounded-full animate-pulse"></div>

                            {/* לוגו */}
                            <div className="relative group mb-3 sm:mb-12">
                                <div className="absolute inset-0 bg-white/5 blur-2xl rounded-full scale-110 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <div className="relative w-28 sm:w-64 lg:w-72 mx-auto pointer-events-none select-none transition-all duration-700 group-hover:scale-105">
                                    <img
                                        src={logo}
                                        alt={PRODUCT_NAME}
                                        className="w-full h-auto object-contain filter brightness-0 invert drop-shadow-[0_0_20px_rgba(255,255,255,0.25)]"
                                    />
                                </div>
                            </div>

                            {/* קרוסלת לוגואים */}
                            {restaurants.filter(r => r.logo_url).length > 0 && (
                                <div className="w-full max-w-5xl overflow-hidden relative group/ticker pb-1 sm:pb-2">
                                    <p className="text-[9px] sm:text-xs font-black text-white uppercase tracking-[0.25em] sm:tracking-[0.4em] mb-2 sm:mb-4 drop-shadow-sm opacity-80">
                                        הנבחרת של TakeEat
                                    </p>
                                    <div className="animate-ticker flex gap-6 sm:gap-16 items-center py-1 sm:py-2">
                                        {[...restaurants.filter(r => r.logo_url), ...restaurants.filter(r => r.logo_url), ...restaurants.filter(r => r.logo_url)].map((r, i) => (
                                            <div
                                                key={`${r.id}-${i}`}
                                                className="flex-shrink-0 transition-all duration-300 hover:scale-110 cursor-pointer group/logo bg-white/95 backdrop-blur-sm p-1 sm:p-2.5 rounded-xl sm:rounded-2xl shadow-lg border border-white/20"
                                                onClick={() => handleRestaurantClick(r)}
                                            >
                                                <img
                                                    src={resolveAssetUrl(r.logo_url)}
                                                    alt={r.name}
                                                    className="h-7 sm:h-12 w-auto object-contain opacity-100 transition-transform"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* חיפוש/סינון צף */}
                <div className="mx-3 sm:mx-6 lg:mx-8 -mt-6 sm:-mt-8 relative z-10" ref={searchRef}>
                    <div className="bg-white dark:bg-brand-dark-surface rounded-xl sm:rounded-2xl shadow-xl p-3 sm:p-4">
                        <div className="flex gap-2 items-center">
                            {/* בחירת עיר */}
                            <div className="relative shrink-0 w-[120px] sm:w-[150px]">
                                <div className="absolute inset-y-0 right-2.5 flex items-center pointer-events-none text-gray-400 dark:text-gray-500">
                                    <HiGlobeAlt className="w-4 h-4" />
                                </div>
                                <select
                                    value={selectedCity}
                                    onChange={(e) => setSelectedCity(e.target.value)}
                                    className="w-full pr-8 pl-2 py-2.5 sm:py-3 bg-gray-50 dark:bg-brand-dark-border/50 border border-gray-200 dark:border-brand-dark-border rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary text-gray-700 dark:text-gray-300 font-semibold text-xs sm:text-sm transition-all appearance-none cursor-pointer"
                                >
                                    <option value="">כל הערים</option>
                                    {cities.filter(Boolean).map((city, index) => (
                                        <option key={`${city}-${index}`} value={city}>
                                            {city}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* שדה חיפוש */}
                            <div className="relative flex-1">
                                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400 dark:text-gray-500 z-10">
                                    <FaSearch className="w-3.5 h-3.5" />
                                </div>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={handleSearchInput}
                                    onFocus={() => searchQuery.trim().length >= 2 && setSearchOpen(true)}
                                    placeholder="מה בא לך לאכול?"
                                    className="w-full pr-9 pl-4 py-2.5 sm:py-3 bg-gray-50 dark:bg-brand-dark-border/50 border border-gray-200 dark:border-brand-dark-border rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary text-gray-700 dark:text-gray-300 font-semibold text-sm sm:text-base transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500"
                                />
                            </div>

                            {/* כמות מסעדות */}
                            <div className="text-center shrink-0 px-2">
                                <p className="text-lg sm:text-xl font-black text-brand-primary leading-tight">{restaurants.length}</p>
                                <p className="text-[9px] sm:text-[10px] uppercase tracking-wider font-bold text-gray-400 dark:text-gray-500">מסעדות</p>
                            </div>
                        </div>

                        {/* דרופדאון תוצאות חיפוש */}
                        {searchOpen && searchQuery.trim().length >= 2 && (
                            <div className="mt-2 bg-white dark:bg-brand-dark-surface rounded-xl shadow-2xl border border-gray-100 dark:border-brand-dark-border max-h-[50vh] overflow-y-auto">
                                {searchLoading && (
                                    <div className="flex items-center justify-center py-8">
                                        <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-brand-primary" />
                                    </div>
                                )}
                                {!searchLoading && searchResults.length === 0 && (
                                    <div className="text-center py-8 px-4">
                                        <FaUtensils className="text-2xl text-gray-300 mx-auto mb-2" />
                                        <p className="text-gray-500 font-semibold text-sm">לא נמצאו מנות</p>
                                    </div>
                                )}
                                {!searchLoading && searchResults.length > 0 && (() => {
                                    const openItems = searchResults.filter(i => i.is_open_now);
                                    const closedItems = searchResults.filter(i => !i.is_open_now);
                                    const showClosed = openItems.length === 0;
                                    const displayItems = openItems.length > 0 ? openItems : closedItems;
                                    return (
                                        <div className="divide-y divide-gray-50 dark:divide-brand-dark-border">
                                            {showClosed && closedItems.length > 0 && (
                                                <div className="px-4 py-2 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-1.5">
                                                    <FaClock className="w-3 h-3" />
                                                    המסעדות סגורות כרגע — מציג תוצאות להשראה
                                                </div>
                                            )}
                                            {displayItems.map((item) => (
                                                <div
                                                    key={`${item.restaurant_tenant_id}-${item.id}`}
                                                    onClick={() => handleSearchItemClick(item)}
                                                    className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${!item.is_open_now ? 'opacity-70 hover:bg-rose-50/50 dark:hover:bg-rose-900/10' : 'hover:bg-gray-50 dark:hover:bg-brand-dark-border/50'}`}
                                                >
                                                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 dark:bg-brand-dark-border flex-shrink-0 flex items-center justify-center relative">
                                                        {item.image_url ? (
                                                            <img src={resolveAssetUrl(item.image_url)} alt={item.name} className="w-full h-full object-cover" />
                                                        ) : item.restaurant_logo ? (
                                                            <img src={resolveAssetUrl(item.restaurant_logo)} alt="" className="w-7 h-7 object-contain opacity-40" />
                                                        ) : (
                                                            <FaUtensils className="text-gray-300" />
                                                        )}
                                                        {!item.is_open_now && (
                                                            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                                                <FaClock className="text-white w-4 h-4" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold text-gray-800 dark:text-gray-200 text-sm truncate">{item.name}</p>
                                                        {item.description && <p className="text-xs text-gray-400 truncate">{item.description}</p>}
                                                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 mt-0.5 min-w-0">
                                                            <span className="text-[11px] text-brand-primary font-semibold truncate max-w-full">{item.restaurant_name}</span>
                                                            {item.is_demo && (
                                                                <span className="text-[9px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded inline-flex items-center gap-0.5 shrink-0">
                                                                    <FaMask className="w-2 h-2 shrink-0" />
                                                                    להמחשה
                                                                </span>
                                                            )}
                                                            {!item.is_open_now && (
                                                                <span className="text-[9px] font-bold bg-rose-100 dark:bg-rose-900/30 text-rose-500 dark:text-rose-400 px-1.5 py-0.5 rounded">
                                                                    סגור
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 flex-shrink-0">
                                                        <span className="text-sm font-black text-gray-700 dark:text-gray-300">₪{item.price}</span>
                                                        <FaArrowLeft className="w-3 h-3 text-gray-300" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* באנרים עליונים */}
            {bannerAnnouncements.filter(a => !dismissedBanners.includes(a.id)).map(ann => (
                <div key={ann.id} className="relative -mx-6 sm:-mx-6 lg:-mx-8 mb-2 bg-gradient-to-r from-brand-dark to-brand-primary/90 text-white px-4 py-3 flex items-center gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-white/15 rounded-xl flex items-center justify-center">
                        <FaBell className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm">{ann.title}</p>
                        {ann.body && <p className="text-white/85 text-xs leading-snug mt-0.5">{ann.body}</p>}
                    </div>
                    {ann.link_url && (
                        <a href={ann.link_url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 text-white text-xs font-bold hover:underline">קרא עוד &larr;</a>
                    )}
                    <button onClick={() => setDismissedBanners(prev => [...prev, ann.id])} className="flex-shrink-0 w-7 h-7 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors cursor-pointer" aria-label="סגור">
                        <FaTimes className="w-3 h-3 text-white" />
                    </button>
                </div>
            ))}

            <div className="space-y-6 sm:space-y-10">
                {/* כותרת רשימת מסעדות */}
                <div className="flex items-center justify-between gap-2">
                    <h2 className="text-lg sm:text-3xl font-black text-brand-dark dark:text-brand-dark-text tracking-tight">
                        {selectedCity ? `מסעדות ב${selectedCity}` : 'כל המסעדות'}
                    </h2>
                    {userLocation && (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-brand-dark-border px-3 py-1.5 rounded-full uppercase tracking-wider">
                            <FaStore className="w-3 h-3" />
                            <span>לפי מרחק</span>
                        </div>
                    )}
                </div>

                {/* רשימת מסעדות - Grid בסגנון Wolt */}
                {restaurants.length === 0 ? (
                    <div className="text-center py-20 bg-white dark:bg-brand-dark-surface rounded-3xl shadow-sm border border-gray-50 dark:border-brand-dark-border">
                        <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-50 dark:bg-brand-dark-border/50 rounded-full mb-6">
                            <FaUtensils className="text-4xl text-gray-300" />
                        </div>
                        <p className="text-gray-900 dark:text-brand-dark-text text-xl font-bold mb-2">לא נמצאו מסעדות</p>
                        <p className="text-gray-400 dark:text-brand-dark-muted text-sm font-medium">נסה לבחור עיר אחרת או להרחיב את החיפוש</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
                        {restaurants.map((restaurant, index) => (
                            <div
                                key={restaurant.id ?? restaurant.tenant_id ?? `restaurant-${index}`}
                                onClick={() => handleRestaurantClick(restaurant)}
                                className="bg-white dark:bg-brand-dark-surface rounded-xl sm:rounded-2xl shadow-sm hover:shadow-2xl transition-all duration-300 cursor-pointer group overflow-hidden border border-gray-100 dark:border-brand-dark-border hover:border-brand-primary/30"
                                style={{ animationDelay: `${index * 50}ms` }}
                            >
                                {/* תמונה/לוגו — קומפקטי במובייל כמו MenuPage */}
                                <div className="relative h-32 sm:h-44 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-brand-dark-border/50 dark:to-brand-dark-bg overflow-hidden">
                                    {restaurant.logo_url ? (
                                        <>
                                            <div
                                                className="absolute inset-0 opacity-20"
                                                style={{
                                                    backgroundImage: `url(${resolveAssetUrl(restaurant.logo_url)})`,
                                                    backgroundSize: 'cover',
                                                    backgroundPosition: 'center',
                                                    filter: 'blur(20px)'
                                                }}
                                            />
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <img
                                                    src={resolveAssetUrl(restaurant.logo_url)}
                                                    alt={restaurant.name}
                                                    className="w-20 h-20 sm:w-28 sm:h-28 object-contain group-hover:scale-110 transition-transform duration-500"
                                                />
                                            </div>
                                        </>
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="w-16 h-16 sm:w-24 sm:h-24 bg-brand-primary/10 rounded-2xl sm:rounded-3xl flex items-center justify-center">
                                                <FaUtensils className="text-2xl sm:text-4xl text-brand-primary/30" />
                                            </div>
                                        </div>
                                    )}

                                    {restaurant.distance !== null && Number.isFinite(restaurant.distance) && (
                                        <div className="absolute top-3 left-3 sm:top-4 sm:left-4 bg-white/90 backdrop-blur-md text-brand-primary px-2 py-1 sm:px-3 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-black shadow-lg border border-white/50 flex items-center gap-0.5 sm:gap-1">
                                            <FaMapMarkerAlt className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                            {restaurant.distance.toFixed(1)} ק"מ
                                        </div>
                                    )}

                                    {restaurant.is_demo && (
                                        <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 max-w-[calc(50%-1.25rem)] bg-gradient-to-r from-amber-500 to-orange-600 text-white px-2 py-1 sm:px-3 sm:py-1.5 rounded-full text-[8px] sm:text-[10px] font-black shadow-xl border border-white/20 uppercase tracking-wide sm:tracking-widest flex items-center gap-1">
                                            <FaMask className="text-[10px] sm:text-xs shrink-0" />
                                            <span className="truncate leading-tight">מסעדה לדוגמא</span>
                                        </div>
                                    )}

                                    <div className={`absolute top-3 right-3 sm:top-4 sm:right-4 max-w-[calc(50%-1.25rem)] px-2 py-1 sm:px-3 sm:py-1.5 rounded-full text-[8px] sm:text-[10px] font-black shadow-lg flex items-center gap-1 sm:gap-1.5 border border-white/20 uppercase tracking-wide sm:tracking-wider ${(restaurant.is_open_now ?? restaurant.is_open) ? 'bg-emerald-500/90 backdrop-blur-md text-white' : 'bg-rose-500/90 backdrop-blur-md text-white'}`}>
                                        <FaCircle className={`w-1 h-1 sm:w-1.5 sm:h-1.5 shrink-0 ${(restaurant.is_open_now ?? restaurant.is_open) ? 'animate-pulse' : ''}`} />
                                        <span className="truncate leading-tight">{(restaurant.is_open_now ?? restaurant.is_open) ? 'פתוח עכשיו' : 'סגור כרגע'}</span>
                                    </div>

                                    <div className={`absolute bottom-3 right-3 sm:bottom-4 sm:right-4 max-w-[calc(50%-1.25rem)] px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[8px] sm:text-[10px] font-bold shadow-md flex items-center gap-0.5 sm:gap-1 border border-white/20 ${restaurant.allow_future_orders ? 'bg-cyan-600/95 backdrop-blur-md text-white' : 'bg-gray-500/80 backdrop-blur-md text-white/90'}`}>
                                        <FaCalendarAlt className="w-2 h-2 sm:w-2.5 sm:h-2.5 shrink-0" />
                                        <span className="truncate leading-tight">{restaurant.allow_future_orders ? 'הזמנה מראש' : 'ללא הזמנה מראש'}</span>
                                    </div>
                                </div>

                                <div className="p-3 sm:p-5">
                                    <div className="flex items-start justify-between gap-2 mb-1 sm:mb-2">
                                        <h3 className="text-base sm:text-xl font-bold text-brand-dark dark:text-brand-dark-text group-hover:text-brand-primary transition-colors line-clamp-2 sm:line-clamp-1 tracking-tight min-w-0">
                                            {restaurant.name}
                                        </h3>
                                        {(restaurant.cuisine_type || restaurant.restaurant_type) && (
                                            <span className="shrink-0 bg-gray-100 dark:bg-brand-dark-border text-gray-600 dark:text-brand-dark-muted text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-md uppercase tracking-wider">
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

                                    <p className="text-xs sm:text-sm text-gray-500 mb-3 sm:mb-5 line-clamp-2 leading-snug sm:leading-relaxed min-h-0 sm:min-h-[40px] font-medium">
                                        {restaurant.description || 'מסעדה מעולה עם מגוון מנות טעימות ושירות איכותי'}
                                    </p>

                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] sm:text-xs text-gray-400 mb-3 sm:mb-5 font-bold uppercase tracking-wide">
                                        <div className="flex items-center gap-1 min-w-0">
                                            <HiLocationMarker className="w-3 h-3 text-gray-300 shrink-0" />
                                            <span className="truncate">{restaurant.city}</span>
                                        </div>
                                        {(restaurant.has_delivery || restaurant.has_pickup) && (
                                            <>
                                                <span className="text-gray-200 hidden sm:inline">|</span>
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    {restaurant.has_delivery && (
                                                        <span className="flex items-center gap-1">
                                                            <FaTruck className="w-3 h-3 text-gray-300" />
                                                            <span className="hidden sm:inline">משלוחים</span>
                                                            <span className="sm:hidden">משלוח</span>
                                                        </span>
                                                    )}
                                                    {restaurant.has_delivery && restaurant.has_pickup && (
                                                        <span className="text-gray-200 hidden sm:inline">|</span>
                                                    )}
                                                    {restaurant.has_pickup && (
                                                        <span className="flex items-center gap-1">
                                                            <FaShoppingBag className="w-3 h-3 text-gray-300" />
                                                            <span className="hidden sm:inline">איסוף עצמי</span>
                                                            <span className="sm:hidden">איסוף</span>
                                                        </span>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    <button type="button" className="w-full bg-gray-900 dark:bg-brand-dark-border text-white font-bold py-2.5 sm:py-3.5 rounded-lg sm:rounded-xl text-sm sm:text-base group-hover:bg-brand-primary transition-all duration-300 flex items-center justify-center gap-2 shadow-sm group-hover:shadow-brand-primary/25">
                                        <span>צפה בתפריט</span>
                                        <FaArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* יתרונות - סגנון Wolt */}
                <div className="mt-16 pt-10 border-t border-gray-100 dark:border-brand-dark-border">
                    <h3 className="text-2xl font-bold text-brand-dark dark:text-brand-dark-text text-center mb-2">למה {PRODUCT_NAME}?</h3>
                    <p className="text-center text-gray-500 dark:text-brand-dark-muted text-sm sm:text-base font-medium max-w-lg mx-auto mb-8 px-4 leading-relaxed">
                        פלטפורמה שמחברת בין מסעדות לסועדים — הזמנה נקייה, חשבון כשמתאים לכם, והתראות כשמתאים לכם.
                    </p>

                    <div className="max-w-md mx-auto px-4">
                        <div className="group relative p-8 bg-white dark:bg-brand-dark-surface rounded-[2rem] shadow-xl hover:shadow-2xl transition-all duration-500 border border-gray-100/50 dark:border-brand-dark-border overflow-hidden transform hover:-translate-y-1 min-h-[300px] sm:min-h-[280px] flex flex-col items-center justify-center">
                            <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/5 to-brand-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity" />

                            <div className={`relative w-20 h-20 mb-6 rounded-2xl bg-gradient-to-br ${features[activeFeature].colors} flex items-center justify-center shadow-lg mx-auto transition-all duration-500 group-hover:scale-110 group-hover:rotate-3`}>
                                {React.createElement(features[activeFeature].icon, { className: "text-3xl text-white drop-shadow-md" })}
                            </div>

                            <h4 className="relative text-2xl font-black text-gray-900 dark:text-brand-dark-text mb-3 text-center tracking-tight transition-all duration-300">
                                {features[activeFeature].title}
                            </h4>
                            <p className="relative text-gray-500 dark:text-brand-dark-muted font-medium leading-relaxed text-center transition-all duration-300 max-w-[280px] text-sm sm:text-base">
                                {features[activeFeature].description}
                            </p>
                        </div>

                        <div className="flex justify-center gap-3 mt-8">
                            {features.map((_, index) => (
                                <button
                                    key={index}
                                    onClick={() => setActiveFeature(index)}
                                    className={`h-1.5 rounded-full transition-all duration-500 ${index === activeFeature ? 'w-10 bg-brand-primary' : 'w-2 bg-gray-200 dark:bg-brand-dark-border hover:bg-gray-300 dark:hover:bg-gray-500'
                                        }`}
                                    aria-label={`Go to feature ${index + 1}`}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="mt-8 text-center text-sm text-gray-500 dark:text-brand-dark-muted">
                        <Link to="/legal/end-user" className="text-brand-primary hover:underline font-semibold">
                            תנאי שימוש למשתמשי קצה
                        </Link>
                        <span className="mx-2">•</span>
                        <Link to="/legal/privacy" className="text-brand-primary hover:underline font-semibold">
                            מדיניות פרטיות
                        </Link>
                    </div>
                </div>
            </div>
        </CustomerLayout>
    );
}
