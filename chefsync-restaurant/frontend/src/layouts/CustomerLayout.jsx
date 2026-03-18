import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useCustomer } from '../context/CustomerContext';
import logo from '../images/ChefSyncLogoIcon.png';
import { COMPANY_LEGAL_NAME, PRODUCT_NAME, PRODUCT_TAGLINE_HE } from '../constants/brand';
import ThemeToggle from '../components/ThemeToggle';
import UserProfileModal from '../components/UserProfileModal';
import ActiveOrdersModal from '../components/ActiveOrdersModal';
import OrderHistoryModal from '../components/OrderHistoryModal';
import orderService from '../services/orderService';
import { FaUser, FaShoppingBag } from 'react-icons/fa';

/**
 * Layout ראשי עם ניווט עליון
 * משתמע עבור לקוח - בלי כפתורי ניהול
 */

export function CustomerLayout({ children }) {
    const { tenantId, logout } = useAuth();
    const { getItemCount } = useCart();
    const { isRecognized, customer, isUserModalOpen, openUserModal, closeUserModal, isOrderHistoryOpen, closeOrderHistory } = useCustomer();
    const navigate = useNavigate();

    // הזמנות פעילות + ממתינות לביקורת
    const [showOrdersModal, setShowOrdersModal] = useState(false);
    const [ordersModalData, setOrdersModalData] = useState([]);

    // חישוב מספר הזמנות מ-localStorage
    const allOrderIds = useMemo(() => {
        if (!tenantId) return [];
        let active = [];
        let pending = [];
        try { active = JSON.parse(localStorage.getItem(`activeOrders_${tenantId}`)) || []; } catch { active = []; }
        try { pending = JSON.parse(localStorage.getItem(`pendingReviewOrders_${tenantId}`)) || []; } catch { pending = []; }
        // מיזוג ללא כפילויות
        const set = new Set([...active.map(String), ...pending.map(String)]);
        return [...set];
    }, [tenantId, children]); // children משתנה בכל ניווט — כדי לרענן

    const totalOrdersBadge = allOrderIds.length;

    const handleOrdersClick = async () => {
        if (allOrderIds.length === 0) return;
        if (allOrderIds.length === 1) {
            // הזמנה אחת — ניווט ישיר
            navigate(`/${tenantId}/order-status/${allOrderIds[0]}`);
            return;
        }
        // כמה הזמנות — טען נתונים ופתח מודל
        try {
            const results = await Promise.all(
                allOrderIds.map(id => orderService.getOrder(id).then(r => r.data).catch(() => null))
            );
            setOrdersModalData(results.filter(Boolean));
            setShowOrdersModal(true);
        } catch { /* ignore */ }
    };

    // Smart dismiss logic — הצעת הרשמה אוטומטית
    useEffect(() => {
        if (isRecognized) return;
        if (sessionStorage.getItem('registration_prompted')) return;

        const dismissCount = parseInt(localStorage.getItem('registration_dismiss_count') || '0', 10);
        const lastDismissed = localStorage.getItem('registration_last_dismissed_at');

        // אם דחה 3 פעמים — בדוק אם עברו 7 ימים
        if (dismissCount >= 3) {
            if (lastDismissed) {
                const daysSince = (Date.now() - new Date(lastDismissed).getTime()) / (1000 * 60 * 60 * 24);
                if (daysSince >= 7) {
                    // reset ותציע שוב
                    localStorage.setItem('registration_dismiss_count', '0');
                } else {
                    return; // אל תציע
                }
            } else {
                return;
            }
        }

        const timer = setTimeout(() => {
            openUserModal();
            sessionStorage.setItem('registration_prompted', 'true');
        }, 5000);
        return () => clearTimeout(timer);
    }, [isRecognized, openUserModal]);

    // כשהמשתמש סוגר את המודל — עדכן dismiss
    const handleModalClose = () => {
        if (!isRecognized) {
            const count = parseInt(localStorage.getItem('registration_dismiss_count') || '0', 10);
            localStorage.setItem('registration_dismiss_count', String(count + 1));
            localStorage.setItem('registration_last_dismissed_at', new Date().toISOString());
            sessionStorage.setItem('registration_prompted', 'true');
        }
        closeUserModal();
    };

    const menuPath = tenantId ? `/${tenantId}/menu` : '/';
    const cartPath = tenantId ? `/${tenantId}/cart` : '/';

    return (
        <div className="flex flex-col min-h-screen bg-brand-light dark:bg-brand-dark-bg dark:text-brand-dark-text" dir="rtl">
            {/* Header - always dark */}
            <header className="sticky top-0 z-50 bg-brand-dark shadow-md border-b border-gray-700">
                <div className="max-w-6xl mx-auto px-6 py-4">
                    <div className="flex justify-between items-center">
                        <Link to="/" className="flex items-center">
                            <img
                                src={logo}
                                alt={PRODUCT_NAME}
                                className="h-12 w-auto transform scale-110 sm:scale-125 origin-center drop-shadow-md brightness-0 invert"
                            />
                        </Link>
                        <nav className="flex gap-4 sm:gap-6 items-center">
                            <ThemeToggle />
                            <button
                                onClick={openUserModal}
                                className="relative group"
                                aria-label="פרופיל משתמש"
                            >
                                {isRecognized ? (
                                    <div className="w-8 h-8 rounded-full bg-brand-primary flex items-center justify-center text-white font-bold text-sm shadow-md group-hover:ring-2 group-hover:ring-brand-primary/50 transition">
                                        {customer?.name?.charAt(0)?.toUpperCase() || <FaUser size={14} />}
                                    </div>
                                ) : (
                                    <div className="w-8 h-8 rounded-full border-2 border-white/60 flex items-center justify-center text-white/60 group-hover:border-brand-primary group-hover:text-brand-primary transition">
                                        <FaUser size={14} />
                                    </div>
                                )}
                            </button>
                            {tenantId && totalOrdersBadge > 0 && (
                                <button
                                    onClick={handleOrdersClick}
                                    className="relative text-white/80 hover:text-brand-primary transition"
                                    aria-label="הזמנות פעילות"
                                >
                                    <FaShoppingBag size={18} />
                                    <span className="absolute -top-2 -left-2 bg-brand-primary text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center shadow-md">
                                        {totalOrdersBadge}
                                    </span>
                                </button>
                            )}
                            <Link to="/" className="text-white/80 hover:text-brand-primary transition font-medium">בית</Link>
                            {tenantId && (
                                <>
                                    <Link to={menuPath} className="text-white/80 hover:text-brand-primary transition font-medium">תפריט</Link>
                                    <Link to={cartPath} className="text-white/80 hover:text-brand-primary transition font-medium relative inline-block">
                                        סל
                                        {getItemCount() > 0 && (
                                            <span className="absolute -top-3 -left-3 bg-brand-primary text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-md">
                                                {getItemCount()}
                                            </span>
                                        )}
                                    </Link>
                                    <button
                                        onClick={logout}
                                        className="text-white/60 hover:text-brand-primary transition text-sm font-medium"
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
            <footer className="bg-white dark:bg-brand-dark-surface border-t border-gray-100 dark:border-brand-dark-border text-center py-6 text-sm text-gray-500 dark:text-brand-dark-muted">
                <p>{PRODUCT_NAME} © 2026 · {COMPANY_LEGAL_NAME} - {PRODUCT_TAGLINE_HE}</p>
            </footer>

            {/* User Profile Modal */}
            <UserProfileModal isOpen={isUserModalOpen} onClose={handleModalClose} />

            {/* Order History Modal */}
            <OrderHistoryModal isOpen={isOrderHistoryOpen} onClose={closeOrderHistory} />

            {/* Active Orders Modal */}
            <ActiveOrdersModal
                isOpen={showOrdersModal}
                onClose={() => setShowOrdersModal(false)}
                orders={ordersModalData}
                onOrderClick={(id) => {
                    setShowOrdersModal(false);
                    navigate(`/${tenantId}/order-status/${id}`);
                }}
            />
        </div>
    );
}
