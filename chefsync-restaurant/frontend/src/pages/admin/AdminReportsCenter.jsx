import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import AdminReports from './AdminReports';
import AdminTimeReports from './AdminTimeReports';
import { useRestaurantStatus } from '../../context/RestaurantStatusContext';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { isFeatureUnlocked } from '../../utils/tierUtils';
import { FaChartBar, FaUserClock, FaStar } from 'react-icons/fa';

export default function AdminReportsCenter() {
    const [activeTab, setActiveTab] = useState('daily');
    const { subscriptionInfo } = useRestaurantStatus();
    const { isManager } = useAdminAuth();
    const isTimeReportsLocked = !isFeatureUnlocked(subscriptionInfo?.features, 'time_reports');

    if (!isManager()) return <Navigate to="/admin/dashboard" replace />;

    const TABS = [
        { id: 'daily', label: 'דוחות יומיים', icon: <FaChartBar size={14} /> },
        { id: 'attendance', label: 'דוח נוכחות', icon: <FaUserClock size={14} />, proOnly: true },
    ];

    return (
        <AdminLayout>
            <div className="max-w-7xl mx-auto">
                <div className="mb-6">
                    <h1 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                        <div className="w-10 h-10 bg-brand-primary text-white rounded-xl flex items-center justify-center shadow-lg shadow-brand-primary/20">
                            <FaChartBar size={18} />
                        </div>
                        דוחות
                    </h1>
                    <p className="text-xs text-gray-500 mt-1 mr-[52px]">דוחות יומיים, דוח נוכחות ושכר</p>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-1.5 mb-6">
                    <div className="flex gap-1">
                        {TABS.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeTab === tab.id
                                    ? 'bg-gray-900 text-white shadow-lg'
                                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                                    }`}
                            >
                                {tab.icon}
                                {tab.label}
                                {tab.proOnly && isTimeReportsLocked && (
                                    <span className="text-[9px] font-black bg-gradient-to-r from-amber-400 to-orange-500 text-white px-1.5 py-0.5 rounded-md uppercase leading-none flex items-center gap-0.5">
                                        <FaStar size={7} />
                                        מסעדה מלאה
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    {activeTab === 'daily' && <AdminReports embedded />}
                    {activeTab === 'attendance' && <AdminTimeReports embedded />}
                </div>
            </div>
        </AdminLayout>
    );
}
