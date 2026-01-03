import { useNavigate, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';

export default function SuperAdminLayout({ children }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAdminAuth();

    const handleLogout = async () => {
        await logout();
        navigate('/admin/login');
    };

    const menuItems = [
        {
            label: 'דשבורד',
            path: '/super-admin/dashboard',
            icon: '📊',
        },
        {
            label: 'דוחות',
            path: '/super-admin/reports',
            icon: '📈',
        },
        {
            label: 'הגדרות',
            path: '/super-admin/settings',
            icon: '⚙️',
        },
    ];

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-brand-primary/10 flex items-center justify-center text-xl">
                            👨‍💼
                        </div>
                        <h1 className="text-xl font-bold">ChefSync Admin</h1>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="font-medium text-gray-800">{user?.name || 'Super Admin'}</p>
                            <p className="text-xs text-gray-500">מנהל מערכת</p>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-all font-medium"
                        >
                            יציאה
                        </button>
                    </div>
                </div>
            </header>

            <div className="flex">
                {/* Sidebar */}
                <aside className="w-64 bg-white border-r border-gray-200 min-h-[calc(100vh-80px)]">
                    <nav className="p-4 space-y-2">
                        {menuItems.map((item) => (
                            <button
                                key={item.path}
                                onClick={() => navigate(item.path)}
                                className={`w-full text-right px-4 py-3 rounded-lg transition-all flex items-center gap-3 ${location.pathname === item.path
                                    ? 'bg-brand-primary text-white'
                                    : 'text-gray-700 hover:bg-gray-50'
                                    }`}
                            >
                                <span className="text-xl">{item.icon}</span>
                                <span className="font-medium">{item.label}</span>
                            </button>
                        ))}
                    </nav>
                </aside>

                {/* Main Content */}
                <main className="flex-1 p-8">
                    {children}
                </main>
            </div>
        </div>
    );
}
