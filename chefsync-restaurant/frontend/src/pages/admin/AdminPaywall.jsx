import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { getBillingInfo, checkPendingPayment } from '../../services/subscriptionService';
import {
    FaLock,
    FaRocket,
    FaCheckCircle,
    FaCreditCard,
    FaArrowLeft,
    FaCrown,
    FaBrain,
    FaExclamationTriangle,
    FaArrowDown
} from 'react-icons/fa';

const PRO_ONLY_FEATURES = [
    'קרדיטים AI (תיאורי מנות, תובנות, המלצות מחיר)',
    'דו"חות בזמן אמת ומתקדמים',
    'תמיכה עדיפות',
];

export default function AdminPaywall() {
    const navigate = useNavigate();
    const [billing, setBilling] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedTier, setSelectedTier] = useState('pro');
    const [billingCycle, setBillingCycle] = useState('monthly');
    const [showDowngradeWarning, setShowDowngradeWarning] = useState(false);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                // בדיקת תשלום שאבד (redirect מ-HYP לא חזר)
                try {
                    const recoveryRes = await checkPendingPayment();
                    if (recoveryRes.data?.recovered) {
                        toast.success('נמצא תשלום שלא עובד — המנוי הופעל בהצלחה!');
                        navigate('/admin/dashboard');
                        return;
                    }
                } catch { }

                const { data } = await getBillingInfo();
                const info = data?.data || {};
                setBilling(info);

                setSelectedTier(info.current_tier || 'pro');
                if (info.current_plan?.includes('yearly') || info.current_plan?.includes('annual')) {
                    setBillingCycle('yearly');
                } else {
                    setBillingCycle('monthly');
                }
            } catch (error) {
                try {
                    const cached = localStorage.getItem('paywall_data');
                    if (cached) setBilling(JSON.parse(cached));
                } catch { }
                toast.error(error.response?.data?.message || 'שגיאה בטעינת נתוני חיוב');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const pricing = billing?.pricing || {
        basic: { monthly: 450, yearly: 4500, ai_credits: 0, features: ['תפריט דיגיטלי', 'ניהול הזמנות', 'דוחות בסיסיים'] },
        pro: { monthly: 600, yearly: 5000, ai_credits: 500, features: ['תפריט דיגיטלי', 'ניהול הזמנות', 'דוחות מתקדמים', 'AI מתקדם', 'תמיכה מועדפת'] }
    };

    const isDowngrade = billing?.current_tier === 'pro' && selectedTier === 'basic';
    const isUpgrade = billing?.current_tier === 'basic' && selectedTier === 'pro';
    const isTrialActive = billing?.subscription_status === 'trial' && billing?.days_left_in_trial > 0;
    const isActive = billing?.subscription_status === 'active';
    const planPrice = pricing[selectedTier]?.[billingCycle] || 0;
    // דמי הקמת חיבור מסוף — נגבים רק לאחר אישור בדף הגדרות תשלום (בחירת אשראי + אישור)
    const totalAmount = planPrice;

    const handleTierSelect = (tier) => {
        if (billing?.current_tier === 'pro' && tier === 'basic') {
            setShowDowngradeWarning(true);
        } else {
            setShowDowngradeWarning(false);
        }
        setSelectedTier(tier);
    };

    const handleActivate = () => {
        navigate('/admin/payment', {
            state: {
                tier: selectedTier,
                billingCycle,
                amount: totalAmount,
                planAmount: planPrice,
                setupFee: 0,
                isDowngrade,
                isUpgrade,
                previousTier: billing?.current_tier,
            }
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-gray-500 font-black animate-pulse">טוען נתוני חשבון...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-6 py-12 font-sans overflow-x-hidden relative">
            <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-brand-primary/5 to-transparent -z-10" />
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-brand-primary/10 rounded-full blur-3xl -z-10" />
            <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -z-10" />

            <div className="max-w-4xl w-full space-y-10 animate-in fade-in zoom-in-95 duration-700">
                <div className="flex flex-col items-center text-center space-y-4">
                    <div className="w-20 h-20 bg-white shadow-2xl shadow-brand-primary/20 rounded-[2.5rem] flex items-center justify-center text-brand-primary border border-brand-primary/10">
                        <FaCrown size={36} />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-gray-900 tracking-tight">
                            {isActive ? 'ניהול חשבון ותוכנית' : 'בחר את התוכנית המושלמת'}
                        </h1>
                        <p className="text-gray-500 font-medium text-lg mt-2 max-w-2xl mx-auto leading-relaxed">
                            {isTrialActive
                                ? `נשארו ${billing?.days_left_in_trial} ימים בתקופת הניסיון`
                                : isActive
                                    ? `תוכנית נוכחית: ${billing?.current_tier === 'pro' ? 'Pro' : 'Basic'} | ${billing?.current_plan === 'yearly' ? 'שנתי' : 'חודשי'}`
                                    : 'שדרג עכשיו וקבל גישה מלאה לכל התכונות'}
                        </p>
                    </div>
                </div>

                {/* Current billing info for active subscribers */}
                {isActive && billing?.has_card_on_file && (
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 max-w-2xl mx-auto">
                        <div className="flex items-center gap-3 mb-4">
                            <FaCreditCard className="text-brand-primary" />
                            <h3 className="font-black text-gray-900">פרטי חשבון</h3>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                            <div>
                                <p className="text-gray-400 font-bold mb-1">כרטיס</p>
                                <p className="font-black text-gray-900">**** {billing.card_last4}</p>
                            </div>
                            <div>
                                <p className="text-gray-400 font-bold mb-1">חיוב הבא</p>
                                <p className="font-black text-gray-900">
                                    {billing.next_payment_at ? new Date(billing.next_payment_at).toLocaleDateString('he-IL') : '-'}
                                </p>
                            </div>
                            <div>
                                <p className="text-gray-400 font-bold mb-1">תשלום אחרון</p>
                                <p className="font-black text-gray-900">
                                    {billing.last_payment_at ? new Date(billing.last_payment_at).toLocaleDateString('he-IL') : '-'}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Downgrade Warning */}
                {showDowngradeWarning && (
                    <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-6 max-w-2xl mx-auto animate-in fade-in duration-300">
                        <div className="flex items-start gap-3">
                            <FaExclamationTriangle className="text-amber-500 mt-1 text-xl flex-shrink-0" />
                            <div>
                                <h3 className="font-black text-amber-800 text-lg mb-2">שדרוג לאחור ל-Basic</h3>
                                <p className="text-amber-700 font-medium mb-3">
                                    שים לב — במעבר מ-Pro ל-Basic התכונות הבאות <strong>לא יהיו זמינות</strong>:
                                </p>
                                <ul className="space-y-2 mb-4">
                                    {PRO_ONLY_FEATURES.map((feature, i) => (
                                        <li key={i} className="flex items-center gap-2 text-amber-800 font-medium text-sm">
                                            <FaArrowDown className="text-red-500 text-xs" />
                                            {feature}
                                        </li>
                                    ))}
                                </ul>
                                <p className="text-amber-600 text-sm font-bold">
                                    השינוי ייכנס לתוקף מיד לאחר התשלום. קרדיטי AI שלא נוצלו יאופסו.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tier Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                    <TierCard
                        tier="basic"
                        title="Basic"
                        subtitle="מערכת בסיסית מלאה"
                        monthlyPrice={pricing.basic?.monthly || 450}
                        yearlyPrice={pricing.basic?.yearly || 4500}
                        aiCredits={pricing.basic?.ai_credits || 0}
                        features={pricing.basic?.features || ['תפריט דיגיטלי', 'ניהול הזמנות', 'דוחות בסיסיים']}
                        selected={selectedTier === 'basic'}
                        onSelect={() => handleTierSelect('basic')}
                        icon={<FaRocket />}
                        color="from-blue-500 to-indigo-600"
                        isCurrent={billing?.current_tier === 'basic' && isActive}
                    />
                    <TierCard
                        tier="pro"
                        title="Pro"
                        subtitle="מערכת + AI חכמה"
                        monthlyPrice={pricing.pro?.monthly || 600}
                        yearlyPrice={pricing.pro?.yearly || 5000}
                        aiCredits={pricing.pro?.ai_credits || 500}
                        features={pricing.pro?.features || ['תפריט דיגיטלי', 'ניהול הזמנות', 'דוחות מתקדמים', 'AI מתקדם', 'תמיכה מועדפת']}
                        selected={selectedTier === 'pro'}
                        onSelect={() => handleTierSelect('pro')}
                        icon={<FaBrain />}
                        color="from-amber-500 to-orange-600"
                        badge="מומלץ"
                        isCurrent={billing?.current_tier === 'pro' && isActive}
                    />
                </div>

                {/* Billing Cycle Toggle */}
                <div className="max-w-md mx-auto">
                    <div className="bg-white rounded-3xl p-2 shadow-sm border border-gray-100 flex gap-2">
                        <button
                            onClick={() => setBillingCycle('monthly')}
                            className={`flex-1 py-4 px-6 rounded-2xl font-bold text-sm transition-all ${billingCycle === 'monthly'
                                ? 'bg-brand-primary text-white shadow-lg'
                                : 'text-gray-600 hover:bg-gray-50'
                                }`}
                        >
                            <div className="text-center">
                                <div>חיוב חודשי</div>
                                <div className="text-xs font-medium opacity-80 mt-1">חיוב אוטומטי חודשי</div>
                            </div>
                        </button>
                        <button
                            onClick={() => setBillingCycle('yearly')}
                            className={`flex-1 py-4 px-6 rounded-2xl font-bold text-sm transition-all relative ${billingCycle === 'yearly'
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg'
                                : 'text-gray-600 hover:bg-gray-50'
                                }`}
                        >
                            <div className="text-center">
                                <div>חיוב שנתי</div>
                                <div className="text-xs font-medium opacity-80 mt-1">תשלום חד-פעמי</div>
                            </div>
                            <span className="absolute -top-2 -left-2 bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                                חיסכון
                            </span>
                        </button>
                    </div>
                </div>

                {/* Payment Summary */}
                <div className="bg-white rounded-3xl p-10 shadow-2xl border border-gray-100 max-w-2xl mx-auto">
                    <div className="text-center space-y-6">
                        <div>
                            <p className="text-gray-400 font-bold text-sm uppercase tracking-widest mb-4">סיכום חשבון לתשלום</p>

                            {/* Line items */}
                            <div className="bg-gray-50 rounded-2xl p-5 text-right space-y-3 mb-4">
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-gray-900">
                                        ₪{planPrice.toLocaleString()}
                                    </span>
                                    <span className="text-gray-600 font-medium">
                                        חבילת {selectedTier === 'pro' ? 'Pro' : 'Basic'} ({billingCycle === 'yearly' ? 'שנתי' : 'חודשי'})
                                    </span>
                                </div>

                                <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
                                    <span className="text-2xl font-black text-gray-900">
                                        ₪{totalAmount.toLocaleString()}
                                    </span>
                                    <span className="font-black text-gray-900 text-lg">סה"כ</span>
                                </div>
                            </div>

                            <p className="text-gray-500 font-medium text-sm">
                                {billingCycle === 'yearly'
                                    ? 'תשלום חד-פעמי לשנה מלאה'
                                    : 'חיוב חודשי אוטומטי'
                                }
                            </p>

                            {selectedTier === 'pro' && (
                                <p className="text-brand-primary font-bold text-sm mt-2">
                                    כולל {pricing.pro?.ai_credits || 500} קרדיטים AI בחודש
                                </p>
                            )}

                            {billingCycle === 'yearly' && (
                                <p className="text-emerald-600 font-bold text-sm mt-2">
                                    חיסכון של {(((pricing[selectedTier]?.monthly || 0) * 12) - (pricing[selectedTier]?.yearly || 0)).toLocaleString()}₪ לשנה
                                </p>
                            )}
                        </div>

                        <button
                            onClick={handleActivate}
                            className={`w-full px-12 py-6 text-white rounded-2xl font-black text-xl hover:shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-4 ${isDowngrade
                                ? 'bg-gradient-to-r from-amber-500 to-orange-600'
                                : 'bg-gradient-to-r from-brand-primary to-brand-secondary'
                                }`}
                        >
                            {isDowngrade ? 'המשך לשדרוג לאחור' : isActive ? 'עדכן תוכנית' : 'המשך לתשלום'}
                            <FaArrowLeft className="animate-pulse" />
                        </button>

                        <p className="text-xs font-medium text-gray-400 flex items-center justify-center gap-2">
                            <FaLock /> תשלום מאובטח בהצפנה מלאה
                        </p>
                    </div>
                </div>

                <div className="text-center">
                    <button
                        onClick={() => navigate('/admin/dashboard')}
                        className="text-gray-500 hover:text-gray-900 font-medium transition-colors inline-flex items-center gap-2"
                    >
                        <FaArrowLeft className="text-sm" /> חזור לדשבורד
                    </button>
                </div>
            </div>
        </div>
    );
}

function TierCard({ tier, title, subtitle, monthlyPrice, yearlyPrice, aiCredits, features, selected, onSelect, icon, color, badge, isCurrent }) {
    return (
        <button
            onClick={onSelect}
            className={`relative w-full text-right bg-white rounded-3xl p-8 border-2 transition-all duration-300 ${selected
                ? 'border-brand-primary shadow-2xl shadow-brand-primary/20 scale-105'
                : 'border-gray-200 hover:border-brand-primary/50 hover:shadow-xl'
                }`}
        >
            {badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-orange-600 text-white px-4 py-1 rounded-full text-xs font-black uppercase shadow-lg">
                    {badge}
                </div>
            )}

            {isCurrent && (
                <div className="absolute top-3 right-3 bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-black uppercase">
                    תוכנית נוכחית
                </div>
            )}

            <div className={`w-16 h-16 bg-gradient-to-br ${color} rounded-2xl flex items-center justify-center text-3xl text-white mb-4 mx-auto shadow-lg transition-transform ${selected ? 'scale-110' : ''}`}>
                {icon}
            </div>

            <h3 className="text-2xl font-black text-gray-900 text-center mb-2">{title}</h3>
            <p className="text-sm text-gray-500 font-medium text-center mb-4">{subtitle}</p>

            <div className="bg-gray-50 rounded-2xl p-4 mb-6">
                <div className="text-center">
                    <span className="text-3xl font-black text-gray-900">₪{monthlyPrice}</span>
                    <span className="text-gray-500 text-sm font-bold">/חודש</span>
                </div>
                <div className="text-center mt-1 text-xs text-gray-400 font-medium">
                    או ₪{yearlyPrice?.toLocaleString()}/שנה
                </div>
            </div>

            {aiCredits > 0 ? (
                <div className="bg-gradient-to-r from-brand-primary/10 to-brand-secondary/10 border border-brand-primary/20 rounded-xl p-3 mb-6">
                    <p className="text-brand-primary font-black text-sm text-center">
                        {aiCredits} קרדיטים AI לחודש
                    </p>
                </div>
            ) : (
                <div className="bg-gray-100 border border-gray-200 rounded-xl p-3 mb-6">
                    <p className="text-gray-500 font-bold text-sm text-center">
                        ללא תכונות AI
                    </p>
                </div>
            )}

            <ul className="space-y-2.5 text-right">
                {features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700 font-medium">
                        <FaCheckCircle className={`mt-0.5 flex-shrink-0 ${selected ? 'text-brand-primary' : 'text-gray-400'}`} />
                        <span>{feature}</span>
                    </li>
                ))}
            </ul>

            {selected && (
                <div className="absolute top-4 left-4 text-brand-primary">
                    <FaCheckCircle size={24} />
                </div>
            )}
        </button>
    );
}
