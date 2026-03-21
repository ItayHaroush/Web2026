import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import AdminPrinters from './AdminPrinters';
import AdminDisplayScreens from './AdminDisplayScreens';
import AdminKiosks from './AdminKiosks';
import { FaPrint, FaTv, FaTabletAlt, FaServer } from 'react-icons/fa';

const TABS = [
    { id: 'printers', label: 'מדפסות', icon: <FaPrint size={14} /> },
    { id: 'screens', label: 'מסכי תצוגה', icon: <FaTv size={14} /> },
    { id: 'kiosks', label: 'קיוסקים', icon: <FaTabletAlt size={14} /> },
];

const TAB_IDS = TABS.map((t) => t.id);

export default function AdminDevices() {
    const [searchParams, setSearchParams] = useSearchParams();
    const tabFromUrl = searchParams.get('tab');
    const [activeTab, setActiveTab] = useState(
        () => (tabFromUrl && TAB_IDS.includes(tabFromUrl) ? tabFromUrl : 'printers')
    );

    useEffect(() => {
        const t = searchParams.get('tab');
        if (t && TAB_IDS.includes(t)) {
            setActiveTab(t);
        }
    }, [searchParams]);

    const goTab = (id) => {
        setActiveTab(id);
        setSearchParams({ tab: id });
    };

    return (
        <AdminLayout>
            <div className="max-w-7xl mx-auto">
                <div className="mb-6">
                    <h1 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                        <div className="w-10 h-10 bg-brand-primary text-white rounded-xl flex items-center justify-center shadow-lg shadow-brand-primary/20">
                            <FaServer size={18} />
                        </div>
                        מכשירים
                    </h1>
                    <p className="text-xs text-gray-500 mt-1 mr-[52px]">מדפסות, מסכי תצוגה וקיוסקים</p>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-1.5 mb-6">
                    <div className="flex gap-1">
                        {TABS.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => goTab(tab.id)}
                                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                    activeTab === tab.id
                                        ? 'bg-gray-900 text-white shadow-lg'
                                        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                                }`}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    {activeTab === 'printers' && <AdminPrinters embedded />}
                    {activeTab === 'screens' && <AdminDisplayScreens embedded />}
                    {activeTab === 'kiosks' && <AdminKiosks embedded />}
                </div>
            </div>
        </AdminLayout>
    );
}
