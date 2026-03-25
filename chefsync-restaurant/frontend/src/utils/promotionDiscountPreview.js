/**
 * השלמת categoryId לפריטי סל מתפריט (כשהוספה לסל בלי קטגוריה — חישוב מחיר קבוע לפי כללים נכשל בלי זה)
 * @param {Array<object>} cartItems
 * @param {Array<{ id: number, items?: Array<{ id: number }> }>} menuCategories
 */
function resolveCartItemsForPromoCalc(cartItems, menuCategories) {
    if (!menuCategories?.length || !cartItems?.length) {
        return cartItems;
    }
    const menuItemToCategory = new Map();
    for (const cat of menuCategories) {
        const cid = Number(cat.id);
        if (Number.isNaN(cid)) continue;
        for (const it of cat.items || []) {
            menuItemToCategory.set(Number(it.id), cid);
        }
    }
    return cartItems.map((item) => {
        const mid = Number(item.menuItemId);
        const fromMenu = menuItemToCategory.get(mid);
        const raw = item.categoryId ?? item.category_id;
        const existing = raw != null && raw !== '' ? Number(raw) : NaN;
        const resolved = Number.isFinite(existing) && existing > 0 ? existing : fromMenu;
        if (resolved == null || Number.isNaN(resolved)) {
            return item;
        }
        return { ...item, categoryId: resolved };
    });
}

/**
 * מחיר קבוע לחבילה — תואם PromotionService::bundleAllocatedSubtotalForPromotionRules
 * @param {Array<{ menuItemId: number, categoryId?: number, qty?: number, totalPrice?: number }>} cartItems
 * @param {object} promo
 */
function computeFixedPriceBundleDiscount(cartItems, promo) {
    const fixedRewards = (promo.rewards || []).filter((r) => r.reward_type === 'fixed_price');
    if (fixedRewards.length === 0) return 0;
    const rules = promo.progress?.rules || [];
    if (rules.length === 0) return 0;
    const times = promo.progress?.times_qualified || 1;
    const remain = cartItems.map((it) => it.qty || 1);
    let allocated = 0;
    for (const rule of rules) {
        const catId = Number(rule.category_id);
        const need = Number(rule.required) * times;
        let needLeft = need;
        for (let idx = 0; idx < cartItems.length && needLeft > 0; idx += 1) {
            const item = cartItems[idx];
            const itemCat = Number(item.categoryId);
            if (itemCat !== catId) continue;
            const avail = remain[idx];
            if (!avail) continue;
            const take = Math.min(needLeft, avail);
            const lineTotal = Number(item.totalPrice) || 0;
            const q = item.qty || 1;
            allocated += (lineTotal / q) * take;
            remain[idx] -= take;
            needLeft -= take;
        }
    }
    let target = 0;
    for (const fr of fixedRewards) {
        target += parseFloat(fr.reward_value) * times;
    }
    return Math.max(0, Math.round((allocated - target) * 100) / 100);
}

/**
 * חישוב תצוגת הנחת מבצעים בצד הלקוח (השרת מחשב סופית ב-checkout).
 * @param {number} cartTotal
 * @param {Array<{ menuItemId: number, categoryId?: number, qty?: number, totalPrice?: number }>} cartItems
 * @param {Array<object>} metPromotions
 * @param {Array<object>} [menuCategories] — כדי להשלים category_id לפי menu_item_id
 */
export function computeClientPromotionDiscount(cartTotal, cartItems, metPromotions, menuCategories = null) {
    if (!metPromotions?.length) return 0;
    const items = menuCategories ? resolveCartItemsForPromoCalc(cartItems, menuCategories) : cartItems;
    let sum = 0;
    for (const promo of metPromotions) {
        const times = promo.progress?.times_qualified || 1;
        for (const reward of promo.rewards || []) {
            if (reward.reward_type === 'discount_percent') {
                const scope = reward.discount_scope || 'whole_cart';
                const ids = reward.discount_menu_item_ids || [];
                let itemsTotal = cartTotal;
                if (scope === 'selected_items' && ids.length > 0) {
                    const idSet = new Set(ids.map(Number));
                    itemsTotal = items.reduce((acc, item) => {
                        if (idSet.has(Number(item.menuItemId))) return acc + (Number(item.totalPrice) || 0);
                        return acc;
                    }, 0);
                }
                sum += Math.round(itemsTotal * (parseFloat(reward.reward_value) / 100) * 100) / 100 * times;
            } else if (reward.reward_type === 'discount_fixed') {
                const scope = reward.discount_scope || 'whole_cart';
                const ids = reward.discount_menu_item_ids || [];
                if (scope === 'selected_items' && ids.length > 0) {
                    const idSet = new Set(ids.map(Number));
                    let perApplication = 0;
                    for (const item of items) {
                        if (!idSet.has(Number(item.menuItemId))) continue;
                        const qty = item.qty || 1;
                        const lineTotal = Number(item.totalPrice) || 0;
                        const perUnit = parseFloat(reward.reward_value) || 0;
                        perApplication += Math.min(perUnit * qty, lineTotal);
                    }
                    sum += Math.round(perApplication * times * 100) / 100;
                } else {
                    sum += parseFloat(reward.reward_value) * times;
                }
            }
        }
        sum += computeFixedPriceBundleDiscount(items, promo);
    }
    return Math.round(sum * 100) / 100;
}
