import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { activateSubscription, createPaymentSession } from '../../services/subscriptionService';
import {
    FaCreditCard,
    FaCheckCircle,
    FaArrowRight,
    FaShieldAlt,
    FaArrowLeft,
    FaExclamationTriangle,
    FaSpinner,
    FaArrowDown
} from 'react-icons/fa';

export default function PaymentDemo() {
    const navigate = useNavigate();
    const location = useLocation();
    const {
        tier,
        billingCycle,
        amount,
        planAmount,
        setupFee = 0,
        isDowngrade,
        previousTier
    } = location.state || {};

    const [processing, setProcessing] = useState(false);
    const [checkingHyp, setCheckingHyp] = useState(true);
    const [hypReady, setHypReady] = useState(false);
    const [hypBillingData, setHypBillingData] = useState(null);

    if (!tier || !billingCycle || !amount) {
        navigate('/admin/paywall');
        return null;
    }

    useEffect(() => {
        const checkHyp = async () => {
            try {
                const res = await createPaymentSession(billingCycle, tier);
                const data = res.data;

                if (data.hyp_ready && data.payment_url) {
                    setHypReady(true);
                    setHypBillingData({
                        planAmount: data.plan_amount,
                        setupFee: data.setup_fee,
                        totalAmount: data.total_amount,
                        includesSetupFee: data.includes_setup_fee,
                    });
                    window.location.href = data.payment_url;
                    return;
                }

                setHypReady(false);
            } catch (error) {
                console.error('Failed to check HYP:', error);
                setHypReady(false);
            } finally {
                setCheckingHyp(false);
            }
        };

        checkHyp();
    }, [tier, billingCycle]);

    const handleActivate = async () => {
        setProcessing(true);

        try {
            await activateSubscription(billingCycle, tier);
            toast.success('המנוי הופעל בהצלחה!');
            navigate('/admin/dashboard');
        } catch (error) {
            const message = error.response?.data?.message || 'שגיאה בהפעלת המנוי';
            toast.error(message);
        } finally {
            setProcessing(false);
        }
    };

    if (checkingHyp || hypReady) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-gray-100 flex items-center justify-center">
                <div className="text-center">
                    <FaSpinner className="animate-spin text-brand-primary text-4xl mx-auto mb-4" />
                    <p className="text-gray-600 font-medium">
                        {hypReady ? 'מעביר לדף תשלום מאובטח...' : 'בודק זמינות תשלום...'}
                    </p>
                </div>
            </div>
        );
    }

    const displayPlanAmount = planAmount || amount;
    const displayTotal = displayPlanAmount;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-gray-100 py-12 px-4">
            <div className="max-w-xl mx-auto">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 bg-brand-primary/10 text-brand-primary px-6 py-3 rounded-full mb-4">
                        <FaShieldAlt />
                        <span className="font-bold">
                            {isDowngrade ? 'שדרוג לאחור' : 'הפעלת מנוי'}
                        </span>
                    </div>
                    <h1 className="text-4xl font-black text-gray-900 mb-2">אישור והפעלה</h1>
                </div>

                {/* Downgrade warning */}
                {isDowngrade && (
                    <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 mb-6">
                        <div className="flex items-start gap-3">
                            <FaArrowDown className="text-amber-500 mt-1 flex-shrink-0" />
                            <div>
                                <p className="font-black text-amber-800 mb-1">מעבר מ-{previousTier === 'pro' ? 'Pro' : 'Basic'} ל-{tier === 'pro' ? 'Pro' : 'Basic'}</p>
                                <p className="text-amber-700 text-sm font-medium">
                                    לאחר האישור, תכונות Pro כמו AI, דו"חות מתקדמים ותמיכה עדיפות לא יהיו זמינות.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="bg-white rounded-3xl shadow-2xl p-8 mb-6">
                    <h3 className="text-xl font-black text-gray-900 mb-6">סיכום חשבון</h3>

                    <div className="space-y-4 mb-6 pb-6 border-b">
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-gray-900">
                                {tier === 'pro' ? 'Pro' : 'Basic'}
                            </span>
                            <span className="text-gray-600 font-medium">תוכנית</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-gray-900">
                                {billingCycle === 'yearly' ? 'שנתי' : 'חודשי'}
                            </span>
                            <span className="text-gray-600 font-medium">מחזור חיוב</span>
                        </div>
                        {tier === 'pro' && (
                            <div className="flex justify-between items-center">
                                <span className="font-bold text-brand-primary">500/חודש</span>
                                <span className="text-gray-600 font-medium">קרדיטי AI</span>
                            </div>
                        )}
                    </div>

                    {/* Billing breakdown */}
                    <div className="space-y-3 mb-6">
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-gray-900">₪{displayPlanAmount.toLocaleString()}</span>
                            <span className="text-gray-600 font-medium">
                                חבילת {tier === 'pro' ? 'Pro' : 'Basic'} ({billingCycle === 'yearly' ? 'שנתי' : 'חודשי'})
                            </span>
                        </div>

                        <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
                            <span className="text-3xl font-black text-gray-900">
                                ₪{displayTotal.toLocaleString()}
                            </span>
                            <span className="text-xl font-black text-gray-900">סה"כ</span>
                        </div>

                        <p className="text-sm text-gray-500 font-medium text-left">
                            {billingCycle === 'yearly'
                                ? 'תשלום חד-פעמי לשנה מלאה'
                                : 'חיוב חודשי'
                            }
                        </p>
                    </div>

                    {/* V page notice */}
                    <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 mb-6">
                        <div className="flex items-start gap-3">
                            <FaExclamationTriangle className="text-amber-500 mt-0.5 flex-shrink-0" />
                            <p className="text-amber-800 text-sm font-medium">
                                כרגע ניתן להפעיל את המנוי ללא תשלום מיידי. החיוב יבוצע בהמשך לאחר הגדרת אמצעי תשלום.
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={handleActivate}
                        disabled={processing}
                        className={`w-full text-white py-4 rounded-xl font-black text-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 ${isDowngrade
                            ? 'bg-gradient-to-r from-amber-500 to-orange-600'
                            : 'bg-gradient-to-r from-brand-primary to-brand-secondary'
                            }`}
                    >
                        {processing ? (
                            <>
                                <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin" />
                                מפעיל מנוי...
                            </>
                        ) : (
                            <>
                                <FaCheckCircle />
                                {isDowngrade ? 'אישור שדרוג לאחור' : 'הפעל מנוי'}
                                <FaArrowLeft />
                            </>
                        )}
                    </button>

                    <div className="mt-4 space-y-2">
                        <div className="flex items-center gap-2 text-emerald-600 justify-center">
                            <FaCheckCircle size={12} />
                            <span className="font-medium text-sm">גישה מיידית למערכת</span>
                        </div>
                        <div className="flex items-center gap-2 text-emerald-600 justify-center">
                            <FaCheckCircle size={12} />
                            <span className="font-medium text-sm">ביטול בכל עת</span>
                        </div>
                    </div>
                </div>

                <div className="text-center">
                    <button
                        onClick={() => navigate('/admin/paywall')}
                        className="text-gray-500 hover:text-gray-900 font-medium transition-colors inline-flex items-center gap-2"
                    >
                        <FaArrowRight className="text-sm" /> חזור לבחירת תוכנית
                    </button>
                </div>
            </div>
        </div>
    );
}
