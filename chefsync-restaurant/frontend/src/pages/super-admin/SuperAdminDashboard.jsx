import { useState, useEffect, useMemo, useCallback } from 'react';
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
    FaWallet,
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
    FaEyeSlash,
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
    FaCloudDownloadAlt,
    FaClipboardList,
    FaPrint,
    FaWhatsapp,
    FaToggleOn,
    FaToggleOff,
    FaSpinner,
    FaChevronDown,
    FaStar,
    FaUserTimes,
    FaSignOutAlt,
    FaCommentDots,
    FaChartLine,
    FaFunnelDollar,
    FaCalendarDay,
    FaSync,
    FaPaperPlane,
} from 'react-icons/fa';
import { TIER_LABELS } from '../../utils/tierUtils';

const OPEN_ORDER_STATUS_LABELS = {
    awaiting_payment: 'ממתין לתשלום',
    pending: 'ממתין',
    received: 'התקבל',
    preparing: 'בהכנה',
    ready: 'מוכן',
    delivering: 'במשלוח',
};

const OPEN_ORDER_STATUS_STYLES = {
    awaiting_payment: 'bg-orange-50 text-orange-700 border-orange-200',
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    received: 'bg-amber-50 text-amber-700 border-amber-200',
    preparing: 'bg-blue-50 text-blue-700 border-blue-200',
    ready: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    delivering: 'bg-purple-50 text-purple-700 border-purple-200',
};

export default function SuperAdminDashboard() {
    const { getAuthHeaders, startImpersonation } = useAdminAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [restaurants, setRestaurants] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('active');
    const [demoFilter, setDemoFilter] = useState('real'); // all / demo / real
    const [showAddRestaurant, setShowAddRestaurant] = useState(false);
    const [selectedRestaurant, setSelectedRestaurant] = useState(null);
    const [showPendingCitiesModal, setShowPendingCitiesModal] = useState(false);
    const [pendingCities, setPendingCities] = useState([]);
    const [pendingCitiesLoading, setPendingCitiesLoading] = useState(false);
    const [approvedCities, setApprovedCities] = useState([]);
    const [churnRequests, setChurnRequests] = useState([]);
    const [showChurnPanel, setShowChurnPanel] = useState(false);
    const [churnActionId, setChurnActionId] = useState(null);

    // Open orders (incomplete, last 7 days)
    const [openOrders, setOpenOrders] = useState([]);
    const [openOrdersMeta, setOpenOrdersMeta] = useState(null);
    const [loadingOpenOrders, setLoadingOpenOrders] = useState(false);
    const [nudgingOrderId, setNudgingOrderId] = useState(null);
    const [showOpenOrdersPanel, setShowOpenOrdersPanel] = useState(false);

    useEffect(() => {
        fetchDashboard();
        fetchRestaurants();
        fetchChurnRequests();
        loadOpenOrders();
    }, [filterStatus, searchTerm]);

    const loadOpenOrders = async () => {
        setLoadingOpenOrders(true);
        try {
            const res = await api.get('/super-admin/order-events/open-orders', {
                params: { days: 7 },
                headers: getAuthHeaders(),
            });
            if (res.data?.success) {
                setOpenOrders(res.data.data?.orders || []);
                setOpenOrdersMeta(res.data.data || null);
            }
        } catch (error) {
            console.error('Failed to load open orders:', error);
        } finally {
            setLoadingOpenOrders(false);
        }
    };

    const openOrdersByDate = useMemo(() => {
        const groups = {};
        openOrders.forEach((order) => {
            const dateKey = new Date(order.created_at).toLocaleDateString('en-CA');
            if (!groups[dateKey]) groups[dateKey] = [];
            groups[dateKey].push(order);
        });
        return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
    }, [openOrders]);

    const unhandledOpenCount = useMemo(
        () => openOrders.filter((order) => !order.restaurant_handled).length,
        [openOrders],
    );

    const openOrderTimeline = (orderId) => {
        navigate(`/super-admin/order-debug?order_id=${orderId}`);
    };

    const getOpenOrderDateLabel = (dateKey) => {
        const today = new Date();
        const todayKey = today.toLocaleDateString('en-CA');
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayKey = yesterday.toLocaleDateString('en-CA');

        if (dateKey === todayKey) return 'היום';
        if (dateKey === yesterdayKey) return 'אתמול';

        const [year, month, day] = dateKey.split('-');
        return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString('he-IL', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
        });
    };

    const handleNudgeOwner = async (order) => {
        const confirmMsg = order.restaurant_handled
            ? `לשלוח תזכורת לסיום טיפול בהזמנה #${order.id} למסעדה "${order.restaurant_name || order.tenant_id}"?`
            : `לשלוח פוש למסעדן עם פרטי הזמנה #${order.id}?`;

        if (!window.confirm(confirmMsg)) return;

        setNudgingOrderId(order.id);
        try {
            const res = await api.post(
                `/super-admin/order-events/${order.id}/nudge-owner`,
                {},
                { headers: getAuthHeaders() },
            );
            if (res.data?.success) {
                toast.success(res.data.message || 'ההתראה נשלחה');
                await loadOpenOrders();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'שגיאה בשליחת ההתראה');
        } finally {
            setNudgingOrderId(null);
        }
    };

    const formatOpenOrderTime = (dateStr) => new Date(dateStr).toLocaleTimeString('he-IL', {
        hour: '2-digit',
        minute: '2-digit',
    });

    const formatOpenOrderDateTime = (dateStr) => new Date(dateStr).toLocaleString('he-IL', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });

    const fetchChurnRequests = async () => {
        try {
            const response = await api.get('/super-admin/billing/cancellation-requests', {
                headers: getAuthHeaders(),
            });
            if (response.data?.success) {
                setChurnRequests(response.data.data || []);
            }
        } catch (error) {
            console.error('Failed to fetch churn requests:', error);
        }
    };

    const handleApproveChurn = async (item, e) => {
        e?.stopPropagation?.();
        if (!window.confirm(`לאשר סיום התקשרות עבור "${item.name}"?\nהמנוי יבוטל, האישור יוסר והמסעדה תיסגר ללקוחות.`)) {
            return;
        }
        setChurnActionId(item.id);
        try {
            const res = await api.post(
                `/super-admin/billing/restaurants/${item.id}/cancellation/approve`,
                {},
                { headers: getAuthHeaders() },
            );
            if (res.data?.success) {
                toast.success(res.data.message || 'המנוי בוטל');
                await Promise.all([fetchChurnRequests(), fetchRestaurants(), fetchDashboard()]);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'שגיאה באישור');
        } finally {
            setChurnActionId(null);
        }
    };

    const handleDismissChurn = async (item, e) => {
        e?.stopPropagation?.();
        const note = window.prompt(`לסגור את הבקשה של "${item.name}" ללא ביטול מנוי?\nהערה (אופציונלי):`);
        if (note === null) return;

        setChurnActionId(item.id);
        try {
            const res = await api.post(
                `/super-admin/billing/restaurants/${item.id}/cancellation/dismiss`,
                { note: note || undefined },
                { headers: getAuthHeaders() },
            );
            if (res.data?.success) {
                toast.success(res.data.message || 'הבקשה נסגרה');
                await Promise.all([fetchChurnRequests(), fetchDashboard()]);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'שגיאה בסגירה');
        } finally {
            setChurnActionId(null);
        }
    };

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

    const fetchPendingCities = async () => {
        try {
            setPendingCitiesLoading(true);
            const response = await api.get('/super-admin/cities/pending', {
                headers: getAuthHeaders(),
            });
            if (response.data?.success) {
                setPendingCities(response.data.data || []);
            }
        } catch (error) {
            console.error('Failed to fetch pending cities:', error);
            toast.error('שגיאה בטעינת ערים ממתינות');
        } finally {
            setPendingCitiesLoading(false);
        }
    };

    const fetchApprovedCities = async () => {
        try {
            const response = await api.get('/cities');
            if (response.data?.success) {
                setApprovedCities(response.data.data || []);
            }
        } catch (error) {
            console.error('Failed to fetch approved cities:', error);
        }
    };

    const openPendingCitiesModal = async () => {
        setShowPendingCitiesModal(true);
        await Promise.all([fetchPendingCities(), fetchApprovedCities()]);
    };

    const handleApprovePendingCity = async (cityId, payload = {}) => {
        try {
            const response = await api.patch(
                `/super-admin/cities/${cityId}/approve`,
                payload,
                { headers: getAuthHeaders() }
            );
            if (response.data?.success) {
                toast.success(response.data.message || 'העיר אושרה');
                await Promise.all([fetchPendingCities(), fetchApprovedCities()]);
            }
        } catch (error) {
            console.error('Approve city failed:', error);
            toast.error(error.response?.data?.message || 'שגיאה באישור עיר');
        }
    };

    const handleRejectPendingCity = async (cityId, reviewNote = '') => {
        try {
            const response = await api.patch(
                `/super-admin/cities/${cityId}/reject`,
                { review_note: reviewNote || null },
                { headers: getAuthHeaders() }
            );
            if (response.data?.success) {
                toast.success(response.data.message || 'העיר נדחתה');
                await fetchPendingCities();
            }
        } catch (error) {
            console.error('Reject city failed:', error);
            toast.error(error.response?.data?.message || 'שגיאה בדחיית עיר');
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
        } catch {
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


    const StatCard = ({ label, value, subtext, icon, color, alert, onClick }) => {
        const colorClasses = {
            blue: 'text-blue-600 bg-blue-50/50 border-blue-100',
            green: 'text-green-600 bg-green-50/50 border-green-100',
            purple: 'text-purple-600 bg-purple-50/50 border-purple-100',
            orange: 'text-orange-600 bg-orange-50/50 border-orange-100',
            red: 'text-red-600 bg-red-50/50 border-red-100',
            amber: 'text-amber-700 bg-amber-50/50 border-amber-200',
        };
        const iconClasses = {
            blue: 'text-blue-500 bg-blue-100',
            green: 'text-green-500 bg-green-100',
            purple: 'text-purple-500 bg-purple-100',
            orange: 'text-orange-500 bg-orange-100',
            red: 'text-red-500 bg-red-100',
            amber: 'text-amber-600 bg-amber-100',
        };

        const Tag = onClick ? 'button' : 'div';

        return (
            <Tag
                type={onClick ? 'button' : undefined}
                onClick={onClick}
                className={`p-3 sm:p-3.5 rounded-xl border text-right w-full transition-all ${colorClasses[color] || colorClasses.blue} flex items-center justify-between gap-2 shadow-sm bg-white min-w-0 ${
                    alert ? 'animate-pulse ring-2 ring-offset-1 ring-red-400 border-red-300' : ''
                } ${onClick ? 'cursor-pointer hover:shadow-md hover:scale-[1.01] active:scale-[0.99]' : ''}`}
            >
                <div className="min-w-0 flex-1">
                    <p className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5 leading-tight">{label}</p>
                    <div className="flex items-baseline gap-1 min-w-0">
                        <h3 className="text-base sm:text-lg font-black text-gray-800 leading-tight break-words">{value}</h3>
                    </div>
                    {subtext && <p className="text-[9px] sm:text-[10px] text-gray-500 mt-1 line-clamp-2">{subtext}</p>}
                </div>
                <div className={`p-1.5 sm:p-2 rounded-lg shrink-0 relative ${iconClasses[color] || iconClasses.blue}`}>
                    <span className="[&>svg]:w-4 [&>svg]:h-4 sm:[&>svg]:w-[18px] sm:[&>svg]:h-[18px]">{icon}</span>
                    {alert && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-white" />
                    )}
                </div>
            </Tag>
        );
    };

    return (
        <SuperAdminLayout>
            <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 pb-24 md:pb-4">
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
                        type="button"
                        onClick={() => setShowAddRestaurant(true)}
                        className="hidden md:inline-flex bg-brand-primary text-white px-5 py-2.5 rounded-xl hover:bg-brand-primary/90 font-bold transition-all shadow-lg shadow-brand-primary/20 items-center justify-center gap-2 text-sm"
                    >
                        <FaPlus size={14} />
                        הוספת מסעדה חדשה
                    </button>
                </div>

                {/* בקשות סיום התקשרות — באנר מהבהב + פאנל מתרחב */}
                {churnRequests.length > 0 && (
                    <div className="mb-6">
                        <button
                            type="button"
                            onClick={() => setShowChurnPanel((v) => !v)}
                            className={`w-full text-right rounded-2xl border-2 transition-all overflow-hidden ${
                                showChurnPanel
                                    ? 'border-amber-400 bg-amber-50 shadow-lg shadow-amber-100'
                                    : 'border-amber-300 bg-gradient-to-l from-amber-50 to-orange-50 hover:border-amber-400 animate-pulse'
                            }`}
                        >
                            <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="relative shrink-0">
                                        <div className="p-2.5 rounded-xl bg-amber-500 text-white">
                                            <FaUserTimes size={18} />
                                        </div>
                                        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-black flex items-center justify-center ring-2 ring-white">
                                            {churnRequests.length}
                                        </span>
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-black text-amber-900 text-sm sm:text-base">
                                            {churnRequests.length === 1
                                                ? 'בקשת סיום התקשרות ממתינה'
                                                : `${churnRequests.length} בקשות סיום התקשרות ממתינות`}
                                        </p>
                                        <p className="text-xs text-amber-700/80 font-bold mt-0.5">
                                            {showChurnPanel ? 'לחץ לסגירה' : 'לחץ לצפייה וטיפול'}
                                        </p>
                                    </div>
                                </div>
                                <FaChevronDown
                                    className={`text-amber-600 shrink-0 transition-transform ${showChurnPanel ? 'rotate-180' : ''}`}
                                />
                            </div>
                        </button>

                        {showChurnPanel && (
                            <div className="mt-3 space-y-3">
                                {churnRequests.map((item) => (
                                    <div
                                        key={item.id}
                                        className="bg-white rounded-2xl border border-amber-200 shadow-sm p-4 sm:p-5 space-y-3"
                                    >
                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                            <div>
                                                <h3 className="font-black text-gray-900">{item.name}</h3>
                                                <p className="text-xs text-gray-400 font-bold">
                                                    @{item.tenant_id} · {TIER_LABELS[item.tier] || item.tier}
                                                </p>
                                            </div>
                                            <span className="text-[10px] font-black bg-amber-100 text-amber-800 px-2 py-1 rounded-lg">
                                                {item.requested_at
                                                    ? new Date(item.requested_at).toLocaleString('he-IL')
                                                    : '—'}
                                            </span>
                                        </div>
                                        <div className="grid sm:grid-cols-2 gap-2 text-sm">
                                            <div className="bg-gray-50 rounded-xl px-3 py-2">
                                                <span className="text-gray-400 text-[10px] font-bold block">סיבה</span>
                                                <span className="font-bold text-gray-800">{item.reason_label || '—'}</span>
                                            </div>
                                            <div className="bg-gray-50 rounded-xl px-3 py-2">
                                                <span className="text-gray-400 text-[10px] font-bold block">תאריך מבוקש</span>
                                                <span className="font-bold text-gray-800">
                                                    {item.effective_date
                                                        ? new Date(item.effective_date).toLocaleDateString('he-IL')
                                                        : 'לא צוין'}
                                                </span>
                                            </div>
                                        </div>
                                        {item.note && (
                                            <p className="text-sm text-amber-900 bg-amber-50 rounded-xl px-3 py-2 border border-amber-100">
                                                {item.note}
                                            </p>
                                        )}
                                        <div className="flex flex-wrap gap-3 text-xs font-bold text-gray-600">
                                            {item.owner_name && <span>{item.owner_name}</span>}
                                            {item.owner_email && (
                                                <a href={`mailto:${item.owner_email}`} className="text-brand-primary hover:underline flex items-center gap-1">
                                                    <FaEnvelope size={10} /> {item.owner_email}
                                                </a>
                                            )}
                                            {item.owner_phone && (
                                                <a href={`tel:${item.owner_phone}`} className="text-brand-primary hover:underline flex items-center gap-1">
                                                    <FaPhone size={10} /> {item.owner_phone}
                                                </a>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                                            <button
                                                type="button"
                                                disabled={churnActionId === item.id}
                                                onClick={(e) => handleApproveChurn(item, e)}
                                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-600 text-white text-xs font-black hover:bg-red-700 disabled:opacity-50"
                                            >
                                                {churnActionId === item.id ? <FaSpinner className="animate-spin" /> : <FaCheck />}
                                                אשר ביטול מנוי
                                            </button>
                                            <button
                                                type="button"
                                                disabled={churnActionId === item.id}
                                                onClick={(e) => handleDismissChurn(item, e)}
                                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 text-gray-700 text-xs font-black hover:bg-gray-200 disabled:opacity-50"
                                            >
                                                <FaTimes /> סגור ללא ביטול
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const r = restaurants.find((x) => x.id === item.id);
                                                    if (r) setSelectedRestaurant(r);
                                                }}
                                                className="px-3 py-2 text-xs font-bold text-gray-500 hover:text-gray-900"
                                            >
                                                פרטי מסעדה
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {stats && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
                        <StatCard
                            label="מסעדות פעילות"
                            value={stats.restaurants_by_status.active}
                            subtext="מאושרות + מנוי פעיל"
                            icon={<FaCheckCircle size={18} />}
                            color="green"
                        />
                        <StatCard
                            label="הזמנות היום"
                            value={(stats.stats.orders_today || 0).toLocaleString()}
                            subtext="הזמנות שבוצעו היום"
                            icon={<FaShoppingBag size={18} />}
                            color="purple"
                        />
                        <StatCard
                            label="הכנסה היום"
                            value={`₪${Number(stats.stats.revenue_today_real || stats.stats.revenue_today || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                            subtext="מסעדות אמיתיות"
                            icon={<FaWallet size={18} />}
                            color="green"
                        />
                        <StatCard
                            label="MRR"
                            value={`₪${Number(stats.saas?.mrr || 0).toLocaleString()}`}
                            subtext="הכנסה חודשית חוזרת"
                            icon={<FaCreditCard size={18} />}
                            color="blue"
                        />
                        <StatCard
                            label="משוב משתמשים"
                            value={stats.saas?.feedback_new || 0}
                            subtext={(stats.saas?.feedback_new || 0) > 0 ? 'משובים חדשים — לחץ לטיפול' : 'אין משובים חדשים'}
                            icon={<FaCommentDots size={18} />}
                            color="amber"
                            alert={(stats.saas?.feedback_new || 0) > 0}
                            onClick={() => navigate('/super-admin/feedback?status=new')}
                        />
                        <StatCard
                            label="שגיאות מערכת"
                            value={stats.saas?.system_errors_unresolved || 0}
                            subtext={(stats.saas?.system_errors_unresolved || 0) > 0 ? 'שגיאות פתוחות — לחץ לצפייה' : 'הכל תקין (24 שעות)'}
                            icon={<FaExclamationTriangle size={18} />}
                            color="red"
                            alert={(stats.saas?.system_errors_unresolved || 0) > 0}
                            onClick={() => navigate('/super-admin/order-debug')}
                        />
                        <StatCard
                            label="אנליטיקה — היום"
                            value={(stats.analytics_today?.total_visits || 0).toLocaleString()}
                            subtext={`${(stats.analytics_today?.unique_visitors || 0).toLocaleString()} מבקרים ייחודיים`}
                            icon={<FaChartLine size={18} />}
                            color="blue"
                            onClick={() => navigate('/super-admin/analytics')}
                        />
                        <StatCard
                            label="משפך — החודש"
                            value={`${stats.funnel_month?.conversion_rate ?? 0}%`}
                            subtext={`${stats.funnel_month?.orders ?? 0} הזמנות · ${stats.funnel_month?.sessions ?? 0} סשנים`}
                            icon={<FaFunnelDollar size={18} />}
                            color="orange"
                            onClick={() => navigate('/super-admin/funnel')}
                        />
                    </div>
                )}

                {/* הזמנות פתוחות — מתקפל, מתחת לקוביות */}
                <div className="mb-6">
                    <button
                        type="button"
                        onClick={() => setShowOpenOrdersPanel((v) => !v)}
                        className={`w-full text-right rounded-2xl border transition-all overflow-hidden ${
                            showOpenOrdersPanel
                                ? 'border-brand-primary/30 bg-white shadow-sm'
                                : unhandledOpenCount > 0
                                    ? 'border-red-200 bg-gradient-to-l from-red-50/80 to-orange-50/50 hover:border-red-300'
                                    : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                    >
                        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="relative shrink-0">
                                    <div className={`p-2.5 rounded-xl ${unhandledOpenCount > 0 ? 'bg-red-500 text-white' : 'bg-brand-primary/10 text-brand-primary'}`}>
                                        {loadingOpenOrders ? (
                                            <FaSpinner className="animate-spin" size={16} />
                                        ) : (
                                            <FaCalendarDay size={16} />
                                        )}
                                    </div>
                                    {!loadingOpenOrders && (openOrdersMeta?.total ?? 0) > 0 && (
                                        <span className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-white text-[10px] font-black flex items-center justify-center ring-2 ring-white ${unhandledOpenCount > 0 ? 'bg-red-600' : 'bg-brand-primary'}`}>
                                            {openOrdersMeta.total}
                                        </span>
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <p className="font-black text-gray-900 text-sm sm:text-base">
                                        {loadingOpenOrders
                                            ? 'טוען הזמנות פתוחות...'
                                            : (openOrdersMeta?.total ?? 0) === 0
                                                ? 'אין הזמנות פתוחות — שבוע אחרון'
                                                : `${openOrdersMeta.total} הזמנות פתוחות פעילות`}
                                    </p>
                                    <p className="text-xs text-gray-500 font-bold mt-0.5">
                                        {showOpenOrdersPanel
                                            ? 'לחץ לסגירה'
                                            : unhandledOpenCount > 0
                                                ? `${unhandledOpenCount} ממתינות לטיפול — לחץ לפתיחה`
                                                : 'לחץ לצפייה, שליחת פush ו-Timeline'}
                                    </p>
                                </div>
                            </div>
                            <FaChevronDown
                                className={`text-gray-400 shrink-0 transition-transform ${showOpenOrdersPanel ? 'rotate-180' : ''}`}
                            />
                        </div>
                    </button>

                    {showOpenOrdersPanel && (
                        <div className="mt-3 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="flex items-center justify-end gap-2 px-4 py-3 border-b border-gray-50 bg-gray-50/50">
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); loadOpenOrders(); }}
                                    disabled={loadingOpenOrders}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-gray-100 text-xs font-black text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                                >
                                    <FaSync className={loadingOpenOrders ? 'animate-spin' : ''} size={11} />
                                    רענון
                                </button>
                                <button
                                    type="button"
                                    onClick={() => navigate('/super-admin/order-debug')}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-primary/10 text-brand-primary text-xs font-black hover:bg-brand-primary/15"
                                >
                                    <FaClipboardList size={11} />
                                    לוגים
                                </button>
                            </div>

                            {loadingOpenOrders ? (
                                <div className="py-10 text-center">
                                    <FaSpinner className="animate-spin mx-auto mb-2 text-brand-primary" size={22} />
                                    <p className="text-xs font-bold text-gray-400">טוען הזמנות פתוחות...</p>
                                </div>
                            ) : openOrders.length === 0 ? (
                                <div className="py-10 text-center">
                                    <FaCheckCircle className="mx-auto mb-2 text-green-300" size={28} />
                                    <p className="text-xs font-bold text-gray-500">אין הזמנות פתוחות בשבוע האחרון</p>
                                </div>
                            ) : (
                                <div className="max-h-[480px] overflow-y-auto custom-scrollbar p-4 sm:p-5 space-y-5">
                                    {openOrdersByDate.map(([dateKey, dayOrders]) => (
                                        <div key={dateKey}>
                                            <div className="flex items-center gap-2 mb-2 sticky top-0 bg-white/95 backdrop-blur-sm py-1 z-10">
                                                <h3 className="text-sm font-black text-gray-800">{getOpenOrderDateLabel(dateKey)}</h3>
                                                <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100">
                                                    {dayOrders.length}
                                                </span>
                                                <div className="flex-1 h-px bg-gray-100" />
                                                <span className="text-[10px] font-mono text-gray-400" dir="ltr">{dateKey}</span>
                                            </div>
                                            <div className="space-y-2">
                                                {dayOrders.map((order) => (
                                                    <div
                                                        key={order.id}
                                                        className="flex flex-col lg:flex-row lg:items-center gap-3 p-3 rounded-2xl border border-gray-100 hover:bg-gray-50/80 transition-all"
                                                    >
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                                                <span className="text-sm font-black text-gray-900">#{order.id}</span>
                                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${OPEN_ORDER_STATUS_STYLES[order.status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                                                                    {OPEN_ORDER_STATUS_LABELS[order.status] || order.status}
                                                                </span>
                                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                                                                    order.restaurant_handled
                                                                        ? 'bg-blue-50 text-blue-700 border-blue-100'
                                                                        : 'bg-red-50 text-red-700 border-red-100'
                                                                }`}>
                                                                    {order.restaurant_handled ? 'בטיפול' : 'לא טופל'}
                                                                </span>
                                                                {order.payment_status === 'pending' && (
                                                                    <span className="text-[10px] font-bold text-orange-600">תשלום ממתין</span>
                                                                )}
                                                                {order.payment_status === 'failed' && (
                                                                    <span className="text-[10px] font-bold text-red-600">תשלום נכשל</span>
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-gray-700 font-bold truncate">
                                                                {order.restaurant_name || order.tenant_id} • {order.customer_name || '—'} • {order.customer_phone || '—'}
                                                            </p>
                                                            <p className="text-[10px] text-gray-400 mt-0.5">
                                                                {formatOpenOrderTime(order.created_at)} • פתוח {order.minutes_open} ד&apos;
                                                                {order.restaurant_handled ? ` • בסטטוס ${order.minutes_in_status} ד'` : ''}
                                                                {order.last_nudge_at && (
                                                                    <span> • נשלחה התראה {formatOpenOrderDateTime(order.last_nudge_at)}</span>
                                                                )}
                                                            </p>
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                                                            <span className="text-sm font-black text-gray-900 px-2">
                                                                ₪{Number(order.total_amount || 0).toLocaleString()}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                disabled={nudgingOrderId === order.id}
                                                                onClick={() => handleNudgeOwner(order)}
                                                                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black transition-all disabled:opacity-50 ${
                                                                    order.restaurant_handled
                                                                        ? 'bg-amber-500 text-white hover:bg-amber-600'
                                                                        : 'bg-brand-primary text-white hover:bg-brand-primary/90'
                                                                }`}
                                                            >
                                                                {nudgingOrderId === order.id ? (
                                                                    <FaSpinner className="animate-spin" size={11} />
                                                                ) : (
                                                                    <FaPaperPlane size={11} />
                                                                )}
                                                                {order.restaurant_handled ? 'תזכורת לסיים' : 'שלח פוש למסעדן'}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => openOrderTimeline(order.id)}
                                                                className="px-3 py-2 rounded-xl bg-gray-100 text-gray-600 text-[11px] font-black hover:bg-gray-200"
                                                            >
                                                                Timeline
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

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
                            <button
                                type="button"
                                onClick={openPendingCitiesModal}
                                className="px-3 py-2.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-sm font-bold hover:bg-amber-100 transition-all flex items-center gap-2"
                            >
                                <FaMapMarkerAlt />
                                ערים ממתינות
                                {pendingCities.length > 0 && (
                                    <span className="px-1.5 py-0.5 rounded-full bg-amber-600 text-white text-[10px]">
                                        {pendingCities.length}
                                    </span>
                                )}
                            </button>
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
                                                    {Number(restaurant.pending_wolt_import_requests_count || 0) > 0 && (
                                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-cyan-100 text-cyan-700 border border-cyan-200 flex items-center gap-1">
                                                            <FaCloudDownloadAlt size={10} /> בקשת ייבוא וולט
                                                        </span>
                                                    )}
                                                    {restaurant.deletion_requested_at && (
                                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1 animate-pulse">
                                                            <FaSignOutAlt size={10} /> בקשת סיום
                                                        </span>
                                                    )}
                                                    {restaurant.subscription_status === 'cancelled' && (
                                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-gray-200 text-gray-700 border border-gray-300">
                                                            מנוי מבוטל
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
                                                {restaurant.avg_rating != null && (
                                                    <p className="text-xs font-bold text-amber-500 mt-0.5 flex items-center gap-1 lg:justify-end">
                                                        <FaStar size={11} />
                                                        {Number(restaurant.avg_rating).toFixed(1)}
                                                        <span className="text-gray-400">({restaurant.reviews_count} ביקורות)</span>
                                                    </p>
                                                )}
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

                {showPendingCitiesModal && (
                    <PendingCitiesModal
                        pendingCities={pendingCities}
                        approvedCities={approvedCities}
                        loading={pendingCitiesLoading}
                        onClose={() => setShowPendingCitiesModal(false)}
                        onRefresh={fetchPendingCities}
                        onApprove={handleApprovePendingCity}
                        onReject={handleRejectPendingCity}
                    />
                )}

                {/* FAB הוספת מסעדה — מובייל / טאבלט צר */}
                <button
                    type="button"
                    onClick={() => setShowAddRestaurant(true)}
                    className="md:hidden fixed bottom-5 left-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-primary text-white shadow-lg shadow-brand-primary/35 ring-4 ring-white/90 active:scale-95 transition-transform"
                    style={{ marginBottom: 'max(0.25rem, env(safe-area-inset-bottom))' }}
                    aria-label="הוספת מסעדה חדשה"
                >
                    <FaPlus size={22} />
                </button>
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
    const [showPassword, setShowPassword] = useState(false);
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

    // נורמליזציה של tenant_id: רק אותיות קטנות, מספרים ומקפים
    const normalizeTenantId = (val) =>
        val.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-');

    // תמליל עברית לאנגלית בסיסי
    const hebrewToLatin = (text) => {
        const map = {
            'א': 'a', 'ב': 'b', 'ג': 'g', 'ד': 'd', 'ה': 'a', 'ו': 'u', 'ז': 'z', 'ח': 'ch', 'ט': 't',
            'י': 'i', 'כ': 'k', 'ך': 'k', 'ל': 'l', 'מ': 'm', 'ם': 'm', 'נ': 'n', 'ן': 'n', 'ס': 's',
            'ע': 'e', 'פ': 'p', 'ף': 'f', 'צ': 'z', 'ץ': 'z', 'ק': 'k', 'ר': 'r', 'ש': 'sh', 'ת': 't'
        };
        return text.split('').map(c => map[c] || c).join('');
    };

    // יצירת tenant_id אוטומטי משם המסעדה (תמליל לטיני)
    const generateTenantId = (name) => {
        const transliterated = hebrewToLatin(name);
        const slug = transliterated
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
        return slug || '';
    };

    const handleChange = (e) => {
        const { name, value, files } = e.target;
        if (name === 'logo' && files && files[0]) {
            setFormData({
                ...formData,
                logo: files[0]
            });
        } else if (name === 'tenant_id') {
            setFormData({
                ...formData,
                tenant_id: normalizeTenantId(value)
            });
        } else if (name === 'name') {
            const newData = { ...formData, name: value };
            // אם tenant_id ריק או נוצר אוטומטית, עדכן אותו
            const oldAutoSlug = generateTenantId(formData.name);
            if (!formData.tenant_id || formData.tenant_id === oldAutoSlug) {
                newData.tenant_id = generateTenantId(value);
            }
            // אם אימייל ריק, צור אוטומטי
            const autoEmail = oldAutoSlug ? `${oldAutoSlug}@takeeat.co.il` : '';
            if (!formData.owner_email || formData.owner_email === autoEmail) {
                const newSlug = generateTenantId(value);
                newData.owner_email = newSlug ? `${newSlug}@takeeat.co.il` : '';
            }
            setFormData(newData);
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
                const tempPass = response.data.owner.temporary_password;
                const ownerEmail = response.data.owner.email;
                toast.success('המסעדה נוצרה בהצלחה!');
                toast.success(`פרטי כניסה לבעלים:\nאימייל: ${ownerEmail}\nסיסמה: ${tempPass}`, { duration: 15000 });
                // העתק סיסמה ללוח
                navigator.clipboard?.writeText(tempPass).then(() => {
                    toast.success('הסיסמה הועתקה ללוח!', { duration: 3000 });
                });
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
                                <label className="text-xs font-bold text-gray-500 mr-1">מזהה (URL) — נוצר אוטומטית משם המסעדה</label>
                                <input
                                    type="text"
                                    name="tenant_id"
                                    placeholder="pizza-palace"
                                    value={formData.tenant_id}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-sm font-mono text-gray-600"
                                    dir="ltr"
                                    required
                                />
                                {formData.tenant_id && (
                                    <p className="text-[11px] text-gray-400 font-bold mt-1" dir="ltr">
                                        takeeat.co.il/{formData.tenant_id}/menu
                                    </p>
                                )}
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
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        name="owner_password"
                                        placeholder="השאר ריק ליצירה אוטומטית"
                                        value={formData.owner_password}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2.5 pl-10 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-sm font-medium font-mono"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                    >
                                        {showPassword ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
                                    </button>
                                </div>
                                <p className="text-[10px] text-gray-400 font-bold">הסיסמה תוצג גם לאחר היצירה. אם ריק - תיווצר אוטומטית.</p>
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

function RestaurantDetailModal({ restaurant: initialRestaurant, onClose, onImpersonate }) {
    const { getAuthHeaders } = useAdminAuth();
    const [restaurant, setRestaurant] = useState(initialRestaurant);
    const [loading, setLoading] = useState(true);
    const [cities, setCities] = useState([]);
    const [cityInput, setCityInput] = useState('');
    const [savingCity, setSavingCity] = useState(false);
    const [ownerActivityDate, setOwnerActivityDate] = useState('');
    const [savingOwnerActivity, setSavingOwnerActivity] = useState(false);
    const [ownerContactPhone, setOwnerContactPhone] = useState('');
    const [savingOwnerPhone, setSavingOwnerPhone] = useState(false);
    const [ordersLimit, setOrdersLimit] = useState('');
    const [savingOrdersLimit, setSavingOrdersLimit] = useState(false);
    const [savingRatingToggle, setSavingRatingToggle] = useState(null);
    const [showCitySection, setShowCitySection] = useState(false);
    const [showPhoneSection, setShowPhoneSection] = useState(false);
    const [showActivitySection, setShowActivitySection] = useState(false);
    const [woltUrl, setWoltUrl] = useState('');
    const [woltPreviewLoading, setWoltPreviewLoading] = useState(false);
    const [woltApplyLoading, setWoltApplyLoading] = useState(false);
    const [woltImportDraft, setWoltImportDraft] = useState(null);
    const [showWoltSection, setShowWoltSection] = useState(false);
    // בקשת ייבוא מוולט שממתינה לאישור (נוצרה בהרשמה) — מזהה הבקשה שטעונה לעריכה
    const [woltRequestId, setWoltRequestId] = useState(null);
    const [woltRejectLoading, setWoltRejectLoading] = useState(false);

    const pendingWoltRequest = restaurant?.pending_wolt_import_request || null;

    // פתיחה אוטומטית של אזור הוולט כשיש בקשה ממתינה
    useEffect(() => {
        if (pendingWoltRequest) setShowWoltSection(true);
    }, [pendingWoltRequest]);

    const fetchDetails = useCallback(async () => {
        try {
            const res = await api.get(`/super-admin/restaurants/${initialRestaurant.id}`, {
                headers: getAuthHeaders(),
            });
            if (res.data.success) {
                const r = res.data.restaurant;
                setRestaurant(r);
                setOwnerActivityDate(
                    r.owner_activity_started_at
                        ? String(r.owner_activity_started_at).slice(0, 10)
                        : ''
                );
                setCityInput(r.city ?? '');
                setOwnerContactPhone(r.owner_contact_phone ?? '');
                setOrdersLimit(r.orders_limit != null ? String(r.orders_limit) : '');
            }
        } catch (err) {
            console.error('Failed to fetch restaurant details:', err);
        } finally {
            setLoading(false);
        }
    }, [initialRestaurant.id, getAuthHeaders]);

    useEffect(() => {
        fetchDetails();
    }, [fetchDetails]);

    useEffect(() => {
        const fetchCities = async () => {
            try {
                const res = await api.get('/cities');
                if (res.data?.success && Array.isArray(res.data.data)) {
                    setCities(res.data.data);
                }
            } catch (err) {
                console.error('Failed to fetch cities for super-admin modal:', err);
            }
        };

        fetchCities();
    }, []);

    const saveOwnerActivityDate = async (clear) => {
        const value = clear ? null : (ownerActivityDate || null);
        setSavingOwnerActivity(true);
        try {
            const res = await api.put(
                `/super-admin/restaurants/${restaurant.id}`,
                { owner_activity_started_at: value },
                { headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' } }
            );
            if (res.data.success) {
                setRestaurant(res.data.restaurant);
                if (clear) setOwnerActivityDate('');
                toast.success(clear ? 'תאריך תחילת הפעילות נוקה' : 'תאריך תחילת הפעילות נשמר');
            }
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || 'שגיאה בשמירה');
        } finally {
            setSavingOwnerActivity(false);
        }
    };

    const saveOwnerContactPhone = async () => {
        setSavingOwnerPhone(true);
        try {
            const res = await api.put(
                `/super-admin/restaurants/${restaurant.id}`,
                { owner_contact_phone: ownerContactPhone.trim() || null },
                { headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' } }
            );
            if (res.data.success) {
                setRestaurant(res.data.restaurant);
                setOwnerContactPhone(res.data.restaurant.owner_contact_phone ?? '');
                toast.success('פלאפון לדוחות ווואטסאפ נשמר');
            }
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || 'שגיאה בשמירה');
        } finally {
            setSavingOwnerPhone(false);
        }
    };

    const saveCity = async () => {
        setSavingCity(true);
        try {
            const nextCity = cityInput.trim();
            const res = await api.put(
                `/super-admin/restaurants/${restaurant.id}`,
                { city: nextCity || null },
                { headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' } }
            );
            if (res.data.success) {
                setRestaurant(res.data.restaurant);
                setCityInput(res.data.restaurant.city ?? '');
                toast.success('העיר נשמרה בהצלחה');
            }
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || 'שגיאה בשמירת העיר');
        } finally {
            setSavingCity(false);
        }
    };

    const toggleRatingDisplay = async (field) => {
        setSavingRatingToggle(field);
        try {
            const res = await api.put(
                `/super-admin/restaurants/${restaurant.id}`,
                { [field]: !restaurant[field] },
                { headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' } }
            );
            if (res.data.success) {
                setRestaurant(prev => ({ ...prev, ...res.data.restaurant }));
                toast.success('הגדרת תצוגת הדירוג נשמרה');
            }
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || 'שגיאה בשמירה');
        } finally {
            setSavingRatingToggle(null);
        }
    };

    const saveOrdersLimit = async (clear) => {
        setSavingOrdersLimit(true);
        try {
            const value = clear ? null : (ordersLimit === '' ? null : parseInt(ordersLimit, 10));
            const res = await api.put(
                `/super-admin/restaurants/${restaurant.id}`,
                { orders_limit: value },
                { headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' } }
            );
            if (res.data.success) {
                setRestaurant(res.data.restaurant);
                if (clear) setOrdersLimit('');
                toast.success(clear ? 'מגבלת הזמנות אופסה לברירת מחדל' : 'מגבלת הזמנות נשמרה');
            }
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || 'שגיאה בשמירה');
        } finally {
            setSavingOrdersLimit(false);
        }
    };

    const mapCategoriesToDraft = (categories) => (categories || []).map((cat) => ({
        name: cat.name || '',
        items: (cat.items || []).map((item) => ({
            wolt_external_id: item.wolt_external_id || '',
            name: item.name || '',
            description: item.description || '',
            price: String(item.price ?? ''),
            image_url: item.image_url || '',
            option_groups: (item.option_groups || []).map((group) => ({
                wolt_option_group_id: group.wolt_option_group_id || '',
                name: group.name || '',
                selection_type: group.selection_type || 'multiple',
                min_selections: Number(group.min_selections ?? 0),
                max_selections: group.max_selections == null ? null : Number(group.max_selections),
                is_required: Boolean(group.is_required),
                sort_order: Number(group.sort_order ?? 0),
                addons: (group.addons || []).map((addon) => ({
                    wolt_option_id: addon.wolt_option_id || '',
                    name: addon.name || '',
                    price_delta: Number(addon.price_delta ?? 0),
                    is_default: Boolean(addon.is_default),
                    sort_order: Number(addon.sort_order ?? 0),
                })),
            })),
        })),
    }));

    const handlePreviewWolt = async (urlOverride = null, requestId = null) => {
        const value = (urlOverride ?? woltUrl).trim();
        if (!value) {
            toast.error('יש להזין לינק מסעדה מ-Wolt');
            return;
        }

        setWoltPreviewLoading(true);
        try {
            const res = await api.post(
                `/super-admin/restaurants/${restaurant.id}/wolt-import/preview`,
                { wolt_url: value },
                { headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' } }
            );

            if (res.data?.success) {
                setWoltImportDraft({
                    slug: res.data?.data?.slug || '',
                    summary: res.data?.data?.summary || null,
                    restaurant_meta: res.data?.data?.restaurant_meta || {},
                    categories: mapCategoriesToDraft(res.data?.data?.categories),
                });
                setWoltRequestId(requestId);
                toast.success('התפריט נטען בהצלחה. אפשר לערוך ואז לייבא.');
            }
        } catch (err) {
            console.error(err);
            setWoltImportDraft(null);
            toast.error(err.response?.data?.message || 'שגיאה בטעינת תפריט מ-Wolt');
        } finally {
            setWoltPreviewLoading(false);
        }
    };

    /** טעינת בקשת ייבוא שממתינה לאישור — מהבחירה ששמר בעל המסעדה, או מהלינק אם אין בחירה */
    const handleLoadWoltRequest = () => {
        if (!pendingWoltRequest) return;

        setWoltUrl(pendingWoltRequest.wolt_url || '');

        if (Array.isArray(pendingWoltRequest.categories) && pendingWoltRequest.categories.length > 0) {
            setWoltImportDraft({
                slug: pendingWoltRequest.slug || '',
                summary: pendingWoltRequest.summary || null,
                restaurant_meta: pendingWoltRequest.restaurant_meta || {},
                categories: mapCategoriesToDraft(pendingWoltRequest.categories),
            });
            setWoltRequestId(pendingWoltRequest.id);
            toast.success('הבקשה נטענה עם המוצרים שבחר בעל המסעדה. אפשר לערוך ואז לייבא.');
            return;
        }

        // אין בחירה שמורה (ייבוא מלא) — מושכים את התפריט מהלינק
        handlePreviewWolt(pendingWoltRequest.wolt_url || '', pendingWoltRequest.id);
    };

    const handleRejectWoltRequest = async () => {
        if (!pendingWoltRequest) return;
        if (!window.confirm('לדחות את בקשת הייבוא מוולט? התפריט לא ייובא.')) return;

        setWoltRejectLoading(true);
        try {
            const res = await api.post(
                `/super-admin/wolt-import-requests/${pendingWoltRequest.id}/reject`,
                {},
                { headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' } }
            );
            if (res.data?.success) {
                toast.success('בקשת הייבוא נדחתה');
                setWoltRequestId(null);
                setWoltImportDraft(null);
                await fetchDetails();
            }
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || 'שגיאה בדחיית הבקשה');
        } finally {
            setWoltRejectLoading(false);
        }
    };

    const updateCategoryName = (categoryIndex, value) => {
        setWoltImportDraft((prev) => {
            if (!prev) return prev;
            const categories = [...prev.categories];
            categories[categoryIndex] = { ...categories[categoryIndex], name: value };
            return { ...prev, categories };
        });
    };

    const updateItemField = (categoryIndex, itemIndex, field, value) => {
        setWoltImportDraft((prev) => {
            if (!prev) return prev;
            const categories = [...prev.categories];
            const items = [...(categories[categoryIndex]?.items || [])];
            items[itemIndex] = { ...items[itemIndex], [field]: value };
            categories[categoryIndex] = { ...categories[categoryIndex], items };
            return { ...prev, categories };
        });
    };

    const removeCategory = (categoryIndex) => {
        setWoltImportDraft((prev) => {
            if (!prev) return prev;
            const categories = prev.categories.filter((_, idx) => idx !== categoryIndex);
            return { ...prev, categories };
        });
    };

    const addCategory = () => {
        setWoltImportDraft((prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                categories: [...prev.categories, { name: '', items: [] }],
            };
        });
    };

    const addItem = (categoryIndex) => {
        setWoltImportDraft((prev) => {
            if (!prev) return prev;
            const categories = [...prev.categories];
            const items = [...(categories[categoryIndex]?.items || [])];
            items.push({ name: '', description: '', price: '', image_url: '' });
            categories[categoryIndex] = { ...categories[categoryIndex], items };
            return { ...prev, categories };
        });
    };

    const removeItem = (categoryIndex, itemIndex) => {
        setWoltImportDraft((prev) => {
            if (!prev) return prev;
            const categories = [...prev.categories];
            const items = (categories[categoryIndex]?.items || []).filter((_, idx) => idx !== itemIndex);
            categories[categoryIndex] = { ...categories[categoryIndex], items };
            return { ...prev, categories };
        });
    };

    const handleApplyWoltImport = async () => {
        if (!woltImportDraft || !Array.isArray(woltImportDraft.categories) || woltImportDraft.categories.length === 0) {
            toast.error('אין נתונים לייבוא');
            return;
        }

        setWoltApplyLoading(true);
        try {
            const payloadCategories = woltImportDraft.categories.map((cat) => ({
                name: String(cat.name || '').trim(),
                items: (cat.items || []).map((item) => ({
                    wolt_external_id: String(item.wolt_external_id || '').trim() || null,
                    name: String(item.name || '').trim(),
                    description: String(item.description || '').trim() || null,
                    price: Number(item.price),
                    image_url: String(item.image_url || '').trim() || null,
                    option_groups: (item.option_groups || []).map((group) => ({
                        wolt_option_group_id: String(group.wolt_option_group_id || '').trim() || null,
                        name: String(group.name || '').trim(),
                        selection_type: group.selection_type === 'single' ? 'single' : 'multiple',
                        min_selections: Number(group.min_selections ?? 0),
                        max_selections: group.max_selections == null || group.max_selections === '' ? null : Number(group.max_selections),
                        is_required: Boolean(group.is_required),
                        sort_order: Number(group.sort_order ?? 0),
                        addons: (group.addons || []).map((addon) => ({
                            wolt_option_id: String(addon.wolt_option_id || '').trim() || null,
                            name: String(addon.name || '').trim(),
                            price_delta: Number(addon.price_delta ?? 0),
                            is_default: Boolean(addon.is_default),
                            sort_order: Number(addon.sort_order ?? 0),
                        })),
                    })),
                })),
            }));

            const res = await api.post(
                `/super-admin/restaurants/${restaurant.id}/wolt-import/apply`,
                {
                    wolt_url: woltUrl.trim() || null,
                    request_id: woltRequestId,
                    restaurant_meta: woltImportDraft.restaurant_meta || {},
                    categories: payloadCategories,
                },
                { headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' } }
            );

            if (res.data?.success) {
                const summary = res.data?.data?.import_result;
                toast.success(`ייבוא נשמר: ${summary?.categories_created || 0} קטגוריות חדשות, ${summary?.categories_updated || 0} קטגוריות עודכנו, ${summary?.items_created || 0} מוצרים חדשים, ${summary?.items_updated || 0} מוצרים עודכנו, ${summary?.addon_groups_created || 0} קבוצות תוספות, ${summary?.addons_created || 0} תוספות`);
                if (woltRequestId) {
                    toast.success('בקשת הייבוא של בעל המסעדה אושרה');
                }
                setWoltImportDraft(null);
                setWoltRequestId(null);
                await fetchDetails();
            }
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || 'שגיאה בייבוא התפריט');
        } finally {
            setWoltApplyLoading(false);
        }
    };

    /** נתיב תפריט ציבורי (תואם App.jsx: /:tenantId/menu) */
    const publicMenuUrl = `/${restaurant?.tenant_id || ''}/menu`;

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
                                    <div className="col-span-2 rounded-xl border border-sky-100 bg-sky-50/60 p-3">
                                        <button
                                            type="button"
                                            onClick={() => setShowCitySection(!showCitySection)}
                                            className="w-full flex items-center justify-between text-xs text-sky-800 font-bold"
                                        >
                                            <span>עריכת עיר</span>
                                            <FaChevronDown className={`text-sky-600 transition-transform ${showCitySection ? 'rotate-180' : ''}`} size={10} />
                                        </button>
                                        {showCitySection && (
                                            <>
                                                <p className="text-[11px] text-sky-900/80 mb-2 mt-2 leading-snug">
                                                    ניתן לבחור עיר קיימת או להזין עיר חדשה. בשמירה, שם העיר יתעדכן במסעדה.
                                                </p>
                                                <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                                                    <input
                                                        type="text"
                                                        list="super-admin-city-options"
                                                        value={cityInput}
                                                        onChange={(e) => setCityInput(e.target.value)}
                                                        placeholder="לדוגמה: קריית עקרון"
                                                        className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-sky-200 bg-white text-sm font-bold text-gray-800"
                                                    />
                                                    <datalist id="super-admin-city-options">
                                                        {cities.map((city) => (
                                                            <option key={city.id || `${city.name}-${city.hebrew_name || ''}`} value={city.hebrew_name || city.name} />
                                                        ))}
                                                    </datalist>
                                                    <button
                                                        type="button"
                                                        disabled={savingCity}
                                                        onClick={saveCity}
                                                        className="px-4 py-2 bg-sky-600 text-white rounded-xl text-sm font-bold hover:bg-sky-700 disabled:opacity-50 shrink-0"
                                                    >
                                                        {savingCity ? 'שומר…' : 'שמור'}
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    <div className="col-span-2 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
                                        <button
                                            type="button"
                                            onClick={() => setShowPhoneSection(!showPhoneSection)}
                                            className="w-full flex items-center justify-between text-xs text-emerald-800 font-bold"
                                        >
                                            <span>פלאפון בעלים לדוחות/וואטסאפ (מערכת)</span>
                                            <FaChevronDown className={`text-emerald-600 transition-transform ${showPhoneSection ? 'rotate-180' : ''}`} size={10} />
                                        </button>
                                        {showPhoneSection && (
                                            <>
                                                <p className="text-[11px] text-emerald-900/80 mb-2 mt-2 leading-snug">
                                                    מספר זה משמש לקישורי wa.me ולדוחות — עדיפות על טלפון המסעדה. ניתן לערוך כאן.
                                                </p>
                                                <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                                                    <input
                                                        type="tel"
                                                        dir="ltr"
                                                        value={ownerContactPhone}
                                                        onChange={(e) => setOwnerContactPhone(e.target.value)}
                                                        placeholder="05x-xxxxxxx"
                                                        className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-emerald-200 bg-white text-sm font-bold text-gray-800"
                                                    />
                                                    <button
                                                        type="button"
                                                        disabled={savingOwnerPhone}
                                                        onClick={saveOwnerContactPhone}
                                                        className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 shrink-0"
                                                    >
                                                        {savingOwnerPhone ? 'שומר…' : 'שמור'}
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    <div>
                                        <span className="text-xs text-gray-400 font-bold">סטטוס</span>
                                        <div className="mt-0.5">
                                            <span className={`inline-flex items-center gap-1.5 font-bold text-xs ${(restaurant.is_open_now ?? restaurant.is_open) ? 'text-green-600' : 'text-red-500'}`}>
                                                <span className={`w-2 h-2 rounded-full inline-block ${(restaurant.is_open_now ?? restaurant.is_open) ? 'bg-green-500' : 'bg-red-500'}`} />
                                                {(restaurant.is_open_now ?? restaurant.is_open) ? 'פתוח' : 'סגור'}
                                            </span>
                                        </div>
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

                            {/* מנוי וחיוב */}
                            <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                                <h3 className="text-sm font-black text-gray-900 mb-3 flex items-center gap-2">
                                    <FaCreditCard className="text-brand-primary" size={14} />
                                    מנוי וחיוב
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
                                            <FaCrown className={restaurant.tier === 'enterprise' ? 'text-purple-500' : restaurant.tier === 'pro' ? 'text-amber-500' : 'text-gray-400'} size={12} />
                                            {TIER_LABELS[restaurant.tier] || restaurant.tier} ({restaurant.subscription_plan === 'yearly' ? 'שנתי' : 'חודשי'})
                                        </p>
                                    </div>
                                    {restaurant.monthly_price && (
                                        <div>
                                            <span className="text-xs text-gray-400 font-bold">מחיר חודשי</span>
                                            <p className="font-bold text-gray-700">₪{restaurant.monthly_price}</p>
                                        </div>
                                    )}
                                    <div>
                                        <span className="text-xs text-gray-400 font-bold">כרטיס אשראי</span>
                                        <p className="font-bold text-gray-700 mt-0.5">
                                            {restaurant.hyp_card_last4
                                                ? <span className="text-green-600">****{restaurant.hyp_card_last4}</span>
                                                : <span className="text-gray-400">לא הוגדר</span>
                                            }
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-gray-400 font-bold">תשלום אחרון</span>
                                        <p className="font-bold text-gray-700 mt-0.5">
                                            {restaurant.last_payment_at
                                                ? new Date(restaurant.last_payment_at).toLocaleDateString('he-IL')
                                                : '—'}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-gray-400 font-bold">חיוב הבא</span>
                                        <p className="font-bold text-gray-700 mt-0.5">
                                            {restaurant.next_payment_at
                                                ? new Date(restaurant.next_payment_at).toLocaleDateString('he-IL')
                                                : '—'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* מגבלת הזמנות חודשית */}
                            {restaurant.tier === 'basic' && (
                                <div className="bg-indigo-50/80 rounded-2xl p-5 border border-indigo-100">
                                    <h3 className="text-sm font-black text-gray-900 mb-2 flex items-center gap-2">
                                        <FaShoppingBag className="text-indigo-600" size={14} />
                                        מגבלת הזמנות חודשית
                                    </h3>
                                    <p className="text-xs text-indigo-900/80 font-medium mb-3 leading-relaxed">
                                        Override למסעדה הזו. ריק = ברירת מחדל לפי tier (ניסיון: 50, Basic ששילם: 100, Pro+: ללא הגבלה).
                                    </p>
                                    <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
                                        <div className="flex-1 min-w-0">
                                            <label className="text-xs font-bold text-gray-500 block mb-1">הזמנות לחודש</label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={ordersLimit}
                                                onChange={(e) => setOrdersLimit(e.target.value)}
                                                placeholder="ברירת מחדל מה-tier"
                                                className="w-full px-3 py-2 rounded-xl border border-indigo-200 bg-white text-sm font-bold text-gray-800"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            disabled={savingOrdersLimit}
                                            onClick={() => saveOrdersLimit(false)}
                                            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50"
                                        >
                                            {savingOrdersLimit ? 'שומר…' : 'שמור'}
                                        </button>
                                        <button
                                            type="button"
                                            disabled={savingOrdersLimit || restaurant.orders_limit == null}
                                            onClick={() => saveOrdersLimit(true)}
                                            className="px-4 py-2 border border-indigo-300 text-indigo-900 rounded-xl text-sm font-bold hover:bg-indigo-100/80 disabled:opacity-50"
                                        >
                                            אפס לברירת מחדל
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* סטטיסטיקות */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                                <div className="bg-blue-50 rounded-xl p-2.5 sm:p-3 border border-blue-100 text-center min-w-0">
                                    <p className="text-base sm:text-lg font-black text-blue-700 tabular-nums leading-tight">{restaurant.orders_count ?? 0}</p>
                                    <p className="text-[9px] sm:text-[10px] font-bold text-blue-500 mt-1 leading-tight">הזמנות</p>
                                </div>
                                <div className="bg-green-50 rounded-xl p-2.5 sm:p-3 border border-green-100 text-center min-w-0">
                                    <p className="text-base sm:text-lg font-black text-green-700 tabular-nums leading-tight break-words">₪{Number(restaurant.total_revenue || 0).toLocaleString()}</p>
                                    <p className="text-[9px] sm:text-[10px] font-bold text-green-500 mt-1 leading-tight">הכנסה</p>
                                </div>
                                <div className="bg-purple-50 rounded-xl p-2.5 sm:p-3 border border-purple-100 text-center min-w-0">
                                    <p className="text-base sm:text-lg font-black text-purple-700 tabular-nums leading-tight">{restaurant.menu_items_count ?? 0}</p>
                                    <p className="text-[9px] sm:text-[10px] font-bold text-purple-500 mt-1 leading-tight">פריטי תפריט</p>
                                </div>
                                <div className="bg-orange-50 rounded-xl p-2.5 sm:p-3 border border-orange-100 text-center min-w-0">
                                    <p className="text-base sm:text-lg font-black text-orange-700 tabular-nums leading-tight">{restaurant.categories_count ?? 0}</p>
                                    <p className="text-[9px] sm:text-[10px] font-bold text-orange-500 mt-1 leading-tight">קטגוריות</p>
                                </div>
                            </div>

                            {/* דירוג וביקורות — ממוצע + שליטה בתצוגה ללקוחות */}
                            <div className="bg-amber-50/80 rounded-2xl p-5 border border-amber-100">
                                <h3 className="text-sm font-black text-gray-900 mb-3 flex items-center gap-2">
                                    <FaStar className="text-amber-500" size={14} />
                                    דירוג וביקורות
                                </h3>
                                <div className="flex items-center gap-3 mb-4">
                                    {restaurant.avg_rating != null ? (
                                        <>
                                            <div className="flex items-center gap-1.5 bg-white rounded-xl px-3 py-2 border border-amber-200">
                                                <FaStar className="text-amber-400" size={16} />
                                                <span className="text-xl font-black text-gray-900 tabular-nums">{Number(restaurant.avg_rating).toFixed(1)}</span>
                                                <span className="text-xs font-bold text-gray-400">/ 5</span>
                                            </div>
                                            <p className="text-xs font-bold text-gray-500">
                                                מבוסס על {restaurant.reviews_count} ביקורות לקוחות
                                            </p>
                                        </>
                                    ) : (
                                        <p className="text-xs font-bold text-gray-400">אין עדיין ביקורות למסעדה זו</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    {[
                                        { field: 'show_rating_on_home', label: 'הצג דירוג בדף הבית' },
                                        { field: 'show_rating_on_menu', label: 'הצג דירוג בתפריט המסעדה' },
                                    ].map(({ field, label }) => (
                                        <div key={field} className="flex items-center justify-between bg-white rounded-xl px-3 py-2.5 border border-amber-100">
                                            <span className="text-xs font-bold text-gray-700">{label}</span>
                                            <button
                                                type="button"
                                                disabled={savingRatingToggle !== null}
                                                onClick={() => toggleRatingDisplay(field)}
                                                className={`transition-colors disabled:opacity-50 ${restaurant[field] ? 'text-green-500' : 'text-gray-300'}`}
                                                title={restaurant[field] ? 'כבה תצוגה' : 'הפעל תצוגה'}
                                            >
                                                {savingRatingToggle === field
                                                    ? <FaSpinner className="animate-spin text-amber-500" size={22} />
                                                    : restaurant[field] ? <FaToggleOn size={26} /> : <FaToggleOff size={26} />}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* תאריך תחילת פעילות — תצוגת מסעדן מאפס */}
                            <div className="bg-amber-50/80 rounded-2xl p-5 border border-amber-100">
                                <button
                                    type="button"
                                    onClick={() => setShowActivitySection(!showActivitySection)}
                                    className="w-full flex items-center justify-between"
                                >
                                    <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
                                        <FaClipboardList className="text-amber-600" size={14} />
                                        תאריך תחילת פעילות (תצוגת מסעדן)
                                    </h3>
                                    <FaChevronDown className={`text-amber-600 transition-transform ${showActivitySection ? 'rotate-180' : ''}`} size={12} />
                                </button>
                                {showActivitySection && (
                                    <>
                                        <p className="text-xs text-amber-900/80 font-medium mb-3 mt-2 leading-relaxed">
                                            מיום זה ואילך המסעדן רואה סטטיסטיקות, הזמנות ודוחות בלבד. הנתונים במסד לא נמחקים; חיובי פלטפורמה מבוססים על כל ההיסטוריה.
                                        </p>
                                        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 items-stretch sm:items-end">
                                            <div className="flex-1 min-w-0">
                                                <label className="text-xs font-bold text-gray-500 block mb-1">מתאריך</label>
                                                <input
                                                    type="date"
                                                    value={ownerActivityDate}
                                                    onChange={(e) => setOwnerActivityDate(e.target.value)}
                                                    className="w-full px-3 py-2 rounded-xl border border-amber-200 bg-white text-sm font-bold text-gray-800"
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                disabled={savingOwnerActivity}
                                                onClick={() => saveOwnerActivityDate(false)}
                                                className="px-4 py-2 bg-amber-600 text-white rounded-xl text-sm font-bold hover:bg-amber-700 disabled:opacity-50"
                                            >
                                                {savingOwnerActivity ? 'שומר…' : 'שמור'}
                                            </button>
                                            <button
                                                type="button"
                                                disabled={savingOwnerActivity || !restaurant.owner_activity_started_at}
                                                onClick={() => saveOwnerActivityDate(true)}
                                                className="px-4 py-2 border border-amber-300 text-amber-900 rounded-xl text-sm font-bold hover:bg-amber-100/80 disabled:opacity-50"
                                            >
                                                נקה תאריך
                                            </button>
                                        </div>
                                    </>
                                )}
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

                            {/* Feature Overrides — שליטה בפיצ'רים למסעדה ספציפית */}
                            {['basic', 'pro'].includes(restaurant.tier) && (
                                <FeatureOverridesSection
                                    restaurant={restaurant}
                                    onUpdate={(updated) => setRestaurant(updated)}
                                />
                            )}

                            {/* ייבוא מ-Wolt עם preview ועריכה לפני שמירה */}
                            <div className="bg-cyan-50/80 rounded-2xl p-5 border border-cyan-100">
                                <button
                                    type="button"
                                    onClick={() => setShowWoltSection(!showWoltSection)}
                                    className="w-full flex items-center justify-between"
                                >
                                    <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
                                        <FaFolderOpen className="text-cyan-600" size={14} />
                                        בדיקת לינק Wolt + עריכת מוצרים לפני ייבוא
                                        {pendingWoltRequest && (
                                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-100 text-amber-700 border border-amber-200">
                                                בקשה ממתינה
                                            </span>
                                        )}
                                    </h3>
                                    <FaChevronDown className={`text-cyan-600 transition-transform ${showWoltSection ? 'rotate-180' : ''}`} size={12} />
                                </button>

                                {showWoltSection && (
                                    <div className="mt-3 space-y-3">
                                        {/* בקשת ייבוא שממתינה לאישור — נוצרה בהרשמת המסעדה */}
                                        {pendingWoltRequest && (
                                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
                                                <p className="text-xs font-black text-amber-800 flex items-center gap-1.5">
                                                    <FaCloudDownloadAlt size={12} />
                                                    בעל המסעדה ביקש ייבוא תפריט מוולט בהרשמה
                                                </p>
                                                <p className="text-[11px] font-bold text-amber-700 leading-5">
                                                    {pendingWoltRequest.selection_mode === 'selected'
                                                        ? `נבחרו ${pendingWoltRequest.summary?.items_count || 0} מוצרים ב-${pendingWoltRequest.summary?.categories_count || 0} קטגוריות`
                                                        : 'התבקש ייבוא של כל התפריט'}
                                                    {' · '}
                                                    <a href={pendingWoltRequest.wolt_url} target="_blank" rel="noreferrer" className="underline" dir="ltr">לינק וולט</a>
                                                    {' · '}
                                                    {pendingWoltRequest.created_at ? new Date(pendingWoltRequest.created_at).toLocaleDateString('he-IL') : ''}
                                                </p>
                                                <div className="flex flex-wrap gap-2">
                                                    <button
                                                        type="button"
                                                        disabled={woltPreviewLoading}
                                                        onClick={handleLoadWoltRequest}
                                                        className="px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 disabled:opacity-50"
                                                    >
                                                        {woltPreviewLoading ? 'טוען…' : 'טען בקשה לעריכה וייבוא'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={woltRejectLoading}
                                                        onClick={handleRejectWoltRequest}
                                                        className="px-4 py-2 border border-red-200 text-red-600 rounded-xl text-xs font-bold hover:bg-red-50 disabled:opacity-50"
                                                    >
                                                        {woltRejectLoading ? 'דוחה…' : 'דחה בקשה'}
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        <p className="text-xs text-cyan-900/80 font-medium leading-relaxed">
                                            מזינים לינק מסעדה מ-Wolt, רואים מה התקבל, עורכים קטגוריות ומוצרים, ואז מייבאים למסעדה.
                                        </p>

                                        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
                                            <div className="flex-1 min-w-0">
                                                <label className="text-xs font-bold text-gray-500 block mb-1">קישור Wolt</label>
                                                <input
                                                    type="text"
                                                    value={woltUrl}
                                                    onChange={(e) => setWoltUrl(e.target.value)}
                                                    placeholder="https://wolt.com/he/isr/.../restaurant/..."
                                                    className="w-full px-3 py-2 rounded-xl border border-cyan-200 bg-white text-sm font-bold text-gray-800"
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                disabled={woltPreviewLoading}
                                                onClick={() => handlePreviewWolt()}
                                                className="px-4 py-2 bg-cyan-600 text-white rounded-xl text-sm font-bold hover:bg-cyan-700 disabled:opacity-50"
                                            >
                                                {woltPreviewLoading ? 'טוען…' : 'בדוק לינק'}
                                            </button>
                                        </div>

                                        {woltImportDraft && (
                                            <div className="space-y-3">
                                                <div className="text-xs text-cyan-900 font-bold bg-white border border-cyan-100 rounded-xl px-3 py-2">
                                                    slug: {woltImportDraft.slug || '—'} | קטגוריות: {woltImportDraft.summary?.categories_count || woltImportDraft.categories.length} | מוצרים: {woltImportDraft.summary?.items_count || 0} | קבוצות תוספות: {woltImportDraft.summary?.addon_groups_count || 0}
                                                </div>

                                                <div className="text-[11px] text-cyan-900 bg-white border border-cyan-100 rounded-xl px-3 py-2 leading-5">
                                                    תמונת הירו: {woltImportDraft.restaurant_meta?.hero_image_url ? 'נמצאה' : 'לא נמצאה'} | לוגו: {woltImportDraft.restaurant_meta?.logo_url ? 'נמצא' : 'לא נמצא'} | טלפון: {woltImportDraft.restaurant_meta?.phone || '—'} | כתובת: {woltImportDraft.restaurant_meta?.address || '—'}
                                                    <br />
                                                    שעות/ימי פעילות: {(woltImportDraft.restaurant_meta?.operating_days && Object.keys(woltImportDraft.restaurant_meta.operating_days).length > 0) || (woltImportDraft.restaurant_meta?.operating_hours && Object.keys(woltImportDraft.restaurant_meta.operating_hours).length > 0) ? 'נמצא' : 'לא נמצא'} | אזורי משלוח: {Array.isArray(woltImportDraft.restaurant_meta?.delivery_zones) ? woltImportDraft.restaurant_meta.delivery_zones.length : 0}
                                                </div>

                                                <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                                                    {woltImportDraft.categories.map((category, categoryIndex) => (
                                                        <div key={`wolt-cat-${categoryIndex}`} className="bg-white rounded-xl border border-cyan-100 p-3 space-y-2">
                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    type="text"
                                                                    value={category.name}
                                                                    onChange={(e) => updateCategoryName(categoryIndex, e.target.value)}
                                                                    placeholder="שם קטגוריה"
                                                                    className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-200 text-sm font-bold"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeCategory(categoryIndex)}
                                                                    className="px-2.5 py-2 rounded-lg border border-red-200 text-red-600 text-xs font-bold hover:bg-red-50"
                                                                >
                                                                    מחק קטגוריה
                                                                </button>
                                                            </div>

                                                            <div className="space-y-2">
                                                                {category.items.map((item, itemIndex) => (
                                                                    <div key={`wolt-item-${categoryIndex}-${itemIndex}`} className="border border-gray-100 rounded-lg p-2">
                                                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                                                                            <input
                                                                                type="text"
                                                                                value={item.name}
                                                                                onChange={(e) => updateItemField(categoryIndex, itemIndex, 'name', e.target.value)}
                                                                                placeholder="שם מוצר"
                                                                                className="px-2 py-1.5 rounded border border-gray-200 text-xs font-bold"
                                                                            />
                                                                            <input
                                                                                type="number"
                                                                                min="0"
                                                                                step="0.01"
                                                                                value={item.price}
                                                                                onChange={(e) => updateItemField(categoryIndex, itemIndex, 'price', e.target.value)}
                                                                                placeholder="מחיר"
                                                                                className="px-2 py-1.5 rounded border border-gray-200 text-xs font-bold"
                                                                            />
                                                                            <input
                                                                                type="text"
                                                                                value={item.description}
                                                                                onChange={(e) => updateItemField(categoryIndex, itemIndex, 'description', e.target.value)}
                                                                                placeholder="תיאור"
                                                                                className="px-2 py-1.5 rounded border border-gray-200 text-xs"
                                                                            />
                                                                            <div className="flex gap-2">
                                                                                <input
                                                                                    type="text"
                                                                                    value={item.image_url}
                                                                                    onChange={(e) => updateItemField(categoryIndex, itemIndex, 'image_url', e.target.value)}
                                                                                    placeholder="Image URL"
                                                                                    className="flex-1 min-w-0 px-2 py-1.5 rounded border border-gray-200 text-xs"
                                                                                />
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => removeItem(categoryIndex, itemIndex)}
                                                                                    className="px-2 rounded border border-red-200 text-red-600 text-xs font-bold hover:bg-red-50"
                                                                                >
                                                                                    מחק
                                                                                </button>
                                                                            </div>
                                                                        </div>

                                                                        {Array.isArray(item.option_groups) && item.option_groups.length > 0 && (
                                                                            <div className="mt-2 rounded-md border border-cyan-100 bg-cyan-50/40 px-2 py-1.5">
                                                                                <div className="text-[11px] font-bold text-cyan-900">
                                                                                    קבוצות תוספות: {item.option_groups.length}
                                                                                </div>
                                                                                <div className="text-[11px] text-cyan-800 mt-1 space-y-0.5">
                                                                                    {item.option_groups.slice(0, 3).map((group, groupIndex) => (
                                                                                        <div key={`wolt-og-${categoryIndex}-${itemIndex}-${groupIndex}`}>
                                                                                            {group.name} ({Array.isArray(group.addons) ? group.addons.length : 0} תוספות)
                                                                                        </div>
                                                                                    ))}
                                                                                    {item.option_groups.length > 3 && (
                                                                                        <div>ועוד {item.option_groups.length - 3} קבוצות…</div>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>

                                                            <button
                                                                type="button"
                                                                onClick={() => addItem(categoryIndex)}
                                                                className="px-3 py-1.5 rounded-lg border border-cyan-200 text-cyan-700 text-xs font-bold hover:bg-cyan-50"
                                                            >
                                                                + הוסף מוצר
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>

                                                <div className="flex flex-col sm:flex-row gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={addCategory}
                                                        className="px-3 py-2 rounded-xl border border-cyan-200 text-cyan-700 text-sm font-bold hover:bg-cyan-50"
                                                    >
                                                        + הוסף קטגוריה
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={woltApplyLoading}
                                                        onClick={handleApplyWoltImport}
                                                        className="px-4 py-2 bg-cyan-700 text-white rounded-xl text-sm font-bold hover:bg-cyan-800 disabled:opacity-50"
                                                    >
                                                        {woltApplyLoading ? 'מייבא…' : 'ייבא למסעדה'}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* הפניות מהירות */}
                            <div className="flex flex-col sm:flex-row flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => window.open(publicMenuUrl, '_blank', 'noopener,noreferrer')}
                                    className="flex w-full sm:w-auto min-w-0 items-center justify-center gap-2 px-4 py-2.5 bg-brand-primary text-white rounded-xl text-sm font-bold hover:opacity-90 transition-all"
                                >
                                    <FaExternalLinkAlt size={12} className="shrink-0" />
                                    צפה בתפריט
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { onClose(); onImpersonate(restaurant); }}
                                    className="flex w-full sm:w-auto min-w-0 items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-bold hover:bg-purple-700 transition-all"
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

function PendingCitiesModal({
    pendingCities,
    approvedCities,
    loading,
    onClose,
    onRefresh,
    onApprove,
    onReject,
}) {
    const [replaceMap, setReplaceMap] = useState({});
    const [nameMap, setNameMap] = useState({});
    const [savingId, setSavingId] = useState(null);

    const setReplaceCity = (pendingId, cityId) => {
        setReplaceMap((prev) => ({
            ...prev,
            [pendingId]: cityId,
        }));
    };

    const setEditedName = (pendingId, name) => {
        setNameMap((prev) => ({
            ...prev,
            [pendingId]: name,
        }));
    };

    const handleApprove = async (city) => {
        setSavingId(city.id);

        // אם נבחרה עיר קיימת להחלפה — "אשר" מתנהג כהחלפה (מונע אישור בטעות של השם הישן)
        const replaceWithCityId = replaceMap[city.id];
        if (replaceWithCityId) {
            await onApprove(city.id, {
                replace_with_city_id: Number(replaceWithCityId),
                review_note: 'Replaced with approved city',
            });
            setSavingId(null);
            return;
        }

        const editedName = (nameMap[city.id] ?? (city.hebrew_name || city.name) ?? '').trim();
        await onApprove(city.id, {
            name: editedName || city.name,
            hebrew_name: editedName || city.hebrew_name || city.name,
            latitude: city.latitude,
            longitude: city.longitude,
            review_note: 'Approved by super-admin',
        });
        setSavingId(null);
    };

    const handleReplace = async (city) => {
        const replaceWithCityId = replaceMap[city.id];
        if (!replaceWithCityId) {
            toast.error('יש לבחור עיר קיימת להחלפה');
            return;
        }

        setSavingId(city.id);
        await onApprove(city.id, {
            replace_with_city_id: Number(replaceWithCityId),
            review_note: 'Replaced with approved city',
        });
        setSavingId(null);
    };

    const handleReject = async (city) => {
        setSavingId(city.id);
        await onReject(city.id, 'Rejected by super-admin');
        setSavingId(null);
    };

    return (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-white/20">
                <div className="bg-white px-6 py-5 border-b border-gray-100 flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-xl font-black text-gray-900">ערים ממתינות לאישור</h2>
                        <p className="text-xs text-gray-500 font-bold mt-0.5 uppercase tracking-wider">
                            אישור / דחייה / החלפה לעיר קיימת
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onRefresh}
                            className="px-3 py-2 text-xs font-bold rounded-lg border border-gray-200 hover:bg-gray-50"
                        >
                            רענון
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-gray-600 transition-all"
                        >
                            <FaTimes size={20} />
                        </button>
                    </div>
                </div>

                <div className="p-6 overflow-y-auto space-y-4 custom-scrollbar">
                    {loading ? (
                        <div className="text-center py-10 text-gray-500 font-bold">טוען ערים ממתינות...</div>
                    ) : pendingCities.length === 0 ? (
                        <div className="text-center py-10 text-gray-500 font-bold">אין ערים ממתינות כרגע</div>
                    ) : (
                        pendingCities.map((city) => {
                            const isSaving = savingId === city.id;
                            return (
                                <div key={city.id} className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4">
                                    <div className="flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
                                        <div className="space-y-1">
                                            <div className="text-lg font-black text-gray-900">
                                                {city.hebrew_name || city.name || `עיר #${city.id}`}
                                            </div>
                                            <div className="text-xs text-gray-600 font-medium">ID: {city.id}</div>
                                            <div className="text-xs text-gray-600 font-medium">מקור: {city.source || '-'}</div>
                                            <div className="text-xs text-gray-600 font-medium">
                                                מיקום: {city.latitude != null && city.longitude != null ? `${city.latitude}, ${city.longitude}` : 'ללא קואורדינטות'}
                                            </div>
                                        </div>

                                        <div className="flex-1 max-w-xs">
                                            <label className="text-xs font-bold text-gray-500 block mb-1">שם העיר לאישור (ניתן לעריכה)</label>
                                            <input
                                                type="text"
                                                value={nameMap[city.id] ?? (city.hebrew_name || city.name || '')}
                                                onChange={(e) => setEditedName(city.id, e.target.value)}
                                                className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm"
                                            />
                                            <p className="mt-1 text-[10px] text-gray-400 leading-snug">
                                                שם שכבר קיים כעיר מאושרת — יתבצע איחוד אליה אוטומטית.
                                            </p>
                                        </div>

                                        <div className="flex-1 max-w-xl">
                                            <label className="text-xs font-bold text-gray-500 block mb-1">החלפה לעיר קיימת (אופציונלי)</label>
                                            <select
                                                value={replaceMap[city.id] || ''}
                                                onChange={(e) => setReplaceCity(city.id, e.target.value)}
                                                className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm"
                                            >
                                                <option value="">בחר עיר קיימת...</option>
                                                {approvedCities.map((approved) => (
                                                    <option key={approved.id} value={approved.id}>
                                                        {approved.hebrew_name || approved.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="flex gap-2 items-center">
                                            <button
                                                type="button"
                                                disabled={isSaving}
                                                onClick={() => handleApprove(city)}
                                                className="px-3 py-2 rounded-xl bg-green-600 text-white text-xs font-bold hover:bg-green-700 disabled:opacity-60"
                                            >
                                                {isSaving ? 'שומר...' : 'אשר'}
                                            </button>
                                            <button
                                                type="button"
                                                disabled={isSaving}
                                                onClick={() => handleReplace(city)}
                                                className="px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 disabled:opacity-60"
                                            >
                                                החלף
                                            </button>
                                            <button
                                                type="button"
                                                disabled={isSaving}
                                                onClick={() => handleReject(city)}
                                                className="px-3 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-60"
                                            >
                                                דחה
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}

const OVERRIDE_FEATURES = [
    { key: 'pos', label: 'קופה POS', tier: 'enterprise' },
    { key: 'kiosks', label: 'קיוסקים', tier: 'enterprise' },
    { key: 'display_screens', label: 'מסכי תצוגה', tier: 'enterprise' },
    { key: 'time_reports', label: 'דוח נוכחות', tier: 'enterprise' },
    { key: 'printers', label: 'הדפסה אוטומטית', tier: 'pro' },
    { key: 'employees', label: 'ניהול עובדים', tier: 'pro' },
    { key: 'ai_insights', label: 'AI Insights', tier: 'pro' },
    { key: 'advanced_reports', label: 'דוחות מתקדמים', tier: 'pro' },
];

function FeatureOverridesSection({ restaurant, onUpdate }) {
    const { getAuthHeaders } = useAdminAuth();
    const [saving, setSaving] = useState(null);
    const overrides = restaurant.feature_overrides || {};

    const handleToggle = async (featureKey, newValue) => {
        setSaving(featureKey);
        try {
            const res = await api.patch(
                `/super-admin/restaurants/${restaurant.id}/feature-overrides`,
                { feature: featureKey, value: newValue },
                { headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' } }
            );
            if (res.data.success) {
                onUpdate({ ...restaurant, feature_overrides: res.data.data?.feature_overrides ?? {} });
                toast.success(newValue === null ? 'חזר לברירת מחדל' : `פיצ'ר ${newValue === 'full' ? 'הופעל' : 'ננעל'}`);
            }
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || 'שגיאה בשמירה');
        } finally {
            setSaving(null);
        }
    };

    const getStatus = (featureKey) => {
        if (overrides[featureKey] === 'full') return 'on';
        if (overrides[featureKey] === 'demo') return 'off';
        return 'default';
    };

    return (
        <div className="bg-indigo-50/80 rounded-2xl p-5 border border-indigo-100">
            <h3 className="text-sm font-black text-gray-900 mb-3 flex items-center gap-2">
                <FaCog className="text-indigo-600" size={14} />
                Feature Overrides
            </h3>
            <p className="text-xs text-indigo-900/70 font-medium mb-4">שליטה ידנית בפיצ'רים — דורס את הגדרות החבילה ({TIER_LABELS[restaurant.tier] || restaurant.tier})</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {OVERRIDE_FEATURES.map(({ key, label, tier }) => {
                    const status = getStatus(key);
                    const isSaving = saving === key;
                    return (
                        <div key={key} className="flex items-center justify-between bg-white rounded-xl px-3 py-2 border border-indigo-100">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="text-sm font-bold text-gray-700 truncate">{label}</span>
                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${tier === 'enterprise' ? 'bg-purple-100 text-purple-600' : 'bg-amber-100 text-amber-600'}`}>
                                    {tier === 'enterprise' ? 'ENT' : 'PRO'}
                                </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                {isSaving ? (
                                    <FaSpinner className="animate-spin text-indigo-400" size={14} />
                                ) : (
                                    <>
                                        <button
                                            onClick={() => handleToggle(key, null)}
                                            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${status === 'default' ? 'bg-gray-200 text-gray-700' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                                            title="ברירת מחדל מהחבילה"
                                        >
                                            Auto
                                        </button>
                                        <button
                                            onClick={() => handleToggle(key, 'full')}
                                            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${status === 'on' ? 'bg-green-500 text-white' : 'bg-gray-50 text-gray-400 hover:bg-green-50'}`}
                                            title="פתוח תמיד"
                                        >
                                            ON
                                        </button>
                                        <button
                                            onClick={() => handleToggle(key, 'demo')}
                                            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${status === 'off' ? 'bg-red-500 text-white' : 'bg-gray-50 text-gray-400 hover:bg-red-50'}`}
                                            title="נעול תמיד"
                                        >
                                            OFF
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })}
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
