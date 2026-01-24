import AdminLayout from '../../layouts/AdminLayout';
import { FaTicketAlt, FaMagic, FaPlus } from 'react-icons/fa';
import { useAdminAuth } from '../../context/AdminAuthContext';

export default function AdminCoupons() {
    const { isManager } = useAdminAuth();

    return (
        <AdminLayout>
            <div className="max-w-6xl mx-auto space-y-12 pb-32 animate-in fade-in duration-500">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 px-4">
                    <div className="flex items-center gap-6">
                        <div className="w-20 h-20 bg-emerald-50 rounded-[2.5rem] flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-100/50">
                            <FaTicketAlt size={32} />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black text-gray-900 tracking-tight">קופונים</h1>
                            <p className="text-gray-500 font-medium mt-1">יצירה וניהול קופונים ללקוחות</p>
                        </div>
                    </div>
                    {isManager() && (
                        <button className="w-full md:w-auto bg-brand-primary text-white px-10 py-5 rounded-[2rem] font-black hover:bg-brand-dark transition-all flex items-center justify-center gap-3 shadow-xl shadow-brand-primary/20 active:scale-95 group">
                            <FaPlus className="group-hover:rotate-90 transition-transform" />
                            יצירת קופון
                        </button>
                    )}
                </div>

                <div className="bg-white rounded-[3rem] shadow-sm border border-gray-100 p-12 text-center mx-4">
                    <div className="w-24 h-24 bg-emerald-50 rounded-[2.5rem] flex items-center justify-center text-emerald-500 mx-auto mb-6">
                        <FaMagic size={32} />
                    </div>
                    <h2 className="text-2xl font-black text-gray-900">בקרוב: מרכז הקופונים</h2>
                    <p className="text-gray-500 font-medium mt-3">העמוד מוכן לחיבור לוגיקה של קופונים ומבצעים.</p>
                </div>
            </div>
        </AdminLayout>
    );
}
