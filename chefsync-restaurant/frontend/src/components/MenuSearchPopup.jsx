import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apiClient from '../services/apiClient';
import { resolveAssetUrl } from '../utils/assets';
import { FaSearch, FaTimes, FaUtensils, FaArrowLeft } from 'react-icons/fa';

export default function MenuSearchPopup({ open, onClose, city }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const inputRef = useRef(null);
    const debounceRef = useRef(null);
    const navigate = useNavigate();
    const { loginAsCustomer } = useAuth();

    useEffect(() => {
        if (open) {
            setQuery('');
            setResults([]);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [open]);

    const doSearch = useCallback(async (q) => {
        if (q.trim().length < 2) {
            setResults([]);
            return;
        }
        setLoading(true);
        try {
            const params = { q: q.trim() };
            if (city) params.city = city;
            const res = await apiClient.get('/menu-search', { params });
            setResults(res.data?.data || []);
        } catch {
            setResults([]);
        } finally {
            setLoading(false);
        }
    }, [city]);

    const handleInputChange = (e) => {
        const val = e.target.value;
        setQuery(val);
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => doSearch(val), 350);
    };

    const handleItemClick = (item) => {
        if (item.restaurant_tenant_id) {
            loginAsCustomer(item.restaurant_tenant_id);
            setTimeout(() => {
                navigate(`/${item.restaurant_tenant_id}/menu`);
            }, 100);
        }
        onClose();
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <div
                className="relative w-full max-w-lg bg-white dark:bg-brand-dark-surface rounded-2xl shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* שורת חיפוש */}
                <div className="flex items-center gap-3 p-4 border-b border-gray-100 dark:border-brand-dark-border">
                    <FaSearch className="text-gray-400 w-4 h-4 flex-shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={handleInputChange}
                        placeholder="מה בא לך לאכול?"
                        className="flex-1 bg-transparent outline-none text-gray-800 dark:text-gray-200 font-semibold text-base placeholder:text-gray-400"
                    />
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <FaTimes className="w-4 h-4" />
                    </button>
                </div>

                {/* תוצאות */}
                <div className="max-h-[60vh] overflow-y-auto">
                    {loading && (
                        <div className="flex items-center justify-center py-10">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary" />
                        </div>
                    )}

                    {!loading && query.trim().length >= 2 && results.length === 0 && (
                        <div className="text-center py-10 px-4">
                            <FaUtensils className="text-3xl text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500 font-semibold">לא נמצאו מנות</p>
                            <p className="text-gray-400 text-sm mt-1">נסה לחפש משהו אחר</p>
                        </div>
                    )}

                    {!loading && query.trim().length < 2 && (
                        <div className="text-center py-10 px-4">
                            <FaSearch className="text-3xl text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-400 text-sm font-medium">הקלד לפחות 2 תווים לחיפוש</p>
                        </div>
                    )}

                    {!loading && results.length > 0 && (
                        <div className="divide-y divide-gray-50 dark:divide-brand-dark-border">
                            {results.map((item) => (
                                <div
                                    key={`${item.restaurant_tenant_id}-${item.id}`}
                                    onClick={() => handleItemClick(item)}
                                    className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-brand-dark-border/50 cursor-pointer transition-colors"
                                >
                                    {/* תמונת מנה */}
                                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 dark:bg-brand-dark-border flex-shrink-0 flex items-center justify-center">
                                        {item.image_url ? (
                                            <img
                                                src={resolveAssetUrl(item.image_url)}
                                                alt={item.name}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : item.restaurant_logo ? (
                                            <img
                                                src={resolveAssetUrl(item.restaurant_logo)}
                                                alt=""
                                                className="w-8 h-8 object-contain opacity-40"
                                            />
                                        ) : (
                                            <FaUtensils className="text-gray-300 text-lg" />
                                        )}
                                    </div>

                                    {/* פרטי מנה */}
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-gray-800 dark:text-gray-200 text-sm truncate">
                                            {item.name}
                                        </p>
                                        {item.description && (
                                            <p className="text-xs text-gray-400 truncate mt-0.5">
                                                {item.description}
                                            </p>
                                        )}
                                        <p className="text-[11px] text-brand-primary font-semibold mt-0.5">
                                            {item.restaurant_name}
                                        </p>
                                    </div>

                                    {/* מחיר + חץ */}
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className="text-sm font-black text-gray-700 dark:text-gray-300">
                                            ₪{item.price}
                                        </span>
                                        <FaArrowLeft className="w-3 h-3 text-gray-300" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
