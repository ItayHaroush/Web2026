import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { useRestaurantStatus } from '../context/RestaurantStatusContext';
import api from '../services/apiClient';
import { PRODUCT_NAME } from '../constants/brand';
import DashboardSidebar from '../components/admin/DashboardSidebar';
import DashboardHeader from '../components/admin/DashboardHeader';
import FloatingRestaurantAssistant from '../components/admin/FloatingRestaurantAssistant';
import ImpersonationBanner from '../components/admin/ImpersonationBanner';
import {
    FaChartPie,
    FaClipboardList,
    FaUtensils,
    FaBreadSlice,
    FaCarrot,
    FaTags,
    FaUsers,
    FaStore,
    FaMapMarkedAlt,
    FaTicketAlt,
    FaPrint,
    FaMobileAlt,
    FaQrcode,
    FaDesktop,
    FaChartBar,
    FaShieldAlt,
    FaClock,
    FaTv,
    FaTabletAlt,
    FaCreditCard,
    FaExclamationTriangle,
    FaUserClock,
    FaCashRegister
} from 'react-icons/fa';

export default function AdminLayout({ children }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [subscriptionData, setSubscriptionData] = useState(null);
    const { user, logout, isOwner, isManager, getAuthHeaders, impersonating } = useAdminAuth();
    const { restaurantStatus, setRestaurantStatus, setSubscriptionInfo } = useRestaurantStatus();
    const location = useLocation();
    const navigate = useNavigate();

    // טען סטטוס המסעדה בכל טעינה של layout
    useEffect(() => {
        const fetchRestaurantStatus = async () => {
            try {
                const response = await api.get('/admin/restaurant', { headers: getAuthHeaders() });
                if (response.data.success) {
                    const restaurant = response.data.restaurant;
                    setRestaurantStatus({
                        is_open: restaurant.is_open_now ?? restaurant.is_open,
                        is_override: restaurant.is_override_status || false,
                        is_approved: restaurant.is_approved ?? false,
                        active_orders_count: restaurant.active_orders_count || 0, // ✅ הוספת מונה הזמנות
                    });
                    // שמור נתוני subscription לתצוגת Trial Banner + Payment Failed Banner
                    setSubscriptionData({
                        subscription_status: restaurant.subscription_status,
                        trial_ends_at: restaurant.trial_ends_at,
                        tier: restaurant.tier,
                        subscription_plan: restaurant.subscription_plan,
                        payment_failed_at: restaurant.payment_failed_at,
                        payment_failure_grace_days_left: restaurant.payment_failure_grace_days_left ?? 0,
                        is_in_grace_period: restaurant.is_in_grace_period ?? false,
                    });
                    // שמור גם בקונטקסט גלובלי לשימוש בכל הדפים
                    setSubscriptionInfo({
                        tier: restaurant.tier,
                        subscription_status: restaurant.subscription_status,
                        subscription_plan: restaurant.subscription_plan,
                        trial_ends_at: restaurant.trial_ends_at,
                    });
                }
            } catch (error) {
                console.error('Failed to fetch restaurant status:', error);
            }
        };

        if (user) {
            fetchRestaurantStatus();
            // רענן כל 30 שניות
            const interval = setInterval(fetchRestaurantStatus, 30000);
            return () => clearInterval(interval);
        }
    }, [user, getAuthHeaders, setRestaurantStatus]);

    const handleLogout = async () => {
        await logout();
        navigate('/admin/login');
    };

    const menuItems = [
        {
            path: '/admin/dashboard',
            icon: <FaChartPie />,
            label: 'דשבורד',
            show: true
        },
        {
            path: '/admin/orders',
            icon: <FaClipboardList />,
            label: 'הזמנות',
            show: true
        },
        {
            path: '/admin/menu',
            icon: <FaUtensils />,
            label: 'תפריט',
            show: isManager()
        },
        {
            path: '/admin/menu/bases',
            icon: <FaBreadSlice />,
            label: 'בסיסים',
            show: isManager()
        },
        {
            path: '/admin/menu/salads',
            icon: <FaCarrot />,
            label: 'תוספות',
            show: isManager()
        },
        {
            path: '/admin/categories',
            icon: <FaTags />,
            label: 'קטגוריות',
            show: isManager()
        },
        {
            path: '/admin/employees',
            icon: <FaUsers />,
            label: 'עובדים',
            show: isManager()
        },
        {
            path: '/admin/restaurant',
            icon: <FaStore />,
            label: 'פרטי מסעדה',
            show: isManager() || isOwner()
        },
        {
            path: '/admin/payment-settings',
            icon: <FaCreditCard />,
            label: 'הגדרות תשלום',
            show: isOwner()
        },
        {
            path: '/admin/delivery-zones',
            icon: <FaMapMarkedAlt />,
            label: 'אזורי משלוח',
            show: isManager()
        },
        {
            path: '/admin/terminal',
            icon: <FaDesktop />,
            label: 'מסוף סניף',
            show: true
        },
        {
            path: '/admin/coupons',
            icon: <FaTicketAlt />,
            label: 'קופונים',
            show: isManager()
        },
        {
            path: '/admin/printers',
            icon: <FaPrint />,
            label: 'מדפסות',
            show: isManager()
        },
        {
            path: '/admin/simulator',
            icon: <FaMobileAlt />,
            label: 'סימולטור',
            show: isManager()
        },
        {
            path: '/admin/qr-code',
            icon: <FaQrcode />,
            label: 'QR Code',
            show: isManager()
        },
        {
            path: '/admin/display-screens',
            icon: <FaTv />,
            label: 'מסכי תצוגה',
            show: isManager()
        },
        {
            path: '/admin/kiosks',
            icon: <FaTabletAlt />,
            label: 'קיוסקים',
            show: isManager()
        },
        {
            path: '/admin/time-reports',
            icon: <FaUserClock />,
            label: 'דוח נוכחות',
            show: true
        },
        {
            path: '/admin/pos',
            icon: <FaCashRegister />,
            label: 'קופה POS',
            show: isManager()
        }
    ].filter(item => item.show);

    const statusBadge = (
        <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1 shadow-sm ${restaurantStatus.is_open
                ? 'bg-green-100 text-green-700 border border-green-200'
                : 'bg-red-100 text-red-700 border border-red-200'
                }`}>
                <span className={`w-2 h-2 rounded-full ${restaurantStatus.is_open ? 'bg-green-500' : 'bg-red-500'}`}></span>
                {restaurantStatus.is_open ? 'פתוח' : 'סגור'}
            </span>
            {restaurantStatus.is_approved === false && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">
                    ממתין לאישור
                </span>
            )}
            {restaurantStatus.is_override && (
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-semibold border border-yellow-200">
                    🔒 כפוי
                </span>
            )}
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col w-full overflow-x-hidden" dir="rtl">
            <ImpersonationBanner />
            <div className="flex flex-1 min-h-0">
                <DashboardSidebar
                    isOpen={sidebarOpen}
                    isCollapsed={isCollapsed}
                    toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                    toggleCollapse={() => setIsCollapsed(!isCollapsed)}
                    menuItems={menuItems}
                    onLogout={handleLogout}
                    title={PRODUCT_NAME}
                    impersonating={!!impersonating}
                />

                <div className={`flex-1 min-w-0 flex flex-col min-h-screen transition-all duration-300 ${isCollapsed ? 'lg:mr-20' : 'lg:mr-72'}`}>
                    <DashboardHeader
                        toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                        user={user}
                        title={menuItems.find(item => item.path === location.pathname)?.label || 'ניהול מסעדה'}
                        isCollapsed={isCollapsed}
                        endContent={statusBadge}
                        notificationCount={restaurantStatus.active_orders_count || 0}
                        impersonating={!!impersonating}
                        profilePath="/admin/settings"
                    />

                    <main className={`flex-1 p-4 lg:p-8 overflow-x-hidden ${impersonating ? 'mt-[7.5rem]' : 'mt-20'}`}>
                        {restaurantStatus.is_approved === false && (
                            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800 shadow-sm animate-pulse-slow">
                                <div className="flex items-start gap-3">
                                    <span className="text-xl">⏳</span>
                                    <div>
                                        <p className="font-bold">ממתין לאישור מנהל מערכת</p>
                                        <p className="text-sm">בינתיים ניתן לעדכן פרטי מסעדה, אבל פעולות פתיחה/סגירה והזמנות מנוטרלות עד לאישור.</p>
                                    </div>
                                </div>
                            </div>
                        )}
                        {subscriptionData && <TrialBanner {...subscriptionData} navigate={navigate} />}
                        {subscriptionData && <PaymentFailedBanner {...subscriptionData} navigate={navigate} />}
                        {children}
                    </main>
                </div>

                {/* סוכן AI ספציפי למסעדה - עם מכסת קרדיטים */}
                <FloatingRestaurantAssistant isSidebarOpen={sidebarOpen} />
            </div>
        </div>
    );
}

// Payment Failed Banner - מוצג כשיש כשלון בחיוב והמסעדה עדיין בתוך תקופת חסד
function PaymentFailedBanner({ subscription_status, payment_failed_at, payment_failure_grace_days_left, is_in_grace_period, navigate }) {
    if (subscription_status !== 'active' || !payment_failed_at || !is_in_grace_period) return null;

    const daysLeft = payment_failure_grace_days_left ?? 0;
    const isUrgent = daysLeft <= 1;

    return (
        <div className={`mb-6 ${isUrgent ? 'bg-gradient-to-r from-red-50 to-amber-50 border-red-300' : 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-300'} border-2 rounded-3xl p-6 shadow-lg animate-in fade-in zoom-in-95 duration-500`}>
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 ${isUrgent ? 'bg-red-500' : 'bg-amber-500'} rounded-2xl flex items-center justify-center text-white shadow-lg`}>
                        <FaExclamationTriangle size={24} />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-gray-900">
                            {isUrgent ? '⚠️ תשלום נכשל – זמן החסד מסתיים!' : '💳 חיוב המנוי לא הצליח'}
                        </h3>
                        <p className="text-gray-600 font-medium mt-1">
                            נותרו <strong className={isUrgent ? 'text-red-600' : 'text-amber-700'}>{daysLeft} ימים</strong>
                            {' '}לעדכון אמצעי התשלום לפני השעיית החשבון. אנא עדכן את פרטי התשלום כדי להמשיך.
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => navigate('/admin/paywall')}
                    className={`${isUrgent ? 'bg-gradient-to-r from-red-500 to-amber-600' : 'bg-gradient-to-r from-amber-500 to-orange-600'} text-white px-6 py-3 rounded-2xl font-black hover:shadow-xl transition-all whitespace-nowrap`}
                >
                    עדכן תשלום
                </button>
            </div>
        </div>
    );
}

// Trial Banner Component
function TrialBanner({ subscription_status, trial_ends_at, tier, subscription_plan, navigate }) {
    if (subscription_status !== 'trial' || !trial_ends_at) return null;

    const daysLeft = Math.ceil((new Date(trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24));

    if (daysLeft <= 0) return null; // אם פג התוקף, Middleware יפנה ל-paywall

    const isUrgent = daysLeft <= 3;

    return (
        <div className={`mb-6 ${isUrgent ? 'bg-gradient-to-r from-red-50 to-orange-50 border-red-200' : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'} border-2 rounded-3xl p-6 shadow-lg animate-in fade-in zoom-in-95 duration-500`}>
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 ${isUrgent ? 'bg-red-500' : 'bg-blue-500'} rounded-2xl flex items-center justify-center text-white shadow-lg`}>
                        <FaClock size={24} />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-gray-900">
                            {isUrgent ? '⏰ תקופת הניסיון עומדת להסתיים!' : '🎉 תקופת ניסיון פעילה'}
                        </h3>
                        <p className="text-gray-600 font-medium mt-1">
                            נותרו <strong className={isUrgent ? 'text-red-600' : 'text-blue-600'}>{daysLeft} ימים</strong>
                            {' '}לתקופת הניסיון החינמית • תוכנית: <strong>{tier === 'basic' ? 'Basic' : 'Pro'}</strong>
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => navigate('/admin/paywall')}
                    className={`${isUrgent ? 'bg-gradient-to-r from-red-500 to-orange-600' : 'bg-gradient-to-r from-brand-primary to-blue-600'} text-white px-6 py-3 rounded-2xl font-black hover:shadow-xl transition-all whitespace-nowrap`}
                >
                    {isUrgent ? '🚀 שלם עכשיו' : '💳 הפעל מנוי'}
                </button>
            </div>
        </div>
    );
}
