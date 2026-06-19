import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { PRODUCT_NAME } from '../constants/brand';
import DashboardSidebar from '../components/admin/DashboardSidebar';
import DashboardHeader from '../components/admin/DashboardHeader';
import DashboardPushSoundControls from '../components/admin/DashboardPushSoundControls';
import FloatingAiAssistant from '../components/admin/FloatingAiAssistant';
import useSuperAdminForegroundFcm from '../hooks/useSuperAdminForegroundFcm';
import {
    FaChartPie,
    FaBell,
    FaBullhorn,
    FaCalendarAlt,
    FaFileInvoiceDollar,
    FaCogs,
    FaClipboardList,
    FaReceipt,
    FaEnvelope,
    FaUsers,
    FaShoppingCart,
    FaCoins,
    FaChartBar,
    FaChartLine,
    FaCommentDots,
    FaFunnelDollar,
    FaLifeRing,
} from 'react-icons/fa';
import { resolveSuperAdminPageKey } from '../utils/pageViewMap';
import { sendSuperAdminPageView } from '../services/analyticsBeacon';

export default function SuperAdminLayout({ children }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout, getAuthHeaders } = useAdminAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(true); // התחל במצב מצומצם
    const lastAnalyticsSigRef = useRef('');

    useSuperAdminForegroundFcm(Boolean(user?.is_super_admin));

    useEffect(() => {
        if (!user?.is_super_admin) return;
        const pageKey = resolveSuperAdminPageKey(location.pathname);
        if (!pageKey) return;
        const sig = `${pageKey}|${location.pathname}|${location.search}|${user?.id ?? ''}`;
        if (lastAnalyticsSigRef.current === sig) return;
        lastAnalyticsSigRef.current = sig;
        sendSuperAdminPageView(pageKey, getAuthHeaders, {
            path: location.pathname + location.search,
        });
    }, [location.pathname, location.search, user?.id, user?.is_super_admin, getAuthHeaders]);

    const handleLogout = async () => {
        await logout();
        navigate('/admin/login');
    };

    const menuItems = [
        { label: 'דשבורד', path: '/super-admin/dashboard', icon: <FaChartPie /> },

        { type: 'header', label: 'אנליטיקה', icon: <FaChartLine /> },
        { label: 'אנליטיקות כניסה', path: '/super-admin/analytics', icon: <FaChartBar /> },
        { label: 'משפך המרות ונטישה', path: '/super-admin/funnel', icon: <FaFunnelDollar /> },
        { label: 'סל נטוש', path: '/super-admin/abandoned-carts', icon: <FaShoppingCart /> },
        { label: 'דוחות', path: '/super-admin/reports', icon: <FaFileInvoiceDollar /> },

        { type: 'header', label: 'לקוחות', icon: <FaUsers /> },
        { label: 'לקוחות', path: '/super-admin/customers', icon: <FaUsers /> },

        { type: 'header', label: 'פיננסים', icon: <FaCoins /> },
        { label: 'תשלומים ידניים', path: '/super-admin/billing-manual', icon: <FaCoins /> },
        { label: 'חשבוניות', path: '/super-admin/invoices', icon: <FaReceipt /> },

        { type: 'header', label: 'תקשורת', icon: <FaBullhorn /> },
        { label: 'הודעות כלליות', path: '/super-admin/announcements', icon: <FaBullhorn /> },
        { label: 'ניהול מיילים', path: '/super-admin/email-management', icon: <FaEnvelope /> },
        { label: 'חגים ומועדים', path: '/super-admin/holidays', icon: <FaCalendarAlt /> },

        { type: 'header', label: 'ניטור ותמיכה', icon: <FaLifeRing /> },
        { label: 'מרכז התראות', path: '/super-admin/notification-center', icon: <FaBell /> },
        { label: 'משוב משתמשים', path: '/super-admin/feedback', icon: <FaCommentDots /> },
        { label: 'לוגים והזמנות', path: '/super-admin/order-debug', icon: <FaClipboardList /> },

        { type: 'header', label: 'מערכת', icon: <FaCogs /> },
        { label: 'הגדרות', path: '/super-admin/settings', icon: <FaCogs /> },
    ];

    return (
        <div className="min-h-screen bg-slate-50 flex" dir="rtl">
            <DashboardSidebar
                isOpen={sidebarOpen}
                isCollapsed={isCollapsed}
                toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                toggleCollapse={() => setIsCollapsed(!isCollapsed)}
                menuItems={menuItems}
                onLogout={handleLogout}
                title={`${PRODUCT_NAME} · מנהל מערכת`}
                isSuperAdmin
            />

            <div className={`flex-1 flex flex-col min-h-screen min-w-0 transition-all duration-300 ${isCollapsed ? 'lg:mr-20' : 'lg:mr-72'}`}>
                <DashboardHeader
                    toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                    user={user}
                    title={menuItems.find(item => location.pathname === item.path || location.pathname.startsWith(item.path + '/'))?.label || 'ניהול מערכת'}
                    isCollapsed={isCollapsed}
                    profilePath="/super-admin/profile"
                />

                <main className="flex-1 p-4 sm:p-6 mt-20 overflow-x-hidden">
                    <div className="max-w-7xl mx-auto">
                        <div className="mb-3 flex justify-end">
                            <DashboardPushSoundControls mode="auto" />
                        </div>
                        {children}
                    </div>
                </main>
            </div>

            {/* סוכן AI צף - זמין בכל דפי Super Admin */}
            <FloatingAiAssistant />
        </div>
    );
}
