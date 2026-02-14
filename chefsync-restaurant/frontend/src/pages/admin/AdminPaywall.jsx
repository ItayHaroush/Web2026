import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { activateSubscription, getSubscriptionStatus } from '../../services/subscriptionService';
import {
    FaLock,
    FaRocket,
    FaCheckCircle,
    FaClock,
    FaCalendarAlt,
    FaCreditCard,
    FaArrowLeft,
    FaCrown,
    FaGift,
    FaBrain,
    FaStar
} from 'react-icons/fa';

// תוכניות תמחור חדשות - משולבות עם AI
const PLANS = {
    basic: {
        monthly: 450,
        yearly: 4500,
        aiCredits: 0,
        features: [
            'ניהול תפריט מלא',
            'קבלת הזמנות ללא הגבלה',
            'ניהול עובדים',
            'דו"חות חודשיים',
            'תמיכה בדוא"ל'
        ]
    },
    pro: {
        monthly: 600,
        yearly: 5000,
        aiCredits: 500,
        trialAiCredits: 50, // קרדיטים מוגבלים בניסיון
        features: [
            '✨ כל התכונות של Basic',
            '🤖 500 קרדיטים AI לחודש',
            '📝 תיאורי מנות אוטומטיים',
            '📊 דו"חות בזמן אמת',
            '🎯 המלצות מחיר חכמות',
            '⚡ תמיכה עדיפות'
        ],
        trialNote: '* בתקופת הניסיון: 50 קרדיטים AI בלבד'
    }
};

export default function AdminPaywall() {
    const navigate = useNavigate();
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedTier, setSelectedTier] = useState('pro'); // basic or pro
    const [billingCycle, setBillingCycle] = useState('monthly'); // monthly or yearly
    const [registeredTier, setRegisteredTier] = useState(null); // הטיר שנבחר בהרשמה
    const [registeredPlan, setRegisteredPlan] = useState(null); // התוכנית שנבחרה בהרשמה

    useEffect(() => {
        try {
            const cached = localStorage.getItem('paywall_data');
            if (cached) {
                setStatus(JSON.parse(cached));
            }
        } catch { }

        const loadStatus = async () => {
            setLoading(true);
            try {
                const { data } = await getSubscriptionStatus();
                const statusData = data?.data || {};
                setStatus(statusData);
                try { localStorage.removeItem('paywall_data'); } catch { }

                // אם יש tier בהרשמה, נעול אותו (לא ניתן לשנות)
                const dbTier = statusData.tier || 'pro';
                const dbPlan = statusData.subscription_plan || 'monthly';

                setRegisteredTier(dbTier);
                setRegisteredPlan(dbPlan);
                setSelectedTier(dbTier);

                if (dbPlan.includes('yearly') || dbPlan.includes('annual')) {
                    setBillingCycle('yearly');
                } else {
                    setBillingCycle('monthly');
                }
            } catch (error) {
                const message = error.response?.data?.message || 'שגיאה בטעינת סטטוס מנוי';
                toast.error(message);
            } finally {
                setLoading(false);
            }
        };
        loadStatus();
    }, []);

    const handleActivate = () => {
        // חישוב הסכום לתשלום
        const amount = PLANS[selectedTier][billingCycle];

        // מעבר לדף תשלום עם הפרטים
        navigate('/admin/payment', {
            state: {
                tier: selectedTier,
                billingCycle,
                amount
            }
        });
    };

    const isTrialActive = status?.subscription_status === 'trial' && status?.days_left_in_trial > 0;

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 border-4 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-gray-500 font-black animate-pulse">בודק סטטוס מנוי...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-6 py-12 font-sans overflow-x-hidden relative">
            {/* Background Decorative elements */}
            <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-brand-primary/5 to-transparent -z-10" />
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-brand-primary/10 rounded-full blur-3xl -z-10" />
            <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -z-10" />

            <div className="max-w-4xl w-full space-y-10 animate-in fade-in zoom-in-95 duration-700">
                {/* Brand Header */}
                <div className="flex flex-col items-center text-center space-y-4">
                    <div className="w-20 h-20 bg-white shadow-2xl shadow-brand-primary/20 rounded-[2.5rem] flex items-center justify-center text-brand-primary border border-brand-primary/10">
                        <FaCrown size={36} />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-gray-900 tracking-tight">בחר את התוכנית המושלמת</h1>
                        <p className="text-gray-500 font-medium text-lg mt-2 max-w-2xl mx-auto leading-relaxed">
                            {isTrialActive
                                ? `נשארו ${status?.days_left_in_trial} ימים בתקופת הניסיון`
                                : 'שדרג עכשיו וקבל גישה מלאה לכל התכונות'}
                        </p>
                    </div>
                </div>

                {/* Tier Selection Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                    <TierCard
                        tier="basic"
                        title="Basic"
                        subtitle="מערכת בסיסית מלאה"
                        monthlyPrice={PLANS.basic.monthly}
                        yearlyPrice={PLANS.basic.yearly}
                        aiCredits={PLANS.basic.aiCredits}
                        features={PLANS.basic.features}
                        selected={selectedTier === 'basic'}
                        onSelect={() => setSelectedTier('basic')}
                        icon={<FaRocket />}
                        color="from-blue-500 to-indigo-600"
                    />
                    <TierCard
                        tier="pro"
                        title="Pro"
                        subtitle="מערכת + AI חכמה"
                        monthlyPrice={PLANS.pro.monthly}
                        yearlyPrice={PLANS.pro.yearly}
                        aiCredits={PLANS.pro.aiCredits}
                        features={PLANS.pro.features}
                        trialNote={PLANS.pro.trialNote}
                        selected={selectedTier === 'pro'}
                        onSelect={() => setSelectedTier('pro')}
                        icon={<FaBrain />}
                        color="from-amber-500 to-orange-600"
                        badge="מומלץ"
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

                {/* Payment Summary & Activation */}
                <div className="bg-white rounded-3xl p-10 shadow-2xl border border-gray-100 max-w-2xl mx-auto">
                    <div className="text-center space-y-6">
                        <div>
                            <p className="text-gray-400 font-bold text-sm uppercase tracking-widest mb-2">סה"כ לתשלום</p>
                            <div className="flex items-baseline gap-2 justify-center">
                                <span className="text-6xl font-black text-gray-900">
                                    ₪{billingCycle === 'yearly' ? PLANS[selectedTier].yearly.toLocaleString() : PLANS[selectedTier].monthly}
                                </span>
                                <span className="text-gray-400 font-bold text-xl">/{billingCycle === 'yearly' ? 'שנה' : 'חודש'}</span>
                            </div>
                            <p className="text-gray-500 font-medium text-sm mt-2">
                                {billingCycle === 'yearly'
                                    ? '💳 תשלום חד-פעמי לשנה מלאה'
                                    : '🔄 חיוב חודשי אוטומטי'
                                }
                            </p>
                            {selectedTier === 'pro' && (
                                <p className="text-brand-primary font-bold text-sm mt-2">
                                    🤖 כולל {PLANS.pro.aiCredits} קרדיטים AI בחודש
                                </p>
                            )}
                            {billingCycle === 'yearly' && (
                                <p className="text-emerald-600 font-bold text-sm mt-2">
                                    💰 חיסכון של {((PLANS[selectedTier].monthly * 12) - PLANS[selectedTier].yearly).toLocaleString()}₪ לשנה
                                </p>
                            )}
                        </div>

                        <button
                            onClick={handleActivate}
                            className="w-full px-12 py-6 bg-gradient-to-r from-brand-primary to-brand-secondary text-white rounded-2xl font-black text-xl hover:shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-4"
                        >
                            המשך לתשלום
                            <FaArrowLeft className="animate-pulse" />
                        </button>

                        <p className="text-xs font-medium text-gray-400 flex items-center justify-center gap-2">
                            <FaLock /> תשלום מאובטח בהצפנה מלאה
                        </p>
                    </div>
                </div>

                {/* Back Button */}
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

// Tier Selection Card (Basic or Pro)
function TierCard({ tier, title, subtitle, monthlyPrice, yearlyPrice, aiCredits, features, selected, onSelect, icon, color, badge, disabled = false, trialNote }) {
    return (
        <button
            onClick={onSelect}
            disabled={disabled}
            className={`relative w-full text-right bg-white rounded-3xl p-8 border-2 transition-all duration-300 ${selected
                ? 'border-brand-primary shadow-2xl shadow-brand-primary/20 scale-105'
                : disabled
                    ? 'border-gray-200 opacity-50 cursor-not-allowed'
                    : 'border-gray-200 hover:border-brand-primary/50 hover:shadow-xl'
                }`}
        >
            {badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-orange-600 text-white px-4 py-1 rounded-full text-xs font-black uppercase shadow-lg">
                    {badge}
                </div>
            )}

            <div className={`w-16 h-16 bg-gradient-to-br ${color} rounded-2xl flex items-center justify-center text-3xl text-white mb-4 mx-auto shadow-lg transition-transform ${selected ? 'scale-110' : ''
                }`}>
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
                    או ₪{yearlyPrice.toLocaleString()}/שנה
                </div>
            </div>

            {aiCredits > 0 ? (
                <div className="bg-gradient-to-r from-brand-primary/10 to-brand-secondary/10 border border-brand-primary/20 rounded-xl p-3 mb-6">
                    <p className="text-brand-primary font-black text-sm text-center">
                        🤖 {aiCredits} קרדיטים AI לחודש
                    </p>
                    {trialNote && (
                        <p className="text-xs text-gray-500 text-center mt-2 font-medium">
                            {trialNote}
                        </p>
                    )}
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

function PlanCard({ title, price, subtitle, selected, onSelect, icon, badge }) {
    // Legacy component - not used anymore, keeping for backward compatibility
    return null;
}

function InfoItem({ icon, label, value }) {
    // Legacy component - not used anymore
    return null;
}

