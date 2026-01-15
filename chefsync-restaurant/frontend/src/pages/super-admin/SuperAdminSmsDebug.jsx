import { useMemo, useState } from 'react';
import SuperAdminLayout from '../../layouts/SuperAdminLayout';
import api from '../../services/apiClient';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { toast } from 'react-hot-toast';

export default function SuperAdminSmsDebug() {
    const { getAuthHeaders } = useAdminAuth();

    const [phone, setPhone] = useState('');
    const [provider, setProvider] = useState('auto');
    const [dryRun, setDryRun] = useState(true);
    const [revealCode, setRevealCode] = useState(false);

    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    const canSubmit = useMemo(() => {
        return phone.trim().length >= 9;
    }, [phone]);

    const submit = async (e) => {
        e.preventDefault();
        if (!canSubmit) return;

        setLoading(true);
        setResult(null);

        try {
            const response = await api.post(
                '/super-admin/sms/test',
                {
                    phone: phone.trim(),
                    provider,
                    dry_run: dryRun,
                    reveal_code: revealCode,
                },
                { headers: getAuthHeaders() }
            );

            setResult(response.data);
            if (response.data?.success) {
                toast.success(dryRun ? 'בוצע Dry-Run בהצלחה' : 'נשלחה הודעה בהצלחה');
            } else {
                toast.error(response.data?.message || 'שליחה נכשלה');
            }
        } catch (error) {
            const message = error.response?.data?.message || error.message || 'שגיאה בשליחה';
            setResult(error.response?.data || { success: false, message });
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SuperAdminLayout>
            <div className="max-w-3xl">
                <h2 className="text-2xl font-bold text-gray-900">SMS Debug (OTP)</h2>
                <p className="text-sm text-gray-600 mt-1">
                    בדיקת שליחת הודעת אימות דרך ספק ה-SMS. ברירת המחדל היא Twilio, ואפשר לבחור 019 לפי הצורך.
                </p>

                <form onSubmit={submit} className="mt-6 bg-white border border-gray-200 rounded-xl p-6 space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">טלפון יעד</label>
                        <input
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="05XXXXXXXX או +9725XXXXXXXX"
                            className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                            dir="ltr"
                        />
                        <p className="text-xs text-gray-500 mt-2">המערכת תייצר קוד 6 ספרות ותשלח הודעת אימות.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">ספק</label>
                            <select
                                value={provider}
                                onChange={(e) => setProvider(e.target.value)}
                                className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 bg-white"
                            >
                                <option value="auto">אוטומטי (לפי הגדרות שרת)</option>
                                <option value="twilio">Twilio</option>
                                <option value="sms019">019 (sms019)</option>
                            </select>
                        </div>

                        <div className="flex items-end gap-4">
                            <label className="flex items-center gap-2 text-sm text-gray-700">
                                <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
                                Dry-Run (לא שולח בפועל)
                            </label>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                            <input
                                type="checkbox"
                                checked={revealCode}
                                onChange={(e) => setRevealCode(e.target.checked)}
                            />
                            להחזיר קוד בתגובה (לבדיקות)
                        </label>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            disabled={!canSubmit || loading}
                            className="px-5 py-3 rounded-lg bg-brand-primary text-white font-medium disabled:opacity-50"
                        >
                            {loading ? 'שולח…' : dryRun ? 'בצע Dry-Run' : 'שלח SMS'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setResult(null)}
                            className="px-5 py-3 rounded-lg border border-gray-300 text-gray-700"
                        >
                            נקה תוצאה
                        </button>
                    </div>
                </form>

                <div className="mt-6">
                    <h3 className="text-lg font-semibold text-gray-900">תוצאה</h3>
                    <pre className="mt-2 bg-gray-900 text-gray-100 rounded-xl p-4 overflow-auto text-xs" dir="ltr">
                        {result ? JSON.stringify(result, null, 2) : '—'}
                    </pre>
                </div>
            </div>
        </SuperAdminLayout>
    );
}
