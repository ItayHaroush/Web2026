import { BADGE_MAP } from '../shared/presetStyles';

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

export default function ViewerGrid({ items, preset, designOptions, aspectConfig }) {
    const promoWidget = (designOptions?.widgets || []).find(w => w.type === 'promotion' && w.enabled && w.config?.display_mode === 'tag');
    const showImages = designOptions?.layout?.show_images !== false;
    const showDescriptions = designOptions?.layout?.show_descriptions !== false;
    const showCategories = designOptions?.layout?.show_categories !== false;

    const gridCols = items.length <= 3
        ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
        : items.length <= 6
            ? `grid-cols-2 ${aspectConfig?.gridCols?.lg || 'lg:grid-cols-3'}`
            : `grid-cols-2 ${aspectConfig?.gridCols?.lg || 'lg:grid-cols-3'} xl:grid-cols-4`;

    return (
        <div className={`grid gap-6 h-full ${gridCols}`}>
            {items.map((item, idx) => (
                <div
                    key={item.id || idx}
                    className={`${preset.card} rounded-[2rem] overflow-hidden flex flex-col transition-all duration-700 relative`}
                    style={{ animationDelay: `${idx * 100}ms` }}
                >
                    {promoWidget && (
                        <div className={`absolute top-4 left-4 z-10 px-3 py-1.5 rounded-xl text-xs font-black shadow-lg ${preset.dark ? 'bg-yellow-500 text-gray-900' : 'bg-indigo-600 text-white'}`}>
                            {promoWidget.config.icon} {promoWidget.config.text}
                        </div>
                    )}
                    {showImages && item.image_url && (
                        <div className="aspect-[16/10] overflow-hidden">
                            <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                        </div>
                    )}
                    <div className="p-6 flex flex-col flex-1">
                        {showCategories && item.category && (
                            <span className={`self-start px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border mb-3 ${preset.category}`}>
                                {item.category}
                            </span>
                        )}
                        <h3
                            className={`text-2xl font-black ${preset.title} leading-tight`}
                            style={designOptions?.fonts?.title ? { fontFamily: 'var(--font-title)' } : undefined}
                        >
                            {renderBadges(item.badge)}
                            {item.name}
                        </h3>
                        {showDescriptions && item.description && (
                            <p
                                className={`${preset.desc} text-sm mt-2 line-clamp-2 leading-relaxed`}
                                style={designOptions?.fonts?.body ? { fontFamily: 'var(--font-body)' } : undefined}
                            >
                                {item.description}
                            </p>
                        )}
                        <div className="mt-auto pt-4">
                            <span
                                className={`${preset.price} inline-block px-5 py-2.5 rounded-2xl font-black text-xl`}
                                style={designOptions?.fonts?.price ? { fontFamily: 'var(--font-price)' } : undefined}
                            >
                                {item.price} ₪
                            </span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
