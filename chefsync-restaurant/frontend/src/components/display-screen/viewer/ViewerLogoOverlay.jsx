const SIZE_CLASSES = {
    sm: 'w-14 h-14 rounded-xl',
    md: 'w-20 h-20 rounded-2xl',
    lg: 'w-28 h-28 rounded-3xl',
};

const POSITION_CLASSES = {
    'top-right': 'right-6 top-6',
    'top-left': 'left-6 top-6',
    'bottom-right': 'right-6 bottom-6',
    'bottom-left': 'left-6 bottom-6',
    'center': 'left-1/2 top-6 -translate-x-1/2',
};

export default function ViewerLogoOverlay({ designOptions, logoUrl }) {
    const overlay = designOptions?.logo_overlay;
    if (!overlay?.enabled || !logoUrl) return null;

    const position = overlay.position || 'top-right';
    const size = overlay.size || 'md';
    const opacity = (overlay.opacity || 8) / 10;

    return (
        <div
            className={`fixed z-10 ${POSITION_CLASSES[position] || POSITION_CLASSES['top-right']}`}
            style={{ opacity }}
        >
            <img
                src={logoUrl}
                alt=""
                className={`${SIZE_CLASSES[size] || SIZE_CLASSES.md} object-cover shadow-lg`}
            />
        </div>
    );
}
