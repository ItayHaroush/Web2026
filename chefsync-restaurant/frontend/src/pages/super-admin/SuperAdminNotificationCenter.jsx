import { useState } from 'react';
import SuperAdminLayout from '../../layouts/SuperAdminLayout';
import SuperAdminNotifications from './SuperAdminNotifications';
import SuperAdminNotificationLog from './SuperAdminNotificationLog';
import SuperAdminSmsDebug from './SuperAdminSmsDebug';
import { FaBell, FaHistory, FaSms } from 'react-icons/fa';

const TABS = [
    { id: 'push', label: 'התראות PWA', icon: <FaBell size={14} /> },
    { id: 'log', label: 'לוג התראות', icon: <FaHistory size={14} /> },
    { id: 'sms', label: 'SMS', icon: <FaSms size={14} /> },
];

export default function SuperAdminNotificationCenter() {
    const [activeTab, setActiveTab] = useState('push');

    return (
        <SuperAdminLayout>
            <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-4">
                <div className="mb-6">
                    <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                        <div className="p-2 bg-brand-primary/10 rounded-lg">
                            <FaBell className="text-brand-primary" size={20} />
                        </div>
                        מרכז התראות
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">ניהול התראות PWA, לוג שליחה ואבחון SMS</p>
                </div>

                <div className="flex gap-1 bg-gray-100 p-1 rounded-2xl mb-6">
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                activeTab === tab.id
                                    ? 'bg-white text-brand-primary shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div>
                    {activeTab === 'push' && <SuperAdminNotifications embedded />}
                    {activeTab === 'log' && <SuperAdminNotificationLog embedded />}
                    {activeTab === 'sms' && <SuperAdminSmsDebug embedded />}
                </div>
            </div>
        </SuperAdminLayout>
    );
}
