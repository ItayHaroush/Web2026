import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCustomer } from '../context/CustomerContext';
import { requestPhoneCode, verifyPhoneCode } from '../services/phoneAuthService';
import apiClient, { getPublicTenantId } from '../services/apiClient';
import { pingCustomerPwa, registerCustomerPush, unregisterCustomerPush } from '../services/customerPwaApi';
import { fetchNotificationRestaurants, saveNotificationOptIns } from '../services/customerNotificationPrefsApi';
import {
    getStoredCustomerFcmToken,
    requestCustomerFcmToken,
    getCustomerFcmTokenIfPermitted,
    clearStoredCustomerFcmToken,
} from '../services/fcm';
import { FaTimes, FaSignOutAlt, FaEdit, FaRedo, FaPhone, FaArrowRight, FaClock, FaStore, FaCheck, FaMapMarkerAlt, FaPlus, FaTrash, FaStar, FaEnvelope, FaExclamationTriangle, FaLock, FaBell, FaHome, FaCog, FaShoppingBag, FaLightbulb } from 'react-icons/fa';

/**
 * מודל פרופיל משתמש — התחברות, הרשמה, פרופיל והזמנות
 * רספונסיבי: bottom sheet במובייל, modal ממורכז בדסקטופ
 */
export default function UserProfileModal({ isOpen, onClose }) {
    const navigate = useNavigate();
    const {
        customer, customerToken, isRecognized,
        checkPhone, loginWithPhone, loginWithPassword, setPassword, logout, updateProfile, closeUserModal,
    } = useCustomer();

    // State machine: phone-input → otp-verify → register → profile
    const [step, setStep] = useState('phone-input');
    const [phone, setPhone] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [passwordMode, setPasswordMode] = useState(false); // התחברות עם סיסמה במקום OTP
    const [passwordValue, setPasswordValue] = useState('');
    /** הגדרת סיסמה ראשונה (אין עדיין has_pin) */
    const [passwordOffer, setPasswordOffer] = useState('');
    const [passwordOfferConfirm, setPasswordOfferConfirm] = useState('');
    /** שינוי סיסמה (יש has_pin) */
    const [showChangePasswordForm, setShowChangePasswordForm] = useState(false);
    const [changeCurrentPassword, setChangeCurrentPassword] = useState('');
    const [changeNewPassword, setChangeNewPassword] = useState('');
    const [changeNewPasswordConfirm, setChangeNewPasswordConfirm] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [resendTimer, setResendTimer] = useState(0);

    // Profile edit
    const [editMode, setEditMode] = useState(false);
    const [editName, setEditName] = useState('');
    const [editEmail, setEditEmail] = useState('');

    // Orders
    const [orders, setOrders] = useState([]);
    const [ordersLoading, setOrdersLoading] = useState(false);
    const [reordering, setReordering] = useState(null);

    // Email verification
    const [emailVerifySending, setEmailVerifySending] = useState(false);
    const [emailVerifySent, setEmailVerifySent] = useState(false);

    // התראות Push (פרופיל)
    const [pushEnabled, setPushEnabled] = useState(false);
    const [pushToggleLoading, setPushToggleLoading] = useState(false);
    const [pushMessage, setPushMessage] = useState('');
    const [notificationRestaurants, setNotificationRestaurants] = useState([]);
    const [notifPrefsLoading, setNotifPrefsLoading] = useState(false);
    const [notifPrefsSaving, setNotifPrefsSaving] = useState(false);
    const pushSectionRef = useRef(null);
    const passwordSectionRef = useRef(null);
    const addressesSectionRef = useRef(null);

    /** טאבי פרופיל (רק אחרי התחברות) */
    const [profileTab, setProfileTab] = useState('home');

    // Addresses
    const [addresses, setAddresses] = useState([]);
    const [showAddressForm, setShowAddressForm] = useState(false);
    const [editingAddress, setEditingAddress] = useState(null);
    const [addressForm, setAddressForm] = useState({ label: 'בית', street: '', house_number: '', apartment: '', floor: '', entrance: '', city: '', notes: '' });

    const phoneInputRef = useRef(null);
    const otpInputRef = useRef(null);

    // כשנפתח — קבע שלב ראשוני
    useEffect(() => {
        if (!isOpen) return;
        setError('');
        setOtpCode('');
        setEditMode(false);
        setEmailVerifySent(false);
        if (isRecognized) {
            setStep('profile');
            setProfileTab('home');
            const freshToken = localStorage.getItem('customer_token');
            fetchOrders(freshToken);
            fetchAddresses(freshToken);
        } else {
            setStep('phone-input');
            setPhone('');
            setFirstName('');
            setLastName('');
            setPasswordMode(false);
            setPasswordValue('');
            setPasswordOffer('');
            setPasswordOfferConfirm('');
            setShowChangePasswordForm(false);
            setChangeCurrentPassword('');
            setChangeNewPassword('');
            setChangeNewPasswordConfirm('');
        }
    }, [isOpen, isRecognized]);

    // פוקוס אוטומטי על השדה הפעיל אחרי שהמודל נפתח (תמיכה במובייל)
    useEffect(() => {
        if (!isOpen) return;
        const timer = setTimeout(() => {
            const ref = step === 'otp-verify' ? otpInputRef : phoneInputRef;
            if (ref.current) {
                ref.current.focus();
                ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 350);
        return () => clearTimeout(timer);
    }, [isOpen, step]);

    // טיימר resend
    useEffect(() => {
        if (resendTimer <= 0) return;
        const t = setTimeout(() => setResendTimer(prev => prev - 1), 1000);
        return () => clearTimeout(t);
    }, [resendTimer]);

    const syncPushFromBrowser = useCallback(() => {
        try {
            const granted = typeof Notification !== 'undefined' && Notification.permission === 'granted';
            const hasTok = !!getStoredCustomerFcmToken();
            setPushEnabled(granted && hasTok);
        } catch {
            setPushEnabled(false);
        }
        setPushMessage('');
    }, []);

    useEffect(() => {
        if (!isOpen || !isRecognized || step !== 'profile') return;
        syncPushFromBrowser();
    }, [isOpen, isRecognized, step, syncPushFromBrowser]);

    const loadNotificationPrefs = useCallback(async () => {
        const tok = customerToken || localStorage.getItem('customer_token');
        if (!tok) return;
        setNotifPrefsLoading(true);
        try {
            const rows = await fetchNotificationRestaurants(apiClient, tok);
            setNotificationRestaurants(rows);
        } catch {
            setNotificationRestaurants([]);
        }
        setNotifPrefsLoading(false);
    }, [customerToken]);

    useEffect(() => {
        if (!isOpen || step !== 'profile' || !customer) return;
        loadNotificationPrefs();
    }, [isOpen, step, customer, loadNotificationPrefs]);

    const handleRestaurantNotifToggle = async (tenantId, enabled) => {
        const tok = customerToken || localStorage.getItem('customer_token');
        if (!tok) return;
        const next = notificationRestaurants.map((r) =>
            r.tenant_id === tenantId ? { ...r, enabled } : r
        );
        setNotificationRestaurants(next);
        setNotifPrefsSaving(true);
        setPushMessage('');
        try {
            await saveNotificationOptIns(
                apiClient,
                tok,
                next.map((r) => ({ tenant_id: r.tenant_id, enabled: r.enabled })),
                getPublicTenantId() || undefined
            );
        } catch (err) {
            setPushMessage(err?.response?.data?.message || 'שגיאה בשמירת העדפות מסעדות');
            loadNotificationPrefs();
        }
        setNotifPrefsSaving(false);
    };

    const handlePushToggle = useCallback(async (nextOn) => {
        setPushMessage('');
        const tok = customerToken || localStorage.getItem('customer_token');
        if (!tok) {
            setPushMessage('יש להתחבר כדי לשמור התראות');
            return;
        }
        if (nextOn && typeof Notification !== 'undefined' && Notification.permission === 'denied') {
            setPushMessage('הדפדפן חסם התראות — פתחו את הגדרות האתר (בצד הכתובת) ואפשרו התראות');
            return;
        }
        const tidHint = getPublicTenantId() || undefined;
        const standalone = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
        setPushToggleLoading(true);
        try {
            if (nextOn) {
                let token = getStoredCustomerFcmToken();
                if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
                    token = await requestCustomerFcmToken();
                } else if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                    token = token || (await getCustomerFcmTokenIfPermitted());
                }
                if (!token) {
                    setPushMessage('לא ניתן להפעיל כרגע — נסו דפדפן רגיל או התקנת אפליקציה (לא מתוך פייסבוק/אינסטגרם)');
                    setPushEnabled(false);
                    setPushToggleLoading(false);
                    return;
                }
                await registerCustomerPush(apiClient, { tenantId: tidHint, customerToken: tok, token });
                await pingCustomerPwa(apiClient, {
                    tenantId: tidHint,
                    standalone,
                    pushPermission: 'granted',
                    customerToken: tok,
                });
                setPushEnabled(true);
                loadNotificationPrefs();
            } else {
                const t = getStoredCustomerFcmToken();
                if (t) {
                    await unregisterCustomerPush(apiClient, { tenantId: tidHint, customerToken: tok, token: t });
                }
                clearStoredCustomerFcmToken();
                await pingCustomerPwa(apiClient, {
                    tenantId: tidHint,
                    standalone,
                    pushPermission: 'denied',
                    customerToken: tok,
                });
                setPushEnabled(false);
            }
        } catch (err) {
            setPushMessage(err?.response?.data?.message || 'שגיאה בעדכון ההתראות');
            syncPushFromBrowser();
        }
        setPushToggleLoading(false);
    }, [customerToken, syncPushFromBrowser, loadNotificationPrefs]);

    // טעינת הזמנות
    const fetchOrders = useCallback(async (tokenOverride) => {
        const token = tokenOverride || customerToken;
        if (!token) return;
        setOrdersLoading(true);
        try {
            const response = await apiClient.get('/customer/orders', {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.data?.success) {
                setOrders(response.data.data?.slice(0, 5) || []);
            }
        } catch { /* ignore */ }
        setOrdersLoading(false);
    }, [customerToken]);

    // טעינת כתובות
    const fetchAddresses = useCallback(async (tokenOverride) => {
        const token = tokenOverride || customerToken;
        if (!token) return;
        try {
            const response = await apiClient.get('/customer/addresses', {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.data?.success) {
                setAddresses(response.data.data || []);
            }
        } catch { /* ignore */ }
    }, [customerToken]);

    // שליחת OTP
    const handleSendOtp = async () => {
        const cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.length < 9) {
            setError('מספר טלפון לא תקין');
            return;
        }
        setError('');
        setLoading(true);
        try {
            await requestPhoneCode(phone);
            setStep('otp-verify');
            setResendTimer(60);
        } catch (err) {
            setError(err?.response?.data?.message || 'שגיאה בשליחת הקוד');
        }
        setLoading(false);
    };

    // אימות OTP
    const handleVerifyOtp = async () => {
        if (otpCode.length !== 6) {
            setError('יש להזין קוד בן 6 ספרות');
            return;
        }
        setError('');
        setLoading(true);
        try {
            const result = await verifyPhoneCode(phone, otpCode);
            if (result?.success) {
                // בדיקה אם לקוח קיים
                const check = await checkPhone(phone);
                if (check.exists) {
                    // לקוח חוזר — login ישיר
                    const loginResult = await loginWithPhone(phone);
                    if (loginResult.success) {
                        setStep('profile');
                        const freshToken = localStorage.getItem('customer_token');
                        fetchOrders(freshToken);
                        fetchAddresses(freshToken);
                    } else {
                        setError(loginResult.message || 'שגיאה בהתחברות');
                    }
                } else {
                    // לקוח חדש — מעבר להרשמה
                    setStep('register');
                }
            } else {
                setError(result?.message || 'קוד שגוי');
            }
        } catch (err) {
            setError(err?.response?.data?.message || 'שגיאה באימות');
        }
        setLoading(false);
    };

    // רישום לקוח חדש
    const handleRegister = async () => {
        if (firstName.trim().length < 2) {
            setError('שם פרטי חייב להכיל לפחות 2 תווים');
            return;
        }
        if (lastName.trim().length < 2) {
            setError('שם משפחה חייב להכיל לפחות 2 תווים');
            return;
        }
        setError('');
        setLoading(true);
        const fullName = `${firstName.trim()} ${lastName.trim()}`;
        const result = await loginWithPhone(phone, fullName);
        if (result.success) {
            setStep('profile');
            const freshToken = localStorage.getItem('customer_token');
            fetchOrders(freshToken);
            fetchAddresses(freshToken);
        } else {
            setError(result.message || 'שגיאה בהרשמה');
        }
        setLoading(false);
    };

    // התחברות עם סיסמה (ללא OTP)
    const handleLoginWithPassword = async () => {
        if (!passwordValue || passwordValue.length < 6) {
            setError('הסיסמה חייבת להכיל לפחות 6 תווים');
            return;
        }
        setError('');
        setLoading(true);
        const result = await loginWithPassword(phone, passwordValue);
        if (result.success) {
            setStep('profile');
            setPasswordMode(false);
            setPasswordValue('');
            const freshToken = localStorage.getItem('customer_token');
            fetchOrders(freshToken);
            fetchAddresses(freshToken);
        } else {
            setError(result.message || 'מספר טלפון או סיסמה שגויים');
        }
        setLoading(false);
    };

    // שמירת סיסמה מהצעה (אחרי התחברות)
    const handleSetPasswordFromOffer = async () => {
        if (!passwordOffer || passwordOffer.length < 6) {
            setError('הסיסמה חייבת להכיל לפחות 6 תווים');
            return;
        }
        if (passwordOffer !== passwordOfferConfirm) {
            setError('הסיסמאות לא תואמות');
            return;
        }
        setError('');
        setLoading(true);
        const result = await setPassword(passwordOffer, passwordOfferConfirm);
        setLoading(false);
        if (result.success) {
            setPasswordOffer('');
            setPasswordOfferConfirm('');
            setError('');
        } else {
            setError(result.message || 'שגיאה בשמירת סיסמה');
        }
    };

    const handleChangeExistingPassword = async () => {
        if (!changeNewPassword || changeNewPassword.length < 6) {
            setError('הסיסמה החדשה חייבת להכיל לפחות 6 תווים');
            return;
        }
        if (changeNewPassword !== changeNewPasswordConfirm) {
            setError('הסיסמאות החדשות לא תואמות');
            return;
        }
        if (!changeCurrentPassword || changeCurrentPassword.length < 1) {
            setError('נא להזין את הסיסמה הנוכחית');
            return;
        }
        setError('');
        setLoading(true);
        const result = await setPassword(changeNewPassword, changeNewPasswordConfirm, changeCurrentPassword);
        setLoading(false);
        if (result.success) {
            setShowChangePasswordForm(false);
            setChangeCurrentPassword('');
            setChangeNewPassword('');
            setChangeNewPasswordConfirm('');
            setError('');
        } else {
            setError(result.message || 'שגיאה בעדכון סיסמה');
        }
    };

    // שמירת פרופיל
    const handleSaveProfile = async () => {
        setLoading(true);
        setError('');
        const result = await updateProfile({
            name: editName.trim(),
            email: editEmail.trim() || null,
        });
        if (result.success) {
            setEditMode(false);
            if (result.email_verification_sent === false && result.message) {
                setError(result.message);
            }
        } else {
            setError(result.message || 'שגיאה בעדכון');
        }
        setLoading(false);
    };

    // שליחת מייל אימות מחדש
    const handleResendVerification = async () => {
        if (!customer?.email || emailVerifySending) return;
        setEmailVerifySending(true);
        try {
            await apiClient.post('/customer/email/verify-send', { email: customer.email }, {
                headers: { Authorization: `Bearer ${customerToken}` },
            });
            setEmailVerifySent(true);
        } catch (err) {
            setError(err?.response?.data?.message || 'שגיאה בשליחת מייל אימות');
        }
        setEmailVerifySending(false);
    };

    // שמירת/עדכון כתובת
    const handleSaveAddress = async () => {
        if (!addressForm.street.trim() || !addressForm.house_number.trim() || !addressForm.city.trim()) {
            setError('נא למלא רחוב, מספר בית ועיר');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const headers = { Authorization: `Bearer ${customerToken}` };
            if (editingAddress) {
                await apiClient.put(`/customer/addresses/${editingAddress}`, addressForm, { headers });
            } else {
                await apiClient.post('/customer/addresses', addressForm, { headers });
            }
            setShowAddressForm(false);
            setEditingAddress(null);
            setAddressForm({ label: 'בית', street: '', house_number: '', apartment: '', floor: '', entrance: '', city: '', notes: '' });
            fetchAddresses(customerToken || localStorage.getItem('customer_token'));
        } catch (err) {
            setError(err?.response?.data?.message || 'שגיאה בשמירת כתובת');
        }
        setLoading(false);
    };

    const handleDeleteAddress = async (id) => {
        try {
            await apiClient.delete(`/customer/addresses/${id}`, {
                headers: { Authorization: `Bearer ${customerToken}` },
            });
            fetchAddresses(customerToken);
        } catch { /* ignore */ }
    };

    const handleSetDefaultAddress = async (id) => {
        try {
            await apiClient.post(`/customer/addresses/${id}/default`, {}, {
                headers: { Authorization: `Bearer ${customerToken}` },
            });
            fetchAddresses(customerToken);
        } catch { /* ignore */ }
    };

    // הזמנה מחדש
    const handleReorder = async (orderId, restaurantTenantId) => {
        setReordering(orderId);
        try {
            const response = await apiClient.post(`/customer/reorder/${orderId}`, {}, {
                headers: { Authorization: `Bearer ${customerToken}` },
            });
            if (response.data?.success) {
                const { restaurant_tenant_id, items, unavailable } = response.data.data;
                localStorage.setItem('reorder_items', JSON.stringify(items));
                localStorage.setItem('reorder_tenant', restaurant_tenant_id);
                if (unavailable?.length > 0) {
                    localStorage.setItem('reorder_unavailable', JSON.stringify(unavailable));
                }
                onClose();
                navigate(`/${restaurant_tenant_id}/menu`);
            }
        } catch { /* ignore */ }
        setReordering(null);
    };

    // התנתקות
    const handleLogout = async () => {
        await logout();
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center p-0 sm:p-4" dir="rtl">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className={`relative bg-white dark:bg-brand-dark-surface rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-md overflow-hidden animate-slide-up sm:animate-none z-10 flex flex-col max-h-[90vh] sm:max-h-[80vh] ${step === 'profile' && customer ? 'pb-0' : ''}`}>
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-brand-dark-border shrink-0">
                    <h2 className="text-xl font-black text-gray-900 dark:text-brand-dark-text">
                        {step === 'phone-input' && 'התחברות / הרשמה'}
                        {step === 'otp-verify' && 'אימות קוד'}
                        {step === 'register' && 'השלמת הרשמה'}
                        {step === 'profile' && customer && profileTab === 'home' && 'הפרופיל שלי'}
                        {step === 'profile' && customer && profileTab === 'orders' && 'הזמנות שלי'}
                        {step === 'profile' && customer && profileTab === 'settings' && 'הגדרות'}
                        {step === 'profile' && !customer && 'הפרופיל שלי'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition p-1">
                        <FaTimes size={20} />
                    </button>
                </div>

                {/* Content — scrollable */}
                <div className="overflow-y-auto flex-1 min-h-0 p-5 space-y-4">

                    {/* === שלב 1: הזנת טלפון === */}
                    {step === 'phone-input' && (
                        <>
                            {!passwordMode ? (
                                <>
                                    <p className="text-sm text-gray-600 dark:text-brand-dark-muted">
                                        הזן מספר טלפון לקבלת קוד אימות
                                    </p>
                                    <p className="text-xs text-gray-400 dark:text-gray-500 -mt-2">
                                        משתמש חדש? ניצור לך חשבון אוטומטית
                                    </p>
                                    <input
                                        ref={phoneInputRef}
                                        type="tel"
                                        dir="ltr"
                                        inputMode="tel"
                                        placeholder="050-1234567"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        className="w-full text-center text-lg font-bold border-2 border-gray-200 dark:border-brand-dark-border rounded-xl px-4 py-3 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none transition dark:bg-brand-dark-bg dark:text-brand-dark-text"
                                        onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                                    />
                                    {error && <p className="text-sm text-red-600 text-center">{error}</p>}
                                    <button
                                        onClick={handleSendOtp}
                                        disabled={loading || phone.replace(/\D/g, '').length < 9}
                                        className="w-full bg-brand-primary text-white rounded-xl px-4 py-3 font-bold hover:bg-brand-secondary transition disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {loading ? (
                                            <span className="animate-pulse">שולח...</span>
                                        ) : (
                                            <>
                                                <FaPhone size={14} />
                                                <span>שלח קוד אימות</span>
                                            </>
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setPasswordMode(true); setError(''); }}
                                        className="w-full flex items-center justify-center gap-2 py-2 text-sm text-brand-primary font-bold hover:text-brand-secondary transition"
                                    >
                                        <FaLock size={12} />
                                        <span>התחבר עם סיסמה (ללא SMS)</span>
                                    </button>
                                </>
                            ) : (
                                <>
                                    <p className="text-sm text-gray-600 dark:text-brand-dark-muted">
                                        הזן טלפון וסיסמה לכניסה מהירה
                                    </p>
                                    <input
                                        ref={phoneInputRef}
                                        type="tel"
                                        dir="ltr"
                                        inputMode="tel"
                                        placeholder="050-1234567"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        className="w-full text-center text-lg font-bold border-2 border-gray-200 dark:border-brand-dark-border rounded-xl px-4 py-3 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none transition dark:bg-brand-dark-bg dark:text-brand-dark-text"
                                    />
                                    <input
                                        type="password"
                                        value={passwordValue}
                                        onChange={(e) => setPasswordValue(e.target.value)}
                                        placeholder="סיסמה"
                                        className="w-full text-center border-2 border-gray-200 dark:border-brand-dark-border rounded-xl px-4 py-3 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none transition dark:bg-brand-dark-bg dark:text-brand-dark-text"
                                        dir="ltr"
                                        onKeyDown={(e) => e.key === 'Enter' && handleLoginWithPassword()}
                                    />
                                    {error && <p className="text-sm text-red-600 text-center">{error}</p>}
                                    <button
                                        onClick={handleLoginWithPassword}
                                        disabled={loading || phone.replace(/\D/g, '').length < 9 || passwordValue.length < 6}
                                        className="w-full bg-brand-primary text-white rounded-xl px-4 py-3 font-bold hover:bg-brand-secondary transition disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {loading ? 'מתחבר...' : 'התחבר'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setPasswordMode(false); setPasswordValue(''); setError(''); }}
                                        className="w-full text-center text-sm text-gray-500 hover:text-gray-700 transition"
                                    >
                                        חזרה לקוד SMS
                                    </button>
                                </>
                            )}
                        </>
                    )}

                    {/* === שלב 2: אימות OTP === */}
                    {step === 'otp-verify' && (
                        <>
                            <p className="text-sm text-gray-600 dark:text-brand-dark-muted">
                                קוד אימות נשלח ל-<span className="font-bold" dir="ltr">{phone}</span>
                            </p>
                            <input
                                ref={otpInputRef}
                                type="tel"
                                dir="ltr"
                                inputMode="numeric"
                                maxLength={6}
                                placeholder="______"
                                value={otpCode}
                                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                className="w-full text-center text-2xl tracking-[0.5em] font-bold border-2 border-gray-200 dark:border-brand-dark-border rounded-xl px-4 py-3 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none transition dark:bg-brand-dark-bg dark:text-brand-dark-text"
                                onKeyDown={(e) => e.key === 'Enter' && handleVerifyOtp()}
                            />
                            {error && <p className="text-sm text-red-600 text-center">{error}</p>}
                            <button
                                onClick={handleVerifyOtp}
                                disabled={loading || otpCode.length !== 6}
                                className="w-full bg-brand-primary text-white rounded-xl px-4 py-3 font-bold hover:bg-brand-secondary transition disabled:opacity-50"
                            >
                                {loading ? <span className="animate-pulse">מאמת...</span> : 'אימות'}
                            </button>
                            <div className="flex items-center justify-between text-sm">
                                <button
                                    onClick={() => { setStep('phone-input'); setError(''); setOtpCode(''); }}
                                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition flex items-center gap-1"
                                >
                                    <FaArrowRight size={10} />
                                    <span>שנה מספר</span>
                                </button>
                                {resendTimer > 0 ? (
                                    <span className="text-gray-400">שלח שוב ({resendTimer})</span>
                                ) : (
                                    <button
                                        onClick={handleSendOtp}
                                        className="text-brand-primary hover:text-brand-secondary transition font-bold"
                                    >
                                        שלח שוב
                                    </button>
                                )}
                            </div>
                        </>
                    )}

                    {/* === שלב 3: הרשמה (לקוח חדש) === */}
                    {step === 'register' && (
                        <>
                            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3 flex items-center gap-2">
                                <FaCheck className="text-green-600" size={14} />
                                <span className="text-sm text-green-700 dark:text-green-400 font-medium">הטלפון אומת בהצלחה</span>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-brand-dark-muted">
                                נשמח להכיר אותך! מלא את הפרטים הבאים
                            </p>
                            <input
                                type="text"
                                placeholder="שם פרטי"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                className="w-full border-2 border-gray-200 dark:border-brand-dark-border rounded-xl px-4 py-3 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none transition dark:bg-brand-dark-bg dark:text-brand-dark-text"
                                autoFocus
                            />
                            <input
                                type="text"
                                placeholder="שם משפחה"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                className="w-full border-2 border-gray-200 dark:border-brand-dark-border rounded-xl px-4 py-3 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none transition dark:bg-brand-dark-bg dark:text-brand-dark-text"
                                onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
                            />
                            {error && <p className="text-sm text-red-600 text-center">{error}</p>}
                            <button
                                onClick={handleRegister}
                                disabled={loading || firstName.trim().length < 2 || lastName.trim().length < 2}
                                className="w-full bg-brand-primary text-white rounded-xl px-4 py-3 font-bold hover:bg-brand-secondary transition disabled:opacity-50"
                            >
                                {loading ? <span className="animate-pulse">נרשם...</span> : 'סיום הרשמה'}
                            </button>
                        </>
                    )}

                    {/* === שלב 4: פרופיל (טאבים: ראשי / הזמנות / הגדרות) === */}
                    {step === 'profile' && customer && (
                        <>
                            {profileTab === 'home' && (
                                <>
                                    {/* פרטי משתמש */}
                                    <div className="flex items-center gap-3">
                                        <div className="w-14 h-14 rounded-full bg-brand-primary/10 flex items-center justify-center flex-shrink-0">
                                            <span className="text-2xl font-bold text-brand-primary">
                                                {customer.name?.charAt(0)?.toUpperCase() || '?'}
                                            </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-lg text-gray-900 dark:text-brand-dark-text truncate">{customer.name}</p>
                                            <p className="text-sm text-gray-500 dark:text-brand-dark-muted" dir="ltr">{formatPhone(customer.phone)}</p>
                                            {customer.email && (
                                                <p className="text-sm text-gray-500 dark:text-brand-dark-muted truncate">{customer.email}</p>
                                            )}
                                        </div>
                                        {!editMode && (
                                            <button
                                                onClick={() => {
                                                    setEditMode(true);
                                                    setEditName(customer.name || '');
                                                    setEditEmail(customer.email || '');
                                                }}
                                                className="text-brand-primary hover:text-brand-secondary transition p-2"
                                                title="ערוך פרופיל"
                                            >
                                                <FaEdit size={16} />
                                            </button>
                                        )}
                                    </div>

                                    {editMode && (
                                        <div className="space-y-3 bg-gray-50 dark:bg-brand-dark-bg rounded-xl p-4">
                                            <input
                                                type="text"
                                                placeholder="שם מלא"
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                className="w-full border-2 border-gray-200 dark:border-brand-dark-border rounded-xl px-4 py-2 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none transition dark:bg-brand-dark-surface dark:text-brand-dark-text text-sm"
                                            />
                                            <input
                                                type="email"
                                                placeholder="אימייל (אופציונלי)"
                                                value={editEmail}
                                                onChange={(e) => setEditEmail(e.target.value)}
                                                className="w-full border-2 border-gray-200 dark:border-brand-dark-border rounded-xl px-4 py-2 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none transition dark:bg-brand-dark-surface dark:text-brand-dark-text text-sm"
                                                dir="ltr"
                                            />
                                            {error && <p className="text-sm text-red-600 text-center">{error}</p>}
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={handleSaveProfile}
                                                    disabled={loading || editName.trim().length < 2}
                                                    className="flex-1 bg-brand-primary text-white rounded-xl px-4 py-2 font-bold text-sm hover:bg-brand-secondary transition disabled:opacity-50"
                                                >
                                                    {loading ? 'שומר...' : 'שמור'}
                                                </button>
                                                <button
                                                    onClick={() => { setEditMode(false); setError(''); }}
                                                    className="flex-1 bg-gray-200 dark:bg-brand-dark-border text-gray-700 dark:text-brand-dark-text rounded-xl px-4 py-2 font-bold text-sm hover:bg-gray-300 dark:hover:bg-brand-dark-border/70 transition"
                                                >
                                                    ביטול
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {customer.total_orders > 0 && (
                                        <div className="bg-brand-primary/5 dark:bg-brand-primary/10 rounded-xl p-3 flex items-center justify-between">
                                            <span className="text-sm text-gray-600 dark:text-brand-dark-muted">סה״כ הזמנות</span>
                                            <span className="font-bold text-brand-primary">{customer.total_orders}</span>
                                        </div>
                                    )}

                                    {/* הצעות לייעול — תמיד במסך הראשי */}
                                    {!editMode && (
                                        <div className="bg-gradient-to-br from-amber-50 to-orange-50/90 dark:from-amber-900/25 dark:to-orange-950/35 border-2 border-amber-200/90 dark:border-amber-800/50 rounded-2xl p-4 space-y-3 shadow-sm">
                                            <div className="flex items-center gap-2">
                                                <FaLightbulb className="text-amber-600 dark:text-amber-400 shrink-0" size={18} />
                                                <p className="text-sm font-black text-gray-900 dark:text-brand-dark-text">הצעות לשיפור החוויה</p>
                                            </div>
                                            <p className="text-xs text-gray-600 dark:text-brand-dark-muted leading-relaxed">
                                                ריכזנו עבורך צעדים שיכולים לחסוך זמן, לייעל התראות ולהפוך הזמנה חוזרת לפשוטה יותר.
                                            </p>
                                            <ul className="space-y-3 text-sm text-gray-800 dark:text-brand-dark-text">
                                                {!pushEnabled && (
                                                    <li className="flex gap-3">
                                                        <FaBell className="text-orange-500 flex-shrink-0 mt-0.5" size={16} />
                                                        <div>
                                                            <p className="font-bold">הפעלת התראות דחיפה</p>
                                                            <p className="text-xs text-gray-600 dark:text-brand-dark-muted mt-0.5">
                                                                מבצעים וסטטוס הזמנה ישירות למכשיר —{' '}
                                                                <button
                                                                    type="button"
                                                                    className="text-orange-600 dark:text-orange-400 font-bold underline"
                                                                    onClick={() => {
                                                                        setProfileTab('settings');
                                                                        setTimeout(() => pushSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
                                                                    }}
                                                                >
                                                                    פתח בהגדרות
                                                                </button>
                                                            </p>
                                                        </div>
                                                    </li>
                                                )}
                                                {!customer.has_pin && (
                                                    <li className="flex gap-3">
                                                        <FaLock className="text-brand-primary flex-shrink-0 mt-0.5" size={16} />
                                                        <div>
                                                            <p className="font-bold">סיסמה לכניסה מהירה</p>
                                                            <p className="text-xs text-gray-600 dark:text-brand-dark-muted mt-0.5">
                                                                כניסה בלי להמתין ל־SMS —{' '}
                                                                <button
                                                                    type="button"
                                                                    className="text-brand-primary font-bold underline"
                                                                    onClick={() => {
                                                                        setProfileTab('settings');
                                                                        setTimeout(() => passwordSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
                                                                    }}
                                                                >
                                                                    הגדרות סיסמה
                                                                </button>
                                                            </p>
                                                        </div>
                                                    </li>
                                                )}
                                                {!customer.email && (
                                                    <li className="flex gap-3">
                                                        <FaEnvelope className="text-blue-500 flex-shrink-0 mt-0.5" size={16} />
                                                        <div>
                                                            <p className="font-bold">אימייל לקבלות וחשבוניות</p>
                                                            <p className="text-xs text-gray-600 dark:text-brand-dark-muted mt-0.5 mb-1">סיכומי הזמנה ומסמכים במייל</p>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setEditMode(true);
                                                                    setEditName(customer.name || '');
                                                                    setEditEmail('');
                                                                }}
                                                                className="text-xs font-bold text-blue-600 dark:text-blue-400 underline"
                                                            >
                                                                הוסף אימייל בפרופיל
                                                            </button>
                                                        </div>
                                                    </li>
                                                )}
                                                {addresses.length === 0 && (
                                                    <li className="flex gap-3">
                                                        <FaMapMarkerAlt className="text-emerald-600 flex-shrink-0 mt-0.5" size={16} />
                                                        <div>
                                                            <p className="font-bold">כתובת מועדפת למשלוח</p>
                                                            <p className="text-xs text-gray-600 dark:text-brand-dark-muted mt-0.5">
                                                                מילוי מהיר בקופה —{' '}
                                                                <button
                                                                    type="button"
                                                                    className="text-emerald-600 dark:text-emerald-400 font-bold underline"
                                                                    onClick={() => {
                                                                        setProfileTab('settings');
                                                                        setTimeout(() => addressesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
                                                                    }}
                                                                >
                                                                    הוסף כתובת
                                                                </button>
                                                            </p>
                                                        </div>
                                                    </li>
                                                )}
                                                <li className="flex gap-3 pt-1 border-t border-amber-200/60 dark:border-amber-800/40">
                                                    <FaShoppingBag className="text-brand-primary flex-shrink-0 mt-0.5" size={16} />
                                                    <div>
                                                        <p className="font-bold">הזמנה חוזרת מהר</p>
                                                        <p className="text-xs text-gray-600 dark:text-brand-dark-muted mt-0.5">
                                                            רשימת הזמנות אחרונות ו־״הזמן שוב״ בלחיצה —{' '}
                                                            <button type="button" className="text-brand-primary font-bold underline" onClick={() => setProfileTab('orders')}>
                                                                מעבר להזמנות
                                                            </button>
                                                        </p>
                                                    </div>
                                                </li>
                                                <li className="flex gap-3">
                                                    <FaCog className="text-gray-600 dark:text-gray-400 flex-shrink-0 mt-0.5" size={16} />
                                                    <div>
                                                        <p className="font-bold">סיסמה, התראות וכתובות</p>
                                                        <p className="text-xs text-gray-600 dark:text-brand-dark-muted mt-0.5">
                                                            כל האפשרויות במקום אחד —{' '}
                                                            <button type="button" className="font-bold text-gray-800 dark:text-brand-dark-text underline" onClick={() => setProfileTab('settings')}>
                                                                הגדרות
                                                            </button>
                                                        </p>
                                                    </div>
                                                </li>
                                            </ul>
                                        </div>
                                    )}
                                </>
                            )}

                            {profileTab === 'orders' && (
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-brand-dark-muted mb-3">
                                        כאן מופיעות עד 5 ההזמנות האחרונות. בחרו ״הזמן שוב״ כדי למלא את העגלה כמו בהזמנה הקודמת.
                                    </p>
                                    <h3 className="font-bold text-gray-900 dark:text-brand-dark-text mb-3 sr-only">הזמנות אחרונות</h3>
                                    {ordersLoading ? (
                                        <p className="text-sm text-gray-500 text-center py-4 animate-pulse">טוען...</p>
                                    ) : orders.length === 0 ? (
                                        <p className="text-sm text-gray-400 text-center py-8">אין הזמנות עדיין — לאחר הזמנה ראשונה תראו אותה כאן</p>
                                    ) : (
                                        <div className="space-y-3">
                                            {orders.map((order) => (
                                                <div key={order.id} className="bg-gray-50 dark:bg-brand-dark-bg rounded-xl p-3 space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            {order.restaurant_logo_url ? (
                                                                <img src={order.restaurant_logo_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
                                                            ) : (
                                                                <div className="w-8 h-8 rounded-lg bg-brand-primary/10 flex items-center justify-center">
                                                                    <FaStore className="text-brand-primary" size={12} />
                                                                </div>
                                                            )}
                                                            <div>
                                                                <p className="font-bold text-sm text-gray-900 dark:text-brand-dark-text">{order.restaurant_name}</p>
                                                                <p className="text-xs text-gray-400 flex items-center gap-1">
                                                                    <FaClock size={9} />
                                                                    {new Date(order.created_at).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <p className="font-bold text-sm text-gray-900 dark:text-brand-dark-text">₪{Number(order.total_amount).toFixed(2)}</p>
                                                    </div>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                                        {order.items?.slice(0, 3).map((item, i) => (
                                                            <span key={i}>
                                                                {item.name} ×{item.quantity}
                                                                {i < Math.min(order.items.length, 3) - 1 && ' · '}
                                                            </span>
                                                        ))}
                                                        {order.items?.length > 3 && <span> +{order.items.length - 3}</span>}
                                                    </div>
                                                    <button
                                                        onClick={() => handleReorder(order.id, order.restaurant_tenant_id)}
                                                        disabled={reordering === order.id}
                                                        className="w-full flex items-center justify-center gap-1.5 bg-brand-primary/10 text-brand-primary rounded-lg px-3 py-2 font-bold text-xs hover:bg-brand-primary/20 transition disabled:opacity-50"
                                                    >
                                                        <FaRedo size={10} className={reordering === order.id ? 'animate-spin' : ''} />
                                                        <span>{reordering === order.id ? 'מכין...' : 'הזמן שוב'}</span>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {profileTab === 'settings' && (
                                <>
                            {/* סיסמה לכניסה */}
                            {!editMode && (
                                <div
                                    ref={passwordSectionRef}
                                    id="customer-password-settings"
                                    className="rounded-xl border-2 border-gray-200 dark:border-brand-dark-border bg-gray-50/80 dark:bg-brand-dark-bg p-4 space-y-3"
                                >
                                    <div className="flex items-center gap-2">
                                        <FaLock className="text-brand-primary shrink-0" size={16} />
                                        <h3 className="font-bold text-gray-900 dark:text-brand-dark-text text-sm">סיסמה לכניסה מהירה</h3>
                                    </div>
                                    {!customer.has_pin ? (
                                        <>
                                            <p className="text-xs text-gray-600 dark:text-brand-dark-muted">
                                                עדיין לא הוגדרה סיסמה. אפשר להיכנס רק עם קוד SMS. הגדרת סיסמה מאפשרת <strong>התחברות עם טלפון + סיסמה</strong> בלי לחכות לקוד.
                                            </p>
                                            <div className="space-y-2">
                                                <input
                                                    type="password"
                                                    value={passwordOffer}
                                                    onChange={(e) => { setPasswordOffer(e.target.value); setError(''); }}
                                                    placeholder="סיסמה חדשה (לפחות 6 תווים)"
                                                    className="w-full border-2 border-gray-200 dark:border-brand-dark-border rounded-lg px-3 py-2.5 focus:border-brand-primary outline-none dark:bg-brand-dark-surface dark:text-brand-dark-text text-sm"
                                                    dir="ltr"
                                                />
                                                <input
                                                    type="password"
                                                    value={passwordOfferConfirm}
                                                    onChange={(e) => { setPasswordOfferConfirm(e.target.value); setError(''); }}
                                                    placeholder="אימות סיסמה"
                                                    className="w-full border-2 border-gray-200 dark:border-brand-dark-border rounded-lg px-3 py-2.5 focus:border-brand-primary outline-none dark:bg-brand-dark-surface dark:text-brand-dark-text text-sm"
                                                    dir="ltr"
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleSetPasswordFromOffer}
                                                disabled={loading || passwordOffer.length < 6 || passwordOffer !== passwordOfferConfirm}
                                                className="w-full bg-brand-primary text-white rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-brand-secondary transition disabled:opacity-50"
                                            >
                                                {loading ? 'שומר...' : 'שמור סיסמה'}
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <p className="text-xs text-gray-600 dark:text-brand-dark-muted">
                                                כבר קיימת סיסמה — ניתן להתחבר מהמסך הראשי ב־״התחבר עם סיסמה (ללא SMS)״.
                                            </p>
                                            {!showChangePasswordForm ? (
                                                <button
                                                    type="button"
                                                    onClick={() => { setShowChangePasswordForm(true); setError(''); }}
                                                    className="w-full py-2.5 rounded-xl border-2 border-brand-primary/40 text-brand-primary font-bold text-sm hover:bg-orange-50 dark:hover:bg-orange-900/15 transition"
                                                >
                                                    שנה סיסמה
                                                </button>
                                            ) : (
                                                <div className="space-y-2 pt-1">
                                                    <input
                                                        type="password"
                                                        value={changeCurrentPassword}
                                                        onChange={(e) => { setChangeCurrentPassword(e.target.value); setError(''); }}
                                                        placeholder="סיסמה נוכחית"
                                                        className="w-full border-2 border-gray-200 dark:border-brand-dark-border rounded-lg px-3 py-2.5 focus:border-brand-primary outline-none dark:bg-brand-dark-surface dark:text-brand-dark-text text-sm"
                                                        dir="ltr"
                                                        autoComplete="current-password"
                                                    />
                                                    <input
                                                        type="password"
                                                        value={changeNewPassword}
                                                        onChange={(e) => { setChangeNewPassword(e.target.value); setError(''); }}
                                                        placeholder="סיסמה חדשה (לפחות 6 תווים)"
                                                        className="w-full border-2 border-gray-200 dark:border-brand-dark-border rounded-lg px-3 py-2.5 focus:border-brand-primary outline-none dark:bg-brand-dark-surface dark:text-brand-dark-text text-sm"
                                                        dir="ltr"
                                                        autoComplete="new-password"
                                                    />
                                                    <input
                                                        type="password"
                                                        value={changeNewPasswordConfirm}
                                                        onChange={(e) => { setChangeNewPasswordConfirm(e.target.value); setError(''); }}
                                                        placeholder="אימות סיסמה חדשה"
                                                        className="w-full border-2 border-gray-200 dark:border-brand-dark-border rounded-lg px-3 py-2.5 focus:border-brand-primary outline-none dark:bg-brand-dark-surface dark:text-brand-dark-text text-sm"
                                                        dir="ltr"
                                                        autoComplete="new-password"
                                                    />
                                                    <div className="flex gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={handleChangeExistingPassword}
                                                            disabled={
                                                                loading ||
                                                                changeNewPassword.length < 6 ||
                                                                changeNewPassword !== changeNewPasswordConfirm ||
                                                                !changeCurrentPassword
                                                            }
                                                            className="flex-1 bg-brand-primary text-white rounded-xl px-3 py-2.5 text-sm font-bold hover:bg-brand-secondary transition disabled:opacity-50"
                                                        >
                                                            {loading ? 'שומר...' : 'עדכן סיסמה'}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setShowChangePasswordForm(false);
                                                                setChangeCurrentPassword('');
                                                                setChangeNewPassword('');
                                                                setChangeNewPasswordConfirm('');
                                                                setError('');
                                                            }}
                                                            className="px-4 py-2.5 rounded-xl border-2 border-gray-300 dark:border-brand-dark-border text-sm font-bold text-gray-700 dark:text-gray-300"
                                                        >
                                                            ביטול
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}

                            {/* אימות מייל */}
                            {customer.email && !customer.email_verified && !editMode && (
                                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-3 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <FaExclamationTriangle className="text-amber-500 flex-shrink-0" size={14} />
                                        <p className="text-sm text-amber-800 dark:text-amber-300 font-medium">
                                            המייל <span className="font-bold" dir="ltr">{customer.email}</span> טרם אומת
                                        </p>
                                    </div>
                                    <p className="text-xs text-amber-600 dark:text-amber-400">
                                        אמת את המייל כדי לקבל קבלות הזמנה וסיכומים
                                    </p>
                                    {emailVerifySent ? (
                                        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                                            <FaCheck size={12} />
                                            <span className="text-xs font-bold">מייל אימות נשלח! בדוק את תיבת הדואר</span>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={handleResendVerification}
                                            disabled={emailVerifySending}
                                            className="w-full flex items-center justify-center gap-2 bg-amber-500 text-white rounded-lg px-3 py-2 text-xs font-bold hover:bg-amber-600 transition disabled:opacity-50"
                                        >
                                            <FaEnvelope size={12} />
                                            <span>{emailVerifySending ? 'שולח...' : 'שלח מייל אימות'}</span>
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* התראות Push — מתג + בחירת מסעדות אחרי הפעלה */}
                            {(() => {
                                const ua = typeof navigator !== 'undefined' ? (navigator.userAgent || '') : '';
                                const inFb = /FBAN|FBAV|Instagram/i.test(ua);
                                const pushOk = typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && !inFb;
                                return (
                                    <div
                                        ref={pushSectionRef}
                                        id="customer-push-settings"
                                        className="rounded-xl border-2 border-gray-100 dark:border-brand-dark-border bg-gray-50/80 dark:bg-brand-dark-bg p-4 space-y-3"
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <FaBell className="text-orange-500" size={16} />
                                            <h3 className="font-bold text-gray-900 dark:text-brand-dark-text text-sm">התראות דחיפה (Push)</h3>
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-brand-dark-muted">
                                            {pushEnabled
                                                ? 'בחרו מאיזו מסעדה מותר לשלוח אליכם עדכונים (לפי היסטוריית הזמנות).'
                                                : 'אחרי ההפעלה תוכלו לסמן מסעדות ספציפיות. כיבוי מוחק את הרישום מהמערכת.'}
                                        </p>
                                        {!pushOk ? (
                                            <p className="text-xs text-amber-700 dark:text-amber-400">
                                                התראות אינן זמינות בדפדפן זה. נסו Chrome/Safari או התקנת אפליקציה — לא מתוך פייסבוק/אינסטגרם.
                                            </p>
                                        ) : (
                                            <div className="flex items-center justify-between gap-3 pt-1" dir="ltr">
                                                <span className="text-sm font-bold text-gray-700 dark:text-brand-dark-text rtl:text-right" dir="rtl">
                                                    {pushEnabled ? 'מופעל' : 'כבוי'}
                                                </span>
                                                <button
                                                    type="button"
                                                    role="switch"
                                                    aria-checked={pushEnabled}
                                                    disabled={pushToggleLoading}
                                                    onClick={() => handlePushToggle(!pushEnabled)}
                                                    className={`relative w-14 h-8 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:opacity-45 ${pushEnabled ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                                                >
                                                    <span
                                                        className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-all ${pushEnabled ? 'left-7' : 'left-1'}`}
                                                    />
                                                </button>
                                            </div>
                                        )}
                                        {pushMessage && (
                                            <p className="text-xs text-red-600 dark:text-red-400 font-medium">{pushMessage}</p>
                                        )}
                                        {typeof Notification !== 'undefined' && Notification.permission === 'denied' && (
                                            <p className="text-xs text-amber-700 dark:text-amber-400">
                                                ההרשאה נחסמה בדפדפן. יש לפתוח את הגדרות האתר ולאפשר התראות, ואז להפעיל את המתג שוב.
                                            </p>
                                        )}

                                        {pushEnabled && pushOk && (
                                            <div className="mt-2 pt-3 border-t border-gray-200 dark:border-brand-dark-border space-y-2">
                                                <p className="text-xs font-black text-gray-600 dark:text-brand-dark-muted uppercase tracking-wide">מסעדות מורשות לשלוח התראות</p>
                                                {notifPrefsLoading && (
                                                    <p className="text-xs text-gray-500">טוען רשימה…</p>
                                                )}
                                                {!notifPrefsLoading && notificationRestaurants.length === 0 && (
                                                    <p className="text-xs text-gray-500 dark:text-brand-dark-muted">
                                                        אין עדיין מסעדות מהיסטוריה. לאחר הזמנה ראשונה תוכלו לאשר כאן מי רשאי לעדכן אתכם.
                                                    </p>
                                                )}
                                                {notificationRestaurants.map((r) => (
                                                    <div
                                                        key={r.tenant_id}
                                                        className="flex items-center justify-between gap-2 py-1.5 border-b border-gray-100 dark:border-brand-dark-border last:border-0"
                                                    >
                                                        <span className="text-sm font-medium text-gray-800 dark:text-brand-dark-text truncate">{r.name}</span>
                                                        <button
                                                            type="button"
                                                            disabled={notifPrefsSaving}
                                                            onClick={() => handleRestaurantNotifToggle(r.tenant_id, !r.enabled)}
                                                            className={`relative w-12 h-7 rounded-full flex-shrink-0 transition-colors disabled:opacity-45 ${r.enabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                                                            dir="ltr"
                                                        >
                                                            <span
                                                                className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${r.enabled ? 'left-6' : 'left-1'}`}
                                                            />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}

                            {/* מיקומים שמורים */}
                            <div ref={addressesSectionRef} id="customer-addresses-settings">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="font-bold text-gray-900 dark:text-brand-dark-text flex items-center gap-2">
                                        <FaMapMarkerAlt className="text-brand-primary" size={14} />
                                        מיקומים שמורים
                                    </h3>
                                    {!showAddressForm && (
                                        <button
                                            onClick={() => {
                                                setShowAddressForm(true);
                                                setEditingAddress(null);
                                                setAddressForm({ label: 'בית', street: '', house_number: '', apartment: '', floor: '', entrance: '', city: '', notes: '' });
                                                setError('');
                                            }}
                                            className="text-brand-primary hover:text-brand-secondary transition text-xs font-bold flex items-center gap-1"
                                        >
                                            <FaPlus size={10} />
                                            הוסף
                                        </button>
                                    )}
                                </div>

                                {/* טופס כתובת */}
                                {showAddressForm && (
                                    <div className="space-y-2 bg-gray-50 dark:bg-brand-dark-bg rounded-xl p-3 mb-3">
                                        <div className="flex gap-2">
                                            {['בית', 'עבודה', 'אחר'].map(lbl => (
                                                <button
                                                    key={lbl}
                                                    onClick={() => setAddressForm(p => ({ ...p, label: lbl }))}
                                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${addressForm.label === lbl ? 'bg-brand-primary text-white' : 'bg-gray-200 dark:bg-brand-dark-border text-gray-600 dark:text-gray-400'}`}
                                                >
                                                    {lbl}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <input placeholder="רחוב *" value={addressForm.street} onChange={e => setAddressForm(p => ({ ...p, street: e.target.value }))} className="col-span-2 border border-gray-200 dark:border-brand-dark-border rounded-lg px-3 py-2 text-sm focus:border-brand-primary outline-none dark:bg-brand-dark-surface dark:text-brand-dark-text" />
                                            <input placeholder="מספר בית *" value={addressForm.house_number} onChange={e => setAddressForm(p => ({ ...p, house_number: e.target.value }))} className="border border-gray-200 dark:border-brand-dark-border rounded-lg px-3 py-2 text-sm focus:border-brand-primary outline-none dark:bg-brand-dark-surface dark:text-brand-dark-text" />
                                            <input placeholder="עיר *" value={addressForm.city} onChange={e => setAddressForm(p => ({ ...p, city: e.target.value }))} className="border border-gray-200 dark:border-brand-dark-border rounded-lg px-3 py-2 text-sm focus:border-brand-primary outline-none dark:bg-brand-dark-surface dark:text-brand-dark-text" />
                                            <input placeholder="דירה" value={addressForm.apartment} onChange={e => setAddressForm(p => ({ ...p, apartment: e.target.value }))} className="border border-gray-200 dark:border-brand-dark-border rounded-lg px-3 py-2 text-sm focus:border-brand-primary outline-none dark:bg-brand-dark-surface dark:text-brand-dark-text" />
                                            <input placeholder="קומה" value={addressForm.floor} onChange={e => setAddressForm(p => ({ ...p, floor: e.target.value }))} className="border border-gray-200 dark:border-brand-dark-border rounded-lg px-3 py-2 text-sm focus:border-brand-primary outline-none dark:bg-brand-dark-surface dark:text-brand-dark-text" />
                                            <input placeholder="כניסה" value={addressForm.entrance} onChange={e => setAddressForm(p => ({ ...p, entrance: e.target.value }))} className="border border-gray-200 dark:border-brand-dark-border rounded-lg px-3 py-2 text-sm focus:border-brand-primary outline-none dark:bg-brand-dark-surface dark:text-brand-dark-text" />
                                            <input placeholder="הערות למשלוח" value={addressForm.notes} onChange={e => setAddressForm(p => ({ ...p, notes: e.target.value }))} className="border border-gray-200 dark:border-brand-dark-border rounded-lg px-3 py-2 text-sm focus:border-brand-primary outline-none dark:bg-brand-dark-surface dark:text-brand-dark-text" />
                                        </div>
                                        {error && <p className="text-xs text-red-600 text-center">{error}</p>}
                                        <div className="flex gap-2">
                                            <button onClick={handleSaveAddress} disabled={loading} className="flex-1 bg-brand-primary text-white rounded-lg px-3 py-2 text-xs font-bold hover:bg-brand-secondary transition disabled:opacity-50">
                                                {loading ? 'שומר...' : (editingAddress ? 'עדכן' : 'שמור')}
                                            </button>
                                            <button onClick={() => { setShowAddressForm(false); setError(''); }} className="flex-1 bg-gray-200 dark:bg-brand-dark-border text-gray-600 dark:text-gray-400 rounded-lg px-3 py-2 text-xs font-bold transition">
                                                ביטול
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* רשימת כתובות */}
                                {addresses.length === 0 && !showAddressForm ? (
                                    <p className="text-sm text-gray-400 text-center py-3">אין מיקומים שמורים</p>
                                ) : (
                                    <div className="space-y-2">
                                        {addresses.map(addr => (
                                            <div key={addr.id} className="bg-gray-50 dark:bg-brand-dark-bg rounded-xl p-3 flex items-start gap-3">
                                                <FaMapMarkerAlt className={`mt-1 flex-shrink-0 ${addr.is_default ? 'text-brand-primary' : 'text-gray-400'}`} size={14} />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-sm text-gray-900 dark:text-brand-dark-text">{addr.label}</span>
                                                        {addr.is_default && <FaStar className="text-brand-accent" size={10} />}
                                                    </div>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                                        {addr.street} {addr.house_number}{addr.apartment ? `, דירה ${addr.apartment}` : ''}, {addr.city}
                                                    </p>
                                                    {addr.floor && <span className="text-xs text-gray-400">קומה {addr.floor}</span>}
                                                </div>
                                                <div className="flex items-center gap-1 flex-shrink-0">
                                                    {!addr.is_default && (
                                                        <button onClick={() => handleSetDefaultAddress(addr.id)} className="p-1.5 text-gray-400 hover:text-brand-primary transition" title="הגדר כברירת מחדל">
                                                            <FaStar size={12} />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => {
                                                            setEditingAddress(addr.id);
                                                            setAddressForm({ label: addr.label, street: addr.street, house_number: addr.house_number, apartment: addr.apartment || '', floor: addr.floor || '', entrance: addr.entrance || '', city: addr.city, notes: addr.notes || '' });
                                                            setShowAddressForm(true);
                                                            setError('');
                                                        }}
                                                        className="p-1.5 text-gray-400 hover:text-brand-primary transition"
                                                        title="ערוך"
                                                    >
                                                        <FaEdit size={12} />
                                                    </button>
                                                    <button onClick={() => handleDeleteAddress(addr.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition" title="מחק">
                                                        <FaTrash size={11} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* התנתקות */}
                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center justify-center gap-2 text-red-500 hover:text-red-600 transition py-3 font-bold text-sm border-t border-gray-100 dark:border-brand-dark-border mt-2"
                            >
                                <FaSignOutAlt size={14} />
                                <span>התנתקות</span>
                            </button>
                                </>
                            )}

                        </>
                    )}
                </div>

                {/* ניווט תחתון — פרופיל מחובר */}
                {step === 'profile' && customer && (
                    <nav
                        className="shrink-0 flex items-stretch justify-around gap-1 border-t border-gray-100 dark:border-brand-dark-border bg-white/95 dark:bg-brand-dark-surface/95 backdrop-blur-sm px-2 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] z-10"
                        aria-label="ניווט פרופיל"
                    >
                        <button
                            type="button"
                            onClick={() => setProfileTab('home')}
                            className={`flex flex-1 flex-col items-center gap-0.5 py-2 rounded-xl text-[10px] font-bold transition ${profileTab === 'home' ? 'text-brand-primary bg-brand-primary/10' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-brand-dark-bg'}`}
                        >
                            <FaHome size={20} className={profileTab === 'home' ? 'text-brand-primary' : ''} aria-hidden />
                            <span>ראשי</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setProfileTab('orders')}
                            className={`flex flex-1 flex-col items-center gap-0.5 py-2 rounded-xl text-[10px] font-bold transition ${profileTab === 'orders' ? 'text-brand-primary bg-brand-primary/10' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-brand-dark-bg'}`}
                        >
                            <FaShoppingBag size={20} className={profileTab === 'orders' ? 'text-brand-primary' : ''} aria-hidden />
                            <span>הזמנות</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setProfileTab('settings')}
                            className={`flex flex-1 flex-col items-center gap-0.5 py-2 rounded-xl text-[10px] font-bold transition ${profileTab === 'settings' ? 'text-brand-primary bg-brand-primary/10' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-brand-dark-bg'}`}
                        >
                            <FaCog size={20} className={profileTab === 'settings' ? 'text-brand-primary' : ''} aria-hidden />
                            <span>הגדרות</span>
                        </button>
                    </nav>
                )}
            </div>
        </div>
    );
}

/**
 * פורמט מספר טלפון
 */
function formatPhone(phone) {
    if (!phone) return '';
    let cleaned = phone.replace(/\+972/, '0').replace(/\D/g, '');
    if (cleaned.length === 10) {
        return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
}
