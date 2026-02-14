import { useNavigate } from 'react-router-dom';
import { useRestaurantStatus } from '../context/RestaurantStatusContext';
import { FaStar } from 'react-icons/fa';

/**
 * UpgradeBanner — באנר שדרוג ל-Pro
 * מוצג רק למסעדות basic. מקבל variant לסגנונות שונים.
 *
 * Props:
 *   variant: 'inline' | 'card' | 'minimal'  (default: 'inline')
 *   context: string — הקשר להודעה (למשל 'AI', 'דוחות מתקדמים')
 */
export default function UpgradeBanner({ variant = 'inline', context = '' }) {
    const navigate = useNavigate();
    const { subscriptionInfo } = useRestaurantStatus();

    // הצג רק ל-basic
    if (!subscriptionInfo?.tier || subscriptionInfo.tier !== 'basic') return null;

    const messages = {
        ai: 'שדרג ל-Pro וקבל גישה לסוכן חכם, תובנות עסקיות, המלצות מחיר ועוד',
        reports: 'שדרג ל-Pro וקבל גישה לדוחות מתקדמים וניתוח ביצועים',
        default: 'שדרג ל-Pro וקבל גישה לכל התכונות המתקדמות',
    };

    const message = messages[context] || messages.default;

    if (variant === 'minimal') {
        return (
            <button
                onClick={() => navigate('/admin/paywall')}
                className="flex items-center gap-1.5 text-xs font-bold text-amber-600 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-full transition-all"
            >
                <FaStar size={10} />
                שדרג ל-Pro
            </button>
        );
    }

    if (variant === 'card') {
        return (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-3xl p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center text-white shadow-lg">
                            <FaStar size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-gray-900">שדרג ל-Pro</h3>
                            <p className="text-sm text-gray-600 mt-0.5">{message}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => navigate('/admin/paywall')}
                        className="bg-gradient-to-r from-amber-500 to-orange-600 text-white px-6 py-3 rounded-2xl font-black text-sm hover:shadow-xl transition-all whitespace-nowrap"
                    >
                        שדרג עכשיו
                    </button>
                </div>
            </div>
        );
    }

    // variant === 'inline' (default)
    return (
        <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl px-5 py-3">
            <div className="flex items-center gap-3">
                <FaStar className="text-amber-500" size={16} />
                <p className="text-sm font-bold text-gray-700">{message}</p>
            </div>
            <button
                onClick={() => navigate('/admin/paywall')}
                className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl font-black text-xs transition-all whitespace-nowrap"
            >
                שדרג ל-Pro
            </button>
        </div>
    );
}
