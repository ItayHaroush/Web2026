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
    FaGift
} from 'react-icons/fa';

const MONTHLY_PRICE = 600;
const ANNUAL_PRICE = 5000;

export default function AdminPaywall() {
    const navigate = useNavigate();
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activating, setActivating] = useState(false);
    const [planType, setPlanType] = useState('monthly');

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
                if (statusData.subscription_plan) {
                    setPlanType(statusData.subscription_plan);
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

    const handleActivate = async () => {
        setActivating(true);
        try {
            await activateSubscription(planType);
            toast.success('המנוי הופעל בהצלחה');
            navigate('/admin/dashboard');
        } catch (error) {
            const message = error.response?.data?.message || 'שגיאה בהפעלת המנוי';
            toast.error(message);
        } finally {
            setActivating(false);
        }
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
                        <h1 className="text-4xl font-black text-gray-900 tracking-tight">שדרוג ל-Premium</h1>
                        <p className="text-gray-500 font-medium text-lg mt-2 max-w-lg mx-auto leading-relaxed">
                            {isTrialActive
                                ? `נהנית מהגרסה החינמית? נשארו לך עוד ${status?.days_left_in_trial} ימים.`
                                : 'תקופת הניסיון הסתיימה. כדי להמשיך להשתמש במערכת, יש להפעיל מנוי.'}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                    {/* Left Column: Status info */}
                    <div className="lg:col-span-5 space-y-8 order-2 lg:order-1">
                        <div className="bg-white rounded-[3rem] p-8 shadow-sm border border-gray-100 space-y-8">
                            <h3 className="text-xl font-black text-gray-900 flex items-center gap-3">
                                <FaClock className="text-amber-500" /> מצב מנוי נוכחי
                            </h3>

                            <div className="space-y-6">
                                <InfoItem
                                    icon={<FaRocket className="text-indigo-500" />}
                                    label="סטטוס"
                                    value={status?.subscription_status === 'trial' ? 'תקופת ניסיון' : 'לא פעיל'}
                                />
                                <InfoItem
                                    icon={<FaCalendarAlt className="text-emerald-500" />}
                                    label="סיום התנסות"
                                    value={status?.trial_ends_at ? new Date(status.trial_ends_at).toLocaleDateString('he-IL') : '-'}
                                />
                                {status?.outstanding_amount > 0 && (
                                    <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100">
                                        <p className="text-rose-600 font-black text-sm">סכום ממתין לחיוב: ₪{Number(status.outstanding_amount).toLocaleString()}</p>
                                    </div>
                                )}
                            </div>

                            <div className="pt-6 border-t border-gray-50 space-y-4">
                                <p className="text-xs font-black text-gray-400 uppercase tracking-widest">מה מקבלים?</p>
                                <ul className="space-y-3">
                                    {[
                                        'ניהול תפריט מלא ללא הגבלה',
                                        'מערכת ניהול הזמנות בזמן אמת',
                                        'ניהול צוות עובדים והרשאות',
                                        'דוחות מכירה חודשיים',
                                        'ליווי ותמיכה טכנית VIP'
                                    ].map((feature, i) => (
                                        <li key={i} className="flex items-center gap-3 text-sm font-bold text-gray-700">
                                            <FaCheckCircle className="text-emerald-500 shrink-0" /> {feature}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        <div className="bg-indigo-600 rounded-[3rem] p-8 text-white shadow-xl shadow-indigo-200 space-y-4 relative overflow-hidden group">
                            <div className="absolute -right-10 -bottom-10 opacity-10 group-hover:scale-110 transition-transform duration-700">
                                <FaGift size={180} />
                            </div>
                            <h4 className="text-lg font-black flex items-center gap-2">
                                <FaGift /> הטבה בלעדית
                            </h4>
                            <p className="text-indigo-100 text-sm font-medium leading-relaxed">בבחירת מסלול שנתי מקבלים חודשיים שלמים במתנה (חיסכון של ₪1,200)!</p>
                        </div>
                    </div>

                    {/* Right Column: Pricing Plans */}
                    <div className="lg:col-span-7 space-y-8 order-1 lg:order-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <PlanCard
                                title="מסלול חודשי"
                                price={MONTHLY_PRICE}
                                subtitle="ללא התחייבות, חיוב חודשי"
                                selected={planType === 'monthly'}
                                onSelect={() => setPlanType('monthly')}
                                icon={<FaCreditCard />}
                            />
                            <PlanCard
                                title="מסלול שנתי"
                                price={ANNUAL_PRICE}
                                subtitle="הכי משתלם! חיסכון ענק"
                                selected={planType === 'annual'}
                                onSelect={() => setPlanType('annual')}
                                icon={<FaStar />}
                                badge="פופולרי"
                            />
                        </div>

                        <div className="bg-white rounded-[3.5rem] p-10 shadow-2xl shadow-gray-200/50 border border-gray-100 space-y-10 relative overflow-hidden">
                            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                                <div className="text-center md:text-right">
                                    <p className="text-gray-400 font-bold text-sm uppercase tracking-widest mb-1">סה"כ לתשלום</p>
                                    <div className="flex items-baseline gap-2 justify-center md:justify-end">
                                        <span className="text-5xl font-black text-gray-900 tracking-tighter">₪{planType === 'annual' ? ANNUAL_PRICE : MONTHLY_PRICE}</span>
                                        <span className="text-gray-400 font-bold text-lg">/{planType === 'annual' ? 'שנה' : 'חודש'}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={handleActivate}
                                    disabled={activating}
                                    className="w-full md:w-auto px-12 py-6 bg-brand-primary text-white rounded-[2rem] font-black text-xl hover:bg-brand-dark transition-all shadow-xl shadow-brand-primary/20 active:scale-95 flex items-center justify-center gap-4 disabled:opacity-50"
                                >
                                    {activating ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            מפעיל מנוי...
                                        </>
                                    ) : (
                                        <>
                                            הפעל מנוי עכשיו
                                            <FaArrowLeft className="animate-pulse" />
                                        </>
                                    )}
                                </button>
                            </div>

                            <div className="text-center md:text-right pt-6 border-t border-gray-50">
                                <p className="text-xs font-medium text-gray-400 flex items-center justify-center md:justify-end gap-2">
                                    <FaLock className="inline" /> מאובטח בסטנדרט תעשייתי. החיוב יתבצע באופן אוטומטי.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function PlanCard({ title, price, subtitle, selected, onSelect, icon, badge }) {
    return (
        <button
            type="button"
            onClick={onSelect}
            className={`relative w-full text-right bg-white rounded-[2.5rem] p-8 border-2 transition-all duration-500 flex flex-col gap-5 group overflow-hidden ${selected
                    ? 'border-brand-primary shadow-2xl shadow-brand-primary/10 -translate-y-1'
                    : 'border-gray-100 hover:border-brand-primary/30 hover:shadow-xl'
                }`}
        >
            {badge && (
                <div className="absolute top-0 left-0 bg-brand-primary text-white px-5 py-2 rounded-br-2xl text-[10px] font-black uppercase tracking-widest shadow-lg">
                    {badge}
                </div>
            )}

            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition-all duration-500 ${selected ? 'bg-brand-primary text-white scale-110 rotate-3' : 'bg-gray-50 text-gray-400'
                }`}>
                {icon}
            </div>

            <div>
                <p className={`text-lg font-black transition-colors ${selected ? 'text-brand-primary' : 'text-gray-900 group-hover:text-brand-primary'}`}>{title}</p>
                <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-3xl font-black text-gray-900 tracking-tighter">₪{price}</span>
                    <span className="text-gray-400 font-bold text-xs">{title.includes('שנתי') ? '/שנה' : '/חודש'}</span>
                </div>
                <p className="text-[11px] font-medium text-gray-400 mt-2">{subtitle}</p>
            </div>

            {selected && (
                <div className="absolute top-6 left-6 text-brand-primary animate-in zoom-in duration-300">
                    <FaCheckCircle size={24} />
                </div>
            )}
        </button>
    );
}

function InfoItem({ icon, label, value }) {
    return (
        <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center text-xl shrink-0">
                {icon}
            </div>
            <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">{label}</p>
                <p className="text-base font-black text-gray-900">{value}</p>
            </div>
        </div>
    );
}
