import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCustomer } from '../context/CustomerContext';
import { requestPhoneCode, verifyPhoneCode } from '../services/phoneAuthService';
import apiClient from '../services/apiClient';
import { FaUser, FaTimes, FaSignOutAlt, FaEdit, FaRedo, FaPhone, FaArrowRight, FaClock, FaTruck, FaStore, FaCheck, FaMapMarkerAlt, FaPlus, FaTrash, FaStar, FaEnvelope, FaExclamationTriangle } from 'react-icons/fa';

/**
 * מודל פרופיל משתמש — התחברות, הרשמה, פרופיל והזמנות
 * רספונסיבי: bottom sheet במובייל, modal ממורכז בדסקטופ
 */
export default function UserProfileModal({ isOpen, onClose }) {
    const navigate = useNavigate();
    const {
        customer, customerToken, isRecognized,
        checkPhone, loginWithPhone, logout, updateProfile, closeUserModal,
    } = useCustomer();

    // State machine: phone-input → otp-verify → register → profile
    const [step, setStep] = useState('phone-input');
    const [phone, setPhone] = useState('');
    const [otpCode, setOtpCode] = useState('');
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
            const freshToken = localStorage.getItem('customer_token');
            fetchOrders(freshToken);
            fetchAddresses(freshToken);
        } else {
            setStep('phone-input');
            setPhone('');
            setFirstName('');
            setLastName('');
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
            <div className="relative bg-white dark:bg-brand-dark-surface rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-md max-h-[90vh] sm:max-h-[80vh] overflow-hidden animate-slide-up sm:animate-none z-10">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-brand-dark-border">
                    <h2 className="text-xl font-black text-gray-900 dark:text-brand-dark-text">
                        {step === 'phone-input' && 'התחברות / הרשמה'}
                        {step === 'otp-verify' && 'אימות קוד'}
                        {step === 'register' && 'השלמת הרשמה'}
                        {step === 'profile' && 'הפרופיל שלי'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition p-1">
                        <FaTimes size={20} />
                    </button>
                </div>

                {/* Content — scrollable */}
                <div className="overflow-y-auto max-h-[calc(90vh-80px)] sm:max-h-[calc(80vh-80px)] p-5 space-y-4">

                    {/* === שלב 1: הזנת טלפון === */}
                    {step === 'phone-input' && (
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

                    {/* === שלב 4: פרופיל === */}
                    {step === 'profile' && customer && (
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

                            {/* Edit mode */}
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

                            {/* סטטיסטיקה */}
                            {customer.total_orders > 0 && (
                                <div className="bg-brand-primary/5 dark:bg-brand-primary/10 rounded-xl p-3 flex items-center justify-between">
                                    <span className="text-sm text-gray-600 dark:text-brand-dark-muted">סה״כ הזמנות</span>
                                    <span className="font-bold text-brand-primary">{customer.total_orders}</span>
                                </div>
                            )}

                            {/* מיקומים שמורים */}
                            <div>
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

                            {/* הזמנות אחרונות */}
                            <div>
                                <h3 className="font-bold text-gray-900 dark:text-brand-dark-text mb-3">הזמנות אחרונות</h3>
                                {ordersLoading ? (
                                    <p className="text-sm text-gray-500 text-center py-4 animate-pulse">טוען...</p>
                                ) : orders.length === 0 ? (
                                    <p className="text-sm text-gray-400 text-center py-4">אין הזמנות עדיין</p>
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
                </div>
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
