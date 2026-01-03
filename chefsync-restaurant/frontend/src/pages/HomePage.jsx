import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { CustomerLayout } from '../layouts/CustomerLayout';
import { useNavigate } from 'react-router-dom';
import { getAllRestaurants, getCities } from '../services/restaurantService';
import logo from '../images/ChefSyncLogoIcon.png';

/**
 * עמוד בית - בחירת מסעדה מרשימה
 */

export default function HomePage() {
    const { loginAsCustomer } = useAuth();
    const [restaurants, setRestaurants] = useState([]);
    const [cities, setCities] = useState([]);
    const [selectedCity, setSelectedCity] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [userLocation, setUserLocation] = useState(null);
    const [currentCityName, setCurrentCityName] = useState('');
    const [autoSelectedCity, setAutoSelectedCity] = useState(false);
    const navigate = useNavigate();

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

    // בחירה אוטומטית של עיר קרובה כשהמיקום מתעדכן
    useEffect(() => {
        if (userLocation && !autoSelectedCity && restaurants.length > 0) {
            const closestRestaurant = restaurants.find(r => r.distance !== null);
            if (closestRestaurant && closestRestaurant.city) {
                setSelectedCity(closestRestaurant.city);
                setAutoSelectedCity(true);
            }
        }
    }, [userLocation, restaurants, autoSelectedCity]);

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
            <div className="space-y-6">
                {/* כותרת */}
                <div className="text-center py-6">
                    <img src={logo} alt="ChefSync IL" className="h-24 mx-auto mb-4" />
                    <p className="text-gray-500 text-xl">בחר מסעדה והתחל להזמין</p>

                    {/* כרטיסית מיקום נוכחי */}
                    {currentCityName && (
                        <div className="mt-4 inline-flex items-center gap-2 bg-brand-primary/10 text-brand-primary px-4 py-2 rounded-full">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                            </svg>
                            <span className="font-semibold">המיקום שלך: {currentCityName}</span>
                        </div>
                    )}
                </div>

                {/* סינון לפי עיר */}
                <div className="max-w-md mx-auto">
                    <select
                        value={selectedCity}
                        onChange={(e) => setSelectedCity(e.target.value)}
                        className="w-full px-5 py-3.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent shadow-sm text-gray-700 font-medium"
                    >
                        <option value="">📍 כל הערים</option>
                        {cities.map((city) => (
                            <option key={city} value={city}>
                                {city}
                            </option>
                        ))}
                    </select>
                </div>

                {/* רשימת מסעדות */}
                {restaurants.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-2xl shadow-sm">
                        <p className="text-gray-500 text-lg">לא נמצאו מסעדות</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {restaurants.map((restaurant) => (
                            <div
                                key={restaurant.id}
                                onClick={() => handleRestaurantClick(restaurant)}
                                className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:scale-[1.02] overflow-hidden"
                            >
                                {/* לוגו */}
                                <div className="h-48 bg-gradient-to-br from-brand-light to-gray-50 flex items-center justify-center overflow-hidden">
                                    {restaurant.logo_url ? (
                                        <img
                                            src={restaurant.logo_url}
                                            alt={restaurant.name}
                                            className="w-36 h-36 object-contain"
                                        />
                                    ) : (
                                        <div className="w-32 h-32 bg-brand-primary/10 rounded-full flex items-center justify-center">
                                            <span className="text-5xl">🍽️</span>
                                        </div>
                                    )}
                                </div>

                                {/* פרטים */}
                                <div className="p-5">
                                    <h3 className="text-xl font-bold text-brand-dark mb-1">
                                        {restaurant.name}
                                    </h3>

                                    {restaurant.cuisine_type && (
                                        <p className="text-sm text-brand-primary font-semibold mb-2">
                                            {restaurant.cuisine_type}
                                        </p>
                                    )}

                                    <p className="text-sm text-gray-500 mb-4 line-clamp-2 leading-relaxed">
                                        {restaurant.description}
                                    </p>

                                    <div className="flex items-center justify-between text-sm mb-4">
                                        <div className="flex items-center text-gray-400">
                                            <svg className="w-4 h-4 ml-1" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                                            </svg>
                                            {restaurant.city}
                                        </div>
                                        {restaurant.distance && (
                                            <span className="text-brand-primary font-semibold">
                                                📍 {restaurant.distance.toFixed(1)} ק"מ
                                            </span>
                                        )}
                                    </div>

                                    <button className="w-full bg-brand-primary text-white font-semibold py-3 rounded-xl hover:bg-brand-secondary transition-colors">
                                        צפה בתפריט →
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* מידע נוסף */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
                    <div className="bg-white rounded-2xl shadow-sm p-6 text-center hover:shadow-md transition">
                        <div className="text-4xl mb-3">⚡</div>
                        <h3 className="font-bold text-brand-dark mb-2 text-lg">מהיר</h3>
                        <p className="text-sm text-gray-500">הזמנה בעוד 3-4 קליקים בלבד</p>
                    </div>
                    <div className="bg-white rounded-2xl shadow-sm p-6 text-center hover:shadow-md transition">
                        <div className="text-4xl mb-3">✔️</div>
                        <h3 className="font-bold text-brand-dark mb-2 text-lg">בטוח</h3>
                        <p className="text-sm text-gray-500">ללא מידע אישי - רק שם וטלפון</p>
                    </div>
                    <div className="bg-white rounded-2xl shadow-sm p-6 text-center hover:shadow-md transition">
                        <div className="text-4xl mb-3">📱</div>
                        <h3 className="font-bold text-brand-dark mb-2 text-lg">נוח</h3>
                        <p className="text-sm text-gray-500">עובדת בכל מכשיר</p>
                    </div>
                </div>
            </div>
        </CustomerLayout>
    );
}
