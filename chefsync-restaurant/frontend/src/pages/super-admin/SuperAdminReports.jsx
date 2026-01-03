import { useEffect, useMemo, useState } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import SuperAdminLayout from '../../layouts/SuperAdminLayout';
import api from '../../services/apiClient';
import { toast } from 'react-hot-toast';

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

    return (
        <SuperAdminLayout>
            <div className="max-w-7xl mx-auto">
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <h1 className="text-4xl font-bold text-gray-900 mb-2">📈 דוחות מערכת</h1>
                        <p className="text-gray-600">הכנסות ופירוט הזמנות לפי מסעדה</p>
                    </div>
                    <button
                        onClick={fetchData}
                        className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90"
                    >
                        רענון
                    </button>
                </div>

                {summary && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        <StatCard title="חיוב חודשי צפוי" value={`₪${Number(summary.monthly_expected || 0).toFixed(0)}`} subtitle="כל המסעדות הפעילות" accent="orange" />
                        <StatCard title="שולם החודש" value={`₪${Number(summary.paid_this_month || 0).toFixed(0)}`} subtitle="תשלומים שנקלטו" accent="green" />
                        <StatCard title="חוב פתוח" value={`₪${Number(summary.outstanding || 0).toFixed(0)}`} subtitle="סך הכל" accent="purple" />
                        <StatCard title="מסעדות" value={summary.total_restaurants} subtitle="כולל מושבתות" accent="blue" />
                    </div>
                )}

                <div className="mb-4 flex items-center gap-3">
                    <input
                        type="text"
                        placeholder="חיפוש מסעדה או Tenant..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-primary w-72"
                    />
                    <div className="text-sm text-gray-600">
                        סך חיוב חודשי במסננת: <span className="font-semibold">₪{totals.monthly.toFixed(0)}</span> ·
                        חוב פתוח: <span className="font-semibold">₪{totals.outstanding.toFixed(0)}</span> ·
                        שולם השנה: <span className="font-semibold">₪{totals.paidYtd.toFixed(0)}</span>
                    </div>
                </div>

                {loading ? (
                    <div className="bg-white rounded-2xl border p-6 text-center text-gray-500">טוען...</div>
                ) : filteredRestaurants.length === 0 ? (
                    <div className="bg-gray-50 rounded-2xl p-8 text-center text-gray-500">לא נמצאו מסעדות לתצוגה</div>
                ) : (
                    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="bg-gray-50 text-gray-600">
                                    <tr>
                                        <th className="px-4 py-3 text-right">מסעדה</th>
                                        <th className="px-4 py-3 text-right">Tenant</th>
                                        <th className="px-4 py-3 text-right">חיוב חודשי</th>
                                        <th className="px-4 py-3 text-right">חוב פתוח</th>
                                        <th className="px-4 py-3 text-right">תשלום אחרון</th>
                                        <th className="px-4 py-3 text-right">חיוב הבא</th>
                                        <th className="px-4 py-3 text-right">שולם YTD</th>
                                        <th className="px-4 py-3 text-right">סטטוס</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredRestaurants.map((r) => {
                                        return (
                                            <tr key={r.id} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 font-semibold text-gray-900">{r.name}</td>
                                                <td className="px-4 py-3 text-gray-600">{r.tenant_id}</td>
                                                <td className="px-4 py-3 text-gray-800">₪{Number(r.monthly_fee || 0).toFixed(0)}</td>
                                                <td className="px-4 py-3 text-gray-800">₪{Number(r.outstanding_amount || 0).toFixed(0)}</td>
                                                <td className="px-4 py-3 text-gray-800">{formatDate(r.last_paid_at)}</td>
                                                <td className="px-4 py-3 text-gray-800">{formatDate(r.next_charge_at)}</td>
                                                <td className="px-4 py-3 text-gray-800">₪{Number(r.total_paid_ytd || 0).toFixed(0)}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${r.billing_status === 'active' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                                        {r.billing_status === 'active' ? 'פעילה' : 'מושהית'}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </SuperAdminLayout>
    );
}

function StatCard({ title, value, subtitle, accent = 'brand' }) {
    const accentClasses = {
        orange: 'bg-orange-100 text-orange-700',
        green: 'bg-green-100 text-green-700',
        purple: 'bg-purple-100 text-purple-700',
        blue: 'bg-blue-100 text-blue-700',
        brand: 'bg-brand-primary/10 text-brand-primary',
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
            <p className="text-sm text-gray-500 mb-1">{title}</p>
            <h3 className="text-3xl font-bold text-gray-900">{value}</h3>
            <span className={`inline-flex mt-3 px-3 py-1 rounded-full text-xs font-medium ${accentClasses[accent]}`}>
                {subtitle}
            </span>
        </div>
    );
}
