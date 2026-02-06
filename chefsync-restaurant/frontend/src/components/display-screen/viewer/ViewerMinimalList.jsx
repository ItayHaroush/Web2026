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

export default function ViewerMinimalList({ items, preset, designOptions }) {
    const promoWidget = (designOptions?.widgets || []).find(w => w.type === 'promotion' && w.enabled && w.config?.display_mode === 'tag');
    const showDescriptions = designOptions?.layout?.show_descriptions !== false;
    const showCategories = designOptions?.layout?.show_categories !== false;

    return (
        <div className="max-w-4xl mx-auto space-y-3">
            {items.map((item, idx) => (
                <div
                    key={item.id || idx}
                    className={`${preset.card} rounded-2xl p-5 flex items-center gap-4 transition-all duration-700`}
                    style={{ animationDelay: `${idx * 80}ms` }}
                >
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                            <h3
                                className={`text-xl font-black ${preset.title} truncate`}
                                style={designOptions?.fonts?.title ? { fontFamily: 'var(--font-title)' } : undefined}
                            >
                                {renderBadges(item.badge)}
                                {item.name}
                            </h3>
                            {showCategories && item.category && (
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${preset.category}`}>
                                    {item.category}
                                </span>
                            )}
                            {promoWidget && (
                                <span className={`px-2 py-0.5 rounded-lg text-xs font-black ${preset.dark ? 'bg-yellow-500 text-gray-900' : 'bg-indigo-600 text-white'}`}>
                                    {promoWidget.config.icon} {promoWidget.config.text}
                                </span>
                            )}
                        </div>
                        {showDescriptions && item.description && (
                            <p
                                className={`${preset.desc} text-sm mt-1 truncate`}
                                style={designOptions?.fonts?.body ? { fontFamily: 'var(--font-body)' } : undefined}
                            >
                                {item.description}
                            </p>
                        )}
                    </div>
                    <div
                        className={`${preset.price} px-5 py-2.5 rounded-2xl font-black text-lg whitespace-nowrap`}
                        style={designOptions?.fonts?.price ? { fontFamily: 'var(--font-price)' } : undefined}
                    >
                        {item.price} ₪
                    </div>
                </div>
            ))}
        </div>
    );
}
