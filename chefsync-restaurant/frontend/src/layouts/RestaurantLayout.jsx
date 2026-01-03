import React from 'react';

/**
 * Layout עבור ממשק מנהל המסעדה
 * כולל ניווט ניהול מלא
 */

export function RestaurantLayout({ children }) {
    return (
        <div className="flex min-h-screen bg-gray-50" dir="rtl">
            {/* Sidebar */}
            <aside className="w-64 bg-brand-primary text-white shadow-lg">
                <div className="p-6 border-b border-brand-accent">
                    <h2 className="text-2xl font-bold">ניהול מסעדה</h2>
                </div>
                <nav className="p-4 space-y-2">
                    <a href="/restaurant" className="block px-4 py-2 rounded hover:bg-brand-accent transition">
                        הזמנות פעילות
                    </a>
                    <a href="/restaurant/menu" className="block px-4 py-2 rounded hover:bg-brand-accent transition">
                        ניהול תפריט
                    </a>
                    <a href="/restaurant/settings" className="block px-4 py-2 rounded hover:bg-brand-accent transition">
                        הגדרות
                    </a>
                    <button className="w-full text-right px-4 py-2 rounded hover:bg-red-600 transition mt-4">
                        יציאה
                    </button>
                </nav>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col">
                {/* Top Bar */}
                <header className="bg-white shadow-sm px-6 py-4">
                    <h1 className="text-xl font-semibold text-gray-800">ChefSync IL - ממשק מנהל</h1>
                </header>

                {/* Content */}
                <main className="flex-1 p-6">
                    {children}
                </main>
            </div>
        </div>
    );
}
