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

    const base = {
        id,
        name: addon.name ?? '',
        price_delta: sanitizeNumber(addon.price_delta ?? addon.priceDelta ?? addon.price ?? 0),
        on_side: addon.on_side ?? false,
        quantity: Math.max(1, Math.round(sanitizeNumber(addon.quantity ?? 1, 1))),
    };

    if (addon.addon_group_id != null && addon.addon_group_id !== '') {
        base.addon_group_id = addon.addon_group_id;
    }
    if (addon.group_id != null && addon.group_id !== '') {
        base.group_id = addon.group_id;
    }
    if (addon.first_addon_unit_free !== undefined) {
        base.first_addon_unit_free = Boolean(addon.first_addon_unit_free);
    }

    return base;
};

export const buildCartKey = (menuItemId, variant, addons = []) => {
    const variantKey = variant?.id ?? 'base';
    const addonsKey = addons.length
        ? addons
            .map((addon) => `${addon?.id}${addon?.on_side ? '-side' : ''}${(addon?.quantity || 1) > 1 ? `-x${addon.quantity}` : ''}`)
            .filter((key) => key)
            .sort()
            .join('|')
        : 'none';

    return `${menuItemId}::${variantKey}::${addonsKey}`;
};

/** סיכום תוספות ללא פטור — לקבוצה או לכל הסל כשאין מטא־קבוצה */
export const sumFullCatalogAddons = (addons = []) => {
    if (!Array.isArray(addons) || addons.length === 0) {
        return 0;
    }
    let sum = 0;
    for (const addon of addons) {
        const delta = sanitizeNumber(addon?.price_delta ?? addon?.price ?? 0);
        const addonQty = Math.max(1, sanitizeNumber(addon?.quantity ?? 1, 1));
        sum += delta * addonQty;
    }
    return Number(sum.toFixed(2));
};

/** סיכום לפי סדר השורות בתוך קבוצה אחת: יחידת מחיר ראשונה עם delta חיובי פטורה פעם אחת */
export const sumAddonsBilledWithFirstUnitFree = (addons = []) => {
    if (!Array.isArray(addons) || addons.length === 0) {
        return 0;
    }
    let freeUsed = false;
    let sum = 0;
    for (const addon of addons) {
        const delta = sanitizeNumber(addon?.price_delta ?? addon?.price ?? 0);
        const addonQty = Math.max(1, sanitizeNumber(addon?.quantity ?? 1, 1));
        let line = delta * addonQty;
        if (!freeUsed && delta > 0) {
            line = Math.max(0, line - delta);
            freeUsed = true;
        }
        sum += line;
    }
    return Number(sum.toFixed(2));
};

/**
 * תוספות עם מטא־קבוצה (addon_group_id / first_addon_unit_free): חישוב פר־קבוצה.
 * ללא מטא־קבוצה — חיוב מלא לכל התוספות (תאימות POS ישן וכו').
 */
export const sumAddonsBilledWithGroupRules = (addons = []) => {
    if (!Array.isArray(addons) || addons.length === 0) {
        return 0;
    }

    const hasGroupMeta = addons.some(
        (a) =>
            a &&
            (a.addon_group_id != null ||
                a.group_id != null ||
                a.first_addon_unit_free !== undefined),
    );

    if (!hasGroupMeta) {
        return sumFullCatalogAddons(addons);
    }

    const buckets = new Map();

    for (const addon of addons) {
        const gid =
            addon.addon_group_id != null && addon.addon_group_id !== ''
                ? `g_${addon.addon_group_id}`
                : addon.group_id != null && addon.group_id !== ''
                    ? `g_${addon.group_id}`
                    : '_legacy';

        if (!buckets.has(gid)) {
            buckets.set(gid, { applyFirstFree: false, lines: [] });
        }
        const b = buckets.get(gid);
        if (addon.first_addon_unit_free !== undefined) {
            b.applyFirstFree = b.applyFirstFree || Boolean(addon.first_addon_unit_free);
        }
        b.lines.push({
            price_delta: sanitizeNumber(addon?.price_delta ?? addon?.price ?? 0),
            quantity: Math.max(1, sanitizeNumber(addon?.quantity ?? 1, 1)),
        });
    }

    let sum = 0;
    for (const { applyFirstFree, lines } of buckets.values()) {
        sum += applyFirstFree ? sumAddonsBilledWithFirstUnitFree(lines) : sumFullCatalogAddons(lines);
    }
    return Number(sum.toFixed(2));
};

export const calculateUnitPrice = (basePrice, variant, addons = [], dineInAdjustment = 0) => {
    const normalizedBase = sanitizeNumber(basePrice);
    const variantDelta = sanitizeNumber(variant?.price_delta ?? 0);
    const addonsTotal = sumAddonsBilledWithGroupRules(addons);
    const adjustment = sanitizeNumber(dineInAdjustment);
    return Number((normalizedBase + variantDelta + addonsTotal + adjustment).toFixed(2));
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
        categoryId: rawItem.categoryId ?? rawItem.category_id ?? null,
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
    sumFullCatalogAddons,
    sumAddonsBilledWithFirstUnitFree,
    sumAddonsBilledWithGroupRules,
    calculateUnitPrice,
    normalizeCartItem,
    normalizeCartItems,
};
