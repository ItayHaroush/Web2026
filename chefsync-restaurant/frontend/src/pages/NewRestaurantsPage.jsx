import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CustomerLayout } from '../layouts/CustomerLayout';
import { getAllRestaurants } from '../services/restaurantService';
import { resolveAssetUrl } from '../utils/assets';
import { NewRestaurantsSeo } from '../components/seo/RestaurantSeo';
import { FaMapMarkerAlt, FaUtensils, FaClock, FaStar } from 'react-icons/fa';

const DAYS_WINDOW = 30;

/**
 * עמוד hub: /restaurants/new
 * מציג את המסעדות שהצטרפו ל-TakeEat ב-30 הימים האחרונים.
 */
export default function NewRestaurantsPage() {
    const [restaurants, setRestaurants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        getAllRestaurants()
            .then((res) => {
                if (cancelled) return;
                const all = (res?.data || []).filter(r => r && r.is_approved !== false);
                const since = Date.now() - DAYS_WINDOW * 24 * 60 * 60 * 1000;
                const recent = all.filter(r => {
                    if (!r.created_at) return false;
                    return new Date(r.created_at).getTime() >= since;
                });
                recent.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                setRestaurants(recent);
                setLoading(false);
            })
            .catch((err) => {
                if (cancelled) return;
                console.error(err);
                setError('שגיאה בטעינת המסעדות');
                setLoading(false);
            });
        return () => { cancelled = true; };
    }, []);

    const formatDate = useMemo(() => (d) => {
        try {
            return new Date(d).toLocaleDateString('he-IL', {
                day: 'numeric', month: 'long', year: 'numeric',
            });
        } catch { return ''; }
    }, []);

    return (
        <CustomerLayout>
            <NewRestaurantsSeo />

            <div className="py-6">
                <nav aria-label="Breadcrumb" className="mb-4 text-sm text-gray-500 dark:text-brand-dark-muted">
                    <Link to="/" className="hover:text-brand-primary">דף הבית</Link>
                    <span className="mx-2">/</span>
                    <Link to="/restaurants" className="hover:text-brand-primary">מסעדות</Link>
                    <span className="mx-2">/</span>
                    <span aria-current="page">חדשות</span>
                </nav>

                <header className="mb-8">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold mb-3">
                        <FaStar className="text-amber-500" />
                        חדש
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-3">
                        מסעדות חדשות ב-TakeEat
                    </h1>
                    <p className="text-base sm:text-lg text-gray-600 dark:text-brand-dark-muted max-w-3xl leading-relaxed">
                        המסעדות שהצטרפו ל-TakeEat ב-{DAYS_WINDOW} הימים האחרונים. גלו מקומות חדשים ומטבחים מגוונים,
                        והזמינו אוכל ישירות מהמסעדה — משלוח מהיר או איסוף עצמי, בלי עמלות מוגזמות.
                    </p>
                </header>

                {loading && (
                    <div className="flex items-center justify-center py-16">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary" />
                    </div>
                )}

                {error && (
                    <div className="text-center py-16 text-red-600">{error}</div>
                )}

                {!loading && !error && restaurants.length === 0 && (
                    <div className="text-center py-16">
                        <p className="text-gray-600 dark:text-brand-dark-muted mb-4">
                            אין מסעדות חדשות שהצטרפו ב-{DAYS_WINDOW} הימים האחרונים.
                        </p>
                        <Link to="/restaurants" className="inline-block px-5 py-2.5 rounded-xl bg-brand-primary text-white hover:opacity-90">
                            לכל המסעדות
                        </Link>
                    </div>
                )}

                {!loading && !error && restaurants.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {restaurants.map(r => {
                            const slug = r.slug || r.tenant_id;
                            const logo = resolveAssetUrl(r.logo_url);
                            return (
                                <Link
                                    key={r.id}
                                    to={`/r/${slug}`}
                                    className="group block bg-white dark:bg-brand-dark-surface rounded-2xl shadow-sm hover:shadow-lg transition-all border border-gray-100 dark:border-brand-dark-border overflow-hidden relative"
                                >
                                    <div className="absolute top-3 right-3 z-10 px-2 py-1 rounded-full bg-amber-500 text-white text-[10px] font-bold shadow">
                                        חדש
                                    </div>
                                    <div className="aspect-[16/10] bg-gray-100 dark:bg-brand-dark-bg flex items-center justify-center overflow-hidden">
                                        {logo ? (
                                            <img
                                                src={logo}
                                                alt={r.name}
                                                loading="lazy"
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                            />
                                        ) : (
                                            <FaUtensils className="text-5xl text-gray-300" />
                                        )}
                                    </div>
                                    <div className="p-4">
                                        <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-1 line-clamp-1">
                                            {r.name}
                                        </h3>
                                        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-brand-dark-muted mb-2">
                                            {r.cuisine_type && (
                                                <span className="inline-flex items-center gap-1">
                                                    <FaUtensils className="text-xs" />
                                                    {r.cuisine_type}
                                                </span>
                                            )}
                                            {r.city && (
                                                <span className="inline-flex items-center gap-1">
                                                    <FaMapMarkerAlt className="text-xs" />
                                                    {r.city}
                                                </span>
                                            )}
                                        </div>
                                        {r.created_at && (
                                            <p className="text-xs text-gray-400 inline-flex items-center gap-1">
                                                <FaClock />
                                                הצטרפה ב-{formatDate(r.created_at)}
                                            </p>
                                        )}
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}

                <section className="mt-16 pt-10 border-t border-gray-100 dark:border-brand-dark-border">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">דפים נוספים</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Link to="/restaurants" className="block p-5 rounded-xl border border-gray-100 dark:border-brand-dark-border hover:border-brand-primary">
                            <h3 className="font-semibold mb-1">כל המסעדות</h3>
                            <p className="text-sm text-gray-500 dark:text-brand-dark-muted">רשימת כל המסעדות ב-TakeEat</p>
                        </Link>
                        <Link to="/about" className="block p-5 rounded-xl border border-gray-100 dark:border-brand-dark-border hover:border-brand-primary">
                            <h3 className="font-semibold mb-1">איך זה עובד?</h3>
                            <p className="text-sm text-gray-500 dark:text-brand-dark-muted">מה זה TakeEat ולמה לבחור בנו</p>
                        </Link>
                        <Link to="/register-restaurant" className="block p-5 rounded-xl border border-gray-100 dark:border-brand-dark-border hover:border-brand-primary">
                            <h3 className="font-semibold mb-1">רוצה להצטרף?</h3>
                            <p className="text-sm text-gray-500 dark:text-brand-dark-muted">הרשמת מסעדה ל-TakeEat</p>
                        </Link>
                    </div>
                </section>
            </div>
        </CustomerLayout>
    );
}
