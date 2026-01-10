import React from 'react';
import { Link } from 'react-router-dom';
import { CustomerLayout } from '../layouts/CustomerLayout';
import woltLogo from '../images/woltLogo.png';
import tenBisLogo from '../images/tenBisLogo.png';
import mishlohaLogo from '../images/mishlohaLogo.jpeg';
import logo from '../images/ChefSyncLogoIcon.png';
import { PRODUCT_BYLINE_HE, PRODUCT_NAME } from '../constants/brand';
/**
 * דף נחיתה שיווקי – TakeEat
 * מסעדה אונליין מלאה | כמו וולט / תן ביס / משלוחה – בלי אחוזים
 */
export default function LandingPage() {
    const benefits = [
        {
            title: 'מסעדה אונליין מלאה',
            desc: 'הלקוח מזמין מהספה: תפריט, סל קניות, תוספות, משלוח וסטטוס – הכול אונליין עד לדלת.'
        },
        {
            title: 'אותה חוויה כמו אפליקציות משלוחים',
            desc: 'עובד כמו וולט, תן ביס או משלוחה – רק שהלקוחות מזמינים ישירות מהמסעדה.'
        },
        {
            title: 'בלי אחוזים מכל הזמנה',
            desc: 'במקום לשלם עמלות – משלמים מנוי חודשי קבוע. יותר רווח, פחות תלות.'
        },
        {
            title: 'המותג והלקוחות נשארים אצלך',
            desc: 'האתר, ההזמנות והנתונים שייכים למסעדה. אנחנו רק הפלטפורמה.'
        },
    ];

    const steps = [
        {
            label: '1. הלקוח מזמין אונליין',
            detail: 'נכנס לעמוד המסעדה, בוחר מנות ומשלים הזמנה מהטלפון.'
        },
        {
            label: '2. המסעדה מקבלת ומכינה',
            detail: 'ההזמנה נכנסת למערכת, הסטטוס מתעדכן והמטבח עובד מסודר.'
        },
        {
            label: '3. ההזמנה מגיעה ללקוח',
            detail: 'משלוח או איסוף עצמי – עד לסיפוק מלא של ההזמנה.'
        },
    ];

    const plans = [
        {
            name: 'חודשי',
            price: '₪600',
            period: 'למסעדה / חודש',
            features: [
                'מסעדה אונליין מלאה',
                'הזמנות ומשלוחים',
                'ניהול סטטוס למטבח',
                'ללא עמלות הזמנה',
                'תמיכה מלאה בעברית'
            ],
            badge: 'הכי גמיש',
        },
        {
            name: 'שנתי',
            price: '₪5,000',
            period: 'למסעדה / שנה',
            features: [
                'חיסכון משמעותי',
                'הטמעת תפריט ללא עלות',
                'עדיפות בתמיכה',
                'כל הפיצ׳רים פתוחים'
            ],
            badge: 'הכי משתלם',
        },
    ];

    return (
        <CustomerLayout>
            <div className="-mx-4 sm:-mx-6 lg:-mx-8">

                {/* Hero */}
                <div className="relative overflow-hidden bg-gradient-to-br from-brand-dark via-brand-primary to-brand-secondary text-white rounded-3xl px-6 sm:px-10 py-14 sm:py-18">
                    <div className="absolute inset-0 opacity-15 bg-[radial-gradient(circle_at_top_left,#ffffff33,transparent_45%)]" />

                    <div className="relative grid gap-8 lg:grid-cols-[1.1fr_0.9fr] items-center">
                        <div className="space-y-6">
                            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-brand-primary text-white text-sm font-semibold px-4 py-2 rounded-full shadow-lg animate-pulse">
                                <span>🎁</span>
                                <span>14 ימי התנסות חינם - ללא התחייבות!</span>
                            </div>

                            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight">
                                {PRODUCT_NAME} – המסעדה שלך אונליין
                            </h1>

                            <p className="text-white/70 text-sm font-medium">{PRODUCT_BYLINE_HE}</p>

                            <p className="text-white/90 text-lg max-w-2xl">
                                פלטפורמת הזמנות מלאה למסעדות:
                                הלקוח מזמין מהספה, המערכת מרכזת הכול,
                                והמסעדה מספקת עד הדלת – במנוי חודשי קבוע.
                            </p>

                            <div className="flex flex-wrap gap-4">
                                <Link
                                    to="/register-restaurant"
                                    className="px-6 py-3 bg-white text-brand-dark font-semibold rounded-xl shadow hover:shadow-xl transition flex items-center gap-2"
                                >
                                    <span>התחל ניסיון חינם 14 יום</span>
                                    <span>🎁</span>
                                </Link>
                                <a
                                    href="#comparison"
                                    className="px-6 py-3 border border-white/70 rounded-xl font-semibold hover:bg-white/10 transition"
                                >
                                    השוואה לפלטפורמות
                                </a>
                            </div>

                            <div className="text-sm text-white/80 flex flex-wrap gap-4">
                                <span>💳 מנוי חודשי / שנתי</span>
                                <span>❌ בלי אחוזים</span>
                                <span>🛡️ שליטה מלאה</span>
                            </div>
                        </div>

                        <div className="bg-white text-brand-dark rounded-2xl shadow-2xl p-6 space-y-4">
                            <div className="bg-gradient-to-r from-blue-50 to-brand-light border border-brand-primary/30 rounded-xl p-3 mb-2">
                                <p className="text-brand-primary font-semibold text-sm text-center">🎁 14 ימי ניסיון חינם</p>
                            </div>
                            <h3 className="text-2xl font-bold">מהזמנה – עד משלוח</h3>
                            <p className="text-gray-700 text-sm">
                                תפריט, סל קניות, הזמנה, סטטוס ומשלוח –
                                הכול מרוכז בפאנל אחד למטבח.
                            </p>

                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="p-4 rounded-xl bg-brand-light">
                                    <p className="text-xs text-gray-600 mb-1">עלות חודשית</p>
                                    <p className="text-2xl font-bold">₪600</p>
                                </div>
                                <div className="p-4 rounded-xl bg-brand-dark text-white">
                                    <p className="text-xs text-white/80 mb-1">ללא עמלות</p>
                                    <p className="text-lg font-bold">100% למסעדה</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Live Demo Section */}
                <section className="mt-16 bg-gradient-to-b from-gray-50 to-white rounded-3xl p-4 sm:p-8 lg:p-12">
                    <div className="text-center mb-8 sm:mb-10">
                        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3 sm:mb-4">
                            ראה את המערכת בפעולה
                        </h2>
                        <p className="text-gray-600 text-base sm:text-lg">
                            המערכת כבר חיה ועובדת – נסה בעצמך עכשיו
                        </p>
                    </div>

                    <div className="flex flex-col lg:grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
                        {/* iPhone Mockup */}
                        <div className="relative mx-auto w-full max-w-[280px] sm:max-w-[300px]">
                            <div className="relative w-full aspect-[9/18] max-w-[280px] sm:max-w-[300px] mx-auto">
                                {/* iPhone Frame */}
                                <div className="absolute inset-0 bg-black rounded-[40px] sm:rounded-[55px] shadow-2xl p-2 sm:p-3">
                                    <div className="w-full h-full bg-white rounded-[32px] sm:rounded-[45px] overflow-hidden">
                                        {/* Notch */}
                                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 sm:w-32 h-5 sm:h-7 bg-black rounded-b-2xl sm:rounded-b-3xl z-10"></div>

                                        {/* Screen Content - Scrolling Demo */}
                                        <div className="w-full h-full overflow-hidden">
                                            <iframe
                                                src="https://chefsync.vercel.app/"
                                                className="w-full h-full border-0"
                                                title="TakeEat Demo"
                                                loading="lazy"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Floating badges - Hidden on mobile, shown on larger screens */}
                                <div className="hidden sm:block absolute -right-8 top-20 bg-green-500 text-white text-xs px-3 py-2 rounded-full shadow-lg animate-pulse">
                                    🟢 LIVE
                                </div>
                                <div className="hidden sm:block absolute -left-8 bottom-32 bg-blue-500 text-white text-xs px-3 py-2 rounded-full shadow-lg">
                                    📱 PWA
                                </div>
                            </div>

                            {/* Mobile badges below phone */}
                            <div className="sm:hidden flex justify-center gap-2 mt-4">
                                <span className="bg-green-500 text-white text-xs px-3 py-1.5 rounded-full shadow animate-pulse">
                                    🟢 LIVE
                                </span>
                                <span className="bg-blue-500 text-white text-xs px-3 py-1.5 rounded-full shadow">
                                    📱 PWA
                                </span>
                            </div>
                        </div>

                        {/* Demo Controls */}
                        <div className="space-y-4 sm:space-y-6 w-full">
                            <div className="bg-white p-4 sm:p-6 rounded-2xl border shadow-sm">
                                <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">🍕 נסה מסעדות דוגמה</h3>
                                <div className="space-y-2 sm:space-y-3">
                                    <a
                                        href="https://chefsync.vercel.app/pizza-palace/menu"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block p-4 border rounded-xl hover:border-brand-primary hover:bg-brand-light/30 transition group"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-semibold group-hover:text-brand-primary">Pizza Palace</p>
                                                <p className="text-sm text-gray-500">פיצה איטלקית אמיתית</p>
                                            </div>
                                            <span className="text-2xl">→</span>
                                        </div>
                                    </a>

                                    <a
                                        href="https://chefsync.vercel.app/burger-central/menu"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block p-4 border rounded-xl hover:border-brand-primary hover:bg-brand-light/30 transition group"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-semibold group-hover:text-brand-primary">Burger Central</p>
                                                <p className="text-sm text-gray-500">המבורגרים עסיסיים</p>
                                            </div>
                                            <span className="text-2xl">→</span>
                                        </div>
                                    </a>

                                    <a
                                        href="https://chefsync.vercel.app/sushi-master/menu"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block p-4 border rounded-xl hover:border-brand-primary hover:bg-brand-light/30 transition group"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-semibold group-hover:text-brand-primary">Sushi Master</p>
                                                <p className="text-sm text-gray-500">סושי טרי מהים</p>
                                            </div>
                                            <span className="text-2xl">→</span>
                                        </div>
                                    </a>
                                </div>
                            </div>

                            <div className="bg-brand-primary text-white p-4 sm:p-6 rounded-2xl">
                                <h3 className="text-base sm:text-lg font-bold mb-2">💡 טיפ</h3>
                                <p className="text-sm text-white/90">
                                    נסה להוסיף מנות לעגלה, לעקוב אחרי הזמנה ולראות איך המערכת עובדת בזמן אמת
                                </p>
                            </div>

                            <a
                                href="https://chefsync.vercel.app/admin/login"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block text-center p-3 sm:p-4 bg-gray-800 text-white rounded-xl text-sm sm:text-base font-semibold hover:bg-gray-900 transition"
                            >
                                🔑 כניסה לפאנל ניהול (דמו)
                            </a>
                        </div>
                    </div>
                </section>

                {/* Free Trial Section */}
                <section className="mt-16 bg-gradient-to-br from-blue-50 via-brand-light/50 to-purple-50 rounded-3xl p-8 sm:p-12 border border-brand-primary/20">
                    <div className="text-center mb-8">
                        <div className="inline-block bg-gradient-to-r from-blue-500 to-brand-primary text-white px-6 py-2 rounded-full font-bold text-lg mb-4">
                            🎁 הצעה מיוחדת
                        </div>
                        <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                            14 ימי התנסות חינם
                        </h2>
                        <p className="text-gray-700 text-lg max-w-2xl mx-auto">
                            נסה את המערכת המלאה ללא עלות ו<strong>ללא התחייבות</strong>
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6 mb-8">
                        <div className="bg-white p-6 rounded-2xl shadow-sm text-center">
                            <div className="text-4xl mb-3">✅</div>
                            <h3 className="font-bold text-lg mb-2">גישה מלאה</h3>
                            <p className="text-gray-600 text-sm">
                                כל הפיצ'רים והיכולות ללא הגבלה
                            </p>
                        </div>

                        <div className="bg-white p-6 rounded-2xl shadow-sm text-center">
                            <div className="text-4xl mb-3">💳</div>
                            <h3 className="font-bold text-lg mb-2">כרטיס אשראי</h3>
                            <p className="text-gray-600 text-sm">
                                נדרש לצורך אימות בלבד - <strong>לא יחויב</strong> בתקופת הניסיון
                            </p>
                        </div>

                        <div className="bg-white p-6 rounded-2xl shadow-sm text-center">
                            <div className="text-4xl mb-3">🔔</div>
                            <h3 className="font-bold text-lg mb-2">תזכורת מראש</h3>
                            <p className="text-gray-600 text-sm">
                                נשלח תזכורת 3 ימים לפני סיום הניסיון
                            </p>
                        </div>
                    </div>

                    <div className="bg-white/90 backdrop-blur p-6 rounded-2xl border border-brand-primary/30 shadow-sm">
                        <h3 className="font-bold text-lg mb-3 text-center">📋 תנאי הניסיון</h3>
                        <ul className="space-y-2 text-gray-700 max-w-2xl mx-auto">
                            <li className="flex items-start gap-2">
                                <span className="text-brand-primary font-bold">•</span>
                                <span>14 ימים מלאים להתנסות בכל יכולות המערכת</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-brand-primary font-bold">•</span>
                                <span>ללא חיוב עד סיום תקופת הניסיון</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-brand-primary font-bold">•</span>
                                <span>ניתן לבטל בכל עת ללא עלות</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-brand-primary font-bold">•</span>
                                <span>לאחר הניסיון - חיוב חודשי של ₪600 או שנתי של ₪5,000</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-brand-primary font-bold">•</span>
                                <span>סליקה מאובטחת דרך טרנזילה</span>
                            </li>
                        </ul>
                    </div>

                    <div className="text-center mt-8">
                        <Link
                            to="/register-restaurant"
                            className="inline-block px-8 py-4 bg-gradient-to-r from-blue-500 to-brand-primary text-white text-lg font-bold rounded-xl shadow-lg hover:shadow-xl transition transform hover:scale-105"
                        >
                            🎁 התחל ניסיון חינם עכשיו
                        </Link>
                        <p className="text-sm text-gray-500 mt-3">
                            ללא התחייבות • ביטול בקליק אחד
                        </p>
                    </div>
                </section>

                {/* Benefits */}
                <section className="mt-16">
                    <h2 className="text-2xl sm:text-3xl font-bold mb-6">
                        אותה פלטפורמה – מודל אחר
                    </h2>

                    <div className="grid gap-6 md:grid-cols-2">
                        {benefits.map(item => (
                            <div key={item.title} className="p-6 bg-white rounded-2xl border shadow-sm">
                                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                                <p className="text-gray-600">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Comparison */}
                <section id="comparison" className="mt-16 bg-white rounded-3xl p-8 border shadow-sm">
                    <h2 className="text-2xl sm:text-3xl font-bold mb-8">
                        השוואה לפלטפורמות משלוחים
                    </h2>

                    <div className="grid md:grid-cols-2 gap-8">
                        <div className="p-6 rounded-2xl border">
                            <div className="flex items-center gap-3 flex-wrap mb-4">
                                <img src={woltLogo} alt="Wolt" className="h-6 opacity-80" />
                                <img src={tenBisLogo} alt="10bis" className="h-6 opacity-80" />
                                <img src={mishlohaLogo} alt="משלוחה" className="h-6 opacity-80" />
                            </div>
                            <ul className="space-y-2 text-gray-700">
                                <li>✔ פלטפורמת הזמנות מלאה</li>
                                <li>✔ חוויית לקוח מעולה</li>
                                <li>❌ אחוזים מכל הזמנה</li>
                                <li>❌ הלקוח שייך לפלטפורמה</li>
                            </ul>
                        </div>

                        <div className="p-6 rounded-2xl border border-brand-primary">
                            <div className="flex items-center gap-3 mb-4">
                                <img src={logo} alt={PRODUCT_NAME} className="h-6" />
                                <div>
                                    <span className="text-xl font-bold text-brand-primary">{PRODUCT_NAME}</span>
                                    <p className="text-xs text-gray-500">{PRODUCT_BYLINE_HE}</p>
                                </div>
                            </div>
                            <ul className="space-y-2 text-gray-700">
                                <li>✔ אותה חוויית הזמנה</li>
                                <li>✔ משלוחים וסטטוס</li>
                                <li>✔ מנוי חודשי קבוע</li>
                                <li>✔ הלקוחות שייכים למסעדה</li>
                            </ul>
                        </div>
                    </div>
                </section>

                {/* Steps */}
                <section className="mt-16 bg-white rounded-3xl p-8 border shadow-sm">
                    <h2 className="text-2xl sm:text-3xl font-bold mb-6">
                        מהספה של הלקוח – עד לדלת
                    </h2>

                    <div className="grid gap-6 md:grid-cols-3">
                        {steps.map(step => (
                            <div key={step.label} className="p-5 bg-brand-light rounded-2xl">
                                <p className="font-semibold text-brand-primary mb-2">{step.label}</p>
                                <p className="text-gray-700">{step.detail}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Plans */}
                <section id="plans" className="mt-16">
                    <h2 className="text-2xl sm:text-3xl font-bold mb-6">
                        תמחור פשוט. בלי הפתעות.
                    </h2>

                    <div className="grid gap-6 md:grid-cols-2">
                        {plans.map(plan => (
                            <div key={plan.name} className="relative p-6 bg-white rounded-2xl border shadow-sm">
                                <span className="absolute -top-3 right-4 bg-brand-primary text-white text-xs px-3 py-1 rounded-full">
                                    {plan.badge}
                                </span>

                                <h3 className="text-2xl font-bold">{plan.name}</h3>
                                <p className="text-sm text-gray-500 mb-3">{plan.period}</p>
                                <p className="text-3xl font-bold mb-4">{plan.price}</p>

                                <ul className="space-y-2 mb-4">
                                    {plan.features.map(f => (
                                        <li key={f} className="text-gray-700">• {f}</li>
                                    ))}
                                </ul>

                                <Link
                                    to="/register-restaurant"
                                    className="inline-block px-5 py-3 bg-brand-primary text-white rounded-xl font-semibold"
                                >
                                    פותחים מסעדה אונליין
                                </Link>
                            </div>
                        ))}
                    </div>
                </section>

                {/* CTA */}
                <section className="mt-16 bg-brand-dark text-white rounded-2xl p-8 flex flex-col sm:flex-row justify-between gap-6">
                    <div>
                        <h3 className="text-2xl font-bold mb-2">
                            אותה חוויה ללקוח – פחות הוצאות למסעדה
                        </h3>
                        <p className="text-white/80">
                            אם כבר יש לך משלוחים – למה לשלם אחוזים?
                        </p>
                    </div>

                    <Link
                        to="/register-restaurant"
                        className="px-6 py-3 bg-white text-brand-dark rounded-xl font-semibold"
                    >
                        מתחילים עכשיו
                    </Link>
                </section>

            </div>
        </CustomerLayout>
    );
}