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
    FaChevronLeft
} from 'react-icons/fa';

export default function SuperAdminReports() {
    const { getAuthHeaders } = useAdminAuth();
    const [summary, setSummary] = useState(null);
    const [restaurants, setRestaurants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const headers = getAuthHeaders();
            const [summaryRes, restaurantsRes] = await Promise.all([
                api.get('/super-admin/billing/summary', { headers }),
                api.get('/super-admin/billing/restaurants', { headers, params: searchTerm ? { search: searchTerm } : {} })
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
        const paidYtd = filteredRestaurants.reduce((sum, r) => sum + Number(r.total_paid_ytd || 0), 0);
        return { monthly, outstanding, paidYtd };
    }, [filteredRestaurants]);

    const formatDate = (value) => {
        if (!value) return '—';
        const d = new Date(value);
        return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('he-IL');
    };

    const StatCard = ({ title, value, subtitle, accent = 'blue', icon }) => {
        const colorClasses = {
            orange: 'text-orange-600 bg-orange-50/50 border-orange-100',
            green: 'text-green-600 bg-green-50/50 border-green-100',
            purple: 'text-purple-600 bg-purple-50/50 border-purple-100',
            blue: 'text-blue-600 bg-blue-50/50 border-blue-100',
            brand: 'text-brand-primary bg-brand-primary/5 border-brand-primary/10',
        };
        const iconClasses = {
            orange: 'bg-orange-100 text-orange-500',
            green: 'bg-green-100 text-green-500',
            purple: 'bg-purple-100 text-purple-500',
            blue: 'bg-blue-100 text-blue-500',
            brand: 'bg-brand-primary/10 text-brand-primary',
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
                        <p className="text-sm text-gray-500 mt-1">מעקב תשלומים, הכנסות וחובות מסעדות</p>
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        <StatCard
                            title="חיוב חודשי צפוי"
                            value={`₪${Number(summary.monthly_expected || 0).toLocaleString()}`}
                            subtitle="כל המסעדות הפעילות"
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
                            value={summary.total_restaurants}
                            subtitle="סה״כ רשומות"
                            accent="purple"
                            icon={<FaStore size={18} />}
                        />
                    </div>
                )}

                <div className="mb-6 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
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
                    <div className="flex items-center gap-4 text-xs font-bold text-gray-400 bg-gray-50 px-4 py-2.5 rounded-xl border border-gray-100 overflow-x-auto whitespace-nowrap">
                        <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-blue-400" /> חודשי: <span className="text-gray-900 font-black">₪{totals.monthly.toLocaleString()}</span></span>
                        <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-orange-400" /> חוב: <span className="text-gray-900 font-black">₪{totals.outstanding.toLocaleString()}</span></span>
                        <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-green-400" /> השנה: <span className="text-gray-900 font-black">₪{totals.paidYtd.toLocaleString()}</span></span>
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
                                        <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">מסעדה</th>
                                        <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest hidden md:table-cell">TENANT</th>
                                        <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-left">חיוב חודשי</th>
                                        <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-left">חוב פתוח</th>
                                        <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-center hidden lg:table-cell">תשלום אחרון</th>
                                        <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-center hidden xl:table-cell">שולם YTD</th>
                                        <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-center">סטטוס</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {filteredRestaurants.map((r) => (
                                        <tr key={r.id} className="hover:bg-gray-50/50 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-brand-primary/10 group-hover:text-brand-primary transition-colors">
                                                        <FaStore size={14} />
                                                    </div>
                                                    <span className="text-sm font-black text-gray-900">{r.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 hidden md:table-cell">
                                                <span className="text-xs font-bold text-gray-400 font-mono">@{r.tenant_id}</span>
                                            </td>
                                            <td className="px-6 py-4 text-left">
                                                <span className="text-sm font-black text-gray-900 border-b-2 border-transparent group-hover:border-brand-primary/20 transition-all">
                                                    ₪{Number(r.monthly_fee || 0).toLocaleString()}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-left">
                                                <span className={`text-sm font-black ${Number(r.outstanding_amount || 0) > 0 ? 'text-orange-600 bg-orange-50 px-2 py-1 rounded-lg' : 'text-gray-400'}`}>
                                                    ₪{Number(r.outstanding_amount || 0).toLocaleString()}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center hidden lg:table-cell">
                                                <div className="flex flex-col items-center">
                                                    <span className="text-xs font-bold text-gray-700">{formatDate(r.last_paid_at)}</span>
                                                    <span className="text-[10px] font-black text-gray-400 uppercase mt-0.5 flex items-center gap-1">
                                                        <FaClock size={8} /> חיוב הבא: {formatDate(r.next_charge_at)}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center hidden xl:table-cell">
                                                <span className="text-sm font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-100">
                                                    ₪{Number(r.total_paid_ytd || 0).toLocaleString()}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex justify-center">
                                                    {r.billing_status === 'active' ? (
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase bg-green-100 text-green-700 border border-green-200">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                                            פעילה
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase bg-orange-100 text-orange-700 border border-orange-200">
                                                            מושהית
                                                        </span>
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
        </SuperAdminLayout>
    );
}

// StatCard helper removed as it's now internal to main component for cleaner code or I can keep it outside.
// I'll leave the code balanced.

