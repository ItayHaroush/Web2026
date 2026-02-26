import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import { useAdminAuth } from '../../context/AdminAuthContext';
import paymentSettingsService from '../../services/paymentSettingsService';
import { getBillingInfo } from '../../services/subscriptionService';
import { FaCreditCard, FaMoneyBillWave, FaCheckCircle, FaExclamationTriangle, FaExternalLinkAlt, FaShieldAlt, FaSpinner, FaInfoCircle, FaWrench, FaCrown } from 'react-icons/fa';

const STATUS_LABELS = { trial: 'תקופת ניסיון', active: 'פעיל', suspended: 'מושהה', expired: 'פג תוקף', cancelled: 'מבוטל' };
const STATUS_COLORS = { trial: 'bg-blue-100 text-blue-700', active: 'bg-emerald-100 text-emerald-700', suspended: 'bg-red-100 text-red-700', expired: 'bg-gray-100 text-gray-600', cancelled: 'bg-gray-100 text-gray-600' };

export default function AdminPaymentSettings() {
    const navigate = useNavigate();
    const { getAuthHeaders, isOwner, isSuperAdmin } = useAdminAuth();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [message, setMessage] = useState(null);

    // Settings state
    const [acceptedMethods, setAcceptedMethods] = useState(['cash']);
    const [availableMethods, setAvailableMethods] = useState(['cash']);
    const [terminalId, setTerminalId] = useState('');
    const [terminalPassword, setTerminalPassword] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [hasPassword, setHasPassword] = useState(false);
    const [hasApiKey, setHasApiKey] = useState(false);
    const [verified, setVerified] = useState(false);
    const [verifiedAt, setVerifiedAt] = useState(null);
    const [tier, setTier] = useState('basic');
    const [setupFeeCharged, setSetupFeeCharged] = useState(false);
    const [agreedToFee, setAgreedToFee] = useState(false);
    const [billing, setBilling] = useState(null);

    useEffect(() => {
        fetchSettings();
        fetchBilling();
    }, []);

    const fetchBilling = async () => {
        try {
            const { data } = await getBillingInfo();
            setBilling(data?.data || {});
        } catch (e) {
            // non-fatal for payment settings
        }
    };

    const fetchSettings = async () => {
        try {
            const result = await paymentSettingsService.getSettings(getAuthHeaders());
            if (result.success) {
                const data = result.data;
                setAcceptedMethods(data.accepted_payment_methods || ['cash']);
                setAvailableMethods(data.available_payment_methods || ['cash']);
                setTerminalId(data.hyp_terminal_id || '');
                setHasPassword(data.has_password || false);
                setHasApiKey(data.has_api_key || false);
                setVerified(data.hyp_terminal_verified || false);
                setVerifiedAt(data.hyp_terminal_verified_at || null);
                setTier(data.tier || 'basic');
                setSetupFeeCharged(data.hyp_setup_fee_charged || false);
            }
        } catch (error) {
            console.error('Failed to load payment settings:', error);
            setMessage({ type: 'error', text: 'שגיאה בטעינת הגדרות תשלום' });
        } finally {
            setLoading(false);
        }
    };

    const handleCreditCardToggle = (checked) => {
        if (checked) {
            setAcceptedMethods(['cash', 'credit_card']);
        } else {
            setAcceptedMethods(['cash']);
            // Clear terminal fields when disabling credit card
            setTerminalId('');
            setTerminalPassword('');
            setApiKey('');
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);
        try {
            const payload = {
                accepted_payment_methods: acceptedMethods,
                hyp_terminal_id: terminalId || null,
            };
            // Only send password if user entered a new one
            if (terminalPassword) {
                payload.hyp_terminal_password = terminalPassword;
            }
            // Only send API key if user entered a new one
            if (apiKey) {
                payload.hyp_api_key = apiKey;
            }
            // Send fee agreement if enabling credit card and not yet charged
            if (creditCardEnabled && !setupFeeCharged && agreedToFee) {
                payload.agree_setup_fee = true;
            }

            const result = await paymentSettingsService.saveSettings(payload, getAuthHeaders());
            if (result.success) {
                setMessage({ type: 'success', text: result.message || 'ההגדרות נשמרו בהצלחה' });
                // Update local state from response
                if (result.data) {
                    setHasPassword(result.data.has_password || false);
                    setHasApiKey(result.data.has_api_key || false);
                    setVerified(result.data.hyp_terminal_verified || false);
                    setVerifiedAt(result.data.hyp_terminal_verified_at || null);
                    setAcceptedMethods(result.data.accepted_payment_methods || ['cash']);
                    setAvailableMethods(result.data.available_payment_methods || ['cash']);
                    setTier(result.data.tier || 'basic');
                    setSetupFeeCharged(result.data.hyp_setup_fee_charged || false);
                }
                if (result.warnings && result.warnings.length > 0) {
                    setMessage({ type: 'warning', text: result.warnings.join(', ') });
                }
                setTerminalPassword('');
                setApiKey('');
            } else {
                setMessage({ type: 'error', text: result.message || 'שגיאה בשמירת ההגדרות' });
            }
        } catch (error) {
            console.error('Failed to save payment settings:', error);
            const errorMsg = error.response?.data?.message || 'שגיאה בשמירת ההגדרות';
            setMessage({ type: 'error', text: errorMsg });
        } finally {
            setSaving(false);
        }
    };

    const handleVerify = async () => {
        setVerifying(true);
        setMessage(null);
        try {
            const result = await paymentSettingsService.verifyTerminal(getAuthHeaders());
            if (result.success) {
                setVerified(true);
                setVerifiedAt(result.data?.hyp_terminal_verified_at || new Date().toISOString());
                setAvailableMethods(prev => {
                    if (acceptedMethods.includes('credit_card') && !prev.includes('credit_card')) {
                        return [...prev, 'credit_card'];
                    }
                    return prev;
                });
                setMessage({ type: 'success', text: result.message || 'המסוף אומת בהצלחה' });
            } else {
                setMessage({ type: 'error', text: result.message || 'אימות המסוף נכשל' });
            }
        } catch (error) {
            console.error('Failed to verify terminal:', error);
            setMessage({ type: 'error', text: 'שגיאה באימות המסוף' });
        } finally {
            setVerifying(false);
        }
    };

    const creditCardEnabled = acceptedMethods.includes('credit_card');
    const canVerify = (isOwner() || isSuperAdmin()) && terminalId && !verified;
    const setupFee = tier === 'pro' ? 100 : 200;
    const needsFeeAgreement = creditCardEnabled && !setupFeeCharged;
    const saveDisabled = saving || (needsFeeAgreement && !agreedToFee);

    if (loading) {
        return (
            <AdminLayout>
                <div className="flex items-center justify-center min-h-[60vh]">
                    <FaSpinner className="animate-spin text-4xl text-gray-400" />
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="max-w-4xl mx-auto space-y-8 pb-32 animate-in fade-in duration-500">
                {/* Header */}
                <div className="flex items-center gap-6 px-4">
                    <div className="w-20 h-20 bg-indigo-50 rounded-[2.5rem] flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100/50">
                        <FaCreditCard size={32} />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-gray-900 tracking-tight">הגדרות תשלום וחשבון</h1>
                        <p className="text-gray-500 font-medium mt-1">ניהול חשבון, אמצעי תשלום ומסוף סליקה</p>
                    </div>
                </div>

                {/* חשבון וחיוב - תוכנית נוכחית, חיוב, תשלומים */}
                {billing && (
                    <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 p-8 mx-4 space-y-6">
                        <h2 className="text-xl font-black text-gray-900">חשבון וחיוב</h2>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <InfoBox label="תוכנית" value={billing.current_tier === 'pro' ? 'Pro' : 'Basic'} />
                            <InfoBox label="מחזור" value={billing.current_plan === 'yearly' ? 'שנתי' : 'חודשי'} />
                            <InfoBox label="חיוב הבא" value={billing.next_payment_at ? new Date(billing.next_payment_at).toLocaleDateString('he-IL') : '-'} />
                            <InfoBox label="סטטוס" value={STATUS_LABELS[billing.subscription_status] || billing.subscription_status} />
                        </div>
                        {billing.subscription_status === 'trial' && billing.days_left_in_trial > 0 && (
                            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 text-sm text-blue-700 font-bold">
                                נותרו {billing.days_left_in_trial} ימים בתקופת הניסיון
                            </div>
                        )}
                        {billing.has_card_on_file ? (
                            <div className="flex items-center gap-2 text-sm">
                                <FaCreditCard className="text-gray-500" /> כרטיס: **** {billing.card_last4}
                            </div>
                        ) : (
                            <div className="bg-amber-50 rounded-xl p-4 border border-amber-200 text-sm text-amber-700 font-bold">
                                לא הוגדר אמצעי תשלום. יש לבצע תשלום כדי לשמור כרטיס.
                            </div>
                        )}
                        {billing.outstanding_amount > 0 && (
                            <div className="bg-red-50 rounded-xl p-4 border border-red-200">
                                <p className="font-black text-red-800">יתרת חוב: ₪{billing.outstanding_amount}</p>
                                <p className="text-red-600 text-xs mt-1">יתרה זו תיגבה בחיוב הבא</p>
                            </div>
                        )}
                        {billing.recent_payments?.length > 0 && (
                            <div>
                                <p className="font-bold text-gray-700 mb-2">תשלומים אחרונים</p>
                                <div className="space-y-2">
                                    {billing.recent_payments.slice(0, 3).map((p, i) => (
                                        <div key={i} className="flex justify-between text-sm">
                                            <span>₪{p.amount} • {p.paid_at ? new Date(p.paid_at).toLocaleDateString('he-IL') : '-'}</span>
                                            <span className={p.status === 'paid' ? 'text-emerald-600' : 'text-gray-500'}>{p.status === 'paid' ? 'שולם' : p.status}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <button
                            onClick={() => navigate('/admin/paywall')}
                            className="bg-gradient-to-r from-brand-primary to-brand-secondary text-white px-6 py-3 rounded-xl font-bold text-sm hover:shadow-lg transition-all flex items-center gap-2"
                        >
                            <FaCrown size={14} />
                            {billing.subscription_status === 'trial' ? 'הפעל מנוי' : 'שנה תוכנית'}
                        </button>
                    </div>
                )}

                {/* Message */}
                {message && (
                    <div className={`mx-4 p-4 rounded-2xl text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
                            message.type === 'warning' ? 'bg-orange-50 text-orange-800 border border-orange-200' :
                                'bg-red-50 text-red-800 border border-red-200'
                        }`}>
                        {message.text}
                    </div>
                )}

                {/* Payment Methods Section */}
                <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 p-8 mx-4">
                    <h2 className="text-xl font-black text-gray-900 mb-6">אמצעי תשלום</h2>

                    <div className="space-y-4">
                        {/* Cash - always checked */}
                        <label className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 border border-gray-200 cursor-not-allowed opacity-80">
                            <input
                                type="checkbox"
                                checked={true}
                                disabled={true}
                                className="w-5 h-5 rounded accent-green-600"
                            />
                            <FaMoneyBillWave className="text-green-600" size={20} />
                            <div className="flex-1">
                                <span className="font-bold text-gray-900">מזומן</span>
                                <p className="text-xs text-gray-500 mt-0.5">תמיד פעיל - לא ניתן לבטל</p>
                            </div>
                            <span className="text-xs bg-green-100 text-green-800 px-3 py-1 rounded-full font-bold">פעיל</span>
                        </label>

                        {/* Credit Card */}
                        <label className="flex items-center gap-4 p-4 rounded-xl bg-white border border-gray-200 hover:border-indigo-300 transition-colors cursor-pointer">
                            <input
                                type="checkbox"
                                checked={creditCardEnabled}
                                onChange={(e) => handleCreditCardToggle(e.target.checked)}
                                className="w-5 h-5 rounded accent-indigo-600"
                            />
                            <FaCreditCard className="text-indigo-600" size={20} />
                            <div className="flex-1">
                                <span className="font-bold text-gray-900">כרטיס אשראי</span>
                                <p className="text-xs text-gray-500 mt-0.5">תשלום באשראי דרך מסוף HYP</p>
                            </div>
                            {creditCardEnabled && verified && (
                                <span className="text-xs bg-green-100 text-green-800 px-3 py-1 rounded-full font-bold">פעיל</span>
                            )}
                            {creditCardEnabled && !verified && (
                                <span className="text-xs bg-orange-100 text-orange-800 px-3 py-1 rounded-full font-bold">ממתין לאימות</span>
                            )}
                        </label>
                    </div>

                    {/* Status Indicator */}
                    {creditCardEnabled && (
                        <div className="mt-4 p-3 rounded-xl bg-blue-50 border border-blue-100 text-sm">
                            <span className="text-blue-800">
                                <strong>בחרת:</strong> מזומן + אשראי | {' '}
                                <strong>פעיל כרגע:</strong> {availableMethods.includes('credit_card') ? 'מזומן + אשראי' : 'מזומן בלבד'}
                                {!verified && ' (מסוף טרם אומת)'}
                            </span>
                        </div>
                    )}
                </div>

                {/* HYP Terminal Setup - shown only if credit card is enabled */}
                {creditCardEnabled && (
                    <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 p-8 mx-4 space-y-6">
                        <h2 className="text-xl font-black text-gray-900">חיבור אשראי והקמת מסוף</h2>

                        {/* סקשן מאוחד: HYP + דמי חיבור TakeEat */}
                        <div className="p-5 rounded-xl bg-indigo-50 border border-indigo-100 space-y-4">
                            <div className="flex items-start gap-3">
                                <FaCreditCard className="text-indigo-600 mt-1 flex-shrink-0" size={18} />
                                <div className="text-sm text-indigo-800">
                                    <p className="font-black text-base mb-2">סליקה באשראי (דרך HYP)</p>
                                    <p>הסליקה מתבצעת ישירות מול חברת HYP. הכסף מכל עסקה נכנס ישירות לחשבון המסעדה.</p>
                                </div>
                            </div>

                            <div className="bg-white/60 rounded-lg p-4 space-y-2 text-sm text-indigo-900">
                                <p className="font-black text-xs uppercase tracking-wider text-indigo-600 mb-2">חיבור אשראי — עלויות:</p>
                                <ul className="space-y-1.5">
                                    <li>פתיחת מסוף ב-HYP: 200₪ חד-פעמי (ישירות ל-HYP)</li>
                                    <li>תשלום חודשי ל-HYP: 65₪ (עד 150 פעולות)</li>
                                    <li>דמי חיבור TakeEat: <strong>{setupFee}₪</strong> חד-פעמי — הטמעה, אימות, תמיכה</li>
                                </ul>
                                <p className="text-xs text-indigo-600 mt-2">דמי החיבור ייגבו פעם אחת ויתווספו לחיוב החודשי הקרוב</p>
                            </div>

                            <a
                                href="https://payments.iforms.co.il/Show_form/b3ioki42"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-colors text-sm"
                            >
                                להרשמה ופתיחת מסוף סליקה ב-HYP
                                <FaExternalLinkAlt size={10} />
                            </a>

                            {!setupFeeCharged ? (
                                <label className="flex items-start gap-3 cursor-pointer select-none mt-4 p-3 bg-amber-50/80 rounded-xl border border-amber-200">
                                    <input
                                        type="checkbox"
                                        checked={agreedToFee}
                                        onChange={(e) => setAgreedToFee(e.target.checked)}
                                        className="w-5 h-5 rounded accent-amber-600 mt-0.5 flex-shrink-0"
                                    />
                                    <span className="text-sm font-bold text-amber-900">
                                        קראתי ואני מאשר/ת את דמי החיבור החד-פעמיים ({setupFee}₪) ל-TakeEat
                                    </span>
                                </label>
                            ) : (
                                <div className="p-3 rounded-xl bg-green-50 border border-green-200 flex items-center gap-3 mt-2">
                                    <FaCheckCircle className="text-green-600 flex-shrink-0" size={18} />
                                    <p className="text-sm font-bold text-green-800">דמי חיבור שולמו — החיבור פעיל</p>
                                </div>
                            )}
                        </div>

                        {/* Terminal ID */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">מזהה מסוף (Terminal ID)</label>
                            <input
                                type="text"
                                value={terminalId}
                                onChange={(e) => setTerminalId(e.target.value)}
                                placeholder="הזינו את מזהה המסוף שקיבלתם מ-HYP"
                                className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none transition-colors"
                                dir="ltr"
                            />
                        </div>

                        {/* Terminal Password */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">סיסמת מסוף (PassP)</label>
                            <input
                                type="password"
                                value={terminalPassword}
                                onChange={(e) => setTerminalPassword(e.target.value)}
                                placeholder={hasPassword ? '••••••••  (הוזנה - הזינו סיסמה חדשה לעדכון)' : 'הזינו את סיסמת המסוף'}
                                className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none transition-colors"
                                dir="ltr"
                            />
                            <p className="text-xs text-gray-400 mt-1">הסיסמה מוצפנת ולא תוצג לאחר שמירה</p>
                        </div>

                        {/* API Key */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">מפתח API (API Key)</label>
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder={hasApiKey ? '••••••••  (הוזן - הזינו מפתח חדש לעדכון)' : 'הזינו את מפתח ה-API שקיבלתם מ-HYP'}
                                className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none transition-colors"
                                dir="ltr"
                            />
                            <p className="text-xs text-gray-400 mt-1">משמש לחתימה ואימות עסקאות מול HYP. מוצפן ולא יוצג לאחר שמירה</p>
                        </div>

                        {/* Verification Status */}
                        <div className="pt-2">
                            {verified ? (
                                <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl border border-green-200">
                                    <FaCheckCircle className="text-green-600" size={24} />
                                    <div>
                                        <p className="font-bold text-green-800">המסוף מאומת</p>
                                        {verifiedAt && (
                                            <p className="text-xs text-green-600 mt-0.5">
                                                אומת בתאריך: {new Date(verifiedAt).toLocaleDateString('he-IL')}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3 p-4 bg-orange-50 rounded-xl border border-orange-200">
                                        <FaExclamationTriangle className="text-orange-500" size={20} />
                                        <div className="flex-1">
                                            <p className="font-bold text-orange-800">המסוף טרם אומת</p>
                                            <p className="text-xs text-orange-600 mt-0.5">אשראי לא יוצג ללקוחות עד שהמסוף יאומת</p>
                                        </div>
                                    </div>

                                    {canVerify && (
                                        <button
                                            onClick={handleVerify}
                                            disabled={verifying}
                                            className="w-full bg-orange-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                        >
                                            {verifying ? (
                                                <>
                                                    <FaSpinner className="animate-spin" />
                                                    מאמת...
                                                </>
                                            ) : (
                                                <>
                                                    <FaShieldAlt />
                                                    אמת מסוף
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Save Button */}
                        <button
                            onClick={handleSave}
                            disabled={saveDisabled}
                            className="w-full bg-indigo-600 text-white px-6 py-4 rounded-xl font-black text-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {saving ? (
                                <>
                                    <FaSpinner className="animate-spin" />
                                    שומר...
                                </>
                            ) : needsFeeAgreement && !agreedToFee ? (
                                'יש לאשר את דמי ההקמה לפני שמירה'
                            ) : (
                                'שמור הגדרות'
                            )}
                        </button>
                    </div>
                )}

                {/* Save button when credit card NOT enabled (just save payment methods) */}
                {!creditCardEnabled && (
                    <div className="px-4">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="w-full bg-indigo-600 text-white px-6 py-4 rounded-xl font-black text-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {saving ? (
                                <>
                                    <FaSpinner className="animate-spin" />
                                    שומר...
                                </>
                            ) : (
                                'שמור הגדרות'
                            )}
                        </button>
                    </div>
                )}

                {/* Info Section */}
                <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 p-8 mx-4">
                    <div className="flex items-center gap-3 mb-4">
                        <FaInfoCircle className="text-gray-400" size={18} />
                        <h2 className="text-xl font-black text-gray-900">חשוב לדעת</h2>
                    </div>
                    <div className="space-y-3 text-sm text-gray-600">
                        <p>
                            <strong>TakeEat לא מחזיקה כסף ולא מתערבת בסליקה</strong> - כל הכספים עוברים ישירות אליכם.
                        </p>
                        <p>
                            <strong>הסליקה על שם המסעדה בלבד</strong> - העסקאות מתבצעות דרך המסוף שלכם ב-HYP.
                        </p>
                        <p>
                            <strong>ניתן להתחיל במזומן ולהפעיל אשראי מתי שרוצים</strong> - אין חובה לחבר אשראי מיד.
                        </p>
                        <p>
                            <strong>אבטחה:</strong> פרטי המסוף מוצפנים ומאוחסנים בצורה מאובטחת. סיסמת המסוף לא נשמרת כטקסט גלוי ולא מוצגת בממשק.
                        </p>
                        <p>
                            <strong>אימות מסוף:</strong> לפני שתשלום אשראי יוצג ללקוחות, המסוף חייב לעבור תהליך אימות חד-פעמי.
                        </p>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}

function InfoBox({ label, value }) {
    return (
        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
            <p className="text-gray-400 text-xs font-bold mb-1">{label}</p>
            <p className="font-black text-gray-900 text-sm">{value}</p>
        </div>
    );
}
