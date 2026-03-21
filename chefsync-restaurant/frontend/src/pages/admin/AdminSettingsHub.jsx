import { Link } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import { useAdminAuth } from '../../context/AdminAuthContext';
import {
    FaCog,
    FaStore,
    FaUsers,
    FaMapMarkedAlt,
    FaCreditCard,
    FaQrcode,
    FaMobileAlt,
    FaUserCog,
    FaChevronLeft,
    FaShoppingCart,
    FaUtensils,
    FaCarrot,
    FaTv,
    FaTabletAlt,
    FaPlus,
} from 'react-icons/fa';

function SettingCard({ icon, title, description, to, badge }) {
    return (
        <Link
            to={to}
            className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-xl hover:shadow-gray-100/50 transition-all cursor-pointer group block"
        >
            <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-brand-primary/5 rounded-xl text-brand-primary group-hover:bg-brand-primary group-hover:text-white transition-all">
                    {icon}
                </div>
                {badge && (
                    <span className="text-[10px] font-black uppercase text-gray-400 bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
                        {badge}
                    </span>
                )}
            </div>
            <h3 className="text-lg font-black text-gray-900 mb-1 flex items-center justify-between">
                {title}
                <FaChevronLeft className="text-gray-200 group-hover:text-brand-primary transition-all" size={12} />
            </h3>
            <p className="text-xs text-gray-500 font-bold leading-relaxed">
                {description}
            </p>
        </Link>
    );
}

export default function AdminSettingsHub() {
    const { isManager, isOwner } = useAdminAuth();

    const settings = [
        {
            icon: <FaStore size={20} />,
            title: 'פרטי מסעדה',
            description: 'שם, כתובת, שעות פעילות, לוגו ופרטי קשר.',
            to: '/admin/restaurant',
            show: isManager() || isOwner(),
        },
        {
            icon: <FaUsers size={20} />,
            title: 'עובדים',
            description: 'ניהול צוות, הרשאות ושיוך עובדים למסעדה.',
            to: '/admin/employees',
            show: isManager(),
        },
        {
            icon: <FaMapMarkedAlt size={20} />,
            title: 'אזורי משלוח',
            description: 'הגדרת אזורי כיסוי, מחירי משלוח ומרחקים.',
            to: '/admin/delivery-zones',
            show: isManager(),
        },
        {
            icon: <FaCreditCard size={20} />,
            title: 'תשלום וחשבון',
            description: 'הגדרות סליקה, מנוי ואמצעי תשלום.',
            to: '/admin/payment-settings',
            show: isOwner(),
            badge: 'בעלים',
        },
        {
            icon: <FaShoppingCart size={20} />,
            title: 'תזכורות סל נטוש',
            description: 'הפעלה, יתרה ורכישת חבילות SMS ללקוחות עם סל נטוש.',
            to: '/admin/abandoned-cart-reminders',
            show: isManager() || isOwner(),
        },
        {
            icon: <FaQrcode size={20} />,
            title: 'QR Code',
            description: 'יצירת קוד QR לתפריט דיגיטלי וסריקה מהירה.',
            to: '/admin/qr-code',
            show: isManager(),
        },
        {
            icon: <FaMobileAlt size={20} />,
            title: 'סימולטור',
            description: 'תצוגה מקדימה של התפריט כפי שנראה ללקוח.',
            to: '/admin/simulator',
            show: isManager(),
        },
        {
            icon: <FaUserCog size={20} />,
            title: 'הגדרות משתמש',
            description: 'פרופיל, סיסמה וקוד PIN לקופה.',
            to: '/admin/settings',
            show: true,
        },
    ].filter(s => s.show);

    return (
        <AdminLayout>
            <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-4">
                <div className="mb-8">
                    <h1 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                        <div className="w-10 h-10 bg-brand-primary text-white rounded-xl flex items-center justify-center shadow-lg shadow-brand-primary/20">
                            <FaCog size={18} />
                        </div>
                        הגדרות
                    </h1>
                    <p className="text-xs text-gray-500 mt-1 mr-[52px]">ניהול פרטי מסעדה, צוות, משלוחים ותשלום</p>
                </div>

                {(isManager() || isOwner()) && (
                    <div className="mb-8 p-5 rounded-2xl bg-gray-50 border border-gray-100">
                        <p className="text-xs font-black text-gray-500 uppercase tracking-wider mb-3">הוספה מהירה</p>
                        <div className="flex flex-wrap gap-2">
                            <Link
                                to="/admin/menu-management?tab=items"
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm font-black text-gray-800 hover:border-brand-primary hover:text-brand-primary transition-colors"
                            >
                                <FaUtensils size={14} />
                                <FaPlus size={10} className="opacity-60" />
                                פריט לתפריט
                            </Link>
                            <Link
                                to="/admin/menu-management?tab=salads"
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm font-black text-gray-800 hover:border-brand-primary hover:text-brand-primary transition-colors"
                            >
                                <FaCarrot size={14} />
                                <FaPlus size={10} className="opacity-60" />
                                תוספת
                            </Link>
                            <Link
                                to="/admin/devices?tab=screens"
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm font-black text-gray-800 hover:border-brand-primary hover:text-brand-primary transition-colors"
                            >
                                <FaTv size={14} />
                                <FaPlus size={10} className="opacity-60" />
                                מסך תצוגה
                            </Link>
                            <Link
                                to="/admin/devices?tab=kiosks"
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm font-black text-gray-800 hover:border-brand-primary hover:text-brand-primary transition-colors"
                            >
                                <FaTabletAlt size={14} />
                                <FaPlus size={10} className="opacity-60" />
                                קיוסק
                            </Link>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {settings.map((item) => (
                        <SettingCard
                            key={item.to}
                            icon={item.icon}
                            title={item.title}
                            description={item.description}
                            to={item.to}
                            badge={item.badge}
                        />
                    ))}
                </div>
            </div>
        </AdminLayout>
    );
}
