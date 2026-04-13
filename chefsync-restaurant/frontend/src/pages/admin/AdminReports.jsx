import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import UpgradeBanner from '../../components/UpgradeBanner';
import { useRestaurantStatus } from '../../context/RestaurantStatusContext';
import { isFeatureUnlocked } from '../../utils/tierUtils';
import { useToast } from '../../context/ToastContext';
import reportService from '../../services/reportService';
import {
    FaChartLine,
    FaShoppingBag,
    FaTimesCircle,
    FaCalendarAlt,
    FaDownload,
    FaMoneyBillWave,
    FaFileExcel,
    FaFilePdf,
    FaFileArchive,
    FaTimes,
    FaSync,
    FaEye,
    FaChevronDown,
    FaChevronUp,
    FaTruck,
    FaStore,
    FaEnvelope,
    FaWhatsapp,
    FaCopy
} from 'react-icons/fa';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';
import { formatDailyReportCalendarDate } from '../../utils/dailyReportDate';

const COLORS = ['#f97316', '#3b82f6', '#8b5cf6', '#22c55e', '#ef4444', '#eab308'];

export default function AdminReports({ embedded = false }) {
    const { addToast } = useToast();
    const { subscriptionInfo } = useRestaurantStatus();
    const reportsUnlocked = isFeatureUnlocked(subscriptionInfo?.features, 'reports');

    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedReport, setSelectedReport] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [exporting, setExporting] = useState(null);
    const [generateDate, setGenerateDate] = useState('');
    const [pagination, setPagination] = useState({ current_page: 1, last_page: 1 });
    const [selectedIds, setSelectedIds] = useState(() => new Set());
    const [bulkLoading, setBulkLoading] = useState(false);
    const [waLinksModal, setWaLinksModal] = useState(null);

    // פילטרים
    const [from, setFrom] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
    });
    const [to, setTo] = useState(() => new Date().toISOString().split('T')[0]);

    const fetchReports = useCallback(async (page = 1) => {
        setLoading(true);
        try {
            const pageData = await reportService.getReports({ from, to, page, per_page: 30 });
            setReports(pageData?.data || []);
            setPagination({
                current_page: pageData?.current_page || 1,
                last_page: pageData?.last_page || 1,
            });
        } catch (err) {
            addToast('שגיאה בטעינת דוחות', 'error');
        } finally {
            setLoading(false);
        }
    }, [from, to, addToast]);

    useEffect(() => {
        fetchReports();
    }, [fetchReports]);

    useEffect(() => {
        setSelectedIds(new Set());
    }, [from, to]);

    const toggleSelect = (id) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAllPage = () => {
        if (reports.length === 0) return;
        const allOnPage = reports.every((r) => selectedIds.has(r.id));
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (allOnPage) {
                reports.forEach((r) => next.delete(r.id));
            } else {
                reports.forEach((r) => next.add(r.id));
            }
            return next;
        });
    };

    const runBulk = async (opts) => {
        if (selectedIds.size === 0) {
            addToast('בחר דוחות מהרשימה', 'error');
            return;
        }
        setBulkLoading(true);
        try {
            const payload = await reportService.bulkDispatchReports({
                report_ids: [...selectedIds],
                send_email: !!opts.send_email,
                whatsapp: !!opts.whatsapp,
                copy_text: !!opts.copy_text,
            });
            if (opts.send_email) {
                addToast(`נשלחו ${payload?.emails_sent ?? 0} מיילים · דולגו ${payload?.skipped_no_email ?? 0} ללא מייל`, 'success');
            }
            if (opts.whatsapp) {
                if (payload?.whatsapp_links?.length) {
                    setWaLinksModal(payload.whatsapp_links);
                } else {
                    addToast('לא נמצאו מספרי וואטסאפ לדוחות שנבחרו', 'error');
                }
            }
            if (opts.copy_text && payload?.copy_text) {
                await navigator.clipboard.writeText(payload.copy_text);
                addToast('הטקסט הועתק ללוח', 'success');
            }
        } catch (err) {
            addToast(err.response?.data?.message || 'שגיאה בפעולה', 'error');
        } finally {
            setBulkLoading(false);
        }
    };

    // KPIs מחושבים
    const totalOrders = reports.reduce((s, r) => s + (r.total_orders || 0), 0);
    const totalRevenue = reports.reduce((s, r) => s + parseFloat(r.total_revenue || 0), 0);
    const totalNetRevenue = reports.reduce((s, r) => s + parseFloat(r.net_revenue || r.total_revenue || 0), 0);
    const totalRefunds = reports.reduce((s, r) => s + parseFloat(r.refund_total || 0), 0);
    const totalCancelled = reports.reduce((s, r) => s + (r.cancelled_orders || 0), 0);
    const avgOrderValue = totalOrders > 0 ? totalNetRevenue / totalOrders : 0;

    // Chart data
    const chartData = [...reports].reverse().map(r => ({
        date: formatDailyReportCalendarDate(r.date)?.substring(5) || '',
        ברוטו: parseFloat(r.total_revenue || 0),
        נטו: parseFloat(r.net_revenue || r.total_revenue || 0),
        הזמנות: r.total_orders || 0,
    }));

    const pieData = [
        { name: 'איסוף', value: reports.reduce((s, r) => s + (r.pickup_orders || 0), 0) },
        { name: 'משלוח', value: reports.reduce((s, r) => s + (r.delivery_orders || 0), 0) },
    ].filter(d => d.value > 0);

    // פירוט אשראי: אם יש פירוט (דוחות חדשים) — מציג 3 סוגים, אחרת fallback לאשראי אחד
    const hasDetailedCredit = reports.some(r => parseFloat(r.online_credit_total || 0) > 0 || parseFloat(r.pos_credit_total || 0) > 0 || parseFloat(r.kiosk_credit_total || 0) > 0);
    const paymentPieData = hasDetailedCredit ? [
        { name: 'מזומן', value: reports.reduce((s, r) => s + parseFloat(r.cash_total || 0), 0) },
        { name: 'אשראי אתר (HYP)', value: reports.reduce((s, r) => s + parseFloat(r.online_credit_total || 0), 0) },
        { name: 'אשראי קופה (POS)', value: reports.reduce((s, r) => s + parseFloat(r.pos_credit_total || 0), 0) },
        { name: 'אשראי קיוסק', value: reports.reduce((s, r) => s + parseFloat(r.kiosk_credit_total || 0), 0) },
    ].filter(d => d.value > 0) : [
        { name: 'מזומן', value: reports.reduce((s, r) => s + parseFloat(r.cash_total || 0), 0) },
        { name: 'אשראי', value: reports.reduce((s, r) => s + parseFloat(r.credit_total || 0), 0) },
    ].filter(d => d.value > 0);

    const sourcePieData = [
        { name: 'אונליין', value: reports.reduce((s, r) => s + (r.web_orders || 0), 0) },
        { name: 'קיוסק', value: reports.reduce((s, r) => s + (r.kiosk_orders || 0), 0) },
        { name: 'קופה', value: reports.reduce((s, r) => s + (r.pos_orders || 0), 0) },
    ].filter(d => d.value > 0);

    // Handlers
    const handleGenerate = async () => {
        if (!generateDate) return addToast('יש לבחור תאריך', 'error');
        setGenerating(true);
        try {
            await reportService.generateReport(generateDate);
            addToast('דוח נוצר בהצלחה', 'success');
            fetchReports();
            setGenerateDate('');
        } catch (err) {
            addToast(err.response?.data?.message || 'שגיאה ביצירת דוח', 'error');
        } finally {
            setGenerating(false);
        }
    };

    const handleExport = async (type) => {
        setExporting(type);
        try {
            if (type === 'csv') await reportService.downloadCsv({ from, to });
            else if (type === 'tax-csv') await reportService.downloadTaxCsv(from, to);
            else if (type === 'zip') await reportService.downloadZip(from, to);
            addToast('הקובץ ירד בהצלחה', 'success');
        } catch (err) {
            addToast('שגיאה בייצוא', 'error');
        } finally {
            setExporting(null);
        }
    };

    const openReport = async (report) => {
        try {
            const reportPayload = await reportService.getReport(report.id);
            setSelectedReport(reportPayload);
            setModalOpen(true);
        } catch {
            addToast('שגיאה בטעינת דוח', 'error');
        }
    };

    const content = (
        <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
            <UpgradeBanner variant="card" context="reports" requiredTier="pro" feature="reports" />
            {!embedded && (
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
                            <span className="p-3 bg-brand-primary/10 rounded-2xl text-brand-primary">
                                <FaChartLine size={28} />
                            </span>
                            דוחות וביצועים
                        </h1>
                        <p className="text-gray-500 mt-1 mr-16 text-sm">דוחות יומיים, ייצוא וניתוח נתונים</p>
                    </div>

                    {/* Export buttons */}
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => handleExport('csv')}
                            disabled={!!exporting}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-50"
                        >
                            <FaFileExcel className="text-green-600" />
                            {exporting === 'csv' ? '...' : 'CSV'}
                        </button>
                        <button
                            onClick={() => handleExport('tax-csv')}
                            disabled={!!exporting}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-50"
                        >
                            <FaFileExcel className="text-amber-600" />
                            {exporting === 'tax-csv' ? '...' : 'מס'}
                        </button>
                        <button
                            onClick={() => handleExport('zip')}
                            disabled={!!exporting}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-50"
                        >
                            <FaFileArchive className="text-purple-600" />
                            {exporting === 'zip' ? '...' : 'ZIP'}
                        </button>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-wrap items-center gap-4">
                <FaCalendarAlt className="text-brand-primary" />
                <input
                    type="date"
                    value={from}
                    onChange={e => setFrom(e.target.value)}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm"
                />
                <span className="text-gray-400">עד</span>
                <input
                    type="date"
                    value={to}
                    onChange={e => setTo(e.target.value)}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm"
                />
                <button
                    onClick={() => fetchReports()}
                    className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-xl text-sm font-bold hover:bg-brand-primary/90 transition-all"
                >
                    <FaSync size={12} /> סנן
                </button>

                <div className="mr-auto flex items-center gap-2">
                    <input
                        type="date"
                        value={generateDate}
                        onChange={e => setGenerateDate(e.target.value)}
                        max={new Date().toISOString().split('T')[0]}
                        className="border border-gray-200 rounded-xl px-3 py-2 text-sm"
                        disabled={!reportsUnlocked}
                    />
                    <button
                        onClick={handleGenerate}
                        disabled={generating || !reportsUnlocked}
                        title={!reportsUnlocked ? 'שדרג חבילה לשימוש בדוחות' : undefined}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-50 ${!reportsUnlocked ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-gray-900 text-white hover:bg-black'}`}
                    >
                        {!reportsUnlocked ? '🔒 צור דוח ידני' : generating ? '...' : 'צור דוח ידני'}
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                    label="ברוטו"
                    value={`₪${totalRevenue.toLocaleString('he-IL', { maximumFractionDigits: 0 })}`}
                    icon={<FaMoneyBillWave />}
                    color="blue"
                />
                <KpiCard
                    label="נטו אמיתי"
                    value={`₪${totalNetRevenue.toLocaleString('he-IL', { maximumFractionDigits: 0 })}`}
                    icon={<FaMoneyBillWave />}
                    color="emerald"
                />
                <KpiCard
                    label="הזמנות"
                    value={totalOrders.toLocaleString()}
                    icon={<FaShoppingBag />}
                    color="orange"
                />
                <KpiCard
                    label="ממוצע להזמנה"
                    value={`₪${avgOrderValue.toLocaleString('he-IL', { maximumFractionDigits: 0 })}`}
                    icon={<FaChartLine />}
                    color="orange"
                />
            </div>
            {(totalRefunds > 0 || totalCancelled > 0) && (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    {totalRefunds > 0 && (
                        <KpiCard
                            label="החזרים"
                            value={`-₪${totalRefunds.toLocaleString('he-IL', { maximumFractionDigits: 0 })}`}
                            icon={<FaTimesCircle />}
                            color="rose"
                        />
                    )}
                    {totalCancelled > 0 && (
                        <KpiCard
                            label="ביטולים"
                            value={totalCancelled.toLocaleString()}
                            icon={<FaTimesCircle />}
                            color="rose"
                        />
                    )}
                </div>
            )}

            {/* Charts */}
            {!loading && reports.length > 0 && (
                <div className="space-y-6">
                    {/* Revenue bar chart */}
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
                            <FaChartLine className="text-blue-500" /> הכנסות יומיות
                        </h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} />
                                <Tooltip
                                    formatter={(value, name) => [`₪${value.toLocaleString()}`, name]}
                                />
                                <Bar dataKey="ברוטו" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="נטו" fill="#22c55e" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Pie charts */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <PieSection
                            title="איסוף / משלוח"
                            icon={<FaTruck className="text-purple-500" />}
                            data={pieData}
                            colors={COLORS.slice(0)}
                            tooltipFormatter={v => v.toLocaleString()}
                        />

                        <PieSection
                            title="אמצעי תשלום"
                            icon={<FaMoneyBillWave className="text-green-500" />}
                            data={paymentPieData}
                            colors={COLORS.slice(2)}
                            tooltipFormatter={v => `₪${v.toLocaleString()}`}
                        />

                        {sourcePieData.length > 0 && (
                            <PieSection
                                title="מקור הזמנה"
                                icon={<FaStore className="text-orange-500" />}
                                data={sourcePieData}
                                colors={COLORS.slice(3)}
                                tooltipFormatter={v => v.toLocaleString()}
                            />
                        )}
                    </div>
                </div>
            )}

            {/* Reports Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-lg font-black text-gray-900">דוחות יומיים</h3>
                    {selectedIds.size > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm text-gray-500">{selectedIds.size} נבחרו</span>
                            <button
                                type="button"
                                disabled={bulkLoading}
                                onClick={() => runBulk({ send_email: true })}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                            >
                                <FaEnvelope size={11} /> מייל
                            </button>
                            <button
                                type="button"
                                disabled={bulkLoading}
                                onClick={() => runBulk({ whatsapp: true })}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                            >
                                <FaWhatsapp size={12} /> וואטסאפ
                            </button>
                            <button
                                type="button"
                                disabled={bulkLoading}
                                onClick={() => runBulk({ copy_text: true })}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-800 text-white hover:bg-black disabled:opacity-50"
                            >
                                <FaCopy size={11} /> העתקה
                            </button>
                        </div>
                    )}
                </div>

                {loading ? (
                    <div className="p-16 text-center text-gray-400">טוען דוחות...</div>
                ) : reports.length === 0 ? (
                    <div className="p-16 text-center text-gray-400">אין דוחות בטווח התאריכים שנבחר</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="text-right p-3 font-bold text-gray-500 w-10">
                                        <input
                                            type="checkbox"
                                            checked={reports.length > 0 && reports.every((r) => selectedIds.has(r.id))}
                                            onChange={toggleSelectAllPage}
                                            title="בחר הכל בעמוד"
                                            className="rounded border-gray-300"
                                        />
                                    </th>
                                    <th className="text-right p-3 font-bold text-gray-500">תאריך</th>
                                    <th className="text-right p-3 font-bold text-gray-500">הזמנות</th>
                                    <th className="text-right p-3 font-bold text-gray-500">ברוטו</th>
                                    <th className="text-right p-3 font-bold text-gray-500 text-emerald-600">נטו</th>
                                    <th className="text-right p-3 font-bold text-gray-500">איסוף</th>
                                    <th className="text-right p-3 font-bold text-gray-500">משלוח</th>
                                    <th className="text-right p-3 font-bold text-gray-500">אונליין</th>
                                    <th className="text-right p-3 font-bold text-gray-500">קיוסק</th>
                                    <th className="text-right p-3 font-bold text-gray-500">קופה</th>
                                    <th className="text-right p-3 font-bold text-gray-500">ממוצע</th>
                                    <th className="text-right p-3 font-bold text-gray-500">ביטולים</th>
                                    <th className="text-right p-3 font-bold text-gray-500">פעולות</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {reports.map(r => (
                                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="p-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(r.id)}
                                                onChange={() => toggleSelect(r.id)}
                                                className="rounded border-gray-300"
                                            />
                                        </td>
                                        <td className="p-3 font-bold">{formatDailyReportCalendarDate(r.date)}</td>
                                        <td className="p-3">{r.total_orders}</td>
                                        <td className="p-3 text-gray-500">₪{parseFloat(r.total_revenue || 0).toLocaleString()}</td>
                                        <td className="p-3 font-bold text-emerald-600">₪{parseFloat(r.net_revenue || r.total_revenue || 0).toLocaleString()}</td>
                                        <td className="p-3">{r.pickup_orders}</td>
                                        <td className="p-3">{r.delivery_orders}</td>
                                        <td className="p-3">{r.web_orders || 0}</td>
                                        <td className="p-3">{r.kiosk_orders || 0}</td>
                                        <td className="p-3">{r.pos_orders || 0}</td>
                                        <td className="p-3">₪{parseFloat(r.avg_order_value || 0).toFixed(0)}</td>
                                        <td className="p-3">
                                            {r.cancelled_orders > 0 && (
                                                <span className="text-rose-600 font-bold">{r.cancelled_orders}</span>
                                            )}
                                            {!r.cancelled_orders && <span className="text-gray-300">0</span>}
                                        </td>
                                        <td className="p-3 flex gap-2">
                                            <button
                                                onClick={() => openReport(r)}
                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="צפייה"
                                            >
                                                <FaEye size={14} />
                                            </button>
                                            <button
                                                onClick={() => reportService.downloadPdf(r.id)}
                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="PDF"
                                            >
                                                <FaFilePdf size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {pagination.last_page > 1 && (
                    <div className="p-4 border-t border-gray-100 flex justify-center gap-2">
                        {Array.from({ length: pagination.last_page }, (_, i) => i + 1).map(page => (
                            <button
                                key={page}
                                onClick={() => fetchReports(page)}
                                className={`w-9 h-9 rounded-lg text-sm font-bold transition-all ${page === pagination.current_page
                                    ? 'bg-brand-primary text-white'
                                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                    }`}
                            >
                                {page}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <UpgradeBanner variant="inline" context="reports" requiredTier="pro" feature="advanced_reports" />

            {/* Detail Modal */}
            {modalOpen && selectedReport && (
                <ReportDetailModal
                    report={selectedReport}
                    onClose={() => { setModalOpen(false); setSelectedReport(null); }}
                    onDownloadPdf={() => reportService.downloadPdf(selectedReport.id)}
                />
            )}

            {waLinksModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50" onClick={() => setWaLinksModal(null)}>
                    <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="font-black text-gray-900">קישורי וואטסאפ</h3>
                            <button type="button" className="p-2 hover:bg-gray-100 rounded-lg" onClick={() => setWaLinksModal(null)}>
                                <FaTimes />
                            </button>
                        </div>
                        <ul className="p-4 overflow-y-auto max-h-[60vh] space-y-2 text-sm">
                            {waLinksModal.map((row) => (
                                <li key={row.report_id} className="flex flex-wrap items-center gap-2 justify-between border border-gray-100 rounded-xl p-2">
                                    <span className="text-gray-600">{formatDailyReportCalendarDate(row.date)}</span>
                                    <a
                                        href={row.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-bold text-green-600 hover:underline"
                                    >
                                        פתח
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );

    if (embedded) return content;
    return <AdminLayout>{content}</AdminLayout>;
}

function KpiCard({ label, value, icon, color }) {
    const colorMap = {
        emerald: 'bg-emerald-50 text-emerald-600',
        blue: 'bg-blue-50 text-blue-600',
        orange: 'bg-orange-50 text-orange-600',
        rose: 'bg-rose-50 text-rose-600',
    };
    return (
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <div className={`inline-flex p-2.5 rounded-xl ${colorMap[color] || colorMap.blue} mb-3`}>
                {icon}
            </div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{label}</p>
            <h3 className="text-2xl font-black text-gray-900">{value}</h3>
        </div>
    );
}

function ReportDetailModal({ report, onClose, onDownloadPdf }) {
    const json = report.report_json || {};
    const topItems = json.top_items || [];
    const hourly = json.hourly_breakdown || {};
    const cashRefund = parseFloat(json.cash_refund_total || 0);
    const creditRefund = parseFloat(json.credit_refund_total || 0);
    const [showHourly, setShowHourly] = useState(false);

    const hourlyData = Object.entries(hourly)
        .filter(([, d]) => (d.orders || 0) > 0)
        .map(([h, d]) => ({
            hour: `${String(h).padStart(2, '0')}:00`,
            הזמנות: d.orders || 0,
            הכנסות: d.revenue || 0,
        }));

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white rounded-t-3xl z-10">
                    <h2 className="text-xl font-black text-gray-900">דוח יומי — {formatDailyReportCalendarDate(report.date)}</h2>
                    <div className="flex items-center gap-2">
                        <button onClick={onDownloadPdf} className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors">
                            <FaFilePdf size={18} />
                        </button>
                        <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl transition-colors">
                            <FaTimes size={18} />
                        </button>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {/* KPIs */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-50 rounded-xl p-4 text-center">
                            <p className="text-xs text-gray-500 font-bold mb-1">ברוטו</p>
                            <p className="text-xl font-black text-gray-700">₪{parseFloat(report.total_revenue || 0).toLocaleString()}</p>
                        </div>
                        <div className="bg-emerald-50 rounded-xl p-4 text-center border-2 border-emerald-200">
                            <p className="text-xs text-emerald-700 font-bold mb-1">נטו אמיתי</p>
                            <p className="text-xl font-black text-emerald-800">₪{parseFloat(report.net_revenue || report.total_revenue || 0).toLocaleString()}</p>
                        </div>
                        <div className="bg-blue-50 rounded-xl p-4 text-center">
                            <p className="text-xs text-blue-700 font-bold mb-1">הזמנות</p>
                            <p className="text-xl font-black text-blue-800">{report.total_orders}</p>
                        </div>
                        <div className="bg-orange-50 rounded-xl p-4 text-center">
                            <p className="text-xs text-orange-700 font-bold mb-1">ממוצע</p>
                            <p className="text-xl font-black text-orange-800">₪{parseFloat(report.avg_order_value || 0).toFixed(0)}</p>
                        </div>
                    </div>

                    {/* החזרים */}
                    {(report.refund_count > 0) && (
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-red-50 rounded-xl p-4 text-center">
                                <p className="text-xs text-red-600 font-bold mb-1">החזרים</p>
                                <p className="text-xl font-black text-red-600">{report.refund_count}</p>
                            </div>
                            <div className="bg-red-50 rounded-xl p-4 text-center">
                                <p className="text-xs text-red-600 font-bold mb-1">סכום החזרים</p>
                                <p className="text-xl font-black text-red-600">-₪{parseFloat(report.refund_total || 0).toLocaleString()}</p>
                            </div>
                        </div>
                    )}

                    {/* סיכום בפועל לאחר החזרים */}
                    {(cashRefund > 0 || creditRefund > 0) && (
                        <div>
                            <h3 className="text-sm font-black text-gray-900 mb-3">סיכום בפועל (לאחר החזרים)</h3>
                            <div className="grid grid-cols-3 gap-3 text-sm">
                                {cashRefund > 0 && (
                                    <>
                                        <div className="bg-gray-50 rounded-xl p-3 text-center">
                                            <p className="text-[10px] text-gray-500 font-bold mb-1">מזומן שנגבה</p>
                                            <p className="text-base font-black text-gray-600">₪{(parseFloat(report.cash_total || 0) + cashRefund).toLocaleString()}</p>
                                        </div>
                                        <div className="bg-red-50 rounded-xl p-3 text-center">
                                            <p className="text-[10px] text-red-600 font-bold mb-1">החזרי מזומן</p>
                                            <p className="text-base font-black text-red-600">-₪{cashRefund.toLocaleString()}</p>
                                        </div>
                                        <div className="bg-emerald-50 rounded-xl p-3 text-center border-2 border-emerald-200">
                                            <p className="text-[10px] text-emerald-700 font-bold mb-1">מזומן בפועל</p>
                                            <p className="text-base font-black text-emerald-800">₪{parseFloat(report.cash_total || 0).toLocaleString()}</p>
                                        </div>
                                    </>
                                )}
                                {creditRefund > 0 && (
                                    <>
                                        <div className="bg-gray-50 rounded-xl p-3 text-center">
                                            <p className="text-[10px] text-gray-500 font-bold mb-1">אשראי שנגבה</p>
                                            <p className="text-base font-black text-gray-600">₪{(parseFloat(report.credit_total || 0) + creditRefund).toLocaleString()}</p>
                                        </div>
                                        <div className="bg-red-50 rounded-xl p-3 text-center">
                                            <p className="text-[10px] text-red-600 font-bold mb-1">החזרי אשראי</p>
                                            <p className="text-base font-black text-red-600">-₪{creditRefund.toLocaleString()}</p>
                                        </div>
                                        <div className="bg-emerald-50 rounded-xl p-3 text-center border-2 border-emerald-200">
                                            <p className="text-[10px] text-emerald-700 font-bold mb-1">אשראי בפועל</p>
                                            <p className="text-base font-black text-emerald-800">₪{parseFloat(report.credit_total || 0).toLocaleString()}</p>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* אמצעי תשלום */}
                    <div>
                        <h3 className="text-sm font-black text-gray-900 mb-3">אמצעי תשלום</h3>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <InfoRow label="מזומן" value={`₪${parseFloat(report.cash_total || 0).toLocaleString()}`} icon={<FaMoneyBillWave className="text-green-500" />} />
                            {(parseFloat(report.online_credit_total || 0) > 0 || parseFloat(report.pos_credit_total || 0) > 0 || parseFloat(report.kiosk_credit_total || 0) > 0) ? (
                                <>
                                    {parseFloat(report.online_credit_total || 0) > 0 && (
                                        <InfoRow label="אשראי אתר (HYP)" value={`₪${parseFloat(report.online_credit_total).toLocaleString()}`} icon={<FaMoneyBillWave className="text-blue-500" />} />
                                    )}
                                    {parseFloat(report.pos_credit_total || 0) > 0 && (
                                        <InfoRow label="אשראי קופה (POS)" value={`₪${parseFloat(report.pos_credit_total).toLocaleString()}`} icon={<FaMoneyBillWave className="text-indigo-500" />} />
                                    )}
                                    {parseFloat(report.kiosk_credit_total || 0) > 0 && (
                                        <InfoRow label="אשראי קיוסק" value={`₪${parseFloat(report.kiosk_credit_total).toLocaleString()}`} icon={<FaMoneyBillWave className="text-purple-500" />} />
                                    )}
                                </>
                            ) : (
                                <InfoRow label="אשראי" value={`₪${parseFloat(report.credit_total || 0).toLocaleString()}`} icon={<FaMoneyBillWave className="text-blue-500" />} />
                            )}
                        </div>
                    </div>

                    {/* Details */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <InfoRow label="איסוף" value={report.pickup_orders} icon={<FaStore className="text-blue-500" />} />
                        <InfoRow label="משלוח" value={report.delivery_orders} icon={<FaTruck className="text-purple-500" />} />
                        {(report.web_orders > 0 || report.kiosk_orders > 0 || report.pos_orders > 0) && (
                            <>
                                <InfoRow label="אונליין" value={`${report.web_orders || 0} (₪${parseFloat(report.web_revenue || 0).toLocaleString()})`} icon={<FaStore className="text-blue-500" />} />
                                <InfoRow label="קיוסק" value={`${report.kiosk_orders || 0} (₪${parseFloat(report.kiosk_revenue || 0).toLocaleString()})`} icon={<FaStore className="text-orange-500" />} />
                                <InfoRow label="קופה" value={`${report.pos_orders || 0} (₪${parseFloat(report.pos_revenue || 0).toLocaleString()})`} icon={<FaStore className="text-green-500" />} />
                                {(report.dine_in_orders > 0 || report.takeaway_orders > 0) && (
                                    <>
                                        <InfoRow label="לשבת (קיוסק)" value={report.dine_in_orders || 0} icon={<FaStore className="text-purple-500" />} />
                                        <InfoRow label="לקחת (קיוסק)" value={report.takeaway_orders || 0} icon={<FaStore className="text-amber-500" />} />
                                    </>
                                )}
                            </>
                        )}
                        {report.cancelled_orders > 0 && (
                            <>
                                <InfoRow label="ביטולים" value={report.cancelled_orders} icon={<FaTimesCircle className="text-red-500" />} />
                                <InfoRow label="סכום ביטולים" value={`₪${parseFloat(report.cancelled_total || 0).toLocaleString()}`} icon={<FaTimesCircle className="text-red-500" />} />
                            </>
                        )}
                    </div>

                    {/* Top items */}
                    {topItems.length > 0 && (
                        <div>
                            <h3 className="text-sm font-black text-gray-900 mb-3">פריטים מובילים</h3>
                            <div className="space-y-2">
                                {topItems.slice(0, 10).map((item, i) => (
                                    <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                        <span className="text-xs font-black text-gray-400 w-6">#{i + 1}</span>
                                        <span className="flex-1 font-bold text-gray-800">{item.name}</span>
                                        <span className="text-xs text-gray-500">{item.quantity} יח׳</span>
                                        <span className="text-xs font-bold text-brand-primary">₪{parseFloat(item.revenue || 0).toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Hourly breakdown */}
                    {hourlyData.length > 0 && (
                        <div>
                            <button
                                onClick={() => setShowHourly(!showHourly)}
                                className="flex items-center gap-2 text-sm font-black text-gray-900 mb-3"
                            >
                                פירוט שעתי
                                {showHourly ? <FaChevronUp size={10} /> : <FaChevronDown size={10} />}
                            </button>
                            {showHourly && (
                                <ResponsiveContainer width="100%" height={200}>
                                    <BarChart data={hourlyData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                                        <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                                        <YAxis tick={{ fontSize: 10 }} />
                                        <Tooltip />
                                        <Bar dataKey="הזמנות" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function PieSection({ title, icon, data, colors, tooltipFormatter }) {
    if (!data || data.length === 0) {
        return (
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <h3 className="text-sm font-black text-gray-900 mb-3 flex items-center gap-2">
                    {icon} {title}
                </h3>
                <p className="text-gray-400 text-sm text-center py-6">אין נתונים</p>
            </div>
        );
    }

    const total = data.reduce((s, d) => s + d.value, 0);

    return (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-sm font-black text-gray-900 mb-3 flex items-center gap-2">
                {icon} {title}
            </h3>
            <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                    <Pie data={data} dataKey="value" cx="50%" cy="50%" outerRadius={50} label={false}>
                        {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                    </Pie>
                    <Tooltip formatter={tooltipFormatter} />
                </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
                {data.map((d, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: colors[i % colors.length] }} />
                        <span className="text-gray-700 font-bold">{d.name}</span>
                        <span className="text-gray-400">{total > 0 ? `${((d.value / total) * 100).toFixed(0)}%` : '0%'}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function InfoRow({ label, value, icon }) {
    return (
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            {icon}
            <span className="text-gray-500">{label}</span>
            <span className="mr-auto font-bold text-gray-900">{value}</span>
        </div>
    );
}
