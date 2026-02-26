import { useEffect, useMemo, useState } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import SuperAdminLayout from '../../layouts/SuperAdminLayout';
import api from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import {
    FaChartLine,
    FaSync,
    FaSearch,
    FaStore,
    FaCalendarAlt,
    FaCreditCard,
    FaClock,
    FaCheckCircle,
    FaExclamationCircle,
    FaCoins,
    FaShoppingCart,
    FaReceipt,
    FaCrown,
    FaPlay,
    FaTimes,
    FaFilter
} from 'react-icons/fa';

export default function SuperAdminReports() {
    const { getAuthHeaders } = useAdminAuth();
    const [summary, setSummary] = useState(null);
    const [restaurants, setRestaurants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [tierFilter, setTierFilter] = useState('');
    const [activateModal, setActivateModal] = useState(null);
    const [activating, setActivating] = useState(false);
    const [resetting, setResetting] = useState(false);
    const [activateForm, setActivateForm] = useState({ tier: 'basic', plan_type: 'monthly', note: '', record_payment: false, payment_reference: '', trial_days: 14 });

    useEffect(() => {
        fetchData();
    }, [statusFilter, tierFilter]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const headers = getAuthHeaders();
            const params = {};
            if (searchTerm) params.search = searchTerm;
            if (statusFilter) params.status = statusFilter;
            if (tierFilter) params.tier = tierFilter;

            const [summaryRes, restaurantsRes] = await Promise.all([
                api.get('/super-admin/billing/summary', { headers }),
                api.get('/super-admin/billing/restaurants', { headers, params })
            ]);

            setSummary(summaryRes.data.data);
            const list = restaurantsRes.data.restaurants?.data || restaurantsRes.data.restaurants || [];
            setRestaurants(list);
        } catch (error) {
            console.error('Failed to load reports', error);
            toast.error(error.response?.data?.message || 'שגיאה בטעינת דוחות');
        } finally {
            setLoading(false);
        }
    };

    const filteredRestaurants = useMemo(() => {
        if (!searchTerm) return restaurants;
        const term = searchTerm.toLowerCase();
        return restaurants.filter((r) =>
            r.name?.toLowerCase().includes(term) || r.tenant_id?.toLowerCase().includes(term)
        );
    }, [restaurants, searchTerm]);

    const totals = useMemo(() => {
        const monthly = filteredRestaurants.reduce((sum, r) => sum + Number(r.monthly_fee || 0), 0);
        const outstanding = filteredRestaurants.reduce((sum, r) => sum + Number(r.outstanding_amount || 0), 0);
        const orderRevenue = filteredRestaurants.reduce((sum, r) => sum + Number(r.order_revenue || 0), 0);
        const totalOrders = filteredRestaurants.reduce((sum, r) => sum + Number(r.orders_count || 0), 0);
        const totalPaidYtd = filteredRestaurants.reduce((sum, r) => sum + Number(r.total_paid_ytd || 0), 0);
        return { monthly, outstanding, orderRevenue, totalOrders, totalPaidYtd };
    }, [filteredRestaurants]);

    const formatDate = (value) => {
        if (!value) return '—';
        const d = new Date(value);
        return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('he-IL');
    };

    const handleActivate = async () => {
        if (!activateModal) return;
        setActivating(true);
        try {
            const headers = getAuthHeaders();
            await api.post(`/super-admin/billing/restaurants/${activateModal.id}/activate`, activateForm, { headers });
            toast.success(`המנוי הופעל למסעדה ${activateModal.name}`);
            setActivateModal(null);
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'שגיאה בהפעלת מנוי');
        } finally {
            setActivating(false);
        }
    };

    const handleResetToTrial = async () => {
        if (!activateModal) return;
        setResetting(true);
        try {
            const headers = getAuthHeaders();
            await api.post(`/super-admin/billing/restaurants/${activateModal.id}/reset-trial`, {
                tier: activateForm.tier,
                trial_days: activateForm.trial_days ?? 14,
                note: activateForm.note,
            }, { headers });
            toast.success(`המסעדה הוחזרה לתקופת ניסיון (${activateForm.trial_days ?? 14} ימים)`);
            setActivateModal(null);
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'שגיאה בהחזרה לניסיון');
        } finally {
            setResetting(false);
        }
    };

    const StatusBadge = ({ status }) => {
        const styles = {
            active: 'bg-green-100 text-green-700 border-green-200',
            trial: 'bg-blue-100 text-blue-700 border-blue-200',
            suspended: 'bg-orange-100 text-orange-700 border-orange-200',
            cancelled: 'bg-red-100 text-red-700 border-red-200',
            inactive: 'bg-gray-100 text-gray-500 border-gray-200',
        };
        const labels = {
            active: 'פעילה',
            trial: 'ניסיון',
            suspended: 'מושהית',
            cancelled: 'בוטלה',
            inactive: 'לא פעילה',
        };
        const s = status || 'inactive';
        return (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase border ${styles[s] || styles.inactive}`}>
                {s === 'active' && <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
                {s === 'trial' && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />}
                {labels[s] || s}
            </span>
        );
    };

    const StatCard = ({ title, value, subtitle, accent = 'blue', icon }) => {
        const colorClasses = {
            orange: 'text-orange-600 bg-orange-50/50 border-orange-100',
            green: 'text-green-600 bg-green-50/50 border-green-100',
            purple: 'text-purple-600 bg-purple-50/50 border-purple-100',
            blue: 'text-blue-600 bg-blue-50/50 border-blue-100',
            brand: 'text-brand-primary bg-brand-primary/5 border-brand-primary/10',
            amber: 'text-amber-600 bg-amber-50/50 border-amber-100',
        };
        const iconClasses = {
            orange: 'bg-orange-100 text-orange-500',
            green: 'bg-green-100 text-green-500',
            purple: 'bg-purple-100 text-purple-500',
            blue: 'bg-blue-100 text-blue-500',
            brand: 'bg-brand-primary/10 text-brand-primary',
            amber: 'bg-amber-100 text-amber-500',
        };

        return (
            <div className={`p-3.5 rounded-xl border ${colorClasses[accent]} flex items-center justify-between shadow-sm bg-white`}>
                <div className="min-w-0">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">{title}</p>
                    <div className="flex items-baseline gap-1">
                        <h3 className="text-lg font-black text-gray-800 leading-none">{value}</h3>
                    </div>
                    {subtitle && <p className="text-[10px] text-gray-500 mt-1 truncate">{subtitle}</p>}
                </div>
                <div className={`p-2 rounded-lg shrink-0 ${iconClasses[accent]}`}>
                    {icon}
                </div>
            </div>
        );
    };

    return (
        <SuperAdminLayout>
            <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4">
                <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                            <div className="p-2 bg-brand-primary/10 rounded-lg">
                                <FaChartLine className="text-brand-primary" size={20} />
                            </div>
                            דוחות פיננסיים
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">מעקב תשלומים, הכנסות, מצב חשבון מסעדות</p>
                    </div>
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-bold transition-all shadow-sm flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                    >
                        <FaSync size={14} className={loading ? 'animate-spin' : ''} />
                        רענון נתונים
                    </button>
                </div>

                {summary && (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                            <StatCard
                                title="חיוב חודשי צפוי"
                                value={`₪${Number(summary.monthly_expected || 0).toLocaleString()}`}
                                subtitle={`${summary.active_restaurants || 0} מסעדות פעילות`}
                                accent="blue"
                                icon={<FaCalendarAlt size={18} />}
                            />
                            <StatCard
                                title="שולם החודש"
                                value={`₪${Number(summary.paid_this_month || 0).toLocaleString()}`}
                                subtitle="תשלומים שנקלטו"
                                accent="green"
                                icon={<FaCheckCircle size={18} />}
                            />
                            <StatCard
                                title="חוב פתוח"
                                value={`₪${Number(summary.outstanding || 0).toLocaleString()}`}
                                subtitle="סך הכל ממתין"
                                accent="orange"
                                icon={<FaExclamationCircle size={18} />}
                            />
                            <StatCard
                                title="מסעדות במערכת"
                                value={summary.total_restaurants || 0}
                                subtitle={`${summary.active_restaurants || 0} פעילות · ${summary.trial_restaurants || 0} ניסיון`}
                                accent="purple"
                                icon={<FaStore size={18} />}
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                            <StatCard
                                title="הכנסות הזמנות החודש"
                                value={`₪${Number(summary.order_revenue_month || 0).toLocaleString()}`}
                                subtitle={`${summary.orders_this_month || 0} הזמנות החודש`}
                                accent="brand"
                                icon={<FaShoppingCart size={18} />}
                            />
                            <StatCard
                                title="הכנסות הזמנות כולל"
                                value={`₪${Number(summary.order_revenue_total || 0).toLocaleString()}`}
                                subtitle="סך הכל מתחילת הפעילות"
                                accent="amber"
                                icon={<FaReceipt size={18} />}
                            />
                            <StatCard
                                title="שולם ב-YTD"
                                value={`₪${totals.totalPaidYtd.toLocaleString()}`}
                                subtitle="סך תשלומי מנויים השנה"
                                accent="green"
                                icon={<FaCoins size={18} />}
                            />
                        </div>
                    </>
                )}

                {/* Filters */}
                <div className="mb-6 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
                    <div className="flex gap-3 items-center flex-1">
                        <div className="relative flex-1 max-w-md">
                            <FaSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="חיפוש לפי שם מסעדה או מזהה..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pr-10 pl-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-sm"
                            />
                        </div>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-primary/20 outline-none"
                        >
                            <option value="">כל הסטטוסים</option>
                            <option value="active">פעילה</option>
                            <option value="trial">ניסיון</option>
                            <option value="suspended">מושהית</option>
                            <option value="cancelled">מבוטלת</option>
                        </select>
                        <select
                            value={tierFilter}
                            onChange={(e) => setTierFilter(e.target.value)}
                            className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-primary/20 outline-none"
                        >
                            <option value="">כל התוכניות</option>
                            <option value="basic">Basic</option>
                            <option value="pro">Pro</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-bold text-gray-400 bg-gray-50 px-4 py-2.5 rounded-xl border border-gray-100 overflow-x-auto whitespace-nowrap">
                        <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-blue-400" /> חודשי: <span className="text-gray-900 font-black">₪{totals.monthly.toLocaleString()}</span></span>
                        <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-orange-400" /> חוב: <span className="text-gray-900 font-black">₪{totals.outstanding.toLocaleString()}</span></span>
                        <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-green-400" /> הכנסות: <span className="text-gray-900 font-black">₪{totals.orderRevenue.toLocaleString()}</span></span>
                    </div>
                </div>

                {loading ? (
                    <div className="bg-white rounded-3xl border border-gray-100 p-20 text-center shadow-sm">
                        <div className="w-12 h-12 border-4 border-brand-primary/20 border-t-brand-primary rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-gray-500 font-bold">טוען נתונים...</p>
                    </div>
                ) : filteredRestaurants.length === 0 ? (
                    <div className="bg-gray-50 rounded-3xl p-12 text-center border-2 border-dashed border-gray-200">
                        <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-4 text-gray-300">
                            <FaSearch size={24} />
                        </div>
                        <p className="text-gray-500 font-bold">לא נמצאו מסעדות התואמות לחיפוש</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-right border-collapse">
                                <thead className="bg-gray-50/50 border-b border-gray-100">
                                    <tr>
                                        <th className="px-5 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">מסעדה</th>
                                        <th className="px-4 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-center">תוכנית</th>
                                        <th className="px-4 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-left">חיוב חודשי</th>
                                        <th className="px-4 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-left">שולם YTD</th>
                                        <th className="px-4 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-center hidden lg:table-cell">אשראי</th>
                                        <th className="px-4 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-center hidden lg:table-cell">דמי הקמה</th>
                                        <th className="px-4 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-center hidden xl:table-cell">תשלום אחרון</th>
                                        <th className="px-4 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-center">סטטוס</th>
                                        <th className="px-4 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-center">פעולות</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {filteredRestaurants.map((r) => (
                                        <tr key={r.id} className="hover:bg-gray-50/50 transition-colors group">
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-brand-primary/10 group-hover:text-brand-primary transition-colors">
                                                        <FaStore size={14} />
                                                    </div>
                                                    <div>
                                                        <span className="text-sm font-black text-gray-900 block">{r.name}</span>
                                                        <span className="text-[10px] text-gray-400 font-mono">@{r.tenant_id}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black ${r.tier === 'pro' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                                                        <FaCrown size={8} />
                                                        {r.tier === 'pro' ? 'Pro' : 'Basic'}
                                                    </span>
                                                    <span className="text-[9px] text-gray-400 font-bold">
                                                        {r.subscription_plan === 'yearly' ? 'שנתי' : 'חודשי'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-left">
                                                <span className="text-sm font-black text-gray-900">
                                                    ₪{Number(r.monthly_fee || 0).toLocaleString()}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-left">
                                                <div>
                                                    <span className="text-sm font-black text-green-700">
                                                        ₪{Number(r.total_paid_ytd || 0).toLocaleString()}
                                                    </span>
                                                    <span className="text-[10px] text-gray-400 font-bold block">
                                                        {r.payments_count || 0} תשלומים
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-center hidden lg:table-cell">
                                                {r.has_card ? (
                                                    <span className="text-[10px] font-black text-green-600 bg-green-50 px-2 py-1 rounded-lg border border-green-100">
                                                        ****{r.card_last4}
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-gray-400">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-center hidden lg:table-cell">
                                                {r.setup_fee_charged ? (
                                                    <FaCheckCircle className="text-green-500 mx-auto" size={14} />
                                                ) : (
                                                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">ממתין</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-center hidden xl:table-cell">
                                                <div className="flex flex-col items-center">
                                                    <span className="text-xs font-bold text-gray-700">{formatDate(r.last_paid_at)}</span>
                                                    <span className="text-[10px] font-black text-gray-400 uppercase mt-0.5 flex items-center gap-1">
                                                        <FaClock size={8} /> הבא: {formatDate(r.next_charge_at)}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <div className="flex justify-center">
                                                    <StatusBadge status={r.billing_status} />
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <div className="flex justify-center gap-1">
                                                    {r.billing_status !== 'active' && (
                                                        <button
                                                            onClick={() => {
                                                                setActivateModal(r);
                                                                setActivateForm({ tier: r.tier || 'basic', plan_type: r.subscription_plan || 'monthly', note: '', record_payment: false, payment_reference: '', trial_days: 14 });
                                                            }}
                                                            className="px-3 py-1.5 bg-green-50 text-green-600 border border-green-200 rounded-lg text-[10px] font-black hover:bg-green-600 hover:text-white transition-all"
                                                            title="הפעל מנוי ידנית"
                                                        >
                                                            <FaPlay size={10} />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => {
                                                            setActivateModal(r);
                                                            setActivateForm({ tier: r.tier || 'basic', plan_type: r.subscription_plan || 'monthly', note: '', record_payment: false, payment_reference: '', trial_days: 14 });
                                                        }}
                                                        className="px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg text-[10px] font-black hover:bg-blue-600 hover:text-white transition-all"
                                                        title="החזר לתקופת ניסיון"
                                                    >
                                                        🔄
                                                    </button>
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

            {/* Manual Activate Modal */}
            {activateModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setActivateModal(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-black text-gray-900">הפעלת מנוי ידנית</h3>
                            <button onClick={() => setActivateModal(null)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400">
                                <FaTimes size={16} />
                            </button>
                        </div>

                        <p className="text-sm text-gray-600 mb-4 font-medium">
                            מסעדה: <strong>{activateModal.name}</strong>
                        </p>

                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="text-xs font-black text-gray-500 mb-1 block">תוכנית</label>
                                <select
                                    value={activateForm.tier}
                                    onChange={(e) => setActivateForm(f => ({ ...f, tier: e.target.value }))}
                                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-primary/20 outline-none"
                                >
                                    <option value="basic">Basic</option>
                                    <option value="pro">Pro</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-black text-gray-500 mb-1 block">מחזור חיוב</label>
                                <select
                                    value={activateForm.plan_type}
                                    onChange={(e) => setActivateForm(f => ({ ...f, plan_type: e.target.value }))}
                                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-primary/20 outline-none"
                                >
                                    <option value="monthly">חודשי</option>
                                    <option value="yearly">שנתי</option>
                                </select>
                            </div>
                            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-amber-50 border border-amber-100">
                                <input
                                    type="checkbox"
                                    checked={activateForm.record_payment ?? false}
                                    onChange={(e) => setActivateForm(f => ({ ...f, record_payment: e.target.checked }))}
                                    className="w-4 h-4 rounded accent-amber-600"
                                />
                                <span className="text-sm font-bold text-amber-900">תשלום בוצע בפועל — לרישום בדוחות (מסומן = תשלום HYP מאושר)</span>
                            </label>
                            <div>
                                <label className="text-xs font-black text-gray-500 mb-1 block">מזהה עסקה מ-HYP (אופציונלי)</label>
                                <input
                                    type="text"
                                    value={activateForm.payment_reference ?? ''}
                                    onChange={(e) => setActivateForm(f => ({ ...f, payment_reference: e.target.value }))}
                                    placeholder="מזהה עסקה מתקבל HYP"
                                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary/20 outline-none"
                                    dir="ltr"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-black text-gray-500 mb-1 block">הערה (אופציונלי)</label>
                                <input
                                    type="text"
                                    value={activateForm.note ?? ''}
                                    onChange={(e) => setActivateForm(f => ({ ...f, note: e.target.value }))}
                                    placeholder="סיבת הפעלה / פרטים נוספים..."
                                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary/20 outline-none"
                                />
                            </div>

                            <div className="border-t border-gray-200 pt-4 mt-2">
                                <p className="text-xs font-black text-blue-600 mb-2">החזרה לתקופת ניסיון (בדיקת פלואו)</p>
                                <div className="flex items-center gap-3">
                                    <label className="text-xs font-bold text-gray-600">ימי ניסיון:</label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={90}
                                        value={activateForm.trial_days ?? 14}
                                        onChange={(e) => setActivateForm(f => ({ ...f, trial_days: parseInt(e.target.value) || 14 }))}
                                        className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg text-sm font-bold"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            <div className="flex gap-3">
                                <button
                                    onClick={handleActivate}
                                    disabled={activating || resetting}
                                    className="flex-1 px-4 py-3 bg-green-600 text-white rounded-xl font-black text-sm hover:bg-green-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {activating ? 'מפעיל...' : 'הפעל מנוי'}
                                </button>
                                <button
                                    onClick={() => setActivateModal(null)}
                                    className="px-4 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-200 transition-all"
                                >
                                    ביטול
                                </button>
                            </div>
                            <button
                                onClick={handleResetToTrial}
                                disabled={activating || resetting}
                                className="w-full px-4 py-3 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl font-black text-sm hover:bg-blue-100 transition-all disabled:opacity-50"
                            >
                                {resetting ? 'מחזיר...' : 'החזר לתקופת ניסיון (אתחול מחדש)'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </SuperAdminLayout>
    );
}
