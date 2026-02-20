import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';
import SuperAdminLayout from '../../layouts/SuperAdminLayout';
import api from '../../services/apiClient';
import { resolveAssetUrl } from '../../utils/assets';
import { toast } from 'react-hot-toast';
import {
    FaMask,
    FaStore,
    FaCheckCircle,
    FaShoppingBag,
    FaCoins,
    FaBuilding,
    FaTimesCircle,
    FaUtensils,
    FaPhone,
    FaMapMarkerAlt,
    FaCheck,
    FaBan,
    FaTrash,
    FaFolderOpen,
    FaUser,
    FaTimes,
    FaPlus,
    FaSearch,
    FaFilter,
    FaEye,
    FaPowerOff,
    FaCog,
    FaUserSecret,
    FaExclamationTriangle,
    FaCreditCard,
    FaEnvelope,
    FaExternalLinkAlt,
    FaTv,
    FaTabletAlt,
    FaQrcode,
    FaCrown,
    FaClipboardList,
    FaPrint,
    FaWhatsapp
} from 'react-icons/fa';

export default function SuperAdminDashboard() {
    const { getAuthHeaders, startImpersonation } = useAdminAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [restaurants, setRestaurants] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [demoFilter, setDemoFilter] = useState('all'); // all / demo / real
    const [showAddRestaurant, setShowAddRestaurant] = useState(false);
    const [selectedRestaurant, setSelectedRestaurant] = useState(null);

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

    const approveRestaurant = async (restaurantId) => {
        try {
            const response = await api.post(
                `/super-admin/restaurants/${restaurantId}/approve`,
                {},
                { headers: getAuthHeaders() }
            );

            if (response.data.success) {
                toast.success(response.data.message || 'המסעדה אושרה');
                fetchRestaurants();
                fetchDashboard();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'שגיאה באישור המסעדה');
        }
    };

    const revokeApproval = async (restaurantId) => {
        if (!confirm('האם לבטל את אישור המסעדה? המסעדה תוסר מהרשימה הציבורית.')) return;

        try {
            const response = await api.post(
                `/super-admin/restaurants/${restaurantId}/revoke-approval`,
                {},
                { headers: getAuthHeaders() }
            );

            if (response.data.success) {
                toast.success(response.data.message || 'אישור המסעדה בוטל');
                fetchRestaurants();
                fetchDashboard();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'שגיאה בביטול אישור');
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

    const handleImpersonate = async (restaurant) => {
        try {
            const response = await api.post(
                `/super-admin/impersonate/${restaurant.id}`,
                {},
                { headers: getAuthHeaders() }
            );
            if (response.data.success) {
                const { tenant_id, restaurant_id, restaurant_name } = response.data.data;
                startImpersonation(restaurant_id, tenant_id, restaurant_name);
                toast.success(`נכנס כמסעדה: ${restaurant_name}`);
                navigate('/admin/dashboard');
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'שגיאה בכניסה כמסעדה');
        }
    };


    const StatCard = ({ label, value, subtext, icon, color }) => {
        const colorClasses = {
            blue: 'text-blue-600 bg-blue-50/50 border-blue-100',
            green: 'text-green-600 bg-green-50/50 border-green-100',
            purple: 'text-purple-600 bg-purple-50/50 border-purple-100',
            orange: 'text-orange-600 bg-orange-50/50 border-orange-100',
        };
        const iconClasses = {
            blue: 'text-blue-500 bg-blue-100',
            green: 'text-green-500 bg-green-100',
            purple: 'text-purple-500 bg-purple-100',
            orange: 'text-orange-500 bg-orange-100',
        };

        return (
            <div className={`p-3.5 rounded-xl border ${colorClasses[color]} flex items-center justify-between shadow-sm bg-white`}>
                <div className="min-w-0">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">{label}</p>
                    <div className="flex items-baseline gap-1">
                        <h3 className="text-lg font-black text-gray-800 leading-none">{value}</h3>
                    </div>
                    {subtext && <p className="text-[10px] text-gray-500 mt-1 truncate">{subtext}</p>}
                </div>
                <div className={`p-2 rounded-lg shrink-0 ${iconClasses[color]}`}>
                    {icon}
                </div>
            </div>
        );
    };

    return (
        <SuperAdminLayout>
            <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4">
                {/* Header */}
                <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                            <div className="p-2 bg-brand-primary/10 rounded-lg">
                                <FaBuilding className="text-brand-primary" size={20} />
                            </div>
                            דשבורד מנהל מערכת
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">ניהול מלא של כל המסעדות במערכת</p>
                    </div>

                    <button
                        onClick={() => setShowAddRestaurant(true)}
                        className="bg-brand-primary text-white px-5 py-2.5 rounded-xl hover:bg-brand-primary/90 font-bold transition-all shadow-lg shadow-brand-primary/20 flex items-center justify-center gap-2 text-sm"
                    >
                        <FaPlus size={14} />
                        הוספת מסעדה חדשה
                    </button>
                </div>

                {/* סטטיסטיקות */}
                {stats && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        <StatCard
                            label="סך הכל מסעדות"
                            value={stats.stats.total_restaurants}
                            subtext={stats.stats.total_restaurants > 0 ? "מסעדות רשומות" : "אין מסעדות"}
                            icon={<FaStore size={18} />}
                            color="blue"
                        />
                        <StatCard
                            label="מסעדות פעילות"
                            value={stats.restaurants_by_status.active}
                            subtext="פתוחות כרגע"
                            icon={<FaCheckCircle size={18} />}
                            color="green"
                        />
                        <StatCard
                            label="הזמנות כללי"
                            value={stats.stats.total_orders.toLocaleString()}
                            subtext="הזמנות שבוצעו"
                            icon={<FaShoppingBag size={18} />}
                            color="purple"
                        />
                        <StatCard
                            label="הכנסה כוללת"
                            value={`₪${Number(stats.stats.total_revenue || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                            subtext="מחזור עסקאות"
                            icon={<FaCoins size={18} />}
                            color="orange"
                        />
                    </div>
                )}

                {/* SaaS KPIs */}
                {stats?.saas && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        <StatCard
                            label="MRR"
                            value={`₪${Number(stats.saas.mrr || 0).toLocaleString()}`}
                            subtext="הכנסה חודשית חוזרת"
                            icon={<FaCreditCard size={18} />}
                            color="green"
                        />
                        <StatCard
                            label="תקופת ניסיון"
                            value={stats.saas.trial_restaurants || 0}
                            subtext="מסעדות בניסיון"
                            icon={<FaMask size={18} />}
                            color="orange"
                        />
                        <StatCard
                            label="מושעים"
                            value={stats.saas.suspended_restaurants || 0}
                            subtext="מסעדות מושעות"
                            icon={<FaBan size={18} />}
                            color="purple"
                        />
                        <StatCard
                            label="שגיאות מערכת"
                            value={stats.saas.system_errors_unresolved || 0}
                            subtext="שגיאות פתוחות (24 שעות)"
                            icon={<FaExclamationTriangle size={18} />}
                            color="blue"
                        />
                    </div>
                )}

                {/* חיפוש ופילטרים */}
                <div className="mb-6 space-y-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                            <FaSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="חיפוש לפי שם, מזהה או טלפון..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pr-10 pl-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-sm"
                            />
                        </div>
                        <div className="flex gap-2 shrink-0">
                            <div className="relative">
                                <FaFilter className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                                <select
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                    className="pr-8 pl-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-sm appearance-none min-w-[140px]"
                                >
                                    <option value="">כל הסטטוסים</option>
                                    <option value="active">פעילות</option>
                                    <option value="inactive">לא פעילות</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                        <button
                            onClick={() => setDemoFilter('all')}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border whitespace-nowrap ${demoFilter === 'all'
                                ? 'bg-gray-800 text-white border-gray-800'
                                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                                }`}
                        >
                            הכל ({restaurants.length})
                        </button>
                        <button
                            onClick={() => setDemoFilter('real')}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border whitespace-nowrap flex items-center gap-1.5 ${demoFilter === 'real'
                                ? 'bg-green-600 text-white border-green-600 shadow-md shadow-green-100'
                                : 'bg-white text-green-600 border-green-100 hover:bg-green-50'
                                }`}
                        >
                            <FaCheckCircle size={10} />
                            אמיתי ({restaurants.filter(r => !r.is_demo).length})
                        </button>
                        <button
                            onClick={() => setDemoFilter('demo')}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border whitespace-nowrap flex items-center gap-1.5 ${demoFilter === 'demo'
                                ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-100'
                                : 'bg-white text-amber-600 border-amber-100 hover:bg-amber-50'
                                }`}
                        >
                            <FaMask size={10} />
                            דמו ({restaurants.filter(r => r.is_demo).length})
                        </button>
                    </div>
                </div>

                {/* רשימת מסעדות */}
                {loading ? (
                    <div className="text-center py-8">
                        <p className="text-gray-500">טוען...</p>
                    </div>
                ) : restaurants.length === 0 ? (
                    <div className="bg-gray-50 rounded-2xl p-8 text-center">
                        <div className="text-4xl mb-4 text-brand-primary flex justify-center">
                            <FaUtensils />
                        </div>
                        <p className="text-gray-500">אין מסעדות</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {restaurants
                            .filter(r => {
                                if (demoFilter === 'demo') return r.is_demo;
                                if (demoFilter === 'real') return !r.is_demo;
                                return true;
                            })
                            .map((restaurant) => (
                                <div key={restaurant.id} className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-brand-primary/30 hover:shadow-xl hover:shadow-gray-200/50 transition-all group cursor-pointer" onClick={() => setSelectedRestaurant(restaurant)}>
                                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                                        <div className="flex items-center gap-5 flex-1 min-w-0">
                                            <div className="relative shrink-0">
                                                {restaurant.logo_url ? (
                                                    <img
                                                        src={resolveAssetUrl(restaurant.logo_url)}
                                                        alt={restaurant.name}
                                                        className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover ring-4 ring-gray-50 group-hover:ring-brand-primary/10 transition-all"
                                                    />
                                                ) : (
                                                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-brand-primary/5 flex items-center justify-center text-3xl text-brand-primary ring-4 ring-gray-50 transition-all">
                                                        <FaUtensils />
                                                    </div>
                                                )}
                                                <div className={`absolute -top-2 -right-2 p-1.5 rounded-lg shadow-sm border-2 border-white ${restaurant.is_approved ? 'bg-green-500' : 'bg-amber-500'}`}>
                                                    {restaurant.is_approved ? <FaCheckCircle className="text-white" size={12} /> : <FaCog className="text-white animate-spin-slow" size={12} />}
                                                </div>
                                            </div>

                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                    <h3 className="text-xl font-black text-gray-900 truncate">
                                                        {restaurant.name}
                                                    </h3>
                                                    {restaurant.is_demo && (
                                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-amber-100 text-amber-600 border border-amber-200 flex items-center gap-1">
                                                            <FaMask size={10} /> דמו
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm font-bold text-gray-400 mb-3 flex items-center gap-1">
                                                    @{restaurant.tenant_id}
                                                </p>

                                                <div className="flex flex-wrap gap-4 text-xs">
                                                    <span className="text-gray-600 flex items-center gap-1.5 font-medium">
                                                        <div className="w-5 h-5 rounded-md bg-gray-50 flex items-center justify-center">
                                                            <FaPhone className="text-gray-400" size={10} />
                                                        </div>
                                                        {restaurant.phone}
                                                    </span>
                                                    {restaurant.city && (
                                                        <span className="text-gray-600 flex items-center gap-1.5 font-medium">
                                                            <div className="w-5 h-5 rounded-md bg-gray-50 flex items-center justify-center">
                                                                <FaMapMarkerAlt className="text-gray-400" size={10} />
                                                            </div>
                                                            {restaurant.city}
                                                        </span>
                                                    )}
                                                    <span className={`inline-flex items-center gap-1.5 font-bold ${(restaurant.is_open_now ?? restaurant.is_open) ? 'text-green-600' : 'text-red-500'}`}>
                                                        <div className={`w-2 h-2 rounded-full ${(restaurant.is_open_now ?? restaurant.is_open) ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                                                        {(restaurant.is_open_now ?? restaurant.is_open) ? 'פתוח' : 'סגור'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end justify-between gap-4 py-2 border-t lg:border-t-0 lg:pr-6 lg:border-r border-gray-100">
                                            <div className="lg:text-right">
                                                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">הכנסה מצטברת</p>
                                                <div className="flex items-baseline lg:justify-end gap-1">
                                                    <span className="text-2xl font-black text-brand-primary">
                                                        ₪{Number(restaurant.total_revenue || 0).toLocaleString()}
                                                    </span>
                                                </div>
                                                <p className="text-xs font-bold text-gray-500 mt-0.5">
                                                    {restaurant.orders_count} הזמנות שבוצעו
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                                {restaurant.is_approved === false ? (
                                                    <button
                                                        onClick={() => approveRestaurant(restaurant.id)}
                                                        className="flex-1 sm:flex-none px-4 py-2 bg-green-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-green-700 transition-all shadow-md shadow-green-100"
                                                    >
                                                        <FaCheck size={12} />
                                                        אשר מסעדה
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => revokeApproval(restaurant.id)}
                                                        className="flex-1 sm:flex-none px-4 py-2 bg-white text-red-600 border border-red-100 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-red-50 transition-all"
                                                    >
                                                        <FaBan size={12} />
                                                        בטל אישור
                                                    </button>
                                                )}

                                                <button
                                                    onClick={() => handleImpersonate(restaurant)}
                                                    title="כניסה כמסעדה"
                                                    className="p-2.5 bg-purple-50 text-purple-600 border border-purple-100 rounded-xl hover:bg-purple-600 hover:text-white transition-all"
                                                >
                                                    <FaUserSecret size={16} />
                                                </button>

                                                <button
                                                    onClick={() => toggleRestaurant(restaurant.id)}
                                                    title={(restaurant.is_open_now ?? restaurant.is_open) ? 'סגור מסעדה' : 'פתח מסעדה'}
                                                    className={`p-2.5 rounded-xl transition-all border ${(restaurant.is_open_now ?? restaurant.is_open)
                                                        ? 'bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-100'
                                                        : 'bg-green-50 text-green-600 border-green-100 hover:bg-green-100'
                                                        }`}
                                                >
                                                    <FaPowerOff size={16} />
                                                </button>

                                                <button
                                                    onClick={() => deleteRestaurant(restaurant.id)}
                                                    title="מחק מסעדה"
                                                    className="p-2.5 bg-red-50 text-red-600 border border-red-100 rounded-xl hover:bg-red-600 hover:text-white transition-all"
                                                >
                                                    <FaTrash size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                    </div>
                )}

                {/* Modal - פרטי מסעדה */}
                {selectedRestaurant && (
                    <RestaurantDetailModal
                        restaurant={selectedRestaurant}
                        onClose={() => setSelectedRestaurant(null)}
                        onImpersonate={handleImpersonate}
                        navigate={navigate}
                    />
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
        is_demo: true, // דמו כברירת מחדל
        owner_name: '',
        owner_email: '',
        owner_phone: '',
        owner_password: '',
    });

    // טען ערים בעת פתיחת המודאל
    useEffect(() => {
        const fetchCities = async () => {
            try {
                const response = await api.get('/cities');
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
                toast.success('המסעדה נוצרה בהצלחה!');
                toast.success(`סיסמת בעלים זמנית: ${response.data.owner.temporary_password}`);
                onSuccess();
            }
        } catch (error) {
            console.error('Restaurant creation error:', error.response?.data);
            const errors = error.response?.data?.errors || {};

            if (Object.keys(errors).length === 0) {
                toast.error(error.response?.data?.message || 'שגיאה לא ידועה');
            } else {
                Object.entries(errors).forEach(([field, messages]) => {
                    const message = Array.isArray(messages) ? messages[0] : messages;
                    toast.error(`${field}: ${message}`);
                });
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-white/20">
                <div className="bg-white px-6 py-5 border-b border-gray-100 flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-xl font-black text-gray-900">הוספת מסעדה חדשה</h2>
                        <p className="text-xs text-gray-500 font-bold mt-0.5 uppercase tracking-wider">יצירת ישות מסחרית חדשה במערכת</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-gray-600 transition-all"
                    >
                        <FaTimes size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-8 custom-scrollbar">
                    {/* פרטי המסעדה */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-gray-50">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                                <FaStore className="text-blue-500" size={14} />
                            </div>
                            <h3 className="font-black text-gray-900">פרטי המסעדה</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-500 mr-1">שם המסעדה</label>
                                <input
                                    type="text"
                                    name="name"
                                    placeholder="למשל: פיצה פאלאס"
                                    value={formData.name}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-sm font-medium"
                                    required
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-500 mr-1">מזהה (URL)</label>
                                <input
                                    type="text"
                                    name="tenant_id"
                                    placeholder="pizza-palace"
                                    value={formData.tenant_id}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-sm font-mono text-gray-600"
                                    required
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-500 mr-1">טלפון ליצירת קשר</label>
                                <input
                                    type="tel"
                                    name="phone"
                                    placeholder="05X-XXXXXXX"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-sm font-medium"
                                    required
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-500 mr-1">עיר פעילות</label>
                                <select
                                    name="city"
                                    value={formData.city}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-sm font-medium appearance-none"
                                    disabled={citiesLoading}
                                >
                                    <option value="">בחר עיר...</option>
                                    {cities.map((city) => (
                                        <option key={city.id} value={city.hebrew_name}>
                                            {city.hebrew_name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="md:col-span-2">
                                <label className="text-xs font-bold text-gray-500 mr-1 mb-1.5 block">לוגו המסעדה</label>
                                <label className="flex items-center justify-between w-full px-4 py-3 bg-brand-primary/5 border-2 border-dashed border-brand-primary/20 rounded-2xl cursor-pointer hover:bg-brand-primary/10 transition-all group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                                            <FaFolderOpen className="text-brand-primary" size={18} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-brand-primary">לחץ להעלאת לוגו</p>
                                            <p className="text-[10px] text-gray-500 font-bold uppercase">PNG, JPG up to 2MB</p>
                                        </div>
                                    </div>
                                    {formData.logo && (
                                        <span className="text-xs font-bold text-green-600 bg-green-50 px-3 py-1 rounded-lg border border-green-100">
                                            {formData.logo.name}
                                        </span>
                                    )}
                                    <input
                                        type="file"
                                        name="logo"
                                        accept="image/jpeg,image/png,image/jpg"
                                        onChange={handleChange}
                                        className="hidden"
                                    />
                                </label>
                            </div>

                            <div className="md:col-span-2 space-y-1.5">
                                <label className="text-xs font-bold text-gray-500 mr-1">כתובת מלאה</label>
                                <textarea
                                    name="address"
                                    placeholder="רחוב, מספר, בניין..."
                                    value={formData.address}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-sm font-medium resize-none"
                                    rows="2"
                                />
                            </div>

                            <div className="md:col-span-2 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                                <label className="flex items-start gap-4 cursor-pointer">
                                    <div className="relative flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={formData.is_demo}
                                            onChange={(e) => setFormData({ ...formData, is_demo: e.target.checked })}
                                            className="w-5 h-5 rounded-lg border-amber-200 text-amber-500 focus:ring-amber-500 transition-all cursor-pointer"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <span className="font-black text-amber-900 text-sm flex items-center gap-2">
                                            <FaMask size={14} /> פתח כמסעדת דמו
                                        </span>
                                        <p className="text-xs text-amber-700/70 font-bold mt-1 leading-relaxed">מסעדות דמו משמשות לבדיקות פנימיות ואינן מופיעות ללקוחות קצה. ניתן לשנות זאת בכל עת.</p>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* פרטי בעל המסעדה */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-gray-50">
                            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                                <FaUser className="text-purple-500" size={14} />
                            </div>
                            <h3 className="font-black text-gray-900">פרטי חשבון בעלים</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-500 mr-1">שם מלא</label>
                                <input
                                    type="text"
                                    name="owner_name"
                                    placeholder="שם בעל המסעדה"
                                    value={formData.owner_name}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-sm font-medium"
                                    required
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-500 mr-1">כתובת אימייל</label>
                                <input
                                    type="email"
                                    name="owner_email"
                                    placeholder="owner@example.com"
                                    value={formData.owner_email}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-sm font-medium"
                                    required
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-500 mr-1">טלפון נייד</label>
                                <input
                                    type="tel"
                                    name="owner_phone"
                                    placeholder="05X-XXXXXXX"
                                    value={formData.owner_phone}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-sm font-medium"
                                    required
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-500 mr-1">סיסמה זמנית</label>
                                <input
                                    type="password"
                                    name="owner_password"
                                    placeholder="השאר ריק ליצירה אוטומטית"
                                    value={formData.owner_password}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-sm font-medium"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4 pt-6 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-6 py-3 border border-gray-200 text-gray-600 rounded-2xl hover:bg-gray-50 transition-all font-black text-sm uppercase tracking-wider"
                        >
                            ביטול
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-6 py-3 bg-brand-primary text-white rounded-2xl hover:bg-brand-primary/95 transition-all font-black text-sm uppercase tracking-wider shadow-lg shadow-brand-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    מעבד...
                                </>
                            ) : (
                                <>
                                    <FaPlus size={12} />
                                    יצור מסעדה
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

const STATUS_LABELS = { trial: 'תקופת ניסיון', active: 'פעיל', suspended: 'מושהה', expired: 'פג תוקף', cancelled: 'מבוטל' };
const STATUS_COLORS = { trial: 'bg-blue-100 text-blue-700', active: 'bg-green-100 text-green-700', suspended: 'bg-red-100 text-red-700', expired: 'bg-gray-100 text-gray-600', cancelled: 'bg-gray-100 text-gray-600' };

function RestaurantDetailModal({ restaurant: initialRestaurant, onClose, onImpersonate, navigate }) {
    const { getAuthHeaders } = useAdminAuth();
    const [restaurant, setRestaurant] = useState(initialRestaurant);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const res = await api.get(`/super-admin/restaurants/${initialRestaurant.id}`, {
                    headers: getAuthHeaders(),
                });
                if (res.data.success) setRestaurant(res.data.restaurant);
            } catch (err) {
                console.error('Failed to fetch restaurant details:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchDetails();
    }, [initialRestaurant.id]);

    const publicUrl = `/${restaurant.tenant_id}`;

    return (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-white/20" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="bg-white px-6 py-5 border-b border-gray-100 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-4">
                        {restaurant.logo_url ? (
                            <img src={resolveAssetUrl(restaurant.logo_url)} alt={restaurant.name} className="w-14 h-14 rounded-2xl object-cover ring-4 ring-gray-50" />
                        ) : (
                            <div className="w-14 h-14 rounded-2xl bg-brand-primary/5 flex items-center justify-center text-2xl text-brand-primary ring-4 ring-gray-50">
                                <FaUtensils />
                            </div>
                        )}
                        <div>
                            <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
                                {restaurant.name}
                                {restaurant.is_demo && (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-amber-100 text-amber-600 border border-amber-200">דמו</span>
                                )}
                            </h2>
                            <p className="text-sm text-gray-400 font-bold">@{restaurant.tenant_id}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-gray-600 transition-all">
                        <FaTimes size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <div className="w-6 h-6 border-2 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin" />
                        </div>
                    ) : (
                        <>
                            {/* איש קשר בעלים */}
                            {restaurant.owner_info && (
                                <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                                    <h3 className="text-sm font-black text-gray-900 mb-3 flex items-center gap-2">
                                        <FaUser className="text-brand-primary" size={14} />
                                        בעל המסעדה
                                    </h3>
                                    <div className="flex flex-wrap items-center gap-2 mb-3">
                                        <span className="font-bold text-gray-700">{restaurant.owner_info.name}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {restaurant.owner_info.phone && (() => {
                                            const p = restaurant.owner_info.phone.replace(/\D/g, '').replace(/^0/, '').replace(/^972/, '');
                                            return (
                                                <>
                                                    <a href={`https://wa.me/972${p}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-2 bg-green-500 text-white rounded-xl text-sm font-bold hover:bg-green-600 transition-colors">
                                                        <FaWhatsapp size={16} />
                                                        וואטסאפ
                                                    </a>
                                                    <a href={`tel:+972${p}`} className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors">
                                                        <FaPhone size={14} />
                                                        שיחה
                                                    </a>
                                                </>
                                            );
                                        })()}
                                        {restaurant.owner_info.email && (
                                            <a href={`mailto:${restaurant.owner_info.email}`} className="inline-flex items-center gap-2 px-3 py-2 bg-gray-600 text-white rounded-xl text-sm font-bold hover:bg-gray-700 transition-colors">
                                                <FaEnvelope size={14} />
                                                מייל
                                            </a>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* פרטי מסעדה */}
                            <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                                <h3 className="text-sm font-black text-gray-900 mb-3 flex items-center gap-2">
                                    <FaStore className="text-brand-primary" size={14} />
                                    פרטי מסעדה
                                </h3>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <span className="text-xs text-gray-400 font-bold">טלפון</span>
                                        <p className="font-bold text-gray-700">{restaurant.phone || '—'}</p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-gray-400 font-bold">עיר</span>
                                        <p className="font-bold text-gray-700">{restaurant.city || '—'}</p>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="text-xs text-gray-400 font-bold">כתובת</span>
                                        <p className="font-bold text-gray-700">{restaurant.address || '—'}</p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-gray-400 font-bold">סטטוס</span>
                                        <p className="mt-0.5">
                                            <span className={`inline-flex items-center gap-1.5 font-bold text-xs ${(restaurant.is_open_now ?? restaurant.is_open) ? 'text-green-600' : 'text-red-500'}`}>
                                                <div className={`w-2 h-2 rounded-full ${(restaurant.is_open_now ?? restaurant.is_open) ? 'bg-green-500' : 'bg-red-500'}`} />
                                                {(restaurant.is_open_now ?? restaurant.is_open) ? 'פתוח' : 'סגור'}
                                            </span>
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-gray-400 font-bold">אישור</span>
                                        <p className="mt-0.5">
                                            <span className={`inline-flex items-center gap-1.5 font-bold text-xs ${restaurant.is_approved ? 'text-green-600' : 'text-amber-600'}`}>
                                                {restaurant.is_approved ? <FaCheckCircle size={10} /> : <FaCog size={10} />}
                                                {restaurant.is_approved ? 'מאושר' : 'ממתין לאישור'}
                                            </span>
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* מנוי */}
                            <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                                <h3 className="text-sm font-black text-gray-900 mb-3 flex items-center gap-2">
                                    <FaCreditCard className="text-brand-primary" size={14} />
                                    מנוי
                                </h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                                    <div>
                                        <span className="text-xs text-gray-400 font-bold">סטטוס מנוי</span>
                                        <p className="mt-0.5">
                                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-black ${STATUS_COLORS[restaurant.subscription_status] || 'bg-gray-100 text-gray-600'}`}>
                                                {STATUS_LABELS[restaurant.subscription_status] || restaurant.subscription_status}
                                            </span>
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-gray-400 font-bold">תוכנית</span>
                                        <p className="font-bold text-gray-700 flex items-center gap-1.5 mt-0.5">
                                            <FaCrown className={restaurant.tier === 'pro' ? 'text-amber-500' : 'text-gray-400'} size={12} />
                                            {restaurant.tier === 'pro' ? 'Pro' : 'Basic'}
                                        </p>
                                    </div>
                                    {restaurant.monthly_price && (
                                        <div>
                                            <span className="text-xs text-gray-400 font-bold">מחיר חודשי</span>
                                            <p className="font-bold text-gray-700">₪{restaurant.monthly_price}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* סטטיסטיקות */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="bg-blue-50 rounded-xl p-3 border border-blue-100 text-center">
                                    <p className="text-lg font-black text-blue-700">{restaurant.orders_count ?? 0}</p>
                                    <p className="text-[10px] font-bold text-blue-500 mt-0.5">הזמנות</p>
                                </div>
                                <div className="bg-green-50 rounded-xl p-3 border border-green-100 text-center">
                                    <p className="text-lg font-black text-green-700">₪{Number(restaurant.total_revenue || 0).toLocaleString()}</p>
                                    <p className="text-[10px] font-bold text-green-500 mt-0.5">הכנסה</p>
                                </div>
                                <div className="bg-purple-50 rounded-xl p-3 border border-purple-100 text-center">
                                    <p className="text-lg font-black text-purple-700">{restaurant.menu_items_count ?? 0}</p>
                                    <p className="text-[10px] font-bold text-purple-500 mt-0.5">פריטי תפריט</p>
                                </div>
                                <div className="bg-orange-50 rounded-xl p-3 border border-orange-100 text-center">
                                    <p className="text-lg font-black text-orange-700">{restaurant.categories_count ?? 0}</p>
                                    <p className="text-[10px] font-bold text-orange-500 mt-0.5">קטגוריות</p>
                                </div>
                            </div>

                            {/* פיצ'רים פעילים */}
                            <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                                <h3 className="text-sm font-black text-gray-900 mb-3 flex items-center gap-2">
                                    <FaCog className="text-brand-primary" size={14} />
                                    פיצ'רים פעילים
                                </h3>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <FeatureBadge
                                        icon={<FaTabletAlt size={16} />}
                                        label="קיוסקים"
                                        count={restaurant.kiosks_count ?? 0}
                                        activeCount={restaurant.active_kiosks_count ?? 0}
                                        color="indigo"
                                    />
                                    <FeatureBadge
                                        icon={<FaTv size={16} />}
                                        label="מסכי תצוגה"
                                        count={restaurant.display_screens_count ?? 0}
                                        activeCount={restaurant.active_screens_count ?? 0}
                                        color="teal"
                                    />
                                    <FeatureBadge
                                        icon={<FaShoppingBag size={16} />}
                                        label="משלוחים"
                                        active={restaurant.has_delivery}
                                        color="emerald"
                                    />
                                    <FeatureBadge
                                        icon={<FaStore size={16} />}
                                        label="איסוף עצמי"
                                        active={restaurant.has_pickup}
                                        color="amber"
                                    />
                                </div>
                            </div>

                            {/* הפניות מהירות */}
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => window.open(publicUrl, '_blank')}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-brand-primary text-white rounded-xl text-sm font-bold hover:opacity-90 transition-all"
                                >
                                    <FaExternalLinkAlt size={12} />
                                    צפה בתפריט
                                </button>
                                <button
                                    onClick={() => { onClose(); onImpersonate(restaurant); }}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-bold hover:bg-purple-700 transition-all"
                                >
                                    <FaUserSecret size={12} />
                                    כניסה כמסעדה
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function FeatureBadge({ icon, label, count, activeCount, active, color }) {
    const hasCount = count !== undefined;
    const isActive = hasCount ? count > 0 : active;

    const colorMap = {
        indigo: { bg: 'bg-indigo-50', border: 'border-indigo-100', text: 'text-indigo-600', icon: 'text-indigo-400' },
        teal: { bg: 'bg-teal-50', border: 'border-teal-100', text: 'text-teal-600', icon: 'text-teal-400' },
        emerald: { bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-600', icon: 'text-emerald-400' },
        amber: { bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-600', icon: 'text-amber-400' },
    };
    const c = colorMap[color] || colorMap.indigo;

    return (
        <div className={`${c.bg} rounded-xl p-3 border ${c.border} text-center`}>
            <div className={`${isActive ? c.text : 'text-gray-300'} flex justify-center mb-1.5`}>{icon}</div>
            <p className={`text-[10px] font-bold ${isActive ? c.text : 'text-gray-400'}`}>{label}</p>
            {hasCount ? (
                <p className="text-xs font-black text-gray-700 mt-0.5">{activeCount ?? 0}/{count}</p>
            ) : (
                <p className={`text-xs font-black mt-0.5 ${isActive ? 'text-green-600' : 'text-gray-400'}`}>{isActive ? 'פעיל' : 'כבוי'}</p>
            )}
        </div>
    );
}
