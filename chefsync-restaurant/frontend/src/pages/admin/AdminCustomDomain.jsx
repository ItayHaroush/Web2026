import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import AdminLayout from '../../layouts/AdminLayout';
import { useAdminAuth } from '../../context/AdminAuthContext';
import domainRequestService from '../../services/domainRequestService';
import {
    FaGlobe,
    FaChevronRight,
    FaSpinner,
    FaCheckCircle,
    FaLink,
    FaUnlink,
    FaExchangeAlt,
    FaCreditCard,
} from 'react-icons/fa';

const STATUS_LABELS = {
    awaiting_payment: 'ממתין לתשלום',
    pending: 'ממתין לטיפול',
    in_progress: 'בטיפול',
    awaiting_customer_info: 'ממתין למידע מהלקוח',
    awaiting_dns: 'ממתין להגדרות DNS',
    ssl_setup: 'בהגדרת SSL',
    active: 'פעיל',
    rejected: 'נדחה',
    completed: 'הושלם',
};

const STATUS_COLORS = {
    awaiting_payment: 'bg-amber-100 text-amber-800',
    pending: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-indigo-100 text-indigo-800',
    awaiting_customer_info: 'bg-orange-100 text-orange-800',
    awaiting_dns: 'bg-yellow-100 text-yellow-800',
    ssl_setup: 'bg-purple-100 text-purple-800',
    active: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    completed: 'bg-gray-100 text-gray-700',
};

const TYPE_LABELS = {
    existing_domain: 'חיבור דומיין קיים',
    full_service: 'TakeEat מטפלת בהכל',
    change_domain: 'שינוי דומיין',
    disconnect_domain: 'ניתוק דומיין',
};

const PAYMENT_LABELS = {
    awaiting_payment: 'ממתין לתשלום',
    paid: 'שולם',
    waived: 'פטור מתשלום',
    included_in_setup: 'כלול בהקמה',
    refunded: 'הוחזר',
};

const PAYMENT_COLORS = {
    awaiting_payment: 'bg-amber-100 text-amber-800',
    paid: 'bg-green-100 text-green-800',
    waived: 'bg-gray-100 text-gray-700',
    included_in_setup: 'bg-blue-100 text-blue-800',
    refunded: 'bg-red-100 text-red-800',
};

const HEALTH_LABELS = {
    pending: 'ממתין',
    dns_pending: 'DNS ממתין',
    ssl_pending: 'SSL ממתין',
    healthy: 'תקין',
    error: 'שגיאה',
};

function StatusBadge({ status }) {
    return (
        <span className={`text-xs font-black px-2.5 py-1 rounded-full ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-700'}`}>
            {STATUS_LABELS[status] || status}
        </span>
    );
}

export default function AdminCustomDomain() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { getAuthHeaders, isOwner } = useAdminAuth();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [tab, setTab] = useState('existing');
    const [overview, setOverview] = useState(null);
    const [dnsRecords, setDnsRecords] = useState([]);

    const [existingForm, setExistingForm] = useState({ domain_name: '', registrar: '', customer_notes: '' });
    const [fullForm, setFullForm] = useState({
        business_name: '',
        domain_name: '',
        domain_name_alt_2: '',
        domain_name_alt_3: '',
        customer_notes: '',
    });

    const fetchOverview = useCallback(async () => {
        setLoading(true);
        try {
            const res = await domainRequestService.getOverview(getAuthHeaders());
            if (res?.success) {
                setOverview(res.data);
                const open = res.data?.open_request;
                if (open?.status === 'awaiting_dns' && open?.id) {
                    const dns = await domainRequestService.getDnsInstructions(open.id, getAuthHeaders());
                    if (dns?.success) setDnsRecords(dns.data?.dns_records || []);
                }
            }
        } catch {
            toast.error('שגיאה בטעינת נתוני דומיין');
        } finally {
            setLoading(false);
        }
    }, [getAuthHeaders]);

    useEffect(() => { fetchOverview(); }, [fetchOverview]);

    useEffect(() => {
        const payment = searchParams.get('payment');
        if (payment === 'success') {
            toast.success('התשלום התקבל — הבקשה בטיפול');
            setSearchParams({}, { replace: true });
            fetchOverview();
        } else if (payment === 'error') {
            toast.error('התשלום לא הושלם');
            setSearchParams({}, { replace: true });
        }
    }, [searchParams, setSearchParams, fetchOverview]);

    const handleSubmit = async (kind) => {
        if (!isOwner()) {
            toast.error('רק בעל המסעדה יכול לשלוח בקשה');
            return;
        }
        setSubmitting(true);
        try {
            const res = kind === 'existing'
                ? await domainRequestService.submitExisting(existingForm, getAuthHeaders())
                : await domainRequestService.submitFullService(fullForm, getAuthHeaders());

            if (!res?.success) {
                toast.error(res?.message || 'שגיאה בשליחה');
                return;
            }

            if (res.hyp_ready && res.payment_url) {
                toast.success('מעביר לדף תשלום…');
                window.location.href = res.payment_url;
                return;
            }

            toast.success('הבקשה נשלחה לצוות TakeEat');
            fetchOverview();
        } catch (e) {
            toast.error(e.response?.data?.message || 'שגיאה בשליחת הבקשה');
        } finally {
            setSubmitting(false);
        }
    };

    const handlePayAgain = async () => {
        if (!openRequest?.id) return;
        setSubmitting(true);
        try {
            const res = await domainRequestService.createPaymentSession(openRequest.id, getAuthHeaders());
            if (res?.hyp_ready && res.payment_url) {
                toast.success('מעביר לדף תשלום…');
                window.location.href = res.payment_url;
                return;
            }
            toast.error(res?.message || 'תשלום לא זמין כרגע — פנה לצוות TakeEat');
        } catch (e) {
            toast.error(e.response?.data?.message || 'שגיאה בפתיחת תשלום');
        } finally {
            setSubmitting(false);
        }
    };

    const handleChangeDisconnect = async (type) => {
        const notes = window.prompt(type === 'change' ? 'פרטי בקשת שינוי דומיין:' : 'סיבת ניתוק (אופציונלי):');
        if (notes === null) return;
        try {
            const res = type === 'change'
                ? await domainRequestService.submitChange(notes, getAuthHeaders())
                : await domainRequestService.submitDisconnect(notes, getAuthHeaders());
            if (res?.success) {
                toast.success('הבקשה נשלחה');
                fetchOverview();
            }
        } catch (e) {
            toast.error(e.response?.data?.message || 'שגיאה');
        }
    };

    if (!isOwner()) {
        return (
            <AdminLayout>
                <div className="max-w-xl mx-auto px-4 py-12 text-center" dir="rtl">
                    <p className="text-gray-600 font-bold">רק בעל המסעדה יכול לנהל דומיין מותאם.</p>
                </div>
            </AdminLayout>
        );
    }

    const pricing = overview?.pricing || {};
    const openRequest = overview?.open_request;
    const activeDomain = overview?.active_domain;
    const hasActive = Boolean(overview?.restaurant_custom_domain || activeDomain);
    const canCreate = overview?.can_create !== false;

    return (
        <AdminLayout>
            <div className="max-w-2xl mx-auto px-4 py-6" dir="rtl">
                <div className="flex items-center gap-3 mb-8">
                    <button
                        type="button"
                        onClick={() => navigate('/admin/settings-hub')}
                        className="p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-500"
                    >
                        <FaChevronRight size={16} />
                    </button>
                    <div className="p-3 bg-brand-primary/10 rounded-xl text-brand-primary">
                        <FaGlobe size={22} />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-gray-900">דומיין מותאם אישית</h1>
                        <p className="text-xs text-gray-500 font-bold">TakeEat מטפלת ב-DNS, SSL והגדרות — אתם רק שולחים בקשה</p>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-16">
                        <FaSpinner className="animate-spin text-brand-primary" size={28} />
                    </div>
                ) : (
                    <>
                        {hasActive && (
                            <div className="bg-green-50 border border-green-200 rounded-2xl p-5 mb-6">
                                <div className="flex items-center gap-2 mb-3">
                                    <FaCheckCircle className="text-green-600" />
                                    <span className="font-black text-green-900">דומיין פעיל</span>
                                </div>
                                <p className="text-lg font-black text-gray-900 mb-1" dir="ltr">
                                    {overview?.restaurant_custom_domain || activeDomain?.domain}
                                </p>
                                <p className="text-xs text-gray-600 mb-4">
                                    SSL: {overview?.restaurant_ssl_status || activeDomain?.ssl_status || '—'}
                                    {(overview?.active_domain?.health_status || activeDomain?.health_status) && (
                                        <> · בריאות: {HEALTH_LABELS[overview?.active_domain?.health_status || activeDomain?.health_status]}</>
                                    )}
                                    {overview?.restaurant_connected_at && (
                                        <> · חובר: {new Date(overview.restaurant_connected_at).toLocaleDateString('he-IL')}</>
                                    )}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleChangeDisconnect('change')}
                                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-black text-gray-700 hover:border-brand-primary"
                                    >
                                        <FaExchangeAlt size={12} /> בקשת שינוי
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleChangeDisconnect('disconnect')}
                                        className="flex items-center gap-2 px-4 py-2 bg-white border border-red-200 rounded-xl text-sm font-black text-red-700 hover:bg-red-50"
                                    >
                                        <FaUnlink size={12} /> בקשת ניתוק
                                    </button>
                                </div>
                            </div>
                        )}

                        {openRequest && (
                            <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-6 shadow-sm">
                                <h2 className="font-black text-gray-900 mb-3">סטטוס בקשה</h2>
                                <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                                    <div>
                                        <span className="text-gray-400 text-xs font-bold block">מספר בקשה</span>
                                        <span className="font-black">{openRequest.request_number}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-400 text-xs font-bold block">תאריך</span>
                                        <span>{new Date(openRequest.created_at).toLocaleDateString('he-IL')}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-400 text-xs font-bold block">סוג</span>
                                        <span>{TYPE_LABELS[openRequest.type] || openRequest.type}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-400 text-xs font-bold block">סטטוס</span>
                                        <StatusBadge status={openRequest.status} />
                                    </div>
                                    {openRequest.amount > 0 && (
                                        <div>
                                            <span className="text-gray-400 text-xs font-bold block">תשלום</span>
                                            <span className={`inline-block text-xs font-black px-2 py-0.5 rounded-full ${PAYMENT_COLORS[openRequest.payment_status] || 'bg-gray-100 text-gray-700'}`}>
                                                {PAYMENT_LABELS[openRequest.payment_status] || openRequest.payment_status}
                                                {' · '}₪{Number(openRequest.amount).toLocaleString()}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                {openRequest.domain_name && (
                                    <p className="text-sm mb-3" dir="ltr">
                                        <FaLink className="inline ml-1 text-gray-400" />
                                        {openRequest.domain_name}
                                    </p>
                                )}
                                {openRequest.status === 'awaiting_dns' && dnsRecords.length > 0 && (
                                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mt-3">
                                        <p className="text-xs font-black text-yellow-900 mb-2">הוראות DNS</p>
                                        {dnsRecords.map((r, i) => (
                                            <div key={i} className="text-xs font-mono bg-white rounded p-2 mb-1" dir="ltr">
                                                {r.type} {r.name} → {r.value}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {openRequest.payment_status === 'included_in_setup' && (
                                    <p className="text-xs text-brand-primary font-bold mt-2">כלול בחבילת ההקמה — ללא תשלום נוסף</p>
                                )}
                                {openRequest.status === 'awaiting_payment'
                                    && openRequest.payment_status === 'awaiting_payment'
                                    && Number(openRequest.amount) > 0 && (
                                    <button
                                        type="button"
                                        disabled={submitting}
                                        onClick={handlePayAgain}
                                        className="w-full mt-3 py-3 bg-amber-500 text-white rounded-xl font-black flex items-center justify-center gap-2 hover:bg-amber-600 disabled:opacity-50"
                                    >
                                        {submitting ? <FaSpinner className="animate-spin" /> : <FaCreditCard />}
                                        שלם ₪{Number(openRequest.amount).toLocaleString()}
                                    </button>
                                )}
                            </div>
                        )}

                        {canCreate && !openRequest && (
                            <>
                                <div className="flex gap-2 mb-4">
                                    {['existing', 'full'].map((t) => (
                                        <button
                                            key={t}
                                            type="button"
                                            onClick={() => setTab(t)}
                                            className={`flex-1 py-3 rounded-xl text-sm font-black transition-all ${
                                                tab === t
                                                    ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20'
                                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                        >
                                            {t === 'existing' ? 'יש לי דומיין קיים' : 'TakeEat תטפל בהכל'}
                                        </button>
                                    ))}
                                </div>

                                {tab === 'existing' ? (
                                    <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4">
                                        <p className="text-sm text-gray-600">
                                            חיבור ותצורה: <strong>₪{pricing.existing_domain?.price || 390}</strong> חד-פעמי
                                        </p>
                                        <input
                                            type="text"
                                            placeholder="example.co.il"
                                            dir="ltr"
                                            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm"
                                            value={existingForm.domain_name}
                                            onChange={(e) => setExistingForm((f) => ({ ...f, domain_name: e.target.value }))}
                                        />
                                        <input
                                            type="text"
                                            placeholder="ספק דומיין (אופציונלי)"
                                            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm"
                                            value={existingForm.registrar}
                                            onChange={(e) => setExistingForm((f) => ({ ...f, registrar: e.target.value }))}
                                        />
                                        <textarea
                                            placeholder="הערות"
                                            rows={3}
                                            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm"
                                            value={existingForm.customer_notes}
                                            onChange={(e) => setExistingForm((f) => ({ ...f, customer_notes: e.target.value }))}
                                        />
                                        <button
                                            type="button"
                                            disabled={submitting || !existingForm.domain_name.trim()}
                                            onClick={() => handleSubmit('existing')}
                                            className="w-full py-3 bg-brand-primary text-white rounded-xl font-black disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {submitting ? <FaSpinner className="animate-spin" /> : null}
                                            שלח בקשת חיבור
                                        </button>
                                    </div>
                                ) : (
                                    <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4">
                                        <p className="text-sm text-gray-600">
                                            צוות TakeEat ירכוש, יחבר ויגדיר: <strong>₪{pricing.full_service?.price || 890}</strong> + עלות דומיין בפועל
                                        </p>
                                        <input
                                            type="text"
                                            placeholder="שם העסק"
                                            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm"
                                            value={fullForm.business_name}
                                            onChange={(e) => setFullForm((f) => ({ ...f, business_name: e.target.value }))}
                                        />
                                        {['domain_name', 'domain_name_alt_2', 'domain_name_alt_3'].map((field, i) => (
                                            <input
                                                key={field}
                                                type="text"
                                                placeholder={i === 0 ? 'דומיין רצוי ראשון *' : `דומיין רצוי ${i === 1 ? 'שני' : 'שלישי'}`}
                                                dir="ltr"
                                                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm"
                                                value={fullForm[field]}
                                                onChange={(e) => setFullForm((f) => ({ ...f, [field]: e.target.value }))}
                                            />
                                        ))}
                                        <textarea
                                            placeholder="הערות"
                                            rows={3}
                                            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm"
                                            value={fullForm.customer_notes}
                                            onChange={(e) => setFullForm((f) => ({ ...f, customer_notes: e.target.value }))}
                                        />
                                        <button
                                            type="button"
                                            disabled={submitting || !fullForm.domain_name.trim() || !fullForm.business_name.trim()}
                                            onClick={() => handleSubmit('full')}
                                            className="w-full py-3 bg-brand-primary text-white rounded-xl font-black disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {submitting ? <FaSpinner className="animate-spin" /> : null}
                                            שלח בקשה
                                        </button>
                                    </div>
                                )}
                            </>
                        )}

                        {overview?.history?.length > 0 && (
                            <div className="mt-8">
                                <h2 className="font-black text-gray-900 mb-3 text-sm">היסטוריית בקשות</h2>
                                <div className="space-y-2">
                                    {overview.history.map((h) => (
                                        <div key={h.id} className="bg-gray-50 rounded-xl px-4 py-3 flex justify-between items-center text-sm">
                                            <span className="font-bold">{h.request_number}</span>
                                            <StatusBadge status={h.status} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </AdminLayout>
    );
}
