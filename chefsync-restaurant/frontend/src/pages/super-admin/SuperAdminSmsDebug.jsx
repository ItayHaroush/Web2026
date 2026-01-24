import { useMemo, useState } from 'react';
import SuperAdminLayout from '../../layouts/SuperAdminLayout';
import api from '../../services/apiClient';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { toast } from 'react-hot-toast';
import {
    FaSms,
    FaTerminal,
    FaPhone,
    FaServer,
    FaFlask,
    FaEye,
    FaTrash,
    FaPlay,
    FaVial
} from 'react-icons/fa';

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
            <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-4">
                <div className="mb-8">
                    <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                        <div className="p-2 bg-brand-primary/10 rounded-lg">
                            <FaSms className="text-brand-primary" size={20} />
                        </div>
                        SMS Debug Console
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">אבחון וסימולציה של שליחת הודעות OTP ומערכת</p>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                    {/* עמודה ראשית - תצורה */}
                    <div className="xl:col-span-2 space-y-6">
                        <form onSubmit={submit} className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-6">
                            <h2 className="text-lg font-black text-gray-900 flex items-center gap-2 mb-2">
                                <FaTerminal className="text-brand-primary" size={16} />
                                פקודות שידור
                            </h2>

                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-gray-500 mr-1 uppercase tracking-wider flex items-center gap-1.5">
                                    <FaPhone className="text-gray-400" size={10} />
                                    טלפון יעד (נמען)
                                </label>
                                <input
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="05XXXXXXXX או +9725XXXXXXXX"
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-sm font-bold tracking-widest text-left"
                                    dir="ltr"
                                />
                                <p className="text-[10px] text-gray-400 font-bold mr-1">המערכת תשלח קוד אימות חד-פעמי (OTP)</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-black text-gray-500 mr-1 uppercase tracking-wider flex items-center gap-1.5">
                                        <FaServer className="text-gray-400" size={10} />
                                        ספק שירות (Provider)
                                    </label>
                                    <select
                                        value={provider}
                                        onChange={(e) => setProvider(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-sm font-bold appearance-none cursor-pointer"
                                    >
                                        <option value="auto">Auto (Default config)</option>
                                        <option value="twilio">Twilio (International)</option>
                                        <option value="sms019">019 Mobile (Local)</option>
                                    </select>
                                </div>

                                <div className="flex flex-col justify-end space-y-3 pb-1">
                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <div className="relative">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={dryRun}
                                                onChange={(e) => setDryRun(e.target.checked)}
                                            />
                                            <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-primary"></div>
                                        </div>
                                        <span className="text-xs font-black text-gray-600 uppercase tracking-wide group-hover:text-gray-900 transition-colors">
                                            Simulation Mode (Dry-Run)
                                        </span>
                                    </label>

                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <div className="relative">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={revealCode}
                                                onChange={(e) => setRevealCode(e.target.checked)}
                                            />
                                            <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-primary"></div>
                                        </div>
                                        <span className="text-xs font-black text-gray-600 uppercase tracking-wide group-hover:text-gray-900 transition-colors flex items-center gap-1.5">
                                            <FaEye size={12} className="opacity-50" />
                                            החזרת קוד בתגובה
                                        </span>
                                    </label>
                                </div>
                            </div>

                            <div className="pt-4 flex items-center gap-4">
                                <button
                                    type="submit"
                                    disabled={!canSubmit || loading}
                                    className="flex-1 px-6 py-4 bg-brand-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-brand-primary/95 transition-all shadow-lg shadow-brand-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : dryRun ? (
                                        <>
                                            <FaVial size={14} />
                                            בצע סימולציית שליחה
                                        </>
                                    ) : (
                                        <>
                                            <FaPlay size={14} />
                                            שלח הודעה חיה (Production)
                                        </>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setResult(null);
                                        setPhone('');
                                    }}
                                    className="px-6 py-4 bg-white border border-gray-200 text-gray-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                                >
                                    <FaTrash size={14} />
                                    ניקוי
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* עמודה משנית - דפים ותוצאות */}
                    <div className="space-y-6">
                        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                            <h2 className="text-lg font-black text-gray-900 flex items-center gap-2 mb-6">
                                <FaFlask className="text-brand-primary" size={16} />
                                פלט מערכת (Output)
                            </h2>

                            <div className="relative group">
                                <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-gray-900 text-[9px] font-black text-white rounded uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity">
                                    Raw JSON
                                </div>
                                <div className="bg-gray-900 rounded-2xl p-4 min-h-[160px] max-h-[400px] overflow-auto custom-scrollbar shadow-inner">
                                    <pre className="text-[11px] font-mono text-green-400 whitespace-pre-wrap leading-relaxed" dir="ltr">
                                        {result ? JSON.stringify(result, null, 2) : '// No request executed...'}
                                    </pre>
                                </div>
                            </div>

                            {result && result.success && (
                                <div className="mt-4 p-4 bg-green-50 rounded-2xl border border-green-100 flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                                        <FaFlask className="text-green-600" size={14} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-green-900 uppercase">Status: Success</p>
                                        <p className="text-[10px] text-green-700 font-bold mt-0.5">פרוטוקול השליחה עבר בהצלחה מול הספק.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </SuperAdminLayout>
    );
}
