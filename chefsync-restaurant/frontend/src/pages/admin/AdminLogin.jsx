import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';
import logo from '../../images/ChefSyncLogoIcon.png';
import { toast } from 'react-hot-toast';
import { PRODUCT_BYLINE_HE, PRODUCT_NAME } from '../../constants/brand';

export default function AdminLogin() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { loginWithCredentials } = useAdminAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const result = await loginWithCredentials(email, password);

        if (result.success) {
            // בדיקה אם זה Super Admin
            const user = JSON.parse(localStorage.getItem('user') || '{}');

            if (user.is_super_admin) {
                toast.success('ברוכים הבאים, מנהל מערכת! 👋');
                navigate('/super-admin/dashboard');
            } else {
                navigate('/admin/dashboard');
            }
        } else {
            setError(result.message);
        }

        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-brand-dark via-brand-primary to-brand-secondary flex items-center justify-center px-4">
            <div className="max-w-md w-full">
                {/* לוגו */}
                <div className="text-center mb-8">
                    <div className="inline-block bg-white p-4 rounded-2xl shadow-2xl mb-4">
                        <img src={logo} alt={PRODUCT_NAME} className="h-16" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">{PRODUCT_NAME}</h1>
                    <p className="text-white/80">{PRODUCT_BYLINE_HE} · פאנל ניהול</p>
                </div>

                {/* טופס התחברות */}
                <div className="bg-white rounded-2xl shadow-2xl p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                📧 כתובת אימייל
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                                placeholder="your@email.com"
                                dir="ltr"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                🔒 סיסמה
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                                placeholder="••••••••"
                                dir="ltr"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-brand-primary hover:bg-brand-dark text-white font-bold py-3 px-4 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    מתחבר...
                                </span>
                            ) : (
                                'התחבר'
                            )}
                        </button>
                    </form>

                    <div className="mt-5 text-center text-xs text-gray-500">
                        בהתחברות אתה מאשר את
                        {' '}
                        <a href="/legal/restaurant" className="text-brand-primary hover:underline font-semibold">
                            תנאי השימוש למסעדנים
                        </a>
                        {' '}ו{' '}
                        <a href="/legal/privacy" className="text-brand-primary hover:underline font-semibold">
                            מדיניות הפרטיות
                        </a>
                        .
                    </div>

                    <div className="mt-6 text-center">
                        <a href="/" className="text-brand-primary hover:underline text-sm">
                            ← חזרה לאתר
                        </a>
                        <div className="mt-3">
                            <a href="/register-restaurant" className="text-brand-primary hover:underline text-sm font-medium">
                                עדיין אין חשבון? הרשמה למסעדה
                            </a>
                        </div>
                    </div>
                </div>

                {/* עזרה */}
                <div className="mt-6 text-center text-white/70 text-sm">
                    <p>שכחת סיסמה? פנה למנהל המערכת</p>
                </div>
            </div>
        </div>
    );
}
