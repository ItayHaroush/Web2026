import { useState, useEffect } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import SuperAdminLayout from '../../layouts/SuperAdminLayout';
import api from '../../services/apiClient';
import {
    FaSearch,
    FaSync,
    FaDatabase,
    FaUserShield,
    FaKey,
    FaCloudDownloadAlt,
    FaInfoCircle,
    FaCheckCircle,
    FaTimesCircle,
    FaBug
} from 'react-icons/fa';

export default function DebugAuth() {
    const { user, token, isSuperAdmin, getAuthHeaders } = useAdminAuth();
    const [testResults, setTestResults] = useState({});
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        runTests();
    }, []);

    const runTests = async () => {
        setIsLoading(true);
        const results = {};

        // בדיקה 1: localStorage
        results.localStorage = {
            authToken: localStorage.getItem('authToken')?.substring(0, 30) + '...',
            user: localStorage.getItem('user'),
            admin_token: localStorage.getItem('admin_token')?.substring(0, 30) + '...',
        };

        // בדיקה 2: Context State
        results.contextState = {
            hasUser: !!user,
            hasToken: !!token,
            isSuperAdmin: isSuperAdmin(),
            userData: user,
        };

        // בדיקה 3: Headers
        results.headers = getAuthHeaders();

        // בדיקה 4: API Test
        try {
            const response = await api.get('/super-admin/dashboard');
            results.apiTest = {
                success: true,
                status: response.status,
                data: response.data,
            };
        } catch (error) {
            results.apiTest = {
                success: false,
                status: error.response?.status,
                message: error.response?.data?.message,
                errors: error.response?.data?.errors,
            };
        }

        setTestResults(results);
        setTimeout(() => setIsLoading(false), 500);
    };

    return (
        <SuperAdminLayout>
            <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-4">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                            <div className="p-2 bg-brand-primary/10 rounded-lg">
                                <FaSearch className="text-brand-primary" size={20} />
                            </div>
                            מערכת אבחון הרשאות (Auth Debug)
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">ניתוח מעמיק של מצב הזיהוי, אסימוני גישה ותקינות API</p>
                    </div>

                    <button
                        onClick={runTests}
                        disabled={isLoading}
                        className="px-6 py-3 bg-brand-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-brand-primary/95 transition-all shadow-lg shadow-brand-primary/20 flex items-center justify-center gap-2 disabled:opacity-50 min-w-[180px]"
                    >
                        <FaSync className={isLoading ? 'animate-spin' : ''} size={14} />
                        {isLoading ? 'מריץ בדיקות...' : 'הרצת דיאגנוסטיקה'}
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* localStorage */}
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 overflow-hidden">
                        <h2 className="text-sm font-black text-gray-900 mb-4 flex items-center gap-2 uppercase tracking-wide">
                            <FaDatabase className="text-brand-primary" size={14} />
                            Browser storage (localStorage)
                        </h2>
                        <div className="bg-black rounded-2xl p-4 overflow-auto custom-scrollbar shadow-inner h-[220px]">
                            <pre className="text-[11px] font-mono text-cyan-400 leading-relaxed break-all whitespace-pre-wrap" dir="ltr">
                                {JSON.stringify(testResults.localStorage, null, 2)}
                            </pre>
                        </div>
                    </div>

                    {/* Context State */}
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 overflow-hidden">
                        <h2 className="text-sm font-black text-gray-900 mb-4 flex items-center gap-2 uppercase tracking-wide">
                            <FaUserShield className="text-brand-primary" size={14} />
                            React Context State
                        </h2>
                        <div className="bg-black rounded-2xl p-4 overflow-auto custom-scrollbar shadow-inner h-[220px]">
                            <pre className="text-[11px] font-mono text-green-400 leading-relaxed break-all whitespace-pre-wrap" dir="ltr">
                                {JSON.stringify(testResults.contextState, null, 2)}
                            </pre>
                        </div>
                    </div>

                    {/* API Headers */}
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 overflow-hidden">
                        <h2 className="text-sm font-black text-gray-900 mb-4 flex items-center gap-2 uppercase tracking-wide">
                            <FaKey className="text-brand-primary" size={14} />
                            Active Request Headers
                        </h2>
                        <div className="bg-black rounded-2xl p-4 overflow-auto custom-scrollbar shadow-inner h-[220px]">
                            <pre className="text-[11px] font-mono text-cyan-400 leading-relaxed break-all whitespace-pre-wrap" dir="ltr">
                                {JSON.stringify(testResults.headers, null, 2)}
                            </pre>
                        </div>
                    </div>

                    {/* API connectivity */}
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 overflow-hidden relative">
                        <div className="absolute top-6 left-6">
                            {testResults.apiTest?.success ? (
                                <FaCheckCircle className="text-green-500" size={20} />
                            ) : (
                                <FaTimesCircle className="text-red-500" size={20} />
                            )}
                        </div>
                        <h2 className="text-sm font-black text-gray-900 mb-4 flex items-center gap-2 uppercase tracking-wide">
                            <FaCloudDownloadAlt className="text-brand-primary" size={14} />
                            API Connectivity Test
                        </h2>
                        <div className="bg-black rounded-2xl p-4 overflow-auto custom-scrollbar shadow-inner h-[220px]">
                            <pre className="text-[11px] font-mono text-green-400 leading-relaxed break-all whitespace-pre-wrap" dir="ltr">
                                {JSON.stringify(testResults.apiTest, null, 2)}
                            </pre>
                        </div>
                    </div>
                </div>

                {/* Developer Instructions */}
                <div className="mt-8 bg-gray-900 rounded-3xl border border-gray-800 p-6 shadow-xl overflow-hidden relative group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/10 blur-3xl -mr-16 -mt-16 group-hover:bg-brand-primary/20 transition-all"></div>

                    <h2 className="text-base font-black text-white mb-4 flex items-center gap-2">
                        <FaInfoCircle className="text-brand-primary" size={16} />
                        פרוטוקול פתרון תקלות (Troubleshooting)
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                        <div className="p-4 bg-gray-800/50 rounded-2xl border border-gray-700">
                            <div className="w-6 h-6 rounded-lg bg-brand-primary/20 flex items-center justify-center mb-3">
                                <span className="text-[10px] font-black text-brand-primary">01</span>
                            </div>
                            <p className="text-[11px] font-black text-gray-300 uppercase tracking-widest mb-1">DevTools</p>
                            <p className="text-[11px] text-gray-400 font-medium">פתח F12 ובדוק את ה-Console עבור הודעות בקשה (🚀) או שגיאה (❌).</p>
                        </div>

                        <div className="p-4 bg-gray-800/50 rounded-2xl border border-gray-700">
                            <div className="w-6 h-6 rounded-lg bg-brand-primary/20 flex items-center justify-center mb-3">
                                <span className="text-[10px] font-black text-brand-primary">02</span>
                            </div>
                            <p className="text-[11px] font-black text-gray-300 uppercase tracking-widest mb-1">Token Missing</p>
                            <p className="text-[11px] text-gray-400 font-medium">אם מופיע MISSING Token בבדיקת Headers, המערכת לא ביצעה Login תקין.</p>
                        </div>

                        <div className="p-4 bg-gray-800/50 rounded-2xl border border-gray-700">
                            <div className="w-6 h-6 rounded-lg bg-brand-primary/20 flex items-center justify-center mb-3">
                                <span className="text-[10px] font-black text-brand-primary">03</span>
                            </div>
                            <p className="text-[11px] font-black text-gray-300 uppercase tracking-widest mb-1">Network Inspect</p>
                            <p className="text-[11px] text-gray-400 font-medium">אם סטטוס 401/403 מופיע, וודא שהפרויקט ב-Backend מוגדר עם Sanctum תקין.</p>
                        </div>
                    </div>

                    <div className="mt-6 flex items-center gap-2 px-2">
                        <FaBug className="text-brand-primary/40" size={12} />
                        <span className="text-[10px] font-mono text-gray-500 uppercase">CS-DEBUG-SYS-V2.0-STABLE</span>
                    </div>
                </div>
            </div>
        </SuperAdminLayout>
    );
}
