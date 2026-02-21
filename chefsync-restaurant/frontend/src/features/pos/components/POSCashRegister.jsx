import { useState, useEffect, useCallback } from 'react';
import { FaCashRegister, FaPlus, FaMinus, FaLock, FaShekelSign, FaArrowDown, FaArrowUp, FaReceipt, FaHistory, FaTimesCircle, FaPrint, FaCheckCircle, FaExclamationTriangle, FaUsers } from 'react-icons/fa';
import posApi from '../api/posApi';

function formatDuration(totalMinutes) {
    const mins = Math.round(totalMinutes);
    if (mins < 60) return `${mins} דקות`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (m === 0) return `${h} שעות`;
    return `${h} שעות ו-${m} דקות`;
}

function printZReport(r) {
    const varianceSign = r.variance > 0 ? '+' : '';
    const varianceStatus = r.variance === 0
        ? 'הקופה מאוזנת ✓'
        : `הפרש: ${varianceSign}₪${r.variance.toFixed(2)}`;

    const movementsHtml = (r.movements || []).map(m => {
        const sign = ['payment', 'cash_in'].includes(m.type) ? '+' : '-';
        const label = m.description || typeLabel(m.type);
        return `<tr><td>${m.time}</td><td>${label}${m.order_id ? ` (#${m.order_id})` : ''}</td><td style="text-align:left">${sign}₪${m.amount.toFixed(2)}</td></tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="utf-8">
<title>דוח Z — משמרת #${r.shift_id}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; max-width: 400px; margin: 0 auto; padding: 20px; font-size: 13px; color: #111; }
  h1 { text-align: center; font-size: 18px; margin-bottom: 4px; }
  .sub { text-align: center; color: #666; font-size: 11px; margin-bottom: 16px; }
  .divider { border-top: 1px dashed #999; margin: 12px 0; }
  .section-title { font-weight: bold; font-size: 12px; color: #444; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 1px; }
  .row { display: flex; justify-content: space-between; padding: 2px 0; }
  .row.bold { font-weight: bold; font-size: 14px; }
  .row .label { color: #333; }
  .row .value { font-weight: bold; }
  .variance-box { text-align: center; padding: 10px; margin: 12px 0; border: 2px solid ${r.variance === 0 ? '#22c55e' : '#ef4444'}; border-radius: 8px; font-weight: bold; font-size: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  table td { padding: 3px 4px; border-bottom: 1px solid #eee; }
  .footer { text-align: center; color: #999; font-size: 10px; margin-top: 20px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
<h1>דוח Z — סגירת משמרת</h1>
<p class="sub">משמרת #${r.shift_id}</p>

<div class="divider"></div>
<div class="row"><span class="label">קופאי</span><span class="value">${r.cashier}</span></div>
<div class="row"><span class="label">פתיחה</span><span class="value">${r.opened_at}</span></div>
<div class="row"><span class="label">סגירה</span><span class="value">${r.closed_at || '—'}</span></div>
<div class="row"><span class="label">משך</span><span class="value">${formatDuration(r.duration_minutes)}</span></div>

<div class="divider"></div>
<p class="section-title">מכירות</p>
<div class="row"><span class="label">מזומן (${r.cash_payment_count} עסקאות)</span><span class="value">₪${r.cash_payments.toFixed(2)}</span></div>
<div class="row"><span class="label">אשראי (${r.credit_payment_count} עסקאות)</span><span class="value">₪${r.credit_payments.toFixed(2)}</span></div>
${r.refund_count > 0 ? `<div class="row"><span class="label">החזרים (${r.refund_count})</span><span class="value" style="color:red">-₪${r.refunds.toFixed(2)}</span></div>` : ''}
<div class="divider"></div>
<div class="row bold"><span class="label">סה״כ מכירות (${r.total_payment_count})</span><span class="value">₪${r.total_sales.toFixed(2)}</span></div>

<div class="divider"></div>
<p class="section-title">תנועות מזומן</p>
<div class="row"><span class="label">יתרת פתיחה</span><span class="value">₪${r.opening_balance.toFixed(2)}</span></div>
<div class="row"><span class="label">+ תקבולי מזומן</span><span class="value">₪${r.cash_payments.toFixed(2)}</span></div>
${r.cash_in > 0 ? `<div class="row"><span class="label">+ כניסות</span><span class="value">₪${r.cash_in.toFixed(2)}</span></div>` : ''}
${r.cash_out > 0 ? `<div class="row"><span class="label">- יציאות</span><span class="value">₪${r.cash_out.toFixed(2)}</span></div>` : ''}
${r.refunds > 0 ? `<div class="row"><span class="label">- החזרים</span><span class="value">₪${r.refunds.toFixed(2)}</span></div>` : ''}
<div class="divider"></div>
<div class="row bold"><span class="label">יתרה צפויה</span><span class="value">₪${r.expected_balance.toFixed(2)}</span></div>
${r.closing_balance !== null ? `<div class="row bold"><span class="label">ספירה בפועל</span><span class="value">₪${r.closing_balance.toFixed(2)}</span></div>` : ''}

<div class="variance-box">${varianceStatus}</div>

${(r.clocked_in_employees || []).length > 0 ? `
<div class="divider"></div>
<p class="section-title" style="color:#f59e0b">⚠ עובדים שלא יצאו מהמשמרת (${r.clocked_in_employees.length})</p>
<table>${(r.clocked_in_employees || []).map(e =>
    '<tr style="color:#f59e0b"><td>' + e.name + '</td><td style="text-align:left">מ-' + e.clock_in + '</td></tr>'
).join('')}</table>
` : ''}

${(r.untracked_cash_orders || []).length > 0 ? `
<div style="border:2px solid #ef4444;border-radius:8px;padding:10px;margin:12px 0;">
<p class="section-title" style="color:#ef4444">⚠ הזמנות מזומן שלא נרשמו בקופה</p>
<table>${(r.untracked_cash_orders || []).map(o =>
    `<tr style="color:#ef4444"><td>#${o.id}</td><td>${o.customer_name} (${o.time})</td><td style="text-align:left">₪${o.total.toFixed(2)}</td></tr>`
).join('')}</table>
</div>` : ''}

${(r.orders || []).length > 0 ? `
<div class="divider"></div>
<p class="section-title">כל הזמנות המשמרת (${r.orders.length})</p>
<table>${(r.orders || []).map(o =>
    `<tr${!o.tracked && o.payment_method === 'מזומן' && o.payment_status === 'שולם' ? ' style="color:#ef4444"' : ''}><td>#${o.id}</td><td>${o.customer_name}</td><td>${o.payment_method}</td><td>${o.payment_status}</td><td style="text-align:left">₪${o.total.toFixed(2)}</td></tr>`
).join('')}</table>
` : ''}

${(r.movements || []).length > 0 ? `
<div class="divider"></div>
<p class="section-title">פירוט תנועות</p>
<table>${movementsHtml}</table>
` : ''}

<p class="footer">הופק אוטומטית ממערכת POS • ${new Date().toLocaleDateString('he-IL')}</p>

<script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=450,height=700');
    if (win) {
        win.document.write(html);
        win.document.close();
    }
}

export default function POSCashRegister({ headers, posToken, isManager, onShiftChange }) {
    const [shift, setShift] = useState(null);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [openBalance, setOpenBalance] = useState('');
    const [closeBalance, setCloseBalance] = useState('');
    const [closeNotes, setCloseNotes] = useState('');
    const [showCloseConfirm, setShowCloseConfirm] = useState(false);
    const [movementModal, setMovementModal] = useState(null);
    const [movementAmount, setMovementAmount] = useState('');
    const [movementDesc, setMovementDesc] = useState('');
    const [zReport, setZReport] = useState(null);
    const [showHistory, setShowHistory] = useState(false);
    const [historyShifts, setHistoryShifts] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [clockedInWarning, setClockedInWarning] = useState(null);

    const fetchData = useCallback(async () => {
        try {
            const [shiftRes, summaryRes] = await Promise.all([
                posApi.currentShift(headers, posToken),
                posApi.shiftSummary(headers, posToken),
            ]);
            const s = shiftRes.data.shift;
            setShift(s);
            setSummary(summaryRes.data.summary);
            onShiftChange?.(s);
        } catch (e) {
            console.error('Failed to fetch shift:', e);
        } finally {
            setLoading(false);
        }
    }, [headers, posToken, onShiftChange]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleOpenShift = async () => {
        if (!openBalance && openBalance !== '0') return;
        try {
            await posApi.openShift(parseFloat(openBalance), headers, posToken);
            setOpenBalance('');
            fetchData();
        } catch (e) {
            alert(e.response?.data?.message || 'שגיאה בפתיחת משמרת');
        }
    };

    const checkClockedInBeforeClose = async () => {
        try {
            const res = await posApi.getClockedIn(headers, posToken);
            const emps = res.data.employees || [];
            if (emps.length > 0) {
                setClockedInWarning(emps);
            } else {
                setShowCloseConfirm(true);
            }
        } catch {
            setShowCloseConfirm(true);
        }
    };

    const handleCloseShift = async () => {
        try {
            const res = await posApi.closeShift(parseFloat(closeBalance), closeNotes, headers, posToken);
            setShowCloseConfirm(false);
            setCloseBalance('');
            setCloseNotes('');
            setClockedInWarning(null);
            if (res.data.z_report) {
                const report = res.data.z_report;
                report.clocked_in_employees = res.data.clocked_in_employees || [];
                setZReport(report);
            }
            fetchData();
        } catch (e) {
            alert(e.response?.data?.message || 'שגיאה בסגירת משמרת');
        }
    };

    const handleMovement = async () => {
        if (!movementAmount || !movementModal) return;
        try {
            await posApi.cashMovement(movementModal, parseFloat(movementAmount), movementDesc, headers, posToken);
            setMovementModal(null);
            setMovementAmount('');
            setMovementDesc('');
            fetchData();
        } catch (e) {
            alert(e.response?.data?.message || 'שגיאה');
        }
    };

    const loadHistory = async () => {
        setShowHistory(true);
        setHistoryLoading(true);
        try {
            const res = await posApi.shiftHistory(headers, posToken);
            setHistoryShifts(res.data.shifts || []);
        } catch (e) {
            console.error('Failed to load history:', e);
        } finally {
            setHistoryLoading(false);
        }
    };

    const loadShiftReport = async (shiftId) => {
        try {
            const res = await posApi.shiftReport(shiftId, headers, posToken);
            if (res.data.z_report) {
                setZReport(res.data.z_report);
                setShowHistory(false);
            }
        } catch (e) {
            alert('שגיאה בטעינת דוח Z');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-orange-500" />
            </div>
        );
    }

    if (!shift) {
        return (
            <div className="h-full overflow-y-auto p-6">
                <div className="max-w-md mx-auto space-y-6">
                    <div className="bg-slate-800 rounded-3xl p-10 text-center border border-slate-700 space-y-6">
                        <div className="w-20 h-20 mx-auto bg-orange-500/10 rounded-2xl flex items-center justify-center">
                            <FaCashRegister className="text-orange-400 text-3xl" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white">פתיחת משמרת</h2>
                            <p className="text-slate-400 text-sm mt-2">הזן את יתרת הפתיחה בקופה</p>
                        </div>
                        <div className="space-y-4">
                            <div className="relative">
                                <FaShekelSign className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    type="number"
                                    value={openBalance}
                                    onChange={(e) => setOpenBalance(e.target.value)}
                                    className="w-full pr-10 pl-4 py-4 bg-slate-900 text-white text-2xl font-black text-center rounded-2xl border border-slate-700 focus:border-orange-500 focus:outline-none"
                                    placeholder="0.00"
                                    min="0"
                                    step="0.01"
                                />
                            </div>
                            <button
                                onClick={handleOpenShift}
                                disabled={!openBalance && openBalance !== '0'}
                                className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-lg rounded-2xl disabled:opacity-40 transition-all active:scale-95 shadow-lg shadow-orange-500/20"
                            >
                                פתח משמרת
                            </button>
                        </div>
                    </div>

                    <button
                        onClick={loadHistory}
                        className="w-full py-4 bg-blue-500/10 border border-blue-500/30 rounded-2xl text-blue-400 font-black text-base flex items-center justify-center gap-3 transition-all active:scale-95 hover:bg-blue-500/20"
                    >
                        <FaHistory size={18} />
                        היסטוריית דוחות Z
                    </button>
                </div>

                {zReport && <ZReportModal report={zReport} onClose={() => setZReport(null)} />}
                {showHistory && (
                    <ShiftHistoryModal
                        shifts={historyShifts}
                        loading={historyLoading}
                        onClose={() => setShowHistory(false)}
                        onViewReport={loadShiftReport}
                    />
                )}
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {summary && (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <StatCard label="מזומן בקופה" value={`₪${summary.expected_in_register}`} color="emerald" />
                        <StatCard label="מכירות סה״כ" value={`₪${summary.total_sales}`} color="blue" />
                        <StatCard label="מזומן" value={`₪${summary.cash_payments}`} color="amber" />
                        <StatCard label="הזמנות" value={summary.order_count} color="purple" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <StatCard label="כניסות מזומן" value={`₪${summary.cash_in}`} color="emerald" small />
                        <StatCard label="יציאות מזומן" value={`₪${summary.cash_out}`} color="red" small />
                    </div>
                </>
            )}

            {isManager && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <button
                        onClick={() => setMovementModal('cash_in')}
                        className="flex flex-col items-center gap-2 py-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400 font-black text-sm transition-all active:scale-95 hover:bg-emerald-500/20"
                    >
                        <FaArrowDown size={20} />
                        הכנסת מזומן
                    </button>
                    <button
                        onClick={() => setMovementModal('cash_out')}
                        className="flex flex-col items-center gap-2 py-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 font-black text-sm transition-all active:scale-95 hover:bg-red-500/20"
                    >
                        <FaArrowUp size={20} />
                        הוצאת מזומן
                    </button>
                    <button
                        onClick={loadHistory}
                        className="flex flex-col items-center gap-2 py-4 bg-blue-500/10 border border-blue-500/30 rounded-2xl text-blue-400 font-black text-sm transition-all active:scale-95 hover:bg-blue-500/20"
                    >
                        <FaHistory size={20} />
                        דוחות Z
                    </button>
                    <button
                        onClick={checkClockedInBeforeClose}
                        className="flex flex-col items-center gap-2 py-4 bg-slate-700/50 border border-slate-600/50 rounded-2xl text-slate-300 font-black text-sm transition-all active:scale-95 hover:bg-slate-700"
                    >
                        <FaLock size={20} />
                        סגור משמרת
                    </button>
                </div>
            )}

            {summary?.movements?.length > 0 && (
                <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-700">
                        <h3 className="text-slate-300 font-black text-sm flex items-center gap-2">
                            <FaReceipt className="text-slate-500" /> תנועות אחרונות
                        </h3>
                    </div>
                    <div className="divide-y divide-slate-700/50 max-h-60 overflow-y-auto">
                        {summary.movements.map(m => (
                            <div key={m.id} className="flex items-center justify-between px-5 py-3">
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${
                                        m.type === 'payment' ? 'bg-emerald-500/20 text-emerald-400' :
                                        m.type === 'cash_in' ? 'bg-blue-500/20 text-blue-400' :
                                        m.type === 'cash_out' ? 'bg-red-500/20 text-red-400' :
                                        'bg-amber-500/20 text-amber-400'
                                    }`}>
                                        {m.type === 'payment' ? <FaPlus /> : m.type === 'cash_in' ? <FaArrowDown /> : m.type === 'cash_out' ? <FaArrowUp /> : <FaMinus />}
                                    </div>
                                    <div>
                                        <p className="text-slate-300 text-sm font-semibold">
                                            {m.description || (m.type === 'payment' ? 'תשלום' : m.type === 'cash_in' ? 'הכנסה' : m.type === 'cash_out' ? 'הוצאה' : 'החזר')}
                                        </p>
                                        <p className="text-slate-600 text-xs">{m.time}</p>
                                    </div>
                                </div>
                                <span className={`font-black text-sm ${['payment', 'cash_in'].includes(m.type) ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {['payment', 'cash_in'].includes(m.type) ? '+' : '-'}₪{m.amount}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {movementModal && (
                <Modal onClose={() => setMovementModal(null)}>
                    <h3 className="text-xl font-black text-white mb-4">
                        {movementModal === 'cash_in' ? 'הכנסת מזומן' : 'הוצאת מזומן'}
                    </h3>
                    <input
                        type="number"
                        value={movementAmount}
                        onChange={(e) => setMovementAmount(e.target.value)}
                        className="w-full py-4 bg-slate-900 text-white text-2xl font-black text-center rounded-2xl border border-slate-700 focus:border-orange-500 focus:outline-none mb-3"
                        placeholder="₪ סכום"
                        min="0.01"
                        step="0.01"
                        autoFocus
                    />
                    <input
                        type="text"
                        value={movementDesc}
                        onChange={(e) => setMovementDesc(e.target.value)}
                        className="w-full py-3 px-4 bg-slate-900 text-white rounded-2xl border border-slate-700 focus:border-orange-500 focus:outline-none text-sm mb-4"
                        placeholder="תיאור (אופציונלי)"
                    />
                    <button
                        onClick={handleMovement}
                        disabled={!movementAmount}
                        className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black rounded-2xl disabled:opacity-40 active:scale-95"
                    >
                        אישור
                    </button>
                </Modal>
            )}

            {showCloseConfirm && (
                <Modal onClose={() => setShowCloseConfirm(false)}>
                    <h3 className="text-xl font-black text-white mb-2">סגירת משמרת</h3>
                    <p className="text-slate-400 text-sm mb-4">ספור את המזומן בקופה (צפי: ₪{summary?.expected_in_register})</p>
                    <input
                        type="number"
                        value={closeBalance}
                        onChange={(e) => setCloseBalance(e.target.value)}
                        className="w-full py-4 bg-slate-900 text-white text-2xl font-black text-center rounded-2xl border border-slate-700 focus:border-orange-500 focus:outline-none mb-3"
                        placeholder="₪ סכום בפועל"
                        min="0"
                        step="0.01"
                        autoFocus
                    />
                    <textarea
                        value={closeNotes}
                        onChange={(e) => setCloseNotes(e.target.value)}
                        className="w-full py-3 px-4 bg-slate-900 text-white rounded-2xl border border-slate-700 focus:border-orange-500 focus:outline-none text-sm mb-4 resize-none"
                        placeholder="הערות (אופציונלי)"
                        rows={2}
                    />
                    <button
                        onClick={handleCloseShift}
                        disabled={!closeBalance && closeBalance !== '0'}
                        className="w-full py-4 bg-red-500 text-white font-black rounded-2xl disabled:opacity-40 active:scale-95"
                    >
                        סגור משמרת והפק דוח Z
                    </button>
                </Modal>
            )}

            {clockedInWarning && (
                <Modal onClose={() => setClockedInWarning(null)}>
                    <div className="text-center mb-4">
                        <div className="w-16 h-16 mx-auto bg-amber-500/20 rounded-full flex items-center justify-center mb-3">
                            <FaUsers className="text-amber-400 text-2xl" />
                        </div>
                        <h3 className="text-xl font-black text-white">עובדים עדיין במשמרת!</h3>
                        <p className="text-slate-400 text-sm mt-1">
                            {clockedInWarning.length} עובדים לא ביצעו יציאה מהשעון
                        </p>
                    </div>
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 mb-4 space-y-2">
                        {clockedInWarning.map((emp, i) => (
                            <div key={i} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                                    <span className="text-amber-200 font-bold">{emp.employee_name}</span>
                                </div>
                                <span className="text-amber-400/70 text-xs">מ-{emp.clock_in}</span>
                            </div>
                        ))}
                    </div>
                    <p className="text-slate-500 text-xs text-center mb-4">
                        יש לוודא שכל העובדים מבצעים יציאה דרך שעון הנוכחות לפני סגירת המשמרת
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={() => { setClockedInWarning(null); setShowCloseConfirm(true); }}
                            className="flex-1 py-3 bg-red-500/20 text-red-400 font-black rounded-2xl active:scale-95 transition-all text-sm"
                        >
                            סגור בכל זאת
                        </button>
                        <button
                            onClick={() => setClockedInWarning(null)}
                            className="flex-1 py-3 bg-slate-700 text-white font-black rounded-2xl active:scale-95 transition-all text-sm"
                        >
                            חזרה
                        </button>
                    </div>
                </Modal>
            )}

            {zReport && <ZReportModal report={zReport} onClose={() => setZReport(null)} />}
            {showHistory && (
                <ShiftHistoryModal
                    shifts={historyShifts}
                    loading={historyLoading}
                    onClose={() => setShowHistory(false)}
                    onViewReport={loadShiftReport}
                />
            )}
        </div>
    );
}

function ZReportModal({ report, onClose }) {
    const r = report;
    const varianceColor = r.variance === 0
        ? 'text-emerald-400'
        : r.variance > 0
            ? 'text-blue-400'
            : 'text-red-400';

    const varianceIcon = r.variance === 0
        ? <FaCheckCircle className="text-emerald-400" />
        : <FaExclamationTriangle className={r.variance > 0 ? 'text-blue-400' : 'text-red-400'} />;

    const durationText = formatDuration(r.duration_minutes);

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[300] flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-slate-800 rounded-3xl max-w-lg w-full border border-slate-700 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                <div className="sticky top-0 bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between rounded-t-3xl z-10">
                    <h2 className="text-xl font-black text-white flex items-center gap-3">
                        <FaReceipt className="text-orange-400" />
                        דוח Z — משמרת #{r.shift_id}
                    </h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                        <FaTimesCircle size={22} />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    <div className="bg-slate-900/50 rounded-2xl p-4 space-y-2">
                        <Row label="קופאי" value={r.cashier} />
                        <Row label="פתיחה" value={r.opened_at} />
                        <Row label="סגירה" value={r.closed_at || '—'} />
                        <Row label="משך המשמרת" value={durationText} />
                    </div>

                    <div className="bg-slate-900/50 rounded-2xl p-4 space-y-2">
                        <h4 className="text-slate-500 text-xs font-black uppercase tracking-widest mb-2">מכירות</h4>
                        <Row label={`מזומן (${r.cash_payment_count} עסקאות)`} value={`₪${r.cash_payments.toFixed(2)}`} color="text-emerald-400" />
                        <Row label={`אשראי (${r.credit_payment_count} עסקאות)`} value={`₪${r.credit_payments.toFixed(2)}`} color="text-blue-400" />
                        {r.refund_count > 0 && (
                            <Row label={`החזרים (${r.refund_count})`} value={`-₪${r.refunds.toFixed(2)}`} color="text-red-400" />
                        )}
                        <div className="border-t border-slate-700 pt-2 mt-2">
                            <Row label={`סה״כ מכירות (${r.total_payment_count} עסקאות)`} value={`₪${r.total_sales.toFixed(2)}`} bold />
                        </div>
                    </div>

                    <div className="bg-slate-900/50 rounded-2xl p-4 space-y-2">
                        <h4 className="text-slate-500 text-xs font-black uppercase tracking-widest mb-2">תנועות מזומן</h4>
                        <Row label="יתרת פתיחה" value={`₪${r.opening_balance.toFixed(2)}`} />
                        <Row label="+ תקבולי מזומן" value={`₪${r.cash_payments.toFixed(2)}`} color="text-emerald-400" />
                        {r.cash_in > 0 && <Row label="+ כניסות מזומן" value={`₪${r.cash_in.toFixed(2)}`} color="text-emerald-400" />}
                        {r.cash_out > 0 && <Row label="- יציאות מזומן" value={`₪${r.cash_out.toFixed(2)}`} color="text-red-400" />}
                        {r.refunds > 0 && <Row label="- החזרי מזומן" value={`₪${r.refunds.toFixed(2)}`} color="text-red-400" />}
                        <div className="border-t border-slate-700 pt-2 mt-2">
                            <Row label="יתרה צפויה" value={`₪${r.expected_balance.toFixed(2)}`} bold />
                        </div>
                    </div>

                    <div className={`rounded-2xl p-5 text-center space-y-2 ${
                        r.variance === 0
                            ? 'bg-emerald-500/10 border border-emerald-500/30'
                            : r.variance > 0
                                ? 'bg-blue-500/10 border border-blue-500/30'
                                : 'bg-red-500/10 border border-red-500/30'
                    }`}>
                        <div className="flex items-center justify-center gap-2 text-lg">
                            {varianceIcon}
                            <span className="text-white font-black">
                                {r.variance === 0 ? 'הקופה מאוזנת!' : 'הפרש בקופה'}
                            </span>
                        </div>
                        {r.closing_balance !== null && (
                            <div className="space-y-1">
                                <p className="text-slate-400 text-sm">ספירה בפועל: <span className="text-white font-black">₪{r.closing_balance.toFixed(2)}</span></p>
                                {r.variance !== 0 && (
                                    <p className={`text-2xl font-black ${varianceColor}`}>
                                        {r.variance > 0 ? '+' : ''}₪{r.variance.toFixed(2)}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    {r.clocked_in_employees?.length > 0 && (
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 space-y-2">
                            <div className="flex items-center gap-2 text-amber-400 font-black text-sm mb-1">
                                <FaUsers />
                                עובדים שלא יצאו מהמשמרת ({r.clocked_in_employees.length})
                            </div>
                            {r.clocked_in_employees.map((e, i) => (
                                <div key={i} className="flex items-center justify-between text-sm">
                                    <span className="text-amber-200">{e.name}</span>
                                    <span className="text-amber-400/60 text-xs">מ-{e.clock_in}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {r.untracked_cash_orders?.length > 0 && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 space-y-2">
                            <div className="flex items-center gap-2 text-red-400 font-black text-sm mb-2">
                                <FaExclamationTriangle />
                                הזמנות מזומן שלא נרשמו בקופה ({r.untracked_cash_orders.length})
                            </div>
                            {r.untracked_cash_orders.map(o => (
                                <div key={o.id} className="flex items-center justify-between text-sm">
                                    <span className="text-red-300">
                                        #{o.id} — {o.customer_name} ({o.time}) [{o.source}]
                                    </span>
                                    <span className="text-red-400 font-bold">₪{o.total.toFixed(2)}</span>
                                </div>
                            ))}
                            <p className="text-red-400/60 text-xs mt-1">
                                הזמנות אלה שולמו במזומן אך לא נרשמו כתנועה בקופה
                            </p>
                        </div>
                    )}

                    {r.orders?.length > 0 && (
                        <details className="bg-slate-900/50 rounded-2xl border border-slate-700 overflow-hidden">
                            <summary className="px-5 py-3 cursor-pointer text-slate-400 text-sm font-black hover:text-white transition-colors">
                                כל הזמנות המשמרת ({r.orders.length})
                            </summary>
                            <div className="divide-y divide-slate-700/50 max-h-52 overflow-y-auto">
                                {r.orders.map(o => (
                                    <div key={o.id} className={`flex items-center justify-between px-5 py-2 text-sm ${!o.tracked && o.payment_method === 'מזומן' && o.payment_status === 'שולם' && o.status !== 'cancelled' ? 'bg-red-500/5' : ''}`}>
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-400 font-mono">#{o.id}</span>
                                            <span className="text-slate-300">{o.customer_name}</span>
                                            <span className="text-slate-600 text-xs">{o.time}</span>
                                            <span className={`text-xs px-1.5 py-0.5 rounded ${o.payment_method === 'מזומן' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                                {o.payment_method}
                                            </span>
                                            <span className={`text-xs ${o.payment_status === 'שולם' ? 'text-emerald-500' : o.payment_status === 'בוטל' ? 'text-red-500' : 'text-amber-500'}`}>
                                                {o.payment_status}
                                            </span>
                                        </div>
                                        <span className="text-slate-300 font-bold">₪{o.total.toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        </details>
                    )}

                    {r.movements?.length > 0 && (
                        <details className="bg-slate-900/50 rounded-2xl border border-slate-700 overflow-hidden">
                            <summary className="px-5 py-3 cursor-pointer text-slate-400 text-sm font-black hover:text-white transition-colors">
                                פירוט תנועות ({r.movements.length})
                            </summary>
                            <div className="divide-y divide-slate-700/50 max-h-48 overflow-y-auto">
                                {r.movements.map(m => (
                                    <div key={m.id} className="flex items-center justify-between px-5 py-2 text-sm">
                                        <div>
                                            <span className="text-slate-400">{m.time}</span>
                                            <span className="text-slate-300 mr-2">
                                                {m.description || typeLabel(m.type)}
                                            </span>
                                            {m.order_id && <span className="text-slate-600 text-xs mr-1">(#{m.order_id})</span>}
                                        </div>
                                        <span className={`font-bold ${['payment', 'cash_in'].includes(m.type) ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {['payment', 'cash_in'].includes(m.type) ? '+' : '-'}₪{m.amount.toFixed(2)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </details>
                    )}
                </div>

                <div className="sticky bottom-0 bg-slate-800 border-t border-slate-700 px-6 py-4 flex gap-3 rounded-b-3xl">
                    <button
                        onClick={() => printZReport(r)}
                        className="flex-1 py-3 bg-blue-500/20 text-blue-400 font-black rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all hover:bg-blue-500/30"
                    >
                        <FaPrint /> הדפסה
                    </button>
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 bg-slate-700 text-white font-black rounded-2xl active:scale-95 transition-all hover:bg-slate-600"
                    >
                        סגור
                    </button>
                </div>
            </div>
        </div>
    );
}

function ShiftHistoryModal({ shifts, loading, onClose, onViewReport }) {
    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[300] flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-slate-800 rounded-3xl max-w-lg w-full border border-slate-700 animate-in zoom-in-95 duration-200 max-h-[85vh] overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
                    <h2 className="text-xl font-black text-white flex items-center gap-3">
                        <FaHistory className="text-blue-400" />
                        היסטוריית דוחות Z
                    </h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                        <FaTimesCircle size={22} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {loading && (
                        <div className="flex items-center justify-center py-10">
                            <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-b-4 border-orange-500" />
                        </div>
                    )}

                    {!loading && shifts.length === 0 && (
                        <div className="text-center py-10">
                            <FaReceipt className="text-4xl text-slate-700 mx-auto mb-3" />
                            <p className="text-slate-500 font-black">אין משמרות קודמות</p>
                        </div>
                    )}

                    {!loading && shifts.map(s => {
                        const varianceColor = s.variance === 0 ? 'text-emerald-400' : s.variance > 0 ? 'text-blue-400' : 'text-red-400';
                        return (
                            <button
                                key={s.id}
                                onClick={() => onViewReport(s.id)}
                                className="w-full bg-slate-900/50 hover:bg-slate-700/50 border border-slate-700 rounded-2xl p-4 text-right transition-all active:scale-[0.98]"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-white font-black">משמרת #{s.id}</span>
                                    <span className="text-slate-500 text-xs">{s.closed_at}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-400">{s.cashier}</span>
                                    <div className="flex items-center gap-3">
                                        <span className="text-slate-300 font-bold">₪{(s.closing_balance || 0).toFixed(2)}</span>
                                        <span className={`font-black ${varianceColor}`}>
                                            {s.variance === 0 ? '✓' : `${s.variance > 0 ? '+' : ''}₪${s.variance.toFixed(2)}`}
                                        </span>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function Row({ label, value, color, bold }) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm">{label}</span>
            <span className={`font-black text-sm ${color || 'text-white'} ${bold ? 'text-base' : ''}`}>{value}</span>
        </div>
    );
}

function typeLabel(type) {
    const map = { payment: 'תשלום', cash_in: 'הכנסת מזומן', cash_out: 'הוצאת מזומן', refund: 'החזר' };
    return map[type] || type;
}

function StatCard({ label, value, color, small }) {
    const colors = {
        emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
        blue: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
        amber: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
        purple: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
        red: 'bg-red-500/10 border-red-500/20 text-red-400',
    };
    return (
        <div className={`rounded-2xl border p-4 ${colors[color]}`}>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-60">{label}</p>
            <p className={`font-black mt-1 ${small ? 'text-lg' : 'text-2xl'}`}>{value}</p>
        </div>
    );
}

function Modal({ children, onClose }) {
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-slate-800 rounded-3xl p-8 max-w-md w-full border border-slate-700 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                {children}
            </div>
        </div>
    );
}
