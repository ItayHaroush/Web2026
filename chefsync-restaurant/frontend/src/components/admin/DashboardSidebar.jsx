import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { FaTimes, FaSignOutAlt, FaChevronRight, FaChevronLeft, FaUtensils, FaStar } from 'react-icons/fa';
import { useRestaurantStatus } from '../../context/RestaurantStatusContext';

export default function DashboardSidebar({
    isOpen,
    isCollapsed,
    toggleSidebar,
    toggleCollapse,
    menuItems,
    title = 'TakeEat',
    onLogout,
    impersonating = false
}) {
    const showCollapsed = isCollapsed && !isOpen;
    const navigate = useNavigate();
    const { subscriptionInfo } = useRestaurantStatus();
    const isBasic = subscriptionInfo?.tier === 'basic';

    return (
        <>
            {/* Mobile Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"
                    onClick={toggleSidebar}
                />
            )}

            {/* Sidebar Container */}
            <aside
                className={`
                    fixed right-0 bottom-0 bg-white shadow-2xl z-50 transition-all duration-300 ease-in-out border-l border-gray-100 flex flex-col
                    ${impersonating ? 'top-10' : 'top-0'}
                    ${isOpen ? 'translate-x-0' : 'translate-x-full'}
                    lg:translate-x-0
                    ${showCollapsed ? 'w-20' : 'w-72'}
                `}
            >
                {/* Header Area */}
                <div className="h-16 flex items-center justify-between px-6 border-b border-gray-100 shrink-0">
                    {!showCollapsed ? (
                        <h1 className="text-2xl font-black bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent truncate tracking-tight cursor-default">
                            {title}
                        </h1>
                    ) : (
                        <div className="w-full flex justify-center items-center text-orange-500">
                            <FaUtensils size={28} />
                        </div>
                    )}

                    <button
                        onClick={toggleSidebar}
                        className="lg:hidden text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <FaTimes size={20} />
                    </button>
                </div>

                {/* Navigation Items */}
                <nav className="flex-1 overflow-y-auto overflow-x-visible py-6 px-3 space-y-1.5 custom-scrollbar">
                    {menuItems.map((item, index) => (
                        <NavLink
                            key={index}
                            to={item.path}
                            className={({ isActive }) => `
                                flex items-center px-3 py-3 rounded-xl transition-all duration-200 group relative
                                ${isActive
                                    ? 'bg-orange-50 text-orange-600 font-bold shadow-sm ring-1 ring-orange-100 icon-active'
                                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}
                                ${showCollapsed ? 'justify-center' : ''}
                            `}
                        >
                            <span className={`text-xl transition-transform group-hover:scale-110 duration-200 flex-shrink-0 ${showCollapsed ? '' : 'ml-3'}`}>
                                {item.icon}
                            </span>

                            {!showCollapsed && (
                                <span className="truncate text-sm font-medium">{item.label}</span>
                            )}

                            {/* Tooltip for collapsed state */}
                            {showCollapsed && (
                                <div className="absolute left-full ml-2 bg-gray-900 text-white text-xs px-2 py-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl duration-200" style={{ zIndex: 9999 }}>
                                    {item.label}
                                </div>
                            )}
                        </NavLink>
                    ))}
                </nav>

                {/* Upgrade CTA for basic tier */}
                {isBasic && (
                    <div className={`px-3 pb-2 shrink-0 ${showCollapsed ? 'flex justify-center' : ''}`}>
                        {showCollapsed ? (
                            <button
                                onClick={() => navigate('/admin/paywall')}
                                className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center text-white shadow-sm hover:shadow-md transition-all group relative"
                            >
                                <FaStar size={16} />
                                <div className="absolute left-full ml-2 bg-gray-900 text-white text-xs px-2 py-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl" style={{ zIndex: 9999 }}>
                                    שדרג ל-Pro
                                </div>
                            </button>
                        ) : (
                            <button
                                onClick={() => navigate('/admin/paywall')}
                                className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl hover:from-amber-100 hover:to-orange-100 transition-all group"
                            >
                                <div className="p-1.5 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg text-white shadow-sm">
                                    <FaStar size={12} />
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-black text-gray-800">שדרג ל-Pro</p>
                                    <p className="text-[10px] text-gray-500 font-medium">קבל גישה לכל התכונות</p>
                                </div>
                            </button>
                        )}
                    </div>
                )}

                {/* Footer Actions */}
                <div className="p-4 border-t border-gray-100 bg-gray-50/50 shrink-0 space-y-2">
                    <button
                        onClick={toggleCollapse}
                        className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-between px-2'} py-2 text-gray-400 hover:text-orange-600 transition-colors hidden lg:flex rounded-lg hover:bg-white`}
                    >
                        {!isCollapsed && <span className="text-xs font-bold uppercase tracking-wider text-gray-400">צמצם תפריט</span>}
                        {isCollapsed ? <FaChevronLeft /> : <FaChevronRight />}
                    </button>

                    <button
                        onClick={onLogout}
                        className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'px-3'} py-2.5 text-red-500 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all duration-200`}
                    >
                        <span className={`text-xl ${isCollapsed ? '' : 'ml-3'}`}><FaSignOutAlt /></span>
                        {!isCollapsed && <span className="font-bold text-sm">התנתק מהמערכת</span>}
                    </button>
                </div>
            </aside>
        </>
    );
}
