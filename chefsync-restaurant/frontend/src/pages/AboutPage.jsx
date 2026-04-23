import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CustomerLayout } from '../layouts/CustomerLayout';
import { AboutSeo } from '../components/seo/RestaurantSeo';
import {
    FaUtensils,
    FaShoppingBag,
    FaMoneyBillWave,
    FaShieldAlt,
    FaClock,
    FaStore,
    FaChevronDown,
    FaChevronUp,
    FaTruck,
    FaMobileAlt,
} from 'react-icons/fa';

/**
 * עמוד hub: /about
 * דף "איך זה עובד" + FAQ.
 * Laravel מזריק FAQPage JSON-LD בצד-שרת → Rich Snippets בגוגל.
 */
export default function AboutPage() {
    return (
        <CustomerLayout>
            <AboutSeo />

            <div className="py-6">
                <nav aria-label="Breadcrumb" className="mb-4 text-sm text-gray-500 dark:text-brand-dark-muted">
                    <Link to="/" className="hover:text-brand-primary">דף הבית</Link>
                    <span className="mx-2">/</span>
                    <span aria-current="page">איך זה עובד</span>
                </nav>

                <Hero />

                <HowItWorks />

                <WhyTakeEat />

                <ForRestaurants />

                <Faq />

                <Cta />
            </div>
        </CustomerLayout>
    );
}

function Hero() {
    return (
        <header className="mb-12 text-center sm:text-right">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-primary/10 text-brand-primary text-xs font-semibold mb-4">
                מה זה TakeEat?
            </div>
            <h1 className="text-3xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-4 leading-tight">
                הזמנת אוכל ישירות מהמסעדה,<br />
                בלי עמלות מוגזמות.
            </h1>
            <p className="text-base sm:text-xl text-gray-600 dark:text-brand-dark-muted max-w-3xl leading-relaxed">
                TakeEat (טייק איט) היא פלטפורמה ישראלית שמאפשרת לסועדים להזמין אוכל ישירות מהמסעדה
                — במקום דרך אפליקציות משלוחים שגובות עמלות של 20%–35%. התוצאה: המסעדות מקבלות יותר,
                אתם משלמים פחות, והאוכל מגיע מהר יותר.
            </p>
        </header>
    );
}

const STEPS = [
    {
        icon: FaStore,
        title: '1. בוחרים מסעדה',
        text: 'גולשים לאתר, רואים את כל המסעדות הזמינות באזור, ובוחרים לפי מטבח, עיר או העדפה אישית.',
    },
    {
        icon: FaMobileAlt,
        title: '2. מזמינים מהתפריט',
        text: 'מעיינים בתפריט דיגיטלי מלא עם תמונות, מחירים ורכיבים. בוחרים מנות, מוסיפים הערות ומגיעים לעגלה.',
    },
    {
        icon: FaMoneyBillWave,
        title: '3. משלמים מאובטח',
        text: 'בוחרים משלוח או איסוף עצמי, משלמים באשראי / ביט / Apple Pay / Google Pay. התשלום מאובטח דרך HYP.',
    },
    {
        icon: FaTruck,
        title: '4. מקבלים את ההזמנה',
        text: 'מקבלים עדכוני סטטוס בזמן אמת — מאישור ההזמנה, דרך ההכנה ועד להגעה. פשוט, מהיר ושקוף.',
    },
];

function HowItWorks() {
    return (
        <section className="mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                איך זה עובד?
            </h2>
            <p className="text-gray-600 dark:text-brand-dark-muted mb-8">
                ארבעה צעדים פשוטים מהרגע שהתחשק לכם אוכל ועד שהוא על השולחן.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {STEPS.map((step) => (
                    <div
                        key={step.title}
                        className="bg-white dark:bg-brand-dark-surface rounded-2xl p-6 border border-gray-100 dark:border-brand-dark-border"
                    >
                        <step.icon className="text-3xl text-brand-primary mb-4" />
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">{step.title}</h3>
                        <p className="text-sm text-gray-600 dark:text-brand-dark-muted leading-relaxed">{step.text}</p>
                    </div>
                ))}
            </div>
        </section>
    );
}

const ADVANTAGES = [
    {
        icon: FaMoneyBillWave,
        title: 'ללא עמלות מוגזמות',
        text: 'המחיר שאתם רואים הוא המחיר שהמסעדה גובה. בלי תוספות סמויות, בלי עמלות "שירות".',
    },
    {
        icon: FaShieldAlt,
        title: 'תשלום מאובטח',
        text: 'סליקה דרך HYP — ספק מאושר בנק ישראל. תמיכה באשראי, ביט, Apple Pay ו-Google Pay.',
    },
    {
        icon: FaClock,
        title: 'מעקב בזמן אמת',
        text: 'תראו בדיוק באיזה שלב ההזמנה שלכם — מאישור, דרך ההכנה ועד למשלוח.',
    },
    {
        icon: FaUtensils,
        title: 'תפריט מלא',
        text: 'תפריט דיגיטלי עם תמונות, תיאורים, רכיבים ומחירים מעודכנים. כולל מידע על אלרגנים.',
    },
    {
        icon: FaTruck,
        title: 'משלוח ואיסוף',
        text: 'בוחרים מה שנוח יותר — משלוח עד הבית או איסוף עצמי מהמסעדה. המסעדה קובעת את העלות.',
    },
    {
        icon: FaShoppingBag,
        title: 'הזמנה בלחיצה',
        text: 'ממשק פשוט, מהיר ובעברית. מתאים לנייד ולמחשב, עם תמיכה ב-PWA להתקנה על המסך.',
    },
];

function WhyTakeEat() {
    return (
        <section className="mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                למה TakeEat?
            </h2>
            <p className="text-gray-600 dark:text-brand-dark-muted mb-8 max-w-3xl">
                כשמזמינים ב-TakeEat, גם אתם וגם המסעדה מרוויחים. ככה זה עובד:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {ADVANTAGES.map((adv) => (
                    <div
                        key={adv.title}
                        className="bg-white dark:bg-brand-dark-surface rounded-2xl p-6 border border-gray-100 dark:border-brand-dark-border"
                    >
                        <adv.icon className="text-2xl text-brand-primary mb-3" />
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">{adv.title}</h3>
                        <p className="text-sm text-gray-600 dark:text-brand-dark-muted leading-relaxed">{adv.text}</p>
                    </div>
                ))}
            </div>
        </section>
    );
}

function ForRestaurants() {
    return (
        <section className="mb-16 bg-gradient-to-br from-brand-primary/5 to-amber-50 dark:from-brand-dark-surface dark:to-brand-dark-bg rounded-2xl p-6 sm:p-10 border border-gray-100 dark:border-brand-dark-border">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3">
                בעלי מסעדה? זה בשבילכם.
            </h2>
            <p className="text-gray-700 dark:text-brand-dark-muted mb-6 max-w-3xl leading-relaxed">
                ב-TakeEat תקבלו מערכת הזמנות חכמה עם תפריט דיגיטלי, ניהול הזמנות, משלוחים וסטטיסטיקות —
                תמורת דמי מנוי חודשיים קבועים וללא עמלה על כל הזמנה. שליטה מלאה על הסועדים שלכם, על המחיר,
                ועל חוויית הלקוח.
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6 text-sm text-gray-700 dark:text-brand-dark-muted">
                <li className="flex items-start gap-2">
                    <span className="text-brand-primary font-bold">✓</span>
                    תפריט דיגיטלי מלא עם ניהול קטגוריות ופריטים
                </li>
                <li className="flex items-start gap-2">
                    <span className="text-brand-primary font-bold">✓</span>
                    סליקה דרך HYP + חשבוניות אוטומטיות
                </li>
                <li className="flex items-start gap-2">
                    <span className="text-brand-primary font-bold">✓</span>
                    דומיין דיגיטלי ייעודי למסעדה + עמוד לשיתוף
                </li>
                <li className="flex items-start gap-2">
                    <span className="text-brand-primary font-bold">✓</span>
                    ניהול משלוחים, איסוף עצמי ודוחות מכירות
                </li>
            </ul>
            <Link
                to="/register-restaurant"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-primary text-white font-semibold hover:opacity-90 transition-opacity"
            >
                להרשמת מסעדה ל-TakeEat
            </Link>
        </section>
    );
}

const FAQ_ITEMS = [
    {
        q: 'מה זה TakeEat?',
        a: 'TakeEat (טייק איט) היא פלטפורמה ישראלית שמאפשרת למסעדות למכור אוכל אונליין ישירות לסועדים, ללא עמלות מוגזמות של אפליקציות משלוחים. הסועדים מקבלים תפריט דיגיטלי מלא, משלוח או איסוף עצמי, ומעקב הזמנה בזמן אמת.',
    },
    {
        q: 'כמה עולה להזמין ב-TakeEat?',
        a: 'המחירים ב-TakeEat הם המחירים המקוריים של המסעדה — ללא תוספות סמויות. דמי משלוח נקבעים על ידי המסעדה עצמה.',
    },
    {
        q: 'אילו אמצעי תשלום נתמכים?',
        a: 'בהתאם להגדרות של כל מסעדה: מזומן (למשל במשלוח או באיסוף), וכאשר המסעדה מחוברת לסליקה — גם כרטיס אשראי וביט (כולל Apple Pay / Google Pay דרך הסליקה). התשלום המקוון עובר דרך ספקים מורשים (HYP).',
    },
    {
        q: 'האם אפשר להזמין במשלוח וגם באיסוף עצמי?',
        a: 'כן. כל מסעדה מגדירה אילו אפשרויות הגשה זמינות — משלוח, איסוף עצמי, או שתיהן.',
    },
    {
        q: 'אני בעל מסעדה — איך נרשמים ל-TakeEat?',
        a: 'אפשר להירשם דרך עמוד הרשמת מסעדה באתר. ההרשמה כוללת הגדרת תפריט, חיבור ל-HYP לתשלומים וקבלת דומיין דיגיטלי למסעדה.',
    },
];

function Faq() {
    const [openIndex, setOpenIndex] = useState(0);

    return (
        <section className="mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                שאלות נפוצות
            </h2>
            <p className="text-gray-600 dark:text-brand-dark-muted mb-8">
                התשובות לשאלות הכי נפוצות מהסועדים ומבעלי המסעדות שלנו.
            </p>
            <div className="space-y-3">
                {FAQ_ITEMS.map((item, i) => {
                    const isOpen = openIndex === i;
                    return (
                        <div
                            key={i}
                            className="bg-white dark:bg-brand-dark-surface rounded-xl border border-gray-100 dark:border-brand-dark-border overflow-hidden"
                        >
                            <button
                                onClick={() => setOpenIndex(isOpen ? -1 : i)}
                                className="w-full text-right px-5 py-4 flex items-center justify-between gap-4 hover:bg-gray-50 dark:hover:bg-brand-dark-bg transition-colors"
                                aria-expanded={isOpen}
                            >
                                <span className="font-semibold text-gray-900 dark:text-white">{item.q}</span>
                                {isOpen ? <FaChevronUp className="text-gray-400 flex-shrink-0" /> : <FaChevronDown className="text-gray-400 flex-shrink-0" />}
                            </button>
                            {isOpen && (
                                <div className="px-5 pb-5 text-gray-600 dark:text-brand-dark-muted leading-relaxed">
                                    {item.a}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

function Cta() {
    return (
        <section className="text-center bg-brand-primary text-white rounded-2xl p-8 sm:p-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">רוצים להתחיל להזמין?</h2>
            <p className="text-white/90 mb-6 max-w-xl mx-auto">
                בחרו מסעדה מהרשימה והתחילו להזמין בקלות. משלוח מהיר, איסוף עצמי, תשלום מאובטח.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
                <Link
                    to="/restaurants"
                    className="px-6 py-3 rounded-xl bg-white text-brand-primary font-semibold hover:bg-gray-100 transition-colors"
                >
                    לכל המסעדות
                </Link>
                <Link
                    to="/restaurants/new"
                    className="px-6 py-3 rounded-xl border-2 border-white text-white font-semibold hover:bg-white/10 transition-colors"
                >
                    מסעדות חדשות
                </Link>
            </div>
        </section>
    );
}
