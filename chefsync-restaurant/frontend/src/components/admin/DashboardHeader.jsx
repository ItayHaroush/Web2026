import React from 'react';
import { FaBars, FaBell, FaUserCircle, FaEye } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

const DashboardHeader = ({
    toggleSidebar,
    user,
    title,
    isCollapsed,
    endContent,
    notificationCount = 0,
    impersonating = false
}) => {
    const navigate = useNavigate();

    return (
        <header
            className={`
                fixed left-0 right-0 h-20 bg-white/80 backdrop-blur-md shadow-sm z-30 transition-all duration-300
                lg:right-72 ${isCollapsed ? 'lg:!right-20' : ''}
                ${impersonating ? 'top-10' : 'top-0'}
            `}
        >
            <div className="h-full px-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    {/* Mobile Toggle */}
                    <button
                        onClick={toggleSidebar}
                        className="p-2 -mr-2 text-gray-600 hover:bg-gray-100 rounded-lg lg:hidden"
                    >
                        <FaBars size={24} />
                    </button>

                    {/* Page Title */}
                    <h2 className="text-xl font-bold text-gray-800 hidden md:block">
                        {title}
                    </h2>
                </div>

                {/* Right Side Actions */}
                <div className="flex items-center gap-4">
                    {/* Extra Content (e.g. Status Badge) */}
                    {endContent && (
                        <div className="hidden sm:flex ml-2">
                            {endContent}
                        </div>
                    )}

                    {/* כפתור תצוגה כלקוח - Preview Mode */}
                    <button
                        onClick={() => navigate('/admin/preview-menu')}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors border border-purple-200"
                        title="הצג את התפריט כפי שהלקוחות רואים אותו"
                    >
                        <FaEye />
                        <span className="hidden md:inline">תצוגה כלקוח</span>
                    </button>

                    {/* Notifications */}
                    <button
                        onClick={() => navigate('/admin/orders')}
                        className={`p-2 transition-colors relative ${notificationCount > 0 ? 'text-orange-600 animate-pulse-slow' : 'text-gray-400 hover:text-orange-600'}`}
                        title={notificationCount > 0 ? `${notificationCount} הזמנות פעילות` : 'אין התראות חדשות'}
                    >
                        <FaBell size={20} />
                        {notificationCount > 0 && (
                            <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-white flex items-center justify-center">
                                {notificationCount > 9 ? '9+' : notificationCount}
                            </span>
                        )}
                    </button>

                    {/* User Profile */}
                    <div className="flex items-center gap-3 pl-2 border-r border-gray-200 mr-2 pr-4">
                        <div className="text-left hidden sm:block">
                            <p className="text-sm font-bold text-gray-900">{user?.name || 'אורח'}</p>
                            <p className="text-xs text-gray-500">{user?.role === 'owner' ? 'מנהל מסעדה' : user?.role === 'super_admin' ? 'מנהל על' : user?.role}</p>
                        </div>
                        <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600">
                            {user?.avatar ? (
                                <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover" />
                            ) : (
                                <FaUserCircle size={24} />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default DashboardHeader;
