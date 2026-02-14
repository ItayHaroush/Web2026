import { useNavigate } from 'react-router-dom';
import { FaCheckCircle, FaArrowLeft } from 'react-icons/fa';

/**
 * דף הצלחת תשלום - HYP redirect חזרה
 */
export default function PaymentSuccess() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-green-50 to-gray-100 flex items-center justify-center px-4">
            <div className="max-w-md w-full text-center">
                <div className="bg-white rounded-3xl shadow-2xl p-8">
                    <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <FaCheckCircle className="text-emerald-500 text-4xl" />
                    </div>

                    <h1 className="text-3xl font-black text-gray-900 mb-3">התשלום בוצע בהצלחה!</h1>
                    <p className="text-gray-600 mb-8">
                        המנוי שלך הופעל. כעת יש לך גישה מלאה לכל הכלים במערכת.
                    </p>

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
