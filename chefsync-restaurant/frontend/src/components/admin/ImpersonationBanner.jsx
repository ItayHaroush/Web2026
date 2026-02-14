import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { FaUserSecret, FaSignOutAlt } from 'react-icons/fa';

export default function ImpersonationBanner() {
    const { impersonating, stopImpersonation } = useAdminAuth();
    const navigate = useNavigate();

    if (!impersonating) return null;

    const handleStop = () => {
        stopImpersonation();
        navigate('/super-admin/dashboard');
    };

    return (
        <div className="bg-gradient-to-l from-amber-500 to-red-500 text-white px-4 shadow-lg fixed top-0 left-0 right-0 z-[60] h-10 flex items-center">
            <div className="max-w-[1400px] mx-auto flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <FaUserSecret size={18} className="text-white/80" />
                    <div>
                        <span className="text-xs font-black uppercase tracking-widest">מצב התחזות</span>
                        <span className="mx-2 text-white/50">|</span>
                        <span className="text-sm font-bold">{impersonating.restaurantName}</span>
                        <span className="text-xs text-white/70 font-mono mr-2">@{impersonating.tenantId}</span>
                    </div>
                </div>
                <button
                    onClick={handleStop}
                    className="px-4 py-1.5 bg-white/20 hover:bg-white/30 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 backdrop-blur-sm"
                >
                    <FaSignOutAlt size={12} />
                    יציאה
                </button>
            </div>
        </div>
    );
}
