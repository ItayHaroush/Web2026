import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import SuperAdminLayout from '../../layouts/SuperAdminLayout';
import { useAdminAuth } from '../../context/AdminAuthContext';
import api from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import {
    FaEnvelope,
    FaArrowRight,
    FaSpinner,
    FaEye,
    FaPaperPlane,
    FaUsers,
    FaTimes,
    FaHandshake,
    FaClock,
    FaExclamationTriangle,
    FaCheckCircle,
    FaChartBar,
    FaPen,
    FaSearch
} from 'react-icons/fa';

const TEMPLATE_ICONS = {
    welcome: <FaHandshake className="text-green-500" />,
    trial_info: <FaClock className="text-blue-500" />,
    trial_expiring: <FaExclamationTriangle className="text-amber-500" />,
    restaurant_approved: <FaCheckCircle className="text-emerald-500" />,
    monthly_report: <FaChartBar className="text-purple-500" />,
    custom: <FaPen className="text-orange-500" />,
};

const TRIGGER_LABELS = {
    auto: { text: 'אוטומטי', color: 'bg-green-50 text-green-700 border-green-200' },
    scheduled: { text: 'מתוזמן', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    manual: { text: 'ידני', color: 'bg-orange-50 text-orange-700 border-orange-200' },
};

export default function SuperAdminEmails() {
    const { getAuthHeaders } = useAdminAuth();
    const [templates, setTemplates] = useState([]);
    const [restaurants, setRestaurants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [sendingBulk, setSendingBulk] = useState(false);
    const [previewHtml, setPreviewHtml] = useState(null);
    const [previewType, setPreviewType] = useState(null);

    // Send test modal state
    const [showSendModal, setShowSendModal] = useState(false);
    const [sendForm, setSendForm] = useState({
        type: '',
        email: '',
        restaurant_id: '',
        subject: '',
        body: '',
        recipient_name: '',
    });

    // Bulk send state
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [bulkForm, setBulkForm] = useState({
        type: 'custom',
        subject: '',
        body: '',
        filter: 'all',
    });

    // Search
    const [restaurantSearch, setRestaurantSearch] = useState('');

    useEffect(() => {
        fetchTemplates();
        fetchRestaurants();
    }, []);

    const fetchTemplates = async () => {
        try {
            const response = await api.get('/super-admin/emails/templates', {
                headers: getAuthHeaders(),
            });
            if (response.data.success) {
                setTemplates(response.data.data || []);
            }
        } catch (error) {
            console.error('Failed to load templates:', error);
            toast.error('שגיאה בטעינת תבניות מייל');
        } finally {
            setLoading(false);
        }
    };

    const fetchRestaurants = async () => {
        try {
            const response = await api.get('/super-admin/restaurants', {
                headers: getAuthHeaders(),
            });
            if (response.data.success) {
                const list = response.data.restaurants?.data || response.data.restaurants || [];
                setRestaurants(Array.isArray(list) ? list : []);
            }
        } catch (error) {
            console.error('Failed to load restaurants:', error);
        }
    };

    const handlePreview = async (type, restaurantId) => {
        setPreviewType(type);
        setPreviewHtml(null);
        try {
            const params = restaurantId ? `?restaurant_id=${restaurantId}` : '';
            const response = await api.get(`/super-admin/emails/preview/${type}${params}`, {
                headers: getAuthHeaders(),
                responseType: 'text',
            });
            setPreviewHtml(response.data);
        } catch (error) {
            console.error('Preview failed:', error);
            toast.error('שגיאה בטעינת תצוגה מקדימה');
            setPreviewType(null);
        }
    };

    const handleSendTest = async (e) => {
        e.preventDefault();
        if (!sendForm.email) {
            toast.error('יש להזין כתובת אימייל');
            return;
        }
        setSending(true);
        try {
            const payload = { ...sendForm };
            if (!payload.restaurant_id) delete payload.restaurant_id;
            if (!payload.subject) delete payload.subject;
            if (!payload.body) delete payload.body;
            if (!payload.recipient_name) delete payload.recipient_name;

            const response = await api.post('/super-admin/emails/send', payload, {
                headers: getAuthHeaders(),
            });
            if (response.data.success) {
                toast.success(response.data.message || 'מייל נשלח בהצלחה!');
                setShowSendModal(false);
            } else {
                toast.error(response.data.message || 'שליחה נכשלה');
            }
        } catch (error) {
            console.error('Send failed:', error);
            toast.error(error.response?.data?.message || 'שגיאה בשליחת המייל');
        } finally {
            setSending(false);
        }
    };

    const handleBulkSend = async (e) => {
        e.preventDefault();
        if (bulkForm.type === 'custom' && !bulkForm.subject) {
            toast.error('יש להזין כותרת להודעה');
            return;
        }
        setSendingBulk(true);
        try {
            const response = await api.post('/super-admin/emails/send-bulk', bulkForm, {
                headers: getAuthHeaders(),
            });
            if (response.data.success) {
                toast.success(response.data.message || 'מיילים נשלחו!');
                setShowBulkModal(false);
            } else {
                toast.error(response.data.message || 'שליחה נכשלה');
            }
        } catch (error) {
            console.error('Bulk send failed:', error);
            toast.error(error.response?.data?.message || 'שגיאה בשליחה גורפת');
        } finally {
            setSendingBulk(false);
        }
    };

    const openSendModal = (type) => {
        setSendForm({
            type,
            email: '',
            restaurant_id: '',
            subject: '',
            body: '',
            recipient_name: '',
        });
        setShowSendModal(true);
    };

    const filteredRestaurants = restaurants.filter(r =>
        !restaurantSearch || r.name?.includes(restaurantSearch) || r.tenant_id?.includes(restaurantSearch)
    );

    if (loading) {
        return (
            <SuperAdminLayout>
                <div className="flex items-center justify-center min-h-[60vh]">
                    <FaSpinner className="animate-spin text-brand-primary" size={32} />
                </div>
            </SuperAdminLayout>
        );
    }

    return (
        <SuperAdminLayout>
            <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                            <div className="p-2.5 bg-brand-primary/10 rounded-xl">
                                <FaEnvelope className="text-brand-primary" size={20} />
                            </div>
                            תבניות מייל
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">ניהול, תצוגה מקדימה ושליחת תבניות מייל</p>
                    </div>
                    <button
                        onClick={() => setShowBulkModal(true)}
                        className="px-5 py-2.5 bg-brand-primary text-white rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-brand-primary/90 transition-all shadow-lg shadow-brand-primary/20 flex items-center gap-2"
                    >
                        <FaUsers size={12} />
                        שליחה גורפת
                    </button>
                </div>

                {/* Template Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {templates.map((template) => {
                        const trigger = TRIGGER_LABELS[template.trigger] || TRIGGER_LABELS.manual;
                        return (
                            <div
                                key={template.type}
                                className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow"
                            >
                                {/* Header */}
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-gray-50 rounded-xl text-lg">
                                            {TEMPLATE_ICONS[template.type] || <FaEnvelope className="text-gray-400" />}
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-black text-gray-900">{template.name}</h3>
                                            <span className={`inline-block mt-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${trigger.color}`}>
                                                {trigger.text}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Description */}
                                <p className="text-xs text-gray-500 leading-relaxed mb-4 min-h-[36px]">
                                    {template.description}
                                </p>

                                {/* Actions */}
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handlePreview(template.type)}
                                        className="flex-1 px-3 py-2 bg-gray-50 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-100 transition-all flex items-center justify-center gap-1.5 border border-gray-100"
                                    >
                                        <FaEye size={10} />
                                        תצוגה מקדימה
                                    </button>
                                    <button
                                        onClick={() => openSendModal(template.type)}
                                        className="flex-1 px-3 py-2 bg-brand-primary/10 text-brand-primary rounded-xl text-xs font-bold hover:bg-brand-primary/20 transition-all flex items-center justify-center gap-1.5 border border-brand-primary/20"
                                    >
                                        <FaPaperPlane size={10} />
                                        שלח דוגמה
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Preview Modal */}
                {previewType && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setPreviewType(null)}>
                        <div
                            className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between p-5 border-b border-gray-100">
                                <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
                                    <FaEye className="text-brand-primary" size={14} />
                                    תצוגה מקדימה — {templates.find(t => t.type === previewType)?.name}
                                </h3>
                                <button
                                    onClick={() => setPreviewType(null)}
                                    className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                                >
                                    <FaTimes size={14} className="text-gray-400" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-auto p-1">
                                {previewHtml ? (
                                    <iframe
                                        srcDoc={previewHtml}
                                        className="w-full h-full min-h-[500px] border-0 rounded-2xl"
                                        title="Email Preview"
                                        sandbox="allow-same-origin"
                                    />
                                ) : (
                                    <div className="flex items-center justify-center h-64">
                                        <FaSpinner className="animate-spin text-brand-primary" size={24} />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Send Test Email Modal */}
                {showSendModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowSendModal(false)}>
                        <div
                            className="bg-white rounded-3xl shadow-2xl w-full max-w-lg"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between p-5 border-b border-gray-100">
                                <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
                                    <FaPaperPlane className="text-brand-primary" size={14} />
                                    שליחת מייל דוגמה — {templates.find(t => t.type === sendForm.type)?.name}
                                </h3>
                                <button onClick={() => setShowSendModal(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                                    <FaTimes size={14} className="text-gray-400" />
                                </button>
                            </div>

                            <form onSubmit={handleSendTest} className="p-5 space-y-4">
                                {/* Email */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-black text-gray-500 uppercase tracking-wider">כתובת אימייל *</label>
                                    <input
                                        type="email"
                                        value={sendForm.email}
                                        onChange={(e) => setSendForm(prev => ({ ...prev, email: e.target.value }))}
                                        placeholder="email@example.com"
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-sm"
                                        required
                                    />
                                </div>

                                {/* Restaurant selector (for templates that need it) */}
                                {templates.find(t => t.type === sendForm.type)?.requires_restaurant && (
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-black text-gray-500 uppercase tracking-wider">מסעדה (אופציונלי)</label>
                                        <div className="relative">
                                            <FaSearch className="absolute right-3 top-3 text-gray-400" size={12} />
                                            <input
                                                type="text"
                                                value={restaurantSearch}
                                                onChange={(e) => setRestaurantSearch(e.target.value)}
                                                placeholder="חיפוש מסעדה..."
                                                className="w-full px-4 pr-9 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-sm mb-2"
                                            />
                                        </div>
                                        <select
                                            value={sendForm.restaurant_id}
                                            onChange={(e) => setSendForm(prev => ({ ...prev, restaurant_id: e.target.value }))}
                                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-sm"
                                        >
                                            <option value="">-- דוגמה כללית --</option>
                                            {filteredRestaurants.map(r => (
                                                <option key={r.id} value={r.id}>{r.name} ({r.tenant_id})</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {/* Custom fields */}
                                {sendForm.type === 'custom' && (
                                    <>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-black text-gray-500 uppercase tracking-wider">שם נמען (אופציונלי)</label>
                                            <input
                                                type="text"
                                                value={sendForm.recipient_name}
                                                onChange={(e) => setSendForm(prev => ({ ...prev, recipient_name: e.target.value }))}
                                                placeholder="ישראל ישראלי"
                                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-sm"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-black text-gray-500 uppercase tracking-wider">כותרת *</label>
                                            <input
                                                type="text"
                                                value={sendForm.subject}
                                                onChange={(e) => setSendForm(prev => ({ ...prev, subject: e.target.value }))}
                                                placeholder="כותרת המייל"
                                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-sm"
                                                required
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-black text-gray-500 uppercase tracking-wider">תוכן ההודעה *</label>
                                            <textarea
                                                value={sendForm.body}
                                                onChange={(e) => setSendForm(prev => ({ ...prev, body: e.target.value }))}
                                                placeholder="כתוב כאן את תוכן ההודעה..."
                                                rows={5}
                                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-sm resize-none"
                                                required
                                            />
                                        </div>
                                    </>
                                )}

                                <div className="flex justify-end gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowSendModal(false)}
                                        className="px-5 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-200 transition-all"
                                    >
                                        ביטול
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={sending}
                                        className="px-6 py-2.5 bg-brand-primary text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-brand-primary/90 transition-all shadow-lg shadow-brand-primary/20 disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {sending ? (
                                            <>
                                                <FaSpinner className="animate-spin" size={10} />
                                                שולח...
                                            </>
                                        ) : (
                                            <>
                                                <FaPaperPlane size={10} />
                                                שלח מייל
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Bulk Send Modal */}
                {showBulkModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowBulkModal(false)}>
                        <div
                            className="bg-white rounded-3xl shadow-2xl w-full max-w-lg"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between p-5 border-b border-gray-100">
                                <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
                                    <FaUsers className="text-brand-primary" size={14} />
                                    שליחה גורפת
                                </h3>
                                <button onClick={() => setShowBulkModal(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                                    <FaTimes size={14} className="text-gray-400" />
                                </button>
                            </div>

                            <form onSubmit={handleBulkSend} className="p-5 space-y-4">
                                {/* Template type */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-black text-gray-500 uppercase tracking-wider">סוג תבנית</label>
                                    <select
                                        value={bulkForm.type}
                                        onChange={(e) => setBulkForm(prev => ({ ...prev, type: e.target.value }))}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-sm"
                                    >
                                        <option value="custom">הודעה מותאמת אישית</option>
                                        <option value="trial_info">מידע תקופת ניסיון</option>
                                        <option value="trial_expiring">תזכורת סיום ניסיון</option>
                                    </select>
                                </div>

                                {/* Filter */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-black text-gray-500 uppercase tracking-wider">קהל יעד</label>
                                    <select
                                        value={bulkForm.filter}
                                        onChange={(e) => setBulkForm(prev => ({ ...prev, filter: e.target.value }))}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-sm"
                                    >
                                        <option value="all">כל המסעדות</option>
                                        <option value="active">פעילות בלבד</option>
                                        <option value="trial">בתקופת ניסיון</option>
                                        <option value="approved">מאושרות</option>
                                        <option value="pending">ממתינות לאישור</option>
                                    </select>
                                </div>

                                {/* Custom fields */}
                                {bulkForm.type === 'custom' && (
                                    <>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-black text-gray-500 uppercase tracking-wider">כותרת *</label>
                                            <input
                                                type="text"
                                                value={bulkForm.subject}
                                                onChange={(e) => setBulkForm(prev => ({ ...prev, subject: e.target.value }))}
                                                placeholder="כותרת המייל"
                                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-sm"
                                                required
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-black text-gray-500 uppercase tracking-wider">תוכן ההודעה *</label>
                                            <textarea
                                                value={bulkForm.body}
                                                onChange={(e) => setBulkForm(prev => ({ ...prev, body: e.target.value }))}
                                                placeholder="כתוב כאן את תוכן ההודעה..."
                                                rows={5}
                                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all text-sm resize-none"
                                                required
                                            />
                                        </div>
                                    </>
                                )}

                                {/* Warning */}
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                                    <FaExclamationTriangle className="inline ml-1" size={10} />
                                    שליחה גורפת תשלח מייל לכל המסעדות שתואמות את הפילטר. פעולה זו אינה ניתנת לביטול.
                                </div>

                                <div className="flex justify-end gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowBulkModal(false)}
                                        className="px-5 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-200 transition-all"
                                    >
                                        ביטול
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={sendingBulk}
                                        className="px-6 py-2.5 bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-red-600 transition-all shadow-lg shadow-red-500/20 disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {sendingBulk ? (
                                            <>
                                                <FaSpinner className="animate-spin" size={10} />
                                                שולח...
                                            </>
                                        ) : (
                                            <>
                                                <FaUsers size={10} />
                                                שלח לכולם
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </SuperAdminLayout>
    );
}
