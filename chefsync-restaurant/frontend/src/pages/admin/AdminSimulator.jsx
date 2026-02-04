import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaShoppingCart, FaUtensils, FaEye, FaInfoCircle, FaPlay, FaMobileAlt } from 'react-icons/fa';
import AdminLayout from '../../layouts/AdminLayout';
import { useAdminAuth } from '../../context/AdminAuthContext';

/**
 * עמוד הסימולטור - נקודת כניסה לכל פיצ'רי ה-preview mode
 */
export default function AdminSimulator() {
    const { user } = useAdminAuth();
    const navigate = useNavigate();
    const tenantId = user?.restaurant?.tenant_id;

    const handleStartSimulation = () => {
        // ניקוי localStorage מקודם
        localStorage.removeItem('cart');
        localStorage.removeItem('activeOrder');
        localStorage.removeItem('customerInfo');

        // הגדרת מצב preview
        localStorage.setItem('isPreviewMode', 'true');
        if (tenantId) {
            localStorage.setItem('tenantId', tenantId);
        }

        // ניווט לתפריט preview
        navigate('/admin/preview-menu');
    };

    return (
        <AdminLayout>
            <div className="max-w-4xl mx-auto space-y-8">
                {/* כותרת */}
                <div className="text-center space-y-3">
                    <div className="bg-purple-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
                        <FaMobileAlt className="text-4xl text-purple-600" />
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-black text-gray-900">סימולטור הזמנות</h1>
                    <p className="text-gray-600 text-lg">
                        בדוק את חוויית הלקוח במסעדה שלך ללא הזמנות אמיתיות
                    </p>
                </div>

                {/* הסבר על הסימולטור */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-6 space-y-4">
                    <div className="flex items-start gap-3">
                        <FaInfoCircle className="text-2xl text-blue-600 shrink-0 mt-1" />
                        <div className="flex-1 space-y-3">
                            <h2 className="text-xl font-black text-gray-900">מה זה סימולטור?</h2>
                            <p className="text-gray-700 leading-relaxed">
                                הסימולטור מאפשר לך לחוות את תהליך ההזמנה כמו לקוח אמיתי - מעיון בתפריט, דרך הוספת פריטים לעגלה, ועד לביצוע הזמנה ומעקב אחר הסטטוס שלה.
                            </p>
                            <div className="bg-white/70 rounded-xl p-4 space-y-2">
                                <p className="font-bold text-gray-900 text-sm">💡 יתרונות הסימולטור:</p>
                                <ul className="text-sm text-gray-700 space-y-1.5 list-disc list-inside mr-2">
                                    <li>בדיקת התפריט והמחירים כפי שהלקוח רואה</li>
                                    <li>ניסיון תהליך ההזמנה המלא כולל תוספות וגרסאות</li>
                                    <li>הזמנות מסומנות כ"דוגמה" ולא משפיעות על דוחות ומכירות</li>
                                    <li>אפשרות לבדוק את עמוד מעקב ההזמנה</li>
                                    <li>זיהוי בעיות בחוויית המשתמש לפני שלקוחות נתקלים בהן</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                {/* מסלול הסימולציה */}
                <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 p-8 space-y-6">
                    <h2 className="text-2xl font-black text-gray-900 text-center mb-6">מסלול הסימולציה</h2>

                    <div className="space-y-4">
                        {/* שלב 1 */}
                        <div className="flex items-start gap-4 p-4 bg-purple-50 rounded-xl border-2 border-purple-200">
                            <div className="bg-purple-600 text-white w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shrink-0">
                                1
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <FaUtensils className="text-purple-600" />
                                    <h3 className="font-bold text-gray-900">עיון בתפריט</h3>
                                </div>
                                <p className="text-sm text-gray-700">צפה בתפריט המלא עם כל הקטגוריות והפריטים</p>
                            </div>
                        </div>

                        {/* שלב 2 */}
                        <div className="flex items-start gap-4 p-4 bg-blue-50 rounded-xl border-2 border-blue-200">
                            <div className="bg-blue-600 text-white w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shrink-0">
                                2
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <FaShoppingCart className="text-blue-600" />
                                    <h3 className="font-bold text-gray-900">הוספה לעגלה</h3>
                                </div>
                                <p className="text-sm text-gray-700">הוסף פריטים לעגלה, בחר תוספות וגרסאות</p>
                            </div>
                        </div>

                        {/* שלב 3 */}
                        <div className="flex items-start gap-4 p-4 bg-green-50 rounded-xl border-2 border-green-200">
                            <div className="bg-green-600 text-white w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shrink-0">
                                3
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <FaPlay className="text-green-600" />
                                    <h3 className="font-bold text-gray-900">ביצוע הזמנה</h3>
                                </div>
                                <p className="text-sm text-gray-700">השלם את תהליך ההזמנה ללא צורך באימות טלפון</p>
                            </div>
                        </div>

                        {/* שלב 4 */}
                        <div className="flex items-start gap-4 p-4 bg-indigo-50 rounded-xl border-2 border-indigo-200">
                            <div className="bg-indigo-600 text-white w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shrink-0">
                                4
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <FaEye className="text-indigo-600" />
                                    <h3 className="font-bold text-gray-900">מעקב אחר הזמנה</h3>
                                </div>
                                <p className="text-sm text-gray-700">צפה בעמוד סטטוס ההזמנה כפי שהלקוח רואה אותו</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* כפתור התחלה */}
                <div className="text-center">
                    <button
                        onClick={handleStartSimulation}
                        className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-12 py-5 rounded-2xl hover:from-purple-700 hover:to-indigo-700 transition-all shadow-2xl hover:shadow-3xl transform hover:scale-105 active:scale-95 inline-flex items-center gap-4 font-black text-xl"
                    >
                        <FaPlay className="text-2xl" />
                        <span>התחל סימולציה</span>
                    </button>
                    <p className="text-sm text-gray-500 mt-4">
                        הסימולציה תתחיל מעמוד התפריט
                    </p>
                </div>

                {/* הערה חשובה */}
                <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                        <span className="text-2xl shrink-0">⚠️</span>
                        <div>
                            <p className="font-bold text-amber-900 mb-1">שים לב:</p>
                            <p className="text-sm text-amber-800">
                                הזמנות שנוצרות בסימולטור מסומנות כ"הזמנות דוגמה" ויופיעו עם תג סגול בעמוד ניהול ההזמנות. הן לא נכללות בדוחות ולא שולחות התראות.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
