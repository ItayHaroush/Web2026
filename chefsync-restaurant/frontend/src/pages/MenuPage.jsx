import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { CustomerLayout } from '../layouts/CustomerLayout';
import menuService from '../services/menuService';
import { UI_TEXT } from '../constants/ui';

/**
 * עמוד תפריט - הצגת קטגוריות ופריטים
 */

export default function MenuPage() {
    const { tenantId } = useAuth();
    const { addToCart } = useCart();
    const [menu, setMenu] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadMenu();
    }, [tenantId]);

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
            <div className="space-y-8">
                <h1 className="text-4xl font-bold text-brand-dark">תפריט המסעדה</h1>

                {menu.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
                        <p className="text-gray-500">עדיין אין פריטים בתפריט</p>
                    </div>
                ) : (
                    menu.map((category) => (
                        <div key={category.id} className="space-y-5">
                            {/* כותרת קטגוריה */}
                            <div className="border-b-2 border-brand-primary pb-3">
                                <h2 className="text-2xl font-bold text-brand-dark">{category.name}</h2>
                                {category.description && (
                                    <p className="text-gray-500 text-sm mt-1">{category.description}</p>
                                )}
                            </div>

                            {/* פריטים בקטגוריה */}
                            <div className="grid grid-cols-1 gap-4">
                                {category.items.length === 0 ? (
                                    <p className="text-gray-400 italic">אין פריטים זמינים בקטגוריה זו</p>
                                ) : (
                                    category.items.map((item) => (
                                        <div
                                            key={item.id}
                                            className="bg-white rounded-2xl shadow-sm p-5 hover:shadow-md transition-all"
                                        >
                                            <div className="flex justify-between items-start gap-4">
                                                {/* פרטי הפריט */}
                                                <div className="flex-1">
                                                    <h3 className="text-lg font-bold text-brand-dark">
                                                        {item.name}
                                                    </h3>
                                                    {item.description && (
                                                        <p className="text-gray-500 text-sm mt-1 leading-relaxed">{item.description}</p>
                                                    )}
                                                    <p className="text-brand-primary font-bold text-xl mt-3">
                                                        ₪{item.price}
                                                    </p>
                                                </div>

                                                {/* כפתור הוספה */}
                                                <button
                                                    onClick={() => addToCart(item)}
                                                    className="bg-brand-primary text-white px-7 py-3 rounded-xl font-semibold hover:bg-brand-secondary transition-colors whitespace-nowrap shadow-sm"
                                                >
                                                    {UI_TEXT.BTN_ADD}
                                                </button>
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
