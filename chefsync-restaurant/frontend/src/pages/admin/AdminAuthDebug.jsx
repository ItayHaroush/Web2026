import React from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';

export default function AdminAuthDebug() {
    const { user, token, role, isOwner, isManager } = useAdminAuth();

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold mb-6">🔍 בדיקת הרשאות ואימות</h1>

            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
                <h2 className="text-lg font-bold mb-4 text-gray-800">פרטי משתמש מחובר</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="p-3 bg-gray-50 rounded">
                        <span className="font-bold block text-gray-500">שם:</span>
                        {user?.name}
                    </div>
                    <div className="p-3 bg-gray-50 rounded">
                        <span className="font-bold block text-gray-500">אימייל:</span>
                        {user?.email}
                    </div>
                    <div className="p-3 bg-gray-50 rounded">
                        <span className="font-bold block text-gray-500">תפקיד (Role):</span>
                        <span className="inline-block px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-mono">
                            {user?.role}
                        </span>
                    </div>
                    <div className="p-3 bg-gray-50 rounded">
                        <span className="font-bold block text-gray-500">Tenant ID:</span>
                        <span className="font-mono text-xs">{user?.restaurant_id || 'N/A'}</span>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
                <h2 className="text-lg font-bold mb-4 text-gray-800">בדיקת הרשאות פונקציונלית</h2>
                <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <span>האם בעלים (isOwner)?</span>
                        <span className={`font-bold ${isOwner() ? 'text-green-600' : 'text-red-600'}`}>
                            {isOwner() ? 'כן' : 'לא'}
                        </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <span>האם מנהל (isManager)?</span>
                        <span className={`font-bold ${isManager() ? 'text-green-600' : 'text-red-600'}`}>
                            {isManager() ? 'כן' : 'לא'}
                        </span>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
                <h2 className="text-lg font-bold mb-4 text-gray-800">Token הנוכחי</h2>
                <div className="bg-gray-900 text-green-400 p-4 rounded text-xs font-mono overflow-x-auto">
                    {token || 'אין טוקן'}
                </div>
            </div>
        </div>
    );
}
