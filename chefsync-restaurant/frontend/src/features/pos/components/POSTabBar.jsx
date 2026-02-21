import { FaClipboardList, FaPlusCircle, FaCashRegister, FaHistory } from 'react-icons/fa';

const tabs = [
    { id: 'orders', label: 'הזמנות', icon: FaClipboardList },
    { id: 'new-order', label: 'הזמנה חדשה', icon: FaPlusCircle },
    { id: 'cash-register', label: 'קופה', icon: FaCashRegister },
    { id: 'history', label: 'היסטוריה', icon: FaHistory, managerOnly: true },
];

export default function POSTabBar({ activeTab, onTabChange, isManager }) {
    const visibleTabs = tabs.filter(t => !t.managerOnly || isManager);

    return (
        <nav className="bg-slate-800 border-t border-slate-700/50 px-4 py-2 flex justify-around shrink-0 safe-bottom">
            {visibleTabs.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={`flex flex-col items-center gap-1 px-6 py-2.5 rounded-2xl transition-all ${
                            active
                                ? 'bg-orange-500/15 text-orange-400'
                                : 'text-slate-500 hover:text-slate-300'
                        }`}
                    >
                        <Icon size={22} />
                        <span className="text-[11px] font-black">{tab.label}</span>
                    </button>
                );
            })}
        </nav>
    );
}
