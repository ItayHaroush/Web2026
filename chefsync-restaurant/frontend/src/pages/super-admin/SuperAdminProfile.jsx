import { useState, useEffect } from 'react';
import SuperAdminLayout from '../../layouts/SuperAdminLayout';
import { useAdminAuth } from '../../context/AdminAuthContext';
import api from '../../services/apiClient';
import { FaUser, FaLock, FaSave } from 'react-icons/fa';

export default function SuperAdminProfile() {
    const { user, getAuthHeaders, refreshUser } = useAdminAuth();
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
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        if (user) {
            setProfile({
                name: user.name ?? '',
                email: user.email ?? '',
                phone: user.phone ?? '',
            });
        }
    }, [user]);

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
            const msg = err.response?.data?.message || err.response?.data?.errors
                ? Object.values(err.response.data.errors || {}).flat().join(' ')
                : 'שגיאה בעדכון';
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
            const msg = err.response?.data?.message || err.response?.data?.errors
                ? Object.values(err.response.data.errors || {}).flat().join(' ')
                : 'שגיאה בעדכון סיסמה';
            setMessage({ type: 'error', text: msg });
        } finally {
            setLoading(false);
        }
    };

    if (!user) return null;

    return (
        <SuperAdminLayout>
            <div className="max-w-xl mx-auto px-4 py-6">
                <h1 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-2">
                    <div className="p-2 bg-brand-primary/10 rounded-lg">
                        <FaUser className="text-brand-primary" size={20} />
                    </div>
                    פרופיל – בעל המערכת
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
                <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
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
            </div>
        </SuperAdminLayout>
    );
}
