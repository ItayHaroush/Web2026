import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { useRestaurantStatus } from '../context/RestaurantStatusContext';
import api from '../services/apiClient';
import logo from '../images/ChefSyncLogoIcon.png';

export default function AdminLayout({ children }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
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
                        is_open: restaurant.is_open,
                        is_override: restaurant.is_override_status || false,
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
            icon: '📊',
            label: 'דשבורד',
            show: true
        },
        {
            path: '/admin/orders',
            icon: '📋',
            label: 'הזמנות',
            show: true
        },
        {
            path: '/admin/menu',
            icon: '🍽️',
            label: 'תפריט',
            show: isManager()
        },
        {
            path: '/admin/categories',
            icon: '📁',
            label: 'קטגוריות',
            show: isManager()
        },
        {
            path: '/admin/employees',
            icon: '👥',
            label: 'עובדים',
            show: isManager()
        },
        {
            path: '/admin/restaurant',
            icon: '🏪',
            label: 'פרטי מסעדה',
            show: isOwner()
        },
        {
            path: '/admin/terminal',
            icon: '🖥️',
            label: 'מסוף סניף',
            show: true
        },
    ];

    const getRoleBadge = (role) => {
        const badges = {
            owner: { text: 'בעלים', color: 'bg-purple-100 text-purple-700' },
            manager: { text: 'מנהל', color: 'bg-blue-100 text-blue-700' },
            employee: { text: 'עובד', color: 'bg-green-100 text-green-700' },
            delivery: { text: 'שליח', color: 'bg-orange-100 text-orange-700' },
        };
        return badges[role] || { text: role, color: 'bg-gray-100 text-gray-700' };
    };

    const roleBadge = getRoleBadge(user?.role);

    return (
        <div className="min-h-screen bg-gray-50" dir="rtl">
            {/* Sidebar - Mobile Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                fixed top-0 right-0 h-full w-64 bg-white shadow-xl z-50
                transform transition-transform duration-300 ease-in-out
                ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'}
                lg:translate-x-0
            `}>
                {/* Logo */}
                <div className="h-16 flex items-center justify-center border-b">
                    <img src={logo} alt="ChefSync IL" className="h-10" />
                </div>

                {/* User Info */}
                <div className="p-4 border-b bg-gray-50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-brand-primary rounded-full flex items-center justify-center text-white font-bold">
                            {user?.name?.charAt(0) || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">{user?.name}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${roleBadge.color}`}>
                                {roleBadge.text}
                            </span>
                        </div>
                    </div>
                    <p className="text-sm text-gray-500 mt-2 truncate">🏪 {user?.restaurant_name}</p>
                </div>

                {/* Navigation */}
                <nav className="p-4 space-y-1">
                    {menuItems.filter(item => item.show).map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            onClick={() => setSidebarOpen(false)}
                            className={`
                                flex items-center gap-3 px-4 py-3 rounded-xl transition-all
                                ${location.pathname === item.path
                                    ? 'bg-brand-primary text-white shadow-lg'
                                    : 'text-gray-600 hover:bg-gray-100'
                                }
                            `}
                        >
                            <span className="text-xl">{item.icon}</span>
                            <span className="font-medium">{item.label}</span>
                        </Link>
                    ))}
                </nav>

                {/* Logout Button */}
                <div className="absolute bottom-0 left-0 right-0 p-4 border-t">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all"
                    >
                        <span>🚪</span>
                        <span className="font-medium">התנתק</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <div className="lg:mr-64">
                {/* Top Header */}
                <header className="h-16 bg-white border-b flex items-center justify-between px-4 sticky top-0 z-30">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>

                    <h1 className="text-lg font-bold text-gray-800">
                        {menuItems.find(item => item.path === location.pathname)?.label || 'פאנל ניהול'}
                    </h1>

                    <div className="flex items-center gap-4">
                        {/* סטטוס בזמן אמת */}
                        <div className="flex items-center gap-2">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${restaurantStatus.is_open
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-red-100 text-red-700'
                                }`}>
                                {restaurantStatus.is_open ? '✓ פתוח' : '✗ סגור'}
                            </span>
                            {restaurantStatus.is_override && (
                                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-semibold">
                                    🔒 כפוי
                                </span>
                            )}
                        </div>

                        <span className="text-sm text-gray-500 hidden sm:block">
                            {new Date().toLocaleDateString('he-IL', {
                                weekday: 'long',
                                day: 'numeric',
                                month: 'long'
                            })}
                        </span>
                    </div>
                </header>

                {/* Page Content */}
                <main className="p-4 lg:p-6">
                    {children}
                </main>
            </div>
        </div>
    );
}
