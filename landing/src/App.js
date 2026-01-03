import React from 'react';
import './App.css';

/**
 * דף נחיתה שיווקי – גרסת סטנדאלון ללא תלות ב־router או tailwind
 */
export default function App() {
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
    <div className="page" dir="rtl">
      <header className="hero">
        <div className="hero__text">
          <div className="pill">כמו וולט / תן ביס / משלוחה – בלי אחוזים</div>
          <h1>ChefSync IL – המסעדה שלך אונליין</h1>
          <p>
            פלטפורמת הזמנות מלאה למסעדות: הלקוח מזמין מהספה, המערכת מרכזת הכול,
            והמסעדה מספקת עד הדלת – במנוי חודשי קבוע.
          </p>
          <div className="hero__actions">
            <a className="btn btn--solid" href="#plans">פותחים מסעדה אונליין</a>
            <a className="btn btn--ghost" href="#comparison">השוואה לפלטפורמות</a>
          </div>
          <div className="hero__tags">
            <span>💳 מנוי חודשי / שנתי</span>
            <span>❌ בלי אחוזים</span>
            <span>🛡️ שליטה מלאה</span>
          </div>
        </div>

        <div className="hero__card">
          <h3>מהזמנה – עד משלוח</h3>
          <p>תפריט, סל קניות, הזמנה, סטטוס ומשלוח – הכול מרוכז בפאנל אחד למטבח.</p>
          <div className="hero__grid">
            <div className="stat">
              <p className="stat__label">עלות חודשית</p>
              <p className="stat__value">₪600</p>
            </div>
            <div className="stat stat--dark">
              <p className="stat__label">ללא עמלות</p>
              <p className="stat__value">100% למסעדה</p>
            </div>
          </div>
        </div>
      </header>

      <main className="content">
        <section className="section">
          <div className="section__title">אותה פלטפורמה – מודל אחר</div>
          <div className="grid">
            {benefits.map(item => (
              <article key={item.title} className="card">
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section" id="comparison">
          <div className="section__title">השוואה לפלטפורמות משלוחים</div>
          <div className="grid grid--two">
            <article className="card">
              <h4>פלטפורמות משלוחים</h4>
              <div className="logo-row">
                <img src="/images/woltLogo.png" alt="Wolt" />
                <img src="/images/tenBisLogo.png" alt="10bis" />
                <img src="/images/mishlohaLogo.jpeg" alt="Mishloha" />
              </div>

              <ul>
                <li>✔ פלטפורמת הזמנות מלאה</li>
                <li>✔ חוויית לקוח מעולה</li>
                <li>❌ אחוזים מכל הזמנה</li>
                <li>❌ הלקוח שייך לפלטפורמה</li>
              </ul>
            </article>

            <article className="card card--accent">
              <h4>ChefSync IL</h4>
              <div className="logo-row" >
                <img src="/images/chefSyncLogoIcon.png" alt="ChefSync IL" />
              </div>
              <ul>
                <li>✔ אותה חוויית הזמנה</li>
                <li>✔ משלוחים וסטטוס</li>
                <li>✔ מנוי חודשי קבוע</li>
                <li>✔ הלקוחות שייכים למסעדה</li>
              </ul>
            </article>
          </div>
        </section>

        <section className="section">
          <div className="section__title">מהספה של הלקוח – עד לדלת</div>
          <div className="grid grid--three">
            {steps.map(step => (
              <article key={step.label} className="card card--muted">
                <p className="step__label">{step.label}</p>
                <p>{step.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section" id="plans">
          <div className="section__title">תמחור פשוט. בלי הפתעות.</div>
          <div className="grid grid--two">
            {plans.map(plan => (
              <article key={plan.name} className="card plan">
                <div className="plan__badge">{plan.badge}</div>
                <h3>{plan.name}</h3>
                <p className="plan__period">{plan.period}</p>
                <p className="plan__price">{plan.price}</p>
                <ul className="plan__features">
                  {plan.features.map(feature => (
                    <li key={feature}>• {feature}</li>
                  ))}
                </ul>
                <a className="btn btn--solid" href="#register">פותחים מסעדה אונליין</a>
              </article>
            ))}
          </div>
        </section>

        <section className="cta" id="register">
          <div>
            <h3>אותה חוויה ללקוח – פחות הוצאות למסעדה</h3>
            <p>אם כבר יש לך משלוחים – למה לשלם אחוזים?</p>
          </div>
          <a className="btn btn--light" href="#plans">מתחילים עכשיו</a>
        </section>
      </main>
    </div>
  );
}