import React from 'react';
import { Link } from 'react-router-dom';
import { CustomerLayout } from '../layouts/CustomerLayout';
import woltLogo from '../images/woltLogo.png';
import tenBisLogo from '../images/tenBisLogo.png';
import mishlohaLogo from '../images/mishlohaLogo.jpeg';
import ChefSync from "../images/ChefSyncLogoIcon.png";
/**
 * דף נחיתה שיווקי – ChefSync IL
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
                            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-sm px-3 py-1 rounded-full">
                                <span>🚚</span>
                                <span>כמו וולט / תן ביס / משלוחה – בלי אחוזים</span>
                            </div>

                            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight">
                                ChefSync IL – המסעדה שלך אונליין
                            </h1>

                            <p className="text-white/90 text-lg max-w-2xl">
                                פלטפורמת הזמנות מלאה למסעדות:
                                הלקוח מזמין מהספה, המערכת מרכזת הכול,
                                והמסעדה מספקת עד הדלת – במנוי חודשי קבוע.
                            </p>

                            <div className="flex flex-wrap gap-4">
                                <Link
                                    to="/register-restaurant"
                                    className="px-6 py-3 bg-white text-brand-dark font-semibold rounded-xl shadow hover:shadow-xl transition"
                                >
                                    פותחים מסעדה אונליין
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
                                <img src={ChefSync} alt="ChefSync IL" className="h-6" />
                                <span className="text-xl font-bold text-brand-primary">ChefSync IL</span>
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