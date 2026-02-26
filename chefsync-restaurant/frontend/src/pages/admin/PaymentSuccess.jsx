import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaCheckCircle, FaArrowLeft, FaSpinner } from 'react-icons/fa';
import { getSubscriptionStatus, checkPendingPayment } from '../../services/subscriptionService';

export default function PaymentSuccess() {
    const navigate = useNavigate();
    const [verified, setVerified] = useState(false);
    const [verifying, setVerifying] = useState(true);
    const [subData, setSubData] = useState(null);

    useEffect(() => {
        const verify = async () => {
            try {
                const { data } = await getSubscriptionStatus();
                const info = data?.data || {};
                setSubData(info);

                if (info.subscription_status === 'active' && info.has_access) {
                    setVerified(true);
                } else {
                    // redirect probably failed — try recovery
                    try {
                        const recoveryRes = await checkPendingPayment();
                        if (recoveryRes.data?.recovered) {
                            const { data: freshData } = await getSubscriptionStatus();
                            setSubData(freshData?.data || {});
                            setVerified(true);
                            return;
                        }
                    } catch { }
                    setVerified(false);
                }
            } catch {
                setVerified(false);
            } finally {
                setVerifying(false);
            }
        };

        const timer = setTimeout(verify, 1500);
        return () => clearTimeout(timer);
    }, []);

    if (verifying) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-green-50 to-gray-100 flex items-center justify-center px-4">
                <div className="text-center">
                    <FaSpinner className="animate-spin text-brand-primary text-4xl mx-auto mb-4" />
                    <p className="text-gray-600 font-medium">מאמת את התשלום...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-green-50 to-gray-100 flex items-center justify-center px-4">
            <div className="max-w-md w-full text-center">
                <div className="bg-white rounded-3xl shadow-2xl p-8">
                    <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <FaCheckCircle className="text-emerald-500 text-4xl" />
                    </div>

                    <h1 className="text-3xl font-black text-gray-900 mb-3">התשלום בוצע בהצלחה!</h1>

                    {verified && subData ? (
                        <div className="mb-8">
                            <p className="text-gray-600 mb-4">
                                המנוי שלך הופעל. כעת יש לך גישה מלאה לכל הכלים במערכת.
                            </p>
                            <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-2">
                                <div className="flex justify-between">
                                    <span className="font-bold text-gray-900">{subData.tier === 'pro' ? 'Pro' : 'Basic'}</span>
                                    <span className="text-gray-500">תוכנית</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-bold text-gray-900">{subData.subscription_plan === 'yearly' ? 'שנתי' : 'חודשי'}</span>
                                    <span className="text-gray-500">מחזור חיוב</span>
                                </div>
                                {subData.subscription_ends_at && (
                                    <div className="flex justify-between">
                                        <span className="font-bold text-gray-900">
                                            {new Date(subData.subscription_ends_at).toLocaleDateString('he-IL')}
                                        </span>
                                        <span className="text-gray-500">בתוקף עד</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <p className="text-gray-600 mb-8">
                            המנוי שלך הופעל. כעת יש לך גישה מלאה לכל הכלים במערכת.
                        </p>
                    )}

                    <button
                        onClick={() => navigate('/admin/dashboard')}
                        className="w-full bg-gradient-to-r from-brand-primary to-brand-secondary text-white py-4 rounded-xl font-black text-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all flex items-center justify-center gap-3"
                    >
                        כניסה לפאנל
                        <FaArrowLeft />
                    </button>
                </div>
            </div>
        </div>
    );
}
