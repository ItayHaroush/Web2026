export const sanitizeNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

export const normalizeVariant = (variant) => {
    if (!variant) {
        return null;
    }

    const id = variant.id ?? variant.variant_id;

    if (!id && id !== 0) {
        return null;
    }

    return {
        id,
        name: variant.name ?? '',
        price_delta: sanitizeNumber(variant.price_delta ?? variant.priceDelta ?? 0),
    };
};

export const normalizeAddon = (addon) => {
    if (!addon) {
        return null;
    }

    const id = addon.id ?? addon.addon_id;

    if (!id && id !== 0) {
        return null;
    }

    return {
        id,
        name: addon.name ?? '',
        price_delta: sanitizeNumber(addon.price_delta ?? addon.priceDelta ?? addon.price ?? 0),
    };
};

export const buildCartKey = (menuItemId, variant, addons = []) => {
    const variantKey = variant?.id ?? 'base';
    const addonsKey = addons.length
        ? addons
            .map((addon) => addon?.id)
            .filter((id) => id || id === 0)
            .sort()
            .join('|')
        : 'none';

    return `${menuItemId}::${variantKey}::${addonsKey}`;
};

export const calculateUnitPrice = (basePrice, variant, addons = []) => {
    const normalizedBase = sanitizeNumber(basePrice);
    const variantDelta = sanitizeNumber(variant?.price_delta ?? 0);
    const addonsTotal = addons.reduce((sum, addon) => sum + sanitizeNumber(addon?.price_delta ?? 0), 0);

    return Number((normalizedBase + variantDelta + addonsTotal).toFixed(2));
};

export const normalizeCartItem = (rawItem) => {
    if (!rawItem) {
        return null;
    }

    const menuItemId = rawItem.menuItemId ?? rawItem.menu_item_id ?? rawItem.id;

    if (!menuItemId && menuItemId !== 0) {
        return null;
    }

    const basePrice = sanitizeNumber(rawItem.basePrice ?? rawItem.price ?? rawItem.unitPrice ?? 0);
    const variant = normalizeVariant(rawItem.variant);
    const addons = Array.isArray(rawItem.addons)
        ? rawItem.addons.map(normalizeAddon).filter(Boolean)
        : [];
    const qty = Math.max(1, Math.round(sanitizeNumber(rawItem.qty ?? rawItem.quantity ?? 1, 1)));
    const unitPrice = rawItem.unitPrice
        ? sanitizeNumber(rawItem.unitPrice)
        : calculateUnitPrice(basePrice, variant, addons);
    const cartKey = rawItem.cartKey ?? buildCartKey(menuItemId, variant, addons);

    return {
        cartKey,
        menuItemId,
        name: rawItem.name ?? '',
        basePrice,
        variant,
        addons,
        qty,
        unitPrice,
        totalPrice: Number((unitPrice * qty).toFixed(2)),
        imageUrl: rawItem.imageUrl ?? rawItem.image_url ?? null,
        restaurantId: rawItem.restaurantId ?? rawItem.restaurant_id ?? null,
        restaurantName: rawItem.restaurantName ?? rawItem.restaurant_name ?? null,
    };
};

export const normalizeCartItems = (items) => {
    if (!Array.isArray(items)) {
        return [];
    }

    return items.map(normalizeCartItem).filter(Boolean);
};

export default {
    sanitizeNumber,
    normalizeVariant,
    normalizeAddon,
    buildCartKey,
    calculateUnitPrice,
    normalizeCartItem,
    normalizeCartItems,
};
