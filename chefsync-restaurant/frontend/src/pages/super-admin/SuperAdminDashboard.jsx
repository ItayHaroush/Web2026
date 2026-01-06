import { useState, useEffect } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import SuperAdminLayout from '../../layouts/SuperAdminLayout';
import api from '../../services/apiClient';
import { toast } from 'react-hot-toast';

export default function SuperAdminDashboard() {
    const { getAuthHeaders } = useAdminAuth();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [restaurants, setRestaurants] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [showAddRestaurant, setShowAddRestaurant] = useState(false);

    useEffect(() => {
        fetchDashboard();
        fetchRestaurants();
    }, [filterStatus, searchTerm]);

    const fetchDashboard = async () => {
        try {
            const headers = getAuthHeaders();
            console.log('Dashboard headers:', headers);
            const response = await api.get('/super-admin/dashboard', {
                headers: headers
            });
            if (response.data.success) {
                setStats(response.data.data);
            }
        } catch (error) {
            console.error('Failed to fetch dashboard:', error);
            console.error('Dashboard error response:', error.response?.data);
            toast.error('שגיאה בטעינת סטטיסטיקות');
        }
    };

    const fetchRestaurants = async () => {
        try {
            const params = {
                ...(searchTerm && { search: searchTerm }),
                ...(filterStatus && { status: filterStatus })
            };
            const response = await api.get('/super-admin/restaurants', {
                headers: getAuthHeaders(),
                params
            });
            if (response.data.success) {
                setRestaurants(response.data.restaurants.data || response.data.restaurants);
            }
        } catch (error) {
            console.error('Failed to fetch restaurants:', error);
            console.error('Error response:', error.response?.data);
            toast.error(error.response?.data?.message || 'שגיאה בטעינת מסעדות');
        } finally {
            setLoading(false);
        }
    };

    const toggleRestaurant = async (restaurantId) => {
        try {
            const response = await api.patch(
                `/super-admin/restaurants/${restaurantId}/toggle-status`,
                {},
                { headers: getAuthHeaders() }
            );
            if (response.data.success) {
                toast.success(response.data.message);
                fetchRestaurants();
                fetchDashboard();
            }
        } catch (error) {
            toast.error('שגיאה בעדכון סטטוס');
        }
    };

    const deleteRestaurant = async (restaurantId) => {
        if (!confirm('בטוח שרוצה למחוק את המסעדה?')) return;

        try {
            const response = await api.delete(
                `/super-admin/restaurants/${restaurantId}`,
                { headers: getAuthHeaders() }
            );
            if (response.data.success) {
                toast.success(response.data.message);
                fetchRestaurants();
                fetchDashboard();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'שגיאה במחיקה');
        }
    };

    return (
        <SuperAdminLayout>
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">🏢 דשבורד מנהל מערכת</h1>
                    <p className="text-gray-600">ניהול מלא של כל המסעדות במערכת</p>
                </div>

                {/* סטטיסטיקות */}
                {stats && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        <div className="bg-white rounded-2xl shadow-sm p-6 border border-brand-primary/10">
                            <p className="text-sm text-gray-500 mb-1">סך הכל מסעדות</p>
                            <h3 className="text-3xl font-bold text-brand-primary">{stats.stats.total_restaurants}</h3>
                            <p className="text-xs text-green-600 mt-2">
                                {stats.stats.total_restaurants > 0 ? '🟢 מערכת פעילה' : '🔴 אין מסעדות'}
                            </p>
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm p-6 border border-green-200">
                            <p className="text-sm text-gray-500 mb-1">מסעדות פעילות</p>
                            <h3 className="text-3xl font-bold text-green-600">{stats.restaurants_by_status.active}</h3>
                            <p className="text-xs text-gray-500 mt-2">פתוחות עכשיו</p>
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm p-6 border border-purple-200">
                            <p className="text-sm text-gray-500 mb-1">הזמנות כללי</p>
                            <h3 className="text-3xl font-bold text-purple-600">{stats.stats.total_orders}</h3>
                            <p className="text-xs text-gray-500 mt-2">בכל המסעדות</p>
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm p-6 border border-orange-200">
                            <p className="text-sm text-gray-500 mb-1">הכנסה כוללת</p>
                            <h3 className="text-3xl font-bold text-orange-600">₪{Number(stats.stats.total_revenue || 0).toFixed(0)}</h3>
                            <p className="text-xs text-gray-500 mt-2">הזמנות סגורות</p>
                        </div>
                    </div>
                )}

                {/* כפתור הוספת מסעדה */}
                <div className="mb-6 flex justify-between items-center">
                    <div className="flex gap-3">
                        <input
                            type="text"
                            placeholder="חיפוש מסעדה..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-primary w-64"
                        />
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-primary"
                        >
                            <option value="">כל הסטטוסים</option>
                            <option value="active">פעילות</option>
                            <option value="inactive">לא פעילות</option>
                        </select>
                    </div>
                    <button
                        onClick={() => setShowAddRestaurant(true)}
                        className="bg-brand-primary text-white px-6 py-2 rounded-lg hover:bg-brand-primary/90 font-medium transition-all"
                    >
                        ➕ הוספת מסעדה חדשה
                    </button>
                </div>

                {/* רשימת מסעדות */}
                {loading ? (
                    <div className="text-center py-8">
                        <p className="text-gray-500">טוען...</p>
                    </div>
                ) : restaurants.length === 0 ? (
                    <div className="bg-gray-50 rounded-2xl p-8 text-center">
                        <p className="text-4xl mb-4">🍽️</p>
                        <p className="text-gray-500">אין מסעדות</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {restaurants.map((restaurant) => (
                            <div key={restaurant.id} className="bg-white rounded-2xl shadow-sm p-6 hover:shadow-md transition-all">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4 flex-1">
                                        {restaurant.logo_url ? (
                                            <img
                                                src={restaurant.logo_url}
                                                alt={restaurant.name}
                                                className="w-16 h-16 rounded-lg object-cover"
                                            />
                                        ) : (
                                            <div className="w-16 h-16 rounded-lg bg-brand-primary/10 flex items-center justify-center text-2xl">
                                                🍽️
                                            </div>
                                        )}
                                        <div>
                                            <h3 className="text-xl font-bold">{restaurant.name}</h3>
                                            <p className="text-sm text-gray-500">
                                                {restaurant.tenant_id}
                                            </p>
                                            <div className="flex gap-4 mt-2 text-sm">
                                                <span className="text-gray-600">📞 {restaurant.phone}</span>
                                                <span className={`font-medium ${restaurant.is_open ? 'text-green-600' : 'text-red-600'}`}>
                                                    {restaurant.is_open ? '✅ פתוח' : '❌ סגור'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="text-right">
                                        <div className="mb-4">
                                            <p className="text-sm text-gray-500">הכנסה</p>
                                            <p className="text-2xl font-bold text-orange-600">
                                                ₪{Number(restaurant.total_revenue || 0).toFixed(0)}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {restaurant.orders_count} הזמנות
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => toggleRestaurant(restaurant.id)}
                                                className={`px-3 py-1 text-sm rounded-lg font-medium transition-all ${restaurant.is_open
                                                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                                                    }`}
                                            >
                                                {restaurant.is_open ? 'סגור' : 'פתח'}
                                            </button>
                                            <button
                                                onClick={() => deleteRestaurant(restaurant.id)}
                                                className="px-3 py-1 text-sm rounded-lg font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all"
                                            >
                                                🗑️ מחק
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Modal - הוספת מסעדה חדשה */}
                {showAddRestaurant && (
                    <AddRestaurantModal
                        onClose={() => setShowAddRestaurant(false)}
                        onSuccess={() => {
                            setShowAddRestaurant(false);
                            fetchRestaurants();
                            fetchDashboard();
                        }}
                        getAuthHeaders={getAuthHeaders}
                    />
                )}
            </div>
        </SuperAdminLayout>
    );
}

/**
 * Modal להוספת מסעדה חדשה
 */
function AddRestaurantModal({ onClose, onSuccess, getAuthHeaders }) {
    const [loading, setLoading] = useState(false);
    const [cities, setCities] = useState([]);
    const [citiesLoading, setCitiesLoading] = useState(true);
    const [formData, setFormData] = useState({
        name: '',
        tenant_id: '',
        city: '',
        phone: '',
        address: '',
        description: '',
        logo: null,
        owner_name: '',
        owner_email: '',
        owner_phone: '',
        owner_password: '',
    });

    // טען ערים בעת פתיחת המודאל
    useEffect(() => {
        const fetchCities = async () => {
            try {
                const response = await api.get('/super-admin/cities', {
                    headers: getAuthHeaders()
                });
                if (response.data.success) {
                    setCities(response.data.data);
                }
            } catch (error) {
                console.error('Failed to load cities:', error);
                toast.error('שגיאה בטעינת רשימת הערים');
            } finally {
                setCitiesLoading(false);
            }
        };
        
        fetchCities();
    }, []);

    const handleChange = (e) => {
        const { name, value, files } = e.target;
        if (name === 'logo' && files && files[0]) {
            setFormData({
                ...formData,
                logo: files[0]
            });
        } else {
            setFormData({
                ...formData,
                [name]: value
            });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // צור FormData אם יש קובץ לוגו, אחרת שלח JSON רגיל
            let payload;
            let headers = getAuthHeaders();

            if (formData.logo) {
                payload = new FormData();
                Object.keys(formData).forEach(key => {
                    if (key !== 'logo_url' && formData[key] !== null) {
                        payload.append(key, formData[key]);
                    }
                });
                headers['Content-Type'] = 'multipart/form-data';
            } else {
                payload = formData;
            }

            const response = await api.post(
                '/super-admin/restaurants',
                payload,
                { headers }
            );

            if (response.data.success) {
                toast.success('המסעדה נוצרה בהצלחה! ✅');
                toast.success(`סיסמת בעלים זמנית: ${response.data.owner.temporary_password}`);
                onSuccess();
            }
        } catch (error) {
            console.error('Restaurant creation error:', error.response?.data);
            const errors = error.response?.data?.errors || {};
            
            if (Object.keys(errors).length === 0) {
                });
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
                    <h2 className="text-2xl font-bold">הוספת מסעדה חדשה</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 text-2xl"
                    >
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* פרטי המסעדה */}
                    <div>
                        <h3 className="font-bold text-lg mb-4 text-gray-800">📍 פרטי המסעדה</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input
                                type="text"
                                name="name"
                                placeholder="שם המסעדה"
                                value={formData.name}
                                onChange={handleChange}
                                className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-primary"
                                required
                            />
                            <input
                                type="text"
                                name="tenant_id"
                                placeholder="מזהה מסעדה (restaurant-name)"
                                value={formData.tenant_id}
                                onChange={handleChange}
                                className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-primary"
                                required
                            />
                            <input
                                type="tel"
                                name="phone"
                                placeholder="טלפון"
                                value={formData.phone}
                                onChange={handleChange}
                                className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-primary"
                                required
                            />
                            <select
                                name="city"
                                value={formData.city}
                                onChange={handleChange}
                                className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-primary"
                                disabled={citiesLoading}
                            >
                                <option value="">בחר עיר</option>
                                {cities.map((city) => (
                                    <option key={city.id} value={city.name}>
                                        {city.hebrew_name}
                                    </option>
                                ))}
                            </select>
                            <label className="flex items-center justify-center w-full px-4 py-2 border border-gray-200 border-dashed rounded-lg cursor-pointer hover:border-brand-primary transition-colors">
                                <span className="text-gray-700">📁 בחר תמונה לוגו</span>
                                <input
                                    type="file"
                                    name="logo"
                                    accept="image/jpeg,image/png,image/jpg,image/gif,image/webp"
                                    onChange={handleChange}
                                    className="hidden"
                                />
                            </label>
                            {formData.logo && (
                                <p className="text-sm text-green-600">✓ קובץ נבחר: {formData.logo.name}</p>
                            )}
                            <textarea
                                name="address"
                                placeholder="כתובת"
                                value={formData.address}
                                onChange={handleChange}
                                className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-primary col-span-2"
                                rows="2"
                            />
                            <textarea
                                name="description"
                                placeholder="תיאור (אופציונלי)"
                                value={formData.description}
                                onChange={handleChange}
                                className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-primary col-span-2"
                                rows="2"
                            />
                        </div>
                    </div>

                    {/* פרטי בעל המסעדה */}
                    <div>
                        <h3 className="font-bold text-lg mb-4 text-gray-800">👤 פרטי בעל המסעדה</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input
                                type="text"
                                name="owner_name"
                                placeholder="שם בעל המסעדה"
                                value={formData.owner_name}
                                onChange={handleChange}
                                className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-primary"
                                required
                            />
                            <input
                                type="email"
                                name="owner_email"
                                placeholder="דוא״ל"
                                value={formData.owner_email}
                                onChange={handleChange}
                                className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-primary"
                                required
                            />
                            <input
                                type="tel"
                                name="owner_phone"
                                placeholder="טלפון בעל"
                                value={formData.owner_phone}
                                onChange={handleChange}
                                className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-primary"
                                required
                            />
                            <input
                                type="password"
                                name="owner_password"
                                placeholder="סיסמה (אם ריק - יוצרת אוטומטית)"
                                value={formData.owner_password}
                                onChange={handleChange}
                                className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-primary"
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4 border-t">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-all font-medium"
                        >
                            ביטול
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 transition-all font-medium disabled:opacity-50"
                        >
                            {loading ? 'יוצר...' : 'יצור מסעדה'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
