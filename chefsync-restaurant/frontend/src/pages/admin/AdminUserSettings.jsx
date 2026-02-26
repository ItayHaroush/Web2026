import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import { useAdminAuth } from '../../context/AdminAuthContext';
import api from '../../services/apiClient';
import { FaUser, FaLock, FaSave, FaCreditCard, FaCrown, FaClock, FaCheckCircle } from 'react-icons/fa';

const STATUS_LABELS = { trial: 'תקופת ניסיון', active: 'פעיל', suspended: 'מושהה', expired: 'פג תוקף', cancelled: 'מבוטל' };
const STATUS_COLORS = { trial: 'bg-blue-100 text-blue-700', active: 'bg-green-100 text-green-700', suspended: 'bg-red-100 text-red-700', expired: 'bg-gray-100 text-gray-600', cancelled: 'bg-gray-100 text-gray-600' };
const PLAN_LABELS = { monthly: 'חודשי', yearly: 'שנתי' };

export default function AdminUserSettings() {
    const navigate = useNavigate();
    const { user, getAuthHeaders, refreshUser, isOwner } = useAdminAuth();
    const [restaurant, setRestaurant] = useState(null);
    const [profile, setProfile] = useState({
        name: user?.name ?? '',
        email: user?.email ?? '',
        phone: user?.phone ?? '',
    });
    const [password, setPassword] = useState({
        current_password: '',
        new_password: '',
        new_password_confirmation: '',
    });
    const [posSettings, setPosSettings] = useState({
        hourly_rate: '',
        pos_pin: '',
    });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        if (user) {
            setProfile({
                name: user.name ?? '',
                email: user.email ?? '',
                phone: user.phone ?? '',
            });
            setPosSettings(prev => ({
                ...prev,
                hourly_rate: user.hourly_rate ?? '',
            }));
        }
    }, [user]);

    useEffect(() => {
        const fetchRestaurant = async () => {
            try {
                const res = await api.get('/admin/restaurant', { headers: getAuthHeaders() });
                if (res.data.success) setRestaurant(res.data.restaurant);
            } catch (err) {
                console.error('Failed to fetch restaurant:', err);
            }
        };
        if (isOwner()) fetchRestaurant();
    }, []);

    const handleProfileChange = (e) => {
        const { name, value } = e.target;
        setProfile((p) => ({ ...p, [name]: value }));
    };

    const handlePasswordChange = (e) => {
        const { name, value } = e.target;
        setPassword((p) => ({ ...p, [name]: value }));
    };

    const saveProfile = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ type: '', text: '' });
        try {
            const payload = { name: profile.name, email: profile.email, phone: profile.phone || null };
            const res = await api.put('/auth/update', payload, { headers: getAuthHeaders() });
            if (res.data.success) {
                await refreshUser();
                setMessage({ type: 'success', text: 'הפרטים עודכנו בהצלחה' });
            }
        } catch (err) {
            const msg = err.response?.data?.message || (err.response?.data?.errors
                ? Object.values(err.response.data.errors || {}).flat().join(' ')
                : 'שגיאה בעדכון');
            setMessage({ type: 'error', text: msg });
        } finally {
            setLoading(false);
        }
    };

    const savePassword = async (e) => {
        e.preventDefault();
        if (password.new_password !== password.new_password_confirmation) {
            setMessage({ type: 'error', text: 'הסיסמאות אינן תואמות' });
            return;
        }
        setLoading(true);
        setMessage({ type: '', text: '' });
        try {
            const res = await api.put('/auth/update', {
                current_password: password.current_password,
                new_password: password.new_password,
                new_password_confirmation: password.new_password_confirmation,
            }, { headers: getAuthHeaders() });
            if (res.data.success) {
                setPassword({ current_password: '', new_password: '', new_password_confirmation: '' });
                setMessage({ type: 'success', text: 'הסיסמה שונתה בהצלחה' });
            }
        } catch (err) {
            const msg = err.response?.data?.message || (err.response?.data?.errors
                ? Object.values(err.response.data.errors || {}).flat().join(' ')
                : 'שגיאה בעדכון סיסמה');
            setMessage({ type: 'error', text: msg });
        } finally {
            setLoading(false);
        }
    };

    if (!user) return null;

    return (
        <AdminLayout>
            <div className="max-w-xl mx-auto px-4 py-6">
                <h1 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-2">
                    <div className="p-2 bg-brand-primary/10 rounded-lg">
                        <FaUser className="text-brand-primary" size={20} />
                    </div>
                    הגדרות משתמש
                </h1>

                {message.text && (
                    <div className={`mb-6 p-4 rounded-xl ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                        {message.text}
                    </div>
                )}

                {/* כרטיס פרטים */}
                <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm mb-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-4">כרטיס פרטים</h2>
                    <form onSubmit={saveProfile} className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">שם</label>
                            <input
                                type="text"
                                name="name"
                                value={profile.name}
                                onChange={handleProfileChange}
                                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">אימייל</label>
                            <input
                                type="email"
                                name="email"
                                value={profile.email}
                                onChange={handleProfileChange}
                                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">טלפון</label>
                            <input
                                type="tel"
                                name="phone"
                                value={profile.phone}
                                onChange={handleProfileChange}
                                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex items-center gap-2 px-5 py-2.5 bg-brand-primary text-white rounded-xl font-bold hover:opacity-90 disabled:opacity-50"
                        >
                            <FaSave size={14} />
                            שמור פרטים
                        </button>
                    </form>
                </div>

                {/* כרטיס אבטחה */}
                <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm mb-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <FaLock size={18} />
                        שינוי סיסמה
                    </h2>
                    <form onSubmit={savePassword} className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">סיסמה נוכחית</label>
                            <input
                                type="password"
                                name="current_password"
                                value={password.current_password}
                                onChange={handlePasswordChange}
                                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">סיסמה חדשה</label>
                            <input
                                type="password"
                                name="new_password"
                                value={password.new_password}
                                onChange={handlePasswordChange}
                                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">אימות סיסמה חדשה</label>
                            <input
                                type="password"
                                name="new_password_confirmation"
                                value={password.new_password_confirmation}
                                onChange={handlePasswordChange}
                                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex items-center gap-2 px-5 py-2.5 bg-gray-800 text-white rounded-xl font-bold hover:bg-gray-700 disabled:opacity-50"
                        >
                            <FaLock size={14} />
                            שנה סיסמה
                        </button>
                    </form>
                </div>

                {/* שעון נוכחות + קופה */}
                <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm mb-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <FaClock size={18} className="text-amber-500" />
                        שעון נוכחות וקופה
                    </h2>
                    <form
                        onSubmit={async (e) => {
                            e.preventDefault();
                            setLoading(true);
                            setMessage({ type: '', text: '' });
                            try {
                                const payload = {};
                                if (posSettings.hourly_rate !== '' && posSettings.hourly_rate !== null) {
                                    payload.hourly_rate = posSettings.hourly_rate;
                                }
                                if (posSettings.pos_pin && posSettings.pos_pin.length === 4) {
                                    payload.pos_pin = posSettings.pos_pin;
                                }
                                if (Object.keys(payload).length === 0) {
                                    setMessage({ type: 'error', text: 'לא הוזנו שינויים' });
                                    setLoading(false);
                                    return;
                                }
                                const res = await api.put('/auth/update', payload, { headers: getAuthHeaders() });
                                if (res.data.success) {
                                    await refreshUser();
                                    setPosSettings(prev => ({ ...prev, pos_pin: '' }));
                                    setMessage({ type: 'success', text: 'הגדרות עודכנו בהצלחה' });
                                }
                            } catch (err) {
                                setMessage({ type: 'error', text: err.response?.data?.message || 'שגיאה בעדכון' });
                            } finally {
                                setLoading(false);
                            }
                        }}
                        className="space-y-4"
                    >
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">שכר שעתי (₪)</label>
                            <input
                                type="number"
                                step="0.5"
                                min="0"
                                value={posSettings.hourly_rate}
                                onChange={(e) => setPosSettings(prev => ({ ...prev, hourly_rate: e.target.value }))}
                                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                                placeholder="0.00"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                קוד PIN (4 ספרות) — לשעון נוכחות וכניסה לקופה
                            </label>
                            <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]{4}"
                                maxLength={4}
                                value={posSettings.pos_pin}
                                onChange={(e) => setPosSettings(prev => ({ ...prev, pos_pin: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 ltr tracking-[0.4em] text-center text-xl font-black"
                                placeholder="••••"
                            />
                            {user?.has_pin && (
                                <p className="text-xs text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                                    <FaCheckCircle size={10} /> PIN מוגדר — השאר ריק אם לא רוצה לשנות
                                </p>
                            )}
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 disabled:opacity-50"
                        >
                            <FaSave size={14} />
                            שמור הגדרות
                        </button>
                    </form>
                </div>

                {/* כרטיס מנוי - רק לבעל מסעדה */}
                {isOwner() && restaurant && (
                    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <FaCreditCard size={18} />
                            פרטי מנוי
                        </h2>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gray-50 rounded-xl p-4">
                                    <p className="text-xs font-semibold text-gray-500 mb-1">סטטוס מנוי</p>
                                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-black ${STATUS_COLORS[restaurant.subscription_status] || 'bg-gray-100 text-gray-600'}`}>
                                        {STATUS_LABELS[restaurant.subscription_status] || restaurant.subscription_status}
                                    </span>
                                </div>
                                <div className="bg-gray-50 rounded-xl p-4">
                                    <p className="text-xs font-semibold text-gray-500 mb-1">תוכנית</p>
                                    <div className="flex items-center gap-2">
                                        <FaCrown className={restaurant.tier === 'pro' ? 'text-amber-500' : 'text-gray-400'} size={14} />
                                        <span className="text-sm font-bold text-gray-900">{restaurant.tier === 'pro' ? 'Pro' : 'Basic'}</span>
                                        {restaurant.subscription_plan && (
                                            <span className="text-xs text-gray-500">({PLAN_LABELS[restaurant.subscription_plan] || restaurant.subscription_plan})</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {restaurant.subscription_status === 'trial' && restaurant.trial_ends_at && (
                                <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                                    <p className="text-xs font-semibold text-blue-600 mb-1">סיום תקופת ניסיון</p>
                                    <p className="text-sm font-bold text-blue-900">
                                        {new Date(restaurant.trial_ends_at).toLocaleDateString('he-IL')}
                                        {' '}
                                        ({Math.max(0, Math.ceil((new Date(restaurant.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24)))} ימים נותרו)
                                    </p>
                                </div>
                            )}

                            {restaurant.subscription_status === 'active' && (
                                <div className="grid grid-cols-2 gap-4">
                                    {restaurant.next_payment_at && (
                                        <div className="bg-gray-50 rounded-xl p-4">
                                            <p className="text-xs font-semibold text-gray-500 mb-1">חיוב הבא</p>
                                            <p className="text-sm font-bold text-gray-900">
                                                {new Date(restaurant.next_payment_at).toLocaleDateString('he-IL')}
                                            </p>
                                        </div>
                                    )}
                                    {restaurant.monthly_price && (
                                        <div className="bg-gray-50 rounded-xl p-4">
                                            <p className="text-xs font-semibold text-gray-500 mb-1">מחיר חודשי</p>
                                            <p className="text-sm font-bold text-gray-900">₪{restaurant.monthly_price}</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {restaurant.hyp_card_last4 && (
                                <div className="bg-gray-50 rounded-xl p-4">
                                    <p className="text-xs font-semibold text-gray-500 mb-1">אמצעי תשלום</p>
                                    <p className="text-sm font-bold text-gray-900">כרטיס אשראי ****{restaurant.hyp_card_last4}</p>
                                </div>
                            )}

                            <button
                                onClick={() => navigate(restaurant.subscription_status === 'trial' ? '/admin/paywall' : '/admin/billing')}
                                className="flex items-center gap-2 px-5 py-2.5 bg-brand-primary text-white rounded-xl font-bold hover:opacity-90"
                            >
                                <FaCreditCard size={14} />
                                {restaurant.subscription_status === 'trial' ? 'הפעל מנוי' : 'חשבון וחיוב'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
