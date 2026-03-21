import { useState, useEffect, useCallback } from 'react';
import api from '../../services/apiClient';
import { FaCreditCard, FaPlus, FaEdit, FaTrash, FaSpinner, FaInfoCircle } from 'react-icons/fa';

const emptyTerminalForm = () => ({
    name: '',
    zcredit_terminal_number: '',
    zcredit_pinpad_id: '',
    zcredit_terminal_password: '',
});

/**
 * הגדרות Z-Credit למסעדה: שדות על restaurants + רשימת payment_terminals (קופה/קיוסק נפרדים).
 */
export default function ZCreditSettingsPanel({ getAuthHeaders, isOwner }) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [terminals, setTerminals] = useState([]);
    const [zcredit_terminal_number, setZcreditTerminalNumber] = useState('');
    const [zcredit_pinpad_id, setZcreditPinpadId] = useState('');
    const [zcredit_terminal_password, setZcreditTerminalPassword] = useState('');
    const [default_payment_terminal_id, setDefaultPaymentTerminalId] = useState('');
    const [formTerminal, setFormTerminal] = useState(emptyTerminalForm);
    const [editingId, setEditingId] = useState(null);
    const [terminalSaving, setTerminalSaving] = useState(false);
    const [zcreditMockEnabled, setZcreditMockEnabled] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [restRes, termRes] = await Promise.all([
                api.get('/admin/restaurant', { headers: getAuthHeaders() }),
                api.get('/admin/payment-terminals', { headers: getAuthHeaders() }),
            ]);
            if (restRes.data?.success && restRes.data.restaurant) {
                const r = restRes.data.restaurant;
                setZcreditMockEnabled(!!restRes.data.zcredit_mock_enabled);
                setZcreditTerminalNumber(r.zcredit_terminal_number || '');
                setZcreditPinpadId(r.zcredit_pinpad_id || '');
                setZcreditTerminalPassword('');
                setDefaultPaymentTerminalId(
                    r.default_payment_terminal_id != null && r.default_payment_terminal_id !== ''
                        ? String(r.default_payment_terminal_id)
                        : ''
                );
            }
            if (termRes.data?.success && Array.isArray(termRes.data.terminals)) {
                setTerminals(termRes.data.terminals);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [getAuthHeaders]);

    useEffect(() => {
        load();
    }, [load]);

    const saveRestaurantZcredit = async (e) => {
        e.preventDefault();
        if (!isOwner()) {
            alert('רק בעל המסעדה יכול לעדכן הגדרות מסוף');
            return;
        }
        setSaving(true);
        try {
            const payload = {
                zcredit_terminal_number: zcredit_terminal_number || null,
                zcredit_pinpad_id: zcredit_pinpad_id || null,
                default_payment_terminal_id:
                    default_payment_terminal_id === '' || default_payment_terminal_id == null
                        ? null
                        : Number(default_payment_terminal_id),
            };
            if (zcredit_terminal_password) {
                payload.zcredit_terminal_password = zcredit_terminal_password;
            }
            await api.put('/admin/restaurant', payload, { headers: getAuthHeaders() });
            setZcreditTerminalPassword('');
            await load();
            alert('הגדרות Z-Credit נשמרו');
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.message || 'שגיאה בשמירה');
        } finally {
            setSaving(false);
        }
    };

    const openNewTerminal = () => {
        setEditingId('new');
        setFormTerminal(emptyTerminalForm());
    };

    const openEditTerminal = (t) => {
        setEditingId(t.id);
        setFormTerminal({
            name: t.name || '',
            zcredit_terminal_number: t.zcredit_terminal_number || '',
            zcredit_pinpad_id: t.zcredit_pinpad_id || '',
            zcredit_terminal_password: '',
        });
    };

    const cancelTerminalForm = () => {
        setEditingId(null);
        setFormTerminal(emptyTerminalForm());
    };

    const saveTerminal = async (e) => {
        e.preventDefault();
        if (!isOwner()) return;
        setTerminalSaving(true);
        try {
            const body = {
                name: formTerminal.name.trim(),
                zcredit_terminal_number: formTerminal.zcredit_terminal_number || null,
                zcredit_pinpad_id: formTerminal.zcredit_pinpad_id || null,
            };
            if (formTerminal.zcredit_terminal_password) {
                body.zcredit_terminal_password = formTerminal.zcredit_terminal_password;
            }
            if (editingId === 'new') {
                await api.post('/admin/payment-terminals', body, { headers: getAuthHeaders() });
            } else {
                await api.put(`/admin/payment-terminals/${editingId}`, body, { headers: getAuthHeaders() });
            }
            cancelTerminalForm();
            await load();
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.message || 'שגיאה בשמירת המסוף');
        } finally {
            setTerminalSaving(false);
        }
    };

    const deleteTerminal = async (id) => {
        if (!isOwner() || !confirm('למחוק את המסוף? קיוסקים/סשנים מקושרים ינותקו.')) return;
        try {
            await api.delete(`/admin/payment-terminals/${id}`, { headers: getAuthHeaders() });
            await load();
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.message || 'שגיאה במחיקה');
        }
    };

    if (loading) {
        return (
            <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 p-12 mx-4 flex justify-center">
                <FaSpinner className="animate-spin text-3xl text-violet-400" />
            </div>
        );
    }

    return (
        <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 p-8 mx-4 space-y-8">
            <div className="flex items-start gap-4">
                <div className="p-3 bg-violet-50 text-violet-600 rounded-2xl">
                    <FaCreditCard size={24} />
                </div>
                <div>
                    <h2 className="text-xl font-black text-gray-900">מסוף Z-Credit — קופה (POS) וקיוסק (PinPad)</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        חיובי אשראי במסופון פיזי מול Z-Credit. זה נפרד מסליקת HYP לאתר.
                    </p>
                </div>
            </div>

            {zcreditMockEnabled && (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-950">
                    <strong className="font-black">מצב Mock פעיל בשרת</strong>
                    <p className="mt-1 opacity-90">
                        חיובי PinPad מדומים (בלי Z-Credit אמיתי). לייצור: הגדירו מסופון במסעדה והגדירו{' '}
                        <code className="bg-white/80 px-1 rounded text-xs">ZCREDIT_MOCK=false</code> ב־.env.
                    </p>
                </div>
            )}

            <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 text-sm text-slate-700 space-y-2">
                <div className="flex items-center gap-2 font-black text-slate-800">
                    <FaInfoCircle className="text-violet-500" />
                    איך נבחר מסוף בפועל
                </div>
                <ol className="list-decimal list-inside space-y-1 text-xs sm:text-sm leading-relaxed">
                    <li>הזמנה מ<strong>קיוסק</strong> — אם לקיוסק מוגדר מסוף, משתמשים בו.</li>
                    <li>אחרת <strong>סשן קופה</strong> — המסוף שנבחר בכניסה עם PIN (POS Lite).</li>
                    <li>אחרת <strong>מסוף ברירת מחדל</strong> מהרשימה למטה (או מהשדות הישירים).</li>
                    <li>אחרת השדות הישירים למטה על המסעדה (ללא נפילה ל־.env לחיובי POS).</li>
                </ol>
            </div>

            <form onSubmit={saveRestaurantZcredit} className="space-y-4">
                <h3 className="font-black text-gray-800 text-sm uppercase tracking-wide">ברירת מחדל למסעדה (או בדיקת דמה)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">מספר מסוף</label>
                        <input
                            type="text"
                            value={zcredit_terminal_number}
                            onChange={(e) => setZcreditTerminalNumber(e.target.value)}
                            disabled={!isOwner()}
                            className="w-full px-4 py-3 bg-gray-50 rounded-xl font-bold border border-gray-200 focus:border-violet-300 outline-none"
                            placeholder="לפי Z-Credit"
                            dir="ltr"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">מזהה PinPad</label>
                        <input
                            type="text"
                            value={zcredit_pinpad_id}
                            onChange={(e) => setZcreditPinpadId(e.target.value)}
                            disabled={!isOwner()}
                            className="w-full px-4 py-3 bg-gray-50 rounded-xl font-bold border border-gray-200 focus:border-violet-300 outline-none"
                            placeholder="למשל 11002"
                            dir="ltr"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-bold text-gray-700 mb-1">סיסמת מסוף (השאר ריק לשמירת הקודמת)</label>
                        <input
                            type="password"
                            autoComplete="off"
                            value={zcredit_terminal_password}
                            onChange={(e) => setZcreditTerminalPassword(e.target.value)}
                            disabled={!isOwner()}
                            className="w-full px-4 py-3 bg-gray-50 rounded-xl font-bold border border-gray-200 focus:border-violet-300 outline-none"
                            placeholder="••••••••"
                            dir="ltr"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-bold text-gray-700 mb-1">מסוף ברירת מחדל (מתוך הרשימה למטה)</label>
                        <select
                            value={default_payment_terminal_id}
                            onChange={(e) => setDefaultPaymentTerminalId(e.target.value)}
                            disabled={!isOwner()}
                            className="w-full px-4 py-3 bg-gray-50 rounded-xl font-bold border border-gray-200 focus:border-violet-300 outline-none"
                        >
                            <option value="">ללא — יעברו לשדות למעלה או ל-.env</option>
                            {terminals.map((t) => (
                                <option key={t.id} value={String(t.id)}>
                                    {t.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
                {isOwner() && (
                    <button
                        type="submit"
                        disabled={saving}
                        className="bg-violet-600 text-white px-6 py-3 rounded-xl font-black hover:bg-violet-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        {saving ? <FaSpinner className="animate-spin" /> : null}
                        שמור הגדרות Z-Credit למסעדה
                    </button>
                )}
            </form>

            <div className="border-t border-gray-100 pt-8 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-black text-gray-800">מסופונים נפרדים (קופה / קיוסק)</h3>
                    {isOwner() && editingId === null && (
                        <button
                            type="button"
                            onClick={openNewTerminal}
                            className="inline-flex items-center gap-2 text-sm font-black text-violet-600 hover:text-violet-800"
                        >
                            <FaPlus /> הוסף מסוף
                        </button>
                    )}
                </div>
                <p className="text-xs text-gray-500">
                    אחרי יצירה — בחרו מסוף בקיוסק (ניהול קיוסקים) או בכניסה ל-POS. כל מסעדה רואה רק את המסופונים שלה.
                </p>

                {editingId !== null && (
                    <form onSubmit={saveTerminal} className="p-4 rounded-2xl bg-violet-50/50 border border-violet-100 space-y-3">
                        <p className="font-black text-violet-900 text-sm">
                            {editingId === 'new' ? 'מסוף חדש' : 'עריכת מסוף'}
                        </p>
                        <input
                            type="text"
                            required
                            placeholder="שם לתצוגה (למשל קופה ראשית)"
                            value={formTerminal.name}
                            onChange={(e) => setFormTerminal({ ...formTerminal, name: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl border border-violet-200"
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                                type="text"
                                placeholder="מספר מסוף"
                                value={formTerminal.zcredit_terminal_number}
                                onChange={(e) => setFormTerminal({ ...formTerminal, zcredit_terminal_number: e.target.value })}
                                className="px-3 py-2 rounded-xl border border-violet-200 font-mono text-sm"
                                dir="ltr"
                            />
                            <input
                                type="text"
                                placeholder="מזהה PinPad"
                                value={formTerminal.zcredit_pinpad_id}
                                onChange={(e) => setFormTerminal({ ...formTerminal, zcredit_pinpad_id: e.target.value })}
                                className="px-3 py-2 rounded-xl border border-violet-200 font-mono text-sm"
                                dir="ltr"
                            />
                        </div>
                        <input
                            type="password"
                            autoComplete="off"
                            placeholder={editingId !== 'new' ? 'סיסמת מסוף (ריק = לא לשנות)' : 'סיסמת מסוף'}
                            value={formTerminal.zcredit_terminal_password}
                            onChange={(e) => setFormTerminal({ ...formTerminal, zcredit_terminal_password: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl border border-violet-200 font-mono text-sm"
                            dir="ltr"
                        />
                        <div className="flex gap-2">
                            <button
                                type="submit"
                                disabled={terminalSaving}
                                className="bg-violet-600 text-white px-4 py-2 rounded-xl font-bold text-sm"
                            >
                                {terminalSaving ? 'שומר…' : 'שמור'}
                            </button>
                            <button type="button" onClick={cancelTerminalForm} className="px-4 py-2 rounded-xl font-bold text-sm text-gray-600">
                                ביטול
                            </button>
                        </div>
                    </form>
                )}

                {terminals.length === 0 && editingId === null ? (
                    <p className="text-sm text-gray-400">עדיין אין מסופונים — אפשר להסתמך על השדות למעלה או להוסיף מסוף.</p>
                ) : (
                    <ul className="space-y-2">
                        {terminals.map((t) => (
                            <li
                                key={t.id}
                                className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-gray-50 border border-gray-100"
                            >
                                <div>
                                    <span className="font-black text-gray-900">{t.name}</span>
                                    <span className="text-xs text-gray-500 mr-2 font-mono" dir="ltr">
                                        {t.zcredit_terminal_number || '—'} · PinPad {t.zcredit_pinpad_id || '—'}{' '}
                                        {t.has_password ? '· סיסמה מוגדרת' : ''}
                                    </span>
                                </div>
                                {isOwner() && editingId === null && (
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => openEditTerminal(t)}
                                            className="p-2 text-violet-600 hover:bg-violet-50 rounded-lg"
                                            title="ערוך"
                                        >
                                            <FaEdit />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => deleteTerminal(t.id)}
                                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                                            title="מחק"
                                        >
                                            <FaTrash />
                                        </button>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
