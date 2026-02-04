import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaEye, FaArrowRight, FaCheckCircle, FaExternalLinkAlt } from 'react-icons/fa';
import AdminLayout from '../../layouts/AdminLayout';
import { useAdminAuth } from '../../context/AdminAuthContext';

/**
 * עמוד תצוגה מקדימה של סטטוס הזמנה - מנהל מסעדה
 * מציג קישור לעמוד הסטטוס הרגיל במקום להציג אותו כאן
 */
export default function AdminOrderStatusPreview() {
    const { user } = useAdminAuth();
    const navigate = useNavigate();
    const { orderId } = useParams();
    const tenantId = user?.restaurant?.tenant_id;

    // יצירת הקישור לעמוד סטטוס רגיל
    const statusPageUrl = `/${tenantId}/order-status/${orderId}`;

    const handleOpenStatusPage = () => {
        // פתיחה בטאב חדש
        window.open(statusPageUrl, '_blank');
    };

    const handleGoToStatusPage = () => {
        // ניווט באותו טאב
        localStorage.removeItem('isPreviewMode');
        // וודא שtenantId מעודכן מהמשתמש המחובר
        if (user?.restaurant?.tenant_id) {
            localStorage.setItem('tenantId', user.restaurant.tenant_id);
        }
        window.location.href = statusPageUrl;
    };

    return (
        <AdminLayout>
            {/* באנר הצלחה עליון */}
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-4 sm:p-6 rounded-2xl shadow-2xl mb-6 -mt-4">
                <div className="flex items-start gap-4">
                    <div className="bg-white/20 p-3 rounded-xl shrink-0">
                        <FaCheckCircle className="text-3xl" />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-xl sm:text-2xl font-black mb-2">✅ הזמנת דוגמה נשלחה בהצלחה!</h2>
                        <p className="text-green-100 text-sm sm:text-base leading-relaxed">
                            זוהי <strong>הזמנת דוגמה</strong> שנוצרה במצב תצוגה מקדימה. ההזמנה מסומנת במערכת ולא תשפיע על הדוחות והסטטיסטיקות.
                        </p>
                    </div>
                    <button
                        onClick={() => {
                            localStorage.removeItem('isPreviewMode');
                            // וודא שtenantId מעודכן מהמשתמש המחובר
                            if (user?.restaurant?.tenant_id) {
                                localStorage.setItem('tenantId', user.restaurant.tenant_id);
                            }
                            navigate('/admin/dashboard');
                        }}
                        className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 text-sm whitespace-nowrap"
                    >
                        <FaArrowRight />
                        <span className="hidden sm:inline">חזרה לדשבורד</span>
                    </button>
                </div>
            </div>

            {/* כרטיס עם קישור לעמוד הסטטוס */}
            <div className="max-w-3xl mx-auto">
                <div className="bg-white rounded-2xl shadow-lg border-2 border-blue-200 p-8 text-center space-y-6">
                    <div className="bg-blue-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
                        <FaEye className="text-4xl text-blue-600" />
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-2xl font-black text-gray-900">צפייה בסטטוס ההזמנה</h3>
                        <p className="text-gray-600">
                            הזמנה #{orderId} נוצרה בהצלחה
                        </p>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700">
                        <p className="mb-2">כדי לצפות בעמוד סטטוס ההזמנה כפי שהלקוח רואה אותו, לחץ על אחד מהכפתורים:</p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button
                            onClick={handleOpenStatusPage}
                            className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-4 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 inline-flex items-center justify-center gap-3 font-bold"
                        >
                            <FaExternalLinkAlt className="text-lg" />
                            <span>פתח בטאב חדש</span>
                        </button>

                        <button
                            onClick={handleGoToStatusPage}
                            className="bg-white border-2 border-blue-600 text-blue-600 px-8 py-4 rounded-xl hover:bg-blue-50 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 inline-flex items-center justify-center gap-3 font-bold"
                        >
                            <FaEye className="text-lg" />
                            <span>עבור לעמוד הסטטוס</span>
                        </button>
                    </div>

                    <div className="pt-4 border-t border-gray-200">
                        <button
                            onClick={() => {
                                localStorage.removeItem('isPreviewMode');
                                // וודא שtenantId מעודכן מהמשתמש המחובר
                                if (user?.restaurant?.tenant_id) {
                                    localStorage.setItem('tenantId', user.restaurant.tenant_id);
                                }
                                navigate('/admin/preview-menu');
                            }}
                            className="text-blue-600 hover:text-blue-700 font-bold hover:underline"
                        >
                            ← חזור לתפריט התצוגה המקדימה
                        </button>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
