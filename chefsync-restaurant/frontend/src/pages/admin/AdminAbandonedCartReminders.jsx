import { useState, useEffect } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import { useAdminAuth } from '../../context/AdminAuthContext';
import api from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import { FaBell, FaShoppingCart, FaChevronRight, FaInfoCircle, FaPhone } from 'react-icons/fa';

export default function AdminAbandonedCartReminders() {
    const { getAuthHeaders } = useAdminAuth();
    const [restaurant, setRestaurant] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [enabled, setEnabled] = useState(false);

    useEffect(() => {
        fetchRestaurant();
    }, []);

    const fetchRestaurant = async () => {
        setLoading(true);
        try {
            const headers = getAuthHeaders();
            const res = await api.get('/admin/restaurant', { headers });
            const r = res.data?.restaurant;
            setRestaurant(r);
            setEnabled(!!r?.abandoned_cart_reminders_enabled);
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || 'שגיאה בטעינת נתונים');
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = async () => {
        setSaving(true);
        try {
            const headers = getAuthHeaders();
            const newVal = !enabled;
            await api.put('/admin/restaurant', { abandoned_cart_reminders_enabled: newVal }, { headers });
            setEnabled(newVal);
            setRestaurant((prev) => prev ? { ...prev, abandoned_cart_reminders_enabled: newVal } : null);
            toast.success(newVal ? 'תזכורות סל נטוש הופעלו' : 'תזכורות סל נטוש בוטלו');
        } catch (err) {
            toast.error(err.response?.data?.message || 'שגיאה בשמירה');
        } finally {
            setSaving(false);
        }
    };

    const balance = restaurant?.abandoned_cart_sms_balance ?? 0;

    if (loading) {
        return (
            <AdminLayout>
                <div className="max-w-[700px] mx-auto px-4 py-12 flex justify-center">
                    <div className="w-10 h-10 border-4 border-brand-primary/20 border-t-brand-primary rounded-full animate-spin" />
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="max-w-[700px] mx-auto px-4 sm:px-6 py-6">
                <div className="mb-8">
                    <h1 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
                            <FaShoppingCart size={20} />
                        </div>
                        תזכורות סל נטוש
                    </h1>
                    <p className="text-sm text-gray-500 mt-1 mr-[52px]">
                        שלח תזכורת SMS ללקוחות שהשאירו פריטים בסל ולא סיימו את ההזמנה
                    </p>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-gray-100">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-black text-gray-900">הפעלת תזכורות</h2>
                                <p className="text-sm text-gray-500 mt-0.5">שליחת הודעות אוטומטית ללקוחות עם סל נטוש</p>
                            </div>
                            <button
                                onClick={handleToggle}
                                disabled={saving}
                                className={`relative w-12 h-7 rounded-full transition-colors ${enabled ? 'bg-brand-primary' : 'bg-gray-200'}`}
                                role="switch"
                                aria-checked={enabled}
                            >
                                <span
                                    className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all duration-200 ${enabled ? 'right-1' : 'left-1'}`}
                                />
                            </button>
                        </div>
                    </div>

                    <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                    <FaBell size={14} />
                                    יתרת הודעות
                                </h3>
                                <p className="text-xs text-gray-500 mt-1">הודעות SMS שנותרו בחבילה</p>
                            </div>
                            <div className="text-2xl font-black text-gray-900">{balance}</div>
                        </div>
                    </div>

                    <div className="p-6">
                        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl">
                            <FaInfoCircle className="text-amber-500 shrink-0 mt-0.5" size={18} />
                            <div>
                                <p className="text-sm font-bold text-amber-900">רכישת חבילות</p>
                                <p className="text-sm text-amber-700 mt-1">
                                    לרכישת חבילות הודעות נוספות (50 / 100 / 500), צור קשר עם צוות התמיכה.
                                </p>
                                <a
                                    href="mailto:support@chefsync.co.il?subject=רכישת חבילת תזכורות סל נטוש"
                                    className="inline-flex items-center gap-2 mt-3 text-sm font-bold text-amber-700 hover:text-amber-900"
                                >
                                    <FaPhone size={12} />
                                    צור קשר לתמיכה
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
