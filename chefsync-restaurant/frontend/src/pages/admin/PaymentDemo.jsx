import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { activateSubscription } from '../../services/subscriptionService';
import { FaCreditCard, FaLock, FaCheckCircle, FaArrowRight, FaShieldAlt } from 'react-icons/fa';

/**
 * דף תשלום לדוגמא - Demo Payment Gateway
 * ניתן להחליף אחר כך ל-HyperPay או כל ספק תשלומים אחר
 */
export default function PaymentDemo() {
    const navigate = useNavigate();
    const location = useLocation();
    const { tier, billingCycle, amount } = location.state || {};

    const [processing, setProcessing] = useState(false);
    const [cardNumber, setCardNumber] = useState('');
    const [expiry, setExpiry] = useState('');
    const [cvv, setCvv] = useState('');
    const [cardName, setCardName] = useState('');

    // אם אין פרטי הזמנה, חזור לדף המנויים
    if (!tier || !billingCycle || !amount) {
        navigate('/admin/paywall');
        return null;
    }

    const handlePayment = async (e) => {
        e.preventDefault();

        // ולידציות בסיסיות
        if (cardNumber.replace(/\s/g, '').length !== 16) {
            toast.error('מספר כרטיס לא תקין');
            return;
        }

        if (!expiry.match(/^\d{2}\/\d{2}$/)) {
            toast.error('תוקף לא תקין (MM/YY)');
            return;
        }

        if (cvv.length !== 3) {
            toast.error('CVV לא תקין');
            return;
        }

        setProcessing(true);

        try {
            // 🔄 כאן תחליף לאינטגרציה עם HyperPay
            // לדוגמא: await initiateHyperPayTransaction(...)

            // סימולציה של תשלום (2 שניות)
            await new Promise(resolve => setTimeout(resolve, 2000));

            // הפעלת המנוי בבקאנד
            await activateSubscription(billingCycle, tier);

            toast.success('התשלום עבר בהצלחה! 🎉');
            navigate('/admin/dashboard');
        } catch (error) {
            const message = error.response?.data?.message || 'שגיאה בעיבוד התשלום';
            toast.error(message);
        } finally {
            setProcessing(false);
        }
    };

    const formatCardNumber = (value) => {
        const cleaned = value.replace(/\s/g, '');
        const chunks = cleaned.match(/.{1,4}/g) || [];
        return chunks.join(' ').substring(0, 19);
    };

    const formatExpiry = (value) => {
        const cleaned = value.replace(/\D/g, '');
        if (cleaned.length >= 2) {
            return `${cleaned.substring(0, 2)}/${cleaned.substring(2, 4)}`;
        }
        return cleaned;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-gray-100 py-12 px-4">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 bg-brand-primary/10 text-brand-primary px-6 py-3 rounded-full mb-4">
                        <FaShieldAlt />
                        <span className="font-bold">תשלום מאובטח</span>
                    </div>
                    <h1 className="text-4xl font-black text-gray-900 mb-2">השלמת רכישה</h1>
                    <p className="text-gray-500 font-medium">
                        חיבור מאובטח 256-bit SSL Encryption
                    </p>
                </div>

                <div className="grid lg:grid-cols-5 gap-8">
                    {/* Payment Form */}
                    <div className="lg:col-span-3">
                        <div className="bg-white rounded-3xl shadow-2xl p-8">
                            <div className="flex items-center gap-3 mb-6 pb-6 border-b">
                                <div className="w-12 h-12 bg-brand-primary rounded-xl flex items-center justify-center">
                                    <FaCreditCard className="text-white text-xl" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-gray-900">פרטי תשלום</h2>
                                    <p className="text-sm text-gray-500 font-medium">הזן את פרטי כרטיס האשראי</p>
                                </div>
                            </div>

                            <form onSubmit={handlePayment} className="space-y-6">
                                {/* Card Number */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        מספר כרטיס
                                    </label>
                                    <input
                                        type="text"
                                        value={cardNumber}
                                        onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                                        placeholder="1234 5678 9012 3456"
                                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-brand-primary focus:outline-none text-lg font-mono"
                                        required
                                    />
                                </div>

                                {/* Cardholder Name */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        שם בעל הכרטיס
                                    </label>
                                    <input
                                        type="text"
                                        value={cardName}
                                        onChange={(e) => setCardName(e.target.value)}
                                        placeholder="ישראל ישראלי"
                                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-brand-primary focus:outline-none text-lg"
                                        required
                                    />
                                </div>

                                {/* Expiry & CVV */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">
                                            תוקף
                                        </label>
                                        <input
                                            type="text"
                                            value={expiry}
                                            onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                                            placeholder="MM/YY"
                                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-brand-primary focus:outline-none text-lg font-mono"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">
                                            CVV
                                        </label>
                                        <input
                                            type="text"
                                            value={cvv}
                                            onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').substring(0, 3))}
                                            placeholder="123"
                                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-brand-primary focus:outline-none text-lg font-mono"
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="w-full bg-gradient-to-r from-brand-primary to-brand-secondary text-white py-4 rounded-xl font-black text-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                                >
                                    {processing ? (
                                        <>
                                            <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                                            מעבד תשלום...
                                        </>
                                    ) : (
                                        <>
                                            <FaLock />
                                            {billingCycle === 'yearly'
                                                ? `שלם ₪${amount.toLocaleString()} (חד-פעמי)`
                                                : `שלם ₪${amount.toLocaleString()}/חודש`
                                            }
                                            <FaArrowRight />
                                        </>
                                    )}
                                </button>

                                {/* Demo Notice */}
                                <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
                                    <p className="text-amber-800 text-sm font-bold text-center">
                                        🎭 זהו דף תשלום לדוגמא | ניתן להזין כל ערך
                                    </p>
                                </div>
                            </form>
                        </div>
                    </div>

                    {/* Order Summary */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-3xl shadow-2xl p-8 sticky top-8">
                            <h3 className="text-xl font-black text-gray-900 mb-6">סיכום הזמנה</h3>

                            <div className="space-y-4 mb-6 pb-6 border-b">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600 font-medium">תוכנית</span>
                                    <span className="font-bold text-gray-900">
                                        {tier === 'pro' ? 'Pro ⚡' : 'Basic 📦'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600 font-medium">מחזור חיוב</span>
                                    <span className="font-bold text-gray-900">
                                        {billingCycle === 'yearly' ? 'שנתי 🎁' : 'חודשי 📅'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600 font-medium">סוג תשלום</span>
                                    <span className="font-bold text-gray-900">
                                        {billingCycle === 'yearly' ? 'חד-פעמי' : 'חוזר חודשי'}
                                    </span>
                                </div>
                                {tier === 'pro' && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600 font-medium">קרדיטי AI</span>
                                        <span className="font-bold text-brand-primary">500/חודש 🤖</span>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2 mb-6">
                                <div className="flex justify-between items-center">
                                    <span className="text-xl font-black text-gray-900">סה"כ לתשלום</span>
                                    <span className="text-3xl font-black text-gray-900">
                                        ₪{amount.toLocaleString()}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-500 font-medium text-left">
                                    {billingCycle === 'yearly'
                                        ? '💳 תשלום חד-פעמי לשנה מלאה'
                                        : '🔄 חיוב חודשי אוטומטי'
                                    }
                                </p>
                            </div>

                            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4 space-y-2">
                                <div className="flex items-center gap-2 text-emerald-700">
                                    <FaCheckCircle />
                                    <span className="font-bold text-sm">גישה מיידית למערכת</span>
                                </div>
                                <div className="flex items-center gap-2 text-emerald-700">
                                    <FaCheckCircle />
                                    <span className="font-bold text-sm">תמיכה טכנית מלאה</span>
                                </div>
                                <div className="flex items-center gap-2 text-emerald-700">
                                    <FaCheckCircle />
                                    <span className="font-bold text-sm">ללא התחייבות - ביטול בכל עת</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
