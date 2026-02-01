import React, { useEffect, useMemo, useState } from 'react';
import { FaBoxOpen } from 'react-icons/fa';
import { calculateUnitPrice, normalizeVariant, normalizeAddon } from '../utils/cart';
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
    const [qty, setQty] = useState(1);

    useEffect(() => {
        setSelectedVariantId(defaultVariantId);
        setSelectedAddons(defaultAddonState);
        setAddonOnSide({});
        setQty(1);
    }, [defaultVariantId, defaultAddonState, item?.id]);

    if (!isOpen || !item) {
        return null;
    }

    const selectedVariant = variants.find((variant) => variant.id === selectedVariantId) || null;
    const normalizedVariant = normalizeVariant(selectedVariant);

    const selectedAddonObjects = addonGroups.flatMap((group) => {
        const selectedIds = selectedAddons[group.id] || [];
        return (group.addons || []).filter((addon) => selectedIds.includes(addon.id));
    });
    const normalizedAddons = selectedAddonObjects.map(addon => ({
        ...normalizeAddon(addon),
        on_side: addonOnSide[addon.id] || false,
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
        if (normalizedName.includes('שתייה') || normalizedName.includes('משקה')) {
            return 'בחרו שתייה';
        }
        if (normalizedName.includes('תוספת') || normalizedName.includes('תוספות')) {
            return 'בחרו תוספות';
        }
        return normalizedName;
    };

    const getGroupSelectionLabel = (group, selectionCount) => {
        const maxAllowed = group.max_select || (group.selection_type === 'single' ? 1 : null);
        if (maxAllowed) {
            return `נבחרו ${selectionCount} מתוך ${maxAllowed}`;
        }
        return `נבחרו ${selectionCount}`;
    };

    const computeGroupError = (group) => {
        const selected = getGroupSelection(group.id);
        const minRequired = group.min_select ?? (group.is_required ? 1 : 0);
        if (minRequired && selected.length < minRequired) {
            return `בחר לפחות ${minRequired}`;
        }
        const maxAllowed = group.max_select || (group.selection_type === 'single' ? 1 : null);
        if (maxAllowed && selected.length > maxAllowed) {
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
            } else {
                const maxAllowed = group.max_select || (group.selection_type === 'single' ? 1 : null);
                if (maxAllowed && current.length >= maxAllowed) {
                    nextSelection = maxAllowed === 1 ? [addonId] : current;
                } else {
                    nextSelection = [...current, addonId];
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
        return current.length >= maxAllowed;
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
            qty,
            imageUrl: item.image_url,
            restaurantId: currentRestaurantId,
            restaurantName: currentRestaurantName,
        });
        onClose();
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-start md:items-center justify-center bg-black/40 px-4 py-6 overflow-y-auto"
            onClick={onClose}
        >
            <div
                className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {item.image_url && (
                    <div className="relative h-56 bg-gray-100 flex-shrink-0">
                        <img
                            src={resolveAssetUrl(item.image_url)}
                            alt={item.name}
                            className="w-full h-full object-cover"
                        />
                        <button
                            className="absolute top-3 right-3 bg-black/70 text-white w-10 h-10 rounded-full"
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

                <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-6">
                    <div>
                        <h2 className="text-2xl font-bold text-brand-dark mb-2">{item.name}</h2>
                        {item.description && (
                            <p className="text-gray-600 leading-relaxed">{item.description}</p>
                        )}
                    </div>

                    {variants.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-brand-dark">בחרו צורת הגשה</h3>
                                <span className="text-sm text-gray-500">חובה לבחור אפשרות אחת</span>
                            </div>
                            <div className="space-y-2">
                                {variants.map((variant) => (
                                    <label
                                        key={variant.id}
                                        className={`flex items-center justify-between border rounded-2xl px-4 py-3 cursor-pointer transition ${selectedVariantId === variant.id ? 'border-brand-primary bg-brand-primary/5' : 'border-gray-200 hover:border-brand-primary/40'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="radio"
                                                name="variant"
                                                checked={selectedVariantId === variant.id}
                                                onChange={() => setSelectedVariantId(variant.id)}
                                            />
                                            <div>
                                                <p className="font-semibold text-brand-dark">{variant.name}</p>
                                                {variant.price_delta !== 0 && (
                                                    <p className="text-sm text-gray-500">{variant.price_delta > 0 ? `+₪${variant.price_delta}` : `₪${variant.price_delta}`}</p>
                                                )}
                                            </div>
                                        </div>
                                        {selectedVariantId === variant.id && (
                                            <span className="text-brand-primary text-sm font-bold">נבחר</span>
                                        )}
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {addonGroups.length > 0 && (
                        <div className="space-y-6">
                            {addonGroups.map((group) => {
                                const groupError = computeGroupError(group);
                                const selection = getGroupSelection(group.id);
                                return (
                                    <div key={group.id} className="border border-gray-200 rounded-2xl p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <div>
                                                <h4 className="text-lg font-semibold text-brand-dark">{getGroupDisplayTitle(group)}</h4>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    {group.min_select ? `מינימום ${group.min_select}` : ''}
                                                    {group.min_select && group.max_select ? ' · ' : ''}
                                                    {group.max_select ? `מקסימום ${group.max_select}` : ''}
                                                    {!group.min_select && !group.max_select && group.is_required ? 'חובה לבחור אחת' : ''}
                                                </p>
                                            </div>
                                            <span className="text-xs text-gray-500">{getGroupSelectionLabel(group, selection.length)}</span>
                                        </div>
                                        <div className="space-y-2">
                                            {(group.addons || []).map((addon) => (
                                                <div key={addon.id} className="space-y-1">
                                                    <label
                                                        className={`flex items-center justify-between border rounded-xl px-3 py-2 cursor-pointer transition ${selection.includes(addon.id) ? 'border-brand-primary bg-brand-primary/5' : 'border-gray-200 hover:border-brand-primary/40'}`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <input
                                                                type={group.selection_type === 'single' ? 'radio' : 'checkbox'}
                                                                name={`addon-group-${group.id}`}
                                                                checked={selection.includes(addon.id)}
                                                                onChange={() => toggleAddon(group, addon.id)}
                                                                disabled={isAddonDisabled(group, addon.id)}
                                                            />
                                                            <div>
                                                                <p className="font-medium text-brand-dark">{addon.name}</p>
                                                                {addon.price_delta !== 0 && (
                                                                    <p className="text-sm text-gray-500">{addon.price_delta > 0 ? `+₪${addon.price_delta}` : `₪${addon.price_delta}`}</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {isAddonDisabled(group, addon.id) && !selection.includes(addon.id) && (
                                                            <span className="text-xs text-gray-400">מקסימום הושג</span>
                                                        )}
                                                    </label>
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
                                                </div>
                                            ))}
                                        </div>
                                        {groupError && (
                                            <p className="text-xs text-red-600 mt-2">{groupError}</p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-gray-500">כמות</span>
                            <div className="flex items-center border rounded-full overflow-hidden">
                                <button
                                    type="button"
                                    className="px-4 py-2 text-lg"
                                    onClick={() => setQty((prev) => clampQty(prev - 1))}
                                    disabled={qty <= 1}
                                >
                                    −
                                </button>
                                <span className="px-5 font-semibold text-brand-dark">{qty}</span>
                                <button
                                    type="button"
                                    className="px-4 py-2 text-lg"
                                    onClick={() => setQty((prev) => clampQty(prev + 1))}
                                >
                                    +
                                </button>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-gray-500">מחיר ליחידה</p>
                            <p className="text-2xl font-bold text-brand-primary">₪{unitPrice.toFixed(2)}</p>
                        </div>
                    </div>

                    {!isOrderingEnabled && (
                        <div className="bg-yellow-50 border border-yellow-200 text-yellow-900 px-4 py-3 rounded-2xl text-sm">
                            המסעדה סגורה כרגע. ניתן לעיין במנה אך לא ניתן להזמין.
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={handleAdd}
                        disabled={!canSubmit}
                        className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 ${canSubmit ? 'bg-brand-primary text-white hover:bg-brand-secondary transition' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
                    >
                        הוסף לסל · ₪{(unitPrice * qty).toFixed(2)}
                    </button>
                </div>
            </div>
        </div>
    );
}
