import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import api from '../services/apiClient';
import {
    FaArrowRight,
    FaCheck,
    FaCheckCircle,
    FaExclamationTriangle,
    FaForward,
    FaLayerGroup,
    FaRegCircle,
    FaStore,
    FaUtensils,
} from 'react-icons/fa';

const REGISTRATION_DRAFT_KEY = 'chefsync_registration_draft';
export const WOLT_SELECTION_KEY = 'chefsync_wolt_import_selection';

/** מפתח ייחודי לפריט בתוך התצוגה (אינדקס קטגוריה + אינדקס פריט) */
const itemKey = (categoryIndex, itemIndex) => `${categoryIndex}:${itemIndex}`;

/**
 * דף בחירת מוצרים לייבוא מוולט — מעוצב בסגנון תפריט המערכת (MenuPage).
 * נטען מתוך תהליך ההרשמה: המשתמש בוחר אילו מוצרים לייבא (או מדלג ומייבא הכל),
 * והבחירה נשמרת ונשלחת כבקשת ייבוא לאישור הסופר-אדמין.
 */
export default function WoltImportPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const urlFromQuery = searchParams.get('url') || '';
    const [woltUrl, setWoltUrl] = useState(urlFromQuery);
    const [urlInput, setUrlInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [preview, setPreview] = useState(null);
    const [selected, setSelected] = useState(() => new Set());
    const [activeCategory, setActiveCategory] = useState(0);

    const categoryRefs = useRef({});
    const tabRefs = useRef({});

    // שם המסעדה מטיוטת ההרשמה (אם קיימת) — לתצוגת ההירו
    const restaurantName = useMemo(() => {
        try {
            const draft = JSON.parse(localStorage.getItem(REGISTRATION_DRAFT_KEY) || 'null');
            return draft?.form?.name?.trim() || '';
        } catch {
            return '';
        }
    }, []);

    // אם אין URL בפרמטרים — ננסה מטיוטת ההרשמה
    useEffect(() => {
        if (urlFromQuery) return;
        try {
            const draft = JSON.parse(localStorage.getItem(REGISTRATION_DRAFT_KEY) || 'null');
            const draftUrl = draft?.form?.wolt_url?.trim();
            if (draftUrl) setWoltUrl(draftUrl);
        } catch {
            // אין טיוטה — המשתמש יזין לינק ידנית
        }
    }, [urlFromQuery]);

    const loadPreview = useCallback(async (url) => {
        const value = String(url || '').trim();
        if (!value) return;

        setLoading(true);
        setError(null);
        setPreview(null);
        try {
            const res = await api.post('/wolt-import/preview', { wolt_url: value });
            if (res.data?.success) {
                const data = res.data.data;
                setPreview(data);
                // ברירת מחדל: כל הפריטים נבחרים
                const all = new Set();
                (data.categories || []).forEach((cat, ci) => {
                    (cat.items || []).forEach((_, ii) => all.add(itemKey(ci, ii)));
                });
                setSelected(all);
                setActiveCategory(0);
            } else {
                setError(res.data?.message || 'שגיאה בטעינת התפריט מוולט');
            }
        } catch (err) {
            console.error('Wolt preview failed', err);
            setError(err.response?.data?.message || 'לא הצלחנו לטעון את התפריט מוולט. בדקו את הקישור ונסו שוב.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (woltUrl) loadPreview(woltUrl);
    }, [woltUrl, loadPreview]);

    // scroll-spy — סימון הקטגוריה הפעילה לפי גלילה (כמו בתפריט המערכת)
    useEffect(() => {
        if (!preview) return undefined;

        const onScroll = () => {
            const entries = Object.entries(categoryRefs.current);
            let current = 0;
            for (const [index, el] of entries) {
                if (!el) continue;
                if (el.getBoundingClientRect().top <= 140) {
                    current = Number(index);
                }
            }
            setActiveCategory(current);
        };

        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, [preview]);

    // גלילת הטאב הפעיל למרכז בר הקטגוריות — אופקית בלבד (scrollIntoView מגליל גם את העמוד ונלחם בגלילת המשתמש)
    useEffect(() => {
        const tab = tabRefs.current[activeCategory];
        const container = tab?.parentElement;
        if (tab && container) {
            const scrollLeft = tab.offsetLeft - container.offsetWidth / 2 + tab.offsetWidth / 2;
            container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
        }
    }, [activeCategory]);

    const scrollToCategory = (index) => {
        setActiveCategory(index);
        const el = categoryRefs.current[index];
        if (el) {
            const top = el.getBoundingClientRect().top + window.scrollY - 120;
            window.scrollTo({ top, behavior: 'smooth' });
        }
    };

    const totalItems = useMemo(
        () => (preview?.categories || []).reduce((sum, cat) => sum + (cat.items?.length || 0), 0),
        [preview]
    );

    const toggleItem = (categoryIndex, index) => {
        const key = itemKey(categoryIndex, index);
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const categorySelectedCount = (categoryIndex) => {
        const items = preview?.categories?.[categoryIndex]?.items || [];
        let count = 0;
        items.forEach((_, ii) => {
            if (selected.has(itemKey(categoryIndex, ii))) count++;
        });
        return count;
    };

    const toggleCategory = (categoryIndex) => {
        const items = preview?.categories?.[categoryIndex]?.items || [];
        const allSelected = categorySelectedCount(categoryIndex) === items.length && items.length > 0;
        setSelected((prev) => {
            const next = new Set(prev);
            items.forEach((_, ii) => {
                const key = itemKey(categoryIndex, ii);
                if (allSelected) next.delete(key);
                else next.add(key);
            });
            return next;
        });
    };

    const buildSelectionPayload = (mode) => {
        const categories = (preview?.categories || [])
            .map((cat, ci) => ({
                name: cat.name,
                items: (cat.items || []).filter((_, ii) => mode === 'all' || selected.has(itemKey(ci, ii))),
            }))
            .filter((cat) => cat.items.length > 0);

        const itemsCount = categories.reduce((sum, cat) => sum + cat.items.length, 0);

        return {
            wolt_url: woltUrl.trim(),
            slug: preview?.slug || null,
            mode,
            summary: {
                categories_count: categories.length,
                items_count: itemsCount,
                source_categories_count: preview?.categories?.length || 0,
                source_items_count: totalItems,
            },
            categories,
            restaurant_meta: preview?.restaurant_meta || {},
            saved_at: Date.now(),
        };
    };

    const finishWithSelection = (mode) => {
        if (mode === 'selected' && selected.size === 0) {
            toast.error('לא נבחרו מוצרים. אפשר לבחור מוצרים או לדלג ולייבא הכל.');
            return;
        }

        const payload = buildSelectionPayload(mode);
        try {
            localStorage.setItem(WOLT_SELECTION_KEY, JSON.stringify(payload));
        } catch (err) {
            console.error('Failed to persist wolt selection', err);
            toast.error('שגיאה בשמירת הבחירה, נסו שוב');
            return;
        }

        // עדכון טיוטת ההרשמה: סימון מסלול ייבוא, סנכרון הלינק ומעבר ישיר לשלב פרטי המסעדה
        try {
            const draft = JSON.parse(localStorage.getItem(REGISTRATION_DRAFT_KEY) || '{}') || {};
            draft.importChoice = 'wolt';
            draft.currentStep = 3;
            draft.form = { ...(draft.form || {}), wolt_url: payload.wolt_url };
            localStorage.setItem(REGISTRATION_DRAFT_KEY, JSON.stringify(draft));
        } catch (err) {
            console.error('Failed to update registration draft', err);
        }

        toast.success(
            mode === 'all'
                ? `כל התפריט (${payload.summary.items_count} מוצרים) נבחר לייבוא`
                : `נבחרו ${payload.summary.items_count} מוצרים לייבוא`
        );
        navigate('/register-restaurant');
    };

    const heroImage = preview?.restaurant_meta?.hero_image_url || null;
    const heroTitle = restaurantName || preview?.slug || 'תפריט מוולט';

    return (
        <div dir="rtl" className="min-h-screen bg-gray-50 dark:bg-brand-dark-bg">
            {/* Hero — בסגנון תפריט המערכת */}
            <div className="relative mb-6">
                <div
                    className={`relative overflow-hidden ${heroImage
                        ? 'min-h-[15rem] sm:h-80'
                        : 'min-h-[12rem] sm:h-60 bg-gradient-to-br from-brand-dark via-brand-primary to-brand-secondary'
                        }`}
                >
                    {heroImage && (
                        <>
                            <div
                                className="absolute inset-0 bg-cover bg-center"
                                style={{ backgroundImage: `url(${heroImage})` }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/10" aria-hidden />
                        </>
                    )}

                    {/* כפתור חזרה להרשמה */}
                    <button
                        type="button"
                        onClick={() => navigate('/register-restaurant')}
                        className="absolute top-4 right-4 z-20 inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-xs font-black text-gray-800 shadow-lg backdrop-blur-sm transition hover:bg-white"
                    >
                        <FaArrowRight aria-hidden />
                        חזרה להרשמה
                    </button>

                    <div className="relative z-10 flex min-h-[12rem] flex-col items-center justify-center px-4 py-10 text-center text-white sm:absolute sm:inset-0 sm:min-h-0">
                        <span className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-1.5 text-xs font-black backdrop-blur-sm sm:text-sm">
                            <FaStore aria-hidden />
                            ייבוא תפריט מוולט
                        </span>
                        <h1 className="mb-2 px-1 text-2xl font-black drop-shadow-lg sm:text-4xl">{heroTitle}</h1>
                        <p className="max-w-md text-xs font-bold text-white/85 sm:text-sm">
                            בחרו אילו מוצרים לייבא לתפריט שלכם — או דלגו וייבאו את כל התפריט
                        </p>
                    </div>
                </div>

                {/* כרטיס מידע צף */}
                {preview && (
                    <div className="mx-4 sm:mx-auto sm:max-w-3xl -mt-6 relative z-10">
                        <div className="bg-white dark:bg-brand-dark-surface rounded-2xl shadow-xl border border-gray-100/90 dark:border-brand-dark-border px-4 py-3.5">
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="flex flex-col items-center justify-center gap-0.5 rounded-xl bg-gray-50 dark:bg-brand-dark-bg px-2 py-2">
                                    <span className="text-lg font-black text-brand-dark dark:text-brand-dark-text">{preview.categories?.length || 0}</span>
                                    <span className="text-[11px] font-bold text-gray-500 dark:text-brand-dark-muted">קטגוריות</span>
                                </div>
                                <div className="flex flex-col items-center justify-center gap-0.5 rounded-xl bg-gray-50 dark:bg-brand-dark-bg px-2 py-2">
                                    <span className="text-lg font-black text-brand-dark dark:text-brand-dark-text">{totalItems}</span>
                                    <span className="text-[11px] font-bold text-gray-500 dark:text-brand-dark-muted">מוצרים בתפריט</span>
                                </div>
                                <div className="flex flex-col items-center justify-center gap-0.5 rounded-xl bg-orange-50 dark:bg-orange-900/20 px-2 py-2">
                                    <span className="text-lg font-black text-brand-primary">{selected.size}</span>
                                    <span className="text-[11px] font-bold text-orange-700 dark:text-orange-300">נבחרו לייבוא</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pb-36">
                {/* מצב ללא לינק — הזנה ידנית */}
                {!woltUrl && !loading && (
                    <div className="mx-auto mt-10 max-w-lg rounded-2xl bg-white dark:bg-brand-dark-surface p-8 text-center shadow-sm border border-gray-100 dark:border-brand-dark-border">
                        <FaUtensils className="mx-auto mb-4 text-4xl text-brand-primary/40" aria-hidden />
                        <h2 className="mb-2 text-lg font-black text-brand-dark dark:text-brand-dark-text">הדביקו קישור מסעדה מוולט</h2>
                        <p className="mb-4 text-sm text-gray-500 dark:text-brand-dark-muted">נטען את התפריט ותוכלו לבחור אילו מוצרים לייבא</p>
                        <input
                            type="url"
                            dir="ltr"
                            value={urlInput}
                            onChange={(e) => setUrlInput(e.target.value)}
                            placeholder="https://wolt.com/he/isr/.../restaurant/..."
                            className="mb-3 w-full rounded-xl border border-gray-200 dark:border-brand-dark-border bg-white dark:bg-brand-dark-bg px-4 py-2.5 text-sm focus:border-brand-primary focus:outline-none"
                        />
                        <button
                            type="button"
                            onClick={() => setWoltUrl(urlInput.trim())}
                            disabled={!urlInput.trim()}
                            className="w-full rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-black text-white transition hover:bg-brand-secondary disabled:opacity-50"
                        >
                            טען תפריט
                        </button>
                    </div>
                )}

                {/* טעינה */}
                {loading && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" aria-hidden />
                        <p className="text-sm font-bold text-gray-600 dark:text-brand-dark-muted">טוענים את התפריט מוולט…</p>
                        <p className="mt-1 text-xs text-gray-400">זה יכול לקחת כמה שניות</p>
                    </div>
                )}

                {/* שגיאה */}
                {error && !loading && (
                    <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-rose-200 bg-rose-50 dark:bg-rose-900/20 dark:border-rose-800 p-8 text-center">
                        <FaExclamationTriangle className="mx-auto mb-3 text-3xl text-rose-500" aria-hidden />
                        <h2 className="mb-2 text-lg font-black text-rose-700 dark:text-rose-300">לא הצלחנו לטעון את התפריט</h2>
                        <p className="mb-5 text-sm text-rose-600 dark:text-rose-300">{error}</p>
                        <div className="flex flex-wrap justify-center gap-2">
                            <button
                                type="button"
                                onClick={() => loadPreview(woltUrl)}
                                className="rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-black text-white transition hover:bg-rose-700"
                            >
                                נסו שוב
                            </button>
                            <button
                                type="button"
                                onClick={() => { setWoltUrl(''); setError(null); setUrlInput(woltUrl); }}
                                className="rounded-xl border border-rose-300 px-5 py-2.5 text-sm font-black text-rose-700 dark:text-rose-300 transition hover:bg-rose-100 dark:hover:bg-rose-900/30"
                            >
                                שינוי קישור
                            </button>
                        </div>
                    </div>
                )}

                {preview && !loading && (
                    <>
                        {/* ניווט קטגוריות דביק — כמו בתפריט המערכת */}
                        <div className="sticky top-0 z-40 -mx-4 mb-6 bg-white/95 dark:bg-brand-dark-bg/95 backdrop-blur-md border-b border-gray-200 dark:border-brand-dark-border shadow-sm sm:-mx-6 lg:-mx-8">
                            <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6 lg:px-8">
                                <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                                    {preview.categories.map((category, index) => {
                                        const selectedCount = categorySelectedCount(index);
                                        return (
                                            <button
                                                key={`tab-${index}`}
                                                ref={(el) => { tabRefs.current[index] = el; }}
                                                onClick={() => scrollToCategory(index)}
                                                className={`flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium transition-all duration-300 ${activeCategory === index
                                                    ? 'bg-brand-primary text-white shadow-md'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-brand-dark-border dark:text-gray-300 dark:hover:bg-gray-500'
                                                    }`}
                                            >
                                                <span>{category.name}</span>
                                                <span className={`rounded-full px-1.5 text-xs font-black ${activeCategory === index ? 'bg-white/25' : 'bg-white dark:bg-brand-dark-bg'} ${selectedCount > 0 ? '' : 'opacity-60'}`}>
                                                    {selectedCount}/{category.items?.length || 0}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* קטגוריות ופריטים */}
                        <div className="space-y-8 md:space-y-12">
                            {preview.categories.map((category, categoryIndex) => {
                                const selectedCount = categorySelectedCount(categoryIndex);
                                const allSelected = selectedCount === (category.items?.length || 0) && (category.items?.length || 0) > 0;
                                return (
                                    <div
                                        key={`cat-${categoryIndex}`}
                                        ref={(el) => { categoryRefs.current[categoryIndex] = el; }}
                                        className="scroll-mt-32"
                                    >
                                        {/* כותרת קטגוריה — בסגנון תפריט המערכת */}
                                        <div className="mb-4 flex items-center gap-3 sm:mb-6 sm:gap-4">
                                            <div className="shrink-0 rounded-xl bg-gradient-to-br from-brand-primary/20 to-brand-secondary/20 p-2 sm:p-3">
                                                <FaLayerGroup className="h-5 w-5 text-brand-primary sm:h-6 sm:w-6" aria-hidden />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <h2 className="text-lg font-bold text-brand-dark dark:text-brand-dark-text sm:text-3xl">{category.name}</h2>
                                                <p className="mt-0.5 text-xs font-bold text-gray-500 dark:text-brand-dark-muted sm:text-sm">
                                                    {selectedCount} מתוך {category.items?.length || 0} מוצרים נבחרו
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => toggleCategory(categoryIndex)}
                                                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-black transition sm:px-4 sm:py-2 ${allSelected
                                                    ? 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-brand-dark-border dark:text-gray-300'
                                                    : 'bg-brand-primary text-white shadow-md hover:bg-brand-secondary'
                                                    }`}
                                            >
                                                {allSelected ? 'נקה בחירה' : 'בחר הכל'}
                                            </button>
                                        </div>

                                        {/* Grid מוצרים — בסגנון תפריט המערכת, עם בחירה */}
                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
                                            {(category.items || []).map((item, index) => {
                                                const isSelected = selected.has(itemKey(categoryIndex, index));
                                                return (
                                                    <div
                                                        key={`item-${categoryIndex}-${index}`}
                                                        onClick={() => toggleItem(categoryIndex, index)}
                                                        role="checkbox"
                                                        aria-checked={isSelected}
                                                        tabIndex={0}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' || e.key === ' ') {
                                                                e.preventDefault();
                                                                toggleItem(categoryIndex, index);
                                                            }
                                                        }}
                                                        className={`group relative cursor-pointer overflow-hidden rounded-[1.25rem] bg-white dark:bg-brand-dark-surface transition-all duration-300 ${isSelected
                                                            ? 'shadow-[0_8px_24px_rgba(234,88,12,0.18)] ring-2 ring-brand-primary'
                                                            : 'opacity-75 shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:opacity-100 hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] hover:-translate-y-1'
                                                            }`}
                                                    >
                                                        {/* סימון בחירה */}
                                                        <div className={`absolute top-2.5 right-2.5 z-20 flex h-7 w-7 items-center justify-center rounded-full border-2 shadow-lg transition-all ${isSelected
                                                            ? 'border-brand-primary bg-brand-primary text-white'
                                                            : 'border-white/80 bg-black/20 text-transparent backdrop-blur-sm'
                                                            }`}>
                                                            <FaCheck className="text-xs" aria-hidden />
                                                        </div>

                                                        {/* תמונה */}
                                                        <div className="relative h-32 overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100 dark:from-brand-dark-border/50 dark:to-brand-dark-bg sm:h-44">
                                                            {item.image_url ? (
                                                                <img
                                                                    src={item.image_url}
                                                                    alt={item.name}
                                                                    loading="lazy"
                                                                    className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-110 ${isSelected ? '' : 'grayscale-[40%]'}`}
                                                                />
                                                            ) : (
                                                                <div className="absolute inset-0 flex items-center justify-center">
                                                                    <FaUtensils className="text-4xl text-gray-200 dark:text-brand-dark-border" aria-hidden />
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* פרטי המנה */}
                                                        <div className="p-3 sm:p-4">
                                                            <div className="mb-1 flex items-start justify-between gap-2 sm:mb-2">
                                                                <h3 className={`line-clamp-2 text-sm font-bold transition-colors sm:line-clamp-1 sm:text-base ${isSelected ? 'text-brand-dark dark:text-brand-dark-text' : 'text-gray-500 dark:text-brand-dark-muted'}`}>
                                                                    {item.name}
                                                                </h3>
                                                                <span className={`shrink-0 whitespace-nowrap text-sm font-bold sm:text-base ${isSelected ? 'text-brand-primary' : 'text-gray-400'}`}>
                                                                    ₪{item.price}
                                                                </span>
                                                            </div>
                                                            {item.description && (
                                                                <p className="line-clamp-2 text-xs leading-snug text-gray-500 dark:text-brand-dark-muted sm:text-sm">
                                                                    {item.description}
                                                                </p>
                                                            )}
                                                            {(item.option_groups?.length || 0) > 0 && (
                                                                <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-cyan-50 dark:bg-cyan-900/20 px-2 py-0.5 text-[10px] font-black text-cyan-700 dark:text-cyan-300">
                                                                    <FaLayerGroup size={9} aria-hidden />
                                                                    {item.option_groups.length} קבוצות תוספות
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>

            {/* סרגל פעולות תחתון קבוע */}
            {preview && !loading && (
                <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 dark:border-brand-dark-border bg-white/95 dark:bg-brand-dark-surface/95 backdrop-blur-md shadow-[0_-8px_24px_rgba(0,0,0,0.08)] pb-safe">
                    <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
                        <div className="flex items-center justify-center gap-2 text-sm font-black text-brand-dark dark:text-brand-dark-text sm:justify-start">
                            <FaCheckCircle className={selected.size > 0 ? 'text-emerald-500' : 'text-gray-300'} aria-hidden />
                            נבחרו {selected.size} מתוך {totalItems} מוצרים
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => finishWithSelection('all')}
                                className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-gray-200 dark:border-brand-dark-border bg-white dark:bg-brand-dark-bg px-4 py-2.5 text-sm font-black text-gray-700 dark:text-gray-300 transition hover:border-brand-primary/40 hover:text-brand-primary sm:flex-none sm:px-5"
                            >
                                <FaForward aria-hidden />
                                דלג — ייבא הכל
                            </button>
                            <button
                                type="button"
                                onClick={() => finishWithSelection('selected')}
                                disabled={selected.size === 0}
                                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-orange-500/25 transition hover:bg-brand-secondary disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none sm:px-6"
                            >
                                {selected.size === totalItems ? <FaCheckCircle aria-hidden /> : <FaRegCircle aria-hidden />}
                                אישור הבחירה והמשך בהרשמה
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
