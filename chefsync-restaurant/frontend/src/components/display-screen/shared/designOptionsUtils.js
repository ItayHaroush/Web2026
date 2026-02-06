import { WIDGET_TYPES, createDefaultWidget } from './widgetDefaults';

const DEFAULT_OPTIONS = {
    _version: 2,
    menuboard_theme: 'dark',
    fonts: null,
    background: { mode: 'preset' },
    logo_overlay: { enabled: false, position: 'top-right', size: 'md', opacity: 8 },
    widgets: [],
    layout: {
        font_scale: 1.0,
        show_descriptions: true,
        show_images: true,
        show_categories: true,
        card_style: 'rounded',
    },
};

export const migrateV1toV2 = (options) => {
    if (!options) return null;
    if (options._version === 2) return options;

    const v2 = { ...options, _version: 2 };

    // Migrate old promotion to widgets array
    if (options.promotion) {
        const promoWidget = {
            type: 'promotion',
            enabled: options.promotion.enabled || false,
            position: options.promotion.display_mode === 'bar' ? 'top-bar' : 'top-right-badge',
            config: {
                text: options.promotion.text || '',
                icon: options.promotion.icon || '🔥',
                display_mode: options.promotion.display_mode || 'bar',
                style: 'bold',
            },
        };
        v2.widgets = [promoWidget];
        delete v2.promotion;
    }

    return v2;
};

export const mergeWithDefaults = (options) => {
    if (!options) return { ...DEFAULT_OPTIONS };
    return {
        ...DEFAULT_OPTIONS,
        ...options,
        background: { ...DEFAULT_OPTIONS.background, ...(options.background || {}) },
        logo_overlay: { ...DEFAULT_OPTIONS.logo_overlay, ...(options.logo_overlay || {}) },
        layout: { ...DEFAULT_OPTIONS.layout, ...(options.layout || {}) },
        widgets: options.widgets || [],
    };
};

export const stripProFeatures = (options) => {
    if (!options) return options;
    const stripped = { ...options };
    delete stripped.fonts;
    if (stripped.background && stripped.background.mode !== 'preset') {
        stripped.background = { mode: 'preset' };
    }
    delete stripped.layout;
    if (stripped.widgets) {
        stripped.widgets = stripped.widgets.filter(w => w.type === 'promotion');
    }
    if (stripped.logo_overlay) {
        const pos = stripped.logo_overlay.position;
        if (!['top-left', 'top-right'].includes(pos)) {
            stripped.logo_overlay = { ...stripped.logo_overlay, position: 'top-right' };
        }
        delete stripped.logo_overlay.size;
    }
    return stripped;
};

export const getActiveWidgets = (options) => {
    const opts = mergeWithDefaults(options);
    return (opts.widgets || []).filter(w => w.enabled);
};

export const getPromoWidget = (options) => {
    const opts = migrateV1toV2(options);
    if (!opts) return null;
    const widgets = opts.widgets || [];
    return widgets.find(w => w.type === 'promotion' && w.enabled) || null;
};
