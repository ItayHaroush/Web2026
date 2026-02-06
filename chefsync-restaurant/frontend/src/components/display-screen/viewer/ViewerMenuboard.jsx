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

export default function ViewerMenuboard({ groupedItems, preset, designOptions }) {
    const promoWidget = (designOptions?.widgets || []).find(w => w.type === 'promotion' && w.enabled && w.config?.display_mode === 'tag');

    if (!groupedItems) return null;

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {Object.entries(groupedItems).map(([category, catItems]) => (
                <div key={category}>
                    <h2
                        className={`text-2xl font-black pb-2 mb-4 ${preset.categoryHeader || preset.title} ${preset.categoryHeader ? '' : 'border-b border-current/20'}`}
                        style={designOptions?.fonts?.title ? { fontFamily: 'var(--font-title)' } : undefined}
                    >
                        {category}
                    </h2>
                    <div className="space-y-2">
                        {catItems.map((item, idx) => (
                            <div key={item.id || idx} className="flex items-baseline gap-2 px-2">
                                <span
                                    className={`text-xl font-black ${preset.title} shrink-0`}
                                    style={designOptions?.fonts?.title ? { fontFamily: 'var(--font-title)' } : undefined}
                                >
                                    {renderBadges(item.badge)}
                                    {item.name}
                                </span>
                                {promoWidget && (
                                    <span className={`shrink-0 px-2 py-0.5 rounded-lg text-xs font-black ${preset.dark ? 'bg-yellow-500 text-gray-900' : 'bg-indigo-600 text-white'}`}>
                                        {promoWidget.config.icon} {promoWidget.config.text}
                                    </span>
                                )}
                                <span className={`flex-1 border-b-2 border-dotted min-w-8 ${preset.dots || (preset.dark ? 'border-white/20' : 'border-gray-300')}`}></span>
                                <span
                                    className={`text-xl font-black shrink-0 ${preset.price} px-3 py-0.5 rounded-xl`}
                                    style={designOptions?.fonts?.price ? { fontFamily: 'var(--font-price)' } : undefined}
                                >
                                    {item.price} ₪
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
