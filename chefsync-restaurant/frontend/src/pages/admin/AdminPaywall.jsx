import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { activateSubscription, getSubscriptionStatus } from '../../services/subscriptionService';

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
    const headline = isTrialActive
        ? `עוד ${status?.days_left_in_trial ?? 0} ימים לניסיון החינמי`
        : 'פג תוקף הניסיון - יש להפעיל מנוי';

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center px-4 py-10">
            <div className="max-w-3xl w-full bg-white shadow-xl rounded-2xl border border-gray-100 p-8 space-y-6">
                <div className="space-y-2 text-right">
                    <p className="text-xs text-brand-primary font-semibold">TakeEat Admin</p>
                    <h1 className="text-3xl font-bold text-gray-900">גישה נעצרה זמנית</h1>
                    <p className="text-gray-600 leading-relaxed">{headline}. ההפעלה תפתח את הגישה לכל המודולים, כולל תפריט, הזמנות וצוות.</p>
                </div>

                {loading ? (
                    <div className="text-center text-gray-500">טוען סטטוס...</div>
                ) : (
                    <>
                        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-right text-sm text-gray-700 space-y-2">
                            <p className="font-semibold">פרטי מצב נוכחי</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                <Info label="סטטוס" value={status?.subscription_status === 'trial' ? 'ניסיון' : status?.subscription_status || 'לא פעיל'} />
                                <Info label="מסלול" value={status?.subscription_plan === 'annual' ? 'שנתי' : 'חודשי'} />
                                <Info label="סיום ניסיון" value={status?.trial_ends_at ? new Date(status.trial_ends_at).toLocaleDateString('he-IL') : '-'} />
                                <Info label="חידוש הבא" value={status?.subscription_ends_at ? new Date(status.subscription_ends_at).toLocaleDateString('he-IL') : '-'} />
                            </div>
                            {status?.outstanding_amount > 0 && (
                                <p className="text-red-600 font-medium">סכום ממתין לחיוב: ₪{Number(status.outstanding_amount).toLocaleString()}</p>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <PlanCard
                                title="חודשי"
                                price={MONTHLY_PRICE}
                                subtitle="חיוב חודשי גמיש"
                                selected={planType === 'monthly'}
                                onSelect={() => setPlanType('monthly')}
                            />
                            <PlanCard
                                title="שנתי"
                                price={ANNUAL_PRICE}
                                subtitle="חיסכון מול חודשי"
                                selected={planType === 'annual'}
                                onSelect={() => setPlanType('annual')}
                            />
                        </div>

                        <div className="bg-brand-primary/5 border border-brand-primary/20 rounded-xl p-4 text-right text-sm text-gray-800 space-y-1">
                            <p className="font-semibold text-brand-primary">מה קורה בתשלום?</p>
                            <p>- אם הניסיון עוד פעיל, החיוב יחל בסיומו ותישארו פתוחים בינתיים.</p>
                            <p>- אם הניסיון פג, ההפעלה תפתח גישה מידית לתקופת המסלול שבחרתם.</p>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-3 justify-between">
                            <div className="text-right">
                                <p className="text-sm text-gray-600">חיוב לפי מסלול נבחר</p>
                                <p className="text-2xl font-bold text-gray-900">₪{planType === 'annual' ? ANNUAL_PRICE : MONTHLY_PRICE}</p>
                            </div>
                            <button
                                onClick={handleActivate}
                                disabled={activating}
                                className="px-6 py-3 bg-brand-primary text-white rounded-lg font-semibold hover:bg-brand-primary/90 disabled:opacity-50"
                            >
                                {activating ? 'מפעיל...' : 'הפעל מנוי עכשיו'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function PlanCard({ title, price, subtitle, selected, onSelect }) {
    return (
        <button
            type="button"
            onClick={onSelect}
            className={`w-full text-right border rounded-xl p-4 hover:border-brand-primary transition ${selected ? 'border-brand-primary bg-brand-primary/5' : 'border-gray-200'}`}
        >
            <p className="text-sm text-gray-600 mb-1">{title}</p>
            <p className="text-2xl font-bold text-gray-900">₪{price}</p>
            {subtitle && <p className="text-xs text-green-600">{subtitle}</p>}
        </button>
    );
}

function Info({ label, value }) {
    return (
        <div className="flex flex-col items-end">
            <span className="text-gray-500 text-xs">{label}</span>
            <span className="text-gray-900 text-sm font-semibold">{value}</span>
        </div>
    );
}
