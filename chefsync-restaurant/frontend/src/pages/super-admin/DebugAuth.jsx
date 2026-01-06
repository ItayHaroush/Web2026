import { useState, useEffect } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import SuperAdminLayout from '../../layouts/SuperAdminLayout';
import api from '../../services/apiClient';

export default function DebugAuth() {
    const { user, token, isSuperAdmin, getAuthHeaders } = useAdminAuth();
    const [testResults, setTestResults] = useState({});

    useEffect(() => {
        runTests();
    }, []);

    const runTests = async () => {
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
    };

    return (
        <SuperAdminLayout>
            <div className="max-w-7xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">🔍 בדיקת Auth</h1>
                    <p className="text-gray-600">כל המידע על המצב הנוכחי של ה-Authentication</p>
                </div>

                <button
                    onClick={runTests}
                    className="mb-6 px-6 py-3 bg-brand-primary text-white rounded-xl hover:bg-brand-dark"
                >
                    🔄 הרץ בדיקות מחדש
                </button>

                {/* localStorage */}
                <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                    <h2 className="text-2xl font-bold mb-4">📦 localStorage</h2>
                    <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto text-sm" dir="ltr">
                        {JSON.stringify(testResults.localStorage, null, 2)}
                    </pre>
                </div>

                {/* Context State */}
                <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                    <h2 className="text-2xl font-bold mb-4">🎯 Context State</h2>
                    <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto text-sm" dir="ltr">
                        {JSON.stringify(testResults.contextState, null, 2)}
                    </pre>
                </div>

                {/* Headers */}
                <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                    <h2 className="text-2xl font-bold mb-4">📋 Headers</h2>
                    <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto text-sm" dir="ltr">
                        {JSON.stringify(testResults.headers, null, 2)}
                    </pre>
                </div>

                {/* API Test */}
                <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                    <h2 className="text-2xl font-bold mb-4">
                        {testResults.apiTest?.success ? '✅' : '❌'} API Test
                    </h2>
                    <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto text-sm" dir="ltr">
                        {JSON.stringify(testResults.apiTest, null, 2)}
                    </pre>
                </div>

                {/* Console Instructions */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                    <h2 className="text-xl font-bold mb-3">📋 הוראות בדיקה</h2>
                    <ol className="list-decimal list-inside space-y-2 text-gray-700">
                        <li>פתח את DevTools (F12) ולך ל-Console</li>
                        <li>חפש הודעות כחולות שמתחילות ב-🚀 (בקשות) או ✅/❌ (תגובות)</li>
                        <li>אם יש ❌ MISSING Token - זאת הבעיה!</li>
                        <li>אם Status 422 - לך ל-Network ובדוק Response</li>
                        <li>אם Status 401/403 - ה-Token לא תקין או חסר</li>
                    </ol>
                </div>
            </div>
        </SuperAdminLayout>
    );
}
