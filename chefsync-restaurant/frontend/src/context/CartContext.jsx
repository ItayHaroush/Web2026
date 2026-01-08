import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useToast } from './ToastContext';

/**
 * Context להנהלת סל קניות
 * מאחסן פריטים עם כמות וחישוב סכום כללי
 */

const CartContext = createContext();

export function CartProvider({ children }) {
    const [cartItems, setCartItems] = useState([]);
    const [currentTenantId, setCurrentTenantId] = useState(null);
    const [customerInfo, setCustomerInfo] = useState({
        name: '',
        phone: '',
    });
    const [phoneVerified, setPhoneVerified] = useState(false);
    const { addToast } = useToast();

    // בדוק אם המסעדה השתנתה - אם כן, נקה את הסל
    useEffect(() => {
        const tenantId = localStorage.getItem('tenantId');
        if (tenantId && tenantId !== currentTenantId) {
            if (currentTenantId !== null) {
                // המסעדה השתנתה - נקה את הסל
                console.log('Restaurant changed, clearing cart');
                setCartItems([]);
                setCustomerInfo({ name: '', phone: '' });
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
        setCartItems([]);
        setCustomerInfo({ name: '', phone: '' });
        setPhoneVerified(false);
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
