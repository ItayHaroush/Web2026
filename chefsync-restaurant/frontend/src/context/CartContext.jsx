import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useToast } from './ToastContext';

/**
 * Context להנהלת סל קניות
 * מאחסן פריטים עם כמות וחישוב סכום כללי
 */

const CartContext = createContext();

const CART_EXPIRY_HOURS = 24; // סל תקף ל-24 שעות

export function CartProvider({ children }) {
    const { addToast } = useToast();
    const [currentTenantId, setCurrentTenantId] = useState(null);
    const [phoneVerified, setPhoneVerified] = useState(false);

    // טען סל מ-localStorage בטעינה ראשונית
    const [cartItems, setCartItems] = useState(() => {
        const tenantId = localStorage.getItem('tenantId');
        if (!tenantId) return [];

        const savedCart = localStorage.getItem(`cart_${tenantId}`);
        const savedTimestamp = localStorage.getItem(`cart_timestamp_${tenantId}`);

        if (savedCart && savedTimestamp) {
            const hoursSinceLastUpdate = (Date.now() - parseInt(savedTimestamp)) / (1000 * 60 * 60);
            if (hoursSinceLastUpdate < CART_EXPIRY_HOURS) {
                try {
                    return JSON.parse(savedCart);
                } catch (e) {
                    console.error('Failed to parse saved cart:', e);
                }
            } else {
                // הסל פג תוקף - נקה אותו
                localStorage.removeItem(`cart_${tenantId}`);
                localStorage.removeItem(`cart_timestamp_${tenantId}`);
                localStorage.removeItem(`customer_info_${tenantId}`);
            }
        }
        return [];
    });

    const [customerInfo, setCustomerInfo] = useState(() => {
        const tenantId = localStorage.getItem('tenantId');
        if (!tenantId) return {
            name: '',
            phone: '',
            delivery_method: 'pickup',
            payment_method: 'cash',
            delivery_address: '',
            delivery_notes: '',
        };

        const savedInfo = localStorage.getItem(`customer_info_${tenantId}`);
        if (savedInfo) {
            try {
                return JSON.parse(savedInfo);
            } catch (e) {
                console.error('Failed to parse saved customer info:', e);
            }
        }
        return {
            name: '',
            phone: '',
            delivery_method: 'pickup',
            payment_method: 'cash',
            delivery_address: '',
            delivery_notes: '',
        };
    });

    // שמור סל ב-localStorage כל פעם שהוא משתנה
    useEffect(() => {
        const tenantId = localStorage.getItem('tenantId');
        if (tenantId) {
            if (cartItems.length > 0) {
                localStorage.setItem(`cart_${tenantId}`, JSON.stringify(cartItems));
                localStorage.setItem(`cart_timestamp_${tenantId}`, Date.now().toString());
            } else {
                localStorage.removeItem(`cart_${tenantId}`);
                localStorage.removeItem(`cart_timestamp_${tenantId}`);
            }
        }
    }, [cartItems]);

    // שמור פרטי לקוח ב-localStorage כל פעם שהם משתנים
    useEffect(() => {
        const tenantId = localStorage.getItem('tenantId');
        if (tenantId && (customerInfo.name || customerInfo.phone)) {
            localStorage.setItem(`customer_info_${tenantId}`, JSON.stringify(customerInfo));
        }
    }, [customerInfo]);

    // בדוק אם המסעדה השתנתה - אם כן, נקה את הסל
    useEffect(() => {
        const tenantId = localStorage.getItem('tenantId');
        if (tenantId && tenantId !== currentTenantId) {
            if (currentTenantId !== null) {
                // המסעדה השתנתה - נקה את הסל
                console.log('Restaurant changed, clearing cart');
                setCartItems([]);
                setCustomerInfo({ name: '', phone: '', delivery_method: 'pickup', payment_method: 'cash', delivery_address: '', delivery_notes: '' });
                localStorage.removeItem(`cart_${currentTenantId}`);
                localStorage.removeItem(`cart_timestamp_${currentTenantId}`);
                localStorage.removeItem(`customer_info_${currentTenantId}`);
            }
            setCurrentTenantId(tenantId);
        }
    }, [currentTenantId]);

    /**
     * הוספת פריט לסל
     * אם קיים כבר - הגדל כמות
     */
    const addToCart = useCallback((menuItem) => {
        const existingItem = cartItems.find((item) => item.id === menuItem.id);

        if (existingItem) {
            setCartItems((prevItems) =>
                prevItems.map((item) =>
                    item.id === menuItem.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                )
            );
            addToast(`נוספה יחידה נוספת של ${menuItem.name}`, 'success');
        } else {
            setCartItems((prevItems) => [...prevItems, { ...menuItem, quantity: 1 }]);
            addToast(`${menuItem.name} נוסף לסל!`, 'success');
        }
    }, [cartItems, addToast]);

    /**
     * הסרת פריט מהסל
     */
    const removeFromCart = useCallback((menuItemId) => {
        setCartItems((prevItems) =>
            prevItems.filter((item) => item.id !== menuItemId)
        );
    }, []);

    /**
     * עדכון כמות פריט
     */
    const updateQuantity = useCallback((menuItemId, quantity) => {
        if (quantity <= 0) {
            removeFromCart(menuItemId);
            return;
        }

        setCartItems((prevItems) =>
            prevItems.map((item) =>
                item.id === menuItemId ? { ...item, quantity } : item
            )
        );
    }, [removeFromCart]);

    /**
     * ניקוי סל כשהזמנה הוגשה
     */
    const clearCart = useCallback(() => {
        const tenantId = localStorage.getItem('tenantId');
        setCartItems([]);
        setCustomerInfo({ name: '', phone: '', delivery_method: 'pickup', payment_method: 'cash', delivery_address: '', delivery_notes: '' });
        setPhoneVerified(false);
        if (tenantId) {
            localStorage.removeItem(`cart_${tenantId}`);
            localStorage.removeItem(`cart_timestamp_${tenantId}`);
            localStorage.removeItem(`customer_info_${tenantId}`);
        }
    }, []);

    /**
     * חישוב סכום כללי
     */
    const getTotal = useCallback(() => {
        return cartItems.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0
        );
    }, [cartItems]);

    /**
     * חישוב מספר פריטים
     */
    const getItemCount = useCallback(() => {
        return cartItems.reduce((count, item) => count + item.quantity, 0);
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
