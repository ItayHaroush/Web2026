import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { CustomerLayout } from '../layouts/CustomerLayout';
import { Link, useNavigate } from 'react-router-dom';
import { getAllRestaurants, getCities } from '../services/restaurantService';
import logo from '../images/ChefSyncLogoIcon.png';
import { resolveAssetUrl } from '../utils/assets';

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
    const [autoSelectedCity, setAutoSelectedCity] = useState(false);
    const [activeOrderId, setActiveOrderId] = useState(null);
    const navigate = useNavigate();

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

            console.log('Loading restaurants, city filter:', selectedCity);

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

                // בחירה אוטומטית של העיר הקרובה ביותר
                if (!autoSelectedCity && restaurantsList.length > 0) {
                    const closestRestaurant = restaurantsList[0]; // הראשון אחרי המיון = הכי קרוב
                    if (closestRestaurant && closestRestaurant.city && closestRestaurant.distance !== null) {
                        console.log('🎯 בחירת עיר קרובה:', closestRestaurant.city, '- מרחק:', closestRestaurant.distance.toFixed(2), 'ק"מ');
                        setSelectedCity(closestRestaurant.city);
                        setAutoSelectedCity(true);
                    }
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
            navigate('/menu');
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
            {/* כרטיסייה של הזמנה פעילה */}
            {activeOrderId && (
                <div className="mb-6 p-4 bg-gradient-to-r from-brand-primary to-brand-secondary rounded-2xl shadow-lg text-white cursor-pointer hover:shadow-xl transition-shadow"
                    onClick={() => navigate(`/order-status/${activeOrderId}`)}>
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
                <div className="relative h-48 sm:h-72 bg-gradient-to-br from-brand-dark via-brand-primary to-brand-secondary overflow-hidden">
                    {/* אלמנטים דקורטיביים */}
                    <div className="absolute inset-0 opacity-10">
                        <div className="absolute top-5 right-5 sm:top-10 sm:right-10 w-20 sm:w-32 h-20 sm:h-32 bg-white rounded-full blur-3xl"></div>
                        <div className="absolute bottom-5 left-10 sm:bottom-10 sm:left-20 w-32 sm:w-48 h-32 sm:h-48 bg-brand-accent rounded-full blur-3xl"></div>
                    </div>

                    {/* כפתור כניסת מנהלים */}
                    <button
                        type="button"
                        onClick={handleAdminLogin}
                        className="absolute z-20 top-3 right-3 sm:top-4 sm:right-4 bg-white text-brand-dark px-3 py-2 sm:px-4 sm:py-2 rounded-xl shadow-lg border border-white/80 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center gap-2 text-xs sm:text-sm font-semibold cursor-pointer"
                    >
                        <span>🛡️</span>
                        <span>כניסת מנהלים</span>
                    </button>

                    {/* תוכן ה-Hero */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center text-white px-3 sm:px-4">
                            <div className="mb-2 sm:mb-4 flex justify-center">
                                <div className="bg-white p-2 sm:p-3 rounded-xl sm:rounded-2xl shadow-2xl">
                                    <img src={logo} alt="ChefSync IL" className="h-10 sm:h-16" />
                                </div>
                            </div>
                            <h1 className="text-xl sm:text-4xl font-bold mb-1 sm:mb-2 drop-shadow-lg">
                                ChefSync IL
                            </h1>
                            <p className="text-sm sm:text-lg opacity-90 mb-2 sm:mb-4">הזמנת אוכל ממסעדות מובחרות</p>

                            {/* כרטיסית מיקום */}
                            {currentCityName && (
                                <div className="inline-flex items-center gap-1 sm:gap-2 bg-white/20 backdrop-blur-sm text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm">
                                    <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                                    </svg>
                                    <span className="font-medium">📍 {currentCityName}</span>
                                </div>
                            )}
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
                                    {cities.map((city) => (
                                        <option key={city} value={city}>
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
                                key={restaurant.id}
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
                                    {restaurant.distance && (
                                        <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm text-brand-primary px-3 py-1.5 rounded-full text-sm font-bold shadow-md">
                                            📍 {restaurant.distance.toFixed(1)} ק"מ
                                        </div>
                                    )}

                                    {/* תג סטטוס */}
                                    <div className={`absolute top-3 right-3 px-3 py-1.5 rounded-full text-xs font-bold shadow-md ${restaurant.is_open ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                                        {restaurant.is_open ? '🟢 פתוח' : '🔴 סגור'}
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
                    <h3 className="text-2xl font-bold text-brand-dark text-center mb-8">למה ChefSync?</h3>
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
