import { useEffect, useMemo, useState } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import SuperAdminLayout from '../../layouts/SuperAdminLayout';
import api from '../../services/apiClient';
import reportService from '../../services/reportService';
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
    FaFilter,
    FaChartBar,
    FaArrowRight,
    FaArrowLeft,
    FaGift,
    FaCheck,
    FaTag
} from 'react-icons/fa';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

export default function SuperAdminReports() {
    const { getAuthHeaders } = useAdminAuth();
    const [activeTab, setActiveTab] = useState('billing');
    const [summary, setSummary] = useState(null);
    const [restaurants, setRestaurants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [tierFilter, setTierFilter] = useState('');
    const [activateModal, setActivateModal] = useState(null);
    const [activating, setActivating] = useState(false);
    const [resetting, setResetting] = useState(false);
    const [grantingFree, setGrantingFree] = useState(false);
    const [activateForm, setActivateForm] = useState({ tier: 'basic', plan_type: 'monthly', note: '', record_payment: false, payment_reference: '', trial_days: 14, free_months: 1, free_note: '', custom_price_enabled: false, custom_monthly_price: '', custom_yearly_price: '' });
    const [wizardStep, setWizardStep] = useState(1);
    const [wizardAction, setWizardAction] = useState('activate'); // 'activate' | 'free' | 'trial'

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
            const payload = { ...activateForm };
            // שלח מחירים מותאמים רק אם הופעלה דריסת מחיר
            if (!payload.custom_price_enabled) {
                delete payload.custom_monthly_price;
                delete payload.custom_yearly_price;
            } else {
                if (payload.custom_monthly_price !== '') payload.custom_monthly_price = parseFloat(payload.custom_monthly_price);
                else delete payload.custom_monthly_price;
                if (payload.custom_yearly_price !== '') payload.custom_yearly_price = parseFloat(payload.custom_yearly_price);
                else delete payload.custom_yearly_price;
            }
            delete payload.custom_price_enabled;
            await api.post(`/super-admin/billing/restaurants/${activateModal.id}/activate`, payload, { headers });
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

    const handleGrantFreeMonth = async () => {
        if (!activateModal) return;
        setGrantingFree(true);
        try {
            const headers = getAuthHeaders();
            const res = await api.post(`/super-admin/billing/restaurants/${activateModal.id}/grant-free-month`, {
                months: activateForm.free_months ?? 1,
                note: activateForm.free_note || null,
            }, { headers });
            toast.success(res.data.message || 'הוארך בהצלחה!');
            setActivateModal(null);
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'שגיאה בהארכה');
        } finally {
            setGrantingFree(false);
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

                {/* Tabs */}
                <div className="flex gap-2 mb-6">
                    <button
                        onClick={() => setActiveTab('billing')}
                        className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'billing' ? 'bg-brand-primary text-white shadow-md' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    >
                        <FaReceipt className="inline ml-2" size={14} />
                        חיובים ומנויים
                    </button>
                    <button
                        onClick={() => setActiveTab('daily')}
                        className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'daily' ? 'bg-brand-primary text-white shadow-md' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    >
                        <FaChartBar className="inline ml-2" size={14} />
                        דוחות יומיים
                    </button>
                </div>

                {activeTab === 'daily' && <DailyReportsSummaryTab />}

                {activeTab === 'billing' && summary && (
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

                {activeTab === 'billing' && (
                    <>
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
                                                                        const hasCustom = r.monthly_price && r.monthly_price != 600;
                                                                        setActivateForm({ tier: r.tier || 'basic', plan_type: r.subscription_plan || 'monthly', note: '', record_payment: false, payment_reference: '', trial_days: 14, free_months: 1, free_note: '', custom_price_enabled: !!hasCustom, custom_monthly_price: hasCustom ? r.monthly_price : '', custom_yearly_price: r.yearly_price && r.yearly_price != 5000 ? r.yearly_price : '' });
                                                                        setWizardStep(1);
                                                                        setWizardAction('activate');
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
                                                                    setActivateForm({ tier: r.tier || 'basic', plan_type: r.subscription_plan || 'monthly', note: '', record_payment: false, payment_reference: '', trial_days: 14, free_months: 1, free_note: '', custom_price_enabled: false, custom_monthly_price: '', custom_yearly_price: '' });
                                                                    setWizardStep(1);
                                                                    setWizardAction('activate');
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
                    </>
                )}
            </div>

            {/* Manual Activate Wizard */}
            {activateModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm" onClick={() => setActivateModal(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        {/* Wizard Header */}
                        <div className="px-5 py-4 border-b border-gray-100 shrink-0">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-base sm:text-lg font-black text-gray-900">ניהול מנוי</h3>
                                <button onClick={() => setActivateModal(null)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400">
                                    <FaTimes size={16} />
                                </button>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                <FaStore size={12} className="text-gray-400" />
                                <span className="font-bold truncate">{activateModal.name}</span>
                                <StatusBadge status={activateModal.billing_status} />
                            </div>
                            {/* Step indicators */}
                            <div className="flex items-center gap-1.5 mt-3">
                                {(() => {
                                    const totalSteps = wizardAction === 'activate' ? 4 : wizardAction === 'free' ? 3 : 3;
                                    const stepLabels = wizardAction === 'activate'
                                        ? ['פעולה', 'תוכנית', 'תשלום', 'סיכום']
                                        : wizardAction === 'free'
                                            ? ['פעולה', 'הגדרות', 'סיכום']
                                            : ['פעולה', 'הגדרות', 'סיכום'];
                                    return Array.from({ length: totalSteps }, (_, i) => {
                                        const step = i + 1;
                                        const isActive = step === wizardStep;
                                        const isDone = step < wizardStep;
                                        return (
                                            <div key={step} className="flex items-center gap-1.5 flex-1">
                                                <div className={`
                                                    w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 transition-all
                                                    ${isActive ? 'bg-brand-primary text-white shadow-sm ring-2 ring-brand-primary/20' : isDone ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'}
                                                `}>
                                                    {isDone ? <FaCheck size={10} /> : step}
                                                </div>
                                                <span className={`text-[10px] font-bold hidden sm:block truncate ${isActive ? 'text-gray-800' : 'text-gray-400'}`}>
                                                    {stepLabels[i]}
                                                </span>
                                                {step < totalSteps && <div className={`h-0.5 flex-1 rounded-full ${isDone ? 'bg-green-400' : 'bg-gray-100'}`} />}
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </div>

                        {/* Wizard Body */}
                        <div className="flex-1 overflow-y-auto px-5 py-4">
                            {/* Step 1: Choose Action */}
                            {wizardStep === 1 && (
                                <div className="space-y-3">
                                    <p className="text-sm font-bold text-gray-700 mb-4">בחר את הפעולה הרצויה:</p>
                                    {[
                                        { key: 'activate', icon: <FaPlay size={16} />, label: 'הפעלת מנוי', desc: 'הפעל מנוי חדש או חדש מנוי קיים', color: 'green' },
                                        { key: 'free', icon: <FaGift size={16} />, label: 'הארכה חינם', desc: 'הארך מנוי ללא חיוב (מבצע / הטבה)', color: 'amber' },
                                        { key: 'trial', icon: <FaClock size={16} />, label: 'החזר לניסיון', desc: 'אתחל תקופת ניסיון מחדש', color: 'blue' },
                                    ].map(action => {
                                        const isSelected = wizardAction === action.key;
                                        const colorMap = {
                                            green: { bg: 'bg-green-50', border: 'border-green-300', icon: 'bg-green-100 text-green-600', ring: 'ring-green-200' },
                                            amber: { bg: 'bg-amber-50', border: 'border-amber-300', icon: 'bg-amber-100 text-amber-600', ring: 'ring-amber-200' },
                                            blue: { bg: 'bg-blue-50', border: 'border-blue-300', icon: 'bg-blue-100 text-blue-600', ring: 'ring-blue-200' },
                                        };
                                        const c = colorMap[action.color];
                                        return (
                                            <button
                                                key={action.key}
                                                onClick={() => setWizardAction(action.key)}
                                                className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-right
                                                    ${isSelected ? `${c.bg} ${c.border} ring-2 ${c.ring}` : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'}`}
                                            >
                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isSelected ? c.icon : 'bg-gray-100 text-gray-400'}`}>
                                                    {action.icon}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-black text-gray-800">{action.label}</p>
                                                    <p className="text-xs text-gray-500 mt-0.5">{action.desc}</p>
                                                </div>
                                                {isSelected && <FaCheck size={14} className={`mr-auto shrink-0 ${c.icon.split(' ')[1]}`} />}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Step 2 for 'activate': Plan + Custom Price */}
                            {wizardStep === 2 && wizardAction === 'activate' && (
                                <div className="space-y-5">
                                    <div>
                                        <label className="text-xs font-black text-gray-500 mb-2 block">תוכנית</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            {[{ value: 'basic', label: 'Basic', desc: 'תכונות בסיסיות' }, { value: 'pro', label: 'Pro', desc: 'כל התכונות' }].map(t => (
                                                <button
                                                    key={t.value}
                                                    onClick={() => setActivateForm(f => ({ ...f, tier: t.value }))}
                                                    className={`p-4 rounded-xl border-2 transition-all text-center
                                                        ${activateForm.tier === t.value ? 'border-brand-primary bg-brand-primary/5 ring-2 ring-brand-primary/20' : 'border-gray-100 hover:border-gray-200'}`}
                                                >
                                                    <p className="text-sm font-black text-gray-800">{t.label}</p>
                                                    <p className="text-[10px] text-gray-500 mt-0.5">{t.desc}</p>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-black text-gray-500 mb-2 block">מחזור חיוב</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            {[{ value: 'monthly', label: 'חודשי' }, { value: 'yearly', label: 'שנתי' }].map(p => (
                                                <button
                                                    key={p.value}
                                                    onClick={() => setActivateForm(f => ({ ...f, plan_type: p.value }))}
                                                    className={`p-3 rounded-xl border-2 transition-all text-center
                                                        ${activateForm.plan_type === p.value ? 'border-brand-primary bg-brand-primary/5 ring-2 ring-brand-primary/20' : 'border-gray-100 hover:border-gray-200'}`}
                                                >
                                                    <p className="text-sm font-bold text-gray-800">{p.label}</p>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Custom price override */}
                                    <div>
                                        <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-purple-50 border border-purple-100">
                                            <input
                                                type="checkbox"
                                                checked={activateForm.custom_price_enabled ?? false}
                                                onChange={(e) => setActivateForm(f => ({ ...f, custom_price_enabled: e.target.checked }))}
                                                className="w-4 h-4 rounded accent-purple-600"
                                            />
                                            <div className="flex items-center gap-1.5">
                                                <FaTag size={11} className="text-purple-500" />
                                                <span className="text-sm font-bold text-purple-900">מחיר לחיוב מותאם (לא נרשם כתשלום)</span>
                                            </div>
                                        </label>
                                        {activateForm.custom_price_enabled && (
                                            <div className="mt-3 bg-purple-50/50 border border-purple-100 rounded-xl p-4 space-y-3">
                                                <p className="text-xs text-purple-600 font-bold">קובע את מחיר החיוב למסעדה זו — המחיר הפומבי לא ישתנה</p>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="text-xs font-black text-gray-500 mb-1 block">חודשי (₪)</label>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="1"
                                                            value={activateForm.custom_monthly_price}
                                                            onChange={(e) => setActivateForm(f => ({ ...f, custom_monthly_price: e.target.value }))}
                                                            placeholder="ברירת מחדל"
                                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-purple-500/20 outline-none"
                                                            dir="ltr"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-black text-gray-500 mb-1 block">שנתי (₪)</label>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="1"
                                                            value={activateForm.custom_yearly_price}
                                                            onChange={(e) => setActivateForm(f => ({ ...f, custom_yearly_price: e.target.value }))}
                                                            placeholder="ברירת מחדל"
                                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-purple-500/20 outline-none"
                                                            dir="ltr"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Step 2 for 'free': Free months settings */}
                            {wizardStep === 2 && wizardAction === 'free' && (
                                <div className="space-y-5">
                                    <div>
                                        <label className="text-xs font-black text-gray-500 mb-2 block">מספר חודשים להארכה</label>
                                        <div className="flex flex-wrap gap-2">
                                            {[1, 2, 3, 6, 12].map(m => (
                                                <button
                                                    key={m}
                                                    onClick={() => setActivateForm(f => ({ ...f, free_months: m }))}
                                                    className={`px-4 py-2.5 rounded-xl border-2 text-sm font-bold transition-all
                                                        ${activateForm.free_months === m ? 'border-amber-400 bg-amber-50 text-amber-700 ring-2 ring-amber-200' : 'border-gray-100 text-gray-600 hover:border-gray-200'}`}
                                                >
                                                    {m} {m === 1 ? 'חודש' : 'חודשים'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-black text-gray-500 mb-1 block">סיבה / הערה</label>
                                        <input
                                            type="text"
                                            value={activateForm.free_note ?? ''}
                                            onChange={(e) => setActivateForm(f => ({ ...f, free_note: e.target.value }))}
                                            placeholder="למשל: הביא מסעדה חדשה, מבצע השקה..."
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/20 outline-none"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Step 2 for 'trial': Trial settings */}
                            {wizardStep === 2 && wizardAction === 'trial' && (
                                <div className="space-y-5">
                                    <div>
                                        <label className="text-xs font-black text-gray-500 mb-2 block">תוכנית</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            {[{ value: 'basic', label: 'Basic' }, { value: 'pro', label: 'Pro' }].map(t => (
                                                <button
                                                    key={t.value}
                                                    onClick={() => setActivateForm(f => ({ ...f, tier: t.value }))}
                                                    className={`p-3 rounded-xl border-2 transition-all text-center
                                                        ${activateForm.tier === t.value ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-200' : 'border-gray-100 hover:border-gray-200'}`}
                                                >
                                                    <p className="text-sm font-bold text-gray-800">{t.label}</p>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-black text-gray-500 mb-2 block">ימי ניסיון</label>
                                        <div className="flex flex-wrap gap-2">
                                            {[7, 14, 30, 60, 90].map(d => (
                                                <button
                                                    key={d}
                                                    onClick={() => setActivateForm(f => ({ ...f, trial_days: d }))}
                                                    className={`px-4 py-2.5 rounded-xl border-2 text-sm font-bold transition-all
                                                        ${activateForm.trial_days === d ? 'border-blue-400 bg-blue-50 text-blue-700 ring-2 ring-blue-200' : 'border-gray-100 text-gray-600 hover:border-gray-200'}`}
                                                >
                                                    {d} ימים
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-black text-gray-500 mb-1 block">הערה (אופציונלי)</label>
                                        <input
                                            type="text"
                                            value={activateForm.note ?? ''}
                                            onChange={(e) => setActivateForm(f => ({ ...f, note: e.target.value }))}
                                            placeholder="סיבה / פרטים..."
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Step 3 for 'activate': Payment details */}
                            {wizardStep === 3 && wizardAction === 'activate' && (
                                <div className="space-y-5">
                                    <label className="flex items-center gap-3 cursor-pointer p-4 rounded-xl bg-amber-50 border border-amber-100">
                                        <input
                                            type="checkbox"
                                            checked={activateForm.record_payment ?? false}
                                            onChange={(e) => setActivateForm(f => ({ ...f, record_payment: e.target.checked }))}
                                            className="w-5 h-5 rounded accent-amber-600"
                                        />
                                        <div>
                                            <span className="text-sm font-bold text-amber-900 block">תשלום בוצע בפועל</span>
                                            <span className="text-xs text-amber-700">לרישום בדוחות — מסומן = תשלום HYP מאושר</span>
                                        </div>
                                    </label>
                                    <div>
                                        <label className="text-xs font-black text-gray-500 mb-1 block">מזהה עסקה מ-HYP (אופציונלי)</label>
                                        <input
                                            type="text"
                                            value={activateForm.payment_reference ?? ''}
                                            onChange={(e) => setActivateForm(f => ({ ...f, payment_reference: e.target.value }))}
                                            placeholder="מזהה עסקה"
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
                                </div>
                            )}

                            {/* Final Step: Summary & Confirm */}
                            {((wizardAction === 'activate' && wizardStep === 4) || (wizardAction !== 'activate' && wizardStep === 3)) && (
                                <div className="space-y-4">
                                    <p className="text-sm font-bold text-gray-700 mb-2">אישור פעולה:</p>
                                    <div className="bg-gray-50 rounded-xl p-4 space-y-3 text-sm">
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-500 font-bold">מסעדה</span>
                                            <span className="font-black text-gray-800">{activateModal.name}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-500 font-bold">פעולה</span>
                                            <span className={`font-black ${wizardAction === 'activate' ? 'text-green-600' : wizardAction === 'free' ? 'text-amber-600' : 'text-blue-600'}`}>
                                                {wizardAction === 'activate' ? 'הפעלת מנוי' : wizardAction === 'free' ? 'הארכה חינם' : 'החזרה לניסיון'}
                                            </span>
                                        </div>
                                        {wizardAction === 'activate' && (
                                            <>
                                                <div className="border-t border-gray-200 pt-2 flex justify-between items-center">
                                                    <span className="text-gray-500 font-bold">תוכנית</span>
                                                    <span className="font-black text-gray-800">{activateForm.tier === 'pro' ? 'Pro' : 'Basic'} — {activateForm.plan_type === 'yearly' ? 'שנתי' : 'חודשי'}</span>
                                                </div>
                                                {activateForm.custom_price_enabled && (activateForm.custom_monthly_price || activateForm.custom_yearly_price) && (
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-purple-500 font-bold flex items-center gap-1"><FaTag size={10} /> מחיר מותאם</span>
                                                        <span className="font-black text-purple-700">
                                                            {activateForm.custom_monthly_price ? `₪${activateForm.custom_monthly_price}/חודש` : ''}
                                                            {activateForm.custom_monthly_price && activateForm.custom_yearly_price ? ' | ' : ''}
                                                            {activateForm.custom_yearly_price ? `₪${activateForm.custom_yearly_price}/שנה` : ''}
                                                        </span>
                                                    </div>
                                                )}
                                                {activateForm.record_payment && (
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-amber-600 font-bold">רישום תשלום</span>
                                                        <span className="font-bold text-amber-700">כן{activateForm.payment_reference ? ` (${activateForm.payment_reference})` : ''}</span>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                        {wizardAction === 'free' && (
                                            <div className="border-t border-gray-200 pt-2 flex justify-between items-center">
                                                <span className="text-gray-500 font-bold">תקופה</span>
                                                <span className="font-black text-amber-600">{activateForm.free_months} {activateForm.free_months === 1 ? 'חודש' : 'חודשים'} חינם</span>
                                            </div>
                                        )}
                                        {wizardAction === 'trial' && (
                                            <>
                                                <div className="border-t border-gray-200 pt-2 flex justify-between items-center">
                                                    <span className="text-gray-500 font-bold">תוכנית</span>
                                                    <span className="font-black text-gray-800">{activateForm.tier === 'pro' ? 'Pro' : 'Basic'}</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-gray-500 font-bold">ימי ניסיון</span>
                                                    <span className="font-black text-blue-600">{activateForm.trial_days} ימים</span>
                                                </div>
                                            </>
                                        )}
                                        {((wizardAction === 'activate' && activateForm.note) || (wizardAction === 'free' && activateForm.free_note) || (wizardAction === 'trial' && activateForm.note)) && (
                                            <div className="border-t border-gray-200 pt-2 flex justify-between items-start">
                                                <span className="text-gray-500 font-bold">הערה</span>
                                                <span className="font-medium text-gray-600 text-left max-w-[60%]">
                                                    {wizardAction === 'free' ? activateForm.free_note : activateForm.note}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Wizard Footer */}
                        <div className="px-5 py-4 border-t border-gray-100 shrink-0 flex flex-col sm:flex-row gap-2">
                            {wizardStep > 1 && (
                                <button
                                    onClick={() => setWizardStep(s => s - 1)}
                                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold text-sm transition-all order-2 sm:order-1"
                                >
                                    <FaArrowRight size={11} />
                                    חזרה
                                </button>
                            )}
                            {wizardStep === 1 && (
                                <button
                                    onClick={() => setActivateModal(null)}
                                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold text-sm transition-all order-2 sm:order-1"
                                >
                                    ביטול
                                </button>
                            )}

                            {/* Next / Submit button */}
                            {(() => {
                                const totalSteps = wizardAction === 'activate' ? 4 : 3;
                                const isFinal = wizardStep === totalSteps;
                                const isProcessing = activating || resetting || grantingFree;

                                if (isFinal) {
                                    const actionConfig = {
                                        activate: { label: 'הפעל מנוי', loading: 'מפעיל...', handler: handleActivate, color: 'bg-green-600 hover:bg-green-700' },
                                        free: { label: `האריך ${activateForm.free_months} חודשים חינם`, loading: 'מאריך...', handler: handleGrantFreeMonth, color: 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600' },
                                        trial: { label: 'החזר לתקופת ניסיון', loading: 'מחזיר...', handler: handleResetToTrial, color: 'bg-blue-600 hover:bg-blue-700' },
                                    };
                                    const cfg = actionConfig[wizardAction];
                                    return (
                                        <button
                                            onClick={cfg.handler}
                                            disabled={isProcessing}
                                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-white rounded-xl font-black text-sm transition-all disabled:opacity-50 order-1 sm:order-2 ${cfg.color}`}
                                        >
                                            <FaCheckCircle size={14} />
                                            {isProcessing ? cfg.loading : cfg.label}
                                        </button>
                                    );
                                }

                                return (
                                    <button
                                        onClick={() => setWizardStep(s => s + 1)}
                                        className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 bg-brand-primary text-white rounded-xl font-black text-sm hover:bg-brand-primary/90 transition-all order-1 sm:order-2"
                                    >
                                        המשך
                                        <FaArrowLeft size={11} />
                                    </button>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}
        </SuperAdminLayout>
    );
}

function DailyReportsSummaryTab() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [from, setFrom] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return d.toISOString().split('T')[0];
    });
    const [to, setTo] = useState(() => new Date().toISOString().split('T')[0]);

    const fetchSummary = async () => {
        setLoading(true);
        try {
            const res = await reportService.getSuperAdminSummary({ from, to });
            setData(res.data);
        } catch (err) {
            toast.error('שגיאה בטעינת דוחות יומיים');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchSummary(); }, [from, to]);

    if (loading) return <div className="text-center py-16 text-gray-400">טוען דוחות יומיים...</div>;
    if (!data) return <div className="text-center py-16 text-gray-400">אין נתונים</div>;

    const chartData = (data.daily_breakdown || []).map(d => ({
        date: d.date?.substring(5) || '',
        הזמנות: d.orders || 0,
        הכנסות: d.revenue || 0,
        מסעדות: d.restaurants || 0,
    }));

    return (
        <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-wrap items-center gap-4">
                <FaCalendarAlt className="text-brand-primary" />
                <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm" />
                <span className="text-gray-400">עד</span>
                <input type="date" value={to} onChange={e => setTo(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm" />
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                    <p className="text-xs font-bold text-gray-500 mb-1">מסעדות פעילות</p>
                    <h3 className="text-2xl font-black text-gray-900">{data.total_restaurants}</h3>
                </div>
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                    <p className="text-xs font-bold text-gray-500 mb-1">סה״כ הזמנות</p>
                    <h3 className="text-2xl font-black text-blue-600">{data.total_orders?.toLocaleString()}</h3>
                </div>
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                    <p className="text-xs font-bold text-gray-500 mb-1">סה״כ הכנסות</p>
                    <h3 className="text-2xl font-black text-emerald-600">₪{data.total_revenue?.toLocaleString()}</h3>
                </div>
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                    <p className="text-xs font-bold text-gray-500 mb-1">ממוצע להזמנה</p>
                    <h3 className="text-2xl font-black text-orange-600">₪{data.avg_order_value}</h3>
                </div>
            </div>

            {/* Daily Chart */}
            {chartData.length > 0 && (
                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
                        <FaChartBar className="text-blue-500" /> הכנסות יומיות מערכתיות
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip formatter={(value, name) => [name === 'הכנסות' ? `₪${value.toLocaleString()}` : value, name]} />
                            <Bar dataKey="הכנסות" fill="#f97316" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="הזמנות" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Restaurant breakdown */}
            {data.restaurant_breakdown?.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-gray-100">
                        <h3 className="text-lg font-black text-gray-900">סיכום לפי מסעדה</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="text-right p-3 font-bold text-gray-500">מסעדה</th>
                                    <th className="text-right p-3 font-bold text-gray-500">הזמנות</th>
                                    <th className="text-right p-3 font-bold text-gray-500">הכנסות</th>
                                    <th className="text-right p-3 font-bold text-gray-500">ימים</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {data.restaurant_breakdown.map((r, i) => (
                                    <tr key={i} className="hover:bg-gray-50">
                                        <td className="p-3 font-bold">{r.name}</td>
                                        <td className="p-3">{r.orders?.toLocaleString()}</td>
                                        <td className="p-3 font-bold text-emerald-600">₪{r.revenue?.toLocaleString()}</td>
                                        <td className="p-3 text-gray-500">{r.days}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
