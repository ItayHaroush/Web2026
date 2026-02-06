export const WIDGET_TYPES = [
    {
        type: 'promotion',
        label: 'מבצע / קידום',
        icon: '🔥',
        positions: ['top-bar', 'bottom-bar', 'top-right-badge', 'top-left-badge'],
        defaultPosition: 'top-bar',
        defaultConfig: {
            text: '',
            icon: '🔥',
            display_mode: 'bar',
            style: 'bold',
        },
        tier: 'all',
    },
    {
        type: 'announcement',
        label: 'הודעה כללית',
        icon: '📢',
        positions: ['top-bar', 'bottom-bar'],
        defaultPosition: 'bottom-bar',
        defaultConfig: {
            text: '',
            icon: '📢',
            style: 'info',
        },
        tier: 'pro',
    },
    {
        type: 'business_hours',
        label: 'שעות פעילות',
        icon: '🕐',
        positions: ['bottom-bar', 'bottom-right-badge', 'bottom-left-badge'],
        defaultPosition: 'bottom-bar',
        defaultConfig: {
            show_today_only: true,
            compact: true,
        },
        tier: 'pro',
    },
    {
        type: 'delivery_info',
        label: 'משלוחים / איסוף',
        icon: '🚚',
        positions: ['bottom-bar', 'bottom-right-badge', 'bottom-left-badge'],
        defaultPosition: 'bottom-bar',
        defaultConfig: {
            show_pickup: true,
            show_delivery: true,
        },
        tier: 'pro',
    },
];

export const ANNOUNCEMENT_ICONS = ['📢', '⚠️', '🎉', '💡', '📌', '🔔', '✨', '🎊'];
export const ANNOUNCEMENT_STYLES = [
    { id: 'info', label: 'מידע', color: 'bg-blue-500 text-white' },
    { id: 'warning', label: 'אזהרה', color: 'bg-amber-500 text-white' },
    { id: 'success', label: 'הצלחה', color: 'bg-green-500 text-white' },
];

export const getWidgetType = (type) => WIDGET_TYPES.find(w => w.type === type);

export const createDefaultWidget = (type) => {
    const def = getWidgetType(type);
    if (!def) return null;
    return {
        type,
        enabled: false,
        position: def.defaultPosition,
        config: { ...def.defaultConfig },
    };
};
