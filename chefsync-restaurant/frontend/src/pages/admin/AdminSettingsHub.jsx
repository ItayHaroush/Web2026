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
    FaChevronLeft
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
