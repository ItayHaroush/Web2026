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
    FaBell,
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
    FaTag,
    FaEnvelope,
    FaWhatsapp,
    FaFileArchive,
    FaFilePdf,
    FaLink
} from 'react-icons/fa';
import { TIER_LABELS } from '../../utils/tierUtils';
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
    const [packageModal, setPackageModal] = useState(null);
    const [activating, setActivating] = useState(false);
    const [addingPackage, setAddingPackage] = useState(false);
    const [resetting, setResetting] = useState(false);
    const [grantingFree, setGrantingFree] = useState(false);
    const [activateForm, setActivateForm] = useState({ tier: 'basic', plan_type: 'monthly', note: '', record_payment: false, payment_reference: '', trial_days: 60, free_months: 1, free_note: '', custom_price_enabled: false, custom_monthly_price: '', custom_yearly_price: '', abandoned_cart_package_size: '', abandoned_cart_package_amount: '', abandoned_cart_package_custom: false, setup_fee: '' });
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

            const billingPayload = summaryRes.data?.data ?? summaryRes.data;
            setSummary(billingPayload ?? null);
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
            if (payload.abandoned_cart_package_size) {
                payload.abandoned_cart_package_size = parseInt(payload.abandoned_cart_package_size, 10);
                payload.abandoned_cart_package_amount = payload.abandoned_cart_package_amount ? parseFloat(payload.abandoned_cart_package_amount) : ({ 50: 50, 100: 90, 500: 400 }[payload.abandoned_cart_package_size] ?? 0);
            } else {
                delete payload.abandoned_cart_package_size;
                delete payload.abandoned_cart_package_amount;
            }
            if (payload.setup_fee !== '' && payload.setup_fee != null) payload.setup_fee = parseFloat(payload.setup_fee);
            else delete payload.setup_fee;
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

    const handleAddPackage = async (pkgSize, amount) => {
        if (!packageModal) return;
        setAddingPackage(true);
        try {
            const headers = getAuthHeaders();
            await api.post(
                `/super-admin/billing/restaurants/${packageModal.id}/abandoned-cart-package`,
                { package_size: pkgSize, amount, reference: `חבילת ${pkgSize} הודעות`, method: 'manual' },
                { headers }
            );
            toast.success(`נוספו ${pkgSize} הודעות למסעדה ${packageModal.name}`);
            setPackageModal(null);
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'שגיאה בהוספת חבילה');
        } finally {
            setAddingPackage(false);
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

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
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

                        {/* תזכורות סל נטוש */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                            <StatCard
                                title="חבילות תזכורות נמכרו"
                                value={summary.abandoned_cart_packages_sold ?? 0}
                                subtitle="החודש"
                                accent="blue"
                                icon={<FaGift size={18} />}
                            />
                            <StatCard
                                title="הכנסות תזכורות"
                                value={`₪${Number(summary.abandoned_cart_revenue_month || 0).toLocaleString()}`}
                                subtitle="החודש"
                                accent="green"
                                icon={<FaCoins size={18} />}
                            />
                            <StatCard
                                title="מסעדות עם תזכורות"
                                value={summary.restaurants_with_reminders ?? 0}
                                subtitle="מפעילות תזכורות"
                                accent="purple"
                                icon={<FaStore size={18} />}
                            />
                            <StatCard
                                title="הודעות תזכורת נשלחו"
                                value={summary.abandoned_cart_sessions_month ?? 0}
                                subtitle="החודש"
                                accent="orange"
                                icon={<FaBell size={18} />}
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
                                    <option value="enterprise">מסעדה מלאה</option>
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
                                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black ${r.tier === 'enterprise' ? 'bg-purple-100 text-purple-700' : r.tier === 'pro' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                                                                <FaCrown size={8} />
                                                                {TIER_LABELS[r.tier] || r.tier}
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
                                                        <div className="flex justify-center gap-1 flex-wrap">
                                                            <button
                                                                onClick={() => setPackageModal(r)}
                                                                className="px-3 py-1.5 bg-amber-50 text-amber-600 border border-amber-200 rounded-lg text-[10px] font-black hover:bg-amber-600 hover:text-white transition-all"
                                                                title="הוסף חבילת תזכורות"
                                                            >
                                                                <FaBell size={10} />
                                                            </button>
                                                            {r.billing_status !== 'active' && (
                                                                <button
                                                                    onClick={() => {
                                                                        setActivateModal(r);
                                                                        const hasCustom = r.monthly_price && r.monthly_price != 600;
                                                                        setActivateForm({ tier: r.tier || 'basic', plan_type: r.subscription_plan || 'monthly', note: '', record_payment: false, payment_reference: '', trial_days: 14, free_months: 1, free_note: '', custom_price_enabled: !!hasCustom, custom_monthly_price: hasCustom ? r.monthly_price : '', custom_yearly_price: r.yearly_price && r.yearly_price != 5000 ? r.yearly_price : '', abandoned_cart_package_size: '', abandoned_cart_package_amount: '', abandoned_cart_package_custom: false, setup_fee: '' });
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
                                                                    setActivateForm({ tier: r.tier || 'basic', plan_type: r.subscription_plan || 'monthly', note: '', record_payment: false, payment_reference: '', trial_days: 14, free_months: 1, free_note: '', custom_price_enabled: false, custom_monthly_price: '', custom_yearly_price: '', abandoned_cart_package_size: '', abandoned_cart_package_amount: '', abandoned_cart_package_custom: false, setup_fee: '' });
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
                                        <div className="grid grid-cols-3 gap-3">
                                            {[{ value: 'basic', label: 'Basic', desc: 'תכונות בסיסיות' }, { value: 'pro', label: 'Pro', desc: 'ניהול חכם' }, { value: 'enterprise', label: 'מסעדה מלאה', desc: 'מסעדה מלאה' }].map(t => (
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

                                    {/* חבילת תזכורות */}
                                    <div>
                                        <label className="text-xs font-black text-gray-500 mb-2 block">חבילת תזכורות סל נטוש</label>
                                        <div className="flex flex-wrap gap-2">
                                            {[
                                                { value: '', label: 'ללא', amount: 0 },
                                                { value: 50, label: '50 הודעות', amount: 50 },
                                                { value: 100, label: '100 הודעות', amount: 90 },
                                                { value: 500, label: '500 הודעות', amount: 400 },
                                            ].map(p => (
                                                <button
                                                    key={p.value || 'none'}
                                                    onClick={() => setActivateForm(f => ({ ...f, abandoned_cart_package_size: p.value, abandoned_cart_package_amount: p.value ? p.amount : '', abandoned_cart_package_custom: false }))}
                                                    className={`px-3 py-2 rounded-xl border-2 text-xs font-bold transition-all
                                                        ${(activateForm.abandoned_cart_package_size || '') === (p.value || '') ? 'border-green-500 bg-green-50 text-green-700 ring-2 ring-green-200' : 'border-gray-100 text-gray-600 hover:border-gray-200'}`}
                                                >
                                                    {p.label}{p.amount ? ` (₪${p.amount})` : ''}
                                                </button>
                                            ))}
                                        </div>
                                        {activateForm.abandoned_cart_package_size && (
                                            <label className="flex items-center gap-3 cursor-pointer mt-2 p-2 rounded-xl bg-green-50/50 border border-green-100">
                                                <input
                                                    type="checkbox"
                                                    checked={activateForm.abandoned_cart_package_custom ?? false}
                                                    onChange={(e) => {
                                                        const def = { 50: 50, 100: 90, 500: 400 }[parseInt(activateForm.abandoned_cart_package_size)];
                                                        setActivateForm(f => ({
                                                            ...f,
                                                            abandoned_cart_package_custom: e.target.checked,
                                                            abandoned_cart_package_amount: e.target.checked ? (f.abandoned_cart_package_amount || def) : def
                                                        }));
                                                    }}
                                                    className="w-4 h-4 rounded accent-green-600"
                                                />
                                                <span className="text-xs font-bold text-green-800">מחיר מותאם (מבצע) — לחשבונית לפי מחיר בפועל</span>
                                                {activateForm.abandoned_cart_package_custom && (
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="1"
                                                        value={activateForm.abandoned_cart_package_amount ?? ''}
                                                        onChange={(e) => setActivateForm(f => ({ ...f, abandoned_cart_package_amount: e.target.value }))}
                                                        placeholder="מחיר בפועל"
                                                        className="w-20 px-2 py-1 border border-green-200 rounded-lg text-sm font-bold"
                                                        dir="ltr"
                                                    />
                                                )}
                                            </label>
                                        )}
                                    </div>

                                    {/* דמי הקמת מסוף */}
                                    <div>
                                        <label className="text-xs font-black text-gray-500 mb-1 block">דמי הקמת מסוף (₪) — אופציונלי</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="1"
                                            value={activateForm.setup_fee ?? ''}
                                            onChange={(e) => setActivateForm(f => ({ ...f, setup_fee: e.target.value }))}
                                            placeholder="0"
                                            className="w-full max-w-[120px] px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-primary/20 outline-none"
                                            dir="ltr"
                                        />
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
                                        <div className="grid grid-cols-3 gap-3">
                                            {[{ value: 'basic', label: 'Basic' }, { value: 'pro', label: 'Pro' }, { value: 'enterprise', label: 'מסעדה מלאה' }].map(t => (
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
                                                    <span className="font-black text-gray-800">{TIER_LABELS[activateForm.tier] || activateForm.tier} — {activateForm.plan_type === 'yearly' ? 'שנתי' : 'חודשי'}</span>
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
                                                    <>
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-amber-600 font-bold">רישום תשלום</span>
                                                            <span className="font-bold text-amber-700">כן{activateForm.payment_reference ? ` (${activateForm.payment_reference})` : ''}</span>
                                                        </div>
                                                        {(() => {
                                                            const pricing = summary?.data?.pricing || { basic: { monthly: 450, yearly: 4500 }, pro: { monthly: 600, yearly: 5000 } };
                                                            const tier = activateForm.tier || 'basic';
                                                            const planType = activateForm.plan_type || 'monthly';
                                                            const baseCharge = activateForm.custom_price_enabled
                                                                ? (planType === 'yearly' ? parseFloat(activateForm.custom_yearly_price) || 0 : parseFloat(activateForm.custom_monthly_price) || 0)
                                                                : (pricing[tier]?.[planType] ?? 0);
                                                            const packageAmount = activateForm.abandoned_cart_package_size
                                                                ? (parseFloat(activateForm.abandoned_cart_package_amount) || { 50: 50, 100: 90, 500: 400 }[parseInt(activateForm.abandoned_cart_package_size)]) || 0
                                                                : 0;
                                                            const setupFee = parseFloat(activateForm.setup_fee) || 0;
                                                            const outstanding = parseFloat(activateModal?.outstanding_amount) || 0;
                                                            const total = baseCharge + packageAmount + setupFee + outstanding;
                                                            const breaks = [`₪${baseCharge} מנוי`];
                                                            if (setupFee) breaks.push(`₪${setupFee} דמי הקמה`);
                                                            if (packageAmount) breaks.push(`₪${packageAmount} חבילה`);
                                                            if (outstanding) breaks.push(`₪${outstanding} חוב`);
                                                            return (
                                                                <div className="mt-2 pt-2 border-t border-amber-200 bg-amber-50/50 -mx-2 px-3 py-2 rounded-lg">
                                                                    <p className="text-xs font-black text-amber-800">סכום לחיוב בפועל: ₪{total.toLocaleString()}</p>
                                                                    {breaks.length > 1 && <p className="text-[10px] text-amber-700 mt-0.5">{breaks.join(' + ')}</p>}
                                                                </div>
                                                            );
                                                        })()}
                                                    </>
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
                                                    <span className="font-black text-gray-800">{TIER_LABELS[activateForm.tier] || activateForm.tier}</span>
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

            {/* Package Modal */}
            {packageModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm" onClick={() => setPackageModal(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="px-5 py-4 border-b border-gray-100">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-black text-gray-900">הוספת חבילת תזכורות</h3>
                                <button onClick={() => setPackageModal(null)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400">
                                    <FaTimes size={16} />
                                </button>
                            </div>
                            <p className="text-sm text-gray-500 mt-1">{packageModal.name}</p>
                        </div>
                        <div className="p-5 space-y-4">
                            <p className="text-sm font-bold text-gray-700">בחר חבילה:</p>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { size: 50, price: 50 },
                                    { size: 100, price: 90 },
                                    { size: 500, price: 400 },
                                ].map(({ size, price }) => (
                                    <button
                                        key={size}
                                        onClick={() => handleAddPackage(size, price)}
                                        disabled={addingPackage}
                                        className="p-4 rounded-xl border-2 border-gray-100 hover:border-amber-300 hover:bg-amber-50/50 transition-all disabled:opacity-50"
                                    >
                                        <p className="text-lg font-black text-gray-900">{size}</p>
                                        <p className="text-xs text-gray-500">הודעות</p>
                                        <p className="text-sm font-bold text-amber-600 mt-1">₪{price}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </SuperAdminLayout>
    );
}

function DailyReportsSummaryTab() {
    const { getAuthHeaders } = useAdminAuth();
    const [summaryLoading, setSummaryLoading] = useState(true);
    const [data, setData] = useState(null);
    const [loadError, setLoadError] = useState(false);
    const [restaurantList, setRestaurantList] = useState([]);
    const [selectedRestaurantIds, setSelectedRestaurantIds] = useState([]);
    const [backfillLoading, setBackfillLoading] = useState(false);
    const [zipLoading, setZipLoading] = useState(false);
    const [mergedPdfLoading, setMergedPdfLoading] = useState(false);
    const [emailLoading, setEmailLoading] = useState(false);
    const [waLoading, setWaLoading] = useState(false);
    const [waLinksModal, setWaLinksModal] = useState(null);
    const [qYear, setQYear] = useState(() => new Date().getFullYear());
    const [qQuarter, setQQuarter] = useState(() => Math.floor(new Date().getMonth() / 3) + 1);
    const [qRestaurantId, setQRestaurantId] = useState('');
    const [quarterlyPreview, setQuarterlyPreview] = useState(null);
    const [quarterlyLoading, setQuarterlyLoading] = useState(false);
    const [quarterlyPdfLoading, setQuarterlyPdfLoading] = useState(false);
    const [from, setFrom] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return d.toISOString().split('T')[0];
    });
    const [to, setTo] = useState(() => new Date().toISOString().split('T')[0]);

    const payloadBase = () => ({
        from,
        to,
        ...(selectedRestaurantIds.length > 0 ? { restaurant_ids: selectedRestaurantIds } : {}),
    });

    const fetchSummary = async () => {
        setSummaryLoading(true);
        setLoadError(false);
        try {
            const summary = await reportService.getSuperAdminSummary({ from, to });
            setData(summary || {});
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || 'שגיאה בטעינת דוחות יומיים');
            setLoadError(true);
            setData(null);
        } finally {
            setSummaryLoading(false);
        }
    };

    useEffect(() => { fetchSummary(); }, [from, to]);

    useEffect(() => {
        const loadRestaurants = async () => {
            try {
                const headers = getAuthHeaders();
                const res = await api.get('/super-admin/restaurants', { headers });
                const list = res.data.restaurants?.data || res.data.restaurants || [];
                setRestaurantList(Array.isArray(list) ? list : []);
            } catch {
                setRestaurantList([]);
            }
        };
        loadRestaurants();
    }, [getAuthHeaders]);

    useEffect(() => {
        if (!qRestaurantId && restaurantList.length > 0) {
            setQRestaurantId(String(restaurantList[0].id));
        }
    }, [restaurantList, qRestaurantId]);

    const toggleRestaurant = (id) => {
        setSelectedRestaurantIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };

    const selectAllRestaurants = () => {
        if (selectedRestaurantIds.length === restaurantList.length) {
            setSelectedRestaurantIds([]);
        } else {
            setSelectedRestaurantIds(restaurantList.map((r) => r.id));
        }
    };

    const handleBackfill = async () => {
        setBackfillLoading(true);
        try {
            const res = await reportService.superAdminBackfillMissing(payloadBase());
            const total = res?.total ?? 0;
            toast.success(`נוצרו/עודכנו ${total} דוחות חסרים`);
            fetchSummary();
        } catch (err) {
            toast.error(err.response?.data?.message || 'שגיאה במילוי דוחות');
        } finally {
            setBackfillLoading(false);
        }
    };

    const handleExportZip = async () => {
        setZipLoading(true);
        try {
            await reportService.superAdminExportZip(payloadBase());
            toast.success('הקובץ יורד');
        } catch (err) {
            toast.error(err.response?.data?.message || 'אין דוחות בטווח או שגיאת שרת');
        } finally {
            setZipLoading(false);
        }
    };

    const handleExportMergedPdf = async () => {
        setMergedPdfLoading(true);
        try {
            await reportService.superAdminExportMergedPdf(payloadBase());
            toast.success('הורדת PDF מאוחד');
        } catch (err) {
            toast.error(err.response?.data?.message || err.message || 'אין דוחות בטווח או שגיאת שרת');
        } finally {
            setMergedPdfLoading(false);
        }
    };

    const handleSendEmails = async (bundle = 'zip') => {
        setEmailLoading(true);
        try {
            const res = await reportService.superAdminSendEmails({ ...payloadBase(), bundle });
            const sent = res?.sent ?? 0;
            const skipped = res?.skipped_no_email ?? 0;
            const extra = bundle === 'merged_pdf' ? ' (PDF מאוחד)' : ' (ZIP)';
            toast.success(`נשלחו ${sent} מיילים${extra}${skipped ? ` · דולגו ${skipped} ללא מייל` : ''}`);
        } catch (err) {
            toast.error(err.response?.data?.message || 'שגיאה בשליחת מיילים');
        } finally {
            setEmailLoading(false);
        }
    };

    const handleWhatsappLinks = async () => {
        setWaLoading(true);
        try {
            const res = await reportService.superAdminWhatsappLinks(payloadBase());
            const links = res?.links || [];
            if (links.length === 0) {
                toast.error('אין מספרי וואטסאפ זמינים לדוחות בטווח');
            } else {
                setWaLinksModal(links);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'שגיאה');
        } finally {
            setWaLoading(false);
        }
    };

    const handleQuarterlySummary = async () => {
        if (!qRestaurantId) {
            toast.error('בחר מסעדה');
            return;
        }
        setQuarterlyLoading(true);
        try {
            const data = await reportService.superAdminQuarterlySummary({
                restaurant_id: Number(qRestaurantId),
                year: qYear,
                quarter: qQuarter,
            });
            setQuarterlyPreview(data || null);
            toast.success('סיכום רבעון נטען');
        } catch (err) {
            setQuarterlyPreview(null);
            toast.error(err.response?.data?.message || err.message || 'שגיאה');
        } finally {
            setQuarterlyLoading(false);
        }
    };

    const handleQuarterlyPdf = async () => {
        if (!qRestaurantId) {
            toast.error('בחר מסעדה');
            return;
        }
        setQuarterlyPdfLoading(true);
        try {
            await reportService.superAdminQuarterlyPdfDownload({
                restaurant_id: Number(qRestaurantId),
                year: qYear,
                quarter: qQuarter,
            });
            toast.success('הורדת PDF');
        } catch (err) {
            toast.error(err.response?.data?.message || err.message || 'שגיאה');
        } finally {
            setQuarterlyPdfLoading(false);
        }
    };

    const yearOptions = useMemo(() => {
        const y = new Date().getFullYear();
        return Array.from({ length: 6 }, (_, i) => y - i);
    }, []);

    if (summaryLoading) return <div className="text-center py-16 text-gray-400">טוען דוחות יומיים...</div>;
    if (loadError && !data) return <div className="text-center py-16 text-rose-600 font-bold">לא ניתן לטעון סיכום. נסה שוב או בדוק התחברות.</div>;
    if (!data) return <div className="text-center py-16 text-gray-400">אין נתונים</div>;

    const chartData = (data.daily_breakdown || []).map(d => ({
        date: d.date?.substring(5) || '',
        הזמנות: d.orders || 0,
        הכנסות: d.revenue || 0,
        מסעדות: d.restaurants || 0,
    }));

    return (
        <div className="space-y-6">
            {/* תקופה + סינון מסעדות */}
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col gap-4">
                <h3 className="text-sm font-black text-gray-800 flex items-center gap-2">
                    <FaCalendarAlt className="text-brand-primary" />
                    תקופה לדוחות יומיים
                </h3>
                <p className="text-xs text-gray-500 -mt-1">כל הפעולות למטה (ZIP, מייל, וואטסאפ) מסתמכות על טווח התאריכים והמסעדות שנבחרו כאן.</p>
                <div className="flex flex-wrap items-center gap-4">
                    <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm" />
                    <span className="text-gray-400">עד</span>
                    <input type="date" value={to} onChange={e => setTo(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm" />
                </div>

                {restaurantList.length > 0 && (
                    <div className="border-t border-gray-100 pt-4">
                        <p className="text-sm font-bold text-gray-700 mb-2">סינון מסעדות (ריק = כל המסעדות)</p>
                        <button
                            type="button"
                            onClick={selectAllRestaurants}
                            className="text-sm font-bold text-brand-primary mb-2 hover:underline"
                        >
                            {selectedRestaurantIds.length === restaurantList.length ? 'נקה בחירה' : 'בחר הכל'}
                        </button>
                        <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto">
                            {restaurantList.map((r) => (
                                <label key={r.id} className="inline-flex items-center gap-1.5 text-sm bg-gray-50 px-2 py-1 rounded-lg cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={selectedRestaurantIds.includes(r.id)}
                                        onChange={() => toggleRestaurant(r.id)}
                                    />
                                    <span>{r.name}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* פעולות דוח יומי */}
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
                <h3 className="text-sm font-black text-gray-800 flex items-center gap-2">
                    <FaEnvelope className="text-blue-500" size={14} />
                    פעולות על דוחות יומיים
                </h3>
                <p className="text-xs text-gray-500 -mt-1">
                    הורדה: <strong className="text-gray-700">ZIP</strong> (קובץ PDF לכל יום) או <strong className="text-gray-700">PDF מאוחד</strong> (עמוד לכל יום בקובץ אחד). מייל: מייל אחד לכל מסעדה עם צרופה לפי הבחירה. וואטסאפ: קישור אחד לכל מסעדה — פלאפון בעלים במערכת או גיבוי.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                    <button
                        type="button"
                        disabled={backfillLoading}
                        onClick={handleBackfill}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-gray-900 text-white hover:bg-black disabled:opacity-50"
                    >
                        <FaSync size={12} className={backfillLoading ? 'animate-spin' : ''} />
                        {backfillLoading ? 'ממלא...' : 'מילוי דוחות חסרים'}
                    </button>
                    <button
                        type="button"
                        disabled={zipLoading}
                        onClick={handleExportZip}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                        <FaFileArchive size={12} />
                        {zipLoading ? '...' : 'הורדת ZIP'}
                    </button>
                    <button
                        type="button"
                        disabled={mergedPdfLoading}
                        onClick={handleExportMergedPdf}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-50"
                    >
                        <FaFilePdf size={12} />
                        {mergedPdfLoading ? '...' : 'הורדת PDF מאוחד'}
                    </button>
                    <button
                        type="button"
                        disabled={emailLoading}
                        onClick={() => handleSendEmails('zip')}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                        <FaEnvelope size={12} />
                        {emailLoading ? '...' : 'מייל — ZIP'}
                    </button>
                    <button
                        type="button"
                        disabled={emailLoading}
                        onClick={() => handleSendEmails('merged_pdf')}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                        <FaFilePdf size={12} />
                        {emailLoading ? '...' : 'מייל — PDF מאוחד'}
                    </button>
                    <button
                        type="button"
                        disabled={waLoading}
                        onClick={handleWhatsappLinks}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                    >
                        <FaWhatsapp size={14} />
                        {waLoading ? '...' : 'קישורי וואטסאפ'}
                    </button>
                </div>
            </div>

            {/* דוח רבעון */}
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
                <h3 className="text-sm font-black text-gray-800 flex items-center gap-2">
                    <FaChartBar className="text-violet-500" size={14} />
                    דוח רבעון — פעילות מסעדה
                </h3>
                <p className="text-xs text-gray-500 -mt-1">סיכום מצטבר מדוחות יומיים קיימים לרבעון בשנה (לא תלוי בטווח למעלה).</p>
                {restaurantList.length > 0 ? (
                    <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-end">
                        <div className="min-w-[200px]">
                            <label className="text-xs font-bold text-gray-500 block mb-1">מסעדה</label>
                            <select
                                value={qRestaurantId}
                                onChange={(e) => { setQRestaurantId(e.target.value); setQuarterlyPreview(null); }}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold"
                            >
                                {restaurantList.map((r) => (
                                    <option key={r.id} value={String(r.id)}>{r.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 block mb-1">שנה</label>
                            <select
                                value={qYear}
                                onChange={(e) => { setQYear(Number(e.target.value)); setQuarterlyPreview(null); }}
                                className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold"
                            >
                                {yearOptions.map((y) => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 block mb-1">רבעון</label>
                            <select
                                value={qQuarter}
                                onChange={(e) => { setQQuarter(Number(e.target.value)); setQuarterlyPreview(null); }}
                                className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold"
                            >
                                {[1, 2, 3, 4].map((q) => (
                                    <option key={q} value={q}>Q{q}</option>
                                ))}
                            </select>
                        </div>
                        <button
                            type="button"
                            disabled={quarterlyLoading}
                            onClick={handleQuarterlySummary}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
                        >
                            {quarterlyLoading ? '...' : 'הצג סיכום'}
                        </button>
                        <button
                            type="button"
                            disabled={quarterlyPdfLoading}
                            onClick={handleQuarterlyPdf}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border-2 border-violet-200 text-violet-700 hover:bg-violet-50 disabled:opacity-50"
                        >
                            <FaFilePdf size={14} />
                            {quarterlyPdfLoading ? '...' : 'הורד PDF'}
                        </button>
                    </div>
                ) : (
                    <p className="text-sm text-gray-400">טוען רשימת מסעדות…</p>
                )}
                {quarterlyPreview && (
                    <div className="mt-3 p-4 rounded-xl bg-violet-50/50 border border-violet-100 text-sm space-y-1">
                        <p className="font-black text-gray-800">{quarterlyPreview.restaurant_name} · {quarterlyPreview.from} — {quarterlyPreview.to}</p>
                        <p className="text-gray-700">ימים עם דוח: <strong>{quarterlyPreview.days_with_reports}</strong> · הזמנות: <strong>{(quarterlyPreview.total_orders ?? 0).toLocaleString()}</strong> · הכנסות: <strong>₪{(quarterlyPreview.total_revenue ?? 0).toLocaleString()}</strong></p>
                    </div>
                )}
            </div>

            {waLinksModal && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50" onClick={() => setWaLinksModal(null)}>
                    <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="font-black text-gray-900">קישורי וואטסאפ</h3>
                            <button type="button" className="p-2 hover:bg-gray-100 rounded-lg" onClick={() => setWaLinksModal(null)}>
                                <FaTimes />
                            </button>
                        </div>
                        <ul className="p-4 overflow-y-auto max-h-[60vh] space-y-2 text-sm">
                            {waLinksModal.map((row) => (
                                <li key={row.restaurant_id} className="flex flex-col gap-2 border border-gray-100 rounded-xl p-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <span className="font-bold text-gray-800">{row.restaurant_name}</span>
                                        <span className="text-xs text-gray-500">{row.reports_count} ימי דוח · {from} — {to}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <a
                                            href={row.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 font-bold text-green-600 hover:underline"
                                        >
                                            <FaLink size={12} /> פתח בוואטסאפ
                                        </a>
                                        {row.phone_e164_digits && (
                                            <span className="text-xs text-gray-400 font-mono" dir="ltr">wa.me/{row.phone_e164_digits}</span>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                    <p className="text-xs font-bold text-gray-500 mb-1">מסעדות פעילות</p>
                    <h3 className="text-2xl font-black text-gray-900">{data.total_restaurants ?? 0}</h3>
                </div>
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                    <p className="text-xs font-bold text-gray-500 mb-1">סה״כ הזמנות</p>
                    <h3 className="text-2xl font-black text-blue-600">{(data.total_orders ?? 0).toLocaleString()}</h3>
                </div>
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                    <p className="text-xs font-bold text-gray-500 mb-1">סה״כ הכנסות</p>
                    <h3 className="text-2xl font-black text-emerald-600">₪{(data.total_revenue ?? 0).toLocaleString()}</h3>
                </div>
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                    <p className="text-xs font-bold text-gray-500 mb-1">ממוצע להזמנה</p>
                    <h3 className="text-2xl font-black text-orange-600">₪{data.avg_order_value ?? 0}</h3>
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
