import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { CustomerLayout } from '../layouts/CustomerLayout';
import { Link, useNavigate } from 'react-router-dom';
import { getAllRestaurants, getCities } from '../services/restaurantService';
import LocationPickerModal from '../components/LocationPickerModal';
import logo from '../images/ChefSyncLogoIcon.png';
import { resolveAssetUrl } from '../utils/assets';
import { PRODUCT_BYLINE_HE, PRODUCT_NAME } from '../constants/brand';
import {
    FaRocket,
    FaUserShield,
    FaMobileAlt,
    FaMask,
    FaMapMarkerAlt,
    FaChevronLeft,
    FaUtensils,
    FaArrowLeft,
    FaStore,
    FaClock,
    FaCircle
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
    const [activeOrderId, setActiveOrderId] = useState(null);
    const [showLocationModal, setShowLocationModal] = useState(false);
    const [deliveryLocation, setDeliveryLocation] = useState(null);
    const navigate = useNavigate();

    // Feature Carousel Logic
    const [activeFeature, setActiveFeature] = useState(0);
    const features = [
        {
            icon: FaRocket,
            title: "מהיר ופשוט",
            description: "הזמנה ב-3 קליקים בלבד, בלי הרשמה מסובכת",
            colors: "from-orange-400 to-red-500"
        },
        {
            icon: FaUserShield,
            title: "פרטיות מלאה",
            description: "ללא מידע אישי מיותר - רק שם וטלפון",
            colors: "from-blue-500 to-indigo-600"
        },
        {
            icon: FaMobileAlt,
            title: "בכל מכשיר",
            description: "עיצוב רספונסיבי שעובד מושלם בכל מסך",
            colors: "from-emerald-400 to-teal-500"
        }
    ];

    useEffect(() => {
        const interval = setInterval(() => {
            setActiveFeature(prev => (prev + 1) % features.length);
        }, 3000);
        return () => clearInterval(interval);
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

    // בדוק הזמנה פעילה כשיש tenant ID
    useEffect(() => {
        if (tenantId) {
            const savedOrderId = localStorage.getItem(`activeOrder_${tenantId}`);
            if (savedOrderId) {
                setActiveOrderId(savedOrderId);
            }
        }
    }, [tenantId]);

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
                        console.log('Could not get city name from coordinates:', error);
                    }
                },
                (error) => {
                    console.log('Location access denied or unavailable:', error);
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
            console.log('Restaurants loaded:', result);

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
                console.log('Cities loaded:', citiesList);
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
        console.log('Selecting restaurant:', restaurant.tenant_id);
        loginAsCustomer(restaurant.tenant_id);
        // חכה רגע קצר כדי לוודא שה-localStorage התעדכן
        setTimeout(() => {
            console.log('Tenant ID saved:', localStorage.getItem('tenantId'));
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
                        <p className="text-gray-600">טוען מסעדות...</p>
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

    return (
        <CustomerLayout>
            <LocationPickerModal
                open={showLocationModal}
                onClose={() => setShowLocationModal(false)}
                onLocationSelected={(location) => {
                    setDeliveryLocation(location);
                    setShowLocationModal(false);
                }}
            />

            {/* כרטיסייה של הזמנה פעילה */}
            {activeOrderId && (
                <div className="mb-6 p-4 bg-gradient-to-r from-brand-primary to-brand-secondary rounded-2xl shadow-lg text-white cursor-pointer hover:shadow-xl transition-all border border-white/10 flex items-center justify-between"
                    onClick={() => navigate(`/${tenantId || ''}/order-status/${activeOrderId}`)}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                            <FaMapMarkerAlt className="text-white animate-bounce" />
                        </div>
                        <div>
                            <p className="font-bold text-lg mb-0.5">הזמנה בעיצומה</p>
                            <p className="text-xs opacity-90 font-medium">הזמנה #{activeOrderId} • לחץ לצפייה בסטטוס</p>
                        </div>
                    </div>
                    <FaChevronLeft className="text-white/70" />
                </div>
            )}

            {/* Hero Section - סגנון Wolt משודרג */}
            <div className="relative -mx-4 sm:-mx-6 lg:-mx-8 -mt-8 mb-6">
                <div className="relative h-[320px] sm:h-[460px] bg-gradient-to-br from-brand-dark via-brand-primary to-brand-secondary overflow-hidden">
                    {/* אפקט עומק וגרדיאנט מודרני (Mesh Gradient Style) */}
                    <div className="absolute inset-0 opacity-30">
                        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[80%] bg-white/20 rounded-full blur-[120px] animate-pulse"></div>
                        <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[70%] bg-brand-accent/20 rounded-full blur-[100px]"></div>
                        {/* תבנית נקודות עדינה לרקע */}
                        <div className="absolute inset-0 opacity-[0.1]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>
                    </div>

                    {/* שורה עליונה: מיקום + כניסת מנהלים */}
                    <div className="absolute inset-x-0 top-0 z-30 flex items-center justify-between p-4 sm:p-5">
                        <button
                            type="button"
                            onClick={handleAdminLogin}
                            className="bg-white/95 backdrop-blur-md text-brand-dark px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl shadow-lg border border-white/80 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center gap-2 text-xs sm:text-sm font-semibold cursor-pointer"
                        >
                            <FaUserShield className="text-brand-primary" />
                            <span className="hidden sm:inline">כניסת מנהלים</span>
                        </button>

                        {currentCityName && (
                            <button
                                onClick={() => setShowLocationModal(true)}
                                className="inline-flex items-center gap-1.5 sm:gap-2 backdrop-blur-md bg-white/90 text-brand-dark px-3 sm:px-4 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm hover:bg-white shadow-md font-semibold transition-all cursor-pointer group"
                            >
                                <HiLocationMarker className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-primary group-hover:animate-bounce" />
                                <span>
                                    {deliveryLocation?.fullAddress ||
                                        (deliveryLocation?.street && deliveryLocation?.cityName
                                            ? `${deliveryLocation.street}, ${deliveryLocation.cityName}`
                                            : deliveryLocation?.cityName || currentCityName)}
                                </span>
                            </button>
                        )}
                    </div>

                    {/* תוכן ה-Hero - מרכוז גמיש למובייל ודסקטופ */}
                    <div className="absolute inset-0 pt-12 sm:pt-0 flex items-center justify-center">
                        <div className="text-center px-4 sm:px-6 w-full max-w-4xl relative z-10 flex flex-col items-center">

                            {/* אפקט הילה מרכזי מודגש */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-brand-primary/20 blur-[120px] -z-10 rounded-full animate-pulse"></div>

                            {/* לוגו - לבן בוהק, מרכזי ונקי */}
                            <div className="relative group mb-2 sm:mb-12">
                                <div className="absolute inset-0 bg-white/5 blur-2xl rounded-full scale-110 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <div className="relative w-40 sm:w-64 lg:w-72 pointer-events-none select-none transition-all duration-700 group-hover:scale-105">
                                    <img
                                        src={logo}
                                        alt={PRODUCT_NAME}
                                        className="w-full h-auto object-contain filter brightness-0 invert drop-shadow-[0_0_20px_rgba(255,255,255,0.25)]"
                                    />
                                </div>
                            </div>

                            {/* קרוסלת לוגואים של מסעדות */}
                            {restaurants.filter(r => r.logo_url).length > 0 && (
                                <div className="w-full max-w-5xl overflow-hidden relative group/ticker pb-2">
                                    <p className="text-[10px] sm:text-xs font-black text-white uppercase tracking-[0.4em] mb-3 sm:mb-4 drop-shadow-sm opacity-80">
                                        הנבחרת של ChefSync
                                    </p>
                                    <div className="animate-ticker flex gap-10 sm:gap-16 items-center py-2">
                                        {/* שכפול רשימה ליצירת לופ אינסופי */}
                                        {[...restaurants.filter(r => r.logo_url), ...restaurants.filter(r => r.logo_url), ...restaurants.filter(r => r.logo_url)].map((r, i) => (
                                            <div
                                                key={`${r.id}-${i}`}
                                                className="flex-shrink-0 transition-all duration-300 hover:scale-110 cursor-pointer group/logo bg-white/95 backdrop-blur-sm p-1.5 sm:p-2.5 rounded-2xl shadow-lg border border-white/20"
                                                onClick={() => handleRestaurantClick(r)}
                                            >
                                                <img
                                                    src={resolveAssetUrl(r.logo_url)}
                                                    alt={r.name}
                                                    className="h-8 sm:h-12 w-auto object-contain opacity-100 transition-transform"
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
                <div className="mx-3 sm:mx-6 lg:mx-8 -mt-6 sm:-mt-8 relative z-10">
                    <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl p-3 sm:p-4">
                        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-center">
                            <div className="flex-1 w-full relative group">
                                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-brand-primary transition-colors">
                                    <HiGlobeAlt className="w-5 h-5" />
                                </div>
                                <select
                                    value={selectedCity}
                                    onChange={(e) => setSelectedCity(e.target.value)}
                                    className="w-full pr-10 pl-4 py-2.5 sm:py-3 bg-gray-50 border border-gray-200 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary text-gray-700 font-semibold text-sm sm:text-base transition-all appearance-none cursor-pointer"
                                >
                                    <option value="">כל הערים</option>
                                    {cities.filter(Boolean).map((city, index) => (
                                        <option key={`${city}-${index}`} value={city}>
                                            {city}
                                        </option>
                                    ))}
                                </select>
                                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-400">
                                    <FaChevronLeft className="w-3 h-3 -rotate-90" />
                                </div>
                            </div>
                            <div className="text-center sm:text-right px-4">
                                <p className="text-xl sm:text-2xl font-black text-brand-primary leading-tight">{restaurants.length}</p>
                                <p className="text-[10px] sm:text-xs uppercase tracking-wider font-bold text-gray-400">מסעדות</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-10">
                {/* כותרת רשימת מסעדות */}
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl sm:text-3xl font-black text-brand-dark tracking-tight">
                        {selectedCity ? `מסעדות ב${selectedCity}` : 'כל המסעדות'}
                    </h2>
                    {userLocation && (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full uppercase tracking-wider">
                            <FaStore className="w-3 h-3" />
                            <span>לפי מרחק</span>
                        </div>
                    )}
                </div>

                {/* רשימת מסעדות - Grid בסגנון Wolt */}
                {restaurants.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-3xl shadow-sm border border-gray-50">
                        <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-50 rounded-full mb-6">
                            <FaUtensils className="text-4xl text-gray-300" />
                        </div>
                        <p className="text-gray-900 text-xl font-bold mb-2">לא נמצאו מסעדות</p>
                        <p className="text-gray-400 text-sm font-medium">נסה לבחור עיר אחרת או להרחיב את החיפוש</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {restaurants.map((restaurant, index) => (
                            <div
                                key={restaurant.id ?? restaurant.tenant_id ?? `restaurant-${index}`}
                                onClick={() => handleRestaurantClick(restaurant)}
                                className="bg-white rounded-2xl shadow-sm hover:shadow-2xl transition-all duration-300 cursor-pointer group overflow-hidden border border-gray-100 hover:border-brand-primary/30"
                                style={{ animationDelay: `${index * 50}ms` }}
                            >
                                {/* תמונה/לוגו */}
                                <div className="relative h-44 bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden">
                                    {restaurant.logo_url ? (
                                        <>
                                            {/* רקע מעומעם */}
                                            <div
                                                className="absolute inset-0 opacity-20"
                                                style={{
                                                    backgroundImage: `url(${resolveAssetUrl(restaurant.logo_url)})`,
                                                    backgroundSize: 'cover',
                                                    backgroundPosition: 'center',
                                                    filter: 'blur(20px)'
                                                }}
                                            />
                                            {/* לוגו מרכזי */}
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <img
                                                    src={resolveAssetUrl(restaurant.logo_url)}
                                                    alt={restaurant.name}
                                                    className="w-28 h-28 object-contain group-hover:scale-110 transition-transform duration-500"
                                                />
                                            </div>
                                        </>
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="w-24 h-24 bg-brand-primary/10 rounded-3xl flex items-center justify-center">
                                                <FaUtensils className="text-4xl text-brand-primary/30" />
                                            </div>
                                        </div>
                                    )}

                                    {/* תג מרחק */}
                                    {restaurant.distance !== null && Number.isFinite(restaurant.distance) && (
                                        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-md text-brand-primary px-3 py-1.5 rounded-full text-xs font-black shadow-lg border border-white/50 flex items-center gap-1">
                                            <FaMapMarkerAlt className="w-3 h-3" />
                                            {restaurant.distance.toFixed(1)} ק"מ
                                        </div>
                                    )}

                                    {/* תג דמו */}
                                    {restaurant.is_demo && (
                                        <div className="absolute bottom-3 left-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white px-3 py-1.5 rounded-full text-[10px] font-black shadow-xl border border-white/20 uppercase tracking-widest flex items-center gap-1.5">
                                            <FaMask className="text-xs" /> מסעדה לדוגמא
                                        </div>
                                    )}

                                    {/* תג סטטוס */}
                                    <div className={`absolute top-3 right-3 px-3 py-1.5 rounded-full text-[10px] font-black shadow-lg flex items-center gap-1.5 border border-white/20 uppercase tracking-wider ${(restaurant.is_open_now ?? restaurant.is_open) ? 'bg-emerald-500/90 backdrop-blur-md text-white' : 'bg-rose-500/90 backdrop-blur-md text-white'}`}>
                                        <FaCircle className={`w-1.5 h-1.5 ${(restaurant.is_open_now ?? restaurant.is_open) ? 'animate-pulse' : ''}`} />
                                        {(restaurant.is_open_now ?? restaurant.is_open) ? 'פתוח עכשיו' : 'סגור כרגע'}
                                    </div>
                                </div>

                                {/* פרטים */}
                                <div className="p-5">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <h3 className="text-xl font-bold text-brand-dark group-hover:text-brand-primary transition-colors line-clamp-1 tracking-tight">
                                            {restaurant.name}
                                        </h3>
                                        {restaurant.cuisine_type && (
                                            <span className="bg-gray-100 text-gray-600 text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-wider">
                                                {restaurant.cuisine_type}
                                            </span>
                                        )}
                                    </div>

                                    <p className="text-sm text-gray-500 mb-5 line-clamp-2 leading-relaxed min-h-[40px] font-medium">
                                        {restaurant.description || 'מסעדה מעולה עם מגוון מנות טעימות ושירות איכותי'}
                                    </p>

                                    <div className="flex items-center text-xs text-gray-400 mb-5 font-bold uppercase tracking-wide">
                                        <div className="flex items-center gap-1">
                                            <HiLocationMarker className="w-3.5 h-3.5 text-gray-300" />
                                            <span>{restaurant.city}</span>
                                        </div>
                                        {restaurant.phone && (
                                            <>
                                                <span className="mx-2 text-gray-200">|</span>
                                                <div className="flex items-center gap-1">
                                                    <FaClock className="w-3 h-3 text-gray-300" />
                                                    <span>במשלוחים</span>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    <button className="w-full bg-gray-900 text-white font-bold py-3.5 rounded-xl group-hover:bg-brand-primary transition-all duration-300 flex items-center justify-center gap-2 shadow-sm group-hover:shadow-brand-primary/25">
                                        <span>צפה בתפריט</span>
                                        <FaArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* יתרונות - סגנון Wolt */}
                <div className="mt-16 pt-10 border-t border-gray-100">
                    <h3 className="text-2xl font-bold text-brand-dark text-center mb-8">למה {PRODUCT_NAME}?</h3>

                    <div className="max-w-md mx-auto px-4">
                        <div className="group relative p-8 bg-white rounded-[2rem] shadow-xl hover:shadow-2xl transition-all duration-500 border border-gray-100/50 overflow-hidden transform hover:-translate-y-1 min-h-[280px] flex flex-col items-center justify-center">
                            <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/5 to-brand-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity" />

                            <div className={`relative w-20 h-20 mb-6 rounded-2xl bg-gradient-to-br ${features[activeFeature].colors} flex items-center justify-center shadow-lg mx-auto transition-all duration-500 group-hover:scale-110 group-hover:rotate-3`}>
                                {React.createElement(features[activeFeature].icon, { className: "text-3xl text-white drop-shadow-md" })}
                            </div>

                            <h4 className="relative text-2xl font-black text-gray-900 mb-3 text-center tracking-tight transition-all duration-300">
                                {features[activeFeature].title}
                            </h4>
                            <p className="relative text-gray-500 font-medium leading-relaxed text-center transition-all duration-300 max-w-[240px]">
                                {features[activeFeature].description}
                            </p>
                        </div>

                        <div className="flex justify-center gap-3 mt-8">
                            {features.map((_, index) => (
                                <button
                                    key={index}
                                    onClick={() => setActiveFeature(index)}
                                    className={`h-1.5 rounded-full transition-all duration-500 ${index === activeFeature ? 'w-10 bg-brand-primary' : 'w-2 bg-gray-200 hover:bg-gray-300'
                                        }`}
                                    aria-label={`Go to feature ${index + 1}`}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="mt-8 text-center text-sm text-gray-500">
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
