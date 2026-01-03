import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useNavigate } from 'react-router-dom';
import { CustomerLayout } from '../layouts/CustomerLayout';
import menuService from '../services/menuService';
import { UI_TEXT } from '../constants/ui';
import axios from 'axios';

/**
 * עמוד תפריט - עיצוב בסגנון Wolt
 */

export default function MenuPage() {
    const { tenantId } = useAuth();
    const navigate = useNavigate();
    const { addToCart } = useCart();
    const [menu, setMenu] = useState([]);
    const [restaurant, setRestaurant] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeCategory, setActiveCategory] = useState(null);
    const [activeOrderId, setActiveOrderId] = useState(null);
    const categoryRefs = useRef({});

    useEffect(() => {
        loadMenu();
        loadRestaurantInfo();

        // בדוק אם יש הזמנה פעילה
        const savedOrderId = localStorage.getItem(`activeOrder_${tenantId}`);
        if (savedOrderId) {
            setActiveOrderId(savedOrderId);
        }
    }, [tenantId]);

    // הגדרת קטגוריה פעילה ראשונה
    useEffect(() => {
        if (menu.length > 0 && !activeCategory) {
            setActiveCategory(menu[0].id);
        }
    }, [menu]);

    const loadRestaurantInfo = async () => {
        try {
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
            const response = await axios.get(`${API_URL}/restaurants`, {
                transformResponse: [(data) => {
                    // נקה את התגובה מ-HTML warnings של PHP
                    if (typeof data === 'string') {
                        const jsonStart = data.indexOf('{');
                        if (jsonStart > 0) {
                            data = data.substring(jsonStart);
                        }
                    }
                    return JSON.parse(data);
                }]
            });
            const restaurants = response.data.data || [];
            const currentRestaurant = restaurants.find(r => r.tenant_id === tenantId);
            console.log('🏪 Restaurant loaded:', currentRestaurant?.name, 'Logo:', currentRestaurant?.logo_url);
            setRestaurant(currentRestaurant);
        } catch (err) {
            console.error('שגיאה בטעינת מידע מסעדה:', err);
        }
    };

    const loadMenu = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await menuService.getMenu();
            setMenu(data);
        } catch (err) {
            console.error('שגיאה בטעינת תפריט:', err);
            setError('לא הצלחנו לטעון את התפריט. אנא נסה שוב.');
        } finally {
            setLoading(false);
        }
    };

    const scrollToCategory = (categoryId) => {
        setActiveCategory(categoryId);
        categoryRefs.current[categoryId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    if (loading) {
        return (
            <CustomerLayout>
                <div className="flex justify-center items-center h-64">
                    <p className="text-lg text-gray-600">{UI_TEXT.MSG_LOADING}</p>
                </div>
            </CustomerLayout>
        );
    }

    if (error) {
        return (
            <CustomerLayout>
                <div className="bg-red-100 border border-red-400 text-red-900 px-4 py-3 rounded">
                    <p>{error}</p>
                    <button
                        onClick={loadMenu}
                        className="mt-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition"
                    >
                        נסה שוב
                    </button>
                </div>
            </CustomerLayout>
        );
    }

    return (
        <CustomerLayout>
            {/* כרטיסייה של הזמנה פעילה */}
            {activeOrderId && (
                <div className="mb-6 p-4 bg-gradient-to-r from-brand-primary to-brand-secondary rounded-2xl shadow-lg text-white cursor-pointer hover:shadow-xl transition-shadow"
                    onClick={() => navigate(`/order-status/${activeOrderId}`)}>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-semibold mb-1">📍 הזמנה בעיצומה</p>
                            <p className="text-sm opacity-90">הזמנה #{activeOrderId}</p>
                        </div>
                        <div className="text-2xl">👉</div>
                    </div>
                    <p className="text-xs opacity-75 mt-2">לחץ כדי לראות סטטוס מלא</p>
                </div>
            )}

            {/* Hero Section - סגנון Wolt */}
            <div className="relative -mx-4 sm:-mx-6 lg:-mx-8 -mt-8 mb-8">
                {/* רקע עם לוגו גדול */}
                <div className="relative h-48 sm:h-72 bg-gradient-to-br from-brand-dark via-brand-primary to-brand-secondary overflow-hidden">
                    {/* לוגואים מעומעמים ברקע */}
                    {restaurant?.logo_url && (
                        <>
                            <div
                                className="absolute -top-10 -right-10 w-64 h-64 opacity-10"
                                style={{
                                    backgroundImage: `url(${restaurant.logo_url})`,
                                    backgroundSize: 'contain',
                                    backgroundRepeat: 'no-repeat'
                                }}
                            />
                            <div
                                className="absolute -bottom-10 -left-10 w-48 h-48 opacity-10"
                                style={{
                                    backgroundImage: `url(${restaurant.logo_url})`,
                                    backgroundSize: 'contain',
                                    backgroundRepeat: 'no-repeat'
                                }}
                            />
                            <div
                                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 opacity-5"
                                style={{
                                    backgroundImage: `url(${restaurant.logo_url})`,
                                    backgroundSize: 'contain',
                                    backgroundRepeat: 'no-repeat',
                                    backgroundPosition: 'center'
                                }}
                            />
                        </>
                    )}

                    {/* תוכן ה-Hero */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center text-white px-4">
                            {restaurant?.logo_url && (
                                <div className="mb-4 flex justify-center">
                                    <div className="bg-white p-3 rounded-2xl shadow-2xl">
                                        <img
                                            src={restaurant.logo_url}
                                            alt={restaurant?.name}
                                            className="h-16 w-16 sm:h-20 sm:w-20 object-contain"
                                        />
                                    </div>
                                </div>
                            )}
                            <h1 className="text-3xl sm:text-4xl font-bold mb-2 drop-shadow-lg">
                                {restaurant?.name || 'תפריט המסעדה'}
                            </h1>
                            {restaurant?.cuisine_type && (
                                <span className="inline-block bg-white/20 backdrop-blur-sm px-4 py-1 rounded-full text-sm">
                                    {restaurant.cuisine_type}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* כרטיס מידע צף */}
                {restaurant && (
                    <div className="mx-4 sm:mx-6 lg:mx-8 -mt-8 relative z-10">
                        <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-6 flex flex-wrap items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                {restaurant.logo_url && (
                                    <img
                                        src={restaurant.logo_url}
                                        alt=""
                                        className="h-12 w-12 object-contain opacity-50 hidden sm:block"
                                    />
                                )}
                                <div>
                                    <p className="text-gray-600 text-sm">{restaurant.address}</p>
                                    {restaurant.phone && (
                                        <p className="text-brand-primary font-medium">{restaurant.phone}</p>
                                    )}
                                </div>
                            </div>
                            <div className={`px-4 py-2 rounded-full text-sm font-bold ${restaurant.is_open ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {restaurant.is_open ? '🟢 פתוח עכשיו' : '🔴 סגור'}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ניווט קטגוריות - Sticky בסגנון Wolt */}
            {menu.length > 0 && (
                <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 mb-6 border-b border-gray-100 shadow-sm">
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                        {menu.map((category) => (
                            <button
                                key={category.id}
                                onClick={() => scrollToCategory(category.id)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-all duration-300 ${activeCategory === category.id
                                    ? 'bg-brand-primary text-white shadow-lg scale-105'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                {restaurant?.logo_url && activeCategory === category.id && (
                                    <img src={restaurant.logo_url} alt="" className="h-5 w-5 object-contain" />
                                )}
                                <span className="font-medium">{category.name}</span>
                                <span className="text-xs opacity-70">({category.items?.length || 0})</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* תוכן התפריט */}
            <div className="space-y-10">
                {menu.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
                        {restaurant?.logo_url && (
                            <img src={restaurant.logo_url} alt="" className="h-20 w-20 mx-auto mb-4 opacity-30" />
                        )}
                        <p className="text-gray-500 text-lg">עדיין אין פריטים בתפריט</p>
                    </div>
                ) : (
                    menu.map((category) => (
                        <div
                            key={category.id}
                            ref={el => categoryRefs.current[category.id] = el}
                            className="scroll-mt-20"
                        >
                            {/* כותרת קטגוריה - סגנון Wolt */}
                            <div className="flex items-center gap-4 mb-6">
                                {restaurant?.logo_url && (
                                    <div className="bg-gradient-to-br from-brand-primary/20 to-brand-secondary/20 p-3 rounded-xl">
                                        <img
                                            src={restaurant.logo_url}
                                            alt=""
                                            className="h-8 w-8 object-contain"
                                        />
                                    </div>
                                )}
                                <div className="flex-1">
                                    <h2 className="text-2xl sm:text-3xl font-bold text-brand-dark">{category.name}</h2>
                                    {category.description && (
                                        <p className="text-gray-500 text-sm mt-1">{category.description}</p>
                                    )}
                                </div>
                                <div className="hidden sm:block h-px flex-1 bg-gradient-to-l from-transparent via-gray-200 to-transparent"></div>
                            </div>

                            {/* Grid של מנות - סגנון Wolt */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {category.items.length === 0 ? (
                                    <p className="text-gray-400 italic col-span-full text-center py-8">אין פריטים זמינים</p>
                                ) : (
                                    category.items.map((item) => (
                                        <div
                                            key={item.id}
                                            onClick={() => addToCart(item)}
                                            className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden cursor-pointer group border border-gray-100 hover:border-brand-primary/30"
                                        >
                                            {/* תמונה / לוגו placeholder */}
                                            <div className="relative h-40 bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden">
                                                {item.image_url ? (
                                                    <img
                                                        src={item.image_url}
                                                        alt={item.name}
                                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                                    />
                                                ) : restaurant?.logo_url ? (
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <img
                                                            src={restaurant.logo_url}
                                                            alt=""
                                                            className="h-24 w-24 object-contain opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all duration-500"
                                                        />
                                                    </div>
                                                ) : null}

                                                {/* כפתור הוספה מהיר */}
                                                <div className="absolute bottom-3 left-3 right-3">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            addToCart(item);
                                                        }}
                                                        className="w-full bg-brand-primary hover:bg-brand-secondary text-white py-2.5 rounded-xl font-bold shadow-lg transform translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-2"
                                                    >
                                                        <span>הוסף</span>
                                                        <span className="bg-white/20 px-2 py-0.5 rounded-lg text-sm">₪{item.price}</span>
                                                    </button>
                                                </div>
                                            </div>

                                            {/* פרטי המנה */}
                                            <div className="p-4">
                                                <div className="flex justify-between items-start gap-2 mb-2">
                                                    <h3 className="font-bold text-brand-dark group-hover:text-brand-primary transition-colors line-clamp-1">
                                                        {item.name}
                                                    </h3>
                                                    <span className="text-brand-primary font-bold whitespace-nowrap">
                                                        ₪{item.price}
                                                    </span>
                                                </div>
                                                {item.description && (
                                                    <p className="text-gray-500 text-sm line-clamp-2 leading-relaxed">
                                                        {item.description}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </CustomerLayout>
    );
}
