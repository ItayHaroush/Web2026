import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { useRestaurantStatus } from '../context/RestaurantStatusContext';
import api from '../services/apiClient';
import { listenForegroundMessages } from '../services/fcm';
import SoundManager from '../services/SoundManager';
import { PRODUCT_NAME } from '../constants/brand';
import DashboardSidebar from '../components/admin/DashboardSidebar';
import DashboardHeader from '../components/admin/DashboardHeader';
import FloatingRestaurantAssistant from '../components/admin/FloatingRestaurantAssistant';
import FloatingSystemAdminButtons from '../components/admin/FloatingSystemAdminButtons';
import ImpersonationBanner from '../components/admin/ImpersonationBanner';
import HolidayScheduleModal from '../components/admin/HolidayScheduleModal';
import holidayService from '../services/holidayService';
import { resolveRestaurantAdminPageKey } from '../utils/pageViewMap';
import { sendRestaurantAdminPageView } from '../services/analyticsBeacon';
import {
    FaChartPie,
    FaClipboardList,
    FaUtensils,
    FaDesktop,
    FaChartBar,
    FaShieldAlt,
    FaClock,
    FaTicketAlt,
    FaCreditCard,
    FaExclamationTriangle,
    FaCashRegister,
    FaCog,
    FaServer,
    FaBell,
    FaChevronDown
} from 'react-icons/fa';

export default function AdminLayout({ children }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [subscriptionData, setSubscriptionData] = useState(null);
    const [pendingHolidays, setPendingHolidays] = useState([]);
    const [showHolidayModal, setShowHolidayModal] = useState(false);
    const [holidayMinimized, setHolidayMinimized] = useState(
        () => sessionStorage.getItem('holidayDismissedSession') === '1'
    );
    const [alertsOpen, setAlertsOpen] = useState(false);
    const { user, logout, isOwner, isManager, getAuthHeaders, impersonating, isSuperAdmin } = useAdminAuth();
    const { restaurantStatus, setRestaurantStatus, setSubscriptionInfo } = useRestaurantStatus();
    const location = useLocation();
    const navigate = useNavigate();
    const lastFcmMessageIdsRef = useRef(new Set());
    const fcmNotifCountRef = useRef(0);
    const lastAnalyticsSigRef = useRef('');
    const lastKnownOrderCountRef = useRef(
        (() => { const s = sessionStorage.getItem('lastKnownOrderId'); return s ? Number(s) : null; })()
    );

    // פתיחת נעילת אודיו בלחיצה ראשונה (חובה ב-PWA)
    useEffect(() => {
        SoundManager.setupAutoUnlock();
    }, []);

    // ===== גיבוי: פולינג כל 15 שניות לזיהוי הזמנות חדשות =====
    // עובד גם כש-FCM/SW לא מעבירים הודעות (PWA standalone)
    useEffect(() => {
        if (!user) return;
        const poll = async () => {
            try {
                const res = await api.get('/admin/orders?per_page=1', { headers: getAuthHeaders() });
                const orders = res.data?.orders?.data || res.data?.orders || [];
                const latestId = orders[0]?.id ?? null;
                if (latestId && lastKnownOrderCountRef.current !== null && latestId > lastKnownOrderCountRef.current) {
                    SoundManager.play();
                    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                        try { new Notification('הזמנה חדשה', { body: `הזמנה #${latestId}`, icon: '/icon-192.png' }); } catch (_) { }
                    }
                }
                if (latestId) {
                    lastKnownOrderCountRef.current = latestId;
                    try { sessionStorage.setItem('lastKnownOrderId', String(latestId)); } catch (_) { }
                }
            } catch (_) { /* silent */ }
        };
        poll();
        const interval = setInterval(poll, 15_000);
        return () => clearInterval(interval);
    }, [user, getAuthHeaders]);

    // FCM בכל דפי האדמין — צלצול רק ל-new_order (מטבח)
    useEffect(() => {
        if (!user) return undefined;

        // האזנה ל-postMessage מ-Service Worker (כשהאפליקציה פתוחה)
        const unsubSw = SoundManager.listenServiceWorkerMessages((payload) => {
            const title = payload?.notification?.title || payload?.data?.title || PRODUCT_NAME;
            const body = payload?.notification?.body || payload?.data?.body || 'הזמנה חדשה';
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                try { new Notification(title, { body, icon: '/icon-192.png' }); } catch (_) { }
            }
        });

        const unsubscribe = listenForegroundMessages((payload) => {
            const msgId = payload?.messageId || payload?.data?.messageId || payload?.data?.google?.message_id;
            if (msgId) {
                if (lastFcmMessageIdsRef.current.has(msgId)) return;
                lastFcmMessageIdsRef.current.add(msgId);
                setTimeout(() => lastFcmMessageIdsRef.current.delete(msgId), 30_000);
            }

            const dataType = payload?.data?.type;
            if (dataType === 'new_order') {
                SoundManager.play();
            }

            const title = payload?.notification?.title || payload?.data?.title || PRODUCT_NAME;
            const body = payload?.notification?.body || payload?.data?.body || 'התראה חדשה';

            // future_order_created — בלי חלון מערכת (רק לוגיקת אחרות אם תתווסף); צלצול כבר מדולג
            if (dataType === 'future_order_created') {
                return;
            }

            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                try {
                    const n = new Notification(title, { body, icon: '/icon-192.png' });
                    n.onclick = () => {
                        n.close();
                        window.focus();
                        fcmNotifCountRef.current = Math.max(0, fcmNotifCountRef.current - 1);
                        if (fcmNotifCountRef.current > 0) {
                            if (navigator.setAppBadge) navigator.setAppBadge(fcmNotifCountRef.current).catch(() => { });
                        } else if (navigator.clearAppBadge) {
                            navigator.clearAppBadge().catch(() => { });
                        }
                        const url = payload?.data?.url;
                        if (url && typeof url === 'string' && url.startsWith('/')) {
                            navigate(url);
                        } else if (payload?.data?.orderId) {
                            navigate('/admin/orders');
                        }
                    };
                    fcmNotifCountRef.current += 1;
                    if (navigator.setAppBadge) navigator.setAppBadge(fcmNotifCountRef.current).catch(() => { });
                } catch (e) {
                    console.warn('[FCM] Notification() failed', e);
                }
            }
        });
        return () => {
            if (typeof unsubscribe === 'function') unsubscribe();
            unsubSw();
        };
    }, [user, navigate]);

    useEffect(() => {
        const clearBadge = () => {
            if (document.visibilityState === 'visible') {
                fcmNotifCountRef.current = 0;
                if (navigator.clearAppBadge) navigator.clearAppBadge().catch(() => { });
            }
        };
        clearBadge();
        document.addEventListener('visibilitychange', clearBadge);
        return () => document.removeEventListener('visibilitychange', clearBadge);
    }, []);

    useEffect(() => {
        if (!user) return;
        const pageKey = resolveRestaurantAdminPageKey(location.pathname);
        if (!pageKey) return;
        const sig = `${pageKey}|${location.pathname}|${location.search}|${user?.id ?? ''}`;
        if (lastAnalyticsSigRef.current === sig) return;
        lastAnalyticsSigRef.current = sig;
        sendRestaurantAdminPageView(pageKey, getAuthHeaders, {
            path: location.pathname + location.search,
        });
    }, [location.pathname, location.search, user?.id, getAuthHeaders]);

    // טען סטטוס המסעדה בכל טעינה של layout
    useEffect(() => {
        const fetchRestaurantStatus = async () => {
            try {
                const headers = getAuthHeaders();
                const [response, statusResponse] = await Promise.all([
                    api.get('/admin/restaurant', { headers }),
                    api.get('/admin/subscription/status', { headers }).catch(() => null),
                ]);
                const statusData = statusResponse?.data?.data ?? statusResponse?.data;
                if (response.data.success) {
                    const restaurant = response.data.restaurant;
                    setRestaurantStatus({
                        is_open: restaurant.is_open ?? false,
                        is_open_now: restaurant.is_open_now ?? restaurant.is_open,
                        is_override: restaurant.is_override_status || false,
                        is_approved: restaurant.is_approved ?? false,
                        active_orders_count: restaurant.active_orders_count || 0,
                    });
                    // שמור נתוני subscription לתצוגת Trial Banner + Payment Failed Banner
                    setSubscriptionData({
                        subscription_status: restaurant.subscription_status,
                        trial_ends_at: restaurant.trial_ends_at,
                        tier: restaurant.tier,
                        subscription_plan: restaurant.subscription_plan,
                        payment_failed_at: restaurant.payment_failed_at,
                        payment_failure_grace_days_left: restaurant.payment_failure_grace_days_left ?? 0,
                        is_in_grace_period: restaurant.is_in_grace_period ?? false,
                        subscription_paused: restaurant.subscription_paused ?? false,
                    });
                    // שמור גם בקונטקסט גלובלי לשימוש בכל הדפים
                    setSubscriptionInfo({
                        tier: restaurant.tier,
                        subscription_status: restaurant.subscription_status,
                        subscription_plan: restaurant.subscription_plan,
                        trial_ends_at: restaurant.trial_ends_at,
                        features: statusData?.features || {},
                        featureRequiredTier: statusData?.feature_required_tier || {},
                        ordersLimit: statusData?.orders_limit ?? null,
                        ordersThisMonth: statusData?.orders_this_month ?? 0,
                        ordersLimitEnabled: statusData?.orders_limit_enabled ?? false,
                    });
                }
            } catch (error) {
                console.error('Failed to fetch restaurant status:', error);
            }
        };

        if (user) {
            fetchRestaurantStatus();
            // רענן כל 30 שניות
            const interval = setInterval(fetchRestaurantStatus, 30000);
            return () => clearInterval(interval);
        }
    }, [user, getAuthHeaders, setRestaurantStatus]);

    // בדיקת חגים ממתינים — polling כל 60 שניות
    useEffect(() => {
        if (!user) return;
        const checkHolidays = async () => {
            try {
                const res = await holidayService.getUpcomingHolidays();
                const unanswered = (res.data || []).filter(h => !h.response);
                setPendingHolidays(unanswered);
                // פתח מלא רק אם לא דחה בסשן הנוכחי
                if (unanswered.length > 0 && sessionStorage.getItem('holidayDismissedSession') !== '1') {
                    setShowHolidayModal(true);
                    setHolidayMinimized(false);
                }
            } catch (e) {
                // silent — לא נכשלים על חגים
            }
        };
        checkHolidays();
        const interval = setInterval(checkHolidays, 60000);
        return () => clearInterval(interval);
    }, [user]);

    const handleLogout = async () => {
        await logout();
        navigate('/admin/login');
    };

    const menuItems = [
        {
            path: '/admin/dashboard',
            icon: <FaChartPie />,
            label: 'דשבורד',
            show: true
        },
        {
            path: '/admin/orders',
            icon: <FaClipboardList />,
            label: 'הזמנות',
            show: true
        },
        {
            path: '/admin/terminal',
            icon: <FaDesktop />,
            label: 'מסוף סניף',
            show: true
        },
        {
            path: '/admin/menu-management',
            icon: <FaUtensils />,
            label: 'ניהול תפריט',
            show: isManager()
        },
        {
            path: '/admin/reports-center',
            icon: <FaChartBar />,
            label: 'דוחות',
            show: true
        },
        {
            path: '/admin/coupons',
            icon: <FaTicketAlt />,
            label: 'מבצעים',
            show: isManager()
        },
        {
            path: '/admin/devices',
            icon: <FaServer />,
            label: 'מכשירים',
            show: isManager()
        },
        {
            path: '/admin/settings-hub',
            icon: <FaCog />,
            label: 'הגדרות',
            show: true
        },
    ].filter(item => item.show);

    const statusBadge = (
        <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1 shadow-sm ${restaurantStatus.is_open_now
                ? 'bg-green-100 text-green-700 border border-green-200'
                : 'bg-red-100 text-red-700 border border-red-200'
                }`}>
                <span className={`w-2 h-2 rounded-full ${restaurantStatus.is_open_now ? 'bg-green-500' : 'bg-red-500'}`}></span>
                {restaurantStatus.is_open_now ? 'פתוח' : 'סגור'}
            </span>
            {restaurantStatus.is_approved === false && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">
                    ממתין לאישור
                </span>
            )}
            {restaurantStatus.is_override && (
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-semibold border border-yellow-200">
                    🔒 כפוי
                </span>
            )}
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col w-full overflow-x-hidden" dir="rtl">
            <ImpersonationBanner />
            <div className="flex flex-1 min-h-0">
                <DashboardSidebar
                    isOpen={sidebarOpen}
                    isCollapsed={isCollapsed}
                    toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                    toggleCollapse={() => setIsCollapsed(!isCollapsed)}
                    menuItems={menuItems}
                    onLogout={handleLogout}
                    title={PRODUCT_NAME}
                    impersonating={!!impersonating}
                />

                <div className={`flex-1 min-w-0 flex flex-col min-h-screen transition-all duration-300 ${isCollapsed ? 'lg:mr-20' : 'lg:mr-72'}`}>
                    <DashboardHeader
                        toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                        user={user}
                        title={menuItems.find(item => location.pathname === item.path || location.pathname.startsWith(item.path + '/'))?.label || 'ניהול מסעדה'}
                        isCollapsed={isCollapsed}
                        endContent={statusBadge}
                        notificationCount={restaurantStatus.active_orders_count || 0}
                        impersonating={!!impersonating}
                        profilePath="/admin/settings"
                    />

                    <main className={`flex-1 p-4 lg:p-8 overflow-x-hidden ${impersonating ? 'mt-[7.5rem]' : 'mt-20'}`}>
                        <AlertsPanel
                            restaurantStatus={restaurantStatus}
                            subscriptionData={subscriptionData}
                            pendingHolidays={pendingHolidays}
                            isOwner={isOwner}
                            isManager={isManager}
                            navigate={navigate}
                            alertsOpen={alertsOpen}
                            setAlertsOpen={setAlertsOpen}
                            onHolidayClick={() => { setShowHolidayModal(true); setHolidayMinimized(false); }}
                        />

                        {children}
                    </main>
                </div>

                {/* סוכן AI ספציפי למסעדה - עם מכסת קרדיטים */}
                {isSuperAdmin() && impersonating ? (
                    <FloatingSystemAdminButtons isSidebarOpen={sidebarOpen} />
                ) : (
                    <FloatingRestaurantAssistant isSidebarOpen={sidebarOpen} />
                )}
            </div>

            {/* מודל חגים — גלובלי לכל דפי האדמין */}
            <HolidayScheduleModal
                show={showHolidayModal}
                onClose={() => {
                    setShowHolidayModal(false);
                    // אחרי דלג — ממזער לכפתור צף + שומר בסשן שלא יקפוץ שוב
                    if (pendingHolidays.length > 0) {
                        setHolidayMinimized(true);
                        sessionStorage.setItem('holidayDismissedSession', '1');
                    }
                }}
                onResponded={async () => {
                    try {
                        const res = await holidayService.getUpcomingHolidays();
                        const unanswered = (res.data || []).filter(h => !h.response);
                        setPendingHolidays(unanswered);
                        // אם אין עוד חגים ממתינים — נקה הכל
                        if (unanswered.length === 0) {
                            setHolidayMinimized(false);
                            sessionStorage.removeItem('holidayDismissedSession');
                        }
                    } catch (e) { }
                }}
            />

            {/* כפתור צף ממוזער — חגים ממתינים */}
            {holidayMinimized && !showHolidayModal && pendingHolidays.length > 0 && (
                <button
                    onClick={() => {
                        setShowHolidayModal(true);
                        setHolidayMinimized(false);
                    }}
                    className="fixed bottom-6 right-6 z-[900] flex items-center gap-2 bg-white border border-amber-300 shadow-lg shadow-amber-100 rounded-2xl px-4 py-3 hover:shadow-xl hover:border-amber-400 transition-all group animate-[fadeIn_0.3s_ease-out]"
                    dir="rtl"
                >
                    <span className="text-xl">🕎</span>
                    <div className="text-right">
                        <p className="text-sm font-black text-gray-800">
                            {pendingHolidays.length === 1 ? pendingHolidays[0].name : `${pendingHolidays.length} חגים`}
                        </p>
                        <p className="text-[10px] text-amber-600 font-bold">לחץ לעדכון שעות</p>
                    </div>
                    <span className="w-5 h-5 bg-amber-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">
                        {pendingHolidays.length}
                    </span>
                </button>
            )}
        </div>
    );
}

// פאנל התראות מקובץ — שורה אחת קומפקטית עם פתיחה/סגירה
function AlertsPanel({ restaurantStatus, subscriptionData, pendingHolidays, isOwner, isManager, navigate, alertsOpen, setAlertsOpen, onHolidayClick }) {
    const alerts = [];

    if (restaurantStatus.is_approved === false) {
        alerts.push({ id: 'approval', label: 'ממתין לאישור' });
    }
    if (subscriptionData?.subscription_paused && !isOwner() && !isManager()) {
        alerts.push({ id: 'paused', label: 'מנוי מושהה' });
    }
    if (subscriptionData?.subscription_status === 'trial' && subscriptionData?.trial_ends_at) {
        const daysLeft = Math.ceil((new Date(subscriptionData.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24));
        if (daysLeft > 0) {
            alerts.push({ id: 'trial', label: `ניסיון — ${daysLeft} ימים` });
        }
    }
    if (subscriptionData?.subscription_status === 'active' && subscriptionData?.payment_failed_at && subscriptionData?.is_in_grace_period) {
        alerts.push({ id: 'payment', label: 'חיוב נכשל' });
    }
    if (pendingHolidays.length > 0) {
        alerts.push({ id: 'holidays', label: `${pendingHolidays.length} חגים` });
    }

    if (alerts.length === 0) return null;

    return (
        <div className="mb-4">
            {/* שורה קומפקטית */}
            <button
                onClick={() => setAlertsOpen(!alertsOpen)}
                className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white shadow-sm hover:bg-gray-50 transition-all"
            >
                <div className="relative">
                    <FaBell className="text-orange-500" size={16} />
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-gray-800 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                        {alerts.length}
                    </span>
                </div>
                <div className="flex items-center gap-2 flex-1 overflow-x-auto no-scrollbar">
                    {alerts.map(a => (
                        <span key={a.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border whitespace-nowrap bg-gray-50 border-gray-200 text-gray-600">
                            {a.label}
                        </span>
                    ))}
                </div>
                <FaChevronDown className={`text-gray-400 transition-transform flex-shrink-0 ${alertsOpen ? 'rotate-180' : ''}`} size={12} />
            </button>

            {/* תוכן מורחב */}
            {alertsOpen && (
                <div className="mt-3 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    {restaurantStatus.is_approved === false && (
                        <div className="rounded-xl border border-gray-200 bg-white p-3 text-gray-700">
                            <div className="flex items-start gap-2">
                                <FaClock className="text-gray-400 mt-0.5 shrink-0" size={14} />
                                <div>
                                    <p className="font-bold text-sm">ממתין לאישור מנהל מערכת</p>
                                    <p className="text-xs text-gray-500">פעולות פתיחה/סגירה והזמנות מנוטרלות עד לאישור.</p>
                                </div>
                            </div>
                        </div>
                    )}
                    {subscriptionData?.subscription_paused && !isOwner() && !isManager() && (
                        <SubscriptionPausedBanner />
                    )}
                    {subscriptionData && <TrialBanner {...subscriptionData} navigate={navigate} />}
                    {subscriptionData && <PaymentFailedBanner {...subscriptionData} navigate={navigate} />}
                    {pendingHolidays.length > 0 && (
                        <div
                            role="button" tabIndex={0}
                            onClick={onHolidayClick}
                            onKeyDown={e => e.key === 'Enter' && onHolidayClick()}
                            className="rounded-xl border border-gray-200 bg-white p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <FaClock className="text-gray-400 shrink-0" size={14} />
                                <p className="font-bold text-sm text-gray-700 flex-1">
                                    {pendingHolidays.length === 1
                                        ? `חג קרוב: ${pendingHolidays[0].name} — נא לעדכן`
                                        : `${pendingHolidays.length} חגים קרובים — נא לעדכן שעות פעילות`}
                                </p>
                                <FaExclamationTriangle className="text-gray-400" size={12} />
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// Payment Failed Banner - מוצג כשיש כשלון בחיוב והמסעדה עדיין בתוך תקופת חסד
function PaymentFailedBanner({ subscription_status, payment_failed_at, payment_failure_grace_days_left, is_in_grace_period, navigate }) {
    if (subscription_status !== 'active' || !payment_failed_at || !is_in_grace_period) return null;

    const daysLeft = payment_failure_grace_days_left ?? 0;

    return (
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-500">
                        <FaExclamationTriangle size={24} />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-gray-900">
                            חיוב המנוי לא הצליח
                        </h3>
                        <p className="text-gray-600 font-medium mt-1">
                            נותרו <strong className="text-gray-900">{daysLeft} ימים</strong>
                            {' '}לעדכון אמצעי התשלום לפני השעיית החשבון. אנא עדכן את פרטי התשלום כדי להמשיך.
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => navigate('/admin/paywall')}
                    className="bg-gray-900 text-white px-6 py-3 rounded-2xl font-black hover:bg-gray-800 transition-all whitespace-nowrap"
                >
                    עדכן תשלום
                </button>
            </div>
        </div>
    );
}

// Subscription Paused Banner — מוצג לעובדים שאינם בעלים/מנהלים כשהמנוי לא פעיל
function SubscriptionPausedBanner() {
    return (
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-500">
                    <FaShieldAlt size={24} />
                </div>
                <div>
                    <h3 className="text-xl font-black text-gray-900">
                        המערכת בהשהיה זמנית
                    </h3>
                    <p className="text-gray-600 font-medium mt-1">
                        מנהל המסעדה מטפל בעדכון החשבון. ניתן להמשיך לעבוד כרגיל — חוזרים לפעילות מלאה בקרוב.
                    </p>
                </div>
            </div>
        </div>
    );
}

// Trial Banner Component
function TrialBanner({ subscription_status, trial_ends_at, tier, subscription_plan, navigate }) {
    if (subscription_status !== 'trial' || !trial_ends_at) return null;

    const daysLeft = Math.ceil((new Date(trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24));

    if (daysLeft <= 0) return null; // אם פג התוקף, Middleware יפנה ל-paywall

    return (
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-500">
                        <FaClock size={24} />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-gray-900">
                            תקופת ניסיון פעילה
                        </h3>
                        <p className="text-gray-600 font-medium mt-1">
                            נותרו <strong className="text-gray-900">{daysLeft} ימים</strong>
                            {' '}לתקופת הניסיון החינמית • תוכנית: <strong>{tier === 'basic' ? 'Basic' : 'Pro'}</strong>
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => navigate('/admin/paywall')}
                    className="bg-gray-900 text-white px-6 py-3 rounded-2xl font-black hover:bg-gray-800 transition-all whitespace-nowrap"
                >
                    הפעל מנוי
                </button>
            </div>
        </div>
    );
}
