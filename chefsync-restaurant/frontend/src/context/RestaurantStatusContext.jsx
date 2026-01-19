import { createContext, useContext, useState } from 'react';

const RestaurantStatusContext = createContext();

export function RestaurantStatusProvider({ children }) {
    const [restaurantStatus, setRestaurantStatus] = useState({
        is_open: false,
        is_override: false,
        is_approved: true,
    });

    return (
        <RestaurantStatusContext.Provider value={{ restaurantStatus, setRestaurantStatus }}>
            {children}
        </RestaurantStatusContext.Provider>
    );
}

export function useRestaurantStatus() {
    const context = useContext(RestaurantStatusContext);
    if (!context) {
        throw new Error('useRestaurantStatus must be used within RestaurantStatusProvider');
    }
    return context;
}
