import { useEffect, useMemo, useState } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import SuperAdminLayout from '../../layouts/SuperAdminLayout';
import api from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import InvoicePreviewModal from '../../components/InvoicePreviewModal';
import {
    FaFileInvoiceDollar,
    FaSync,
    FaSearch,
    FaStore,
    FaCalendarAlt,
    FaCheckCircle,
    FaExclamationCircle,
    FaClock,
    FaCoins,
    FaPlay,
    FaCheck,
    FaReceipt,
    FaChevronLeft,
    FaChevronRight,
    FaFilePdf,
    FaEnvelope
} from 'react-icons/fa';

export default function SuperAdminInvoices() {
    const { getAuthHeaders } = useAdminAuth();
    const [invoices, setInvoices] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [finalizing, setFinalizing] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [statusFilter, setStatusFilter] = useState('');
    const [previewInvoice, setPreviewInvoice] = useState(null);
    const [pdfUrl, setPdfUrl] = useState(null);
    const [sendingEmail, setSendingEmail] = useState(false);

    useEffect(() => {
        fetchInvoices();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedMonth, statusFilter]);

    const fetchInvoices = async () => {
        setLoading(true);
        try {
            const params = { month: selectedMonth };
            if (statusFilter) params.status = statusFilter;

            const res = await api.get('/super-admin/billing/invoices', {
                headers: getAuthHeaders(),
                params,
            });
            setInvoices(res.data.invoices?.data || res.data.invoices || []);
            setStats(res.data.stats);
        } catch (error) {
            console.error('Failed to load invoices', error);
            toast.error('שגיאה בטעינת חשבוניות');
        } finally {
            setLoading(false);
        }
    };

    const handleGenerate = async () => {
        setGenerating(true);
        try {
            const res = await api.post(
                '/super-admin/billing/invoices/generate',
                { month: selectedMonth, overwrite_drafts: true },
                { headers: getAuthHeaders() }
            );
            toast.success(res.data.message);
            if (res.data.data?.errors?.length > 0) {
                res.data.data.errors.forEach((e) =>
                    toast.error(`${e.restaurant_name}: ${e.error}`)
                );
            }
            fetchInvoices();
        } catch (error) {
            toast.error(error.response?.data?.message || 'שגיאה בהפקת חשבוניות');
        } finally {
            setGenerating(false);
        }
    };

    const handleFinalize = async () => {
        setFinalizing(true);
        try {
            const res = await api.post(
                '/super-admin/billing/invoices/finalize',
                { month: selectedMonth },
                { headers: getAuthHeaders() }
            );
            toast.success(res.data.message);
            fetchInvoices();
        } catch (error) {
            toast.error(error.response?.data?.message || 'שגיאה בסיום טיוטות');
        } finally {
            setFinalizing(false);
        }
    };

    const handleMarkPaid = async (invoiceId) => {
        try {
            await api.patch(
                `/super-admin/billing/invoices/${invoiceId}`,
                { status: 'paid' },
                { headers: getAuthHeaders() }
            );
            toast.success('חשבונית סומנה כשולמה');
            fetchInvoices();
        } catch (error) {
            toast.error(error.response?.data?.message || 'שגיאה בעדכון חשבונית');
        }
    };

    const handleSetPending = async (invoiceId) => {
        try {
            await api.patch(
                `/super-admin/billing/invoices/${invoiceId}`,
                { status: 'pending' },
                { headers: getAuthHeaders() }
            );
            toast.success('חשבונית עודכנה לממתינה');
            fetchInvoices();
        } catch (error) {
            toast.error(error.response?.data?.message || 'שגיאה בעדכון חשבונית');
        }
    };

    // Month navigation
    const changeMonth = (direction) => {
        const d = new Date(selectedMonth + '-01');
        d.setMonth(d.getMonth() + direction);
        setSelectedMonth(d.toISOString().slice(0, 7));
    };

    // PDF Preview
    const handlePreview = async (invoice) => {
        try {
            const res = await api.get(`/super-admin/billing/invoices/${invoice.id}/pdf`, {
                headers: getAuthHeaders(),
                responseType: 'blob',
            });
            const blob = new Blob([res.data], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            setPdfUrl(url);
            setPreviewInvoice(invoice);
        } catch (error) {
            console.error('Failed to load PDF preview', error);
            toast.error('שגיאה בטעינת תצוגה מקדימה');
        }
    };

    const handleClosePreview = () => {
        if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        setPdfUrl(null);
        setPreviewInvoice(null);
    };

    const handleSendEmail = async (invoiceId, email) => {
        setSendingEmail(true);
        try {
            const body = email ? { email } : {};
            const res = await api.post(
                `/super-admin/billing/invoices/${invoiceId}/send-email`,
                body,
                { headers: getAuthHeaders() }
            );
            toast.success(res.data.message || 'החשבונית נשלחה בהצלחה');
        } catch (error) {
            console.error('Failed to send invoice email', error);
            toast.error(error.response?.data?.message || 'שגיאה בשליחת החשבונית');
        } finally {
            setSendingEmail(false);
        }
    };

    const handleDownloadPdf = async (invoice) => {
        try {
            const res = await api.get(`/super-admin/billing/invoices/${invoice.id}/pdf/download`, {
                headers: getAuthHeaders(),
                responseType: 'blob',
            });
            const blob = new Blob([res.data], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `TakeEat-Invoice-${invoice.month}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Failed to download PDF', error);
            toast.error('שגיאה בהורדת PDF');
        }
    };

    const formatMonth = (m) => {
        const d = new Date(m + '-01');
        return d.toLocaleDateString('he-IL', { year: 'numeric', month: 'long' });
    };

    const statusStyles = {
        draft: 'bg-gray-100 text-gray-500 border-gray-200',
        pending: 'bg-blue-100 text-blue-700 border-blue-200',
        paid: 'bg-green-100 text-green-700 border-green-200',
        overdue: 'bg-red-100 text-red-700 border-red-200',
    };
    const statusLabels = {
        draft: 'טיוטה',
        pending: 'ממתינה',
        paid: 'שולמה',
        overdue: 'באיחור',
    };

    const billingModelLabels = {
        flat: 'קבוע',
        percentage: 'אחוזים',
        hybrid: 'משולב',
    };

    const StatCard = ({ title, value, subtitle, accent = 'blue', icon }) => {
        const colorClasses = {
            orange: 'text-orange-600 bg-orange-50/50 border-orange-100',
            green: 'text-green-600 bg-green-50/50 border-green-100',
            purple: 'text-purple-600 bg-purple-50/50 border-purple-100',
            blue: 'text-blue-600 bg-blue-50/50 border-blue-100',
            red: 'text-red-600 bg-red-50/50 border-red-100',
            brand: 'text-brand-primary bg-brand-primary/5 border-brand-primary/10',
        };
        const iconClasses = {
            orange: 'bg-orange-100 text-orange-500',
            green: 'bg-green-100 text-green-500',
            purple: 'bg-purple-100 text-purple-500',
            blue: 'bg-blue-100 text-blue-500',
            red: 'bg-red-100 text-red-500',
            brand: 'bg-brand-primary/10 text-brand-primary',
        };
        return (
            <div className={`p-3.5 rounded-xl border ${colorClasses[accent]} flex items-center justify-between shadow-sm bg-white`}>
                <div className="min-w-0">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">{title}</p>
                    <h3 className="text-lg font-black text-gray-800 leading-none">{value}</h3>
                    {subtitle && <p className="text-[10px] text-gray-500 mt-1 truncate">{subtitle}</p>}
                </div>
                <div className={`p-2 rounded-lg shrink-0 ${iconClasses[accent]}`}>{icon}</div>
            </div>
        );
    };

    return (
        <SuperAdminLayout>
            <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4">
                {/* Header */}
                <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                            <div className="p-2 bg-brand-primary/10 rounded-lg">
                                <FaFileInvoiceDollar className="text-brand-primary" size={20} />
                            </div>
                            חשבוניות חודשיות
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">הפקה, מעקב ואישור חשבוניות למסעדות</p>
                    </div>
                    <button
                        onClick={fetchInvoices}
                        disabled={loading}
                        className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-bold transition-all shadow-sm flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                    >
                        <FaSync size={14} className={loading ? 'animate-spin' : ''} />
                        רענון
                    </button>
                </div>

                {/* Month Selector + Actions */}
                <div className="mb-6 flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
                    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-2 py-1.5 shadow-sm">
                        <button onClick={() => changeMonth(1)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                            <FaChevronRight size={14} />
                        </button>
                        <div className="px-4 py-1 text-sm font-black text-gray-800 min-w-[140px] text-center">
                            {formatMonth(selectedMonth)}
                        </div>
                        <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                            <FaChevronLeft size={14} />
                        </button>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={handleGenerate}
                            disabled={generating}
                            className="px-5 py-2.5 bg-brand-primary text-white rounded-xl font-bold hover:bg-brand-primary/90 transition-all shadow-sm flex items-center gap-2 text-sm disabled:opacity-50"
                        >
                            <FaReceipt size={14} />
                            {generating ? 'מפיק...' : 'הפק חשבוניות'}
                        </button>
                        <button
                            onClick={handleFinalize}
                            disabled={finalizing || !stats?.draft_count}
                            className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-500 transition-all shadow-sm flex items-center gap-2 text-sm disabled:opacity-50"
                        >
                            <FaPlay size={14} />
                            {finalizing ? 'מסיים...' : `סיים טיוטות (${stats?.draft_count || 0})`}
                        </button>
                    </div>
                </div>

                {/* Stats Cards */}
                {stats && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <StatCard
                            title="סה״כ לחיוב"
                            value={`₪${Number(stats.total_due || 0).toLocaleString()}`}
                            subtitle={`${(stats.draft_count || 0) + (stats.pending_count || 0) + (stats.paid_count || 0)} חשבוניות`}
                            accent="blue"
                            icon={<FaCalendarAlt size={18} />}
                        />
                        <StatCard
                            title="שולם"
                            value={`₪${Number(stats.total_paid || 0).toLocaleString()}`}
                            subtitle={`${stats.paid_count || 0} חשבוניות שולמו`}
                            accent="green"
                            icon={<FaCheckCircle size={18} />}
                        />
                        <StatCard
                            title="ממתינות"
                            value={stats.pending_count || 0}
                            subtitle="חשבוניות ממתינות לתשלום"
                            accent="orange"
                            icon={<FaClock size={18} />}
                        />
                        <StatCard
                            title="באיחור"
                            value={stats.overdue_count || 0}
                            subtitle="חשבוניות שלא שולמו בזמן"
                            accent="red"
                            icon={<FaExclamationCircle size={18} />}
                        />
                    </div>
                )}

                {/* Status Filter Tabs */}
                <div className="mb-6 flex gap-2 overflow-x-auto">
                    {[
                        { key: '', label: 'הכל' },
                        { key: 'draft', label: 'טיוטות' },
                        { key: 'pending', label: 'ממתינות' },
                        { key: 'paid', label: 'שולמו' },
                        { key: 'overdue', label: 'באיחור' },
                    ].map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setStatusFilter(tab.key)}
                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${statusFilter === tab.key
                                    ? 'bg-brand-primary text-white shadow-sm'
                                    : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Table */}
                {loading ? (
                    <div className="bg-white rounded-3xl border border-gray-100 p-20 text-center shadow-sm">
                        <div className="w-12 h-12 border-4 border-brand-primary/20 border-t-brand-primary rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-gray-500 font-bold">טוען חשבוניות...</p>
                    </div>
                ) : invoices.length === 0 ? (
                    <div className="bg-gray-50 rounded-3xl p-12 text-center border-2 border-dashed border-gray-200">
                        <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-4 text-gray-300">
                            <FaFileInvoiceDollar size={24} />
                        </div>
                        <p className="text-gray-500 font-bold mb-2">אין חשבוניות לחודש זה</p>
                        <p className="text-sm text-gray-400">לחץ על "הפק חשבוניות" כדי ליצור חשבוניות עבור כל המסעדות הפעילות</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-right border-collapse">
                                <thead className="bg-gray-50/50 border-b border-gray-100">
                                    <tr>
                                        <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">מסעדה</th>
                                        <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-center hidden md:table-cell">מודל</th>
                                        <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-left">בסיס</th>
                                        <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-left">עמלה</th>
                                        <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-left">סה״כ</th>
                                        <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-center hidden lg:table-cell">הזמנות</th>
                                        <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-center hidden lg:table-cell">מחזור</th>
                                        <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-center">סטטוס</th>
                                        <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-center">פעולות</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {invoices.map((inv) => (
                                        <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-brand-primary/10 group-hover:text-brand-primary transition-colors">
                                                        <FaStore size={14} />
                                                    </div>
                                                    <div>
                                                        <span className="text-sm font-black text-gray-900 block">{inv.restaurant?.name || '—'}</span>
                                                        {inv.restaurant?.tenant_id && (
                                                            <span className="text-[10px] text-gray-400 font-mono">@{inv.restaurant.tenant_id}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center hidden md:table-cell">
                                                <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
                                                    {billingModelLabels[inv.billing_model] || inv.billing_model}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-left">
                                                <span className="text-sm font-black text-gray-900">
                                                    ₪{Number(inv.base_fee || 0).toLocaleString()}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-left">
                                                <span className={`text-sm font-black ${Number(inv.commission_fee || 0) > 0 ? 'text-purple-600' : 'text-gray-400'}`}>
                                                    ₪{Number(inv.commission_fee || 0).toLocaleString()}
                                                </span>
                                                {Number(inv.commission_percent || 0) > 0 && (
                                                    <span className="text-[10px] text-gray-400 block">{inv.commission_percent}%</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-left">
                                                <span className="text-sm font-black text-gray-900 bg-gray-50 px-2 py-1 rounded-lg border border-gray-100">
                                                    ₪{Number(inv.total_due || 0).toLocaleString()}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center hidden lg:table-cell">
                                                <span className="text-sm font-bold text-gray-700">{Number(inv.order_count || 0).toLocaleString()}</span>
                                            </td>
                                            <td className="px-6 py-4 text-center hidden lg:table-cell">
                                                <span className="text-sm font-bold text-brand-primary bg-brand-primary/5 px-3 py-1 rounded-full border border-brand-primary/10">
                                                    ₪{Number(inv.order_revenue || 0).toLocaleString()}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase border ${statusStyles[inv.status] || statusStyles.draft}`}>
                                                    {inv.status === 'paid' && <div className="w-1.5 h-1.5 rounded-full bg-green-500" />}
                                                    {inv.status === 'overdue' && <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
                                                    {statusLabels[inv.status] || inv.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex justify-center gap-2">
                                                    <button
                                                        onClick={() => handlePreview(inv)}
                                                        title="תצוגה מקדימה PDF"
                                                        className="p-2 bg-orange-50 text-orange-600 border border-orange-100 rounded-lg hover:bg-orange-600 hover:text-white transition-all"
                                                    >
                                                        <FaFilePdf size={12} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleSendEmail(inv.id)}
                                                        title="שלח במייל"
                                                        className="p-2 bg-purple-50 text-purple-600 border border-purple-100 rounded-lg hover:bg-purple-600 hover:text-white transition-all"
                                                    >
                                                        <FaEnvelope size={12} />
                                                    </button>
                                                    {(inv.status === 'pending' || inv.status === 'overdue') && (
                                                        <button
                                                            onClick={() => handleMarkPaid(inv.id)}
                                                            title="סמן כשולם"
                                                            className="p-2 bg-green-50 text-green-600 border border-green-100 rounded-lg hover:bg-green-600 hover:text-white transition-all"
                                                        >
                                                            <FaCheck size={12} />
                                                        </button>
                                                    )}
                                                    {inv.status === 'draft' && (
                                                        <button
                                                            onClick={() => handleSetPending(inv.id)}
                                                            title="העבר לממתינה"
                                                            className="p-2 bg-blue-50 text-blue-600 border border-blue-100 rounded-lg hover:bg-blue-600 hover:text-white transition-all"
                                                        >
                                                            <FaPlay size={10} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Invoice Preview Modal */}
            {previewInvoice && (
                <InvoicePreviewModal
                    invoice={previewInvoice}
                    pdfUrl={pdfUrl}
                    onClose={handleClosePreview}
                    onSendEmail={(email) => handleSendEmail(previewInvoice.id, email)}
                    onDownload={() => handleDownloadPdf(previewInvoice)}
                    sendingEmail={sendingEmail}
                />
            )}
        </SuperAdminLayout>
    );
}
