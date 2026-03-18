import React from 'react';
import { FaHeart, FaRegHeart } from 'react-icons/fa';
import { useCustomer } from '../context/CustomerContext';
import apiClient from '../services/apiClient';

/**
 * כפתור מועדפים (לב) על פריט תפריט
 */
export default function FavoriteButton({ menuItemId, isFavorited, onToggle, size = 'md' }) {
    const { isRecognized, customerToken } = useCustomer();

    if (!isRecognized) return null;

    const sizeClass = size === 'sm' ? 'text-base p-1' : 'text-xl p-2';

    const handleToggle = async (e) => {
        e.stopPropagation();
        e.preventDefault();

        try {
            if (isFavorited) {
                await apiClient.delete(`/customer/favorites/${menuItemId}`, {
                    headers: { Authorization: `Bearer ${customerToken}` },
                });
            } else {
                await apiClient.post('/customer/favorites', { menu_item_id: menuItemId }, {
                    headers: { Authorization: `Bearer ${customerToken}` },
                });
            }
            onToggle?.(menuItemId, !isFavorited);
        } catch (err) {
            console.error('Toggle favorite failed:', err);
        }
    };

    return (
        <button
            onClick={handleToggle}
            className={`${sizeClass} rounded-full transition-all transform hover:scale-110 active:scale-95 ${isFavorited
                    ? 'text-red-500 hover:text-red-600'
                    : 'text-gray-300 hover:text-red-400'
                }`}
            aria-label={isFavorited ? 'הסר מהמועדפים' : 'הוסף למועדפים'}
        >
            {isFavorited ? <FaHeart /> : <FaRegHeart />}
        </button>
    );
}
