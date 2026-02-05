import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { useCart } from '../../context/CartContext';
import AdminLayout from '../../layouts/AdminLayout';
import MenuPage from '../MenuPage';
import apiClient from '../../services/apiClient';
import { FaEye, FaArrowRight, FaInfoCircle, FaShoppingBag } from 'react-icons/fa';

/**
 * AdminMenuPreview - תצוגה מקדימה של תפריט המסעדה
 * מציג את התפריט בדיוק כפי שהלקוחות רואים אותו, אבל:
 * - עם banner אזהרה שזה מצב תצוגה מקדימה
 * - הזמנות שנוצרות מסומנות כ-is_test=true ולא נספרות במטריקות
 */
export default function AdminMenuPreview() {
    const navigate = useNavigate();
    const { user } = useAdminAuth();
    const { getItemCount } = useCart();
    const [tenantId, setTenantId] = useState(null);
    const totalCartItems = getItemCount();

    useEffect(() => {
        // ✅ וידוא: רק המשתמש המחובר יכול לראות את המסעדה שלו
        if (user?.restaurant?.tenant_id) {
            const userTenantId = user.restaurant.tenant_id;

            // ✅ כפה את ה-tenantId של המשתמש המחובר - לא מה-localStorage!
            setTenantId(userTenantId);
            localStorage.setItem('tenantId', userTenantId);
            localStorage.setItem('isPreviewMode', 'true');

            // הוספת header למצב preview
            apiClient.defaults.headers.common['X-Preview-Mode'] = 'true';

            console.log('✅ AdminMenuPreview: Setting tenantId =', userTenantId);
        } else {
            // ❌ אין משתמש מחובר או אין מסעדה - חזור לדף ניהול
            console.error('❌ No user or restaurant found in preview mode');
            navigate('/admin/restaurant');
        }

        // ניקוי כשיוצאים מהקומפוננט
        return () => {
            delete apiClient.defaults.headers.common['X-Preview-Mode'];
            localStorage.removeItem('isPreviewMode');
        };
    }, [user, navigate]);

    const handleBackToAdmin = () => {
        // ניקוי מצב preview
        localStorage.removeItem('isPreviewMode');
        delete apiClient.defaults.headers.common['X-Preview-Mode'];
        // וודא שtenantId מעודכן מהמשתמש המחובר
        if (user?.restaurant?.tenant_id) {
            localStorage.setItem('tenantId', user.restaurant.tenant_id);
        }
        navigate('/admin/dashboard');
    };

    // חכה עד שיש tenantId
    if (!tenantId) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
        );
    }

    return (
        <AdminLayout>
            {/* Banner אזהרה - מצב תצוגה מקדימה */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl shadow-lg mb-6 overflow-hidden">
                <div className="px-6 py-4">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-3">
                            <FaEye className="text-2xl flex-shrink-0" />
                            <div>
                                <h2 className="font-bold text-lg">מצב תצוגה מקדימה</h2>
                                <p className="text-sm text-purple-100">
                                    זוהי תצוגה של התפריט כפי שהלקוחות רואים אותו. הזמנות שתבצע כאן לא יספרו במערכת.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleBackToAdmin}
                            className="flex items-center gap-2 bg-white text-purple-600 px-4 py-2 rounded-lg font-semibold hover:bg-purple-50 transition-colors"
                        >
                            <span>חזרה לניהול</span>
                            <FaArrowRight />
                        </button>
                    </div>
                </div>
            </div>

            {/* אזהרה נוספת */}
            <div className="bg-yellow-50 border-r-4 border-yellow-400 p-4 rounded-lg flex items-start gap-3 mb-6">
                <FaInfoCircle className="text-yellow-600 text-xl mt-0.5 flex-shrink-0" />
                <div className="text-sm text-gray-700">
                    <p className="font-semibold mb-1">שים לב:</p>
                    <ul className="list-disc list-inside space-y-1 text-gray-600">
                        <li>כל הזמנה שתבצע תסומן כ"הזמנת דוגמה" ולא תופיע במונים ובדוחות</li>
                        <li>לא תשלח התראה למסעדה על הזמנות אלו</li>
                        <li>ניתן לבדוק את כל תהליך ההזמנה ללא השפעה על הנתונים האמיתיים</li>
                    </ul>
                </div>
            </div>

            {/* התפריט עצמו - ללא CustomerLayout כי אנחנו כבר ב-AdminLayout */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <MenuPage isPreviewMode={true} />
            </div>

            {/* כפתור עגלה מותאם אישית למצב preview - z-index גבוה יותר */}
            {totalCartItems > 0 && (
                <button
                    onClick={() => navigate('/admin/preview-cart')}
                    className="fixed bottom-20 md:bottom-6 left-4 md:left-6 z-[70] bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4 rounded-full shadow-2xl hover:from-purple-700 hover:to-indigo-700 transition-all active:scale-95"
                    aria-label="מעבר לסל הקניות (תצוגה מקדימה)"
                >
                    <FaShoppingBag className="text-2xl" />
                    <span className="absolute -top-2 -right-2 bg-yellow-400 text-purple-900 text-xs font-bold h-6 w-6 flex items-center justify-center rounded-full border-2 border-white">
                        {totalCartItems}
                    </span>
                </button>
            )}
        </AdminLayout>
    );
}
