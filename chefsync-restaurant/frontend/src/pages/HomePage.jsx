import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { CustomerLayout } from '../layouts/CustomerLayout';
import { Link, useNavigate } from 'react-router-dom';
import { getAllRestaurants, getCities } from '../services/restaurantService';
import LocationPickerModal from '../components/LocationPickerModal';
import logo from '../images/ChefSyncLogoIcon.png';
import { resolveAssetUrl } from '../utils/assets';
import { PRODUCT_BYLINE_HE, PRODUCT_NAME } from '../constants/brand';

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
                <div className="mb-6 p-4 bg-gradient-to-r from-brand-primary to-brand-secondary rounded-2xl shadow-lg text-white cursor-pointer hover:shadow-xl transition-shadow"
                    onClick={() => navigate(`/${tenantId || ''}/order-status/${activeOrderId}`)}>
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

            {/* Hero Section - סגנון Wolt */}
            <div className="relative -mx-4 sm:-mx-6 lg:-mx-8 -mt-8 mb-6">
                <div className="relative h-64 sm:h-[420px] bg-gradient-to-br from-brand-dark via-brand-primary to-brand-secondary overflow-hidden">
                    {/* אלמנטים דקורטיביים */}
                    <div className="absolute inset-0 opacity-10">
                        <div className="absolute top-5 right-5 sm:top-10 sm:right-10 w-20 sm:w-32 h-20 sm:h-32 bg-white rounded-full blur-3xl"></div>
                        <div className="absolute bottom-5 left-10 sm:bottom-10 sm:left-20 w-32 sm:w-48 h-32 sm:h-48 bg-brand-accent rounded-full blur-3xl"></div>
                    </div>

                    {/* שורה עליונה: מיקום + כניסת מנהלים */}
                    <div className="absolute inset-x-0 top-0 z-30 flex items-center justify-between p-4 sm:p-5">
                        <button
                            type="button"
                            onClick={handleAdminLogin}
                            className="bg-white/95 backdrop-blur-sm text-brand-dark px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl shadow-lg border border-white/80 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center gap-2 text-xs sm:text-sm font-semibold cursor-pointer"
                        >
                            <span>🛡️</span>
                            <span className="hidden sm:inline">כניסת מנהלים</span>
                        </button>

                        {currentCityName && (
                            <button
                                onClick={() => setShowLocationModal(true)}
                                className="inline-flex items-center gap-1.5 sm:gap-2 backdrop-blur-md bg-white/90 text-brand-dark px-3 sm:px-4 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm hover:bg-white shadow-md font-medium transition-all cursor-pointer"
                            >
                                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-primary" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                                </svg>
                                <span>
                                    {deliveryLocation?.fullAddress ||
                                        (deliveryLocation?.street && deliveryLocation?.cityName
                                            ? `${deliveryLocation.street}, ${deliveryLocation.cityName}`
                                            : deliveryLocation?.cityName || currentCityName)}
                                </span>
                            </button>
                        )}
                    </div>

                    {/* תוכן ה-Hero */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center text-white px-4 sm:px-6 w-full max-w-3xl">
                            <div className="relative mx-auto w-64 sm:w-96 lg:w-[480px] pointer-events-none select-none -mt-2 sm:-mt-2">
                                <img
                                    src={logo}
                                    alt={PRODUCT_NAME}
                                    className="w-full h-auto object-contain drop-shadow-[0_20px_35px_rgba(0,0,0,0.5)]"
                                />

                                {/* טקסט לבן ישירות על הלוגו */}
                                <div className="absolute inset-x-0 bottom-8 sm:bottom-5 flex flex-col items-center text-white gap-1 sm:gap-1.5">
                                    <p className="text-sm sm:text-base font-semibold opacity-95 drop-shadow-[0_6px_14px_rgba(0,0,0,0.65)]">
                                        {PRODUCT_BYLINE_HE}
                                    </p>
                                    <p className="text-xs sm:text-lg opacity-95 drop-shadow-[0_6px_14px_rgba(0,0,0,0.65)]">
                                        הזמנת אוכל ממסעדות מובחרות
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* חיפוש/סינון צף */}
                <div className="mx-3 sm:mx-6 lg:mx-8 -mt-5 sm:-mt-6 relative z-10">
                    <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl p-3 sm:p-4">
                        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-center">
                            <div className="flex-1 w-full">
                                <select
                                    value={selectedCity}
                                    onChange={(e) => setSelectedCity(e.target.value)}
                                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-50 border border-gray-200 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent text-gray-700 font-medium text-sm sm:text-base"
                                >
                                    <option value="">🌍 כל הערים</option>
                                    {cities.filter(Boolean).map((city, index) => (
                                        <option key={`${city}-${index}`} value={city}>
                                            📍 {city}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="text-center sm:text-right">
                                <p className="text-xl sm:text-2xl font-bold text-brand-primary">{restaurants.length}</p>
                                <p className="text-xs sm:text-sm text-gray-500">מסעדות זמינות</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-10">
                {/* כותרת רשימת מסעדות */}
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl sm:text-3xl font-bold text-brand-dark">
                        {selectedCity ? `מסעדות ב${selectedCity}` : 'כל המסעדות'}
                    </h2>
                    {userLocation && (
                        <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
                            ממוין לפי מרחק
                        </span>
                    )}
                </div>

                {/* רשימת מסעדות - Grid בסגנון Wolt */}
                {restaurants.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl shadow-sm">
                        <div className="text-6xl mb-4">🍽️</div>
                        <p className="text-gray-500 text-lg mb-2">לא נמצאו מסעדות</p>
                        <p className="text-gray-400 text-sm">נסה לבחור עיר אחרת</p>
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
                                            <div className="w-24 h-24 bg-brand-primary/10 rounded-2xl flex items-center justify-center">
                                                <span className="text-5xl">🍽️</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* תג מרחק */}
                                    {restaurant.distance !== null && Number.isFinite(restaurant.distance) && (
                                        <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm text-brand-primary px-3 py-1.5 rounded-full text-sm font-bold shadow-md">
                                            📍 {restaurant.distance.toFixed(1)} ק"מ
                                        </div>
                                    )}

                                    {/* תג סטטוס */}
                                    <div className={`absolute top-3 right-3 px-3 py-1.5 rounded-full text-xs font-bold shadow-md ${(restaurant.is_open_now ?? restaurant.is_open) ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                                        {(restaurant.is_open_now ?? restaurant.is_open) ? '🟢 פתוח' : '🔴 סגור'}
                                    </div>
                                </div>

                                {/* פרטים */}
                                <div className="p-5">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <h3 className="text-xl font-bold text-brand-dark group-hover:text-brand-primary transition-colors line-clamp-1">
                                            {restaurant.name}
                                        </h3>
                                        {restaurant.cuisine_type && (
                                            <span className="bg-brand-primary/10 text-brand-primary text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap">
                                                {restaurant.cuisine_type}
                                            </span>
                                        )}
                                    </div>

                                    <p className="text-sm text-gray-500 mb-4 line-clamp-2 leading-relaxed min-h-[40px]">
                                        {restaurant.description || 'מסעדה מעולה עם מגוון מנות טעימות'}
                                    </p>

                                    <div className="flex items-center text-sm text-gray-400 mb-4">
                                        <svg className="w-4 h-4 ml-1.5" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                                        </svg>
                                        <span>{restaurant.city}</span>
                                        {restaurant.phone && (
                                            <>
                                                <span className="mx-2">•</span>
                                                <span>{restaurant.phone}</span>
                                            </>
                                        )}
                                    </div>

                                    <button className="w-full bg-gradient-to-l from-brand-primary to-brand-secondary text-white font-bold py-3 rounded-xl hover:shadow-lg hover:scale-[1.02] transition-all duration-300 flex items-center justify-center gap-2">
                                        <span>צפה בתפריט</span>
                                        <span>←</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* יתרונות - סגנון Wolt */}
                <div className="mt-16 pt-10 border-t border-gray-100">
                    <h3 className="text-2xl font-bold text-brand-dark text-center mb-8">למה {PRODUCT_NAME}?</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        <div className="bg-gradient-to-br from-brand-primary/5 to-brand-secondary/5 rounded-2xl p-6 text-center hover:shadow-lg transition-all duration-300 border border-brand-primary/10">
                            <div className="w-16 h-16 bg-brand-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <span className="text-3xl">⚡</span>
                            </div>
                            <h4 className="font-bold text-brand-dark mb-2 text-lg">מהיר ופשוט</h4>
                            <p className="text-sm text-gray-500">הזמנה ב-3 קליקים בלבד, בלי הרשמה מסובכת</p>
                        </div>
                        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 text-center hover:shadow-lg transition-all duration-300 border border-green-100">
                            <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <span className="text-3xl">🔒</span>
                            </div>
                            <h4 className="font-bold text-brand-dark mb-2 text-lg">פרטיות מלאה</h4>
                            <p className="text-sm text-gray-500">ללא מידע אישי מיותר - רק שם וטלפון</p>
                        </div>
                        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-6 text-center hover:shadow-lg transition-all duration-300 border border-purple-100">
                            <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <span className="text-3xl">📱</span>
                            </div>
                            <h4 className="font-bold text-brand-dark mb-2 text-lg">בכל מכשיר</h4>
                            <p className="text-sm text-gray-500">עיצוב רספונסיבי שעובד מושלם בכל מסך</p>
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
