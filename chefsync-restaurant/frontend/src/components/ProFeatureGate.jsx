import { useNavigate } from 'react-router-dom';
import { useRestaurantStatus } from '../context/RestaurantStatusContext';
import AdminLayout from '../layouts/AdminLayout';
import { FaCrown, FaStar, FaArrowLeft } from 'react-icons/fa';

export default function ProFeatureGate({ children, featureName = 'תכונה זו' }) {
    const navigate = useNavigate();
    const { subscriptionInfo } = useRestaurantStatus();
    const isBasic = subscriptionInfo?.tier === 'basic';

    if (!isBasic) return children || null;

    return (
        <AdminLayout>
            <div className="max-w-2xl mx-auto py-16 px-4">
                <div className="bg-white rounded-[3rem] shadow-xl border-2 border-amber-100 p-12 text-center space-y-8">
                    <div className="w-24 h-24 bg-gradient-to-br from-amber-400 to-orange-500 rounded-[2rem] flex items-center justify-center text-white shadow-xl mx-auto">
                        <FaCrown size={40} />
                    </div>

                    <div className="space-y-3">
                        <h2 className="text-3xl font-black text-gray-900">
                            {featureName}
                        </h2>
                        <p className="text-gray-500 font-medium text-lg leading-relaxed max-w-md mx-auto">
                            תכונה זו זמינה במסלול Pro בלבד.
                            <br />
                            שדרגו את המנוי וקבלו גישה מלאה לכל הכלים המתקדמים.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                        <button
                            onClick={() => navigate('/admin/paywall')}
                            className="px-10 py-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-2xl font-black text-lg hover:shadow-2xl hover:scale-105 transition-all flex items-center gap-3"
                        >
                            <FaStar /> שדרג ל-Pro
                        </button>
                        <button
                            onClick={() => navigate('/admin/dashboard')}
                            className="px-8 py-4 bg-gray-100 text-gray-600 rounded-2xl font-black hover:bg-gray-200 transition-all flex items-center gap-2"
                        >
                            חזרה לדשבורד <FaArrowLeft size={14} />
                        </button>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
