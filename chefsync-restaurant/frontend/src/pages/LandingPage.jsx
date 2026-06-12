import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CustomerLayout } from '../layouts/CustomerLayout';
import { LandingSeo } from '../components/seo/RestaurantSeo';
import { apiClient } from '../services/apiClient';
import { resolveAssetUrl } from '../utils/assets';
import heroRestaurantImg from '../images/6C6B449F-6155-4B6F-B791-8321549DE5C5.webp';
import deliveryZonesImg1 from '../images/אזורי משלוח.webp';
import deliveryZonesImg2 from '../images/אזורי משלוח2.webp';
import {
    FaGift,
    FaMapLocationDot,
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
    FaBurger,
    FaTriangleExclamation,
    FaPercent,
    FaShuffle,
    FaCreditCard,
    FaTruck,
    FaSliders,
    FaQuoteRight,
    FaArrowDown,
} from "react-icons/fa6";
import { SiApplepay, SiGooglepay } from 'react-icons/si';

const LANDING_CAROUSEL_FALLBACK = [
    { name: 'TakeEat', tenant_id: null, logo_url: '/icons/chefsync-logo-v2-512.png' },
    { name: 'חלבוד', tenant_id: null, logo_url: '/logos/halabud.png' },
];

const landingShowcaseImages = Object.entries(
    import.meta.glob('../images/*.{webp,png,jpg,jpeg}', { eager: true, import: 'default' })
)
    .filter(([path]) => !path.includes('ChefSyncLogoIcon') && !path.includes('TakeEatIcon'))
    .sort(([a], [b]) => a.localeCompare(b, 'he'))
    .map(([, src]) => src);

function landingPartnerLogoSrc(logoUrl) {
    if (!logoUrl) return '';
    if (/^https?:\/\//i.test(logoUrl)) return logoUrl;
    if (logoUrl.startsWith('/storage')) return resolveAssetUrl(logoUrl);
    return logoUrl;
}

export default function LandingPage() {
    const [activeDevice, setActiveDevice] = useState('mobile');
    const [deliveryImagesSwapped, setDeliveryImagesSwapped] = useState(false);
    const [landingPartners, setLandingPartners] = useState(undefined);
    const mockupRef = useRef(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { data } = await apiClient.get('/restaurants', {
                    params: { landing_partners: 1 },
                });
                if (cancelled) return;
                const list = data?.data;
                setLandingPartners(Array.isArray(list) ? list : []);
            } catch {
                if (!cancelled) setLandingPartners([]);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const timer = setInterval(() => {
            setDeliveryImagesSwapped((prev) => !prev);
        }, 3200);
        return () => clearInterval(timer);
    }, []);

    const partnersForLogoCarousel = useMemo(() => {
        if (landingPartners === undefined || landingPartners.length === 0) {
            return LANDING_CAROUSEL_FALLBACK;
        }
        return landingPartners;
    }, [landingPartners]);

    const liveRestaurantsForDemo = useMemo(() => {
        if (!Array.isArray(landingPartners) || landingPartners.length === 0) {
            return [];
        }

        const live = landingPartners
            .filter((restaurant) => {
                const notDemo = !Boolean(restaurant?.is_demo);
                const notDisabled = restaurant?.is_active !== false;
                const approved = restaurant?.is_approved !== false;
                const hasMenuSlug = Boolean(restaurant?.tenant_id || restaurant?.slug);
                return notDemo && notDisabled && approved && hasMenuSlug;
            })
            .slice(0, 6)
            .map((restaurant, idx) => {
                const slug = restaurant.tenant_id || restaurant.slug;
                return {
                    name: restaurant.name || `מסעדה ${idx + 1}`,
                    sub: restaurant.city ? `מסעדה פעילה • ${restaurant.city}` : 'מסעדה פעילה במערכת',
                    to: `/${slug}/menu`,
                    color: [
                        'hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-900/10',
                        'hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/10',
                        'hover:border-cyan-500 hover:bg-cyan-50 dark:hover:bg-cyan-900/10',
                        'hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/10',
                    ][idx % 4],
                };
            });

        return live;
    }, [landingPartners]);

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

    /* ── Pain Points ── */
    const painPoints = [
        {
            icon: <FaPercent className="w-6 h-6 text-red-500" />,
            title: 'משלם 20%–30% עמלה',
            desc: 'על כל הזמנה שנכנסת, שליש מהרווח הולך לפלטפורמה.',
        },
        {
            icon: <FaStore className="w-6 h-6 text-red-500" />,
            title: 'תלוי בפלטפורמות השונות',
            desc: 'הם שולטים במחירים, בלקוחות ובדירוג שלך.',
        },
        {
            icon: <FaShuffle className="w-6 h-6 text-red-500" />,
            title: 'הזמנות מתבלגנות',
            desc: 'טלפונים, וואטסאפ, אפליקציות – בלאגן בלי סוף.',
        },
    ];

    /* ── 4 Core Feature Blocks ── */
    const coreFeatures = [
        {
            title: 'הזמנות מסודרות',
            desc: 'הלקוח מזמין לבד מהאתר שלך. ההזמנה נכנסת מסודר ישירות למסך שלך. בלי טלפונים, בלי טעויות.',
            video: '/videos/order-dashboard.mp4',
            icon: <FaListCheck className="w-7 h-7" />,
            color: 'text-blue-500',
            bg: 'bg-blue-50 dark:bg-blue-900/20',
            borderColor: 'border-blue-200 dark:border-blue-800',
        },
        {
            title: 'תשלומים ישירים',
            desc: '0% עמלה. הכסף הולך ישר אליך. תשלום חודשי קבוע בלבד – בלי הפתעות.',
            video: '/videos/pos-terminal.mp4',
            icon: <FaCreditCard className="w-7 h-7" />,
            paymentMethods: [
                { key: 'cash', label: 'מזומן', icon: <FaCashRegister className="w-4 h-4" /> },
                { key: 'card', label: 'אשראי', icon: <FaCreditCard className="w-4 h-4" /> },
                { key: 'apple', label: 'Apple Pay', icon: <SiApplepay className="w-4 h-4" /> },
                { key: 'google', label: 'Google Pay', icon: <SiGooglepay className="w-4 h-4" /> },
            ],
            color: 'text-green-500',
            bg: 'bg-green-50 dark:bg-green-900/20',
            borderColor: 'border-green-200 dark:border-green-800',
        },
        {
            title: 'משלוחים בשליטה שלך',
            desc: 'הגדר אזורי חלוקה, מחירי משלוח, זמני אספקה ומינימום הזמנה. שליטה מלאה על כל משלוח.',
            images: [deliveryZonesImg1, deliveryZonesImg2],
            icon: <FaTruck className="w-7 h-7" />,
            color: 'text-emerald-500',
            bg: 'bg-emerald-50 dark:bg-emerald-900/20',
            borderColor: 'border-emerald-200 dark:border-emerald-800',
        },
        {
            title: 'שליטה מלאה בעסק',
            desc: 'תפריט, הזמנות, דוחות, מבצעים, POS, מסך מטבח – הכל במקום אחד. המותג שלך, הלקוחות שלך.',
            video: '/videos/reports.mp4',
            icon: <FaSliders className="w-7 h-7" />,
            color: 'text-purple-500',
            bg: 'bg-purple-50 dark:bg-purple-900/20',
            borderColor: 'border-purple-200 dark:border-purple-800',
        },
    ];

    /* ── More Features (remaining videos) ── */
    const moreFeatures = [
        {
            title: 'ניהול תפריט',
            desc: 'קטגוריות, מנות, תמונות ותיאורים – עדכון בזמן אמת.',
            video: '/videos/menu-management.mp4',
            icon: <FaBurger className="w-5 h-5" />,
            color: 'text-orange-500',
            bg: 'bg-orange-50 dark:bg-orange-900/20',
        },
        {
            title: 'מבצעים והטבות',
            desc: 'מבצעים מורכבים עם כללים אוטומטיים.',
            video: '/videos/promotions.mp4',
            icon: <FaTags className="w-5 h-5" />,
            color: 'text-purple-500',
            bg: 'bg-purple-50 dark:bg-purple-900/20',
        },
        {
            title: 'מסוף POS',
            desc: 'ממשק טאבלט מהיר לניהול הזמנות.',
            video: '/videos/pos-terminal.mp4',
            icon: <FaCashRegister className="w-5 h-5" />,
            color: 'text-rose-500',
            bg: 'bg-rose-50 dark:bg-rose-900/20',
        },
        {
            title: 'קבוצות תוספות',
            desc: 'גודל, רטבים, סלטים – גמישות מלאה.',
            video: '/videos/addon-groups.mp4',
            icon: <FaPuzzlePiece className="w-5 h-5" />,
            color: 'text-amber-500',
            bg: 'bg-amber-50 dark:bg-amber-900/20',
        },
        {
            title: 'מסך מטבח',
            desc: 'תצוגה חיה של הזמנות לצוות.',
            video: '/videos/display-screen.mp4',
            icon: <FaTv className="w-5 h-5" />,
            color: 'text-indigo-500',
            bg: 'bg-indigo-50 dark:bg-indigo-900/20',
        },
        {
            title: 'דוחות וניתוח',
            desc: 'מכירות, מגמות ותובנות חכמות.',
            video: '/videos/reports.mp4',
            icon: <FaChartPie className="w-5 h-5" />,
            color: 'text-cyan-500',
            bg: 'bg-cyan-50 dark:bg-cyan-900/20',
        },
    ];

    const menuImportSteps = [
        {
            title: 'שלב 1: חיבור מקור התפריט',
            desc: 'מזינים קישור/מקור קיים (למשל Wolt), והמערכת שולפת את מבנה הקטגוריות והפריטים.',
            icon: <FaWandMagicSparkles className="w-5 h-5" />,
            color: 'text-indigo-500',
            bg: 'bg-indigo-50 dark:bg-indigo-900/20',
        },
        {
            title: 'שלב 2: זיהוי ומיפוי חכם',
            desc: 'TakeEat מזהה שמות, מחירים, וריאנטים ותוספות, וממפה אותם לשדות הנכונים במערכת.',
            icon: <FaListCheck className="w-5 h-5" />,
            color: 'text-cyan-500',
            bg: 'bg-cyan-50 dark:bg-cyan-900/20',
        },
        {
            title: 'שלב 3: סקירה ותיקונים',
            desc: 'עוברים על תצוגה מקדימה, מתקנים נקודתית מה שצריך, ומחליטים מה יפורסם.',
            icon: <FaSliders className="w-5 h-5" />,
            color: 'text-amber-500',
            bg: 'bg-amber-50 dark:bg-amber-900/20',
        },
        {
            title: 'שלב 4: פרסום בלחיצה',
            desc: 'מאשרים, והתפריט עולה לאוויר כולל קטגוריות, פריטים ותוספות – מוכן להזמנות מיידית.',
            icon: <FaCircleCheck className="w-5 h-5" />,
            color: 'text-emerald-500',
            bg: 'bg-emerald-50 dark:bg-emerald-900/20',
        },
    ];

    return (
        <CustomerLayout>
            <LandingSeo />
            <div className="-mx-4 sm:-mx-6 lg:-mx-8">

                {/* ═══════════════════════════════════════════
                    1. HERO – Pain-focused, sharp CTA
                ═══════════════════════════════════════════ */}
                <div className="relative overflow-hidden bg-brand-dark text-white rounded-b-[2.5rem] sm:rounded-b-[4rem] shadow-2xl isolate">
                    <div className="absolute inset-0 bg-gradient-to-br from-brand-dark via-brand-primary/90 to-brand-secondary/80 -z-10" />
                    <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 left-0 translate-y-12 -translate-x-12 w-64 h-64 bg-brand-primary/20 rounded-full blur-3xl" />

                    <div className="relative max-w-7xl mx-auto z-10">
                        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center px-6 sm:px-10 py-16 lg:py-24">
                            {/* Text – right side (RTL) */}
                            <div className="text-center lg:text-right space-y-8" style={{ direction: 'rtl' }}>
                                <span className="text-3xl lg:text-5xl font-black tracking-tight text-white drop-shadow-lg block">
                                    TakeEat
                                </span>
                                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight">
                                    תפסיק לשלם עמלות
                                    <br />
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-orange-300">
                                        על כל הזמנה.
                                    </span>
                                </h1>
                                <p className="text-lg lg:text-xl text-white/80 font-medium leading-relaxed max-w-xl mx-auto lg:mx-0">
                                    TakeEat נותנת לך שליטה מלאה –
                                    <br />
                                    בלי אחוזים, בלי מתווכים.
                                </p>
                                <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start pt-2">
                                    <Link
                                        to="/register-restaurant"
                                        className="group px-10 py-5 bg-white text-brand-dark font-black rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-1 transition text-xl flex items-center justify-center gap-3"
                                    >
                                        <span>פתח מסעדה עכשיו</span>
                                        <FaRocket className="text-brand-primary text-xl group-hover:rotate-12 transition-transform" />
                                    </Link>
                                    <a
                                        href="#pain"
                                        className="px-8 py-5 bg-white/10 backdrop-blur border border-white/20 text-white font-bold rounded-2xl hover:bg-white/20 transition-all text-lg text-center flex items-center justify-center gap-2"
                                    >
                                        <span>למה אני צריך את זה?</span>
                                        <FaArrowDown className="text-sm animate-bounce" />
                                    </a>
                                </div>
                                <p className="text-sm text-white/50 font-medium">ללא התחייבות • לא צריך כרטיס אשראי</p>
                            </div>

                            {/* Hero Image – left side */}
                            <div className="hidden lg:flex justify-center">
                                <img
                                    src={heroRestaurantImg}
                                    alt="יש לך מסעדה"
                                    className="w-full max-w-lg rounded-3xl shadow-2xl border-2 border-white/10 object-cover"
                                    loading="lazy"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* ═══════════════════════════════════════════
                    2. PAIN BLOCK – Why you need this
                ═══════════════════════════════════════════ */}
                <section id="pain" ref={addRevealRef} className="scroll-reveal max-w-6xl mx-auto px-4 sm:px-6 mt-20 lg:mt-28">
                    <div className="text-center mb-12" style={{ direction: 'rtl' }}>
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-50 dark:bg-red-900/20 text-red-500 font-bold text-sm mb-6">
                            <FaTriangleExclamation />
                            <span>הבעיה שכל מסעדן מכיר</span>
                        </div>
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 dark:text-brand-dark-text">
                            מכיר את זה?
                        </h2>
                    </div>

                    <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
                        {/* Pain Cards */}
                        <div className="space-y-5" style={{ direction: 'rtl' }}>
                            {painPoints.map((point, i) => (
                                <div
                                    key={i}
                                    ref={addRevealRef}
                                    className="scroll-reveal flex items-start gap-4 p-6 rounded-2xl bg-red-50/60 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 transition-all hover:shadow-lg"
                                    style={{ transitionDelay: `${i * 100}ms` }}
                                >
                                    <div className="mt-1 p-3 bg-red-100 dark:bg-red-900/30 rounded-xl flex-shrink-0">
                                        {point.icon}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900 dark:text-brand-dark-text mb-1">{point.title}</h3>
                                        <p className="text-gray-600 dark:text-brand-dark-muted">{point.desc}</p>
                                    </div>
                                </div>
                            ))}

                            {/* "Here it ends" divider */}
                            <div className="relative py-6">
                                <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-brand-primary to-transparent" />
                                <div className="relative flex justify-center">
                                    <span className="bg-white dark:bg-brand-dark-surface px-6 py-3 rounded-2xl text-2xl sm:text-3xl font-black text-brand-primary shadow-lg border border-brand-primary/20">
                                        פה זה נגמר.
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Pain Video */}
                        <div className="flex justify-center">
                            <video
                                className="w-full max-w-md rounded-3xl shadow-xl bg-black/5 object-cover"
                                src="/videos/promotions.mp4"
                                autoPlay
                                loop
                                muted
                                playsInline
                                preload="metadata"
                            />
                        </div>
                    </div>
                </section>

                {/* ═══════════════════════════════════════════
                    3. FOUR CORE FEATURES – One message each
                ═══════════════════════════════════════════ */}
                <section ref={addRevealRef} className="scroll-reveal max-w-7xl mx-auto px-4 sm:px-6 mt-24 lg:mt-32">
                    <div className="text-center mb-16" style={{ direction: 'rtl' }}>
                        <span className="text-brand-primary font-bold tracking-wider text-sm uppercase">מה אתה מקבל</span>
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mt-3 mb-4 text-gray-900 dark:text-brand-dark-text">
                            הכל במערכת אחת. בלי סיבוכים.
                        </h2>
                    </div>

                    <div className="space-y-20 lg:space-y-28">
                        {coreFeatures.map((feature, i) => (
                            <div
                                ref={addRevealRef}
                                key={i}
                                className={`scroll-reveal flex flex-col ${i % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'} gap-10 lg:gap-16 items-center`}
                                style={{ transitionDelay: `${(i % 3) * 120}ms` }}
                            >
                                {/* Media */}
                                <div className="w-full lg:w-3/5 relative group">
                                    <div className={`relative rounded-2xl overflow-hidden shadow-2xl shadow-gray-200/60 dark:shadow-black/30 border ${feature.borderColor} bg-white dark:bg-brand-dark-surface`}>
                                        {/* Browser chrome */}
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
                                        <div className="w-full aspect-[16/10] overflow-hidden bg-gray-100 dark:bg-brand-dark-bg">
                                            {feature.images ? (
                                                <div className="relative h-full p-2">
                                                    <div className="absolute top-3 right-3 z-10 px-2.5 py-1 rounded-full bg-black/70 text-white text-[11px] font-bold">
                                                        מתחלף אוטומטית
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 h-full">
                                                        {(deliveryImagesSwapped ? [...feature.images].reverse() : feature.images).map((src, idx) => (
                                                        <img
                                                            key={`${feature.title}-${idx}`}
                                                            src={src}
                                                            alt={`${feature.title} ${idx + 1}`}
                                                            className={`w-full h-full rounded-xl object-cover border border-white/70 shadow-sm transition-all duration-700 ${deliveryImagesSwapped ? 'sm:translate-x-0' : 'sm:translate-x-0'}`}
                                                            loading="lazy"
                                                        />
                                                    ))}
                                                    </div>
                                                </div>
                                            ) : (
                                                <video
                                                    className="w-full h-full object-contain"
                                                    src={feature.video}
                                                    autoPlay
                                                    loop
                                                    muted
                                                    playsInline
                                                    preload="metadata"
                                                />
                                            )}
                                        </div>
                                    </div>
                                    <div className={`absolute -inset-4 ${feature.bg} rounded-3xl blur-2xl opacity-0 group-hover:opacity-40 transition-opacity duration-500 -z-10`} />
                                </div>

                                {/* Text */}
                                <div className="w-full lg:w-2/5 space-y-5" style={{ direction: 'rtl' }}>
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
                                    {feature.paymentMethods && (
                                        <div className="flex flex-wrap items-center gap-2 pt-1">
                                            {feature.paymentMethods.map((method) => (
                                                <span
                                                    key={method.key}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-brand-dark-bg border border-gray-200 dark:border-brand-dark-border text-xs font-bold text-gray-700 dark:text-brand-dark-muted"
                                                >
                                                    {method.icon}
                                                    {method.label}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ═══════════════════════════════════════════
                    4. MID CTA – Push to action
                ═══════════════════════════════════════════ */}
                <section ref={addRevealRef} className="scroll-reveal max-w-4xl mx-auto px-4 sm:px-6 mt-24 lg:mt-32">
                    <div className="relative bg-gradient-to-br from-brand-primary to-brand-secondary rounded-[2.5rem] p-10 sm:p-14 text-center text-white shadow-2xl overflow-hidden isolate">
                        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-2xl -z-10" />
                        <div className="absolute bottom-0 left-0 w-56 h-56 bg-white/5 rounded-full blur-3xl -z-10" />
                        <h2 className="text-3xl sm:text-4xl font-black mb-4" style={{ direction: 'rtl' }}>
                            רוצה לראות איך זה עובד אצלך?
                        </h2>
                        <p className="text-white/80 text-lg mb-8 max-w-xl mx-auto" style={{ direction: 'rtl' }}>
                            תן לנו 30 שניות ונראה לך איך המסעדה שלך תיראה עם TakeEat
                        </p>
                        <Link
                            to="/register-restaurant"
                            className="inline-flex items-center gap-3 px-10 py-5 bg-white text-brand-dark font-black rounded-2xl text-xl hover:scale-105 transition-transform shadow-xl"
                        >
                            <span>התחל ניסיון חינם</span>
                            <FaGift className="text-brand-primary text-xl" />
                        </Link>
                    </div>
                </section>

                {/* ═══════════════════════════════════════════
                    5. SHOWCASE GALLERY – Scrolling image ticker
                ═══════════════════════════════════════════ */}
                <section ref={addRevealRef} className="scroll-reveal mt-24 overflow-hidden">
                    <div className="text-center mb-8">
                        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-brand-dark-text" style={{ direction: 'rtl' }}>
                            TakeEat בכל מקום
                        </h2>
                    </div>

                    <div className="relative">
                        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-white dark:from-brand-dark-surface to-transparent z-10 pointer-events-none" />
                        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-white dark:from-brand-dark-surface to-transparent z-10 pointer-events-none" />

                        {/* Row 1 – scrolls left */}
                        <div className="flex gap-4 animate-ticker mb-4">
                            {[1, 2].map((round) => (
                                <React.Fragment key={round}>
                                    {landingShowcaseImages.map((src, idx) => (
                                        <div key={`${round}-${idx}`} className="flex-shrink-0 w-64 h-64 rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-shadow">
                                            <img src={src} alt="TakeEat showcase" className="w-full h-full object-cover" loading="lazy" />
                                        </div>
                                    ))}
                                </React.Fragment>
                            ))}
                        </div>

                        {/* Row 2 – scrolls right */}
                        <div className="flex gap-4 animate-ticker-reverse">
                            {[1, 2].map((round) => (
                                <React.Fragment key={round}>
                                    {[...landingShowcaseImages].reverse().map((src, idx) => (
                                        <div key={`${round}-${idx}`} className="flex-shrink-0 w-64 h-64 rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-shadow">
                                            <img src={src} alt="TakeEat showcase" className="w-full h-full object-cover" loading="lazy" />
                                        </div>
                                    ))}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ═══════════════════════════════════════════
                    6. TRUST – Testimonial + Social Proof
                ═══════════════════════════════════════════ */}
                <section ref={addRevealRef} className="scroll-reveal max-w-6xl mx-auto px-4 sm:px-6 mt-24">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-brand-dark-text" style={{ direction: 'rtl' }}>
                            מסעדות כבר משתמשות
                        </h2>
                    </div>

                    <div className="grid lg:grid-cols-2 gap-10 items-center">
                        {/* Testimonial Card */}
                        <div className="bg-white dark:bg-brand-dark-surface rounded-3xl p-8 sm:p-10 shadow-xl border border-gray-100 dark:border-brand-dark-border relative" style={{ direction: 'rtl' }}>
                            <FaQuoteRight className="absolute top-6 left-6 text-4xl text-brand-primary/10" />
                            <div className="space-y-6">
                                <p className="text-xl sm:text-2xl text-gray-800 dark:text-brand-dark-text font-medium leading-relaxed">
                                    "מאז שעברתי ל-TakeEat חסכתי אלפי שקלים בעמלות.
                                    ההזמנות נכנסות מסודר, הלקוחות מרוצים, ואני סוף סוף שולט בעסק שלי."
                                </p>
                                <div className="flex items-center gap-4 pt-4 border-t border-gray-100 dark:border-brand-dark-border">
                                    <img
                                        src="/logos/halabud.png"
                                        alt="לוגו המסעדה של בעל העסק"
                                        className="w-12 h-12 rounded-full object-cover shadow-md border-2 border-brand-primary/20"
                                        loading="lazy"
                                    />
                                    <div>
                                        <p className="font-bold text-gray-900 dark:text-brand-dark-text">פנחס סבג</p>
                                        <p className="text-sm text-gray-500 dark:text-brand-dark-muted">בעל מסעדת סילביס – טעים בכל ביס</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Trust Video */}
                        <div className="flex justify-center">
                            <video
                                className="w-full max-w-md rounded-3xl shadow-xl bg-black/5 object-cover"
                                src="/videos/display-screen.mp4"
                                autoPlay
                                loop
                                muted
                                playsInline
                                preload="metadata"
                            />
                        </div>
                    </div>
                </section>

                {/* ═══════════════════════════════════════════
                    6.5. RESTAURANT CAROUSEL – Social proof logos
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
                                    {partnersForLogoCarousel.map((p, idx) => {
                                        const src = landingPartnerLogoSrc(p.logo_url);
                                        const menuSlug = p.tenant_id || p.slug;
                                        const slideKey = `${p.id ?? ''}-${p.tenant_id ?? ''}-${p.slug ?? ''}-${p.name ?? ''}-${idx}`;
                                        const imgOrPlaceholder = src ? (
                                            <img
                                                src={src}
                                                alt={p.name || 'מסעדה'}
                                                className="h-24 w-auto max-w-[200px] object-contain opacity-60 hover:opacity-100 transition-opacity mix-blend-multiply dark:mix-blend-lighten"
                                            />
                                        ) : (
                                            <div className="flex flex-col items-center justify-center gap-2 px-4 text-center min-h-[96px]">
                                                <FaUtensils className="text-4xl text-gray-400 dark:text-gray-500" aria-hidden />
                                                <span className="text-xs font-bold text-gray-500 dark:text-brand-dark-muted max-w-[180px] line-clamp-2">
                                                    {p.name || 'מסעדה'}
                                                </span>
                                            </div>
                                        );
                                        return (
                                            <div
                                                key={`${round}-${slideKey}`}
                                                className="flex items-center justify-center min-w-[240px] h-32 grayscale hover:grayscale-0 transition-all duration-300"
                                            >
                                                {menuSlug ? (
                                                    <Link
                                                        to={`/${menuSlug}/menu`}
                                                        className="flex items-center justify-center w-full h-full px-2"
                                                        title={`תפריט ${p.name}`}
                                                    >
                                                        {imgOrPlaceholder}
                                                    </Link>
                                                ) : (
                                                    <span className="flex items-center justify-center w-full h-full px-2">{imgOrPlaceholder}</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ═══════════════════════════════════════════
                    7. LIVE DEMO – Interactive device mockup
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

                                    {activeDevice === 'tablet' && (
                                        <div className="relative w-full max-w-[500px] mx-auto aspect-[3/4] transition-all duration-500 animate-fadeIn">
                                            <div className="absolute inset-0 bg-gray-900 rounded-[40px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] p-4 ring-4 ring-gray-100">
                                                <div className="w-full h-full bg-white rounded-[32px] overflow-hidden relative">
                                                    <iframe src="https://chefsync.vercel.app/?embed=1" className="w-full h-full border-0" title="Tablet Demo" loading="lazy" />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {activeDevice === 'desktop' && (
                                        <div className="relative w-full transition-all duration-500 animate-fadeIn">
                                            <div className="relative bg-[#1a1a1a] rounded-t-xl p-[6px] pb-0 shadow-2xl border border-gray-700/50">
                                                <div className="absolute top-[3px] left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-gray-700 z-10" />
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
                                                <div className="bg-white overflow-hidden aspect-[16/10]">
                                                    <iframe src="https://chefsync.vercel.app/?embed=1" className="w-full h-full border-0" title="Desktop Demo" loading="lazy" />
                                                </div>
                                            </div>
                                            <div className="relative mx-auto">
                                                <div className="h-3 bg-gradient-to-b from-[#2d2d2d] to-[#1a1a1a] rounded-b-sm mx-[2%]" />
                                                <div className="h-3 bg-gradient-to-b from-[#c0c0c0] to-[#a8a8a8] rounded-b-xl mx-[-2%] shadow-[0_4px_15px_rgba(0,0,0,0.2)]" />
                                            </div>
                                        </div>
                                    )}

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
                                    {liveRestaurantsForDemo.length > 0 ? (
                                        liveRestaurantsForDemo.map((store) => (
                                            <Link
                                                key={store.to}
                                                to={store.to}
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
                                            </Link>
                                        ))
                                    ) : (
                                        <div className="rounded-2xl border border-dashed border-gray-300 dark:border-brand-dark-border p-5 text-sm text-gray-500 dark:text-brand-dark-muted" style={{ direction: 'rtl' }}>
                                            לא נמצאו כרגע מסעדות פעילות לא-דמו להצגה.
                                        </div>
                                    )}
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
                    8. MORE FEATURES – Compact grid with videos
                ═══════════════════════════════════════════ */}
                <section ref={addRevealRef} className="scroll-reveal max-w-7xl mx-auto px-4 sm:px-6 mt-24">
                    <div className="text-center mb-12" style={{ direction: 'rtl' }}>
                        <span className="text-brand-primary font-bold tracking-wider text-sm uppercase">ועוד הרבה יותר</span>
                        <h2 className="text-3xl sm:text-4xl font-bold mt-3 mb-4 text-gray-900 dark:text-brand-dark-text">
                            כלים נוספים שמחכים לך
                        </h2>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {moreFeatures.map((feature, i) => (
                            <div
                                key={i}
                                ref={addRevealRef}
                                className="scroll-reveal bg-white dark:bg-brand-dark-surface rounded-2xl overflow-hidden shadow-lg border border-gray-100 dark:border-brand-dark-border hover:shadow-xl transition-shadow"
                                style={{ transitionDelay: `${(i % 3) * 100}ms` }}
                            >
                                {/* Video */}
                                <div className="w-full aspect-video overflow-hidden bg-gray-100 dark:bg-brand-dark-bg">
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
                                {/* Text */}
                                <div className="p-5" style={{ direction: 'rtl' }}>
                                    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${feature.bg} ${feature.color} font-bold text-xs mb-3`}>
                                        {feature.icon}
                                        <span>{feature.title}</span>
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-brand-dark-muted">{feature.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ═══════════════════════════════════════════
                    8.5. MENU IMPORT – New feature explainer
                ═══════════════════════════════════════════ */}
                <section ref={addRevealRef} className="scroll-reveal max-w-7xl mx-auto px-4 sm:px-6 mt-24">
                    <div className="text-center mb-12" style={{ direction: 'rtl' }}>
                        <span className="text-brand-primary font-bold tracking-wider text-sm uppercase">פיצ'ר חדש</span>
                        <h2 className="text-3xl sm:text-4xl font-bold mt-3 mb-4 text-gray-900 dark:text-brand-dark-text">
                            ייבוא תפריט מסעדה אוטומטי
                        </h2>
                        <p className="text-base sm:text-lg text-gray-600 dark:text-brand-dark-muted max-w-3xl mx-auto leading-relaxed">
                            במקום להקליד תפריט ידנית, אפשר לייבא תפריט קיים, לבצע מעבר מהיר על הנתונים, ולעלות לאוויר תוך דקות.
                        </p>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4 lg:gap-6 mb-10">
                        <div className="rounded-3xl overflow-hidden border border-gray-200 dark:border-brand-dark-border bg-white dark:bg-brand-dark-surface shadow-lg">
                            <div className="px-4 py-3 border-b border-gray-100 dark:border-brand-dark-border bg-gray-50 dark:bg-brand-dark-bg text-sm font-bold text-gray-700 dark:text-brand-dark-muted flex items-center justify-between" style={{ direction: 'rtl' }}>
                                <span>תצוגת ייבוא ומיפוי תפריט</span>
                                <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-500 text-white text-[11px] font-black tracking-wide">BETA</span>
                            </div>
                            <div className="aspect-video bg-black/5">
                                <video
                                    className="w-full h-full object-contain"
                                    src="/videos/menu-management.mp4"
                                    autoPlay
                                    loop
                                    muted
                                    playsInline
                                    preload="metadata"
                                />
                            </div>
                        </div>
                        <div className="rounded-3xl overflow-hidden border border-gray-200 dark:border-brand-dark-border bg-white dark:bg-brand-dark-surface shadow-lg">
                            <div className="px-4 py-3 border-b border-gray-100 dark:border-brand-dark-border bg-gray-50 dark:bg-brand-dark-bg text-sm font-bold text-gray-700 dark:text-brand-dark-muted flex items-center justify-between" style={{ direction: 'rtl' }}>
                                <span>תוספות ווריאציות אחרי ייבוא</span>
                                <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-sky-500 text-white text-[11px] font-black tracking-wide">BETA</span>
                            </div>
                            <div className="aspect-video bg-black/5">
                                <video
                                    className="w-full h-full object-contain"
                                    src="/videos/addon-groups.mp4"
                                    autoPlay
                                    loop
                                    muted
                                    playsInline
                                    preload="metadata"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
                        {menuImportSteps.map((step, idx) => (
                            <div
                                key={step.title}
                                className="relative rounded-2xl border border-gray-200 dark:border-brand-dark-border bg-white dark:bg-brand-dark-surface p-5 shadow-sm hover:shadow-md transition-shadow"
                                style={{ direction: 'rtl' }}
                            >
                                <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${step.bg} ${step.color} mb-4`}>
                                    {step.icon}
                                </div>
                                <h3 className="text-base font-bold text-gray-900 dark:text-brand-dark-text mb-2">
                                    {step.title}
                                </h3>
                                <p className="text-sm leading-relaxed text-gray-600 dark:text-brand-dark-muted">
                                    {step.desc}
                                </p>
                                <div className="absolute top-4 left-4 text-xs font-black text-gray-300 dark:text-brand-dark-border">0{idx + 1}</div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ═══════════════════════════════════════════
                    9. COMPARISON – Two Column
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
                    10. FINAL CTA – Strong closing
                ═══════════════════════════════════════════ */}
                <section ref={addRevealRef} className="scroll-reveal bg-brand-dark text-white rounded-t-[3rem] mt-24 px-6 py-24 text-center relative overflow-hidden -mb-6 isolate">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-brand-primary/10 rounded-full blur-3xl" />
                    <div className="max-w-3xl mx-auto space-y-8 relative z-10" style={{ direction: 'rtl' }}>
                        <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
                            כל יום שאתה בלי מערכת —
                            <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-400">
                                אתה מפסיד כסף.
                            </span>
                        </h2>
                        <p className="text-xl text-white/70 max-w-xl mx-auto">
                            תפסיק לחשוב ותתחיל לחסוך. ההרשמה לוקחת 30 שניות.
                        </p>
                        <div className="pt-4">
                            <Link
                                to="/register-restaurant"
                                className="inline-flex items-center gap-3 px-14 py-7 bg-white text-brand-dark font-black rounded-2xl text-2xl hover:scale-105 transition-transform shadow-2xl"
                            >
                                <span>תתחיל עכשיו</span>
                                <FaRocket className="text-brand-primary text-2xl" />
                            </Link>
                        </div>
                        <p className="text-sm text-white/40 font-medium">ללא התחייבות • לא צריך כרטיס אשראי • 60 יום ניסיון חינם</p>
                    </div>
                </section>

            </div>
        </CustomerLayout>
    );
}
