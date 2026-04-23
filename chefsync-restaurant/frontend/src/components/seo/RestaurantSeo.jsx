import React from 'react';

/**
 * קומפוננטי SEO לצד-לקוח.
 *
 * הערות:
 * 1. ה-SEO הקריטי (meta tags + JSON-LD) מוזרק בצד-השרת על ידי Laravel
 *    דרך SeoController/SeoRenderer עבור /r/{slug} ו-/{tenantId}/menu.
 *    זה מה שגוגל ומדיות חברתיות רואים בעת סריקה ראשונה.
 * 2. React 19 מרים אוטומטית <title>, <meta>, <link> שמוזרקים בתוך
 *    רכיבי JSX אל <head> — ללא צורך ב-react-helmet-async.
 * 3. הקומפוננטים האלה מעדכנים את ה-<head> בעת ניווט SPA פנימי,
 *    כך שאם המשתמש משתף דף אחרי ניווט — הטאגים יהיו עדכניים.
 */

const FRONTEND_URL = 'https://www.takeeat.co.il';
const DEFAULT_LOGO = `${FRONTEND_URL}/icons/chefsync-logo-v2-512.png`;

const truncate = (text, max) => {
    if (!text) return '';
    const cleaned = String(text).replace(/\s+/g, ' ').trim();
    if (cleaned.length <= max) return cleaned;
    return cleaned.slice(0, max - 1).trimEnd() + '…';
};

const resolveLogo = (logoUrl) => {
    if (!logoUrl) return DEFAULT_LOGO;
    if (typeof logoUrl === 'string' && /^https?:\/\//i.test(logoUrl)) return logoUrl;
    return `${FRONTEND_URL}/${String(logoUrl).replace(/^\//, '')}`;
};

const buildDescription = (restaurant, context) => {
    if (!restaurant) return '';
    const base = (restaurant.description && restaurant.description.trim())
        || (context === 'menu'
            ? `התפריט המלא של ${restaurant.name || 'המסעדה'}`
            : `${restaurant.name || 'מסעדה'} — הזמינו אונליין ובקלות`);

    const parts = [base];
    if (restaurant.cuisine_type) parts.push(`מטבח ${restaurant.cuisine_type}`);
    if (restaurant.city) parts.push(restaurant.city);
    parts.push('הזמנה אונליין, משלוח ואיסוף עצמי דרך TakeEat');
    return truncate(parts.filter(Boolean).join(' · '), 158);
};

const buildKeywords = (restaurant) => {
    if (!restaurant) return '';
    const kw = [
        restaurant.name,
        restaurant.cuisine_type,
        restaurant.city,
        'הזמנה אונליין',
        'משלוח אוכל',
        'תפריט',
        'TakeEat',
    ].filter(Boolean);
    return Array.from(new Set(kw)).join(', ');
};

function MetaTags({ title, description, keywords, robots, canonicalUrl, ogType, image }) {
    return (
        <>
            <title>{title}</title>
            <meta name="description" content={description} />
            <meta name="keywords" content={keywords} />
            <meta name="robots" content={robots} />
            <link rel="canonical" href={canonicalUrl} />
            <meta property="og:type" content={ogType} />
            <meta property="og:site_name" content="TakeEat" />
            <meta property="og:title" content={title} />
            <meta property="og:description" content={description} />
            <meta property="og:url" content={canonicalUrl} />
            <meta property="og:locale" content="he_IL" />
            <meta property="og:image" content={image} />
            <meta property="og:image:secure_url" content={image} />
            <meta property="og:image:type" content="image/png" />
            <meta property="og:image:width" content="512" />
            <meta property="og:image:height" content="512" />
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={title} />
            <meta name="twitter:description" content={description} />
            <meta name="twitter:image" content={image} />
        </>
    );
}

/**
 * SEO לדף שיתוף מסעדה: /r/{slug}
 */
export function ShareSeo({ restaurant }) {
    if (!restaurant) return null;

    const slug = restaurant.slug || restaurant.tenant_id;
    if (!slug) return null;

    const canonicalUrl = `${FRONTEND_URL}/r/${encodeURIComponent(slug)}`;
    const title = truncate(`${restaurant.name || ''} — הזמינו אונליין | TakeEat`, 65);
    const description = buildDescription(restaurant, 'share');
    const image = resolveLogo(restaurant.logo_url);
    const keywords = buildKeywords(restaurant);
    const robots = restaurant.is_approved && !restaurant.is_demo
        ? 'index, follow'
        : 'noindex, nofollow';

    return (
        <MetaTags
            title={title}
            description={description}
            keywords={keywords}
            robots={robots}
            canonicalUrl={canonicalUrl}
            ogType="restaurant.restaurant"
            image={image}
        />
    );
}

/**
 * SEO לעמוד תפריט: /{tenantId}/menu
 *
 * menuSections כרגע לא בשימוש בצד-לקוח — ה-JSON-LD של ה-Menu
 * מוזרק על ידי Laravel בשרת, וזה מה שגוגל קורא. נשאר בחתימה
 * לצורך תאימות עם קריאות קיימות.
 */
export function MenuSeo({ restaurant, menuSections = null }) { // eslint-disable-line no-unused-vars
    if (!restaurant) return null;

    const tenantId = restaurant.tenant_id;
    if (!tenantId) return null;

    const canonicalUrl = `${FRONTEND_URL}/${encodeURIComponent(tenantId)}/menu`;
    const title = truncate(`תפריט ${restaurant.name || ''} | TakeEat`, 65);
    const description = buildDescription(restaurant, 'menu');
    const image = resolveLogo(restaurant.logo_url);
    const keywords = buildKeywords(restaurant);
    const robots = restaurant.is_approved && !restaurant.is_demo
        ? 'index, follow'
        : 'noindex, nofollow';

    return (
        <MetaTags
            title={title}
            description={description}
            keywords={keywords}
            robots={robots}
            canonicalUrl={canonicalUrl}
            ogType="restaurant.menu"
            image={image}
        />
    );
}

export default { ShareSeo, MenuSeo };
