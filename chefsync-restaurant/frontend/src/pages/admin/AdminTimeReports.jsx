import { useState, useEffect } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { useRestaurantStatus } from '../../context/RestaurantStatusContext';
import AdminLayout from '../../layouts/AdminLayout';
import ProFeatureGate from '../../components/ProFeatureGate';
import posApi from '../../features/pos/api/posApi';
import {
    FaClock,
    FaUserClock,
    FaCalendarAlt,
    FaChevronDown,
    FaChevronUp,
    FaMoneyBillWave,
    FaUsers,
    FaSignInAlt,
    FaSignOutAlt,
    FaCrown,
} from 'react-icons/fa';

function getDefaultRange() {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
        from: from.toISOString().split('T')[0],
        to: to.toISOString().split('T')[0],
    };
}

function formatMinutes(minutes) {
    if (!minutes && minutes !== 0) return '—';
    if (minutes < 60) return `${minutes} דקות`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (m === 0) return `${h} שעות`;
    return `${h} שעות ${m} דק׳`;
}

export default function AdminTimeReports() {
    const { getAuthHeaders, isManager } = useAdminAuth();
    const { subscriptionInfo } = useRestaurantStatus();
    const [tab, setTab] = useState(isManager() ? 'manager' : 'employee');
    const [range, setRange] = useState(getDefaultRange);
    const [managerData, setManagerData] = useState(null);
    const [myData, setMyData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [expandedUser, setExpandedUser] = useState(null);
    const [todayLogs, setTodayLogs] = useState([]);

    const isBasicTier = subscriptionInfo?.tier === 'basic';

    const fetchToday = async () => {
        try {
            const res = await posApi.getToday(getAuthHeaders());
            if (res.data.success) setTodayLogs(res.data.logs);
        } catch (e) {
            console.error('Failed to fetch today logs:', e);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            if (tab === 'manager' && isManager()) {
                const res = await posApi.getReport(range.from, range.to, null, getAuthHeaders());
                if (res.data.success) setManagerData(res.data);
            } else {
                const res = await posApi.getMyReport(range.from, range.to, getAuthHeaders());
                if (res.data.success) setMyData(res.data);
            }
        } catch (e) {
            console.error('Failed to fetch report:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!isBasicTier) fetchData();
    }, [tab, range, isBasicTier]);

    useEffect(() => {
        if (!isBasicTier) fetchToday();
    }, [isBasicTier]);

    if (isBasicTier) {
        return <ProFeatureGate featureName="דוח נוכחות" />;
    }

    const activeClockedIn = todayLogs.filter(l => l.is_active);

    const formatDate = (dateStr) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'short' });
    };

    return (
        <AdminLayout>
            <div className="max-w-7xl mx-auto space-y-8 pb-40 animate-in fade-in duration-700">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 px-4">
                    <div className="flex items-center gap-5">
                        <div className="w-20 h-20 bg-amber-50 rounded-[2rem] flex items-center justify-center text-amber-600 shadow-sm border border-amber-100/50">
                            <FaUserClock size={32} />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black text-gray-900 tracking-tight">דוח נוכחות ושכר</h1>
                            <p className="text-gray-500 font-bold text-sm mt-1">מעקב שעות עבודה וחישוב שכר עובדים</p>
                        </div>
                    </div>

                    {activeClockedIn.length > 0 && (
                        <div className="flex items-center gap-2 px-5 py-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-emerald-700 font-black text-sm">
                                {activeClockedIn.length} מחוברים כרגע
                            </span>
                        </div>
                    )}
                </div>

                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between px-4">
                    {isManager() && (
                        <div className="flex bg-gray-100 rounded-2xl p-1.5">
                            <button
                                onClick={() => setTab('manager')}
                                className={`px-6 py-3 rounded-xl text-sm font-black transition-all ${tab === 'manager' ? 'bg-white shadow-md text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                <FaUsers className="inline ml-2" />
                                דוח לתשלום
                            </button>
                            <button
                                onClick={() => setTab('employee')}
                                className={`px-6 py-3 rounded-xl text-sm font-black transition-all ${tab === 'employee' ? 'bg-white shadow-md text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                <FaClock className="inline ml-2" />
                                השעות שלי
                            </button>
                        </div>
                    )}

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-2xl px-4 py-2.5 shadow-sm">
                            <FaCalendarAlt className="text-gray-400" />
                            <input
                                type="date"
                                value={range.from}
                                onChange={(e) => setRange(r => ({ ...r, from: e.target.value }))}
                                className="bg-transparent border-none text-sm font-bold text-gray-700 focus:outline-none"
                            />
                            <span className="text-gray-300">—</span>
                            <input
                                type="date"
                                value={range.to}
                                onChange={(e) => setRange(r => ({ ...r, to: e.target.value }))}
                                className="bg-transparent border-none text-sm font-bold text-gray-700 focus:outline-none"
                            />
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-amber-500" />
                        <p className="mt-4 text-gray-500 font-bold animate-pulse">טוען דוח...</p>
                    </div>
                ) : tab === 'manager' && isManager() ? (
                    <ManagerReport data={managerData} expandedUser={expandedUser} setExpandedUser={setExpandedUser} formatDate={formatDate} />
                ) : (
                    <EmployeeReport data={myData} formatDate={formatDate} />
                )}

                {todayLogs.length > 0 && (
                    <div className="px-4">
                        <div className="bg-white rounded-[2.5rem] shadow-lg border border-gray-100 p-8">
                            <h3 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-3">
                                <FaClock className="text-amber-500" />
                                פעילות היום
                            </h3>
                            <div className="space-y-3">
                                {todayLogs.map((log, i) => (
                                    <div key={i} className="flex items-center justify-between bg-gray-50 rounded-2xl px-6 py-4">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${log.is_active ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                                                {log.is_active ? <FaSignInAlt /> : <FaSignOutAlt />}
                                            </div>
                                            <div>
                                                <p className="font-black text-gray-900 flex items-center gap-2">
                                                    {log.employee_name}
                                                    {log.role === 'owner' && <FaCrown className="text-amber-400 text-xs" />}
                                                </p>
                                                <p className="text-xs text-gray-500 font-semibold">{log.role === 'owner' ? 'בעלים' : log.role === 'manager' ? 'מנהל' : 'עובד'}</p>
                                            </div>
                                        </div>
                                        <div className="text-left">
                                            <p className="font-bold text-gray-700 text-sm">
                                                {log.clock_in}{log.clock_out ? ` — ${log.clock_out}` : ''}
                                            </p>
                                            {log.is_active ? (
                                                <span className="text-emerald-600 text-xs font-black flex items-center gap-1">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                    עובד כרגע
                                                </span>
                                            ) : (
                                                <span className="text-gray-500 text-xs font-bold">{formatMinutes(log.raw_minutes)}</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}

function ManagerReport({ data, expandedUser, setExpandedUser, formatDate }) {
    if (!data) return null;

    const { employees, summary } = data;
    const payrollEmployees = employees.filter(e => !e.is_owner);
    const ownerEntries = employees.filter(e => e.is_owner);

    return (
        <div className="px-4 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <SummaryCard
                    icon={<FaUsers />}
                    label="עובדים לתשלום"
                    value={summary.payroll_employee_count}
                    color="blue"
                />
                <SummaryCard
                    icon={<FaClock />}
                    label="סה״כ שעות לתשלום"
                    value={`${summary.payroll_hours} שעות`}
                    color="amber"
                />
                <SummaryCard
                    icon={<FaMoneyBillWave />}
                    label="סה״כ לתשלום"
                    value={summary.payroll_total != null ? `₪${summary.payroll_total.toLocaleString()}` : '—'}
                    color="emerald"
                />
            </div>

            {summary.owner_hours > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl px-6 py-4 flex items-center gap-3">
                    <FaCrown className="text-amber-500" />
                    <span className="text-amber-800 font-bold text-sm">
                        שעות בעלים (לא נכלל בחישוב שכר): {summary.owner_hours} שעות
                    </span>
                </div>
            )}

            <div className="space-y-4">
                <h3 className="text-lg font-black text-gray-900 px-2">עובדים</h3>
                {payrollEmployees.map((emp) => (
                    <EmployeeCard key={emp.user_id} emp={emp} expanded={expandedUser === emp.user_id} onToggle={() => setExpandedUser(expandedUser === emp.user_id ? null : emp.user_id)} formatDate={formatDate} />
                ))}

                {payrollEmployees.length === 0 && (
                    <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 p-12 text-center">
                        <FaUserClock className="text-4xl text-gray-300 mx-auto mb-3" />
                        <p className="text-lg font-black text-gray-400">אין עובדים עם שעות בתקופה שנבחרה</p>
                    </div>
                )}

                {ownerEntries.length > 0 && (
                    <>
                        <h3 className="text-lg font-black text-gray-500 px-2 mt-8 flex items-center gap-2">
                            <FaCrown className="text-amber-400" />
                            בעלים (לא לתשלום)
                        </h3>
                        {ownerEntries.map((emp) => (
                            <EmployeeCard key={emp.user_id} emp={emp} expanded={expandedUser === emp.user_id} onToggle={() => setExpandedUser(expandedUser === emp.user_id ? null : emp.user_id)} formatDate={formatDate} isOwner />
                        ))}
                    </>
                )}
            </div>
        </div>
    );
}

function EmployeeCard({ emp, expanded, onToggle, formatDate, isOwner }) {
    return (
        <div className={`bg-white rounded-[2rem] shadow-md border ${isOwner ? 'border-amber-100' : 'border-gray-100'} overflow-hidden`}>
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between px-8 py-6 hover:bg-gray-50 transition-all"
            >
                <div className="flex items-center gap-5">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black border ${isOwner ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>
                        {isOwner ? <FaCrown /> : emp.name.charAt(0)}
                    </div>
                    <div className="text-right">
                        <p className="text-lg font-black text-gray-900">{emp.name}</p>
                        <p className="text-xs text-gray-500 font-semibold">
                            {isOwner
                                ? 'בעלים — לא נכלל בחישוב שכר'
                                : emp.hourly_rate ? `₪${emp.hourly_rate}/שעה` : 'שכר לא מוגדר'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-6">
                    <div className="text-left">
                        <p className="text-xl font-black text-gray-900">
                            {emp.total_hours} <span className="text-sm text-gray-500">שעות</span>
                        </p>
                        <p className="text-xs text-gray-400">
                            ({formatMinutes(emp.raw_minutes)} מדויק → {formatMinutes(emp.rounded_minutes)} מעוגל)
                        </p>
                        {emp.total_pay != null && !isOwner && (
                            <p className="text-emerald-600 font-black text-sm">₪{emp.total_pay.toLocaleString()}</p>
                        )}
                    </div>
                    {expanded ? <FaChevronUp className="text-gray-400" /> : <FaChevronDown className="text-gray-400" />}
                </div>
            </button>

            {expanded && (
                <div className="border-t border-gray-100 px-8 py-6 bg-gray-50/50 animate-in fade-in slide-in-from-top-2 duration-300">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-gray-400 font-black text-xs uppercase tracking-widest">
                                <th className="text-right pb-4">תאריך</th>
                                <th className="text-center pb-4">משמרות</th>
                                <th className="text-center pb-4">דקות</th>
                                <th className="text-left pb-4">שעות (מעוגל)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {emp.days.map((day) => (
                                <tr key={day.date} className="hover:bg-white transition-colors">
                                    <td className="py-3 font-bold text-gray-800">{formatDate(day.date)}</td>
                                    <td className="py-3 text-center text-gray-600">
                                        {day.entries.map((e, i) => (
                                            <span key={i} className="inline-block bg-white px-3 py-1 rounded-lg mx-1 text-xs font-semibold border border-gray-100">
                                                {e.clock_in} — {e.clock_out}
                                                <span className="text-gray-400 mr-1">({e.raw_minutes} דק׳)</span>
                                            </span>
                                        ))}
                                    </td>
                                    <td className="py-3 text-center text-gray-500 font-semibold">{day.raw_minutes}</td>
                                    <td className="py-3 text-left font-black text-gray-900">{day.total_hours}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function EmployeeReport({ data, formatDate }) {
    if (!data) return null;

    const { entries, summary } = data;

    return (
        <div className="px-4 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <SummaryCard
                    icon={<FaClock />}
                    label="סה״כ שעות"
                    value={`${summary.total_hours} שעות`}
                    color="amber"
                />
                {summary.hourly_rate && (
                    <SummaryCard
                        icon={<FaMoneyBillWave />}
                        label="שכר שעתי"
                        value={`₪${summary.hourly_rate}`}
                        color="blue"
                    />
                )}
                {summary.total_pay != null && (
                    <SummaryCard
                        icon={<FaMoneyBillWave />}
                        label="סה״כ שכר"
                        value={`₪${summary.total_pay.toLocaleString()}`}
                        color="emerald"
                    />
                )}
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-lg border border-gray-100 overflow-hidden">
                <div className="px-8 py-6 border-b border-gray-100">
                    <h3 className="text-lg font-black text-gray-900">פירוט שעות</h3>
                    <p className="text-xs text-gray-400 mt-1">עיגול כל 15 דקות</p>
                </div>
                {entries.length > 0 ? (
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr className="text-gray-400 font-black text-xs uppercase tracking-widest">
                                <th className="text-right px-8 py-4">תאריך</th>
                                <th className="text-center px-4 py-4">כניסה</th>
                                <th className="text-center px-4 py-4">יציאה</th>
                                <th className="text-center px-4 py-4">דקות</th>
                                <th className="text-left px-8 py-4">שעות</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {entries.map((e, i) => (
                                <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-8 py-4 font-bold text-gray-800">{formatDate(e.date)}</td>
                                    <td className="px-4 py-4 text-center">
                                        <span className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-xl text-xs font-black">{e.clock_in}</span>
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        <span className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-xl text-xs font-black">{e.clock_out}</span>
                                    </td>
                                    <td className="px-4 py-4 text-center text-gray-500 font-semibold">
                                        {e.raw_minutes} → {e.rounded_minutes}
                                    </td>
                                    <td className="px-8 py-4 text-left font-black text-gray-900">{e.hours}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="p-16 text-center">
                        <FaClock className="text-4xl text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-400 font-black">אין רשומות נוכחות בתקופה שנבחרה</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function SummaryCard({ icon, label, value, color }) {
    const colors = {
        amber: 'bg-amber-50 text-amber-600 border-amber-100',
        emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        blue: 'bg-blue-50 text-blue-600 border-blue-100',
    };
    const iconColors = {
        amber: 'bg-amber-100 text-amber-600',
        emerald: 'bg-emerald-100 text-emerald-600',
        blue: 'bg-blue-100 text-blue-600',
    };

    return (
        <div className={`rounded-[2rem] p-6 border ${colors[color]} flex items-center gap-5`}>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl ${iconColors[color]}`}>
                {icon}
            </div>
            <div>
                <p className="text-xs font-black uppercase tracking-widest opacity-60">{label}</p>
                <p className="text-2xl font-black mt-1">{value}</p>
            </div>
        </div>
    );
}
