import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { PRODUCT_NAME } from '../constants/brand';
import DashboardSidebar from '../components/admin/DashboardSidebar';
import DashboardHeader from '../components/admin/DashboardHeader';
import FloatingAiAssistant from '../components/admin/FloatingAiAssistant';
import {
    FaChartPie,
    FaBell,
    FaFileInvoiceDollar,
    FaCogs,
    FaSms,
    FaUserShield,
    FaClipboardList,
    FaReceipt,
    FaEnvelope
} from 'react-icons/fa';

export default function SuperAdminLayout({ children }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAdminAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(true); // התחל במצב מצומצם

    const handleLogout = async () => {
        await logout();
        navigate('/admin/login');
    };

    const menuItems = [
        {
            label: 'דשבורד',
            path: '/super-admin/dashboard',
            icon: <FaChartPie />,
        },
        {
            label: 'התראות',
            path: '/super-admin/notifications',
            icon: <FaBell />,
        },
        {
            label: 'דוחות',
            path: '/super-admin/reports',
            icon: <FaFileInvoiceDollar />,
        },
        {
            label: 'חשבוניות',
            path: '/super-admin/invoices',
            icon: <FaReceipt />,
        },
        {
            label: 'מיילים',
            path: '/super-admin/emails',
            icon: <FaEnvelope />,
        },
        {
            label: 'הגדרות',
            path: '/super-admin/settings',
            icon: <FaCogs />,
        },
        {
            label: 'SMS Debug',
            path: '/super-admin/sms-debug',
            icon: <FaSms />,
        },
        {
            label: 'לוגים והזמנות',
            path: '/super-admin/order-debug',
            icon: <FaClipboardList />,
        },
        {
            label: 'בדיקת Auth',
            path: '/super-admin/debug',
            icon: <FaUserShield />,
        },
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
            />

            <div className={`flex-1 flex flex-col min-h-screen min-w-0 transition-all duration-300 ${isCollapsed ? 'lg:mr-20' : 'lg:mr-72'}`}>
                <DashboardHeader
                    toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                    user={user}
                    title={menuItems.find(item => item.path === location.pathname)?.label || 'ניהול מערכת'}
                    isCollapsed={isCollapsed}
                    profilePath="/super-admin/profile"
                />

                <main className="flex-1 p-4 sm:p-6 mt-20 overflow-x-hidden">
                    <div className="max-w-7xl mx-auto">
                        {children}
                    </div>
                </main>
            </div>

            {/* סוכן AI צף - זמין בכל דפי Super Admin */}
            <FloatingAiAssistant />
        </div>
    );
}
