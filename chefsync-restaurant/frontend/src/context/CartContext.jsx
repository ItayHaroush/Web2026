import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useToast } from './ToastContext';
import { normalizeCartItem, normalizeCartItems } from '../utils/cart';
import ConfirmationModal from '../components/ConfirmationModal';

/**
 * Context להנהלת סל קניות
 * מאחסן פריטים עם כמות וחישוב סכום כללי
 */

const CartContext = createContext();

const CART_EXPIRY_HOURS = 24; // סל תקף ל-24 שעות

const createEmptyCustomerInfo = () => ({
    name: '',
    phone: '',
    delivery_method: 'pickup',
    payment_method: 'cash',
    delivery_address: '',
    delivery_notes: '',
});

export function CartProvider({ children }) {
    const { addToast } = useToast();
    const [currentTenantId, setCurrentTenantId] = useState(null);
    const [phoneVerified, setPhoneVerified] = useState(false);

    // State for Confirmation Modal
    const [pendingItem, setPendingItem] = useState(null);
    const [confirmationModal, setConfirmationModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        newRestaurantName: '',
        oldRestaurantName: ''
    });

    const [cartItems, setCartItems] = useState(() => {
        const tenantId = localStorage.getItem('tenantId');
        if (!tenantId) return [];

        const savedCart = localStorage.getItem(`cart_${tenantId}`);
        const savedTimestamp = localStorage.getItem(`cart_timestamp_${tenantId}`);

        if (savedCart && savedTimestamp) {
            const hoursSinceLastUpdate = (Date.now() - parseInt(savedTimestamp, 10)) / (1000 * 60 * 60);
            if (hoursSinceLastUpdate < CART_EXPIRY_HOURS) {
                try {
                    const parsedCart = JSON.parse(savedCart);
                    return normalizeCartItems(parsedCart);
                } catch (e) {
                    console.error('Failed to parse saved cart:', e);
                }
            } else {
                localStorage.removeItem(`cart_${tenantId}`);
                localStorage.removeItem(`cart_timestamp_${tenantId}`);
                localStorage.removeItem(`customer_info_${tenantId}`);
            }
        }

        return [];
    });

    const commitCartItems = useCallback((updater) => {
        setCartItems((prevItems) => {
            const nextItems = typeof updater === 'function' ? updater(prevItems) : updater;
            return normalizeCartItems(nextItems);
        });
    }, []);

    const [customerInfo, setCustomerInfo] = useState(() => {
        const tenantId = localStorage.getItem('tenantId');
        if (!tenantId) return createEmptyCustomerInfo();

        const savedInfo = localStorage.getItem(`customer_info_${tenantId}`);
        if (savedInfo) {
            try {
                const parsed = JSON.parse(savedInfo);
                // Merge with default to ensure all fields exist (like delivery_notes)
                return { ...createEmptyCustomerInfo(), ...parsed };
            } catch (e) {
                console.error('Failed to parse saved customer info:', e);
            }
        }
        return createEmptyCustomerInfo();
    });

    useEffect(() => {
        const tenantId = localStorage.getItem('tenantId');
        if (!tenantId) {
            return;
        }

        const normalizedForStorage = normalizeCartItems(cartItems);
        if (normalizedForStorage.length > 0) {
            localStorage.setItem(`cart_${tenantId}`, JSON.stringify(normalizedForStorage));
            localStorage.setItem(`cart_timestamp_${tenantId}`, Date.now().toString());
        } else {
            localStorage.removeItem(`cart_${tenantId}`);
            localStorage.removeItem(`cart_timestamp_${tenantId}`);
        }
    }, [cartItems]);

    useEffect(() => {
        const tenantId = localStorage.getItem('tenantId');
        if (tenantId && (customerInfo.name || customerInfo.phone)) {
            localStorage.setItem(`customer_info_${tenantId}`, JSON.stringify(customerInfo));
        }
    }, [customerInfo]);

    useEffect(() => {
        const tenantId = localStorage.getItem('tenantId');
        if (tenantId && tenantId !== currentTenantId) {
            if (currentTenantId !== null) {
                console.log('Restaurant changed, clearing cart');
                commitCartItems([]);
                setCustomerInfo(createEmptyCustomerInfo());
                localStorage.removeItem(`cart_${currentTenantId}`);
                localStorage.removeItem(`cart_timestamp_${currentTenantId}`);
                localStorage.removeItem(`customer_info_${currentTenantId}`);
            }
            setCurrentTenantId(tenantId);
        }
    }, [commitCartItems, currentTenantId]);

    // Internal function to actually add the item to state
    const processAddItem = useCallback((normalizedItem) => {
        commitCartItems((prevItems) => {
            const existingIndex = prevItems.findIndex((item) => item.cartKey === normalizedItem.cartKey);

            if (existingIndex === -1) {
                return [...prevItems, normalizedItem];
            }

            return prevItems.map((item, index) => {
                if (index !== existingIndex) {
                    return item;
                }
                const nextQty = item.qty + normalizedItem.qty;
                return {
                    ...item,
                    qty: nextQty,
                    totalPrice: Number((item.unitPrice * nextQty).toFixed(2)),
                };
            });
        });

        const variantLabel = normalizedItem.variant?.name ? ` (${normalizedItem.variant.name})` : '';
        addToast(`${normalizedItem.name || 'פריט'}${variantLabel} נוסף לסל!`, 'success');
    }, [commitCartItems, addToast]);

    const addToCart = useCallback((rawItem) => {
        const normalizedItem = normalizeCartItem(rawItem);
        if (!normalizedItem) {
            console.warn('Attempted to add invalid cart item', rawItem);
            return;
        }

        // בדיקה אם הסל מכיל מוצרים ממסעדה אחרת
        const currentTenant = localStorage.getItem('tenantId');

        // קבל את ה-restaurant ID של הפריט החדש (עדיפות למה שנשלח בפריט, אחרת tenantId הנוכחי)
        const newItemRestaurant = normalizedItem.restaurantId || currentTenant;

        // בדוק אם יש פריטים בסל ואם כן, קבל את ה-restaurant ID של הפריט הראשון
        let firstItemRestaurant = null;
        if (cartItems.length > 0) {
            firstItemRestaurant = cartItems[0].restaurantId || currentTenant;
        }

        console.log('🛒 Cart Check:', {
            cartItemsCount: cartItems.length,
            firstItemRestaurant,
            newItemRestaurant,
            currentTenant,
            rawItem: { name: rawItem.name, restaurantId: rawItem.restaurantId, restaurant_id: rawItem.restaurant_id }
        });

        // אם יש מוצרים ממסעדה שונה - הצג מודל אישור
        if (cartItems.length > 0 && firstItemRestaurant && newItemRestaurant && firstItemRestaurant !== newItemRestaurant) {
            // קבל את שמות המסעדות
            const oldRestaurantName = cartItems[0]?.restaurantName || localStorage.getItem(`restaurant_name_${firstItemRestaurant}`) || 'מסעדה קודמת';
            const newRestaurantName = normalizedItem.restaurantName || localStorage.getItem(`restaurant_name_${newItemRestaurant}`) || 'מסעדה חדשה';

            setPendingItem(normalizedItem);
            setConfirmationModal({
                isOpen: true,
                title: 'החלפת מסעדה',
                message: `הסל שלך מכיל מוצרים מ${oldRestaurantName}\nהאם תרצה למחוק אותם ולהמשיך עם ${newRestaurantName}?`,
                oldRestaurantName,
                newRestaurantName
            });
            return;
        }

        processAddItem(normalizedItem);
    }, [commitCartItems, addToast, cartItems, processAddItem]);

    const handleConfirmClearCart = () => {
        // נקה סל ועבור למסעדה החדשה
        const tenantId = localStorage.getItem('tenantId');
        if (tenantId) {
            localStorage.removeItem(`cart_${tenantId}`);
            localStorage.removeItem(`cart_timestamp_${tenantId}`);
            localStorage.removeItem(`customer_info_${tenantId}`);
        }
        commitCartItems([]);
        setCustomerInfo(createEmptyCustomerInfo());
        setPhoneVerified(false);

        // הוסף את הפריט החדש לסל הריק
        if (pendingItem) {
            processAddItem(pendingItem);
            addToast(`הסל נוקה - עברת ל${confirmationModal.newRestaurantName} 🎉`, 'success');
        }

        closeModal();
    };

    const handleCancelClearCart = () => {
        addToast(`הפריט לא נוסף - הסל נשאר עם ${confirmationModal.oldRestaurantName}`, 'info');
        closeModal();
    };

    const closeModal = () => {
        setConfirmationModal(prev => ({ ...prev, isOpen: false }));
        setPendingItem(null);
    };

    const removeFromCart = useCallback((identifier) => {
        commitCartItems((prevItems) =>
            prevItems.filter((item) => {
                const numericIdentifier = Number(identifier);
                return (
                    item.cartKey !== identifier &&
                    item.menuItemId !== identifier &&
                    (Number.isNaN(numericIdentifier) || item.menuItemId !== numericIdentifier)
                );
            })
        );
    }, [commitCartItems]);

    const updateQuantity = useCallback((identifier, quantity) => {
        const parsedQty = Math.round(Number(quantity));
        if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
            removeFromCart(identifier);
            return;
        }

        commitCartItems((prevItems) =>
            prevItems.map((item) => {
                const numericIdentifier = Number(identifier);
                const isMatch =
                    item.cartKey === identifier ||
                    item.menuItemId === identifier ||
                    (!Number.isNaN(numericIdentifier) && item.menuItemId === numericIdentifier);

                if (!isMatch) {
                    return item;
                }

                return {
                    ...item,
                    qty: parsedQty,
                    totalPrice: Number((item.unitPrice * parsedQty).toFixed(2)),
                };
            })
        );
    }, [commitCartItems, removeFromCart]);

    const clearCart = useCallback(() => {
        const tenantId = localStorage.getItem('tenantId');
        commitCartItems([]);
        setCustomerInfo(createEmptyCustomerInfo());
        setPhoneVerified(false);
        if (tenantId) {
            localStorage.removeItem(`cart_${tenantId}`);
            localStorage.removeItem(`cart_timestamp_${tenantId}`);
            localStorage.removeItem(`customer_info_${tenantId}`);
        }
    }, [commitCartItems]);

    const getTotal = useCallback(() => {
        const total = cartItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
        return Number(total.toFixed(2));
    }, [cartItems]);

    const getItemCount = useCallback(() => {
        return cartItems.reduce((count, item) => count + (item.qty || 0), 0);
    }, [cartItems]);

    const value = {
        cartItems,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        getTotal,
        getItemCount,
        customerInfo,
        setCustomerInfo,
        phoneVerified,
        setPhoneVerified,
    };

    return (
        <CartContext.Provider value={value}>
            {children}
            <ConfirmationModal
                isOpen={confirmationModal.isOpen}
                title={confirmationModal.title}
                message={confirmationModal.message}
                onConfirm={handleConfirmClearCart}
                onCancel={handleCancelClearCart}
                confirmText={`כן, עבור ל${confirmationModal.newRestaurantName}`}
                cancelText="לא, ביטול"
            />
        </CartContext.Provider>
    );
}

/**
 * Hook לשימוש ב-Cart Context
 */
export function useCart() {
    const context = useContext(CartContext);
    if (!context) {
        throw new Error('useCart חייב להיות בתוך CartProvider');
    }
    return context;
}
