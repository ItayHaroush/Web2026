import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CustomerLayout } from '../layouts/CustomerLayout';
import { getAllRestaurants } from '../services/restaurantService';
import api from '../services/apiClient';
import { resolveAssetUrl } from '../utils/assets';
import { RestaurantsListSeo } from '../components/seo/RestaurantSeo';
import { FaMapMarkerAlt, FaUtensils, FaArrowLeft, FaSearch } from 'react-icons/fa';

/**
 * עמוד hub: /restaurants
 * תוכן שלם עבור SEO — כל המסעדות המאושרות, עם אפשרות סינון לפי עיר.
 * Laravel מזריק meta + ItemList JSON-LD בצד-שרת, React מרנדר את הגריד.
 */
export default function RestaurantsListPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const cityParam = searchParams.get('city') || '';
    const [restaurants, setRestaurants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [cityOptions, setCityOptions] = useState([]);

    useEffect(() => {
        let cancelled = false;
        api.get('/cities')
            .then((res) => {
                const rows = res.data?.data || res.data?.cities || [];
                if (!cancelled && Array.isArray(rows)) setCityOptions(rows);
            })
            .catch(() => { if (!cancelled) setCityOptions([]); });
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        getAllRestaurants(cityParam || null)
            .then((res) => {
                if (cancelled) return;
                const data = (res?.data || []).filter(r => r && r.is_approved !== false);
                setRestaurants(data);
                setLoading(false);
            })
            .catch((err) => {
                if (cancelled) return;
                console.error('Error loading restaurants:', err);
                setError('שגיאה בטעינת המסעדות');
                setLoading(false);
            });
        return () => { cancelled = true; };
    }, [cityParam]);

    const cities = useMemo(() => {
        if (cityOptions.length > 0) {
            return [...cityOptions].sort((a, b) => (a.list_order ?? 100) - (b.list_order ?? 100) || (a.hebrew_name || a.name).localeCompare(b.hebrew_name || b.name, 'he'));
        }
        const set = new Set(restaurants.map(r => r.city).filter(Boolean));
        return [...set].sort();
    }, [restaurants, cityOptions]);

    const filtered = useMemo(() => {
        if (!searchTerm.trim()) return restaurants;
        const q = searchTerm.trim().toLowerCase();
        return restaurants.filter(r =>
            (r.name || '').toLowerCase().includes(q)
            || (r.cuisine_type || '').toLowerCase().includes(q)
            || (r.city || '').toLowerCase().includes(q)
        );
    }, [restaurants, searchTerm]);

    const cityParamHe = useMemo(() => {
        if (!cityParam) return '';
        const m = cityOptions.find(c => c.name === cityParam || c.hebrew_name === cityParam);
        return m?.hebrew_name || cityParam;
    }, [cityParam, cityOptions]);

    const pageTitle = cityParam
        ? `מסעדות ב${cityParamHe || cityParam}`
        : 'כל המסעדות ב-TakeEat';

    const intro = cityParam
        ? `גלו את כל המסעדות ב${cityParamHe || cityParam} שזמינות להזמנת אוכל אונליין דרך TakeEat. משלוח מהיר, איסוף עצמי, תפריט דיגיטלי מלא ותשלום מאובטח — ישירות מהמסעדה, בלי עמלות מוגזמות.`
        : 'רשימת כל המסעדות בישראל שזמינות להזמנת אוכל אונליין דרך TakeEat. מגוון מטבחים, ערים וסגנונות — מזרחי, איטלקי, אסייתי, המבורגרים, פלאפל, פסטה ועוד. הזמינו ישירות מהמסעדה במחיר המקורי שלה.';

    return (
        <CustomerLayout>
            <RestaurantsListSeo city={cityParamHe || cityParam || null} />

            <div className="py-6">
                {/* Breadcrumb */}
                <nav aria-label="Breadcrumb" className="mb-4 text-sm text-gray-500 dark:text-brand-dark-muted">
                    <Link to="/" className="hover:text-brand-primary">דף הבית</Link>
                    <span className="mx-2">/</span>
                    <Link to="/restaurants" className="hover:text-brand-primary">מסעדות</Link>
                    {cityParam && (
                        <>
                            <span className="mx-2">/</span>
                            <span aria-current="page">{cityParamHe || cityParam}</span>
                        </>
                    )}
                </nav>

                <header className="mb-8">
                    <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-3">
                        {pageTitle}
                    </h1>
                    <p className="text-base sm:text-lg text-gray-600 dark:text-brand-dark-muted max-w-3xl leading-relaxed">
                        {intro}
                    </p>
                </header>

                {/* חיפוש + סינון עיר */}
                <div className="bg-white dark:bg-brand-dark-surface rounded-2xl shadow-sm border border-gray-100 dark:border-brand-dark-border p-4 sm:p-6 mb-8">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <FaSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="search"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="חיפוש לפי שם מסעדה, מטבח או עיר…"
                                className="w-full pr-10 pl-4 py-3 rounded-xl border border-gray-200 dark:border-brand-dark-border bg-white dark:bg-brand-dark-bg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
                            />
                        </div>
                        <select
                            value={cityParam}
                            onChange={e => {
                                const v = e.target.value;
                                const next = new URLSearchParams(searchParams);
                                if (v) next.set('city', v); else next.delete('city');
                                setSearchParams(next);
                            }}
                            className="sm:w-60 px-4 py-3 rounded-xl border border-gray-200 dark:border-brand-dark-border bg-white dark:bg-brand-dark-bg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
                        >
                            <option value="">כל הערים</option>
                            {cities.map((c) => {
                                if (typeof c === 'string') {
                                    return <option key={c} value={c}>{c}</option>;
                                }
                                return <option key={c.name} value={c.name}>{c.hebrew_name || c.name}</option>;
                            })}
                        </select>
                    </div>
                </div>

                {loading && (
                    <div className="flex items-center justify-center py-16">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary" />
                    </div>
                )}

                {error && (
                    <div className="text-center py-16 text-red-600">{error}</div>
                )}

                {!loading && !error && filtered.length === 0 && (
                    <div className="text-center py-16">
                        <p className="text-gray-600 dark:text-brand-dark-muted mb-4">לא נמצאו מסעדות תואמות.</p>
                        {cityParam && (
                            <Link
                                to="/restaurants"
                                className="inline-flex items-center gap-2 text-brand-primary hover:underline"
                            >
                                <FaArrowLeft />
                                חזרה לכל המסעדות
                            </Link>
                        )}
                    </div>
                )}

                {!loading && !error && filtered.length > 0 && (
                    <>
                        <p className="text-sm text-gray-500 dark:text-brand-dark-muted mb-4">
                            נמצאו {filtered.length} מסעדות
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            {filtered.map(r => (
                                <RestaurantCard key={r.id} restaurant={r} />
                            ))}
                        </div>
                    </>
                )}

                {/* קישורים פנימיים לעמודים נוספים */}
                <section className="mt-16 pt-10 border-t border-gray-100 dark:border-brand-dark-border">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                        מעוניינים בעוד?
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Link to="/restaurants/new" className="block p-5 rounded-xl border border-gray-100 dark:border-brand-dark-border hover:border-brand-primary transition-colors">
                            <h3 className="font-semibold mb-1">מסעדות חדשות</h3>
                            <p className="text-sm text-gray-500 dark:text-brand-dark-muted">המסעדות שהצטרפו לאחרונה</p>
                        </Link>
                        <Link to="/about" className="block p-5 rounded-xl border border-gray-100 dark:border-brand-dark-border hover:border-brand-primary transition-colors">
                            <h3 className="font-semibold mb-1">איך זה עובד?</h3>
                            <p className="text-sm text-gray-500 dark:text-brand-dark-muted">מה זה TakeEat ולמה לבחור בנו</p>
                        </Link>
                        <Link to="/register-restaurant" className="block p-5 rounded-xl border border-gray-100 dark:border-brand-dark-border hover:border-brand-primary transition-colors">
                            <h3 className="font-semibold mb-1">רוצה להצטרף?</h3>
                            <p className="text-sm text-gray-500 dark:text-brand-dark-muted">הרשמת מסעדה ל-TakeEat</p>
                        </Link>
                    </div>
                </section>
            </div>
        </CustomerLayout>
    );
}

function RestaurantCard({ restaurant }) {
    const slug = restaurant.slug || restaurant.tenant_id;
    const href = `/r/${slug}`;
    const logo = resolveAssetUrl(restaurant.logo_url);

    return (
        <Link
            to={href}
            className="group block bg-white dark:bg-brand-dark-surface rounded-2xl shadow-sm hover:shadow-lg transition-all border border-gray-100 dark:border-brand-dark-border overflow-hidden"
        >
            <div className="aspect-[16/10] bg-gray-100 dark:bg-brand-dark-bg flex items-center justify-center overflow-hidden">
                {logo ? (
                    <img
                        src={logo}
                        alt={restaurant.name}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                ) : (
                    <FaUtensils className="text-5xl text-gray-300" />
                )}
            </div>
            <div className="p-4">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-1 line-clamp-1">
                    {restaurant.name}
                </h3>
                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-brand-dark-muted">
                    {restaurant.cuisine_type && (
                        <span className="inline-flex items-center gap-1">
                            <FaUtensils className="text-xs" />
                            {restaurant.cuisine_type}
                        </span>
                    )}
                    {restaurant.city && (
                        <span className="inline-flex items-center gap-1">
                            <FaMapMarkerAlt className="text-xs" />
                            {restaurant.city}
                        </span>
                    )}
                </div>
                {restaurant.description && (
                    <p className="mt-3 text-sm text-gray-600 dark:text-brand-dark-muted line-clamp-2">
                        {restaurant.description}
                    </p>
                )}
            </div>
        </Link>
    );
}
