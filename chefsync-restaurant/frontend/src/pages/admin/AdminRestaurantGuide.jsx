import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import { useInstallPrompt } from '../../context/InstallPromptContext';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { PRODUCT_NAME } from '../../constants/brand';
import {
    FaBookOpen,
    FaCheckCircle,
    FaChevronDown,
    FaClipboardList,
    FaClock,
    FaCreditCard,
    FaDesktop,
    FaDownload,
    FaHandsHelping,
    FaLightbulb,
    FaMapMarkedAlt,
    FaMobileAlt,
    FaQrcode,
    FaBell,
    FaPlus,
    FaCarrot,
    FaArrowRight,
    FaSpinner,
    FaMotorcycle,
    FaBoxOpen,
    FaRocket,
    FaStore,
    FaTabletAlt,
    FaTv,
    FaUsers,
    FaEye,
    FaUtensils,
} from 'react-icons/fa';

const SECTIONS = [
    { id: 'install', label: 'התקנת האפליקציה' },
    { id: 'overview', label: 'מבנה לוח הבקרה' },
    { id: 'orders', label: 'ניהול הזמנות' },
    { id: 'menu', label: 'תפריט ומחירים' },
    { id: 'team', label: 'צוות והרשאות', managerOnly: true },
    { id: 'delivery', label: 'משלוח ואזורים', managerOnly: true },
    { id: 'devices', label: 'מסכים וקיוסקים', managerOnly: true },
    { id: 'payments', label: 'תשלום ומנוי', ownerOnly: true },
];

function usePrefersReducedMotion() {
    const [reduced, setReduced] = useState(false);

    useEffect(() => {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        const fn = () => setReduced(mq.matches);
        setReduced(mq.matches);
        mq.addEventListener('change', fn);
        return () => mq.removeEventListener('change', fn);
    }, []);

    return reduced;
}

/** תהליך מקוצר בשורת LTR עם חיצים אופקיים */
function GuideArrowChain({ steps }) {
    if (!steps?.length) return null;
    return (
        <div dir="ltr" className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2 text-[12px] font-black justify-end">
            {steps.map((label, i) => (
                <span key={`${label}-${i}`} className="inline-flex items-center gap-2">
                    {i > 0 ? <FaArrowRight className="text-orange-400 text-[11px] shrink-0 opacity-90" aria-hidden /> : null}
                    <span className="rounded-lg border border-orange-100 bg-white px-2.5 py-1 text-gray-800 shadow-sm">{label}</span>
                </span>
            ))}
        </div>
    );
}

/** זרימת סטטוסים בהתאם ל‑AdminOrders (משלוח מול איסוף) */
const STATUS_FLOW_DELIVERY = [
    { key: 'pending', label: 'ממתין', icon: FaClock, badge: 'bg-amber-50 text-amber-800 border border-amber-100' },
    { key: 'received', label: 'התקבל', icon: FaBell, badge: 'bg-amber-50 text-amber-800 border border-amber-100' },
    { key: 'preparing', label: 'בהכנה', icon: FaSpinner, badge: 'bg-blue-50 text-blue-800 border border-blue-100' },
    {
        key: 'ready_ship',
        label: 'מוכן למשלוח',
        icon: FaCheckCircle,
        badge: 'bg-emerald-50 text-emerald-800 border border-emerald-100',
    },
    { key: 'delivering', label: 'במשלוח', icon: FaMotorcycle, badge: 'bg-purple-50 text-purple-800 border border-purple-100' },
    { key: 'delivered', label: 'נמסר', icon: FaBoxOpen, badge: 'bg-slate-50 text-slate-800 border border-slate-100' },
];

const STATUS_FLOW_PICKUP = [
    { key: 'pending', label: 'ממתין', icon: FaClock, badge: 'bg-amber-50 text-amber-800 border border-amber-100' },
    { key: 'received', label: 'התקבל', icon: FaBell, badge: 'bg-amber-50 text-amber-800 border border-amber-100' },
    { key: 'preparing', label: 'בהכנה', icon: FaSpinner, badge: 'bg-blue-50 text-blue-800 border border-blue-100' },
    {
        key: 'ready_pickup',
        label: 'מוכן לאיסוף',
        icon: FaCheckCircle,
        badge: 'bg-emerald-50 text-emerald-800 border border-emerald-100',
    },
    { key: 'delivered', label: 'נמסר לאיסוף', icon: FaBoxOpen, badge: 'bg-slate-50 text-slate-800 border border-slate-100' },
];

function OrderStatusFlowVisualizer() {
    const [mode, setMode] = useState('delivery'); // delivery | pickup
    const reduced = usePrefersReducedMotion();
    const steps = mode === 'delivery' ? STATUS_FLOW_DELIVERY : STATUS_FLOW_PICKUP;

    const [active, setActive] = useState(0);

    useEffect(() => {
        if (reduced) return undefined;
        setActive(0);
        const timer = window.setInterval(() => {
            setActive((prev) => (prev + 1) % steps.length);
        }, 1650);
        return () => clearInterval(timer);
    }, [reduced, mode, steps.length]);

    return (
        <div className="mt-6 rounded-3xl border border-orange-100/80 bg-gradient-to-bl from-orange-50/40 via-white to-slate-50/40 p-5 sm:p-6 shadow-inner shadow-orange-900/5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
                <div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-orange-900/55 mb-1">זרימת סטטוסים</p>
                    <h4 className="text-base font-black text-gray-900">משלוח מול איסוף עצמי</h4>
                </div>
                <div
                    role="radiogroup"
                    aria-label="סוג ההזמנה לתצוגה"
                    className="inline-flex rounded-2xl border border-gray-200 bg-white p-1 shadow-sm self-start sm:self-auto"
                >
                    <button
                        type="button"
                        role="radio"
                        aria-checked={mode === 'pickup'}
                        onClick={() => setMode('pickup')}
                        className={`rounded-xl px-4 py-2 text-xs font-black transition-all ${mode === 'pickup'
                            ? 'bg-gradient-to-b from-orange-600 to-orange-500 text-white shadow-md'
                            : 'text-gray-500 hover:text-orange-900'
                            }`}
                    >
                        איסוף עצמי
                    </button>
                    <button
                        type="button"
                        role="radio"
                        aria-checked={mode === 'delivery'}
                        onClick={() => setMode('delivery')}
                        className={`rounded-xl px-4 py-2 text-xs font-black transition-all ${mode === 'delivery'
                            ? 'bg-gradient-to-b from-orange-600 to-orange-500 text-white shadow-md'
                            : 'text-gray-500 hover:text-orange-900'
                            }`}
                    >
                        משלוח עד הבית
                    </button>
                </div>
            </div>

            <div className="relative pb-6">
                <div className="h-[3px] rounded-full bg-gray-100 overflow-hidden mx-1 mb-2" aria-hidden>
                    <div
                        className={`h-full w-full rounded-full bg-gradient-to-l from-brand-primary via-orange-400 to-orange-500 ${reduced ? 'opacity-40' : 'animate-guide-flow-stripe'
                            }`}
                    />
                </div>

                <ul className="flex flex-row-reverse flex-wrap items-start justify-center gap-x-3 gap-y-6 pt-6">
                    {steps.map((step, idx) => {
                        const Ico = step.icon;
                        const isHot = !reduced && idx === active;
                        return (
                            <li key={`${step.key}-${mode}`} className="flex flex-col items-center gap-2 w-[5.85rem] sm:w-[106px]">
                                <button
                                    type="button"
                                    aria-current={isHot ? 'step' : undefined}
                                    onClick={() => setActive(idx)}
                                    className={`relative w-full rounded-2xl px-3 py-2 text-center shadow-sm transition-all duration-500 motion-reduce:transition-opacity ${step.badge
                                        } ${isHot ? 'scale-[1.05] shadow-lg shadow-orange-200/60 ring-2 ring-orange-400 z-[2]' : ''} ${reduced || isHot ? 'opacity-100 saturate-100' : 'opacity-[0.74] saturate-[0.9] hover:opacity-100 hover:saturate-100'
                                        }`}
                                >
                                    <span className="mb-1.5 flex justify-center text-lg leading-none opacity-95">
                                        <Ico
                                            className={
                                                step.key === 'preparing' && isHot && !reduced
                                                    ? 'animate-spin'
                                                    : ''
                                            }
                                        />
                                    </span>
                                    <span className="text-[10px] sm:text-[11px] font-black leading-tight">{step.label}</span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </div>

            <div className="rounded-2xl bg-white/85 border border-orange-50/90 px-4 py-3 backdrop-blur-[2px] space-y-2">
                <p className="text-sm font-semibold text-gray-900 leading-snug">
                    <Link to="/admin/orders" className="font-black text-brand-primary hover:underline">
                        הזמנות
                    </Link>{' '}
                    — מתוך הכרטיס: כל קליק הוא השלב הבא בתור.
                </p>
                <div className="text-xs text-gray-600 border-r-[3px] border-orange-300 pr-3">
                    {mode === 'delivery' ? (
                        <>
                            <p className="font-semibold mb-1">מתוך מה שמוכן עד הנמסר (משלוח):</p>
                            <GuideArrowChain steps={['מוכן למשלוח', 'במשלוח', 'נמסר']} />
                        </>
                    ) : (
                        <>
                            <p className="font-semibold mb-1">איסוף עצמי — אין שליח:</p>
                            <GuideArrowChain steps={['מוכן לאיסוף', 'נמסר לאיסוף']} />
                        </>
                    )}
                </div>
                {reduced ? <p className="text-[11px] text-gray-500">במצב ללא תנועה: מסתמכים על הסטטוס המוצג ובחירת שלב מהשורה.</p> : null}
            </div>
        </div>
    );
}

/** איור — טלפון + הורדה (SVG בסגנון סטארט־אפ נקי) */
function IllustrationHero() {
    return (
        <svg viewBox="0 0 320 180" className="w-full max-sm:max-h-36 shrink-0" aria-hidden fill="none">
            <defs>
                <linearGradient id="guide-grad-a" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#1f2c38" stopOpacity="0.12" />
                    <stop offset="100%" stopColor="#f97316" stopOpacity="0.15" />
                </linearGradient>
                <linearGradient id="guide-grad-b" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#ea580c" stopOpacity="0.95" />
                    <stop offset="100%" stopColor="#f97316" />
                </linearGradient>
            </defs>
            <rect width="320" height="180" rx="28" fill="url(#guide-grad-a)" />
            <rect x="172" y="24" width="120" height="132" rx="18" stroke="white" strokeWidth="6" fill="rgba(255,255,255,0.92)" />
            <rect x="188" y="44" width="88" height="10" rx="4" fill="rgba(243, 244, 246, 1)" />
            <rect x="188" y="64" width="64" height="8" rx="3" fill="rgba(229, 231, 235, 1)" />
            <circle cx="214" cy="112" r="22" fill="url(#guide-grad-b)" />
            <path d="M214 100v12M208 106l6 6 6-6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <path d="M204 118h20" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
            <rect x="24" y="48" width="128" height="96" rx="12" fill="rgba(255,255,255,0.7)" stroke="rgba(255,255,255,0.9)" strokeWidth="2" />
            <circle cx="60" cy="112" r="20" stroke="url(#guide-grad-b)" strokeWidth="3" fill="white" opacity="0.95" />
            <circle cx="100" cy="88" r="8" fill="rgba(249,115,22,0.35)" />
            <circle cx="124" cy="118" r="6" fill="rgba(249,115,22,0.2)" />
        </svg>
    );
}

function IllustrationMenuChef() {
    return (
        <svg viewBox="0 0 200 96" className="w-full max-w-[220px] h-auto" aria-hidden>
            <ellipse cx="100" cy="78" rx="72" ry="14" fill="rgba(249,115,22,0.12)" />
            <path d="M64 62c12-26 52-34 76-22 14 12 22 38 22 54H56c2-14 12-26 22-38z" fill="rgba(255,237,213,1)" stroke="rgba(251,146,60,0.5)" strokeWidth="2" />
            <ellipse cx="100" cy="52" rx="34" ry="34" fill="rgba(254,249,239,1)" stroke="rgba(251,146,60,0.45)" strokeWidth="2" />
            <circle cx="100" cy="52" r="26" fill="rgba(255,237,213,1)" opacity="0.9" />
            <circle cx="90" cy="48" r="4" fill="rgba(124,45,18,0.45)" />
            <circle cx="110" cy="48" r="4" fill="rgba(124,45,18,0.45)" />
            <path d="M90 62q10 10 20 0" stroke="rgba(124,45,18,0.35)" strokeWidth="3" strokeLinecap="round" fill="none" />
        </svg>
    );
}

function GuideSectionCard({ id, eyebrow, title, illustration, accentClass = '', icon, children }) {
    return (
        <section id={id} className="group scroll-mt-28 rounded-3xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden">
            <div className="relative">
                <div
                    className={`absolute inset-y-0 right-0 w-1 bg-gradient-to-b ${accentClass.includes('purple') ? 'from-violet-500 to-purple-600' : accentClass.includes('teal') ? 'from-teal-500 to-cyan-600' : accentClass.includes('amber') ? 'from-amber-500 to-orange-600' : 'from-brand-primary to-orange-500'}`}
                />
                <div className="p-6 sm:p-8 pr-8 sm:pr-10">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-6">
                        <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-1">{eyebrow}</p>
                            <h2 className="text-xl sm:text-2xl font-black text-gray-900 mb-3 flex flex-wrap items-center gap-3 tracking-tight">
                                <span className="inline-flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 text-brand-primary shadow-inner group-hover:from-orange-50 group-hover:to-amber-50/60 transition-colors duration-300">
                                    {icon}
                                </span>
                                {title}
                            </h2>
                            <div className="text-sm text-gray-600 leading-relaxed space-y-3">{children}</div>
                        </div>
                        {illustration && (
                            <div className="flex justify-center sm:justify-end sm:w-[220px] flex-shrink-0 opacity-95 pointer-events-none select-none md:transition-transform md:duration-500 md:group-hover:-translate-y-1">
                                {illustration}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}

export default function AdminRestaurantGuide() {
    const { canInstall, isIos, isStandalone, promptInstall } = useInstallPrompt();
    const { isManager, isOwner } = useAdminAuth();
    const location = useLocation();

    const visibleNav = SECTIONS.filter(
        (s) => (!s.ownerOnly || isOwner()) && (!s.managerOnly || isManager())
    );

    useEffect(() => {
        const hash = location.hash?.replace(/^#/, '');
        if (!hash) return;
        requestAnimationFrame(() => {
            document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }, [location.pathname, location.hash]);

    return (
        <AdminLayout>
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-16">
                {/* Hero */}
                <div className="mb-10 rounded-3xl border border-gray-100 bg-gradient-to-br from-white via-orange-50/40 to-amber-50/30 overflow-hidden shadow-lg shadow-orange-100/40">
                    <div className="flex flex-col lg:flex-row lg:items-stretch gap-8 p-6 sm:p-10">
                        <div className="flex-1 flex flex-col justify-center min-w-0">
                            <Link
                                to="/admin/settings-hub"
                                className="inline-flex items-center gap-2 text-sm font-bold text-brand-primary hover:underline mb-4 self-start"
                            >
                                ← חזרה למרכז ההגדרות
                            </Link>
                            <div className="flex items-start gap-3 mb-4">
                                <span className="inline-flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-white shadow-md text-brand-primary">
                                    <FaBookOpen size={26} />
                                </span>
                                <div>
                                    <span className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-orange-700 border border-orange-100 shadow-sm mb-2">
                                        <FaRocket size={11} /> הדרכה מלאה
                                    </span>
                                    <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
                                        מדריך {PRODUCT_NAME} למסעדה
                                    </h1>
                                </div>
                            </div>
                            <p className="text-sm sm:text-base text-gray-600 leading-relaxed mb-6 max-w-xl">
                                התקנה מהדפדפן ואז הזמנות, תפריט והגדרות — מותאם לטאבלט במסעדה או למחשב בקופה.
                            </p>
                            <div className="flex flex-wrap gap-3">
                                <a
                                    href="#install"
                                    className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-orange-900/15 hover:opacity-92 transition-opacity"
                                >
                                    <FaDownload size={14} /> התחילו מהתקנה
                                </a>
                                <a
                                    href="#overview"
                                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-bold text-gray-700 hover:border-brand-primary hover:text-brand-primary transition-colors"
                                >
                                    צללו בהדרכה <FaChevronDown size={12} />
                                </a>
                            </div>
                        </div>
                        <div className="flex justify-center lg:justify-end items-center lg:min-w-[300px] text-brand-primary rounded-2xl bg-white/50 p-4 border border-orange-100/60">
                            <IllustrationHero />
                        </div>
                    </div>
                </div>

                {/* מובייל — תוכן עניינים מהיר */}
                <nav className="lg:hidden mb-6 overflow-x-auto overscroll-x-contain" aria-label="תוכן עניינים">
                    <div className="flex gap-2 flex-nowrap pb-1 pr-px">
                        {visibleNav.map((item) => (
                            <a
                                key={item.id}
                                href={`#${item.id}`}
                                className="shrink-0 rounded-full border border-gray-200 bg-white px-4 py-2 text-[11px] font-black text-gray-700 shadow-sm hover:border-brand-primary hover:text-brand-primary transition-colors whitespace-nowrap"
                            >
                                {item.label}
                            </a>
                        ))}
                    </div>
                </nav>

                <div className="flex flex-col lg:flex-row gap-8 lg:gap-10 lg:items-start">
                    {/* Sticky TOC — desktop */}
                    <nav className="hidden lg:block lg:w-56 flex-shrink-0 lg:sticky lg:top-28 z-10" aria-label="תוכן עניינים">
                        <div className="rounded-2xl border border-gray-100 bg-gray-50/95 p-4 shadow-sm">
                            <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-3">תוכן עניינים</p>
                            <ul className="space-y-1.5">
                                {visibleNav.map((item) => (
                                    <li key={item.id}>
                                        <a
                                            href={`#${item.id}`}
                                            className="block rounded-lg px-3 py-2 text-xs font-bold text-gray-700 hover:bg-white hover:text-brand-primary hover:shadow-sm transition-all border border-transparent hover:border-gray-100"
                                        >
                                            {item.label}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                            <div className="mt-4 pt-4 border-t border-gray-200/80">
                                <FaHandsHelping className="text-brand-primary mx-auto mb-2 opacity-80" size={22} />
                                <p className="text-[11px] text-gray-500 text-center leading-snug font-semibold">
                                    זקוקים לעזרה אישית? פנו אל תמיכת {PRODUCT_NAME}.
                                </p>
                            </div>
                        </div>
                    </nav>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-10">
                        <GuideSectionCard
                            id="install"
                            eyebrow="שלב 1"
                            title="התקנת אפליקציית הניהול"
                            icon={<FaMobileAlt size={22} />}
                        >
                            <p>
                                הניהול של {PRODUCT_NAME} רץ מהדפדפן גם בתור&nbsp;
                                <strong>אפליקציה (PWA)</strong> — מהיר יותר, בלי התקנה מה־Play Store/App Store.</p>
                            <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 flex gap-3 items-start">
                                <FaLightbulb className="text-amber-600 shrink-0 mt-0.5" size={16} />
                                <p className="text-xs text-amber-900 font-semibold leading-relaxed">
                                    טיפ: אחרי ההתקנה תראו את הדף בתצוגת אפליקציה במסך מלא.
                                </p>
                            </div>
                            {isStandalone ? (
                                <p className="text-sm font-bold text-emerald-700 flex items-center gap-2">
                                    <FaCheckCircle /> כבר בשימוש כאפליקציה — מצוין.
                                </p>
                            ) : isIos ? (
                                <ol className="space-y-2 list-decimal list-inside text-gray-700 font-semibold">
                                    <li>ב<strong>ספארי</strong>, לחצו על הכפתור &quot;<strong>שיתוף</strong>&quot; (ריבוע עם חץ למעלה).</li>
                                    <li>גללו ובחרו <strong>&quot;הוסף למסך הבית&quot;</strong>.</li>
                                    <li>אשרו — האייקון יופיע בבית ובמסגרת הניהול.</li>
                                </ol>
                            ) : (
                                <div className="space-y-3">
                                    <p className="font-semibold text-gray-800">מהמחשב או מאנדרואיד (Chrome / Edge המלצה):</p>
                                    {canInstall ? (
                                        <button
                                            type="button"
                                            onClick={() => promptInstall()}
                                            className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-5 py-3 text-white font-black shadow-md hover:opacity-92"
                                        >
                                            <FaDownload size={16} /> התקנה בלחיצה אחת
                                        </button>
                                    ) : (
                                        <p className="text-sm">
                                            מהתפריט של הדפדפן חפשו <strong>&quot;התקן אפליקציה&quot;</strong> או אייקון הורדה ליד שורת
                                            הכתובת. אם אין הצעה כזו עדיין, המשיכו בשימוש — לפעמים היא מוצגת אחרי זמן גלישה מהמארח.
                                        </p>
                                    )}
                                    <ul className="text-xs text-gray-500 grid gap-1 list-disc mr-5">
                                        <li>במרכז ההגדרות יש גם כפתור &quot;התקנה מהירה&quot; בבלוק &quot;הוספה מהירה&quot;.</li>
                                    </ul>
                                </div>
                            )}
                        </GuideSectionCard>

                        <GuideSectionCard
                            id="overview"
                            eyebrow="שלב 2"
                            title="מבנה לוח הבקרה"
                            icon={<FaDesktop size={21} />}
                            accentClass="purple"
                        >
                            <p>
                                מתפריט ההגדרות (ב<strong>מרכז ההגדרות</strong>) ובסרגל הצד של האדמין ניגשים לכל אזור. לוח הבקרה הראשי
                                מראה התראות, הזמנות פעילות ומהירות — זה מה שרוב הצוותים פותחים בבוקר.
                            </p>
                            <ul className="list-disc mr-5 space-y-2 text-gray-700">
                                <li>
                                    כפתור <strong>תצוגה כלקוח</strong> — עובר לתפריט כפי שהלקוח רואה (לבדוק מחירים ותמונות).
                                </li>
                                <li>ה<strong>פתקיות בראש</strong> מקשרות מהר לכל נושא: הזמנות, משלוחים, תפריט, עובדים ועוד.</li>
                            </ul>
                            <Link
                                to="/admin/dashboard"
                                className="inline-flex mt-3 text-sm font-bold text-brand-primary hover:underline"
                            >
                                → לוח ראשי
                            </Link>
                        </GuideSectionCard>

                        <GuideSectionCard
                            id="orders"
                            eyebrow="שלב 3"
                            title="הזמנות וסטטוסים"
                            icon={<FaClipboardList size={20} />}
                            accentClass="amber"
                        >
                            <p>
                                מקבלים הזמנה → מקדמים תהליך מהכרטיס; הלקוח רואה את אותו סטטוס במעקב.
                            </p>
                            <OrderStatusFlowVisualizer />
                            <Link to="/admin/orders" className="inline-flex mt-4 text-sm font-bold text-brand-primary hover:underline">
                                פתיחת מסך הזמנות →
                            </Link>
                        </GuideSectionCard>

                        <GuideSectionCard id="menu" eyebrow="שלב 4" title="תפריט ומחירים" illustration={<IllustrationMenuChef />} icon={<FaUtensils size={21} />} accentClass="">
                            <p>
                                <span className="font-black text-brand-primary">מה:&nbsp;</span>
                                מתוך <strong>ניהול התפריט</strong> (במרכז ההגדרות או בסרגל הצד למנהלי סניף) מנהלים
                                קטגוריות, פריטים, בסיסיות לפריט מורכב ובסיסיות ל&quot;סלטים&quot; (תוספות), והמחירים.
                                מה שמתעדכן כאן משתקף מיד בתפריט הלקוח.
                            </p>
                            <p>
                                <span className="font-black text-brand-primary">איך:&nbsp;</span>
                                עורכים — שומרים — ובודקים את התוצאה ב<strong>תצוגת לקוח</strong> מהלוח הבקרה או
                                בתצוגה המקדימה (קישורים למטה).
                            </p>
                            {!isManager() ? (
                                <p className="rounded-xl border border-gray-100 bg-gray-50/90 px-3 py-2.5 text-xs text-gray-700">
                                    <strong>להערה לצוות:</strong> עריכת התפריט זמינה ל<strong>מנהלי סניף ובעלי מסעדה</strong>{' '}
                                    בסרגל. לכולם — כפתור <strong>תצוגה כללקוח</strong> בשלב קודם או מתוך ההגדרות,
                                    כדי לראות מחירים ותצוגה בלי להיכנס לעריכה.
                                </p>
                            ) : (
                                <>
                                    <p className="text-[11px] font-black uppercase tracking-wider text-gray-500 mb-2 mt-4">
                                        הוספה מהירה מהממשק המלא
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        <Link
                                            to="/admin/menu-management?tab=items"
                                            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-black text-gray-800 shadow-sm hover:border-brand-primary hover:text-brand-primary transition-colors"
                                        >
                                            <FaUtensils size={14} /> <FaPlus size={9} className="opacity-60" />
                                            פריט לתפריט
                                        </Link>
                                        <Link
                                            to="/admin/menu-management?tab=salads"
                                            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-black text-gray-800 shadow-sm hover:border-brand-primary hover:text-brand-primary transition-colors"
                                        >
                                            <FaCarrot size={14} /> <FaPlus size={9} className="opacity-60" />
                                            תוספת / בסיס
                                        </Link>
                                        <Link
                                            to="/admin/menu-management"
                                            className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-black text-white shadow-md hover:opacity-92 transition-opacity"
                                        >
                                            כל הניהול
                                        </Link>
                                    </div>
                                    <p className="text-[11px] font-black uppercase tracking-wider text-gray-500 mb-2 mt-4">
                                        בדיקה לפני שעות שיא
                                    </p>
                                    <div className="flex flex-wrap gap-3 items-center text-sm font-bold">
                                        <Link
                                            to="/admin/preview-menu"
                                            className="inline-flex items-center gap-2 text-brand-primary hover:underline"
                                        >
                                            <FaEye size={14} aria-hidden /> תצוגה מקדימה תפריט
                                        </Link>
                                        <span className="text-gray-200 hidden sm:inline">|</span>
                                        <Link to="/admin/simulator" className="inline-flex text-brand-primary hover:underline">
                                            סימולטור סל ותשלום →
                                        </Link>
                                    </div>
                                    <p className="text-xs text-gray-600 mt-3 rounded-lg border border-amber-100 bg-amber-50/70 px-3 py-2 flex gap-2 items-start">
                                        <FaLightbulb className="text-amber-600 shrink-0 mt-0.5" size={14} />
                                        <span>
                                            אפשר לסמן פריט כ<strong>לא זמין זמנית</strong> — בלי למחוק. מחיקה נדרשת רק כשמתחיל לטעות (או פריט בתפריט מתעדכן לגמרי).
                                        </span>
                                    </p>
                                </>
                            )}
                        </GuideSectionCard>

                        {(isManager() || isOwner()) && (
                            <GuideSectionCard id="team" eyebrow="שלב 5" title="צוות והרשאות" icon={<FaUsers size={20} />} accentClass="">
                                <p>
                                    <span className="font-black text-brand-primary">מה:&nbsp;</span>
                                    ב<strong>צוות עובדים</strong> מוסיפים מיילים, קובעים סיסמה ומשייכים תפקיד — זה קובע מה
                                    יופיע בסרגל (למשל רק מנהל ובעלי מסעדה רואים תפריט, דוחות ומכשירים במסגרת ההרשאות).
                                </p>
                                <p>
                                    <span className="font-black text-brand-primary">איך:&nbsp;</span>
                                    מתוך הכרטיסים מעדכנים תפקיד, הפעלה/כיבוי, ולפעמים הפעלת גישה ל<strong>מסוף סניף</strong> עם PIN
                                    — אם מתאים למסגרת ההפעלה אצלכם{' '}
                                    <span className="text-gray-400">(יתכן מגבלה על גודל הצוות לפי תוכנית המנוי)</span>.
                                </p>
                                <div className="rounded-2xl border border-gray-100 bg-gray-50/95 p-4 text-xs text-gray-800 space-y-2.5">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1">מפת תפקידים (בקצרה)</p>
                                    <ul className="space-y-2 list-disc mr-4 text-gray-700">
                                        <li>
                                            <strong>בעל מסעדה</strong> — גישה מלאה, כולל מנוי ותשלום בחשבון (מופיע אוטומטית לבעל
                                            החשבון).
                                        </li>
                                        <li>
                                            <strong>מנהל צוות</strong> — ניהול רוב המערכת: תפריט, עובדים, דוחות, מכשירים, מבצעים —
                                            בהתאם להגדרות הסניף.
                                        </li>
                                        <li>
                                            <strong>עובד מטבח/דלפק</strong> — הזמנות ו&quot;השעות שלי&quot; בהתאם להגדרה; ללא ניהול
                                            תפריט בסרגל.
                                        </li>
                                        <li>
                                            <strong>שליח</strong> — הזמנות ומשלוח במסגרת התפקיד; ללא ניהול תפריט בסרגל.
                                        </li>
                                    </ul>
                                </div>
                                <Link
                                    to="/admin/employees"
                                    className="inline-flex mt-4 text-sm font-bold text-brand-primary hover:underline items-center gap-2"
                                >
                                    <FaUsers size={13} aria-hidden /> → ניהול עובדים והזמנה לצוות
                                </Link>
                            </GuideSectionCard>
                        )}

                        {(isManager() || isOwner()) && (
                            <GuideSectionCard id="delivery" eyebrow="שלב 6" title="משלוח ואזורי משלוח" icon={<FaMapMarkedAlt size={20} />} accentClass="teal">
                                <p>הגדירו אזורים, מינימום הזמנה ותעריפי משלוח בהתאם למרחק — כדי שהלקוח יראה מחיר אמין עוד בשלב ההזמנה.</p>
                                <Link to="/admin/delivery-zones" className="inline-flex mt-2 text-sm font-bold text-brand-primary hover:underline">
                                    → אזורי משלוח
                                </Link>
                            </GuideSectionCard>
                        )}

                        {(isManager() || isOwner()) && (
                            <GuideSectionCard id="devices" eyebrow="שלב 7" title="מסכי תצוגה וקיוסקים" icon={<FaTv size={18} />} accentClass="">
                                <div className="flex flex-wrap gap-6 items-start">
                                    <div className="flex items-center gap-3">
                                        <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50 text-orange-700">
                                            <FaTv size={22} />
                                        </span>
                                        <p className="text-sm mb-0">
                                            <strong>מסך חכם</strong> למטבח או לקיצור לקוח עם מספרי הזמנה.
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                                            <FaTabletAlt size={22} />
                                        </span>
                                        <p className="text-sm mb-0">
                                            <strong>קיוסק</strong> — הזמנה עצמית במקום בסניף.
                                        </p>
                                    </div>
                                </div>
                                <Link to="/admin/devices" className="inline-flex mt-4 text-sm font-bold text-brand-primary hover:underline">
                                    → הגדרות מכשירים
                                </Link>
                            </GuideSectionCard>
                        )}

                        {isOwner() && (
                            <GuideSectionCard
                                id="payments"
                                eyebrow="שלב 8"
                                title="תשלום, מנוי וחיובים"
                                icon={<FaCreditCard size={19} />}
                                accentClass=""
                            >
                                <p>כבעל מסעדה רואים מצב המנוי, אמצעי תשלום וקבלות — מתוך מרכז ההגדרות או מתפריט &quot;תשלום וחשבון&quot;.</p>
                                <div className="flex flex-wrap gap-3 mt-3">
                                    <Link
                                        to="/admin/payment-settings"
                                        className="inline-flex items-center gap-2 rounded-lg bg-gray-900 text-white px-4 py-2 text-xs font-black hover:bg-gray-800"
                                    >
                                        תשלום וחשבון
                                    </Link>
                                    <Link
                                        to="/admin/restaurant"
                                        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-xs font-bold text-gray-800 hover:border-brand-primary"
                                    >
                                        <FaStore /> פרטי מסעדה
                                    </Link>
                                </div>
                            </GuideSectionCard>
                        )}

                        <div className="rounded-3xl border-2 border-dashed border-orange-200 bg-gradient-to-br from-orange-50/80 to-amber-50/50 p-6 sm:p-8 flex flex-col sm:flex-row gap-6 items-start sm:items-center">
                            <FaQrcode className="text-orange-600 shrink-0" size={40} aria-hidden />
                            <div>
                                <h3 className="text-lg font-black text-gray-900 mb-1 flex items-center gap-2">
                                    שיתוף המסעדה עם לקוחות
                                </h3>
                                <p className="text-sm text-gray-700 leading-relaxed mb-3">
                                    צרו <strong>קוד QR</strong> מהיר — הלקוחות נכנסים ישר לתפריט אחרי סריקה מהנייד. מתאים
                                    לשולחנות, לעמדה בכניסה ו<strong>למשיכת לקוחות חדשים</strong>.
                                </p>
                                <Link
                                    to="/admin/qr-code"
                                    className="inline-flex rounded-xl bg-brand-primary px-5 py-2 text-sm font-black text-white shadow hover:opacity-92"
                                >
                                    ליצירת QR
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
