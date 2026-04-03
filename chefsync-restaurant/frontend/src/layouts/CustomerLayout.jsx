import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAdminAuth } from '../context/AdminAuthContext';
import { useCart } from '../context/CartContext';
import { useCustomer } from '../context/CustomerContext';
import logo from '../images/ChefSyncLogoIcon.png';
import { COMPANY_LEGAL_NAME, PRODUCT_NAME, PRODUCT_TAGLINE_HE } from '../constants/brand';
import ThemeToggle from '../components/ThemeToggle';
import UserProfileModal from '../components/UserProfileModal';
import ActiveOrdersModal from '../components/ActiveOrdersModal';
import OrderHistoryModal from '../components/OrderHistoryModal';
import orderService from '../services/orderService';
import { FaUser, FaShoppingBag, FaBars, FaTimes } from 'react-icons/fa';
import { ACTIVE_ORDERS_STORAGE_CHANGED } from '../utils/activeOrdersStorage';

/**
 * Layout ראשי עם ניווט עליון (לקוח).
 * קישור "כניסת מנהלים" מוצג רק כשיש סשן מנהל פעיל (AdminAuth).
 */

export function CustomerLayout({ children }) {
    const { tenantId, logout } = useAuth();
    const { user: adminUser, loading: adminAuthLoading } = useAdminAuth();
    const { getItemCount } = useCart();
    const { isRecognized, customer, isUserModalOpen, openUserModal, closeUserModal, isOrderHistoryOpen, closeOrderHistory } = useCustomer();
    const navigate = useNavigate();

    // הזמנות פעילות + ממתינות לביקורת
    const [showOrdersModal, setShowOrdersModal] = useState(false);
    const [ordersModalData, setOrdersModalData] = useState([]);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    /** ספירה שמתעדכנת כש-localStorage של הזמנות פעילות משתנה (גם מעמוד סטטוס בלי ניווט) */
    const [activeOrdersStorageRev, setActiveOrdersStorageRev] = useState(0);
    const modalOrderIdsRef = useRef([]);

    useEffect(() => {
        const bump = () => setActiveOrdersStorageRev((n) => n + 1);
        window.addEventListener(ACTIVE_ORDERS_STORAGE_CHANGED, bump);
        return () => window.removeEventListener(ACTIVE_ORDERS_STORAGE_CHANGED, bump);
    }, []);

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
    }, [tenantId, children, activeOrdersStorageRev]); // activeOrdersStorageRev — אחרי עדכון מעמוד סטטוס / סל

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

    useEffect(() => {
        if (showOrdersModal && ordersModalData.length > 0) {
            modalOrderIdsRef.current = ordersModalData.map((o) => o.id);
        }
    }, [showOrdersModal, ordersModalData]);

    // רענון תגיות סטטוס במודל כשהשרת משתנה (למשל מעבר אשראי→מזומן) בלי לסגור ולפתוח מחדש
    useEffect(() => {
        if (!showOrdersModal) return undefined;
        const refreshModalOrders = async () => {
            const ids = modalOrderIdsRef.current;
            if (!ids.length) return;
            try {
                const results = await Promise.all(
                    ids.map((id) => orderService.getOrder(id).then((r) => r.data).catch(() => null))
                );
                const next = results.filter(Boolean);
                if (next.length > 0) {
                    setOrdersModalData(next);
                }
            } catch {
                /* ignore */
            }
        };
        refreshModalOrders();
        const interval = setInterval(refreshModalOrders, 5000);
        return () => clearInterval(interval);
    }, [showOrdersModal]);

    // Smart dismiss logic — הצעת הרשמה אוטומטית
    useEffect(() => {
        if (new URLSearchParams(window.location.search).has('embed')) return;
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

    useEffect(() => {
        if (!mobileMenuOpen) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, [mobileMenuOpen]);

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

    /** קישור ניהול — רק כשמנהל/צוות מחוברים ל-Admin (לא ללקוחות אורחים) */
    const showAdminEntryInMenu = !adminAuthLoading && !!adminUser;
    const adminDashboardPath = adminUser?.is_super_admin ? '/super-admin/dashboard' : '/admin/dashboard';

    return (
        <div className="flex flex-col min-h-screen bg-brand-light dark:bg-brand-dark-bg dark:text-brand-dark-text" dir="rtl">
            {/* Header — fixed (עובד יציב בגלילה ב-iOS; sticky נשבר לעיתים עם overflow-x:hidden על html/body) */}
            <header className="fixed top-0 inset-x-0 z-50 bg-brand-dark shadow-md border-b border-gray-700 overflow-visible pt-[env(safe-area-inset-top,0px)]">
                <div className="max-w-6xl mx-auto px-3 py-2 sm:px-6 sm:py-4">
                    <div className="flex items-center justify-between gap-2 min-h-[2.75rem] sm:min-h-0">
                        <Link
                            to="/"
                            className="flex min-w-0 shrink items-center max-w-[52%] sm:max-w-none"
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            <img
                                src={logo}
                                alt={PRODUCT_NAME}
                                className="h-8 w-auto max-h-9 max-w-[min(160px,42vw)] object-contain object-right drop-shadow-md brightness-0 invert sm:h-12 sm:max-h-none sm:max-w-none sm:origin-center sm:scale-125"
                            />
                        </Link>

                        {/* דסקטופ / טאבלט — כל הניווט בשורה */}
                        <nav className="hidden md:flex gap-4 lg:gap-6 items-center shrink-0">
                            <ThemeToggle />
                            <button
                                type="button"
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
                                    type="button"
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
                            <Link to="/" className="text-white/80 hover:text-brand-primary transition font-medium whitespace-nowrap">בית</Link>
                            {showAdminEntryInMenu && (
                                <Link
                                    to={adminDashboardPath}
                                    className="text-white/80 hover:text-brand-primary transition font-medium whitespace-nowrap"
                                >
                                    כניסת מנהלים
                                </Link>
                            )}
                            {tenantId && (
                                <>
                                    <Link to={menuPath} className="text-white/80 hover:text-brand-primary transition font-medium whitespace-nowrap">תפריט</Link>
                                    <Link to={cartPath} className="text-white/80 hover:text-brand-primary transition font-medium relative inline-block whitespace-nowrap">
                                        סל
                                        {getItemCount() > 0 && (
                                            <span className="absolute -top-3 -left-3 bg-brand-primary text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-md">
                                                {getItemCount()}
                                            </span>
                                        )}
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={logout}
                                        className="text-white/60 hover:text-brand-primary transition text-sm font-medium whitespace-nowrap"
                                    >
                                        החלף מסעדה
                                    </button>
                                </>
                            )}
                        </nav>

                        {/* מובייל — אייקונים צפופים + המבורגר (בורר עיצוב בתוך המודל) */}
                        <div className="flex md:hidden items-center gap-1.5 shrink-0">
                            <button
                                type="button"
                                onClick={openUserModal}
                                className="relative group p-1"
                                aria-label="פרופיל משתמש"
                            >
                                {isRecognized ? (
                                    <div className="w-8 h-8 rounded-full bg-brand-primary flex items-center justify-center text-white font-bold text-sm shadow-md">
                                        {customer?.name?.charAt(0)?.toUpperCase() || <FaUser size={14} />}
                                    </div>
                                ) : (
                                    <div className="w-8 h-8 rounded-full border-2 border-white/60 flex items-center justify-center text-white/60">
                                        <FaUser size={14} />
                                    </div>
                                )}
                            </button>
                            {tenantId && totalOrdersBadge > 0 && (
                                <button
                                    type="button"
                                    onClick={() => { setMobileMenuOpen(false); handleOrdersClick(); }}
                                    className="relative p-1 text-white/80 hover:text-brand-primary transition"
                                    aria-label="הזמנות פעילות"
                                >
                                    <FaShoppingBag size={18} />
                                    <span className="absolute -top-1 -left-1 bg-brand-primary text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center shadow-md">
                                        {totalOrdersBadge}
                                    </span>
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setMobileMenuOpen(true)}
                                className="p-2 rounded-lg text-white/90 hover:bg-white/10 transition"
                                aria-expanded={mobileMenuOpen}
                                aria-label="פתח תפריט"
                            >
                                <FaBars size={20} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* מודל ניווט מובייל — בורר רקע בשורה מלאה + קישורים */}
                {mobileMenuOpen && (
                    <div className="fixed inset-0 z-[100] md:hidden">
                        <button
                            type="button"
                            className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
                            aria-label="סגור"
                            onClick={() => setMobileMenuOpen(false)}
                        />
                        <div
                            className="absolute top-0 left-0 right-0 max-h-[92vh] overflow-y-auto rounded-b-2xl bg-brand-dark shadow-2xl border-b border-gray-600 pt-[env(safe-area-inset-top,0px)]"
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="mobile-menu-title"
                        >
                            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10">
                                <h2 id="mobile-menu-title" className="text-sm font-black text-white uppercase tracking-wide">
                                    תפריט
                                </h2>
                                <button
                                    type="button"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="rounded-full p-2 text-white/80 hover:bg-white/10"
                                    aria-label="סגור תפריט"
                                >
                                    <FaTimes size={20} />
                                </button>
                            </div>
                            <div className="px-4 py-4 space-y-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                                <ThemeToggle variant="fullWidth" />
                                <nav className="flex flex-col rounded-xl bg-white/5 overflow-hidden divide-y divide-white/10">
                                    <Link
                                        to="/"
                                        className="px-4 py-3.5 text-base font-bold text-white hover:bg-white/10"
                                        onClick={() => setMobileMenuOpen(false)}
                                    >
                                        בית
                                    </Link>
                                    {showAdminEntryInMenu && (
                                        <Link
                                            to={adminDashboardPath}
                                            className="px-4 py-3.5 text-base font-bold text-white hover:bg-white/10"
                                            onClick={() => setMobileMenuOpen(false)}
                                        >
                                            כניסת מנהלים
                                        </Link>
                                    )}
                                    {tenantId && (
                                        <>
                                            <Link
                                                to={menuPath}
                                                className="px-4 py-3.5 text-base font-bold text-white hover:bg-white/10"
                                                onClick={() => setMobileMenuOpen(false)}
                                            >
                                                תפריט
                                            </Link>
                                            <Link
                                                to={cartPath}
                                                className="px-4 py-3.5 text-base font-bold text-white hover:bg-white/10 flex items-center justify-between"
                                                onClick={() => setMobileMenuOpen(false)}
                                            >
                                                <span>סל</span>
                                                {getItemCount() > 0 && (
                                                    <span className="bg-brand-primary text-white text-xs font-black rounded-full h-6 min-w-[1.5rem] px-1.5 flex items-center justify-center">
                                                        {getItemCount()}
                                                    </span>
                                                )}
                                            </Link>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setMobileMenuOpen(false);
                                                    logout();
                                                }}
                                                className="px-4 py-3.5 text-base font-bold text-white/70 hover:bg-white/10 text-right w-full"
                                            >
                                                החלף מסעדה
                                            </button>
                                        </>
                                    )}
                                </nav>
                                <div className="flex justify-center pt-2">
                                    <img
                                        src={logo}
                                        alt=""
                                        className="h-10 w-auto max-w-[200px] object-contain opacity-50 brightness-0 invert"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </header>

            {/* Main — בלי flex-1: הבר fixed לא נספר ב-flex; flex-1 היה יוצר רווח ענק לפני הפוטר אחרי הגלילה */}
            <main className="max-w-6xl mx-auto w-full px-6 pb-6 sm:pb-8 pt-[calc(env(safe-area-inset-top,0px)+3.75rem)] sm:pt-[calc(env(safe-area-inset-top,0px)+5.75rem)]">
                {children}
            </main>

            {/* Footer — mt-auto כשהתוכן קצר, הפוטר נשאר בתחתית מסך */}
            <footer className="mt-auto bg-white dark:bg-brand-dark-surface border-t border-gray-100 dark:border-brand-dark-border text-center py-6 text-sm text-gray-500 dark:text-brand-dark-muted">
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
