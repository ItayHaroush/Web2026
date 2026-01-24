import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { useRestaurantStatus } from '../context/RestaurantStatusContext';
import api from '../services/apiClient';
import { PRODUCT_NAME } from '../constants/brand';
import DashboardSidebar from '../components/admin/DashboardSidebar';
import DashboardHeader from '../components/admin/DashboardHeader';
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
    FaShieldAlt
} from 'react-icons/fa';

export default function AdminLayout({ children }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const { user, logout, isOwner, isManager, getAuthHeaders } = useAdminAuth();
    const { restaurantStatus, setRestaurantStatus } = useRestaurantStatus();
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
        <div className="min-h-screen bg-gray-50 flex" dir="rtl">
            <DashboardSidebar
                isOpen={sidebarOpen}
                isCollapsed={isCollapsed}
                toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                toggleCollapse={() => setIsCollapsed(!isCollapsed)}
                menuItems={menuItems}
                onLogout={handleLogout}
                title={PRODUCT_NAME}
            />

            <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${isCollapsed ? 'lg:mr-20' : 'lg:mr-72'}`}>
                <DashboardHeader
                    toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                    user={user}
                    title={menuItems.find(item => item.path === location.pathname)?.label || 'ניהול מסעדה'}
                    isCollapsed={isCollapsed}
                    endContent={statusBadge}
                />

                <main className="flex-1 p-4 lg:p-8 mt-20 overflow-x-hidden">
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
                    <div className="max-w-7xl mx-auto space-y-6">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
