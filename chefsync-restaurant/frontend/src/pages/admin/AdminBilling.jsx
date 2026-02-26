import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { getBillingInfo } from '../../services/subscriptionService';
import {
    FaCreditCard,
    FaReceipt,
    FaCrown,
    FaArrowLeft,
    FaCheckCircle,
    FaClock,
    FaExclamationTriangle,
    FaRocket,
    FaBrain,
    FaCalendarAlt
} from 'react-icons/fa';

const STATUS_LABELS = {
    trial: 'תקופת ניסיון',
    active: 'פעיל',
    suspended: 'מושהה',
    expired: 'פג תוקף',
    cancelled: 'מבוטל',
};
const STATUS_COLORS = {
    trial: 'bg-blue-100 text-blue-700',
    active: 'bg-emerald-100 text-emerald-700',
    suspended: 'bg-red-100 text-red-700',
    expired: 'bg-gray-100 text-gray-600',
    cancelled: 'bg-gray-100 text-gray-600',
};

export default function AdminBilling() {
    const navigate = useNavigate();
    const [billing, setBilling] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const { data } = await getBillingInfo();
                setBilling(data?.data || {});
            } catch (error) {
                toast.error(error.response?.data?.message || 'שגיאה בטעינת נתוני חיוב');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    if (loading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-gray-500 font-bold">טוען נתוני חשבון...</p>
                </div>
            </div>
        );
    }

    if (!billing) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <p className="text-gray-500 font-bold">לא נמצאו נתוני חשבון</p>
            </div>
        );
    }

    const tierIcon = billing.current_tier === 'pro'
        ? <FaBrain className="text-amber-500" />
        : <FaRocket className="text-blue-500" />;

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-gray-900">חשבון וחיוב</h1>
                    <p className="text-gray-500 font-medium mt-1">ניהול התוכנית, תשלומים ופרטי חיוב</p>
                </div>
            </div>

            {/* Current Plan Card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center">
                        {tierIcon}
                    </div>
                    <div>
                        <h2 className="font-black text-gray-900 text-lg">תוכנית נוכחית</h2>
                        <span className={`inline-flex px-3 py-0.5 rounded-full text-xs font-black ${STATUS_COLORS[billing.subscription_status] || 'bg-gray-100 text-gray-600'}`}>
                            {STATUS_LABELS[billing.subscription_status] || billing.subscription_status}
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                    <InfoBox label="תוכנית" value={billing.current_tier === 'pro' ? 'Pro' : 'Basic'} />
                    <InfoBox label="מחזור" value={billing.current_plan === 'yearly' ? 'שנתי' : 'חודשי'} />
                    <InfoBox
                        label="חיוב הבא"
                        value={billing.next_payment_at ? new Date(billing.next_payment_at).toLocaleDateString('he-IL') : '-'}
                    />
                    <InfoBox
                        label="בתוקף עד"
                        value={billing.subscription_ends_at ? new Date(billing.subscription_ends_at).toLocaleDateString('he-IL') : '-'}
                    />
                </div>

                {billing.subscription_status === 'trial' && billing.days_left_in_trial > 0 && (
                    <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 mb-4">
                        <div className="flex items-center gap-2">
                            <FaClock className="text-blue-500" />
                            <p className="text-blue-700 font-bold text-sm">
                                נותרו {billing.days_left_in_trial} ימים בתקופת הניסיון
                            </p>
                        </div>
                    </div>
                )}

                {billing.subscription_status === 'suspended' && (
                    <div className="bg-red-50 rounded-xl p-4 border border-red-200 mb-4">
                        <div className="flex items-center gap-2">
                            <FaExclamationTriangle className="text-red-500" />
                            <p className="text-red-700 font-bold text-sm">
                                המנוי הושהה עקב כשלון תשלום. יש לעדכן אמצעי תשלום.
                            </p>
                        </div>
                    </div>
                )}

                <button
                    onClick={() => navigate('/admin/paywall')}
                    className="bg-gradient-to-r from-brand-primary to-brand-secondary text-white px-6 py-3 rounded-xl font-black text-sm hover:shadow-lg transition-all flex items-center gap-2"
                >
                    <FaCrown size={14} />
                    {billing.subscription_status === 'trial' ? 'הפעל מנוי' : 'שנה תוכנית / שדרג'}
                </button>
            </div>

            {/* Payment Method */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center">
                        <FaCreditCard className="text-brand-primary" />
                    </div>
                    <h2 className="font-black text-gray-900 text-lg">אמצעי תשלום</h2>
                </div>

                {billing.has_card_on_file ? (
                    <div className="flex items-center gap-4">
                        <div className="bg-gray-50 rounded-xl px-5 py-3 border border-gray-200">
                            <p className="text-gray-400 text-xs font-bold mb-1">כרטיס אשראי</p>
                            <p className="font-black text-gray-900 text-lg tracking-widest">**** **** **** {billing.card_last4}</p>
                        </div>
                    </div>
                ) : (
                    <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                        <div className="flex items-center gap-2">
                            <FaExclamationTriangle className="text-amber-500" />
                            <p className="text-amber-700 font-bold text-sm">
                                לא הוגדר אמצעי תשלום. יש לבצע תשלום כדי לשמור כרטיס.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Setup Fee Status */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center">
                        <FaReceipt className="text-gray-500" />
                    </div>
                    <h2 className="font-black text-gray-900 text-lg">דמי הקמת חיבור מסוף</h2>
                </div>

                {billing.setup_fee_charged ? (
                    <div className="flex items-center gap-2 text-emerald-600">
                        <FaCheckCircle />
                        <span className="font-bold text-sm">דמי ההקמה נגבו</span>
                    </div>
                ) : (
                    <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                        <p className="text-blue-700 font-bold text-sm mb-1">
                            דמי הקמה: ₪{billing.pending_setup_fee} (חד-פעמי)
                        </p>
                        <p className="text-blue-600 text-xs font-medium">
                            ייגבו בתשלום הראשון באשראי.
                            {billing.current_tier === 'pro' ? ' (₪100 לחבילת Pro)' : ' (₪200 לחבילת Basic)'}
                        </p>
                    </div>
                )}
            </div>

            {/* Outstanding Amount */}
            {billing.outstanding_amount > 0 && (
                <div className="bg-red-50 rounded-2xl border border-red-200 p-6">
                    <div className="flex items-center gap-3 mb-3">
                        <FaExclamationTriangle className="text-red-500 text-xl" />
                        <h2 className="font-black text-red-800 text-lg">יתרת חוב</h2>
                    </div>
                    <p className="text-red-700 font-black text-2xl mb-2">₪{billing.outstanding_amount}</p>
                    <p className="text-red-600 text-sm font-medium">יתרה זו תיגבה בחיוב הבא.</p>
                </div>
            )}

            {/* Recent Payments */}
            {billing.recent_payments?.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center">
                            <FaCalendarAlt className="text-gray-500" />
                        </div>
                        <h2 className="font-black text-gray-900 text-lg">תשלומים אחרונים</h2>
                    </div>

                    <div className="space-y-3">
                        {billing.recent_payments.map((payment, i) => (
                            <div key={i} className="flex items-center justify-between bg-gray-50 rounded-xl p-4 border border-gray-100">
                                <div className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full ${payment.status === 'paid' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                                    <div>
                                        <p className="font-bold text-gray-900 text-sm">₪{payment.amount}</p>
                                        <p className="text-gray-400 text-xs">
                                            {payment.method === 'hyp_credit_card' ? 'אשראי' : payment.method === 'manual' ? 'ידני' : payment.method}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-left">
                                    <p className="text-gray-500 text-xs font-bold">
                                        {payment.paid_at ? new Date(payment.paid_at).toLocaleDateString('he-IL') : '-'}
                                    </p>
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${payment.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                                        {payment.status === 'paid' ? 'שולם' : payment.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="text-center pt-4">
                <button
                    onClick={() => navigate('/admin/dashboard')}
                    className="text-gray-500 hover:text-gray-900 font-medium transition-colors inline-flex items-center gap-2"
                >
                    <FaArrowLeft className="text-sm" /> חזור לדשבורד
                </button>
            </div>
        </div>
    );
}

function InfoBox({ label, value }) {
    return (
        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
            <p className="text-gray-400 text-xs font-bold mb-1">{label}</p>
            <p className="font-black text-gray-900 text-sm">{value}</p>
        </div>
    );
}
