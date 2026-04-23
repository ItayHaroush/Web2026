import React from 'react';
import { Helmet } from 'react-helmet-async';

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

const buildRestaurantJsonLd = (restaurant, canonicalUrl, image) => {
    if (!restaurant) return null;

    const address = {
        '@type': 'PostalAddress',
        addressCountry: 'IL',
    };
    if (restaurant.address) address.streetAddress = restaurant.address;
    if (restaurant.city) address.addressLocality = restaurant.city;

    const geo = restaurant.latitude && restaurant.longitude
        ? {
            '@type': 'GeoCoordinates',
            latitude: Number(restaurant.latitude),
            longitude: Number(restaurant.longitude),
        }
        : null;

    const payload = {
        '@context': 'https://schema.org',
        '@type': 'Restaurant',
        '@id': `${canonicalUrl}#restaurant`,
        name: restaurant.name,
        url: canonicalUrl,
        image,
        telephone: restaurant.phone || undefined,
        servesCuisine: restaurant.cuisine_type || undefined,
        priceRange: '₪₪',
        description: buildDescription(restaurant, 'share'),
        address: Object.keys(address).length > 1 ? address : undefined,
        geo: geo || undefined,
        hasMap: geo
            ? `https://www.google.com/maps/search/?api=1&query=${geo.latitude},${geo.longitude}`
            : undefined,
        acceptsReservations: false,
    };

    return JSON.parse(JSON.stringify(payload)); // מסנן undefined
};

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

    const jsonLd = buildRestaurantJsonLd(restaurant, canonicalUrl, image);

    return (
        <Helmet>
            <title>{title}</title>
            <meta name="description" content={description} />
            <meta name="keywords" content={keywords} />
            <meta name="robots" content={robots} />
            <link rel="canonical" href={canonicalUrl} />
            <meta property="og:type" content="restaurant.restaurant" />
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
            {jsonLd && (
                <script type="application/ld+json">
                    {JSON.stringify(jsonLd)}
                </script>
            )}
        </Helmet>
    );
}

/**
 * SEO לעמוד תפריט: /{tenantId}/menu
 *
 * menuSections (optional): [{ name, items: [{ name, description?, price?, image_url? }] }]
 * אם מסופק — יוזרק schema.org Menu מלא.
 */
export function MenuSeo({ restaurant, menuSections = null }) {
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

    const baseJsonLd = buildRestaurantJsonLd(restaurant, canonicalUrl, image) || {};

    if (Array.isArray(menuSections) && menuSections.length > 0) {
        const sections = menuSections.slice(0, 50).map((section) => {
            const items = (section.items || []).slice(0, 30).map((item) => {
                const entry = {
                    '@type': 'MenuItem',
                    name: item.name,
                };
                if (item.description) {
                    entry.description = String(item.description).replace(/<[^>]+>/g, '').slice(0, 300);
                }
                if (item.image_url) {
                    entry.image = item.image_url;
                }
                if (item.price && Number(item.price) > 0) {
                    entry.offers = {
                        '@type': 'Offer',
                        price: String(item.price),
                        priceCurrency: 'ILS',
                    };
                }
                return entry;
            });

            return {
                '@type': 'MenuSection',
                name: section.name,
                hasMenuItem: items,
            };
        }).filter((s) => s.hasMenuItem && s.hasMenuItem.length > 0);

        if (sections.length > 0) {
            baseJsonLd.hasMenu = {
                '@type': 'Menu',
                name: `תפריט ${restaurant.name || ''}`.trim(),
                hasMenuSection: sections,
            };
        }
    }

    return (
        <Helmet>
            <title>{title}</title>
            <meta name="description" content={description} />
            <meta name="keywords" content={keywords} />
            <meta name="robots" content={robots} />
            <link rel="canonical" href={canonicalUrl} />
            <meta property="og:type" content="restaurant.menu" />
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
            <script type="application/ld+json">
                {JSON.stringify(baseJsonLd)}
            </script>
        </Helmet>
    );
}

export default { ShareSeo, MenuSeo };
