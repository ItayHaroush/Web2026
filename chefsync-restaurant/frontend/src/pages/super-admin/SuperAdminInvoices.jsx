import { useEffect, useState } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import SuperAdminLayout from '../../layouts/SuperAdminLayout';
import api from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import InvoicePreviewModal from '../../components/InvoicePreviewModal';
import {
    FaFileInvoiceDollar,
    FaTimes,
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
    FaEnvelope,
    FaEdit
} from 'react-icons/fa';

export default function SuperAdminInvoices() {
    const [showCustomInvoice, setShowCustomInvoice] = useState(false);
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
    const [editInvoice, setEditInvoice] = useState(null);
    const [editForm, setEditForm] = useState({
        base_fee: '',
        commission_fee: '',
        abandoned_cart_fee: '',
        setup_fee: '',
        original_base_fee: '',
        total_due_override: '',
        notes: '',
    });
    const [editSaving, setEditSaving] = useState(false);

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
            const fetched = res.data.invoices?.data || res.data.invoices || [];
            setInvoices(fetched);
            // Fetch per-restaurant billing info (to know about setup fees)
            try {
                const tenantIds = Array.from(new Set(fetched.map(i => i.restaurant?.tenant_id).filter(Boolean)));
                if (tenantIds.length > 0) {
                    const billingMap = {};
                    await Promise.all(tenantIds.map(async (tenant) => {
                        try {
                            const billRes = await api.get('/admin/billing/info', {
                                headers: { ...getAuthHeaders(), 'X-Tenant-ID': tenant },
                            });
                            billingMap[tenant] = billRes.data.data || billRes.data;
                        } catch (e) {
                            console.debug('Failed to fetch billing for', tenant, e?.response?.data || e);
                        }
                    }));

                    // merge billing info into invoices for easy rendering
                    setInvoices(prev => prev.map(inv => ({
                        ...inv,
                        _billing: inv.restaurant?.tenant_id ? billingMap[inv.restaurant.tenant_id] : null,
                    })));
                }
            } catch (e) {
                console.debug('Error fetching per-restaurant billing info', e);
            }
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

    const openEditModal = (inv) => {
        setEditInvoice(inv);
        setEditForm({
            base_fee: String(inv.base_fee ?? ''),
            commission_fee: String(inv.commission_fee ?? ''),
            abandoned_cart_fee: String(inv.abandoned_cart_fee ?? ''),
            setup_fee: String(inv.setup_fee ?? ''),
            original_base_fee: inv.original_base_fee != null ? String(inv.original_base_fee) : '',
            total_due_override: '',
            notes: inv.notes ?? '',
        });
    };

    const closeEditModal = () => {
        setEditInvoice(null);
        setEditSaving(false);
    };

    const handleSaveInvoiceEdit = async () => {
        if (!editInvoice) return;
        setEditSaving(true);
        try {
            const body = {
                base_fee: parseFloat(editForm.base_fee) || 0,
                commission_fee: parseFloat(editForm.commission_fee) || 0,
                abandoned_cart_fee: parseFloat(editForm.abandoned_cart_fee) || 0,
                setup_fee: parseFloat(editForm.setup_fee) || 0,
            };
            if (editForm.original_base_fee.trim() !== '') {
                body.original_base_fee = parseFloat(editForm.original_base_fee);
            } else if (editInvoice.original_base_fee != null) {
                body.original_base_fee = null;
            }
            if (editForm.total_due_override.trim() !== '') {
                body.total_due = parseFloat(editForm.total_due_override);
            }
            if (editForm.notes !== (editInvoice.notes ?? '')) {
                body.notes = editForm.notes;
            }
            await api.patch(`/super-admin/billing/invoices/${editInvoice.id}`, body, {
                headers: getAuthHeaders(),
            });
            toast.success('החשבונית עודכנה');
            closeEditModal();
            fetchInvoices();
        } catch (error) {
            toast.error(error.response?.data?.message || 'שגיאה בשמירת החשבונית');
        } finally {
            setEditSaving(false);
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

    const computedEditTotal =
        Math.round(
            ((parseFloat(editForm.base_fee) || 0) +
                (parseFloat(editForm.commission_fee) || 0) +
                (parseFloat(editForm.abandoned_cart_fee) || 0) +
                (parseFloat(editForm.setup_fee) || 0)) *
                100
        ) / 100;

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
                    <div className="flex gap-2 items-center">
                        <button
                            onClick={() => setShowCustomInvoice(true)}
                            className="px-5 py-2.5 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all shadow-sm flex items-center gap-2 text-sm"
                        >
                            <FaFileInvoiceDollar size={14} />
                            הפק חשבונית ידנית ל-Itay Solutions
                        </button>
                        <button
                            onClick={fetchInvoices}
                            disabled={loading}
                            className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-bold transition-all shadow-sm flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                        >
                            <FaSync size={14} className={loading ? 'animate-spin' : ''} />
                            רענון
                        </button>
                    </div>
                </div>

                {/* Custom Invoice Modal — עיצוב זהה למודל תצוגה מקדימה */}
                {showCustomInvoice && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowCustomInvoice(false)}>
                        <div
                            className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden"
                            style={{ maxHeight: '95vh', height: '95vh' }}
                            onClick={(e) => e.stopPropagation()}
                            dir="rtl"
                        >
                            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white shrink-0">
                                <div>
                                    <h2 className="text-lg font-black text-gray-900">תצוגה מקדימה — חשבונית Itay Solutions</h2>
                                    <p className="text-xs text-gray-500 mt-0.5">הפק חשבונית מותאמת אישית</p>
                                </div>
                                <button
                                    onClick={() => setShowCustomInvoice(false)}
                                    className="p-2.5 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-gray-700"
                                    aria-label="סגור"
                                >
                                    <FaTimes size={18} />
                                </button>
                            </div>
                            <div className="flex-1 min-h-0 bg-gray-100 overflow-hidden flex flex-col">
                                <iframe
                                    src={`${((import.meta?.env?.PROD ? import.meta?.env?.VITE_API_URL_PRODUCTION : import.meta?.env?.VITE_API_URL_LOCAL) || 'http://localhost:8000/api').replace(/\/api\/?$/, '')}/custom-invoice`}
                                    title="הפק חשבונית ידנית ל-Itay Solutions"
                                    className="w-full flex-1 border-0 min-h-0"
                                    style={{ minHeight: '450px' }}
                                />
                            </div>
                        </div>
                    </div>
                )}

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
                                        <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-left hidden xl:table-cell">תזכורות</th>
                                        <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-left">דמי הקמה</th>
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
                                            <td className="px-6 py-4 text-left hidden xl:table-cell">
                                                {Number(inv.abandoned_cart_fee || 0) > 0 ? (
                                                    <span className="text-sm font-black text-amber-600" title="חבילת תזכורות סל נטוש">₪{Number(inv.abandoned_cart_fee).toLocaleString()}</span>
                                                ) : (
                                                    <span className="text-sm text-gray-400">—</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-left">
                                                {Number(inv.setup_fee || 0) > 0 ? (
                                                    <span className="text-sm font-black text-gray-900" title="דמי הקמת חיבור מסוף">₪{Number(inv.setup_fee).toLocaleString()}</span>
                                                ) : (
                                                    <span className="text-sm text-gray-400">—</span>
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
                                                    {inv.status !== 'paid' && (
                                                        <button
                                                            onClick={() => openEditModal(inv)}
                                                            title="עריכת סכומים"
                                                            className="p-2 bg-slate-50 text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-700 hover:text-white transition-all"
                                                        >
                                                            <FaEdit size={12} />
                                                        </button>
                                                    )}
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

            {editInvoice && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-gray-100">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <h3 className="text-lg font-black text-gray-900">עריכת חשבונית</h3>
                            <button
                                type="button"
                                onClick={closeEditModal}
                                className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                            >
                                <FaTimes size={18} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4 text-right">
                            <p className="text-sm text-gray-500 font-medium">
                                {editInvoice.restaurant?.name} · {formatMonth(editInvoice.month)}
                            </p>
                            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl py-2 px-3">
                                לא ניתן לערוך חשבונית שסומנה כשולמה. סה״כ מחושב אוטומטית מסכום השורות אלא אם ממלאים &quot;סה״כ ידני&quot;.
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <label className="block text-xs font-bold text-gray-500">
                                    דמי בסיס (מנוי)
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 font-bold text-gray-900"
                                        value={editForm.base_fee}
                                        onChange={(e) => setEditForm((f) => ({ ...f, base_fee: e.target.value }))}
                                    />
                                </label>
                                <label className="block text-xs font-bold text-gray-500">
                                    עמלה
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 font-bold text-gray-900"
                                        value={editForm.commission_fee}
                                        onChange={(e) => setEditForm((f) => ({ ...f, commission_fee: e.target.value }))}
                                    />
                                </label>
                                <label className="block text-xs font-bold text-gray-500">
                                    תזכורות סל נטוש
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 font-bold text-gray-900"
                                        value={editForm.abandoned_cart_fee}
                                        onChange={(e) => setEditForm((f) => ({ ...f, abandoned_cart_fee: e.target.value }))}
                                    />
                                </label>
                                <label className="block text-xs font-bold text-gray-500">
                                    דמי הקמת מסוף
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 font-bold text-gray-900"
                                        value={editForm.setup_fee}
                                        onChange={(e) => setEditForm((f) => ({ ...f, setup_fee: e.target.value }))}
                                    />
                                </label>
                                <label className="block text-xs font-bold text-gray-500 sm:col-span-2">
                                    מחיר מנוי מקורי (לתצוגה עם קו — ריק למחיקה)
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 font-bold text-gray-900"
                                        value={editForm.original_base_fee}
                                        onChange={(e) => setEditForm((f) => ({ ...f, original_base_fee: e.target.value }))}
                                    />
                                </label>
                                <label className="block text-xs font-bold text-gray-500 sm:col-span-2">
                                    סה״כ ידני (ריק = חישוב אוטומטי)
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        placeholder={`מחושב: ₪${computedEditTotal.toLocaleString()}`}
                                        className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 font-bold text-gray-900"
                                        value={editForm.total_due_override}
                                        onChange={(e) => setEditForm((f) => ({ ...f, total_due_override: e.target.value }))}
                                    />
                                </label>
                            </div>
                            <label className="block text-xs font-bold text-gray-500">
                                הערות פנימיות
                                <textarea
                                    rows={2}
                                    className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800"
                                    value={editForm.notes}
                                    onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                                />
                            </label>
                            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                                <span className="text-sm text-gray-500">
                                    סה״כ משוער:{' '}
                                    <strong className="text-gray-900">
                                        ₪
                                        {(editForm.total_due_override.trim() !== ''
                                            ? parseFloat(editForm.total_due_override) || 0
                                            : computedEditTotal
                                        ).toLocaleString()}
                                    </strong>
                                </span>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={closeEditModal}
                                        className="px-4 py-2 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100"
                                    >
                                        ביטול
                                    </button>
                                    <button
                                        type="button"
                                        disabled={editSaving}
                                        onClick={handleSaveInvoiceEdit}
                                        className="px-5 py-2 rounded-xl text-sm font-black text-white bg-brand-primary hover:opacity-90 disabled:opacity-50"
                                    >
                                        {editSaving ? 'שומר…' : 'שמור'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </SuperAdminLayout>
    );
}
