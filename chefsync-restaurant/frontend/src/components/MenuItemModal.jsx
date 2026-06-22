import React, { useEffect, useMemo, useState } from 'react';
import { FaBoxOpen, FaCheck } from 'react-icons/fa';
import { calculateUnitPrice, normalizeVariant, normalizeAddon, getVariantSectionTitle } from '../utils/cart';
import { resolveAssetUrl } from '../utils/assets';

const clampQty = (value) => Math.max(1, Math.round(Number(value) || 1));

export default function MenuItemModal({
    item,
    isOpen,
    onClose,
    onAdd,
    isOrderingEnabled = true,
}) {
    const variants = item?.variants || [];
    const addonGroups = item?.addon_groups || [];
    const basePrice = item?.price ?? 0;

    const defaultVariantId = useMemo(() => {
        if (!variants.length) {
            return null;
        }
        const preferred = variants.find((variant) => variant.is_default);
        return preferred?.id ?? variants[0].id;
    }, [item?.id]);

    const defaultAddonState = useMemo(() => {
        const initialState = {};
        addonGroups.forEach((group) => {
            initialState[group.id] = (group.addons || [])
                .filter((addon) => addon.is_default)
                .map((addon) => addon.id);
        });
        return initialState;
    }, [item?.id]);

    const [selectedVariantId, setSelectedVariantId] = useState(defaultVariantId);
    const [selectedAddons, setSelectedAddons] = useState(defaultAddonState);
    const [addonOnSide, setAddonOnSide] = useState({}); // { addonId: true/false }
    const [addonPlacement, setAddonPlacement] = useState({}); // { addonId: 'whole'|'right'|'left' }
    const [addonQuantities, setAddonQuantities] = useState({}); // { addonId: quantity }
    const [itemNote, setItemNote] = useState('');
    const [qty, setQty] = useState(1);

    useEffect(() => {
        setSelectedVariantId(defaultVariantId);
        setSelectedAddons(defaultAddonState);
        setAddonOnSide({});
        setAddonPlacement({});
        setAddonQuantities({});
        setItemNote('');
        setQty(1);
    }, [defaultVariantId, defaultAddonState, item?.id]);

    // נעילת גלילת העמוד ברקע כשהמודל פתוח
    useEffect(() => {
        if (!isOpen) return undefined;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prevOverflow;
        };
    }, [isOpen]);

    if (!isOpen || !item) {
        return null;
    }

    const selectedVariant = variants.find((variant) => variant.id === selectedVariantId) || null;
    const normalizedVariant = normalizeVariant(selectedVariant);

    const selectedAddonObjects = addonGroups.flatMap((group) => {
        const selectedIds = selectedAddons[group.id] || [];
        return (group.addons || [])
            .filter((addon) => selectedIds.includes(addon.id))
            .map((addon) => ({ addon, group }));
    });
    const normalizedAddons = selectedAddonObjects.map(({ addon, group }) => ({
        ...normalizeAddon(addon),
        on_side: addonOnSide[addon.id] || false,
        placement: group.allow_half_placement ? (addonPlacement[addon.id] || 'whole') : undefined,
        quantity: addonQuantities[addon.id] || 1,
        addon_group_id: group.id,
        first_addon_unit_free: Boolean(group.first_addon_unit_free),
    }));

    const unitPrice = calculateUnitPrice(basePrice, normalizedVariant, normalizedAddons);

    const getGroupSelection = (groupId) => selectedAddons[groupId] || [];

    const getGroupDisplayTitle = (group) => {
        if (group?.display_name) {
            return group.display_name;
        }
        const rawName = (group?.name || '').toString();
        const normalizedName = rawName.trim();
        if (!normalizedName) {
            return 'בחרו תוספות';
        }
        if (normalizedName.includes('סלט')) {
            return 'בחרו סלטים';
        }
        if (normalizedName.includes('רוטב')) {
            return 'בחרו רטבים';
        }
        if (normalizedName.includes('לחם') || normalizedName.includes('פיתה')) {
            return 'בחרו לחם';
        }
        if (normalizedName.includes('שתייה') || normalizedName.includes('משקה')) {
            return 'בחרו שתייה';
        }
        if (normalizedName.includes('לחם') && normalizedName.includes('סלטים')) {
            return 'בחרו לחם וסלטים';
        }
        if (normalizedName.includes('שיפוד') || normalizedName.includes('בשר')) {
            return 'בחרו ממגוון הבשרים';
        }
        if (normalizedName.includes('תוספת') || normalizedName.includes('תוספות')) {
            return 'בחרו תוספות';
        }
        return normalizedName;
    };

    const getGroupHintLabel = (group) => {
        const selected = getGroupSelection(group.id);
        const weightedCount = selected.reduce((sum, addonId) => {
            const addon = group.addons?.find(a => a.id === addonId);
            const weight = addon?.selection_weight || 1;
            const addonQty = addonQuantities[addonId] || 1;
            return sum + (weight * addonQty);
        }, 0);

        const minRequired = group.min_select ?? (group.is_required ? 1 : 0);
        const maxAllowed = group.max_select || (group.selection_type === 'single' ? 1 : null);

        if (minRequired && weightedCount < minRequired) {
            const missing = minRequired - weightedCount;
            return missing === 1 ? 'יש לבחור פריט אחד לפחות' : `יש לבחור לפחות ${missing} פריטים`;
        }
        if (maxAllowed) {
            const remaining = maxAllowed - weightedCount;
            if (remaining <= 0) return 'נבחר המקסימום';
            return remaining === 1 ? 'אפשר לבחור עוד פריט אחד' : `אפשר לבחור עד ${remaining} פריטים נוספים`;
        }
        return 'בחירה חופשית';
    };

    const getGroupSelectionLabel = (group, selectionCount) => {
        const maxAllowed = group.max_select || (group.selection_type === 'single' ? 1 : null);

        // Calculate weighted selection count (quantity * weight)
        const selected = getGroupSelection(group.id);
        const weightedCount = selected.reduce((sum, addonId) => {
            const addon = group.addons?.find(a => a.id === addonId);
            const weight = addon?.selection_weight || 1;
            const addonQty = addonQuantities[addonId] || 1;
            return sum + (weight * addonQty);
        }, 0);

        if (maxAllowed) {
            return `נבחרו ${weightedCount} מתוך ${maxAllowed}`;
        }
        return `נבחרו ${weightedCount}`;
    };

    const computeGroupError = (group) => {
        const selected = getGroupSelection(group.id);
        const minRequired = group.min_select ?? (group.is_required ? 1 : 0);

        // Calculate weighted selection count (quantity * weight)
        const weightedCount = selected.reduce((sum, addonId) => {
            const addon = group.addons?.find(a => a.id === addonId);
            const weight = addon?.selection_weight || 1;
            const addonQty = addonQuantities[addonId] || 1;
            return sum + (weight * addonQty);
        }, 0);

        if (minRequired && weightedCount < minRequired) {
            return `בחר לפחות ${minRequired}`;
        }
        const maxAllowed = group.max_select || (group.selection_type === 'single' ? 1 : null);
        if (maxAllowed && weightedCount > maxAllowed) {
            return `ניתן לבחור עד ${maxAllowed}`;
        }
        return '';
    };

    const toggleAddon = (group, addonId) => {
        setSelectedAddons((prev) => {
            const current = prev[group.id] || [];
            const isSelected = current.includes(addonId);
            let nextSelection;

            if (isSelected) {
                nextSelection = current.filter((id) => id !== addonId);
                // Reset quantity when deselecting
                setAddonQuantities(q => { const next = { ...q }; delete next[addonId]; return next; });
            } else {
                const maxAllowed = group.max_select || (group.selection_type === 'single' ? 1 : null);

                // Calculate current weighted count (factoring quantity)
                const currentWeightedCount = current.reduce((sum, id) => {
                    const addon = group.addons?.find(a => a.id === id);
                    const weight = addon?.selection_weight || 1;
                    const addonQty = addonQuantities[id] || 1;
                    return sum + (weight * addonQty);
                }, 0);

                // Get weight of addon being added
                const addonToAdd = group.addons?.find(a => a.id === addonId);
                const addonWeight = addonToAdd?.selection_weight || 1;

                if (maxAllowed && (currentWeightedCount + addonWeight) > maxAllowed) {
                    // בקבוצת בחירה יחידה (או מקסימום 1) — לחיצה על אופציה אחרת מחליפה את הבחירה
                    if (group.selection_type === 'single' || maxAllowed === 1) {
                        nextSelection = [addonId];
                    } else {
                        nextSelection = current;
                    }
                } else {
                    nextSelection = group.selection_type === 'single' ? [addonId] : [...current, addonId];
                }
            }

            return {
                ...prev,
                [group.id]: nextSelection,
            };
        });
    };

    const isAddonDisabled = (group, addonId) => {
        const current = getGroupSelection(group.id);
        const isSelected = current.includes(addonId);
        if (isSelected) {
            return false;
        }
        const maxAllowed = group.max_select || (group.selection_type === 'single' ? 1 : null);
        if (!maxAllowed) {
            return false;
        }
        // בחירה יחידה / מקסימום 1 — תמיד אפשר להחליף בחירה, לא נועלים את שאר האופציות
        if (group.selection_type === 'single' || maxAllowed === 1) {
            return false;
        }

        // Calculate current weighted count (factoring quantity)
        const currentWeightedCount = current.reduce((sum, id) => {
            const addon = group.addons?.find(a => a.id === id);
            const weight = addon?.selection_weight || 1;
            const addonQty = addonQuantities[id] || 1;
            return sum + (weight * addonQty);
        }, 0);

        // Get weight of addon being checked
        const addonToCheck = group.addons?.find(a => a.id === addonId);
        const addonWeight = addonToCheck?.selection_weight || 1;

        return (currentWeightedCount + addonWeight) > maxAllowed;
    };

    const hasGroupViolations = addonGroups.some((group) => computeGroupError(group));
    const canSubmit = isOrderingEnabled && !hasGroupViolations && qty >= 1;

    const handleAdd = () => {
        if (!canSubmit) {
            return;
        }

        // Get the current tenant/restaurant ID and name
        const currentRestaurantId = localStorage.getItem('tenantId');
        const currentRestaurantName = localStorage.getItem(`restaurant_name_${currentRestaurantId}`);

        onAdd({
            menuItemId: item.id,
            name: item.name,
            basePrice,
            variant: normalizedVariant || undefined,
            addons: normalizedAddons,
            notes: item.allow_item_note && itemNote.trim() ? itemNote.trim() : undefined,
            qty,
            imageUrl: item.image_url,
            categoryId: item.category_id,
            restaurantId: currentRestaurantId,
            restaurantName: currentRestaurantName,
        });
        onClose();
    };

    return (
        <div
            className="fixed inset-0 z-[90] flex items-start md:items-center justify-center bg-black/50 backdrop-blur-md px-4 py-6 overflow-hidden"
            onClick={onClose}
        >
            <div
                className="w-full max-w-2xl bg-white dark:bg-brand-dark-surface rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {item.image_url && (
                    <div className="relative h-56 sm:h-64 bg-gray-50/50 dark:bg-brand-dark-bg flex-shrink-0 w-full overflow-hidden flex items-center justify-center">
                        {(item?.category_name?.includes('שתיי') || item?.category_name?.includes('שתיה') || item?.category_name?.includes('משק')) ? (
                            <>
                                {/* תמונת רקע מטושטשת במיוחד לקטגוריית "שתייה" */}
                                <div
                                    className="absolute inset-0 bg-cover bg-center blur-xl opacity-40 dark:opacity-20 scale-110"
                                    style={{ backgroundImage: `url(${resolveAssetUrl(item.image_url)})` }}
                                />
                                <img
                                    src={resolveAssetUrl(item.image_url)}
                                    alt={item.name}
                                    className="relative z-10 w-full h-full object-contain drop-shadow-sm px-3 sm:px-4"
                                />
                            </>
                        ) : (
                            /* התצוגה המקורית של הפריט (לא שתייה) - חתוכה על כל המודל בצורה חלקה */
                            <img
                                src={resolveAssetUrl(item.image_url)}
                                alt={item.name}
                                className="w-full h-full object-cover"
                            />
                        )}
                        <button
                            className="absolute top-3 right-3 z-20 bg-black/70 dark:bg-black/60 backdrop-blur-md text-white w-10 h-10 rounded-full flex items-center justify-center shadow-sm hover:scale-105 transition-transform"
                            onClick={onClose}
                            aria-label="סגור"
                        >
                            ×
                        </button>
                    </div>
                )}
                {!item.image_url && (
                    <div className="flex justify-end p-4 flex-shrink-0">
                        <button className="text-2xl text-gray-500" onClick={onClose} aria-label="סגור">×</button>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto overscroll-contain px-6 pb-6 space-y-4">
                    <div>
                        <h2 className="text-2xl font-bold text-brand-dark dark:text-brand-dark-text mb-1.5">{item.name}</h2>
                        <div className="flex items-center gap-2.5 mb-2">
                            <span className="text-xl font-black text-brand-primary">₪{Number(basePrice).toFixed(2)}</span>
                            {item.tag && (
                                <span className="bg-brand-primary/10 text-brand-primary text-xs font-bold px-2.5 py-1 rounded-full">
                                    {item.tag}
                                </span>
                            )}
                        </div>
                        {item.description && (
                            <p className="text-gray-600 dark:text-brand-dark-muted leading-relaxed">{item.description}</p>
                        )}
                    </div>

                    {variants.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-brand-dark dark:text-brand-dark-text">{getVariantSectionTitle(item.dish_type)}</h3>
                                <span className="text-sm text-gray-500">חובה לבחור אפשרות אחת</span>
                            </div>
                            <div className="space-y-0.5">
                                {variants.map((variant) => (
                                    <label
                                        key={variant.id}
                                        className="flex items-center justify-between rounded-lg px-2 py-2 cursor-pointer transition"
                                    >
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="radio"
                                                name="variant"
                                                checked={selectedVariantId === variant.id}
                                                onChange={() => setSelectedVariantId(variant.id)}
                                                className="sr-only"
                                            />
                                            <span className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors ${selectedVariantId === variant.id ? 'bg-brand-primary' : 'bg-gray-100 dark:bg-brand-dark-border'}`}>
                                                {selectedVariantId === variant.id && <FaCheck className="text-white text-[10px]" />}
                                            </span>
                                            <p className="font-semibold text-brand-dark dark:text-brand-dark-text">{variant.name}</p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {selectedVariantId === variant.id && (
                                                <span className="text-brand-primary text-sm font-bold">נבחר</span>
                                            )}
                                            {variant.price_delta !== 0 && (
                                                <span className="text-sm font-semibold text-gray-500">{variant.price_delta > 0 ? `+₪${variant.price_delta}` : `₪${variant.price_delta}`}</span>
                                            )}
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {addonGroups.length > 0 && (
                        <div className="space-y-4">
                            {addonGroups.map((group) => {
                                const selection = getGroupSelection(group.id);
                                return (
                                    <div key={group.id}>
                                        <div className="flex items-center justify-between mb-2">
                                            <div>
                                                <h4 className="text-lg font-semibold text-brand-dark dark:text-brand-dark-text">{getGroupDisplayTitle(group)}</h4>
                                                <p className="text-xs text-gray-500 mt-1">{getGroupHintLabel(group)}</p>
                                            </div>
                                            <span className="text-xs text-gray-500">{getGroupSelectionLabel(group, selection.length)}</span>
                                        </div>
                                        <div className="space-y-0.5">
                                            {(group.addons || []).map((addon) => (
                                                <div key={addon.id} className="space-y-1">
                                                    <label
                                                        className={`flex items-center justify-between rounded-lg px-2 py-1.5 transition ${isAddonDisabled(group, addon.id) ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <input
                                                                type={group.selection_type === 'single' ? 'radio' : 'checkbox'}
                                                                name={`addon-group-${group.id}`}
                                                                checked={selection.includes(addon.id)}
                                                                onChange={() => toggleAddon(group, addon.id)}
                                                                disabled={isAddonDisabled(group, addon.id)}
                                                                className="sr-only"
                                                            />
                                                            <span className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors ${selection.includes(addon.id) ? 'bg-brand-primary' : 'bg-gray-100 dark:bg-brand-dark-border'}`}>
                                                                {selection.includes(addon.id) && <FaCheck className="text-white text-[10px]" />}
                                                            </span>
                                                            <p className="font-medium text-brand-dark dark:text-brand-dark-text">{addon.name}</p>
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            {addon.price_delta !== 0 && (
                                                                <span className="text-sm font-semibold text-gray-500">
                                                                    {addon.price_delta > 0 ? `+₪${addon.price_delta}` : `₪${addon.price_delta}`}
                                                                    {(addonQuantities[addon.id] || 1) > 1 && ` × ${addonQuantities[addon.id]}`}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </label>
                                                    {/* Quantity selector for addons with max_quantity > 1 */}
                                                    {(addon.max_quantity || 1) > 1 && selection.includes(addon.id) && (
                                                        <div className="flex items-center gap-2 px-4 py-1.5 mr-8" onClick={(e) => e.stopPropagation()}>
                                                            <span className="text-sm text-gray-500 font-medium">כמות:</span>
                                                            <div className="flex items-center bg-gray-100 dark:bg-brand-dark-border rounded-full overflow-hidden">
                                                                <button
                                                                    type="button"
                                                                    className="px-3 py-1 text-sm hover:bg-gray-100 dark:hover:bg-brand-dark-border transition"
                                                                    onClick={() => {
                                                                        const currentQty = addonQuantities[addon.id] || 1;
                                                                        if (currentQty <= 1) return;
                                                                        setAddonQuantities(prev => ({ ...prev, [addon.id]: currentQty - 1 }));
                                                                    }}
                                                                    disabled={(addonQuantities[addon.id] || 1) <= 1}
                                                                >
                                                                    −
                                                                </button>
                                                                <span className="px-3 font-semibold text-sm text-brand-dark dark:text-brand-dark-text min-w-[28px] text-center">
                                                                    {addonQuantities[addon.id] || 1}
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    className="px-3 py-1 text-sm hover:bg-gray-100 dark:hover:bg-brand-dark-border transition"
                                                                    onClick={() => {
                                                                        const currentQty = addonQuantities[addon.id] || 1;
                                                                        const maxQty = addon.max_quantity || 1;
                                                                        // Check group max constraint
                                                                        const maxAllowed = group.max_select || (group.selection_type === 'single' ? 1 : null);
                                                                        if (maxAllowed) {
                                                                            const currentGroupSelected = (getGroupSelection(group.id) || []);
                                                                            const currentWeightedTotal = currentGroupSelected.reduce((sum, id) => {
                                                                                const a = group.addons?.find(x => x.id === id);
                                                                                const w = a?.selection_weight || 1;
                                                                                const q = addonQuantities[id] || 1;
                                                                                return sum + (w * q);
                                                                            }, 0);
                                                                            const addonWeight = addon.selection_weight || 1;
                                                                            if (currentWeightedTotal + addonWeight > maxAllowed) return;
                                                                        }
                                                                        if (currentQty >= maxQty) return;
                                                                        setAddonQuantities(prev => ({ ...prev, [addon.id]: currentQty + 1 }));
                                                                    }}
                                                                    disabled={(addonQuantities[addon.id] || 1) >= (addon.max_quantity || 1)}
                                                                >
                                                                    +
                                                                </button>
                                                            </div>
                                                            <span className="text-xs text-gray-400">מתוך {addon.max_quantity}</span>
                                                        </div>
                                                    )}
                                                    {group.placement === 'side' && selection.includes(addon.id) && (
                                                        <label
                                                            className="flex items-center gap-2 px-4 py-1.5 mr-8 cursor-pointer text-sm"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={addonOnSide[addon.id] || false}
                                                                onChange={(e) => {
                                                                    e.stopPropagation();
                                                                    setAddonOnSide(prev => ({
                                                                        ...prev,
                                                                        [addon.id]: !prev[addon.id]
                                                                    }));
                                                                }}
                                                                className="w-4 h-4"
                                                            />
                                                            <FaBoxOpen className="text-orange-600" />
                                                            <span className="text-gray-600 font-medium">בצד</span>
                                                        </label>
                                                    )}
                                                    {group.allow_half_placement && selection.includes(addon.id) && (
                                                        <div
                                                            className="flex gap-1 mt-1 mr-8"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            {[['whole', 'שלם'], ['right', 'חצי ימין'], ['left', 'חצי שמאל']].map(([p, label]) => (
                                                                <button
                                                                    key={p}
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setAddonPlacement(prev => ({ ...prev, [addon.id]: p }));
                                                                    }}
                                                                    className={`text-xs px-2 py-1 rounded-full transition-all ${(addonPlacement[addon.id] || 'whole') === p
                                                                        ? 'bg-orange-500 text-white'
                                                                        : 'bg-gray-100 text-gray-600 hover:bg-orange-100'
                                                                        }`}
                                                                >
                                                                    {label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {item.allow_item_note && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-brand-dark dark:text-brand-dark-text">הערה למנה</h3>
                                <span className="text-xs text-gray-500">{itemNote.length}/20</span>
                            </div>
                            <input
                                type="text"
                                value={itemNote}
                                maxLength={20}
                                onChange={(e) => setItemNote(e.target.value)}
                                placeholder="למשל: בלי בצל, רוטב בצד..."
                                className="w-full rounded-xl border border-gray-200 dark:border-brand-dark-border bg-gray-50 dark:bg-brand-dark-bg px-4 py-3 text-sm text-brand-dark dark:text-brand-dark-text placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                            />
                        </div>
                    )}

                </div>

                {/* כמות + הוסף לסל — קבועים בתחתית המודל */}
                <div className="flex-shrink-0 px-4 sm:px-6 py-3 sm:py-4 bg-white dark:bg-brand-dark-surface shadow-[0_-6px_20px_rgba(0,0,0,0.07)] space-y-3">
                    {!isOrderingEnabled && (
                        <div className="bg-yellow-50 dark:bg-yellow-500/10 text-yellow-900 dark:text-yellow-300 px-4 py-2.5 rounded-2xl text-sm">
                            המסעדה סגורה כרגע. ניתן לעיין במנה אך לא ניתן להזמין.
                        </div>
                    )}
                    <div className="flex items-center gap-3">
                        <div className="flex items-center bg-gray-100 dark:bg-brand-dark-border rounded-full overflow-hidden shrink-0">
                            <button
                                type="button"
                                className="px-4 py-2.5 text-xl hover:bg-gray-200 dark:hover:bg-brand-dark-bg transition-colors active:bg-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"
                                onClick={() => setQty((prev) => clampQty(prev - 1))}
                                disabled={qty <= 1}
                            >
                                −
                            </button>
                            <span className="px-2 font-bold text-lg text-brand-dark dark:text-brand-dark-text min-w-[2.25rem] text-center">{qty}</span>
                            <button
                                type="button"
                                className="px-4 py-2.5 text-xl hover:bg-gray-200 dark:hover:bg-brand-dark-bg transition-colors active:bg-gray-300"
                                onClick={() => setQty((prev) => clampQty(prev + 1))}
                            >
                                +
                            </button>
                        </div>
                        <button
                            type="button"
                            onClick={handleAdd}
                            disabled={!canSubmit}
                            className={`flex-1 py-3.5 rounded-[1.25rem] font-bold text-[1.05rem] tracking-wide flex items-center justify-center gap-2 transition-all duration-300 ${canSubmit ? 'bg-brand-primary text-white hover:bg-brand-secondary shadow-md hover:shadow-lg active:scale-[0.98]' : 'bg-gray-200 dark:bg-brand-dark-border text-gray-500 dark:text-gray-400 cursor-not-allowed'}`}
                        >
                            הוסף לסל · ₪{(unitPrice * qty).toFixed(2)}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
