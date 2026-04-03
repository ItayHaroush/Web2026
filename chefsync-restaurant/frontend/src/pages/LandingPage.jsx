import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { CustomerLayout } from '../layouts/CustomerLayout';
import {
    FaGift,
    FaMapLocationDot,
    FaBurger,
    FaStore,
    FaWandMagicSparkles,
    FaArrowLeft,
    FaMobileScreen,
    FaCircleCheck,
    FaChartLine,
    FaUtensils,
    FaDesktop,
    FaTabletScreenButton,
    FaListCheck,
    FaTags,
    FaCashRegister,
    FaTv,
    FaPuzzlePiece,
    FaChartPie,
    FaRocket,
} from "react-icons/fa6";

/* Simple image carousel for features with multiple screenshots */
function FeatureImageCarousel({ images }) {
    const [current, setCurrent] = useState(0);
    useEffect(() => {
        if (images.length <= 1) return;
        const timer = setInterval(() => setCurrent((c) => (c + 1) % images.length), 3500);
        return () => clearInterval(timer);
    }, [images.length]);

    return (
        <div className="relative w-full aspect-[16/10] bg-gray-100 dark:bg-brand-dark-bg overflow-hidden">
            {images.map((src, idx) => (
                <img
                    key={idx}
                    src={src}
                    alt=""
                    className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-700 ${idx === current ? 'opacity-100' : 'opacity-0'}`}
                    loading="lazy"
                />
            ))}
            {images.length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                    {images.map((_, idx) => (
                        <button
                            key={idx}
                            onClick={() => setCurrent(idx)}
                            className={`w-2.5 h-2.5 rounded-full transition-all ${idx === current ? 'bg-brand-primary scale-125' : 'bg-gray-300 dark:bg-gray-600'}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export default function LandingPage() {
    const [activeDevice, setActiveDevice] = useState('mobile');
    const mockupRef = useRef(null);

    const switchDevice = (key) => {
        setActiveDevice(key);
        if (key === 'desktop' && mockupRef.current) {
            setTimeout(() => mockupRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
        }
    };

    /* ── Scroll Reveal ── */
    const revealRefs = useRef([]);
    const addRevealRef = useCallback((el) => {
        if (el && !revealRefs.current.includes(el)) revealRefs.current.push(el);
    }, []);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('revealed');
                        observer.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.12 }
        );
        revealRefs.current.forEach((el) => observer.observe(el));
        return () => observer.disconnect();
    }, []);

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
            icon: <FaMapLocationDot className="w-6 h-6 text-brand-primary" />
        },
        {
            title: 'המותג שלך במרכז',
            desc: 'האתר והלקוחות שלך. אנחנו רק הטכנולוגיה מאחורי הקלעים.',
            icon: <FaStore className="w-6 h-6 text-orange-500" />
        }
    ];

    const features = [
        {
            title: 'ניהול תפריט מתקדם',
            desc: 'ממשק ניהול אינטואיטיבי לבניית תפריט מלא – קטגוריות, מנות, וריאציות, תמונות ותיאורים. עדכן את התפריט בזמן אמת ללא צורך במתכנת.',
            video: '/videos/menu-management.mp4',
            icon: <FaBurger className="w-6 h-6" />,
            color: 'text-orange-500',
            bg: 'bg-orange-50 dark:bg-orange-900/20',
        },
        {
            title: 'לוח הזמנות חי',
            desc: 'מעקב אחרי כל ההזמנות בזמן אמת – סטטוסים, זמנים, פרטי לקוח ופריטים. קבל התראות על הזמנות חדשות וטפל בהן ישירות מהמסך.',
            video: '/videos/order-dashboard.mp4',
            icon: <FaListCheck className="w-6 h-6" />,
            color: 'text-blue-500',
            bg: 'bg-blue-50 dark:bg-blue-900/20',
        },
        {
            title: 'אזורי משלוח חכמים',
            desc: 'הגדר אזורי חלוקה על המפה עם תמחור דינמי – עלות קבועה, לפי קילומטר או מדורג. קבע מינימום הזמנה וזמני אספקה לכל אזור.',
            images: ['/screenshots/delivery-zones-1.webp', '/screenshots/delivery-zones-2.webp'],
            icon: <FaMapLocationDot className="w-6 h-6" />,
            color: 'text-emerald-500',
            bg: 'bg-emerald-50 dark:bg-emerald-900/20',
        },
        {
            title: 'מבצעים והטבות',
            desc: 'צור מבצעים מורכבים עם כללים ותגמולים – אחוז הנחה, מוצר במתנה, מחיר קבוע ועוד. קבע שעות פעילות, ימים ותנאי סף אוטומטיים.',
            video: '/videos/promotions.mp4',
            icon: <FaTags className="w-6 h-6" />,
            color: 'text-purple-500',
            bg: 'bg-purple-50 dark:bg-purple-900/20',
        },
        {
            title: 'מסוף הזמנות (POS)',
            desc: 'מסוף ניהול ייעודי לטאבלט – קבל הזמנות, עדכן סטטוסים, הדפס קבלות. ממשק נקי ומהיר שמתאים לסביבת עבודה עמוסה.',
            video: '/videos/pos-terminal.mp4',
            icon: <FaCashRegister className="w-6 h-6" />,
            color: 'text-rose-500',
            bg: 'bg-rose-50 dark:bg-rose-900/20',
        },
        {
            title: 'דוחות וניתוח ביצועים',
            desc: 'תובנות עסקיות חכמות – מכירות יומיות, מנות פופולריות, שעות שיא ומגמות. כל הנתונים שצריך כדי לקבל החלטות מבוססות.',
            video: '/videos/reports.mp4',
            icon: <FaChartPie className="w-6 h-6" />,
            color: 'text-cyan-500',
            bg: 'bg-cyan-50 dark:bg-cyan-900/20',
        },
        {
            title: 'קבוצות תוספות',
            desc: 'הגדר תוספות גמישות לכל מנה – גודל, רטבים, סלטים, סוג לחמנייה. קבע חובה/אופציונלי, מקסימום בחירות ומחיר לכל תוספת.',
            video: '/videos/addon-groups.mp4',
            icon: <FaPuzzlePiece className="w-6 h-6" />,
            color: 'text-amber-500',
            bg: 'bg-amber-50 dark:bg-amber-900/20',
        },
        {
            title: 'מסך תצוגה למטבח',
            desc: 'מסך תצוגה חי שמציג את ההזמנות הפעילות לצוות המטבח. מעבר חלק בין הזמנות, סימון פריטים מוכנים ועדכון סטטוס בלחיצה.',
            video: '/videos/display-screen.mp4',
            icon: <FaTv className="w-6 h-6" />,
            color: 'text-indigo-500',
            bg: 'bg-indigo-50 dark:bg-indigo-900/20',
        },
    ];

    return (
        <CustomerLayout>
            <div className="-mx-4 sm:-mx-6 lg:-mx-8">

                {/* ═══════════════════════════════════════════
                    1. HERO – Clean text, no mockup
                ═══════════════════════════════════════════ */}
                <div className="relative overflow-hidden bg-brand-dark text-white rounded-b-[2.5rem] sm:rounded-b-[4rem] px-6 sm:px-10 py-16 lg:py-24 shadow-2xl isolate">
                    <div className="absolute inset-0 bg-gradient-to-br from-brand-dark via-brand-primary/90 to-brand-secondary/80 -z-10" />
                    <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 left-0 translate-y-12 -translate-x-12 w-64 h-64 bg-brand-primary/20 rounded-full blur-3xl" />

                    {/* Logo – mobile: centered ghost, desktop: top-right */}
                    <img
                        src="/icons/chefsync-logo-v2-512.png"
                        alt="TakeEat Logo"
                        className="absolute brightness-0 invert z-0 md:top-6 md:right-8 lg:top-8 lg:right-14 md:w-44 md:h-44 lg:w-56 lg:h-56 md:opacity-30 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 md:translate-x-0 md:translate-y-0 md:left-auto w-56 h-56 sm:w-72 sm:h-72 opacity-10"
                    />

                    <div className="relative max-w-5xl mx-auto text-center space-y-10 z-10" style={{ direction: 'rtl' }}>

                        {/* Desktop content */}
                        <div className="hidden md:block space-y-8">
                            <span className="text-4xl lg:text-6xl font-black tracking-tight text-white drop-shadow-lg">
                                TakeEat
                            </span>
                            <h1 className="text-5xl lg:text-7xl font-black tracking-tight leading-tight text-center">
                                מסעדה משלך.
                                <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-orange-300">
                                    בלי עמלות.
                                </span>
                            </h1>
                            <p className="text-xl lg:text-2xl text-white/80 font-medium leading-relaxed max-w-3xl mx-auto">
                                מערכת הזמנות חכמה למסעדות
                                <br />
                                בלי שליחים, בלי אחוזים — תשלום חודשי קבוע
                            </p>
                            <div className="flex flex-wrap justify-center gap-4 pt-4">
                                <Link
                                    to="/register-restaurant"
                                    className="group px-10 py-5 bg-white text-brand-dark font-black rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-1 transition text-xl flex items-center gap-3"
                                >
                                    <span>60 יום ניסיון חינם</span>
                                    <FaGift className="text-brand-primary text-2xl group-hover:rotate-12 transition-transform" />
                                </Link>
                                <a
                                    href="#demo"
                                    className="px-8 py-5 bg-white/10 backdrop-blur border border-white/20 text-white font-bold rounded-2xl hover:bg-white/20 transition-all text-lg"
                                >
                                    ראה מסעדות במערכת
                                </a>
                            </div>
                            <p className="text-sm text-white/50 font-medium">לא צריך כרטיס אשראי</p>
                        </div>

                        {/* Mobile content */}
                        <div className="md:hidden space-y-7">
                            <span className="text-3xl sm:text-4xl font-black tracking-tight text-white drop-shadow-lg block">
                                TakeEat
                            </span>
                            <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight">
                                תפסיק לשלם עמלות
                                <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-orange-300">
                                    על כל הזמנה
                                </span>
                            </h1>
                            <p className="text-lg text-white/80 font-medium leading-relaxed">
                                קח שליטה על ההזמנות שלך
                                <br />
                                ותשאיר את הרווח אצלך
                            </p>
                            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                                <Link
                                    to="/register-restaurant"
                                    className="px-8 py-4 bg-white text-brand-dark font-black rounded-2xl shadow-xl text-lg text-center flex items-center justify-center gap-3"
                                >
                                    <span>60 יום ניסיון חינם</span>
                                    <FaGift className="text-brand-primary text-xl" />
                                </Link>
                                <a
                                    href="#demo"
                                    className="px-8 py-4 bg-white/10 backdrop-blur border border-white/20 text-white font-bold rounded-2xl text-lg text-center"
                                >
                                    טיפים למסעדנים
                                </a>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ═══════════════════════════════════════════
                    2. FLOW – Live Demo with 3 Device Tabs
                ═══════════════════════════════════════════ */}
                <section id="demo" ref={addRevealRef} className="scroll-reveal max-w-7xl mx-auto px-4 sm:px-6 mt-24">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 text-gray-900 dark:text-brand-dark-text">
                            ראה את המערכת בפעולה
                        </h2>
                        <p className="text-xl text-gray-500 dark:text-brand-dark-muted max-w-2xl mx-auto">
                            המערכת כבר חיה ועובדת – נסה בעצמך עכשיו
                        </p>
                    </div>

                    <div className="bg-white dark:bg-brand-dark-surface rounded-[2.5rem] p-6 sm:p-10 lg:p-14 border border-gray-100 dark:border-brand-dark-border shadow-2xl shadow-gray-200/50 dark:shadow-black/20 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-full h-full bg-grid-slate-50 [mask-image:linear-gradient(to_bottom,white,transparent)] pointer-events-none" />

                        <div className={`flex flex-col ${activeDevice !== 'desktop' ? 'lg:grid lg:grid-cols-2 gap-12 lg:gap-20' : 'gap-12'} items-center relative z-10`}>
                            {/* Device Mockups with Tabs – Desktop only */}
                            <div className={`relative mx-auto w-full lg:order-last hidden lg:block ${activeDevice === 'desktop' ? 'max-w-full' : 'max-w-[700px]'}`}>
                                {/* Device Tabs */}
                                <div className="flex justify-center gap-3 mb-8">
                                    {[
                                        { key: 'mobile', icon: <FaMobileScreen className="text-lg" />, label: 'מובייל' },
                                        { key: 'tablet', icon: <FaTabletScreenButton className="text-lg" />, label: 'טאבלט' },
                                        { key: 'desktop', icon: <FaDesktop className="text-lg" />, label: 'מחשב' },
                                    ].map((tab) => (
                                        <button
                                            key={tab.key}
                                            onClick={() => switchDevice(tab.key)}
                                            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${activeDevice === tab.key
                                                ? 'bg-gradient-to-r from-brand-primary to-brand-secondary text-white shadow-lg scale-105'
                                                : 'bg-gray-100 dark:bg-brand-dark-bg text-gray-600 dark:text-brand-dark-muted hover:bg-gray-200 dark:hover:bg-brand-dark-border'
                                            }`}
                                        >
                                            {tab.icon}
                                            <span className="hidden sm:inline">{tab.label}</span>
                                        </button>
                                    ))}
                                </div>

                                {/* Device Mockups */}
                                <div ref={mockupRef} className="relative">
                                    {activeDevice === 'mobile' && (
                                        <div className="relative w-full max-w-[300px] mx-auto aspect-[9/19] transition-all duration-500 animate-fadeIn">
                                            <div className="absolute inset-0 bg-gray-900 rounded-[50px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] p-3 ring-4 ring-gray-100">
                                                <div className="w-full h-full bg-white rounded-[40px] overflow-hidden relative">
                                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-7 bg-gray-900 rounded-b-2xl z-20" />
                                                    <iframe src="https://chefsync.vercel.app/?embed=1" className="w-full h-full border-0" title="Mobile Demo" loading="lazy" />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Tablet */}
                                    {activeDevice === 'tablet' && (
                                        <div className="relative w-full max-w-[500px] mx-auto aspect-[3/4] transition-all duration-500 animate-fadeIn">
                                            <div className="absolute inset-0 bg-gray-900 rounded-[40px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] p-4 ring-4 ring-gray-100">
                                                <div className="w-full h-full bg-white rounded-[32px] overflow-hidden relative">
                                                    <iframe src="https://chefsync.vercel.app/?embed=1" className="w-full h-full border-0" title="Tablet Demo" loading="lazy" />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Desktop – Laptop Mockup */}
                                    {activeDevice === 'desktop' && (
                                        <div className="relative w-full transition-all duration-500 animate-fadeIn">
                                            {/* Screen */}
                                            <div className="relative bg-[#1a1a1a] rounded-t-xl p-[6px] pb-0 shadow-2xl border border-gray-700/50">
                                                {/* Camera */}
                                                <div className="absolute top-[3px] left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-gray-700 z-10" />
                                                {/* Browser bar */}
                                                <div className="bg-[#2d2d2d] rounded-t-lg px-3 py-1.5 flex items-center gap-2">
                                                    <div className="flex gap-1">
                                                        <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
                                                        <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
                                                        <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
                                                    </div>
                                                    <div className="flex-1 bg-[#1a1a1a] rounded-md px-3 py-1 text-[10px] text-gray-500 font-mono">
                                                        takeeat.co.il
                                                    </div>
                                                </div>
                                                {/* Content */}
                                                <div className="bg-white overflow-hidden aspect-[16/10]">
                                                    <iframe src="https://chefsync.vercel.app/?embed=1" className="w-full h-full border-0" title="Desktop Demo" loading="lazy" />
                                                </div>
                                            </div>
                                            {/* Hinge */}
                                            <div className="relative mx-auto">
                                                <div className="h-3 bg-gradient-to-b from-[#2d2d2d] to-[#1a1a1a] rounded-b-sm mx-[2%]" />
                                                {/* Keyboard base */}
                                                <div className="h-3 bg-gradient-to-b from-[#c0c0c0] to-[#a8a8a8] rounded-b-xl mx-[-2%] shadow-[0_4px_15px_rgba(0,0,0,0.2)]" />
                                            </div>
                                        </div>
                                    )}

                                    {/* LIVE Badge */}
                                    <div className="absolute -top-4 -right-4 bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg z-30 flex items-center gap-2">
                                        <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
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
                                    <h3 className="text-3xl font-bold text-gray-900 dark:text-brand-dark-text">
                                        אחת המערכות, אינסוף אפשרויות
                                    </h3>
                                    <p className="text-gray-600 dark:text-brand-dark-muted leading-relaxed">
                                        בין אם יש לך פיצרייה, המבורגריה או סושייה, TakeEat מתאימה את עצמה למותג שלך.
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    {[
                                        { name: 'Pizza Palace', sub: 'פיצה איטלקית', url: 'https://chefsync.vercel.app/pizza-palace/menu', color: 'hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-900/10' },
                                        { name: 'Burger Central', sub: 'המבורגר פרימיום', url: 'https://chefsync.vercel.app/burger-central/menu', color: 'hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/10' }
                                    ].map((store) => (
                                        <a
                                            key={store.name}
                                            href={store.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={`block p-5 border border-gray-200 dark:border-brand-dark-border rounded-2xl bg-white dark:bg-brand-dark-bg transition-all duration-300 group ${store.color}`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="font-bold text-lg text-gray-900 dark:text-brand-dark-text">{store.name}</p>
                                                    <p className="text-sm text-gray-500 dark:text-brand-dark-muted">{store.sub}</p>
                                                </div>
                                                <div className="w-10 h-10 rounded-full bg-gray-50 dark:bg-brand-dark-border flex items-center justify-center group-hover:bg-white dark:group-hover:bg-brand-dark-surface transition-colors">
                                                    <FaArrowLeft className="text-gray-400 group-hover:text-gray-900 dark:group-hover:text-brand-dark-text transition-colors" />
                                                </div>
                                            </div>
                                        </a>
                                    ))}
                                </div>

                                <div className="bg-orange-50/50 dark:bg-orange-900/10 border border-orange-200 dark:border-brand-primary/20 p-5 rounded-2xl flex gap-4">
                                    <div className="mt-1 bg-orange-100 dark:bg-brand-primary/20 text-brand-primary w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <FaWandMagicSparkles className="text-sm" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900 dark:text-brand-dark-text text-sm mb-1">טיפ לבדיקה</h4>
                                        <p className="text-sm text-gray-600 dark:text-brand-dark-muted leading-relaxed">
                                            נסה להוסיף מנות לעגלה ולראות כמה מהר המערכת מגיבה.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ═══════════════════════════════════════════
                    3. FEATURE SHOWCASE – Screenshots & Details
                ═══════════════════════════════════════════ */}
                <section ref={addRevealRef} className="scroll-reveal max-w-7xl mx-auto px-4 sm:px-6 mt-24">
                    <div className="text-center mb-20">
                        <span className="text-brand-primary font-bold tracking-wider text-sm uppercase">הצצה למערכת</span>
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mt-3 mb-4 text-gray-900 dark:text-brand-dark-text">
                            הכלים שמנהלים את המסעדה שלך
                        </h2>
                        <p className="text-xl text-gray-500 dark:text-brand-dark-muted max-w-2xl mx-auto">
                            כל מה שצריך בלוח בקרה אחד – תפריט, הזמנות, משלוחים, מבצעים ועוד
                        </p>
                    </div>

                    <div className="space-y-24 lg:space-y-32">
                        {features.map((feature, i) => (
                            <div
                                ref={addRevealRef}
                                key={i}
                                className={`scroll-reveal flex flex-col ${i % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'} gap-10 lg:gap-16 items-center`}
                                style={{ transitionDelay: `${(i % 3) * 120}ms` }}
                            >
                                {/* Media: Video or Image Carousel */}
                                <div className="w-full lg:w-3/5 relative group">
                                    <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-gray-200/60 dark:shadow-black/30 border border-gray-100 dark:border-brand-dark-border bg-white dark:bg-brand-dark-surface">
                                        <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-brand-dark-bg border-b border-gray-100 dark:border-brand-dark-border">
                                            <div className="flex gap-1.5">
                                                <div className="w-3 h-3 rounded-full bg-red-400" />
                                                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                                                <div className="w-3 h-3 rounded-full bg-green-400" />
                                            </div>
                                            <div className="flex-1 bg-white dark:bg-brand-dark-surface rounded-lg px-3 py-1 text-xs text-gray-400 dark:text-brand-dark-muted mr-2">
                                                takeeat.co.il/admin
                                            </div>
                                        </div>
                                        {feature.video ? (
                                            <div className="w-full aspect-[16/10] overflow-hidden bg-gray-100 dark:bg-brand-dark-bg">
                                                <video
                                                    className="w-full h-full object-contain"
                                                    src={feature.video}
                                                    autoPlay
                                                    loop
                                                    muted
                                                    playsInline
                                                    preload="metadata"
                                                />
                                            </div>
                                        ) : feature.images ? (
                                            <FeatureImageCarousel images={feature.images} />
                                        ) : null}
                                    </div>
                                    <div className={`absolute -inset-4 ${feature.bg} rounded-3xl blur-2xl opacity-0 group-hover:opacity-40 transition-opacity duration-500 -z-10`} />
                                </div>

                                {/* Text */}
                                <div className="w-full lg:w-2/5 space-y-5">
                                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl ${feature.bg} ${feature.color} font-bold text-sm`}>
                                        {feature.icon}
                                        <span>0{i + 1}</span>
                                    </div>
                                    <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-brand-dark-text">
                                        {feature.title}
                                    </h3>
                                    <p className="text-gray-600 dark:text-brand-dark-muted leading-relaxed text-lg">
                                        {feature.desc}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ═══════════════════════════════════════════
                    4. BENEFITS – יתרון כלכלי
                ═══════════════════════════════════════════ */}
                <section ref={addRevealRef} className="scroll-reveal py-24 mt-24 bg-gray-50/50 dark:bg-brand-dark-bg/50 border-y border-gray-100/50 dark:border-brand-dark-border">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6">
                        <h2 className="text-4xl font-bold text-center mb-16 text-gray-900 dark:text-brand-dark-text">
                            למה מסעדות עוברות אלינו
                        </h2>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
                            {benefits.map((item, i) => (
                                <div key={i} className="bg-white dark:bg-brand-dark-surface p-8 rounded-3xl shadow-[0_2px_20px_rgb(0,0,0,0.04)] dark:shadow-none border border-gray-100 dark:border-brand-dark-border hover:border-brand-primary/30 transition duration-300 flex flex-col items-start gap-4">
                                    <div className="p-3 bg-gray-50 dark:bg-brand-dark-bg rounded-2xl">
                                        {item.icon}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-brand-dark-text">{item.title}</h3>
                                        <p className="text-sm text-gray-500 dark:text-brand-dark-muted leading-relaxed">{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ═══════════════════════════════════════════
                    5. CAROUSEL – מסעדות שעובדות עם המערכת
                ═══════════════════════════════════════════ */}
                <section ref={addRevealRef} className="scroll-reveal py-20 mt-24 overflow-hidden bg-white dark:bg-brand-dark-surface">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-brand-dark-text">
                            מסעדות שכבר עובדות עם המערכת
                        </h2>
                    </div>

                    <div className="relative">
                        <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-white dark:from-brand-dark-surface to-transparent z-10 pointer-events-none" />
                        <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-white dark:from-brand-dark-surface to-transparent z-10 pointer-events-none" />

                        <div className="flex gap-16 animate-ticker">
                            {[1, 2].map((round) => (
                                <React.Fragment key={round}>
                                    <div className="flex items-center justify-center min-w-[240px] h-32 grayscale hover:grayscale-0 transition-all duration-300">
                                        <img src="/icons/chefsync-logo-v2-512.png" alt="TakeEat" className="h-24 w-auto object-contain opacity-60 hover:opacity-100 transition-opacity mix-blend-multiply dark:mix-blend-lighten" />
                                    </div>
                                    <div className="flex items-center justify-center min-w-[240px] h-32 grayscale hover:grayscale-0 transition-all duration-300">
                                        <img src="/logos/halabud.png" alt="חלבוד" className="h-24 w-auto object-contain opacity-60 hover:opacity-100 transition-opacity mix-blend-multiply dark:mix-blend-lighten" />
                                    </div>
                                    <div className="flex items-center justify-center min-w-[240px] h-32 grayscale hover:grayscale-0 transition-all duration-300">
                                        <img src="/logos/halabud.png" alt="חלבוד" className="h-24 w-auto object-contain opacity-60 hover:opacity-100 transition-opacity mix-blend-multiply dark:mix-blend-lighten" />
                                    </div>
                                    <div className="flex items-center justify-center min-w-[240px] h-32 grayscale hover:grayscale-0 transition-all duration-300">
                                        <img src="/logos/halabud.png" alt="חלבוד" className="h-24 w-auto object-contain opacity-60 hover:opacity-100 transition-opacity mix-blend-multiply dark:mix-blend-lighten" />
                                    </div>
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ═══════════════════════════════════════════
                    6. COMPARISON – Two Column Premium
                ═══════════════════════════════════════════ */}
                <section ref={addRevealRef} className="scroll-reveal max-w-5xl mx-auto px-4 sm:px-6 mt-24">
                    <div className="text-center mb-12">
                        <span className="text-brand-primary font-bold tracking-wider text-sm uppercase">השוואה עסקית</span>
                        <h2 className="text-4xl font-bold mt-2 mb-4 text-gray-900 dark:text-brand-dark-text">למה לשלם יותר?</h2>
                        <p className="text-gray-600 dark:text-brand-dark-muted text-lg">ההבדל בין שותף לבין ספק שירות</p>
                    </div>

                    <div className="grid md:grid-cols-2 shadow-2xl shadow-gray-200/50 dark:shadow-black/20 rounded-[2.5rem] overflow-hidden border border-gray-100 dark:border-brand-dark-border bg-white dark:bg-brand-dark-surface">
                        {/* Commission Model */}
                        <div className="p-10 bg-gray-50/80 dark:bg-brand-dark-bg/80 border-b md:border-b-0 md:border-l border-gray-100 dark:border-brand-dark-border">
                            <h3 className="text-xl font-bold text-gray-500 dark:text-brand-dark-muted mb-8 flex items-center gap-3">
                                <div className="p-2 bg-gray-200 dark:bg-brand-dark-border rounded-lg"><FaStore /></div>
                                <span>מודל העמלות</span>
                                <span className="mr-auto text-xs font-bold bg-red-100 dark:bg-red-900/20 px-3 py-1 rounded-full text-red-500">הישן</span>
                            </h3>
                            <ul className="space-y-6">
                                {[
                                    { label: 'עלות למסעדה', val: '27% - 30% מהמחזור', bad: true },
                                    { label: 'בעלות על הלקוח', val: 'של הפלטפורמה' },
                                    { label: 'מיתוג', val: 'כללי / גנרי' },
                                    { label: 'שליטה באזורים', val: 'מוגבלת' },
                                    { label: 'גמישות בתמחור', val: 'מוגבלת' },
                                ].map((row, i) => (
                                    <li key={i} className="flex justify-between items-center text-gray-500 dark:text-brand-dark-muted">
                                        <span>{row.label}</span>
                                        <span className={`font-medium text-sm px-2 py-1 rounded ${row.bad ? 'text-red-500 bg-red-50 dark:bg-red-900/20' : 'text-gray-700 dark:text-gray-400 bg-gray-200/50 dark:bg-brand-dark-border'}`}>
                                            {row.val}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                            <div className="mt-8 pt-8 border-t border-gray-200 dark:border-brand-dark-border text-center text-gray-400 dark:text-brand-dark-muted text-sm">
                                <p>שוחק את הרווחיות</p>
                            </div>
                        </div>

                        {/* Fixed Model (TakeEat) */}
                        <div className="p-10 bg-white dark:bg-brand-dark-surface relative">
                            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-brand-primary to-brand-secondary" />
                            <h3 className="text-xl font-bold text-brand-primary mb-8 flex items-center gap-3">
                                <div className="p-2 bg-brand-primary/10 rounded-lg"><FaRocket /></div>
                                <span>מודל קבוע</span>
                                <span className="mr-auto text-xs font-bold bg-brand-primary text-white px-3 py-1 rounded-full">TakeEat</span>
                            </h3>
                            <ul className="space-y-6">
                                {[
                                    { label: 'עלות למסעדה', val: '0% עמלה', highlight: true },
                                    { label: 'בעלות על הלקוח', val: '100% שלך' },
                                    { label: 'מיתוג', val: 'המותג שלך במרכז' },
                                    { label: 'שליטה באזורים', val: 'שליטה מלאה' },
                                    { label: 'גמישות בתמחור', val: 'מלאה' },
                                ].map((row, i) => (
                                    <li key={i} className="flex justify-between items-center text-gray-900 dark:text-brand-dark-text font-medium">
                                        <span>{row.label}</span>
                                        <span className={`text-sm px-2 py-1 rounded ${row.highlight ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 font-bold text-base' : 'bg-brand-light dark:bg-brand-primary/10 text-brand-dark dark:text-brand-dark-text'}`}>
                                            {row.val}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                            <div className="mt-8 pt-8 border-t border-gray-100 dark:border-brand-dark-border text-center text-brand-primary text-sm font-medium">
                                <FaCircleCheck className="inline-block mb-1 text-green-500 text-xl" />
                                <p>מקסימום רווח למסעדה</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ═══════════════════════════════════════════
                    7. CTA FINAL
                ═══════════════════════════════════════════ */}
                <section ref={addRevealRef} className="scroll-reveal bg-brand-dark text-white rounded-t-[3rem] mt-24 px-6 py-24 text-center relative overflow-hidden -mb-6 isolate">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-brand-primary/10 rounded-full blur-3xl" />
                    <div className="max-w-3xl mx-auto space-y-8 relative z-10">
                        <h2 className="text-4xl sm:text-5xl font-black tracking-tight">
                            מוכן להפסיק לשלם עמלות?
                        </h2>
                        <div className="pt-4">
                            <Link
                                to="/register-restaurant"
                                className="inline-flex items-center gap-3 px-12 py-6 bg-white text-brand-dark font-bold rounded-2xl text-xl hover:scale-105 transition-transform shadow-2xl"
                            >
                                <span>60 יום ניסיון חינם</span>
                            </Link>
                        </div>
                        <p className="text-sm text-white/40 font-medium">ללא התחייבות • לא צריך כרטיס אשראי</p>
                    </div>
                </section>

            </div>
        </CustomerLayout>
    );
}
