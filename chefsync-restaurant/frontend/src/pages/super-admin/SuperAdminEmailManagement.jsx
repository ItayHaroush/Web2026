import { useState } from 'react';
import SuperAdminLayout from '../../layouts/SuperAdminLayout';
import SuperAdminEmailLog from './SuperAdminEmailLog';
import SuperAdminEmails from './SuperAdminEmails';
import { FaEnvelope, FaListAlt, FaPalette } from 'react-icons/fa';

const TABS = [
    { id: 'log', label: 'לוג', icon: <FaListAlt size={14} /> },
    { id: 'templates', label: 'תבניות', icon: <FaPalette size={14} /> },
];

export default function SuperAdminEmailManagement() {
    const [activeTab, setActiveTab] = useState('log');

    return (
        <SuperAdminLayout>
            <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-4">
                <div className="mb-6">
                    <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                        <div className="p-2 bg-brand-primary/10 rounded-lg">
                            <FaEnvelope className="text-brand-primary" size={20} />
                        </div>
                        ניהול מיילים
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">לוג שליחות מייל ותבניות מערכת</p>
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
                    {activeTab === 'log' && <SuperAdminEmailLog embedded />}
                    {activeTab === 'templates' && <SuperAdminEmails embedded />}
                </div>
            </div>
        </SuperAdminLayout>
    );
}
