import { useNavigate, useSearchParams } from 'react-router-dom';
import { FaTimesCircle, FaArrowLeft, FaArrowRight } from 'react-icons/fa';

/**
 * דף שגיאת תשלום - HYP redirect חזרה
 */
export default function PaymentError() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const reason = searchParams.get('reason') || 'payment_declined';

    const reasonText = {
        payment_declined: 'התשלום נדחה על ידי חברת האשראי.',
        payment_not_approved: 'העסקה לא אושרה.',
        verification_failed: 'אימות העסקה נכשל.',
        restaurant_not_found: 'המסעדה לא נמצאה במערכת.',
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-red-50 to-gray-100 flex items-center justify-center px-4">
            <div className="max-w-md w-full text-center">
                <div className="bg-white rounded-3xl shadow-2xl p-8">
                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <FaTimesCircle className="text-red-500 text-4xl" />
                    </div>

                    <h1 className="text-3xl font-black text-gray-900 mb-3">התשלום נכשל</h1>
                    <p className="text-gray-600 mb-2">
                        {reasonText[reason] || reason}
                    </p>
                    <p className="text-gray-500 text-sm mb-8">
                        ניתן לנסות שוב או לפנות לתמיכה.
                    </p>

                    <div className="space-y-3">
                        <button
                            onClick={() => navigate('/admin/paywall')}
                            className="w-full bg-gradient-to-r from-brand-primary to-brand-secondary text-white py-4 rounded-xl font-black text-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all flex items-center justify-center gap-3"
                        >
                            נסה שוב
                            <FaArrowLeft />
                        </button>

                        <button
                            onClick={() => navigate('/admin/dashboard')}
                            className="w-full text-gray-500 hover:text-gray-900 font-medium transition-colors inline-flex items-center justify-center gap-2 py-2"
                        >
                            <FaArrowRight className="text-sm" /> חזור לפאנל
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
