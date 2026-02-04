import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaEye, FaArrowRight, FaExclamationTriangle } from 'react-icons/fa';
import AdminLayout from '../../layouts/AdminLayout';
import CartPage from '../CartPage';
import { useAdminAuth } from '../../context/AdminAuthContext';

/**
 * עמוד תצוגה מקדימה של סל קניות - מנהל מסעדה
 * עוטף את CartPage במסגרת AdminLayout עם באנרים מתאימים
 */
export default function AdminCartPreview() {
    const { user } = useAdminAuth();
    const navigate = useNavigate();
    const tenantId = user?.restaurant?.tenant_id;

    useEffect(() => {
        // וידוא שיש tenant_id
        if (tenantId) {
            localStorage.setItem('tenantId', tenantId);
            localStorage.setItem('isPreviewMode', 'true');
        }
        // לא מנקים - נשמור את מצב preview בין דפים
    }, [tenantId]);

    return (
        <AdminLayout>
            {/* באנר אזהרה עליון */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4 sm:p-6 rounded-2xl shadow-2xl mb-6 -mt-4">
                <div className="flex items-start gap-4">
                    <div className="bg-white/20 p-3 rounded-xl shrink-0">
                        <FaEye className="text-3xl" />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-xl sm:text-2xl font-black mb-2">🔍 תצוגה מקדימה - סל קניות</h2>
                        <p className="text-purple-100 text-sm sm:text-base leading-relaxed">
                            אתה צופה בסל הקניות כפי שהלקוחות שלך רואים אותו. ההזמנות שתבצע כאן יסומנו כ<strong>הזמנות דוגמה</strong> ולא ישפיעו על הדוחות והמונים.
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
                        <span className="hidden sm:inline">חזור לניהול</span>
                    </button>
                </div>
            </div>

            {/* באנר מידע נוסף */}
            <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-yellow-400 rounded-xl p-4 mb-6 shadow-md">
                <div className="flex items-start gap-3">
                    <FaExclamationTriangle className="text-2xl text-yellow-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <h3 className="font-bold text-yellow-900 mb-1">💡 טיפ למנהל</h3>
                        <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
                            <li>אימות SMS ידולג אוטומטית במצב תצוגה</li>
                            <li>ההזמנה תסומן כ"הזמנת דוגמה" ולא תשפיע על הסטטיסטיקות</li>
                            <li>תוכל לראות את ההזמנה בעמוד ההזמנות עם סימון מיוחד</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* עמוד הסל עצמו */}
            <CartPage isPreviewMode={true} />
        </AdminLayout>
    );
}
