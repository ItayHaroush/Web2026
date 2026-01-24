import AdminLayout from '../../layouts/AdminLayout';
import { FaMobileAlt, FaPlay } from 'react-icons/fa';

export default function AdminSimulator() {
    return (
        <AdminLayout>
            <div className="max-w-6xl mx-auto space-y-12 pb-32 animate-in fade-in duration-500">
                <div className="flex items-center gap-6 px-4">
                    <div className="w-20 h-20 bg-purple-50 rounded-[2.5rem] flex items-center justify-center text-purple-600 shadow-sm border border-purple-100/50">
                        <FaMobileAlt size={30} />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-gray-900 tracking-tight">סימולטור</h1>
                        <p className="text-gray-500 font-medium mt-1">בדיקת חוויית הלקוח והזרמת הזמנות דמו</p>
                    </div>
                </div>

                <div className="bg-white rounded-[3rem] shadow-sm border border-gray-100 p-12 text-center mx-4">
                    <div className="w-24 h-24 bg-purple-50 rounded-[2.5rem] flex items-center justify-center text-purple-500 mx-auto mb-6">
                        <FaPlay size={30} />
                    </div>
                    <h2 className="text-2xl font-black text-gray-900">הרצת סימולציה</h2>
                    <p className="text-gray-500 font-medium mt-3">עמוד זה מחכה לחיבור מנגנון סימולטור הזמנות.</p>
                </div>
            </div>
        </AdminLayout>
    );
}
