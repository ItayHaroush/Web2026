import React from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import {
    FaChartLine,
    FaShoppingBag,
    FaUsers,
    FaTimesCircle,
    FaArrowUp,
    FaArrowDown,
    FaCalendarAlt,
    FaDownload,
    FaChartPie,
    FaMoneyBillWave
} from 'react-icons/fa';

export default function AdminReports() {
    const stats = [
        {
            title: 'הכנסות היום',
            value: '₪2,450',
            change: '+12.5%',
            isPositive: true,
            icon: <FaMoneyBillWave />,
            color: 'emerald'
        },
        {
            title: 'הזמנות היום',
            value: '45',
            change: '+5.2%',
            isPositive: true,
            icon: <FaShoppingBag />,
            color: 'blue'
        },
        {
            title: 'לקוחות חדשים',
            value: '12',
            change: '+20.1%',
            isPositive: true,
            icon: <FaUsers />,
            color: 'purple'
        },
        {
            title: 'ביטולים',
            value: '1',
            change: '-50.0%',
            isPositive: true, // שיפור זה ירידה בביטולים
            icon: <FaTimesCircle />,
            color: 'rose'
        },
    ];

    return (
        <AdminLayout>
            <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <h1 className="text-4xl font-black text-gray-900 flex items-center gap-3">
                            <span className="p-3 bg-brand-primary/10 rounded-2xl text-brand-primary">
                                <FaChartLine size={32} />
                            </span>
                            דוחות וביצועים
                        </h1>
                        <p className="text-gray-500 mt-2 mr-16 font-medium">
                            ניתוח נתוני מכירות, לקוחות ופריטים פופולריים בזמן אמת
                        </p>
                    </div>

                    <div className="flex gap-3 w-full md:w-auto">
                        <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-white border border-gray-100 rounded-2xl font-black text-gray-700 hover:bg-gray-50 transition-all shadow-sm">
                            <FaCalendarAlt className="text-brand-primary" />
                            <span>בחר תאריכים</span>
                        </button>
                        <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-2xl font-black hover:bg-black transition-all shadow-lg">
                            <FaDownload />
                            <span>ייצוא PDF</span>
                        </button>
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {stats.map((stat, index) => (
                        <div key={index} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                            <div className={`absolute top-0 left-0 w-2 h-full bg-${stat.color}-500 opacity-20`} />

                            <div className="flex items-start justify-between mb-4">
                                <div className={`p-3 rounded-2xl bg-${stat.color}-50 text-${stat.color}-600 group-hover:scale-110 transition-transform`}>
                                    {stat.icon}
                                </div>
                                <div className={`flex items-center gap-1 text-[11px] font-black px-2 py-1 rounded-full ${stat.isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                    {stat.isPositive ? <FaArrowUp size={8} /> : <FaArrowDown size={8} />}
                                    {stat.change}
                                </div>
                            </div>

                            <p className="text-gray-500 text-xs font-black uppercase tracking-wider mb-1">{stat.title}</p>
                            <h3 className="text-3xl font-black text-gray-900">{stat.value}</h3>
                        </div>
                    ))}
                </div>

                {/* Main Charts area */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <section className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm hover:shadow-md transition-shadow min-h-[450px] flex flex-col">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
                                <FaChartLine className="text-blue-500" /> גרף מכירות יומי
                            </h3>
                            <div className="flex gap-2">
                                <span className="w-3 h-3 rounded-full bg-blue-500" />
                                <span className="w-3 h-3 rounded-full bg-gray-100" />
                            </div>
                        </div>
                        <div className="flex-1 bg-gray-50 rounded-3xl border border-gray-100 border-dashed flex flex-col items-center justify-center p-8 text-center">
                            <div className="w-20 h-20 bg-white rounded-[2rem] shadow-sm flex items-center justify-center mb-4 text-blue-100">
                                <FaChartLine size={32} />
                            </div>
                            <h4 className="font-black text-gray-800 text-lg mb-2">נתוני מכירות בטעינה...</h4>
                            <p className="text-gray-500 text-sm max-w-xs font-medium">כאן יופיע גרף המכירות של ה-30 ימים האחרונים עם השוואה לתקופה קודמת</p>
                        </div>
                    </section>

                    <section className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm hover:shadow-md transition-shadow min-h-[450px] flex flex-col">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
                                <FaChartPie className="text-purple-500" /> פריטים פופולריים
                            </h3>
                            <button className="text-xs font-black text-brand-primary hover:underline">ראה הכל</button>
                        </div>
                        <div className="flex-1 space-y-4">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="flex items-center gap-4 p-4 hover:bg-gray-50 rounded-2xl transition-colors border border-transparent hover:border-gray-100">
                                    <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-sm font-black text-gray-400">#{i}</div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-black text-gray-800">פיצה מרגריטה קלאסי</span>
                                            <span className="text-xs font-black text-brand-primary">142 הזמנות</span>
                                        </div>
                                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-brand-primary transition-all duration-1000"
                                                style={{ width: `${100 - (i * 15)}%`, transitionDelay: `${i * 100}ms` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>

                {/* Insights Footer */}
                <div className="bg-gray-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/20 blur-[100px] -translate-y-1/2 translate-x-1/2" />
                    <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                        <div className="p-5 bg-white/10 rounded-[2rem] backdrop-blur-md">
                            <FaInfoCircle size={40} className="text-brand-primary" />
                        </div>
                        <div className="text-center md:text-right flex-1">
                            <h3 className="text-2xl font-black mb-2">תובנות מהשבוע האחרון</h3>
                            <p className="text-white/60 font-medium">המכירות שלך גדלו ב-12% לעומת שבוע שעבר. השעות הכי חזקות שלך הן בין 19:00 ל-21:00.</p>
                        </div>
                        <button className="bg-white text-gray-900 px-8 py-4 rounded-2xl font-black hover:bg-brand-primary hover:text-white transition-all shadow-xl active:scale-95">
                            קבל דוח מלא במייל
                        </button>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
