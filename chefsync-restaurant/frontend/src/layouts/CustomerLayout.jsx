import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import logo from '../images/ChefSyncLogoIcon.png';

/**
 * Layout ראשי עם ניווט עליון
 * משתמע עבור לקוח - בלי כפתורי ניהול
 */

export function CustomerLayout({ children }) {
    const { tenantId, logout } = useAuth();
    const { getItemCount } = useCart();

    return (
        <div className="flex flex-col min-h-screen bg-brand-light" dir="rtl">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-white shadow-sm border-b border-gray-100">
                <div className="max-w-6xl mx-auto px-6 py-4">
                    <div className="flex justify-between items-center">
                        <Link to="/" className="flex items-center">
                            <img src={logo} alt="ChefSync IL" className="h-12" />
                        </Link>
                        <nav className="flex gap-6 items-center">
                            <Link to="/" className="text-gray-700 hover:text-brand-primary transition font-medium">בית</Link>
                            {tenantId && (
                                <>
                                    <Link to="/menu" className="text-gray-700 hover:text-brand-primary transition font-medium">תפריט</Link>
                                    <Link to="/cart" className="text-gray-700 hover:text-brand-primary transition font-medium relative inline-block">
                                        סל
                                        {getItemCount() > 0 && (
                                            <span className="absolute -top-3 -left-3 bg-brand-primary text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-md">
                                                {getItemCount()}
                                            </span>
                                        )}
                                    </Link>
                                    <button
                                        onClick={logout}
                                        className="text-gray-600 hover:text-brand-primary transition text-sm font-medium"
                                    >
                                        החלף מסעדה
                                    </button>
                                </>
                            )}
                        </nav>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">
                {children}
            </main>

            {/* Footer */}
            <footer className="bg-white border-t border-gray-100 text-center py-6 text-sm text-gray-500">
                <p>ChefSync IL © 2026 - הזמנות למסעדה בקלות</p>
            </footer>
        </div>
    );
}
