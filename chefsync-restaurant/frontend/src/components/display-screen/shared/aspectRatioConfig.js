export const ASPECT_RATIOS = [
    { id: '16:9', label: '16:9', hebrewLabel: 'טלוויזיה רגילה', icon: '📺', cssAspect: 'aspect-video' },
    { id: '21:9', label: '21:9', hebrewLabel: 'מסך רחב', icon: '🖥️', cssAspect: 'aspect-[21/9]' },
    { id: '4:3', label: '4:3', hebrewLabel: 'מסך מרובע', icon: '🖵', cssAspect: 'aspect-[4/3]' },
    { id: '9:16', label: '9:16', hebrewLabel: 'מסך אנכי', icon: '📱', cssAspect: 'aspect-[9/16]' },
];

export const ASPECT_CONFIGS = {
    '16:9': {
        gridCols: { default: 'grid-cols-2', lg: 'lg:grid-cols-3' },
        itemsPerSlide: 6,
        menuboardItemsPerSlide: 15,
        fontScale: 1.0,
        headerSize: 'text-3xl',
        priceSize: 'text-xl',
        bodySize: 'text-sm',
    },
    '21:9': {
        gridCols: { default: 'grid-cols-3', lg: 'lg:grid-cols-4' },
        itemsPerSlide: 8,
        menuboardItemsPerSlide: 20,
        fontScale: 1.1,
        headerSize: 'text-4xl',
        priceSize: 'text-2xl',
        bodySize: 'text-base',
    },
    '4:3': {
        gridCols: { default: 'grid-cols-2', lg: 'lg:grid-cols-2' },
        itemsPerSlide: 4,
        menuboardItemsPerSlide: 12,
        fontScale: 0.95,
        headerSize: 'text-2xl',
        priceSize: 'text-lg',
        bodySize: 'text-sm',
    },
    '9:16': {
        gridCols: { default: 'grid-cols-1', lg: 'lg:grid-cols-1' },
        itemsPerSlide: 4,
        menuboardItemsPerSlide: 10,
        fontScale: 0.9,
        headerSize: 'text-2xl',
        priceSize: 'text-lg',
        bodySize: 'text-sm',
    },
};

export const getAspectConfig = (ratio) => ASPECT_CONFIGS[ratio] || ASPECT_CONFIGS['16:9'];
