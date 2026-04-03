import { useNavigate } from 'react-router-dom';
import { useRestaurantStatus } from '../context/RestaurantStatusContext';
import { useAdminAuth } from '../context/AdminAuthContext';
import { TIER_LABELS, TIER_HIERARCHY, getFeatureAccess } from '../utils/tierUtils';
import { FaStar, FaPhone } from 'react-icons/fa';

/**
 * UpgradeBanner — באנר שדרוג דינמי
 * מוצג רק כשפיצ'ר נעול + רק ל-owner/manager
 *
 * Props:
 *   variant: 'inline' | 'card' | 'minimal'  (default: 'inline')
 *   context: string — הקשר להודעה (למשל 'ai', 'reports', 'pos', 'kiosks', 'displays', 'employees')
 *   requiredTier: 'pro' | 'enterprise' (default: 'pro')
 *   feature: optional feature key to check from features map
 */
export default function UpgradeBanner({ variant = 'inline', context = '', requiredTier = 'pro', feature }) {
    const navigate = useNavigate();
    const { subscriptionInfo } = useRestaurantStatus();
    const { isOwner, isManager, impersonating, isSuperAdmin } = useAdminAuth();

    // Hide from super admin (system owner) - both impersonating and direct super admin
    if (isSuperAdmin() || impersonating) return null;

    // Only show to owner/manager
    if (!isOwner() && !isManager()) return null;

    // Check if locked by feature key or tier
    let isLocked = false;
    if (feature) {
        isLocked = getFeatureAccess(subscriptionInfo?.features, feature) !== 'full';
    } else {
        const currentTier = subscriptionInfo?.tier;
        if (!currentTier) return null;
        isLocked = (TIER_HIERARCHY[currentTier] ?? 0) < (TIER_HIERARCHY[requiredTier] ?? 0);
    }

    if (!isLocked) return null;

    const isEnterprise = requiredTier === 'enterprise';
    const tierLabel = TIER_LABELS[requiredTier] || 'Pro';

    const messages = {
        ai: 'שדרג ל-Pro וקבל גישה לסוכן חכם, תובנות עסקיות, המלצות מחיר ועוד',
        reports: 'שדרג ל-Pro וקבל גישה לדוחות מתקדמים וניתוח ביצועים',
        printers: 'שדרג ל-Pro וקבל גישה להדפסת הזמנות אוטומטית',
        employees: 'שדרג ל-Pro וקבל גישה לניהול עובדים מלא',
        pos: 'שדרג לחבילת מסעדה מלאה וקבל גישה לקופה POS מלאה',
        kiosks: 'שדרג לחבילת מסעדה מלאה וקבל גישה לקיוסקים לשירות עצמי',
        displays: 'שדרג לחבילת מסעדה מלאה וקבל גישה למסכי תצוגה דיגיטליים',
        time_reports: 'שדרג לחבילת מסעדה מלאה וקבל גישה לדוח נוכחות ושכר',
        default: `שדרג ל-${tierLabel} וקבל גישה לכל התכונות המתקדמות`,
    };

    const message = messages[context] || messages.default;

    const handleClick = () => {
        if (isEnterprise) {
            window.open('https://wa.me/972547466508?text=שלום, אני מעוניין בחבילת מסעדה מלאה', '_blank');
        } else {
            navigate('/admin/paywall');
        }
    };

    const cardTitle = isEnterprise ? 'חבילת מסעדה מלאה' : `שדרג ל-${tierLabel}`;
    const buttonText = isEnterprise ? 'צור קשר' : `שדרג ל-${tierLabel}`;
    const ButtonIcon = isEnterprise ? FaPhone : FaStar;

    if (variant === 'minimal') {
        return (
            <button
                onClick={handleClick}
                className={`flex items-center gap-1.5 text-xs font-bold ${isEnterprise ? 'text-purple-600 bg-purple-50 hover:bg-purple-100 border-purple-200' : 'text-amber-600 bg-amber-50 hover:bg-amber-100 border-amber-200'} border px-3 py-1.5 rounded-full transition-all`}
            >
                <ButtonIcon size={10} />
                {buttonText}
            </button>
        );
    }

    if (variant === 'card') {
        return (
            <div className={`${isEnterprise ? 'bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200' : 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200'} border-2 rounded-3xl p-6 shadow-sm`}>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 ${isEnterprise ? 'bg-gradient-to-br from-purple-500 to-indigo-600' : 'bg-gradient-to-br from-amber-400 to-orange-500'} rounded-2xl flex items-center justify-center text-white shadow-lg`}>
                            <ButtonIcon size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-gray-900">{cardTitle}</h3>
                            <p className="text-sm text-gray-600 mt-0.5">{message}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleClick}
                        className={`${isEnterprise ? 'bg-gradient-to-r from-purple-500 to-indigo-600' : 'bg-gradient-to-r from-amber-500 to-orange-600'} text-white px-6 py-3 rounded-2xl font-black text-sm hover:shadow-xl transition-all whitespace-nowrap`}
                    >
                        {isEnterprise ? 'צור קשר' : 'שדרג עכשיו'}
                    </button>
                </div>
            </div>
        );
    }

    // variant === 'inline' (default)
    return (
        <div className={`flex items-center justify-between gap-3 ${isEnterprise ? 'bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200' : 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200'} border rounded-2xl px-5 py-3`}>
            <div className="flex items-center gap-3">
                <ButtonIcon className={isEnterprise ? 'text-purple-500' : 'text-amber-500'} size={16} />
                <p className="text-sm font-bold text-gray-700">{message}</p>
            </div>
            <button
                onClick={handleClick}
                className={`${isEnterprise ? 'bg-purple-500 hover:bg-purple-600' : 'bg-amber-500 hover:bg-amber-600'} text-white px-4 py-2 rounded-xl font-black text-xs transition-all whitespace-nowrap`}
            >
                {buttonText}
            </button>
        </div>
    );
}
