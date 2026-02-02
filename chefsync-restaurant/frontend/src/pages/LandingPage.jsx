import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CustomerLayout } from '../layouts/CustomerLayout';
import {
    FaCheck,
    FaRocket,
    FaGift,
    FaCreditCard,
    FaMapLocationDot,
    FaBurger,
    FaStore,
    FaWandMagicSparkles,
    FaCircleXmark,
    FaArrowLeft,
    FaMobileScreen,
    FaCircleCheck,
    FaChartLine,
    FaWhatsapp,
    FaUtensils,
    FaDesktop,
    FaTabletScreenButton
} from "react-icons/fa6";
import { PRODUCT_BYLINE_HE, PRODUCT_NAME } from '../constants/brand';

export default function LandingPage() {
    const [activeDevice, setActiveDevice] = useState('mobile'); // mobile, tablet, desktop

    const benefits = [
        {
            title: 'ללא עמלות – 0%',
            desc: 'הפסק לשלם 30% על כל הזמנה. ב-TakeEat, כל ההכנסות נשארות אצלך.',
            icon: <FaChartLine className="w-6 h-6 text-green-500" />
        },
        {
            title: 'בינה מלאכותית מתקדמת',
            desc: 'כלים חכמים לשיפור תמונות, שיווק וניהול שחוסכים לך זמן.',
            icon: <FaWandMagicSparkles className="w-6 h-6 text-purple-500" />
        },
        {
            title: 'שליטה מלאה במשלוחים',
            desc: 'ניהול אזורי חלוקה, זמנים ושליחים ללא תלות באחרים.',
            icon: <FaMapLocationDot className="w-6 h-6 text-blue-500" />
        },
        {
            title: 'המותג שלך במרכז',
            desc: 'האתר והלקוחות שלך. אנחנו רק הטכנולוגיה מאחורי הקלעים.',
            icon: <FaStore className="w-6 h-6 text-orange-500" />
        }
    ];

    const capabilities = [
        {
            title: 'אזורי חלוקה חכמים',
            desc: 'שרטוט אזורים על מפה, תמחור דינמי ומינימום הזמנה לכל אזור.',
            icon: <FaMapLocationDot className="w-10 h-10 text-brand-primary" />
        },
        {
            title: 'בניית תפריט גמיש',
            desc: 'ממשק ניהול פשוט לוריאציות, תוספות, אופציות ומבצעים מורכבים.',
            icon: <FaBurger className="w-10 h-10 text-brand-primary" />
        },
        {
            title: 'התאמה לכל עסק',
            desc: 'מתאים לפיצריות, המבורגריות, סושי ועוד – המערכת גמישה לכולם.',
            icon: <FaUtensils className="w-10 h-10 text-brand-primary" />
        }
    ];

    const plans = [
        {
            name: 'Standard',
            price: '₪450',
            period: '/ חודש',
            yearlyPrice: 'פיילוט פתוח • ללא התחייבות',
            features: [
                'מערכת הזמנות מלאה (משלוח ואיסוף)',
                'דף אישי למסעדה + תפריט דיגיטלי',
                'שליטה באזורי משלוח והגבלות',
                'מסוף הזמנות למסעדה (Tablet / PWA)',
                'ניהול תפריט, תוספות וקטגוריות',
                'תמיכה בוואטסאפ',
                'סוכן Ai חכם בסיסי למסעדן'
            ],
            highlight: false,
            badge: 'המערכת המלאה'
        },
        {
            name: 'Pro',
            price: '₪600',
            period: '/ חודש',
            yearlyPrice: 'סוכן חכם מתקדם',
            features: [
                'כל מה שיש ב־Standard',
                'סוכן Ai חכם לתובנות עסקיות',
                'שיפור תיאורי מנות אוטומטי',
                'המלצות תמחור חכמות',
                'ניתוח ביצועים ומכירות',
                'הצעות לשיפור תפריט',
                'תמיכה בעדיפות'
            ],
            highlight: true,
            badge: 'סוכן חכם מלא'
        }
    ];

    return (
        <CustomerLayout>
            <div className="-mx-4 sm:-mx-6 lg:-mx-8 space-y-24 pb-20">

                {/* Hero */}
                <div className="relative overflow-hidden bg-brand-dark text-white rounded-b-[2.5rem] sm:rounded-b-[4rem] px-6 sm:px-10 py-20 lg:py-28 shadow-2xl isolate">
                    {/* Abstract Background Shapes */}
                    <div className="absolute inset-0 bg-gradient-to-br from-brand-dark via-brand-primary/90 to-brand-secondary/80 -z-10" />
                    <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 left-0 translate-y-12 -translate-x-12 w-64 h-64 bg-brand-primary/20 rounded-full blur-3xl" />

                    <div className="relative max-w-5xl mx-auto text-center space-y-10">
                        {/* Logo */}
                        <div className="flex justify-center mb-8">
                            <img
                                src="/icons/chefsync-logo-v2-512.png"
                                alt="TakeEat Logo"
                                className="w-32 h-32 sm:w-40 sm:h-40 drop-shadow-2xl hover:scale-105 transition-transform duration-300"
                            />
                        </div>

                        {/* Pill Badge */}
                        <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 text-white px-5 py-2 rounded-full text-sm font-semibold shadow-lg hover:bg-white/15 transition-colors cursor-default">
                            <FaWandMagicSparkles className="text-yellow-300" />
                            <span>המהפכה בניהול המשלוחים כבר כאן</span>
                        </div>

                        {/* Heading */}
                        <h1 className="text-5xl sm:text-6xl lg:text-8xl font-black tracking-tight leading-tight drop-shadow-sm">
                            למה לשלם עמלות?<br />
                            <span className="text-blue-300 bg-clip-text text-transparent bg-gradient-to-r from-blue-200 to-blue-400">
                                שלם חודשית.
                            </span>
                        </h1>

                        <p className="text-xl sm:text-2xl text-blue-100/90 font-medium max-w-3xl mx-auto leading-relaxed">
                            מערכת מתקדמת, 0% עמלה, 100% שליטה שלך.
                        </p>

                        {/* Buttons */}
                        <div className="flex flex-wrap justify-center gap-4 pt-6">
                            <Link
                                to="/register-restaurant"
                                className="group relative px-8 py-4 bg-white text-brand-dark font-bold rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-1 transition text-lg flex items-center gap-3 overflow-hidden"
                            >
                                <span className="relative z-10">התחל 14 יום חינם</span>
                                <FaGift className="relative z-10 text-brand-primary group-hover:rotate-12 transition-transform" />
                                <div className="absolute inset-0 bg-gradient-to-r from-gray-50 to-gray-200 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </Link>
                            <a
                                href="#demo"
                                className="px-8 py-4 bg-white/10 backdrop-blur border border-white/20 text-white font-bold rounded-2xl hover:bg-white/20 transition-all text-lg flex items-center gap-3"
                            >
                                <span>דמו חי</span>
                                <FaCircleCheck className="text-green-400" />
                            </a>
                        </div>

                        {/* Trust Badges */}
                        <div className="pt-10 flex flex-wrap justify-center gap-x-8 gap-y-4 text-sm sm:text-base text-white/70 font-medium">
                            <span className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full border border-white/10">
                                <FaCreditCard className="text-white/50" /> התנסות חינם
                            </span>
                            <span className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full border border-white/10">
                                <FaRocket className="text-white/50" /> הקמה מיידית
                            </span>
                            <span className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full border border-white/10">
                                <FaCircleCheck className="text-white/50" /> ביטול בכל עת
                            </span>
                        </div>
                    </div>
                </div>

                {/* Live Demo Section */}
                <section id="demo" className="max-w-7xl mx-auto px-4 sm:px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 text-gray-900">
                            ראה את המערכת בפעולה
                        </h2>
                        <p className="text-xl text-gray-500 max-w-2xl mx-auto">
                            המערכת כבר חיה ועובדת – נסה בעצמך עכשיו ותראה כמה זה פשוט
                        </p>
                    </div>

                    <div className="bg-white rounded-[2.5rem] p-8 sm:p-12 lg:p-16 border border-gray-100 shadow-2xl shadow-gray-200/50 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-full h-full bg-grid-slate-50 [mask-image:linear-gradient(to_bottom,white,transparent)] pointer-events-none" />

                        <div className="flex flex-col lg:grid lg:grid-cols-2 gap-12 lg:gap-20 items-center relative z-10">
                            {/* Device Mockups with Tabs */}
                            <div className="relative mx-auto w-full max-w-[700px] lg:order-last">
                                {/* Device Tabs */}
                                <div className="flex justify-center gap-3 mb-8">
                                    <button
                                        onClick={() => setActiveDevice('mobile')}
                                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${activeDevice === 'mobile'
                                                ? 'bg-gradient-to-r from-brand-primary to-brand-secondary text-white shadow-lg scale-105'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                    >
                                        <FaMobileScreen className="text-lg" />
                                        <span className="hidden sm:inline">מובייל</span>
                                    </button>
                                    <button
                                        onClick={() => setActiveDevice('tablet')}
                                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${activeDevice === 'tablet'
                                                ? 'bg-gradient-to-r from-brand-primary to-brand-secondary text-white shadow-lg scale-105'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                    >
                                        <FaTabletScreenButton className="text-lg" />
                                        <span className="hidden sm:inline">טאבלט</span>
                                    </button>
                                    <button
                                        onClick={() => setActiveDevice('desktop')}
                                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${activeDevice === 'desktop'
                                                ? 'bg-gradient-to-r from-brand-primary to-brand-secondary text-white shadow-lg scale-105'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                    >
                                        <FaDesktop className="text-lg" />
                                        <span className="hidden sm:inline">מחשב</span>
                                    </button>
                                </div>

                                {/* Device Mockups */}
                                <div className="relative">
                                    {/* Mobile Mockup */}
                                    {activeDevice === 'mobile' && (
                                        <div className="relative w-full max-w-[300px] mx-auto aspect-[9/19] transition-all duration-500 animate-fadeIn">
                                            <div className="absolute inset-0 bg-gray-900 rounded-[50px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] p-3 ring-4 ring-gray-100">
                                                <div className="w-full h-full bg-white rounded-[40px] overflow-hidden relative">
                                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-7 bg-gray-900 rounded-b-2xl z-20"></div>
                                                    <iframe
                                                        src="https://chefsync.vercel.app/"
                                                        className="w-full h-full border-0"
                                                        title="Mobile Demo"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Tablet Mockup */}
                                    {activeDevice === 'tablet' && (
                                        <div className="relative w-full max-w-[500px] mx-auto aspect-[3/4] transition-all duration-500 animate-fadeIn">
                                            <div className="absolute inset-0 bg-gray-900 rounded-[40px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] p-4 ring-4 ring-gray-100">
                                                <div className="w-full h-full bg-white rounded-[32px] overflow-hidden relative">
                                                    <iframe
                                                        src="https://chefsync.vercel.app/"
                                                        className="w-full h-full border-0"
                                                        title="Tablet Demo"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Desktop Mockup */}
                                    {activeDevice === 'desktop' && (
                                        <div className="relative w-full transition-all duration-500 animate-fadeIn">
                                            <div className="bg-gray-900 rounded-t-2xl p-2 shadow-2xl">
                                                <div className="flex items-center gap-2 mb-2 px-2">
                                                    <div className="flex gap-1.5">
                                                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                                                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                                    </div>
                                                    <div className="flex-1 bg-gray-800 rounded-lg px-4 py-1.5 text-xs text-gray-400">
                                                        chefsync.vercel.app
                                                    </div>
                                                </div>
                                                <div className="bg-white rounded-lg overflow-hidden aspect-[16/10]">
                                                    <iframe
                                                        src="https://chefsync.vercel.app/"
                                                        className="w-full h-full border-0"
                                                        title="Desktop Demo"
                                                    />
                                                </div>
                                            </div>
                                            <div className="h-4 bg-gray-800 rounded-b-2xl shadow-2xl"></div>
                                        </div>
                                    )}

                                    {/* LIVE Badge */}
                                    <div className="absolute -top-4 -right-4 bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg z-30 flex items-center gap-2">
                                        <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                                        LIVE
                                    </div>
                                </div>
                            </div>

                            {/* Demo Controls */}
                            <div className="space-y-8 w-full">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-brand-primary font-bold tracking-wide text-sm uppercase">
                                        <FaUtensils />
                                        <span>נסה בעצמך</span>
                                    </div>
                                    <h3 className="text-3xl font-bold text-gray-900">
                                        אחת המערכות, אינסוף אפשרויות
                                    </h3>
                                    <p className="text-gray-600 leading-relaxed">
                                        בין אם יש לך פיצרייה, המבורגריה או סושייה, TakeEat מתאימה את עצמה למותג שלך.
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    {[
                                        { name: 'Pizza Palace', sub: 'פיצה איטלקית', url: 'https://chefsync.vercel.app/pizza-palace/menu', color: 'hover:border-red-500 hover:bg-red-50' },
                                        { name: 'Burger Central', sub: 'המבורגר פרימיום', url: 'https://chefsync.vercel.app/burger-central/menu', color: 'hover:border-orange-500 hover:bg-orange-50' }
                                    ].map((store) => (
                                        <a
                                            key={store.name}
                                            href={store.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={`block p-5 border border-gray-200 rounded-2xl bg-white transition-all duration-300 group ${store.color}`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="font-bold text-lg text-gray-900">{store.name}</p>
                                                    <p className="text-sm text-gray-500">{store.sub}</p>
                                                </div>
                                                <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-white transition-colors">
                                                    <FaArrowLeft className="text-gray-400 group-hover:text-gray-900 transition-colors" />
                                                </div>
                                            </div>
                                        </a>
                                    ))}
                                </div>

                                <div className="bg-blue-50/50 border border-blue-100 p-6 rounded-2xl flex gap-4">
                                    <div className="mt-1 bg-blue-100 text-blue-600 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <FaWandMagicSparkles className="text-sm" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900 text-sm mb-1">טיפ לבדיקה</h4>
                                        <p className="text-sm text-gray-600 leading-relaxed">
                                            נסה להוסיף מנות לעגלה ולראות כמה מהר המערכת מגיבה.
                                            הכל עובד חלק, בלי טעינות מיותרות.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Capabilities Cards */}
                <section className="max-w-7xl mx-auto px-4 sm:px-6">
                    <div className="grid md:grid-cols-3 gap-8">
                        {capabilities.map((cap, i) => (
                            <div key={i} className="group bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                                <div className="mb-6 bg-brand-light/30 w-20 h-20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                    {cap.icon}
                                </div>
                                <h3 className="text-2xl font-bold mb-4 text-gray-900">{cap.title}</h3>
                                <p className="text-gray-600 leading-relaxed">{cap.desc}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Benefits Grid */}
                <section className="bg-gray-50/50 py-24 border-y border-gray-100/50">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6">
                        <h2 className="text-4xl font-bold text-center mb-16 text-gray-900">היתרונות שלנו</h2>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
                            {benefits.map((item, i) => (
                                <div key={i} className="bg-white p-8 rounded-3xl shadow-[0_2px_20px_rgb(0,0,0,0.04)] border border-gray-100 hover:border-brand-primary/30 transition duration-300 flex flex-col items-start gap-4">
                                    <div className="p-3 bg-gray-50 rounded-2xl">
                                        {item.icon}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold mb-2 text-gray-900">{item.title}</h3>
                                        <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Comparison Section */}
                <section className="max-w-5xl mx-auto px-4 sm:px-6">
                    <div className="text-center mb-12">
                        <span className="text-brand-primary font-bold tracking-wider text-sm uppercase">השוואה עסקית</span>
                        <h2 className="text-4xl font-bold mt-2 mb-4 text-gray-900">למה לשלם יותר?</h2>
                        <p className="text-gray-600 text-lg">ההבדל בין שותף לבין ספק שירות</p>
                    </div>

                    <div className="grid md:grid-cols-2 shadow-2xl shadow-gray-200/50 rounded-[2.5rem] overflow-hidden border border-gray-100 bg-white">
                        {/* Commission Model */}
                        <div className="p-10 bg-gray-50/80 border-b md:border-b-0 md:border-l border-gray-100">
                            <h3 className="text-xl font-bold text-gray-500 mb-8 flex items-center gap-3">
                                <div className="p-2 bg-gray-200 rounded-lg"><FaStore /></div>
                                <span>מודל העמלות</span>
                                <span className="mr-auto text-xs font-bold bg-gray-200 px-2 py-1 rounded text-gray-600">הישן</span>
                            </h3>
                            <ul className="space-y-6">
                                {[
                                    { label: 'עלות למסעדה', val: '27% - 30% מהמחזור', bad: true },
                                    { label: 'בעלות על הלקוח', val: 'של הפלטפורמה' },
                                    { label: 'מיתוג', val: 'כללי / גנרי' },
                                    { label: 'שליטה באזורים', val: 'מוגבלת' }
                                ].map((row, i) => (
                                    <li key={i} className="flex justify-between items-center text-gray-500">
                                        <span>{row.label}</span>
                                        <span className={`font-medium ${row.bad ? 'text-red-500 bg-red-50 px-2 py-1 rounded' : 'text-gray-700 bg-gray-200/50 px-2 py-1 rounded text-sm'}`}>
                                            {row.val}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                            <div className="mt-8 pt-8 border-t border-gray-200 text-center text-gray-400 text-sm">
                                <FaCircleXmark className="inline-block mb-1 text-red-300 text-xl" />
                                <p>שוחק את הרווחיות</p>
                            </div>
                        </div>

                        {/* Fixed Model (TakeEat) */}
                        <div className="p-10 bg-white relative">
                            <div className="absolute top-0 left-0 w-full h-1.5 bg-brand-primary"></div>
                            <h3 className="text-xl font-bold text-brand-primary mb-8 flex items-center gap-3">
                                <div className="p-2 bg-brand-primary/10 rounded-lg"><FaRocket /></div>
                                <span>מודל קבוע</span>
                                <span className="mr-auto text-xs font-bold bg-brand-primary text-white px-2 py-1 rounded">TakeEat</span>
                            </h3>
                            <ul className="space-y-6">
                                {[
                                    { label: 'עלות למסעדה', val: '0% עמלה', super: true },
                                    { label: 'בעלות על הלקוח', val: '100% שלך' },
                                    { label: 'מיתוג', val: 'המותג שלך במרכז' },
                                    { label: 'שליטה באזורים', val: 'שליטה מלאה' }
                                ].map((row, i) => (
                                    <li key={i} className="flex justify-between items-center text-gray-900 font-medium">
                                        <span>{row.label}</span>
                                        <span className={`text-sm px-2 py-1 rounded ${row.super ? 'text-green-600 bg-green-50 font-bold text-base' : 'bg-brand-light text-brand-dark'}`}>
                                            {row.val}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                            <div className="mt-8 pt-8 border-t border-gray-100 text-center text-brand-primary text-sm font-medium">
                                <FaCircleCheck className="inline-block mb-1 text-green-500 text-xl" />
                                <p>מקסימום רווח למסעדה</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Pricing Plans */}
                <section id="pricing" className="max-w-5xl mx-auto px-4 sm:px-6">
                    <h2 className="text-4xl font-bold text-center mb-16 text-gray-900">תכניות ומחירים</h2>

                    <div className="grid md:grid-cols-2 gap-8 items-start">
                        {plans.map((plan) => (
                            <div
                                key={plan.name}
                                className={`relative p-8 rounded-[2rem] border transition-all duration-300 ${plan.highlight
                                    ? 'bg-white shadow-2xl shadow-brand-primary/10 border-brand-primary ring-1 ring-brand-primary/20 scale-105 z-10'
                                    : 'bg-white border-gray-100 text-gray-600 hover:border-gray-300 hover:shadow-lg'
                                    }`}
                            >
                                {plan.highlight && (
                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-brand-primary text-white text-sm font-bold px-4 py-1.5 rounded-full shadow-lg flex items-center gap-1">
                                        <FaWandMagicSparkles className="text-yellow-300 text-xs" />
                                        {plan.badge}
                                    </div>
                                )}

                                <div className="text-center mb-8">
                                    <h3 className={`text-2xl font-bold mb-4 ${plan.highlight ? 'text-brand-primary' : 'text-gray-900'}`}>
                                        {plan.name}
                                    </h3>
                                    <div className="flex justify-center items-baseline gap-1">
                                        <span className={`text-5xl font-black ${plan.highlight ? 'text-gray-900' : 'text-gray-900'}`}>
                                            {plan.price}
                                        </span>
                                        <span className="text-gray-500 font-medium text-lg">{plan.period}</span>
                                    </div>
                                    <p className="text-sm text-gray-400 mt-2 font-medium">{plan.yearlyPrice}</p>
                                </div>

                                <ul className="space-y-4 mb-10">
                                    {plan.features.map((feature, i) => (
                                        <li key={i} className="flex items-start gap-3">
                                            <div className={`mt-1 rounded-full p-0.5 ${plan.highlight ? 'bg-brand-primary/10 text-brand-primary' : 'bg-gray-100 text-gray-400'}`}>
                                                <FaCheck className="text-xs" />
                                            </div>
                                            <span className="text-gray-600 text-[15px]">{feature}</span>
                                        </li>
                                    ))}
                                </ul>

                                <Link
                                    to="/register-restaurant"
                                    className={`block w-full py-4 rounded-xl font-bold text-center transition-all ${plan.highlight
                                        ? 'bg-brand-primary text-white hover:bg-brand-primary/90 shadow-lg hover:shadow-brand-primary/30 hover:-translate-y-0.5'
                                        : 'bg-gray-50 border border-gray-200 text-gray-900 hover:bg-gray-100 hover:border-gray-300'
                                        }`}
                                >
                                    בחר {plan.name}
                                </Link>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Trusted By - Infinite Logo Carousel */}
                <section className="py-20 overflow-hidden bg-white">
                    <div className="text-center mb-12">
                        <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">מסעדות שסומכות עלינו</p>
                        <h3 className="text-2xl font-bold text-gray-900">המותגים שכבר איתנו</h3>
                    </div>

                    <div className="relative">
                        {/* Gradient Masks */}
                        <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none"></div>
                        <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none"></div>

                        {/* Infinite Scroll Container */}
                        <div className="flex gap-16 animate-ticker">
                            {/* Logo 1: TakeEat */}
                            <div className="flex items-center justify-center min-w-[240px] h-32 grayscale hover:grayscale-0 transition-all duration-300">
                                <img
                                    src="/icons/chefsync-logo-v2-512.png"
                                    alt="TakeEat"
                                    className="h-24 w-auto object-contain opacity-60 hover:opacity-100 transition-opacity"
                                />
                            </div>

                            {/* Logo 2: חלבוד */}
                            <div className="flex items-center justify-center min-w-[240px] h-32 grayscale hover:grayscale-0 transition-all duration-300">
                                <img
                                    src="/logos/halabud.png"
                                    alt="חלבוד"
                                    className="h-24 w-auto object-contain opacity-60 hover:opacity-100 transition-opacity"
                                />
                            </div>

                            {/* Logo 3: חלבוד */}
                            <div className="flex items-center justify-center min-w-[240px] h-32 grayscale hover:grayscale-0 transition-all duration-300">
                                <img
                                    src="/logos/halabud.png"
                                    alt="חלבוד"
                                    className="h-24 w-auto object-contain opacity-60 hover:opacity-100 transition-opacity"
                                />
                            </div>

                            {/* Logo 4: חלבוד */}
                            <div className="flex items-center justify-center min-w-[240px] h-32 grayscale hover:grayscale-0 transition-all duration-300">
                                <img
                                    src="/logos/halabud.png"
                                    alt="חלבוד"
                                    className="h-24 w-auto object-contain opacity-60 hover:opacity-100 transition-opacity"
                                />
                            </div>

                            {/* Duplicate for infinite loop - Logo 1 */}
                            <div className="flex items-center justify-center min-w-[240px] h-32 grayscale hover:grayscale-0 transition-all duration-300">
                                <img
                                    src="/icons/chefsync-logo-v2-512.png"
                                    alt="TakeEat"
                                    className="h-24 w-auto object-contain opacity-60 hover:opacity-100 transition-opacity"
                                />
                            </div>

                            {/* Duplicate - Logo 2 */}
                            <div className="flex items-center justify-center min-w-[240px] h-32 grayscale hover:grayscale-0 transition-all duration-300">
                                <img
                                    src="/logos/halabud.png"
                                    alt="חלבוד"
                                    className="h-24 w-auto object-contain opacity-60 hover:opacity-100 transition-opacity"
                                />
                            </div>

                            {/* Duplicate - Logo 3 */}
                            <div className="flex items-center justify-center min-w-[240px] h-32 grayscale hover:grayscale-0 transition-all duration-300">
                                <img
                                    src="/logos/halabud.png"
                                    alt="חלבוד"
                                    className="h-24 w-auto object-contain opacity-60 hover:opacity-100 transition-opacity"
                                />
                            </div>

                            {/* Duplicate - Logo 4 */}
                            <div className="flex items-center justify-center min-w-[240px] h-32 grayscale hover:grayscale-0 transition-all duration-300">
                                <img
                                    src="/logos/halabud.png"
                                    alt="חלבוד"
                                    className="h-24 w-auto object-contain opacity-60 hover:opacity-100 transition-opacity"
                                />
                            </div>
                        </div>
                    </div>
                </section>

                {/* CTA */}
                <section className="bg-brand-dark text-white rounded-t-[3rem] mt-24 px-6 py-24 text-center relative overflow-hidden">
                    {/* Background Glow */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-brand-primary/20 rounded-full blur-3xl -z-10" />

                    <div className="max-w-3xl mx-auto space-y-8 relative z-10">
                        <h2 className="text-4xl sm:text-5xl font-black tracking-tight">מוכנים להתקדם?</h2>
                        <p className="text-xl text-blue-100/80 leading-relaxed max-w-2xl mx-auto">
                            הצטרפו למסעדות הראשונות שעוברות למודל קבוע
                            והתחילו לחסוך עמלות כבר מההזמנה הראשונה                         </p>
                        <div className="pt-4">
                            <Link
                                to="/register-restaurant"
                                className="inline-flex items-center gap-3 px-12 py-6 bg-white text-brand-dark font-bold rounded-2xl text-xl hover:scale-105 transition-transform shadow-2xl"
                            >
                                <span>התחל 14 ימי ניסיון חינם</span>
                                <FaArrowLeft className="text-brand-primary" />
                            </Link>
                        </div>
                        <p className="text-sm text-white/30 font-medium">ללא התחייבות • שירות אישי</p>
                    </div>
                </section>

            </div>
        </CustomerLayout>
    );
}
