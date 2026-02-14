import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { activateSubscription, createPaymentSession } from '../../services/subscriptionService';
import { FaCreditCard, FaCheckCircle, FaArrowRight, FaShieldAlt, FaArrowLeft, FaExclamationTriangle, FaSpinner } from 'react-icons/fa';

/**
 * דף תשלום - Phase 2: בודק אם HYP מוגדר ומפנה לדף תשלום
 * אם HYP לא מוגדר: מציג V page (הפעלה ידנית ללא חיוב)
 */
export default function PaymentDemo() {
    const navigate = useNavigate();
    const location = useLocation();
    const { tier, billingCycle, amount } = location.state || {};

    const [processing, setProcessing] = useState(false);
    const [checkingHyp, setCheckingHyp] = useState(true);
    const [hypReady, setHypReady] = useState(false);

    // אם אין פרטי הזמנה, חזור לדף המנויים
    if (!tier || !billingCycle || !amount) {
        navigate('/admin/paywall');
        return null;
    }

    // בדיקת זמינות HYP בעלייה
    useEffect(() => {
        const checkHyp = async () => {
            try {
                const res = await createPaymentSession(billingCycle, tier);
                const data = res.data;

                if (data.hyp_ready && data.payment_url) {
                    // HYP מוגדר – redirect ישיר לדף תשלום
                    setHypReady(true);
                    window.location.href = data.payment_url;
                    return;
                }

                // HYP לא מוגדר – V page
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

    // מסך טעינה בזמן בדיקת HYP
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

    // V page – HYP לא מוגדר
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-gray-100 py-12 px-4">
            <div className="max-w-xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 bg-brand-primary/10 text-brand-primary px-6 py-3 rounded-full mb-4">
                        <FaShieldAlt />
                        <span className="font-bold">הפעלת מנוי</span>
                    </div>
                    <h1 className="text-4xl font-black text-gray-900 mb-2">אישור והפעלה</h1>
                </div>

                {/* Order Summary */}
                <div className="bg-white rounded-3xl shadow-2xl p-8 mb-6">
                    <h3 className="text-xl font-black text-gray-900 mb-6">סיכום המנוי</h3>

                    <div className="space-y-4 mb-6 pb-6 border-b">
                        <div className="flex justify-between items-center">
                            <span className="text-gray-600 font-medium">תוכנית</span>
                            <span className="font-bold text-gray-900">
                                {tier === 'pro' ? 'Pro' : 'Basic'}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-600 font-medium">מחזור חיוב</span>
                            <span className="font-bold text-gray-900">
                                {billingCycle === 'yearly' ? 'שנתי' : 'חודשי'}
                            </span>
                        </div>
                        {tier === 'pro' && (
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600 font-medium">קרדיטי AI</span>
                                <span className="font-bold text-brand-primary">500/חודש</span>
                            </div>
                        )}
                    </div>

                    <div className="space-y-2 mb-6">
                        <div className="flex justify-between items-center">
                            <span className="text-xl font-black text-gray-900">סה"כ</span>
                            <span className="text-3xl font-black text-gray-900">
                                ₪{amount.toLocaleString()}
                            </span>
                        </div>
                        <p className="text-sm text-gray-500 font-medium text-left">
                            {billingCycle === 'yearly'
                                ? 'תשלום חד-פעמי לשנה מלאה'
                                : 'חיוב חודשי'
                            }
                        </p>
                    </div>

                    {/* Temporary notice – V page */}
                    <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 mb-6">
                        <div className="flex items-start gap-3">
                            <FaExclamationTriangle className="text-amber-500 mt-0.5 flex-shrink-0" />
                            <p className="text-amber-800 text-sm font-medium">
                                כרגע ניתן להפעיל את המנוי ללא תשלום מיידי. החיוב יבוצע בהמשך לאחר הגדרת אמצעי תשלום.
                            </p>
                        </div>
                    </div>

                    {/* Activate Button */}
                    <button
                        onClick={handleActivate}
                        disabled={processing}
                        className="w-full bg-gradient-to-r from-brand-primary to-brand-secondary text-white py-4 rounded-xl font-black text-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                    >
                        {processing ? (
                            <>
                                <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                                מפעיל מנוי...
                            </>
                        ) : (
                            <>
                                <FaCheckCircle />
                                הפעל מנוי
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

                {/* Back Button */}
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
