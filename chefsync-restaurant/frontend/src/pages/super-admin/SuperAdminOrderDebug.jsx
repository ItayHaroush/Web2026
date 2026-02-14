import { useState } from 'react';
import SuperAdminLayout from '../../layouts/SuperAdminLayout';
import { useAdminAuth } from '../../context/AdminAuthContext';
import api from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import {
    FaSearch,
    FaClipboardList,
    FaExclamationTriangle,
    FaCheck,
    FaChevronDown,
    FaChevronUp,
    FaSpinner,
    FaArrowLeft,
    FaArrowRight,
    FaBug,
    FaCircle,
    FaTimes,
    FaFilter
} from 'react-icons/fa';

const EVENT_COLORS = {
    order_created: 'bg-green-500',
    payment_pending: 'bg-yellow-500',
    payment_success: 'bg-green-500',
    payment_failed: 'bg-red-500',
    webhook_received: 'bg-purple-500',
    status_changed: 'bg-blue-500',
    gift_applied: 'bg-pink-500',
    promotion_applied: 'bg-indigo-500',
    order_cancelled: 'bg-red-600',
    manual_edit: 'bg-gray-500',
    retry_payment: 'bg-orange-500',
};

const EVENT_LABELS = {
    order_created: 'הזמנה נוצרה',
    payment_pending: 'ממתין לתשלום',
    payment_success: 'תשלום הצליח',
    payment_failed: 'תשלום נכשל',
    webhook_received: 'Webhook התקבל',
    status_changed: 'שינוי סטטוס',
    gift_applied: 'מתנה הוחלה',
    promotion_applied: 'מבצע הוחל',
    order_cancelled: 'הזמנה בוטלה',
    manual_edit: 'עריכה ידנית',
    retry_payment: 'ניסיון תשלום חוזר',
};

const SEVERITY_STYLES = {
    critical: 'bg-red-100 text-red-800 border-red-200',
    error: 'bg-orange-100 text-orange-800 border-orange-200',
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    info: 'bg-blue-100 text-blue-800 border-blue-200',
};

export default function SuperAdminOrderDebug() {
    const { getAuthHeaders } = useAdminAuth();
    const [activeTab, setActiveTab] = useState('events'); // events | errors

    // Search state
    const [searchFields, setSearchFields] = useState({
        order_id: '',
        phone: '',
        correlation_id: '',
        transaction_id: '',
    });
    const [searching, setSearching] = useState(false);
    const [searchResults, setSearchResults] = useState(null);
    const [orderFound, setOrderFound] = useState(null);

    // Timeline state
    const [timeline, setTimeline] = useState(null);
    const [timelineOrder, setTimelineOrder] = useState(null);
    const [loadingTimeline, setLoadingTimeline] = useState(false);
    const [expandedPayloads, setExpandedPayloads] = useState({});

    // System errors state
    const [errors, setErrors] = useState([]);
    const [loadingErrors, setLoadingErrors] = useState(false);
    const [severityFilter, setSeverityFilter] = useState('');

    const handleSearch = async () => {
        const params = {};
        Object.entries(searchFields).forEach(([key, val]) => {
            if (val.trim()) params[key] = val.trim();
        });

        if (Object.keys(params).length === 0) {
            toast.error('יש להזין לפחות שדה חיפוש אחד');
            return;
        }

        setSearching(true);
        setTimeline(null);
        setTimelineOrder(null);
        setOrderFound(null);
        try {
            const res = await api.get('/super-admin/order-events/search', {
                params,
                headers: getAuthHeaders(),
            });
            if (res.data?.success) {
                setSearchResults(res.data.data);
                if (res.data.order_found) {
                    setOrderFound(res.data.order_found);
                }
                if (res.data.message) {
                    toast(res.data.message, { icon: 'ℹ️' });
                }
            }
        } catch (e) {
            toast.error(e.response?.data?.message || 'שגיאה בחיפוש');
        } finally {
            setSearching(false);
        }
    };

    const loadTimeline = async (orderId) => {
        setLoadingTimeline(true);
        try {
            const res = await api.get(`/super-admin/order-events/${orderId}/timeline`, {
                headers: getAuthHeaders(),
            });
            if (res.data?.success) {
                setTimelineOrder(res.data.data.order);
                setTimeline(res.data.data.events);
                setExpandedPayloads({});
            }
        } catch (e) {
            toast.error(e.response?.data?.message || 'שגיאה בטעינת Timeline');
        } finally {
            setLoadingTimeline(false);
        }
    };

    const loadErrors = async () => {
        setLoadingErrors(true);
        try {
            const params = {};
            if (severityFilter) params.severity = severityFilter;
            const res = await api.get('/super-admin/system-errors', {
                params,
                headers: getAuthHeaders(),
            });
            if (res.data?.success) {
                setErrors(res.data.data?.data || []);
            }
        } catch (e) {
            toast.error(e.response?.data?.message || 'שגיאה בטעינת שגיאות');
        } finally {
            setLoadingErrors(false);
        }
    };

    const resolveError = async (id) => {
        try {
            const res = await api.post(`/super-admin/system-errors/${id}/resolve`, {}, {
                headers: getAuthHeaders(),
            });
            if (res.data?.success) {
                toast.success('השגיאה סומנה כפתורה');
                setErrors(prev => prev.map(e => e.id === id ? { ...e, resolved: true, resolved_at: new Date().toISOString() } : e));
            }
        } catch (e) {
            toast.error('שגיאה בעדכון');
        }
    };

    const togglePayload = (eventId) => {
        setExpandedPayloads(prev => ({ ...prev, [eventId]: !prev[eventId] }));
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleString('he-IL', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
        });
    };

    return (
        <SuperAdminLayout>
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                            <div className="p-2 bg-brand-primary/10 rounded-lg">
                                <FaClipboardList className="text-brand-primary" size={20} />
                            </div>
                            מערכת לוגים והזמנות (Order Debug)
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">חיפוש אירועים, Timeline הזמנות ושגיאות מערכת</p>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setActiveTab('events')}
                            className={`px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'events'
                                ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20'
                                : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'
                                }`}
                        >
                            <FaClipboardList className="inline ml-1" size={12} />
                            אירועי הזמנות
                        </button>
                        <button
                            onClick={() => { setActiveTab('errors'); loadErrors(); }}
                            className={`px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'errors'
                                ? 'bg-red-500 text-white shadow-lg shadow-red-500/20'
                                : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'
                                }`}
                        >
                            <FaBug className="inline ml-1" size={12} />
                            שגיאות מערכת
                        </button>
                    </div>
                </div>

                {activeTab === 'events' && (
                    <div className="space-y-6">
                        {/* Search Card */}
                        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                            <h2 className="text-lg font-black text-gray-900 mb-6 flex items-center gap-2">
                                <FaSearch className="text-brand-primary" size={16} />
                                חיפוש אירועים
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-black text-gray-500 uppercase tracking-wider">מזהה הזמנה</label>
                                    <input
                                        type="number"
                                        value={searchFields.order_id}
                                        onChange={e => setSearchFields(p => ({ ...p, order_id: e.target.value }))}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-sm font-bold"
                                        placeholder="לדוגמה: 1234"
                                        dir="ltr"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-black text-gray-500 uppercase tracking-wider">טלפון</label>
                                    <input
                                        type="text"
                                        value={searchFields.phone}
                                        onChange={e => setSearchFields(p => ({ ...p, phone: e.target.value }))}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-sm font-bold"
                                        placeholder="050-1234567"
                                        dir="ltr"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-black text-gray-500 uppercase tracking-wider">Correlation ID</label>
                                    <input
                                        type="text"
                                        value={searchFields.correlation_id}
                                        onChange={e => setSearchFields(p => ({ ...p, correlation_id: e.target.value }))}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-sm font-bold"
                                        placeholder="UUID..."
                                        dir="ltr"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-black text-gray-500 uppercase tracking-wider">Transaction ID</label>
                                    <input
                                        type="text"
                                        value={searchFields.transaction_id}
                                        onChange={e => setSearchFields(p => ({ ...p, transaction_id: e.target.value }))}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-sm font-bold"
                                        placeholder="TXN-..."
                                        dir="ltr"
                                    />
                                </div>
                            </div>
                            <div className="mt-4 flex justify-end">
                                <button
                                    onClick={handleSearch}
                                    disabled={searching}
                                    className="px-6 py-3 bg-brand-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-brand-primary/95 transition-all shadow-lg shadow-brand-primary/20 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {searching ? <FaSpinner className="animate-spin" size={14} /> : <FaSearch size={14} />}
                                    {searching ? 'מחפש...' : 'חיפוש'}
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Search Results */}
                            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                                <h2 className="text-lg font-black text-gray-900 mb-4">תוצאות חיפוש</h2>
                                {!searchResults ? (
                                    <div className="py-12 text-center">
                                        <FaSearch className="mx-auto mb-3 text-gray-200" size={32} />
                                        <p className="text-xs font-bold text-gray-400 uppercase">הזן פרטי חיפוש למעלה</p>
                                    </div>
                                ) : (searchResults.data || []).length === 0 ? (
                                    <div className="py-8 text-center">
                                        {orderFound ? (
                                            <div className="text-right">
                                                <p className="text-xs font-bold text-gray-500 mb-3 text-center">ההזמנה נמצאה, אין אירועים מתועדים</p>
                                                <button
                                                    onClick={() => loadTimeline(orderFound.id)}
                                                    className="w-full p-4 rounded-2xl border border-blue-100 bg-blue-50/50 hover:bg-blue-50 transition-all text-right"
                                                >
                                                    <p className="text-sm font-black text-gray-900">הזמנה #{orderFound.id}</p>
                                                    <p className="text-xs text-gray-600 mt-1">{orderFound.customer_name} • {orderFound.customer_phone}</p>
                                                    <div className="flex items-center gap-3 mt-2">
                                                        <span className="text-[10px] font-bold text-gray-500 bg-white px-2 py-0.5 rounded-md border border-gray-100">{orderFound.status}</span>
                                                        <span className="text-[10px] font-bold text-gray-500">₪{Number(orderFound.total_amount || 0).toLocaleString()}</span>
                                                    </div>
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <FaTimes className="mx-auto mb-3 text-gray-200" size={32} />
                                                <p className="text-xs font-bold text-gray-400 uppercase">לא נמצאו תוצאות</p>
                                            </>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar">
                                        {(searchResults.data || []).map(event => (
                                            <button
                                                key={event.id}
                                                onClick={() => loadTimeline(event.order_id)}
                                                className="w-full text-right p-3 rounded-2xl border border-gray-100 hover:bg-gray-50 transition-all"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-3 h-3 rounded-full ${EVENT_COLORS[event.event_type] || 'bg-gray-400'}`} />
                                                    <div className="flex-1">
                                                        <p className="text-sm font-black text-gray-900">
                                                            #{event.order_id} - {EVENT_LABELS[event.event_type] || event.event_type}
                                                        </p>
                                                        <p className="text-[10px] text-gray-400 font-mono mt-0.5" dir="ltr">
                                                            {formatDate(event.created_at)} | {event.actor_type}
                                                        </p>
                                                    </div>
                                                    <FaArrowLeft size={10} className="text-gray-300" />
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Timeline */}
                            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                                <h2 className="text-lg font-black text-gray-900 mb-4">Timeline</h2>

                                {loadingTimeline ? (
                                    <div className="py-12 text-center">
                                        <FaSpinner className="animate-spin mx-auto mb-3 text-brand-primary" size={24} />
                                        <p className="text-xs font-bold text-gray-400 uppercase">טוען Timeline...</p>
                                    </div>
                                ) : !timeline ? (
                                    <div className="py-12 text-center">
                                        <FaClipboardList className="mx-auto mb-3 text-gray-200" size={32} />
                                        <p className="text-xs font-bold text-gray-400 uppercase">בחר הזמנה לצפייה ב-Timeline</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Order Info Card */}
                                        {timelineOrder && (
                                            <div className="mb-6 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                                <div className="grid grid-cols-2 gap-3 text-xs">
                                                    <div>
                                                        <span className="font-bold text-gray-400">הזמנה:</span>
                                                        <span className="font-black text-gray-900 mr-1">#{timelineOrder.id}</span>
                                                    </div>
                                                    <div>
                                                        <span className="font-bold text-gray-400">לקוח:</span>
                                                        <span className="font-black text-gray-900 mr-1">{timelineOrder.customer_name}</span>
                                                    </div>
                                                    <div>
                                                        <span className="font-bold text-gray-400">סטטוס:</span>
                                                        <span className="font-black text-gray-900 mr-1">{timelineOrder.status}</span>
                                                    </div>
                                                    <div>
                                                        <span className="font-bold text-gray-400">סכום:</span>
                                                        <span className="font-black text-gray-900 mr-1">₪{timelineOrder.total_amount}</span>
                                                    </div>
                                                    <div className="col-span-2" dir="ltr">
                                                        <span className="font-bold text-gray-400">Correlation:</span>
                                                        <span className="font-mono text-[10px] text-gray-600 mr-1">{timelineOrder.correlation_id || 'N/A'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Timeline Events */}
                                        <div className="relative pr-6 max-h-[400px] overflow-y-auto custom-scrollbar">
                                            {/* Vertical line */}
                                            <div className="absolute right-2 top-0 bottom-0 w-0.5 bg-gray-200" />

                                            {timeline.map((event, idx) => (
                                                <div key={event.id} className="relative mb-6 last:mb-0">
                                                    {/* Dot */}
                                                    <div className={`absolute -right-[13px] top-1 w-4 h-4 rounded-full border-2 border-white shadow-sm ${EVENT_COLORS[event.event_type] || 'bg-gray-400'}`} />

                                                    <div className="mr-4">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${EVENT_COLORS[event.event_type] || 'bg-gray-400'} text-white`}>
                                                                {EVENT_LABELS[event.event_type] || event.event_type}
                                                            </span>
                                                            <span className="text-[10px] text-gray-400 font-mono" dir="ltr">
                                                                {formatDate(event.created_at)}
                                                            </span>
                                                        </div>

                                                        <p className="text-[11px] text-gray-500 font-bold">
                                                            <span className="text-gray-400">Actor:</span> {event.actor_type}
                                                            {event.actor_id && ` #${event.actor_id}`}
                                                        </p>

                                                        {/* Status Change Arrow */}
                                                        {event.old_status && event.new_status && (
                                                            <div className="flex items-center gap-2 mt-1 text-xs">
                                                                <span className="px-2 py-0.5 bg-gray-100 rounded-md font-bold text-gray-600">{event.old_status}</span>
                                                                <FaArrowLeft size={10} className="text-brand-primary" />
                                                                <span className="px-2 py-0.5 bg-brand-primary/10 rounded-md font-bold text-brand-primary">{event.new_status}</span>
                                                            </div>
                                                        )}

                                                        {/* Payload Toggle */}
                                                        {event.payload && (
                                                            <button
                                                                onClick={() => togglePayload(event.id)}
                                                                className="mt-1 text-[10px] text-brand-primary font-bold flex items-center gap-1 hover:underline"
                                                            >
                                                                {expandedPayloads[event.id] ? <FaChevronUp size={8} /> : <FaChevronDown size={8} />}
                                                                {expandedPayloads[event.id] ? 'הסתר Payload' : 'הצג Payload'}
                                                            </button>
                                                        )}
                                                        {expandedPayloads[event.id] && event.payload && (
                                                            <div className="mt-2 bg-gray-900 rounded-xl p-3 overflow-auto max-h-[200px] custom-scrollbar">
                                                                <pre className="text-[10px] font-mono text-cyan-400 whitespace-pre-wrap break-all" dir="ltr">
                                                                    {JSON.stringify(event.payload, null, 2)}
                                                                </pre>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'errors' && (
                    <div className="space-y-6">
                        {/* Filters */}
                        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                                    <FaExclamationTriangle className="text-red-500" size={16} />
                                    שגיאות מערכת
                                </h2>
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <FaFilter className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                                        <select
                                            value={severityFilter}
                                            onChange={e => setSeverityFilter(e.target.value)}
                                            className="pr-9 pl-4 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-xs font-bold appearance-none"
                                        >
                                            <option value="">כל הרמות</option>
                                            <option value="critical">Critical</option>
                                            <option value="error">Error</option>
                                            <option value="warning">Warning</option>
                                            <option value="info">Info</option>
                                        </select>
                                    </div>
                                    <button
                                        onClick={loadErrors}
                                        disabled={loadingErrors}
                                        className="px-4 py-2 bg-brand-primary text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-brand-primary/95 transition-all disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {loadingErrors ? <FaSpinner className="animate-spin" size={12} /> : <FaSearch size={12} />}
                                        סינון
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Errors Table */}
                        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                            {loadingErrors ? (
                                <div className="py-12 text-center">
                                    <FaSpinner className="animate-spin mx-auto mb-3 text-brand-primary" size={24} />
                                    <p className="text-xs font-bold text-gray-400 uppercase">טוען שגיאות...</p>
                                </div>
                            ) : errors.length === 0 ? (
                                <div className="py-12 text-center">
                                    <FaCheck className="mx-auto mb-3 text-green-300" size={32} />
                                    <p className="text-xs font-bold text-gray-400 uppercase">אין שגיאות פעילות</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-right">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-100">
                                                <th className="px-4 py-3 text-[10px] font-black text-gray-500 uppercase tracking-wider">רמה</th>
                                                <th className="px-4 py-3 text-[10px] font-black text-gray-500 uppercase tracking-wider">סוג</th>
                                                <th className="px-4 py-3 text-[10px] font-black text-gray-500 uppercase tracking-wider">הודעה</th>
                                                <th className="px-4 py-3 text-[10px] font-black text-gray-500 uppercase tracking-wider">תאריך</th>
                                                <th className="px-4 py-3 text-[10px] font-black text-gray-500 uppercase tracking-wider">סטטוס</th>
                                                <th className="px-4 py-3 text-[10px] font-black text-gray-500 uppercase tracking-wider">פעולות</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {errors.map(err => (
                                                <tr key={err.id} className="hover:bg-gray-50/50 transition-all">
                                                    <td className="px-4 py-3">
                                                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${SEVERITY_STYLES[err.severity] || SEVERITY_STYLES.info}`}>
                                                            {err.severity}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-xs font-bold text-gray-700">{err.error_type}</td>
                                                    <td className="px-4 py-3 text-xs text-gray-600 max-w-[300px] truncate">{err.message}</td>
                                                    <td className="px-4 py-3 text-[10px] font-mono text-gray-400" dir="ltr">{formatDate(err.created_at)}</td>
                                                    <td className="px-4 py-3">
                                                        {err.resolved ? (
                                                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-green-100 text-green-700 border border-green-200">טופל</span>
                                                        ) : (
                                                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-red-100 text-red-700 border border-red-200">פתוח</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {!err.resolved && (
                                                            <button
                                                                onClick={() => resolveError(err.id)}
                                                                className="text-[10px] font-black uppercase px-3 py-1 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-all flex items-center gap-1"
                                                            >
                                                                <FaCheck size={8} />
                                                                סיום
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </SuperAdminLayout>
    );
}
