import { useNavigate } from 'react-router-dom';
import { useRestaurantStatus } from '../context/RestaurantStatusContext';
import { useAdminAuth } from '../context/AdminAuthContext';
import AdminLayout from '../layouts/AdminLayout';
import { TIER_LABELS, TIER_HIERARCHY, getFeatureAccess } from '../utils/tierUtils';
import { FaCrown, FaStar, FaArrowLeft, FaLock, FaPhone } from 'react-icons/fa';

/**
 * FeatureGate — חוסם דף שלם לפי tier/feature
 * מציג lock screen עם upgrade prompt (לא מסתיר!)
 *
 * Props:
 *   children: תוכן הדף
 *   featureName: שם התכונה בעברית (לטקסט)
 *   feature: מפתח feature מה-features map (optional)
 *   requiredTier: 'pro' | 'enterprise' (default 'pro')
 */
export default function FeatureGate({ children, featureName = 'תכונה זו', feature, requiredTier = 'pro' }) {
    const navigate = useNavigate();
    const { subscriptionInfo } = useRestaurantStatus();
    const { isOwner, isManager, impersonating } = useAdminAuth();

    // Super admin impersonating — bypass all gates
    if (impersonating) return children || null;

    // Check by feature key if provided, otherwise by tier
    let isLocked = false;
    if (feature) {
        isLocked = getFeatureAccess(subscriptionInfo?.features, feature) !== 'full';
    } else {
        const currentTier = subscriptionInfo?.tier || 'basic';
        isLocked = (TIER_HIERARCHY[currentTier] ?? 0) < (TIER_HIERARCHY[requiredTier] ?? 0);
    }

    if (!isLocked) return children || null;

    const isEnterprise = requiredTier === 'enterprise';
    const tierLabel = TIER_LABELS[requiredTier] || 'Pro';
    const canUpgrade = isOwner() || isManager();

    return (
        <AdminLayout>
            <div className="max-w-2xl mx-auto py-16 px-4">
                <div className="bg-white rounded-[3rem] shadow-xl border-2 border-amber-100 p-12 text-center space-y-8">
                    <div className={`w-24 h-24 ${isEnterprise ? 'bg-gradient-to-br from-purple-500 to-indigo-600' : 'bg-gradient-to-br from-amber-400 to-orange-500'} rounded-[2rem] flex items-center justify-center text-white shadow-xl mx-auto`}>
                        {isEnterprise ? <FaCrown size={40} /> : <FaLock size={36} />}
                    </div>

                    <div className="space-y-3">
                        <h2 className="text-3xl font-black text-gray-900">
                            {featureName}
                        </h2>
                        <p className="text-gray-500 font-medium text-lg leading-relaxed max-w-md mx-auto">
                            {canUpgrade ? (
                                <>
                                    תכונה זו זמינה במסלול {tierLabel} בלבד.
                                    <br />
                                    {isEnterprise
                                        ? 'צרו קשר לקבלת הצעת מחיר מותאמת אישית.'
                                        : 'שדרגו את המנוי וקבלו גישה מלאה לכל הכלים המתקדמים.'}
                                </>
                            ) : (
                                'התכונה לא זמינה כרגע. פנה למנהל המסעדה לפרטים.'
                            )}
                        </p>
                    </div>

                    {canUpgrade && (
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                            {isEnterprise ? (
                                <a
                                    href="https://wa.me/972547466508?text=שלום, אני מעוניין בחבילת מסעדה מלאה"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-10 py-4 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-2xl font-black text-lg hover:shadow-2xl hover:scale-105 transition-all flex items-center gap-3"
                                >
                                    <FaPhone /> צור קשר
                                </a>
                            ) : (
                                <button
                                    onClick={() => navigate('/admin/paywall')}
                                    className="px-10 py-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-2xl font-black text-lg hover:shadow-2xl hover:scale-105 transition-all flex items-center gap-3"
                                >
                                    <FaStar /> שדרג ל-{tierLabel}
                                </button>
                            )}
                            <button
                                onClick={() => navigate('/admin/dashboard')}
                                className="px-8 py-4 bg-gray-100 text-gray-600 rounded-2xl font-black hover:bg-gray-200 transition-all flex items-center gap-2"
                            >
                                חזרה לדשבורד <FaArrowLeft size={14} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}
