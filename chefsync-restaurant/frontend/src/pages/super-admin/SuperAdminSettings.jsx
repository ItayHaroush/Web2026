import { Link } from 'react-router-dom';
import SuperAdminLayout from '../../layouts/SuperAdminLayout';
import {
    FaCog,
    FaCreditCard,
    FaLock,
    FaBell,
    FaGlobe,
    FaDatabase,
    FaShieldAlt,
    FaChevronLeft
} from 'react-icons/fa';

export default function SuperAdminSettings() {
    const SettingItem = ({ icon, title, description, to, status = "פעיל" }) => (
        <Link
            to={to}
            className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-xl hover:shadow-gray-100/50 transition-all cursor-pointer group block"
        >
            <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-brand-primary/5 rounded-xl text-brand-primary group-hover:bg-brand-primary group-hover:text-white transition-all">
                    {icon}
                </div>
                <span className="text-[10px] font-black uppercase text-gray-400 bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
                    {status}
                </span>
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

    return (
        <SuperAdminLayout>
            <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-4">
                <div className="mb-8">
                    <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                        <div className="p-2 bg-brand-primary/10 rounded-lg">
                            <FaCog className="text-brand-primary" size={20} />
                        </div>
                        הגדרות מערכת
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">ניהול קונפיגורציות, אבטחה ופרטי תשלום גלובליים</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <SettingItem
                        icon={<FaGlobe size={20} />}
                        title="הגדרות אזוריות"
                        description="שפה, מטבע ברירת מחדל, אזור זמן ופורמט תאריך במערכת."
                        to="/super-admin/settings/regional"
                    />
                    <SettingItem
                        icon={<FaCreditCard size={20} />}
                        title="ניהול סליקה"
                        description="הגדרת חשבונות בנק, שיעור עמלות והגדרות חשבוניות למסעדות."
                        to="/super-admin/settings/billing"
                    />
                    <SettingItem
                        icon={<FaLock size={20} />}
                        title="אבטחה והרשאות"
                        description="ניהול רמות גישה, אימות דו-שלבי למנהלים ותוקף סיסמאות."
                        to="/super-admin/settings/security"
                    />
                    <SettingItem
                        icon={<FaBell size={20} />}
                        title="התראות מערכת"
                        description="הגדרת נוטיפיקציות דוא״ל ו-SMS למנהלי המערכת."
                        to="/super-admin/settings/notifications"
                    />
                    <SettingItem
                        icon={<FaShieldAlt size={20} />}
                        title="מדיניות פרטיות"
                        description="ניהול תנאי שימוש, הצהרת נגישות ומדיניות שמירת נתונים."
                        to="/super-admin/settings/policies"
                    />
                    <SettingItem
                        icon={<FaDatabase size={20} />}
                        title="תחזוקת בסיס נתונים"
                        description="גיבויי נתונים, ניקוי לוגים ואופטימיזציה של המערכת."
                        to="/super-admin/settings/database"
                    />
                </div>
            </div>
        </SuperAdminLayout>
    );
}
