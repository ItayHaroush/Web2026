export default function ViewerHeader({ screen, restaurant, preset, designOptions, currentSlide, totalSlides }) {
    const logoOverlay = designOptions?.logo_overlay;

    return (
        <div className={`${preset.header} px-8 py-5 flex items-center justify-between shrink-0`}>
            <div className="flex items-center gap-4">
                {restaurant?.logo_url && !logoOverlay?.enabled && (
                    <img
                        src={restaurant.logo_url}
                        alt={restaurant.name}
                        className="w-14 h-14 rounded-2xl object-cover shadow-lg"
                    />
                )}
                <div>
                    <h1
                        className={`text-3xl font-black ${preset.title}`}
                        style={designOptions?.fonts?.title ? { fontFamily: 'var(--font-title)' } : undefined}
                    >
                        {restaurant?.name}
                    </h1>
                    {screen?.name && (
                        <p className={`text-sm font-medium ${preset.desc}`}>{screen.name}</p>
                    )}
                </div>
            </div>
            {screen?.display_type === 'rotating' && totalSlides > 1 && (
                <div className="flex items-center gap-2">
                    {Array.from({ length: totalSlides }).map((_, i) => (
                        <div
                            key={i}
                            className={`w-3 h-3 rounded-full transition-all duration-500 ${
                                i === currentSlide
                                    ? `scale-125 ${preset.dark ? 'bg-white' : 'bg-gray-800'}`
                                    : `${preset.dark ? 'bg-white/30' : 'bg-gray-300'}`
                            }`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
