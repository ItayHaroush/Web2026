import { useCallback, useEffect, useState } from 'react';
import SuperAdminLayout from '../../layouts/SuperAdminLayout';
import api from '../../services/apiClient';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { toast } from 'react-hot-toast';
import {
    FaCoins,
    FaPlus,
    FaEdit,
    FaTrash,
    FaSync,
    FaCalendarAlt,
    FaObjectGroup,
} from 'react-icons/fa';

export default function SuperAdminManualBilling() {
    const { getAuthHeaders } = useAdminAuth();
    const [restaurants, setRestaurants] = useState([]);
    const [restaurantId, setRestaurantId] = useState('');
    const [loadingRestaurants, setLoadingRestaurants] = useState(true);
    const [payments, setPayments] = useState([]);
    const [loadingPayments, setLoadingPayments] = useState(false);
    const [nextCharge, setNextCharge] = useState('');
    const [savingCharge, setSavingCharge] = useState(false);

    const [newPay, setNewPay] = useState({
        amount: '',
        paid_at: new Date().toISOString().slice(0, 16),
        type: 'subscription',
        method: 'manual',
        reference: '',
    });

    const [editing, setEditing] = useState(null);
    const [editForm, setEditForm] = useState({ amount: '', reference: '', paid_at: '', method: '' });

    const fetchRestaurants = useCallback(async () => {
        setLoadingRestaurants(true);
        try {
            const res = await api.get('/super-admin/billing/restaurants', {
                headers: getAuthHeaders(),
                params: { per_page: 200 },
            });
            const data = res.data?.restaurants?.data || [];
            setRestaurants(data);
        } catch (e) {
            toast.error('שגיאה בטעינת מסעדות');
        } finally {
            setLoadingRestaurants(false);
        }
    }, [getAuthHeaders]);

    const fetchPayments = useCallback(async (rid) => {
        if (!rid) {
            setPayments([]);
            return;
        }
        setLoadingPayments(true);
        try {
            const res = await api.get(`/super-admin/billing/restaurants/${rid}/payments`, {
                headers: getAuthHeaders(),
            });
            setPayments(res.data?.payments?.data || []);
        } catch (e) {
            toast.error('שגיאה בטעינת תשלומים');
        } finally {
            setLoadingPayments(false);
        }
    }, [getAuthHeaders]);

    useEffect(() => {
        fetchRestaurants();
    }, [fetchRestaurants]);

    useEffect(() => {
        if (restaurantId) fetchPayments(restaurantId);
    }, [restaurantId]); // eslint-disable-line react-hooks/exhaustive-deps

    const selectedRestaurant = restaurants.find((r) => String(r.id) === String(restaurantId));

    useEffect(() => {
        if (!selectedRestaurant || !restaurantId) return;
        const iso = selectedRestaurant.next_charge_at || selectedRestaurant.next_payment_at;
        if (iso) {
            const d = new Date(iso);
            if (!Number.isNaN(d.getTime())) setNextCharge(d.toISOString().slice(0, 16));
        }
    }, [selectedRestaurant, restaurantId]);

    const handleAddPayment = async () => {
        if (!restaurantId || !newPay.amount) return;
        try {
            await api.post(
                `/super-admin/billing/restaurants/${restaurantId}/payments`,
                {
                    amount: Number.parseFloat(newPay.amount),
                    paid_at: newPay.paid_at ? new Date(newPay.paid_at).toISOString() : undefined,
                    type: newPay.type || 'subscription',
                    method: newPay.method || 'manual',
                    reference: newPay.reference || 'manual_super_admin',
                    status: 'paid',
                },
                { headers: getAuthHeaders() }
            );
            toast.success('תשלום נרשם');
            setNewPay((p) => ({ ...p, amount: '', reference: '' }));
            fetchPayments(restaurantId);
            fetchRestaurants();
        } catch (e) {
            toast.error(e.response?.data?.message || 'שגיאה');
        }
    };

    const handleMergeYtd = async () => {
        if (!restaurantId) return;
        if (!window.confirm('לאחד את כל תשלומי השנה (paid) לרשומה אחת? פעולה בלתי הפיכה.')) return;
        try {
            const res = await api.post(
                `/super-admin/billing/restaurants/${restaurantId}/payments/merge-ytd`,
                {},
                { headers: getAuthHeaders() }
            );
            toast.success(res.data.message);
            fetchPayments(restaurantId);
            fetchRestaurants();
        } catch (e) {
            toast.error(e.response?.data?.message || 'שגיאה באיחוד');
        }
    };

    const handleSaveNextCharge = async () => {
        if (!restaurantId || !nextCharge) return;
        setSavingCharge(true);
        try {
            await api.patch(
                `/super-admin/billing/restaurants/${restaurantId}/next-charge`,
                { next_charge_at: new Date(nextCharge).toISOString() },
                { headers: getAuthHeaders() }
            );
            toast.success('תאריך חיוב עודכן');
            fetchRestaurants();
        } catch (e) {
            toast.error(e.response?.data?.message || 'שגיאה');
        } finally {
            setSavingCharge(false);
        }
    };

    const startEdit = (p) => {
        setEditing(p.id);
        setEditForm({
            amount: String(p.amount),
            reference: p.reference || '',
            paid_at: p.paid_at ? new Date(p.paid_at).toISOString().slice(0, 16) : '',
            method: p.method || '',
        });
    };

    const saveEdit = async () => {
        if (!editing) return;
        try {
            await api.patch(
                `/super-admin/billing/payments/${editing}`,
                {
                    amount: Number.parseFloat(editForm.amount),
                    reference: editForm.reference || null,
                    paid_at: editForm.paid_at ? new Date(editForm.paid_at).toISOString() : null,
                    method: editForm.method || null,
                },
                { headers: getAuthHeaders() }
            );
            toast.success('עודכן');
            setEditing(null);
            fetchPayments(restaurantId);
            fetchRestaurants();
        } catch (e) {
            toast.error(e.response?.data?.message || 'שגיאה');
        }
    };

    const deletePayment = async (id) => {
        if (!window.confirm('למחוק רשומת תשלום? חשבוניות קיימות לא משתנות.')) return;
        try {
            await api.delete(`/super-admin/billing/payments/${id}`, { headers: getAuthHeaders() });
            toast.success('נמחק');
            fetchPayments(restaurantId);
            fetchRestaurants();
        } catch (e) {
            toast.error(e.response?.data?.message || 'שגיאה');
        }
    };

    return (
        <SuperAdminLayout>
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4" dir="rtl">
                <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2 mb-2">
                    <FaCoins className="text-brand-primary" />
                    ניהול תשלומים וחיוב — ידני
                </h1>
                <p className="text-sm text-gray-500 mb-6">
                    רישום/עריכה/מחיקת תשלומים לתיעוד פנימי. חשבוניות שכבר הופקו נשארות כפי שהן. איחוד YTD =
                    כל תשלומי <strong>paid</strong> מתחילת השנה לרשומה אחת.
                </p>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">מסעדה</label>
                        <div className="flex gap-2 flex-wrap items-center">
                            <select
                                value={restaurantId}
                                onChange={(e) => setRestaurantId(e.target.value)}
                                className="flex-1 min-w-[240px] border rounded-xl px-3 py-2 text-sm"
                                disabled={loadingRestaurants}
                            >
                                <option value="">בחר מסעדה</option>
                                {restaurants.map((r) => (
                                    <option key={r.id} value={r.id}>
                                        {r.name} ({r.tenant_id})
                                    </option>
                                ))}
                            </select>
                            <button
                                type="button"
                                onClick={fetchRestaurants}
                                className="p-2 border rounded-xl hover:bg-gray-50"
                                title="רענון רשימה"
                            >
                                <FaSync size={14} />
                            </button>
                        </div>
                    </div>

                    {restaurantId && (
                        <>
                            <div className="border-t pt-4 flex flex-wrap gap-3 items-end">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1 flex items-center gap-1">
                                        <FaCalendarAlt /> חיוב הבא (ידני)
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={nextCharge}
                                        onChange={(e) => setNextCharge(e.target.value)}
                                        className="border rounded-xl px-3 py-2 text-sm"
                                        dir="ltr"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={handleSaveNextCharge}
                                    disabled={savingCharge || !nextCharge}
                                    className="px-4 py-2 bg-brand-primary text-white rounded-xl text-sm font-bold disabled:opacity-50"
                                >
                                    {savingCharge ? 'שומר...' : 'שמור תאריך חיוב'}
                                </button>
                            </div>

                            <div className="border-t pt-4">
                                <h3 className="font-bold text-sm mb-2 flex items-center gap-2">
                                    <FaPlus /> תשלום חדש
                                </h3>
                                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="סכום ₪"
                                        value={newPay.amount}
                                        onChange={(e) => setNewPay((p) => ({ ...p, amount: e.target.value }))}
                                        className="border rounded-xl px-3 py-2 text-sm"
                                    />
                                    <input
                                        type="datetime-local"
                                        value={newPay.paid_at}
                                        onChange={(e) => setNewPay((p) => ({ ...p, paid_at: e.target.value }))}
                                        className="border rounded-xl px-3 py-2 text-sm"
                                        dir="ltr"
                                    />
                                    <select
                                        value={newPay.type}
                                        onChange={(e) => setNewPay((p) => ({ ...p, type: e.target.value }))}
                                        className="border rounded-xl px-3 py-2 text-sm"
                                    >
                                        <option value="subscription">מנוי</option>
                                        <option value="abandoned_cart_package">חבילת סל נטוש</option>
                                        <option value="manual_merge">manual_merge</option>
                                    </select>
                                    <input
                                        placeholder="שיטה (manual, העברה...)"
                                        value={newPay.method}
                                        onChange={(e) => setNewPay((p) => ({ ...p, method: e.target.value }))}
                                        className="border rounded-xl px-3 py-2 text-sm"
                                    />
                                    <input
                                        placeholder="הערה / מזהה"
                                        value={newPay.reference}
                                        onChange={(e) => setNewPay((p) => ({ ...p, reference: e.target.value }))}
                                        className="border rounded-xl px-3 py-2 text-sm col-span-2"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={handleAddPayment}
                                    className="mt-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-bold"
                                >
                                    הוסף תשלום
                                </button>
                            </div>

                            <div className="border-t pt-4 flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleMergeYtd}
                                    className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-bold"
                                >
                                    <FaObjectGroup />
                                    איחוד תשלומי YTD לרשומה אחת
                                </button>
                            </div>
                        </>
                    )}
                </div>

                {restaurantId && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <h3 className="font-bold p-4 border-b bg-gray-50">תשלומים</h3>
                        {loadingPayments ? (
                            <p className="p-8 text-center text-gray-400">טוען...</p>
                        ) : payments.length === 0 ? (
                            <p className="p-8 text-center text-gray-400">אין תשלומים</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-xs text-gray-500 border-b">
                                            <th className="p-2">תאריך</th>
                                            <th className="p-2">סכום</th>
                                            <th className="p-2">סוג</th>
                                            <th className="p-2">שיטה</th>
                                            <th className="p-2">הערה</th>
                                            <th className="p-2">סטטוס</th>
                                            <th className="p-2 w-32">פעולות</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {payments.map((p) => (
                                            <tr key={p.id} className="border-b hover:bg-gray-50/50">
                                                <td className="p-2" dir="ltr">
                                                    {p.paid_at
                                                        ? new Date(p.paid_at).toLocaleString('he-IL')
                                                        : '—'}
                                                </td>
                                                <td className="p-2 font-bold">₪{Number(p.amount).toFixed(2)}</td>
                                                <td className="p-2">{p.type}</td>
                                                <td className="p-2">{p.method}</td>
                                                <td className="p-2 max-w-[200px] truncate">{p.reference}</td>
                                                <td className="p-2">{p.status}</td>
                                                <td className="p-2 flex gap-1 flex-wrap">
                                                    {editing === p.id ? (
                                                        <>
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                value={editForm.amount}
                                                                onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))}
                                                                className="w-20 border rounded px-1 text-xs"
                                                            />
                                                            <input
                                                                value={editForm.reference}
                                                                onChange={(e) => setEditForm((f) => ({ ...f, reference: e.target.value }))}
                                                                className="w-24 border rounded px-1 text-xs"
                                                            />
                                                            <input
                                                                type="datetime-local"
                                                                value={editForm.paid_at}
                                                                onChange={(e) => setEditForm((f) => ({ ...f, paid_at: e.target.value }))}
                                                                className="border rounded px-1 text-xs"
                                                                dir="ltr"
                                                            />
                                                            <button type="button" onClick={saveEdit} className="text-green-600 text-xs font-bold">
                                                                שמור
                                                            </button>
                                                            <button type="button" onClick={() => setEditing(null)} className="text-gray-500 text-xs">
                                                                ביטול
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => startEdit(p)}
                                                                className="text-blue-600 p-1"
                                                                title="ערוך"
                                                            >
                                                                <FaEdit />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => deletePayment(p.id)}
                                                                className="text-red-600 p-1"
                                                                title="מחק"
                                                            >
                                                                <FaTrash />
                                                            </button>
                                                        </>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </SuperAdminLayout>
    );
}
