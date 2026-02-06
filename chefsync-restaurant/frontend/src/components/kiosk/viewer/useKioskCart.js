import { useState, useCallback } from 'react';
import { buildCartKey, calculateUnitPrice } from '../../../utils/cart';

export default function useKioskCart() {
    const [items, setItems] = useState([]);

    const addItem = useCallback((menuItem, variant, addons, qty) => {
        const cartKey = buildCartKey(menuItem.id, variant, addons);
        const unitPrice = calculateUnitPrice(menuItem.price, variant, addons);

        setItems(prev => {
            const existingIndex = prev.findIndex(item => item.cartKey === cartKey);
            if (existingIndex >= 0) {
                const updated = [...prev];
                updated[existingIndex] = {
                    ...updated[existingIndex],
                    qty: updated[existingIndex].qty + qty,
                    totalPrice: Number(((updated[existingIndex].qty + qty) * unitPrice).toFixed(2)),
                };
                return updated;
            }

            return [...prev, {
                cartKey,
                menuItemId: menuItem.id,
                name: menuItem.name,
                basePrice: menuItem.price,
                variant: variant ? { id: variant.id, name: variant.name, price_delta: variant.price_delta } : null,
                addons: addons.map(a => ({ id: a.id, name: a.name, price_delta: a.price_delta, on_side: a.on_side || false })),
                qty,
                unitPrice,
                totalPrice: Number((unitPrice * qty).toFixed(2)),
                imageUrl: menuItem.image_url,
            }];
        });
    }, []);

    const removeItem = useCallback((cartKey) => {
        setItems(prev => prev.filter(item => item.cartKey !== cartKey));
    }, []);

    const updateQty = useCallback((cartKey, newQty) => {
        if (newQty < 1) {
            setItems(prev => prev.filter(item => item.cartKey !== cartKey));
            return;
        }
        setItems(prev => prev.map(item =>
            item.cartKey === cartKey
                ? { ...item, qty: newQty, totalPrice: Number((item.unitPrice * newQty).toFixed(2)) }
                : item
        ));
    }, []);

    const clearCart = useCallback(() => {
        setItems([]);
    }, []);

    const totalItems = items.reduce((sum, item) => sum + item.qty, 0);
    const totalPrice = Number(items.reduce((sum, item) => sum + item.totalPrice, 0).toFixed(2));

    // Build API payload from cart items
    const toOrderPayload = useCallback((customerName, orderType, tableNumber) => {
        return {
            customer_name: customerName || undefined,
            order_type: orderType || 'takeaway',
            table_number: tableNumber || undefined,
            items: items.map(item => ({
                menu_item_id: item.menuItemId,
                variant_id: item.variant?.id || null,
                addons: item.addons.map(a => ({
                    addon_id: a.id,
                    on_side: a.on_side || false,
                })),
                qty: item.qty,
            })),
        };
    }, [items]);

    return {
        items,
        addItem,
        removeItem,
        updateQty,
        clearCart,
        totalItems,
        totalPrice,
        toOrderPayload,
    };
}
