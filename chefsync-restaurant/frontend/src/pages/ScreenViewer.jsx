import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { getViewerContent } from '../services/displayScreenService';

const PRESET_STYLES = {
    classic: {
        bg: 'bg-gradient-to-br from-amber-50 to-orange-50',
        card: 'bg-white border border-amber-100 shadow-md',
        title: 'text-gray-900',
        price: 'text-amber-700 bg-amber-50',
        category: 'text-amber-600 bg-amber-50 border-amber-200',
        header: 'bg-white/80 backdrop-blur-md border-b border-amber-100',
        text: 'text-gray-700',
        desc: 'text-gray-500',
        dark: false,
    },
    minimal: {
        bg: 'bg-white',
        card: 'bg-gray-50 border border-gray-100',
        title: 'text-gray-900',
        price: 'text-gray-700 bg-gray-100',
        category: 'text-gray-500 bg-gray-100 border-gray-200',
        header: 'bg-white border-b border-gray-100',
        text: 'text-gray-700',
        desc: 'text-gray-400',
        dark: false,
    },
    menuboard: {
        bg: 'bg-[#1c1c1c]',
        card: 'bg-transparent border-b border-yellow-900/30',
        title: 'text-yellow-100',
        price: 'text-yellow-400',
        category: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20',
        header: 'bg-[#111] border-b-2 border-yellow-600/50',
        text: 'text-yellow-100/90',
        desc: 'text-yellow-100/50',
        dark: true,
        categoryHeader: 'text-yellow-400 border-b border-yellow-600/30',
        dots: 'border-yellow-100/20',
    },
    modern: {
        bg: 'bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700',
        card: 'bg-white/10 backdrop-blur-lg border border-white/20 shadow-xl',
        title: 'text-white',
        price: 'text-yellow-300 bg-white/10',
        category: 'text-blue-200 bg-white/10 border-white/20',
        header: 'bg-white/10 backdrop-blur-xl border-b border-white/10',
        text: 'text-white/90',
        desc: 'text-white/60',
        dark: true,
    },
    dark: {
        bg: 'bg-[#1a1a2e]',
        card: 'bg-[#16213e] border border-[#0f3460]/50 shadow-lg',
        title: 'text-white',
        price: 'text-emerald-400 bg-emerald-400/10',
        category: 'text-blue-300 bg-blue-400/10 border-blue-400/20',
        header: 'bg-[#0f3460]/80 backdrop-blur-xl border-b border-[#0f3460]',
        text: 'text-gray-200',
        desc: 'text-gray-400',
        dark: true,
    },
    workers: {
        bg: 'bg-gradient-to-br from-orange-600 to-amber-700',
        card: 'bg-white/15 backdrop-blur-sm border border-white/20 shadow-lg',
        title: 'text-white',
        price: 'text-yellow-200 bg-black/20',
        category: 'text-orange-200 bg-black/15 border-orange-300/20',
        header: 'bg-black/20 backdrop-blur-xl border-b border-white/10',
        text: 'text-white/90',
        desc: 'text-white/60',
        dark: true,
    },
    grill: {
        bg: 'bg-gradient-to-br from-gray-900 via-red-950 to-gray-900',
        card: 'bg-red-950/40 border border-red-800/30 shadow-lg',
        title: 'text-red-100',
        price: 'text-orange-400 bg-orange-400/10',
        category: 'text-red-300 bg-red-400/10 border-red-400/20',
        header: 'bg-black/40 backdrop-blur-xl border-b border-red-800/30',
        text: 'text-red-100/90',
        desc: 'text-red-200/50',
        dark: true,
    },
    family: {
        bg: 'bg-gradient-to-br from-pink-50 via-yellow-50 to-blue-50',
        card: 'bg-white border-2 border-pink-100 shadow-md',
        title: 'text-gray-800',
        price: 'text-pink-600 bg-pink-50',
        category: 'text-purple-600 bg-purple-50 border-purple-200',
        header: 'bg-white/80 backdrop-blur-md border-b-2 border-pink-100',
        text: 'text-gray-700',
        desc: 'text-gray-400',
        dark: false,
    },
    pizzeria: {
        bg: 'bg-gradient-to-br from-green-800 via-green-700 to-red-800',
        card: 'bg-white/10 backdrop-blur-sm border border-white/15 shadow-lg',
        title: 'text-white',
        price: 'text-green-200 bg-black/20',
        category: 'text-green-200 bg-green-400/10 border-green-400/20',
        header: 'bg-black/30 backdrop-blur-xl border-b border-white/10',
        text: 'text-white/90',
        desc: 'text-white/60',
        dark: true,
    },
    homecooking: {
        bg: 'bg-gradient-to-br from-amber-100 via-orange-50 to-yellow-100',
        card: 'bg-white border border-amber-200 shadow-md',
        title: 'text-amber-900',
        price: 'text-amber-800 bg-amber-100',
        category: 'text-amber-700 bg-amber-100 border-amber-300',
        header: 'bg-amber-50/80 backdrop-blur-md border-b border-amber-200',
        text: 'text-amber-800',
        desc: 'text-amber-600/60',
        dark: false,
    },
};

const BADGE_MAP = {
    spicy: '🌶',
    recommended: '⭐',
    new: '🆕',
    value: '💰',
};

const ITEMS_PER_SLIDE = 6;
const MENUBOARD_ITEMS_PER_SLIDE = 15;

export default function ScreenViewer() {
    const { token } = useParams();
    const [data, setData] = useState(null);
    const [error, setError] = useState(false);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [cursorHidden, setCursorHidden] = useState(false);
    const cursorTimer = useRef(null);
    const refreshTimer = useRef(null);
    const slideTimer = useRef(null);

    const fetchContent = useCallback(async () => {
        try {
            const res = await getViewerContent(token);
            if (res.success) {
                setData(res.data);
                setError(false);
            }
        } catch (err) {
            console.error('Failed to fetch screen content:', err);
            // Keep showing cached data
            if (!data) setError(true);
        }
    }, [token]);

    // Initial fetch + auto-refresh
    useEffect(() => {
        fetchContent();
        return () => {
            if (refreshTimer.current) clearInterval(refreshTimer.current);
        };
    }, [fetchContent]);

    // Set up refresh interval when data is available
    useEffect(() => {
        if (data?.screen?.refresh_interval) {
            if (refreshTimer.current) clearInterval(refreshTimer.current);
            refreshTimer.current = setInterval(fetchContent, data.screen.refresh_interval * 1000);
        }
        return () => {
            if (refreshTimer.current) clearInterval(refreshTimer.current);
        };
    }, [data?.screen?.refresh_interval, fetchContent]);

    // Determine items per slide based on preset
    const itemsPerSlide = data?.screen?.design_preset === 'menuboard' ? MENUBOARD_ITEMS_PER_SLIDE : ITEMS_PER_SLIDE;

    // Carousel auto-advance
    useEffect(() => {
        if (data?.screen?.display_type === 'rotating' && data?.items?.length > itemsPerSlide) {
            const totalSlides = Math.ceil(data.items.length / itemsPerSlide);
            if (slideTimer.current) clearInterval(slideTimer.current);
            slideTimer.current = setInterval(() => {
                setCurrentSlide(prev => (prev + 1) % totalSlides);
            }, (data.screen.rotation_speed || 5) * 1000);
        }
        return () => {
            if (slideTimer.current) clearInterval(slideTimer.current);
        };
    }, [data?.screen?.display_type, data?.screen?.rotation_speed, data?.items?.length, itemsPerSlide]);

    // Hide cursor after 3s of inactivity
    useEffect(() => {
        const handleMove = () => {
            setCursorHidden(false);
            if (cursorTimer.current) clearTimeout(cursorTimer.current);
            cursorTimer.current = setTimeout(() => setCursorHidden(true), 3000);
        };
        window.addEventListener('mousemove', handleMove);
        handleMove();
        return () => {
            window.removeEventListener('mousemove', handleMove);
            if (cursorTimer.current) clearTimeout(cursorTimer.current);
        };
    }, []);

    // Fullscreen on click
    const requestFullscreen = () => {
        const el = document.documentElement;
        if (el.requestFullscreen) el.requestFullscreen();
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    };

    // Derived state (must be before early returns to keep hook order stable)
    const screen = data?.screen;
    const restaurant = data?.restaurant;
    const items = data?.items || [];
    const preset = PRESET_STYLES[screen?.design_preset] || PRESET_STYLES.classic;
    const designOptions = screen?.design_options || {};
    const logoOverlay = designOptions.logo_overlay;
    const promotion = designOptions.promotion;
    const isMenuboard = screen?.design_preset === 'menuboard';

    const totalSlides = Math.ceil(items.length / itemsPerSlide) || 1;
    const currentItems = screen?.display_type === 'rotating'
        ? items.slice(currentSlide * itemsPerSlide, (currentSlide + 1) * itemsPerSlide)
        : items;

    // Group items by category for menuboard (hook must be called unconditionally)
    const groupedItems = useMemo(() => {
        if (!isMenuboard || currentItems.length === 0) return null;
        const groups = {};
        currentItems.forEach(item => {
            const cat = item.category || 'כללי';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(item);
        });
        return groups;
    }, [isMenuboard, currentItems]);

    if (error && !data) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center" dir="rtl">
                <div className="text-center">
                    <div className="text-6xl mb-6">📺</div>
                    <h1 className="text-3xl font-black text-white mb-3">מסך לא נמצא</h1>
                    <p className="text-gray-400 text-lg">הקישור אינו תקין או שהמסך הושבת</p>
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-white"></div>
            </div>
        );
    }

    // Render badge emojis
    const renderBadges = (badges) => {
        if (!badges || badges.length === 0) return null;
        return (
            <span className="inline-flex gap-0.5 mr-1">
                {badges.map(b => BADGE_MAP[b] && (
                    <span key={b} className="text-sm">{BADGE_MAP[b]}</span>
                ))}
            </span>
        );
    };

    return (
        <div
            className={`min-h-screen ${preset.bg} flex flex-col relative ${cursorHidden ? 'cursor-none' : ''}`}
            dir="rtl"
            onClick={requestFullscreen}
        >
            {/* Logo Overlay Watermark */}
            {logoOverlay?.enabled && restaurant.logo_url && (
                <div
                    className={`fixed z-10 ${logoOverlay.position === 'top-left' ? 'left-6 top-6' : 'right-6 top-6'}`}
                    style={{ opacity: (logoOverlay.opacity || 8) / 10 }}
                >
                    <img
                        src={restaurant.logo_url}
                        alt=""
                        className="w-20 h-20 rounded-2xl object-cover shadow-lg"
                    />
                </div>
            )}

            {/* Promotion Bar (top bar mode) */}
            {promotion?.enabled && promotion?.text && promotion?.display_mode === 'bar' && (
                <div className={`${preset.dark ? 'bg-yellow-500 text-gray-900' : 'bg-indigo-600 text-white'} px-6 py-3 text-center shrink-0`}>
                    <p className="font-black text-lg">
                        {promotion.icon && <span className="ml-2">{promotion.icon}</span>}
                        {promotion.text}
                    </p>
                </div>
            )}

            {/* Header */}
            <div className={`${preset.header} px-8 py-5 flex items-center justify-between shrink-0`}>
                <div className="flex items-center gap-4">
                    {restaurant.logo_url && !logoOverlay?.enabled && (
                        <img
                            src={restaurant.logo_url}
                            alt={restaurant.name}
                            className="w-14 h-14 rounded-2xl object-cover shadow-lg"
                        />
                    )}
                    <div>
                        <h1 className={`text-3xl font-black ${preset.title}`}>{restaurant.name}</h1>
                        {screen.name && (
                            <p className={`text-sm font-medium ${preset.desc}`}>{screen.name}</p>
                        )}
                    </div>
                </div>
                {/* Slide indicators for carousel */}
                {screen.display_type === 'rotating' && totalSlides > 1 && (
                    <div className="flex items-center gap-2">
                        {Array.from({ length: totalSlides }).map((_, i) => (
                            <div
                                key={i}
                                className={`w-3 h-3 rounded-full transition-all duration-500 ${i === currentSlide
                                        ? `scale-125 ${preset.dark ? 'bg-white' : 'bg-gray-800'}`
                                        : `${preset.dark ? 'bg-white/30' : 'bg-gray-300'}`
                                    }`}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Main Content */}
            <div className="flex-1 p-6 lg:p-10 overflow-hidden">
                {items.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                        <p className={`text-2xl font-bold ${preset.desc}`}>אין פריטים להצגה</p>
                    </div>
                ) : isMenuboard ? (
                    /* Menuboard: text-only price list grouped by category */
                    <div className="max-w-5xl mx-auto space-y-6">
                        {groupedItems && Object.entries(groupedItems).map(([category, catItems]) => (
                            <div key={category}>
                                <h2 className={`text-2xl font-black pb-2 mb-4 ${preset.categoryHeader || preset.title} ${preset.categoryHeader ? '' : 'border-b border-current/20'}`}>
                                    {category}
                                </h2>
                                <div className="space-y-2">
                                    {catItems.map((item, idx) => (
                                        <div
                                            key={item.id || idx}
                                            className="flex items-baseline gap-2 px-2"
                                        >
                                            <span className={`text-xl font-black ${preset.title} shrink-0`}>
                                                {renderBadges(item.badge)}
                                                {item.name}
                                            </span>
                                            {/* Promotion tag next to item */}
                                            {promotion?.enabled && promotion?.text && promotion?.display_mode === 'tag' && idx === 0 && (
                                                <span className={`shrink-0 px-2 py-0.5 rounded-lg text-xs font-black ${preset.dark ? 'bg-yellow-500 text-gray-900' : 'bg-indigo-600 text-white'}`}>
                                                    {promotion.icon} {promotion.text}
                                                </span>
                                            )}
                                            <span className={`flex-1 border-b-2 border-dotted min-w-8 ${preset.dots || (preset.dark ? 'border-white/20' : 'border-gray-300')}`}></span>
                                            <span className={`text-xl font-black shrink-0 ${preset.price} px-3 py-0.5 rounded-xl`}>
                                                {item.price} ₪
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : screen.design_preset === 'minimal' ? (
                    /* Minimal: compact list */
                    <div className="max-w-4xl mx-auto space-y-3">
                        {currentItems.map((item, idx) => (
                            <div
                                key={item.id || idx}
                                className={`${preset.card} rounded-2xl p-5 flex items-center gap-4 transition-all duration-700`}
                                style={{ animationDelay: `${idx * 80}ms` }}
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3">
                                        <h3 className={`text-xl font-black ${preset.title} truncate`}>
                                            {renderBadges(item.badge)}
                                            {item.name}
                                        </h3>
                                        {item.category && (
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${preset.category}`}>
                                                {item.category}
                                            </span>
                                        )}
                                        {/* Promotion tag */}
                                        {promotion?.enabled && promotion?.text && promotion?.display_mode === 'tag' && idx === 0 && (
                                            <span className={`px-2 py-0.5 rounded-lg text-xs font-black ${preset.dark ? 'bg-yellow-500 text-gray-900' : 'bg-indigo-600 text-white'}`}>
                                                {promotion.icon} {promotion.text}
                                            </span>
                                        )}
                                    </div>
                                    {item.description && (
                                        <p className={`${preset.desc} text-sm mt-1 truncate`}>{item.description}</p>
                                    )}
                                </div>
                                <div className={`${preset.price} px-5 py-2.5 rounded-2xl font-black text-lg whitespace-nowrap`}>
                                    {item.price} ₪
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    /* Grid layout (all other presets) */
                    <div className={`grid gap-6 h-full ${currentItems.length <= 3
                            ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                            : currentItems.length <= 6
                                ? 'grid-cols-2 lg:grid-cols-3'
                                : 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                        }`}>
                        {currentItems.map((item, idx) => (
                            <div
                                key={item.id || idx}
                                className={`${preset.card} rounded-[2rem] overflow-hidden flex flex-col transition-all duration-700 relative`}
                                style={{ animationDelay: `${idx * 100}ms` }}
                            >
                                {/* Promotion tag on card */}
                                {promotion?.enabled && promotion?.text && promotion?.display_mode === 'tag' && idx === 0 && (
                                    <div className={`absolute top-4 left-4 z-10 px-3 py-1.5 rounded-xl text-xs font-black shadow-lg ${preset.dark ? 'bg-yellow-500 text-gray-900' : 'bg-indigo-600 text-white'}`}>
                                        {promotion.icon} {promotion.text}
                                    </div>
                                )}
                                {item.image_url && (
                                    <div className="aspect-[16/10] overflow-hidden">
                                        <img
                                            src={item.image_url}
                                            alt={item.name}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                )}
                                <div className="p-6 flex flex-col flex-1">
                                    {item.category && (
                                        <span className={`self-start px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border mb-3 ${preset.category}`}>
                                            {item.category}
                                        </span>
                                    )}
                                    <h3 className={`text-2xl font-black ${preset.title} leading-tight`}>
                                        {renderBadges(item.badge)}
                                        {item.name}
                                    </h3>
                                    {item.description && (
                                        <p className={`${preset.desc} text-sm mt-2 line-clamp-2 leading-relaxed`}>{item.description}</p>
                                    )}
                                    <div className="mt-auto pt-4">
                                        <span className={`${preset.price} inline-block px-5 py-2.5 rounded-2xl font-black text-xl`}>
                                            {item.price} ₪
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Branding Footer */}
            {screen.show_branding && (
                <div className={`${preset.header} px-6 py-3 text-center shrink-0`}>
                    <p className={`text-xs font-medium ${preset.desc}`}>
                        Powered by <span className="font-black">ChefSync</span>
                    </p>
                </div>
            )}
        </div>
    );
}
