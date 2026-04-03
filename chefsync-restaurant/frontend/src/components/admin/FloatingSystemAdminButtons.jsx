import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FaEllipsisV,
    FaCog,
    FaChartBar,
    FaCreditCard,
    FaFileInvoice,
    FaUsers,
    FaTimesCircle,
    FaArrowLeft
} from 'react-icons/fa';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { toast } from 'react-hot-toast';

/**
 * Floating System Admin Buttons - מופיע כשסופר אדמין עושה impersonate
 */
export default function FloatingSystemAdminButtons({ isSidebarOpen }) {
    const [isOpen, setIsOpen] = useState(false);
    const navigate = useNavigate();
    const { impersonating, stopImpersonation } = useAdminAuth();

    if (!impersonating) return null;

    const adminMenuItems = [
        {
            id: 'restaurant-settings',
            label: 'הגדרות מסעדה',
            icon: <FaCog size={16} />,
            action: () => navigate('/admin/settings-hub'),
            color: 'text-blue-600',
            bg: 'bg-blue-50 hover:bg-blue-100'
        },
        {
            id: 'reports',
            label: 'דוחות',
            icon: <FaChartBar size={16} />,
            action: () => navigate('/admin/reports-center'),
            color: 'text-purple-600',
            bg: 'bg-purple-50 hover:bg-purple-100'
        },
        {
            id: 'billing',
            label: 'תשלומים ומנויים',
            icon: <FaCreditCard size={16} />,
            action: () => navigate('/admin/billing'),
            color: 'text-green-600',
            bg: 'bg-green-50 hover:bg-green-100'
        },
        {
            id: 'users',
            label: 'ניהול משתמשים',
            icon: <FaUsers size={16} />,
            action: () => navigate('/admin/settings'),
            color: 'text-amber-600',
            bg: 'bg-amber-50 hover:bg-amber-100'
        },
        {
            id: 'exit-admin',
            label: 'חזור לדשבורד מנהל',
            icon: <FaArrowLeft size={16} />,
            action: () => {
                stopImpersonation();
                navigate('/super-admin/dashboard');
                toast.success(`יצאת מהתחזות מ-${impersonating.restaurantName}`);
            },
            color: 'text-red-600',
            bg: 'bg-red-50 hover:bg-red-100',
            divider: true
        }
    ];

    return (
        <div
            className="fixed bottom-6 left-6 z-30 flex flex-col items-end gap-2"
            style={{ marginBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
        >
            {/* Expanded Menu */}
            {isOpen && (
                <>
                    {/* Backdrop to close menu */}
                    <div
                        className="fixed inset-0 z-20"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Menu Items */}
                    <div className="relative z-30 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
                        <div className="p-2 space-y-1">
                            {adminMenuItems.map((item) => (
                                <div key={item.id}>
                                    {item.divider && <div className="h-px bg-gray-100 my-1" />}
                                    <button
                                        onClick={() => {
                                            item.action();
                                            setIsOpen(false);
                                        }}
                                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${item.bg} ${item.color}`}
                                    >
                                        {item.icon}
                                        <span>{item.label}</span>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {/* FAB Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-all duration-200 ${
                    isOpen
                        ? 'bg-gray-600 hover:bg-gray-700 text-white'
                        : 'bg-gradient-to-br from-purple-600 to-pink-600 hover:shadow-xl text-white hover:scale-110'
                }`}
                title="תפריט מנהל מערכת"
                aria-label="תפריט מנהל מערכת"
            >
                {isOpen ? <FaTimesCircle size={20} /> : <FaEllipsisV size={18} />}
            </button>

            {/* Badge showing we're in admin impersonation */}
            {impersonating && (
                <div className="text-xs font-black px-3 py-2 rounded-full bg-purple-100 text-purple-700 border border-purple-200 text-center max-w-xs">
                    בעל מערכת: תחזות {impersonating.restaurantName}
                </div>
            )}
        </div>
    );
}
