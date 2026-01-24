import React from 'react';
import { FaBars, FaBell, FaUserCircle } from 'react-icons/fa';

const DashboardHeader = ({
    toggleSidebar,
    user,
    title,
    isCollapsed,
    endContent
}) => {
    return (
        <header
            className={`
                fixed top-0 left-0 right-0 h-20 bg-white/80 backdrop-blur-md shadow-sm z-30 transition-all duration-300
                lg:right-72 ${isCollapsed ? 'lg:!right-20' : ''}
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

                    {/* Notifications (Demo) */}
                    <button className="p-2 text-gray-400 hover:text-orange-600 transition-colors relative">
                        <FaBell size={20} />
                        <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
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
