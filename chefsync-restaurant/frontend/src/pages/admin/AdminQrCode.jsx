import AdminLayout from '../../layouts/AdminLayout';
import { FaQrcode, FaLink } from 'react-icons/fa';

export default function AdminQrCode() {
    return (
        <AdminLayout>
            <div className="max-w-6xl mx-auto space-y-12 pb-32 animate-in fade-in duration-500">
                <div className="flex items-center gap-6 px-4">
                    <div className="w-20 h-20 bg-slate-50 rounded-[2.5rem] flex items-center justify-center text-slate-700 shadow-sm border border-slate-200/60">
                        <FaQrcode size={30} />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-gray-900 tracking-tight">QR Code</h1>
                        <p className="text-gray-500 font-medium mt-1">ייצור QR להדבקה וניהול קישורים מהירים</p>
                    </div>
                </div>

                <div className="bg-white rounded-[3rem] shadow-sm border border-gray-100 p-12 text-center mx-4">
                    <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center text-slate-600 mx-auto mb-6">
                        <FaLink size={28} />
                    </div>
                    <h2 className="text-2xl font-black text-gray-900">מחולל QR מוכן</h2>
                    <p className="text-gray-500 font-medium mt-3">כאן נשלב ייצור QR עבור מסעדה ותפריט.</p>
                </div>
            </div>
        </AdminLayout>
    );
}
