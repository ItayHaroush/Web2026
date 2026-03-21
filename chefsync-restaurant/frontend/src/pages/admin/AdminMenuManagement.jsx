import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import AdminMenu from './AdminMenu';
import AdminBases from './AdminBases';
import AdminSalads from './AdminSalads';
import AdminCategories from './AdminCategories';
import { FaUtensils, FaBreadSlice, FaCarrot, FaTags } from 'react-icons/fa';

const TABS = [
    { id: 'items', label: 'תפריט', icon: <FaUtensils size={14} /> },
    { id: 'bases', label: 'בסיסים', icon: <FaBreadSlice size={14} /> },
    { id: 'salads', label: 'תוספות', icon: <FaCarrot size={14} /> },
    { id: 'categories', label: 'קטגוריות', icon: <FaTags size={14} /> },
];

const TAB_IDS = ['items', 'bases', 'salads', 'categories'];

export default function AdminMenuManagement() {
    const [searchParams, setSearchParams] = useSearchParams();
    const tabFromUrl = searchParams.get('tab');
    const [activeTab, setActiveTab] = useState(
        () => (tabFromUrl && TAB_IDS.includes(tabFromUrl) ? tabFromUrl : 'items')
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
                            <FaUtensils size={18} />
                        </div>
                        ניהול תפריט
                    </h1>
                    <p className="text-xs text-gray-500 mt-1 mr-[52px]">ניהול פריטים, בסיסים, תוספות וקטגוריות</p>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-1.5 mb-6 overflow-x-auto overscroll-x-contain touch-pan-x [-webkit-overflow-scrolling:touch] max-w-full min-w-0">
                    <div className="flex gap-1 min-w-max sm:min-w-0 sm:w-full">
                        {TABS.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => goTab(tab.id)}
                                className={`flex shrink-0 sm:flex-1 items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap snap-start ${
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
                    {activeTab === 'items' && <AdminMenu embedded />}
                    {activeTab === 'bases' && <AdminBases embedded />}
                    {activeTab === 'salads' && <AdminSalads embedded />}
                    {activeTab === 'categories' && <AdminCategories embedded />}
                </div>
            </div>
        </AdminLayout>
    );
}
