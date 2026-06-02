import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext';
import AdminNotificationProvider from './context/AdminNotificationProvider';
import { RestaurantStatusProvider } from './context/RestaurantStatusContext';
import { CartProvider } from './context/CartContext';
import { PromotionProvider } from './context/PromotionContext';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import { CustomerProvider } from './context/CustomerContext';
import DevModeBanner from './components/DevModeBanner';
import CookieConsent from './components/CookieConsent';
import AnalyticsPublicTracker from './components/AnalyticsPublicTracker';
import FacebookInAppWarning from './components/FacebookInAppWarning';
import PWAInstallBanner from './components/PWAInstallBanner';
import { InstallPromptProvider } from './context/InstallPromptContext';
import PwaCustomerEngagement from './components/PwaCustomerEngagement';

// === Lazy loader עם רענון אוטומטי כשה-chunk נעלם אחרי deploy ===
// כשהמשתמש משאיר טאב פתוח ואנחנו מעלים build חדש, ה-chunks הישנים נמחקים.
// ה-rewrite של Vercel מחזיר index.html במקום JS → דפדפן זורק:
//   "TypeError: 'text/html' is not a valid JavaScript MIME type" / "Failed to fetch dynamically imported module".
// במקרה כזה נרענן פעם אחת אוטומטית כדי לטעון את ה-build העדכני.
const CHUNK_RELOAD_KEY = 'takeeat:chunkReloadAttempt';
function lazyWithRetry(loader) {
  return lazy(async () => {
    try {
      return await loader();
    } catch (err) {
      const msg = String(err?.message || err || '');
      const isChunkError =
        /Failed to fetch dynamically imported module/i.test(msg) ||
        /Importing a module script failed/i.test(msg) ||
        /Loading chunk \d+ failed/i.test(msg) ||
        /'text\/html' is not a valid JavaScript MIME type/i.test(msg) ||
        /ChunkLoadError/i.test(err?.name || '');
      if (isChunkError && typeof window !== 'undefined') {
        const already = sessionStorage.getItem(CHUNK_RELOAD_KEY);
        if (!already) {
          sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
          window.location.reload();
          // החזרת promise תלוי שלא ייפתר עד שהדף יתרענן.
          return new Promise(() => { });
        }
      }
      throw err;
    }
  });
}
// ניקוי הדגל לאחר טעינה מוצלחת של האפליקציה (בריצה ראשונה אחרי הרענון).
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    try { sessionStorage.removeItem(CHUNK_RELOAD_KEY); } catch (_) { /* noop */ }
  });
}

// === Lazy-loaded pages — code splitting ===
// עמודי לקוח
const HomePage = lazyWithRetry(() => import('./pages/HomePage'));
const MenuPage = lazyWithRetry(() => import('./pages/MenuPage'));
const CartPage = lazyWithRetry(() => import('./pages/CartPage'));
const OrderStatusPage = lazyWithRetry(() => import('./pages/OrderStatusPage'));
const CustomerOrderHistory = lazyWithRetry(() => import('./pages/CustomerOrderHistory'));
const NotFoundPage = lazyWithRetry(() => import('./pages/NotFoundPage'));
const RegisterRestaurant = lazyWithRetry(() => import('./pages/RegisterRestaurant'));
const LandingPage = lazyWithRetry(() => import('./pages/LandingPage'));
const RestaurantsListPage = lazyWithRetry(() => import('./pages/RestaurantsListPage'));
const NewRestaurantsPage = lazyWithRetry(() => import('./pages/NewRestaurantsPage'));
const AboutPage = lazyWithRetry(() => import('./pages/AboutPage'));
const RestaurantSharePage = lazyWithRetry(() => import('./pages/RestaurantSharePage'));
const VerifyEmailPage = lazyWithRetry(() => import('./pages/VerifyEmailPage'));
const PaymentCallback = lazyWithRetry(() => import('./pages/PaymentCallback'));
const DebugAPI = lazyWithRetry(() => import('./pages/DebugAPI'));
const ScreenViewer = lazyWithRetry(() => import('./pages/ScreenViewer'));
const KioskViewer = lazyWithRetry(() => import('./pages/KioskViewer'));

// משפטי
const TermsEndUser = lazyWithRetry(() => import('./pages/legal/TermsEndUser'));
const TermsRestaurant = lazyWithRetry(() => import('./pages/legal/TermsRestaurant'));
const PrivacyPolicy = lazyWithRetry(() => import('./pages/legal/PrivacyPolicy'));

// אדמין
const AdminLogin = lazyWithRetry(() => import('./pages/admin/AdminLogin'));
const AdminDashboard = lazyWithRetry(() => import('./pages/admin/AdminDashboard'));
const AdminOrders = lazyWithRetry(() => import('./pages/admin/AdminOrders'));
const AdminEmployees = lazyWithRetry(() => import('./pages/admin/AdminEmployees'));
const AdminRestaurant = lazyWithRetry(() => import('./pages/admin/AdminRestaurant'));
const AdminMenuPreview = lazyWithRetry(() => import('./pages/admin/AdminMenuPreview'));
const AdminCartPreview = lazyWithRetry(() => import('./pages/admin/AdminCartPreview'));
const AdminOrderStatusPreview = lazyWithRetry(() => import('./pages/admin/AdminOrderStatusPreview'));
const AdminTerminal = lazyWithRetry(() => import('./pages/admin/AdminTerminal'));
const AdminPaywall = lazyWithRetry(() => import('./pages/admin/AdminPaywall'));
const PaymentDemo = lazyWithRetry(() => import('./pages/admin/PaymentDemo'));
const PaymentSuccess = lazyWithRetry(() => import('./pages/admin/PaymentSuccess'));
const PaymentError = lazyWithRetry(() => import('./pages/admin/PaymentError'));
const AdminDeliveryZones = lazyWithRetry(() => import('./pages/admin/AdminDeliveryZones'));
const AdminCoupons = lazyWithRetry(() => import('./pages/admin/AdminCoupons'));
const AdminSimulator = lazyWithRetry(() => import('./pages/admin/AdminSimulator'));
const AdminQrCode = lazyWithRetry(() => import('./pages/admin/AdminQrCode'));
const POSLite = lazyWithRetry(() => import('./features/pos/POSLite'));
const AdminPaymentSettings = lazyWithRetry(() => import('./pages/admin/AdminPaymentSettings'));
const AdminUserSettings = lazyWithRetry(() => import('./pages/admin/AdminUserSettings'));
const AdminAuthDebug = lazyWithRetry(() => import('./pages/admin/AdminAuthDebug'));
const AdminMenuManagement = lazyWithRetry(() => import('./pages/admin/AdminMenuManagement'));
const AdminReportsCenter = lazyWithRetry(() => import('./pages/admin/AdminReportsCenter'));
const AdminMyHours = lazyWithRetry(() => import('./pages/admin/AdminMyHours'));
const AdminDevices = lazyWithRetry(() => import('./pages/admin/AdminDevices'));
const AdminSettingsHub = lazyWithRetry(() => import('./pages/admin/AdminSettingsHub'));
const AdminRestaurantGuide = lazyWithRetry(() => import('./pages/admin/AdminRestaurantGuide'));
const AdminAbandonedCartReminders = lazyWithRetry(() => import('./pages/admin/AdminAbandonedCartReminders'));
const AdminSoundSettings = lazyWithRetry(() => import('./pages/admin/AdminSoundSettings'));

// סופר-אדמין
const SuperAdminDashboard = lazyWithRetry(() => import('./pages/super-admin/SuperAdminDashboard'));
const SuperAdminReports = lazyWithRetry(() => import('./pages/super-admin/SuperAdminReports'));
const SuperAdminInvoices = lazyWithRetry(() => import('./pages/super-admin/SuperAdminInvoices'));
const SuperAdminManualBilling = lazyWithRetry(() => import('./pages/super-admin/SuperAdminManualBilling'));
const SuperAdminSettings = lazyWithRetry(() => import('./pages/super-admin/SuperAdminSettings'));
const SuperAdminOrderDebug = lazyWithRetry(() => import('./pages/super-admin/SuperAdminOrderDebug'));
const SuperAdminProfile = lazyWithRetry(() => import('./pages/super-admin/SuperAdminProfile'));
const RegionalSettings = lazyWithRetry(() => import('./pages/super-admin/settings/RegionalSettings'));
const BillingSettings = lazyWithRetry(() => import('./pages/super-admin/settings/BillingSettings'));
const SecuritySettings = lazyWithRetry(() => import('./pages/super-admin/settings/SecuritySettings'));
const NotificationSettings = lazyWithRetry(() => import('./pages/super-admin/settings/NotificationSettings'));
const PolicySettings = lazyWithRetry(() => import('./pages/super-admin/settings/PolicySettings'));
const DatabaseMaintenance = lazyWithRetry(() => import('./pages/super-admin/settings/DatabaseMaintenance'));
const DebugAuth = lazyWithRetry(() => import('./pages/super-admin/DebugAuth'));
const SuperAdminAbandonedCarts = lazyWithRetry(() => import('./pages/super-admin/SuperAdminAbandonedCarts'));
const SuperAdminAnalytics = lazyWithRetry(() => import('./pages/super-admin/SuperAdminAnalytics'));
const SuperAdminCustomers = lazyWithRetry(() => import('./pages/super-admin/SuperAdminCustomers'));
const SuperAdminCustomerDetail = lazyWithRetry(() => import('./pages/super-admin/SuperAdminCustomerDetail'));
const SuperAdminNotificationCenter = lazyWithRetry(() => import('./pages/super-admin/SuperAdminNotificationCenter'));
const SuperAdminEmailManagement = lazyWithRetry(() => import('./pages/super-admin/SuperAdminEmailManagement'));
const SuperAdminAnnouncements = lazyWithRetry(() => import('./pages/super-admin/SuperAdminAnnouncements'));
const SuperAdminHolidays = lazyWithRetry(() => import('./pages/super-admin/SuperAdminHolidays'));

import { Toaster } from 'react-hot-toast';
import './App.css';

/**
 * ספינר עגול לטעינת עמודים (Suspense fallback ועוד).
 */
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-white dark:bg-brand-dark-bg" role="status" aria-live="polite">
      <div className="relative h-14 w-14">
        <div className="absolute inset-0 rounded-full border-4 border-brand-primary/15 dark:border-brand-primary/25" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-brand-primary border-r-brand-primary animate-spin" />
      </div>
      <span className="sr-only">טוען...</span>
    </div>
  );
}

/**
 * ממשק ראשי של האפליקציה
 * ניתוב בין עמודי לקוח וממשק מנהל
 */

function AdminRoute({ children }) {
  const { isAuthenticated, loading, user, impersonating } = useAdminAuth();

  if (loading) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  // Allow super admin through if impersonating a restaurant
  if (user?.is_super_admin && !impersonating) {
    return <Navigate to="/super-admin/dashboard" replace />;
  }

  return children;
}

function SuperAdminRoute({ children }) {
  const { isAuthenticated, loading, user } = useAdminAuth();

  if (loading) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  // בדיקה אם המשתמש הוא Super Admin
  if (!user?.is_super_admin) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function AppRoutes() {
  const { tenantId, isLoading } = useAuth();
  const { isAuthenticated: isAdmin } = useAdminAuth();

  if (isLoading) {
    return <PageLoader />;
  }
  if (import.meta.env.DEV) {
    console.log('Tenant ID:', tenantId);
  }
  return (
    <>
      <AnalyticsPublicTracker />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Debug */}
          <Route path="/debug-api" element={<DebugAPI />} />

          {/* משפטי */}
          <Route path="/legal/end-user" element={<TermsEndUser />} />
          <Route path="/legal/restaurant" element={<TermsRestaurant />} />
          <Route path="/legal/privacy" element={<PrivacyPolicy />} />

          {/* לקוחות */}
          <Route path="/" element={<HomePage />} />
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/register-restaurant" element={<RegisterRestaurant />} />

          {/* SEO Hub pages — חשוב: ה-routes האלה חייבים להגיע ל-React בצד-לקוח.
            ב-Vercel יש rewrites שמעבירים visits ראשונים ל-Laravel (שמזריק JSON-LD + meta),
            אך ניווט SPA פנימי מטפל ברוטינג הזה כאן. */}
          <Route path="/restaurants" element={<RestaurantsListPage />} />
          <Route path="/restaurants/new" element={<NewRestaurantsPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/menu" element={tenantId ? <MenuPage /> : <Navigate to="/" />} />
          <Route path="/cart" element={tenantId ? <CartPage /> : <Navigate to="/" />} />
          <Route path="/order-status/:orderId" element={tenantId ? <OrderStatusPage /> : <Navigate to="/" />} />
          <Route path="/my-orders" element={<CustomerOrderHistory />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />

          {/* callback חזרה מ-HYP אחרי תשלום הזמנה */}
          <Route path="/payment/success" element={<PaymentCallback />} />
          <Route path="/payment/error" element={<PaymentCallback />} />
          <Route path="/payment/failed" element={<PaymentCallback />} />

          {/* לינק ישיר למסעדה */}
          <Route path="/:tenantId/menu" element={<MenuPage />} />
          <Route path="/:tenantId/cart" element={<CartPage />} />
          <Route path="/:tenantId/order-status/:orderId" element={<OrderStatusPage />} />

          {/* עמוד שיתוף למסעדה */}
          <Route path="/r/:slug" element={<RestaurantSharePage />} />

          {/* מסך תצוגה ציבורי */}
          <Route path="/screen/:token" element={<ScreenViewer />} />

          {/* קיוסק ציבורי */}
          <Route path="/kiosk/:token" element={<KioskViewer />} />

          {/* אדמין */}
          <Route path="/admin/login" element={isAdmin ? <Navigate to="/admin/dashboard" replace /> : <AdminLogin />} />
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
          <Route
            path="/admin/dashboard"
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/orders"
            element={
              <AdminRoute>
                <AdminOrders />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/menu-management"
            element={
              <AdminRoute>
                <AdminMenuManagement />
              </AdminRoute>
            }
          />
          <Route path="/admin/menu" element={<Navigate to="/admin/menu-management" replace />} />
          <Route path="/admin/menu/bases" element={<Navigate to="/admin/menu-management" replace />} />
          <Route path="/admin/menu/salads" element={<Navigate to="/admin/menu-management" replace />} />
          <Route path="/admin/categories" element={<Navigate to="/admin/menu-management" replace />} />
          <Route
            path="/admin/employees"
            element={
              <AdminRoute>
                <AdminEmployees />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/restaurant"
            element={
              <AdminRoute>
                <AdminRestaurant />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/payment-settings"
            element={
              <AdminRoute>
                <AdminPaymentSettings />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/preview-menu"
            element={
              <AdminRoute>
                <AdminMenuPreview />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/preview-cart"
            element={
              <AdminRoute>
                <AdminCartPreview />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/preview-order-status/:orderId"
            element={
              <AdminRoute>
                <AdminOrderStatusPreview />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/delivery-zones"
            element={
              <AdminRoute>
                <AdminDeliveryZones />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/paywall"
            element={
              <AdminRoute>
                <AdminPaywall />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/payment"
            element={
              <AdminRoute>
                <PaymentDemo />
              </AdminRoute>
            }
          />
          <Route path="/admin/payment/success" element={<PaymentSuccess />} />
          <Route path="/admin/payment/error" element={<PaymentError />} />
          <Route path="/administration/payment/success" element={<PaymentSuccess />} />
          <Route path="/administration/payment/error" element={<PaymentError />} />
          <Route path="/admin/billing" element={<Navigate to="/admin/payment-settings" replace />} />
          <Route
            path="/admin/terminal"
            element={
              <AdminRoute>
                <AdminTerminal />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/coupons"
            element={
              <AdminRoute>
                <AdminCoupons />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/devices"
            element={
              <AdminRoute>
                <AdminDevices />
              </AdminRoute>
            }
          />
          <Route path="/admin/printers" element={<Navigate to="/admin/devices" replace />} />
          <Route path="/admin/print-devices" element={<Navigate to="/admin/devices" replace />} />
          <Route
            path="/admin/simulator"
            element={
              <AdminRoute>
                <AdminSimulator />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/qr-code"
            element={
              <AdminRoute>
                <AdminQrCode />
              </AdminRoute>
            }
          />
          <Route path="/admin/display-screens" element={<Navigate to="/admin/devices" replace />} />
          <Route path="/admin/kiosks" element={<Navigate to="/admin/devices" replace />} />
          <Route
            path="/admin/reports-center"
            element={
              <AdminRoute>
                <AdminReportsCenter />
              </AdminRoute>
            }
          />
          <Route path="/admin/reports" element={<Navigate to="/admin/reports-center" replace />} />
          <Route path="/admin/time-reports" element={<Navigate to="/admin/reports-center" replace />} />
          <Route
            path="/admin/my-hours"
            element={
              <AdminRoute>
                <AdminMyHours />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/pos"
            element={
              <AdminRoute>
                <POSLite />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/auth-debug"
            element={
              <AdminRoute>
                <AdminAuthDebug />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/settings-hub"
            element={
              <AdminRoute>
                <AdminSettingsHub />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/sound-settings"
            element={
              <AdminRoute>
                <AdminSoundSettings />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <AdminRoute>
                <AdminUserSettings />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/guide"
            element={
              <AdminRoute>
                <AdminRestaurantGuide />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/guide/install"
            element={<Navigate to={{ pathname: '/admin/guide', hash: 'install' }} replace />}
          />
          <Route
            path="/admin/abandoned-cart-reminders"
            element={
              <AdminRoute>
                <AdminAbandonedCartReminders />
              </AdminRoute>
            }
          />

          {/* Super Admin */}
          <Route path="/super-admin/login" element={<Navigate to="/admin/login" replace />} />
          <Route path="/super-admin" element={<Navigate to="/super-admin/dashboard" replace />} />
          <Route
            path="/super-admin/dashboard"
            element={
              <SuperAdminRoute>
                <SuperAdminDashboard />
              </SuperAdminRoute>
            }
          />
          <Route
            path="/super-admin/analytics"
            element={
              <SuperAdminRoute>
                <SuperAdminAnalytics />
              </SuperAdminRoute>
            }
          />
          <Route
            path="/super-admin/notification-center"
            element={
              <SuperAdminRoute>
                <SuperAdminNotificationCenter />
              </SuperAdminRoute>
            }
          />
          <Route path="/super-admin/notifications" element={<Navigate to="/super-admin/notification-center" replace />} />
          <Route path="/super-admin/notification-log" element={<Navigate to="/super-admin/notification-center" replace />} />
          <Route path="/super-admin/sms-debug" element={<Navigate to="/super-admin/notification-center" replace />} />
          <Route
            path="/super-admin/reports"
            element={
              <SuperAdminRoute>
                <SuperAdminReports />
              </SuperAdminRoute>
            }
          />
          <Route
            path="/super-admin/invoices"
            element={
              <SuperAdminRoute>
                <SuperAdminInvoices />
              </SuperAdminRoute>
            }
          />
          <Route
            path="/super-admin/billing-manual"
            element={
              <SuperAdminRoute>
                <SuperAdminManualBilling />
              </SuperAdminRoute>
            }
          />
          <Route
            path="/super-admin/settings"
            element={
              <SuperAdminRoute>
                <SuperAdminSettings />
              </SuperAdminRoute>
            }
          />
          <Route
            path="/super-admin/settings/regional"
            element={
              <SuperAdminRoute>
                <RegionalSettings />
              </SuperAdminRoute>
            }
          />
          <Route
            path="/super-admin/settings/billing"
            element={
              <SuperAdminRoute>
                <BillingSettings />
              </SuperAdminRoute>
            }
          />
          <Route
            path="/super-admin/settings/security"
            element={
              <SuperAdminRoute>
                <SecuritySettings />
              </SuperAdminRoute>
            }
          />
          <Route
            path="/super-admin/settings/notifications"
            element={
              <SuperAdminRoute>
                <NotificationSettings />
              </SuperAdminRoute>
            }
          />
          <Route
            path="/super-admin/settings/policies"
            element={
              <SuperAdminRoute>
                <PolicySettings />
              </SuperAdminRoute>
            }
          />
          <Route
            path="/super-admin/settings/database"
            element={
              <SuperAdminRoute>
                <DatabaseMaintenance />
              </SuperAdminRoute>
            }
          />
          <Route
            path="/super-admin/order-debug"
            element={
              <SuperAdminRoute>
                <SuperAdminOrderDebug />
              </SuperAdminRoute>
            }
          />
          <Route
            path="/super-admin/settings/auth-debug"
            element={
              <SuperAdminRoute>
                <DebugAuth />
              </SuperAdminRoute>
            }
          />
          <Route path="/super-admin/debug" element={<Navigate to="/super-admin/settings/auth-debug" replace />} />
          <Route
            path="/super-admin/email-management"
            element={
              <SuperAdminRoute>
                <SuperAdminEmailManagement />
              </SuperAdminRoute>
            }
          />
          <Route path="/super-admin/emails" element={<Navigate to="/super-admin/email-management" replace />} />
          <Route
            path="/super-admin/announcements"
            element={
              <SuperAdminRoute>
                <SuperAdminAnnouncements />
              </SuperAdminRoute>
            }
          />
          <Route
            path="/super-admin/holidays"
            element={
              <SuperAdminRoute>
                <SuperAdminHolidays />
              </SuperAdminRoute>
            }
          />
          <Route
            path="/super-admin/profile"
            element={
              <SuperAdminRoute>
                <SuperAdminProfile />
              </SuperAdminRoute>
            }
          />
          <Route
            path="/super-admin/abandoned-carts"
            element={
              <SuperAdminRoute>
                <SuperAdminAbandonedCarts />
              </SuperAdminRoute>
            }
          />
          <Route
            path="/super-admin/customers"
            element={
              <SuperAdminRoute>
                <SuperAdminCustomers />
              </SuperAdminRoute>
            }
          />
          <Route
            path="/super-admin/customers/:id"
            element={
              <SuperAdminRoute>
                <SuperAdminCustomerDetail />
              </SuperAdminRoute>
            }
          />
          <Route path="/super-admin/email-log" element={<Navigate to="/super-admin/email-management" replace />} />

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
      <PwaCustomerEngagement />
    </>
  );
}

export default function App() {
  return (
    <Router>
      <InstallPromptProvider>
        <ThemeProvider>
          <AdminAuthProvider>
            <AdminNotificationProvider>
              <RestaurantStatusProvider>
                <AuthProvider>
                  <ToastProvider>
                    <CartProvider>
                      <CustomerProvider>
                        <PromotionProvider>
                          <AppRoutes />
                          <Toaster position="bottom-right" />
                          {!new URLSearchParams(window.location.search).has('embed') && (
                            <>
                              <FacebookInAppWarning />
                              <DevModeBanner />
                              <CookieConsent />
                              <PWAInstallBanner />
                            </>
                          )}
                        </PromotionProvider>
                      </CustomerProvider>
                    </CartProvider>
                  </ToastProvider>
                </AuthProvider>
              </RestaurantStatusProvider>
            </AdminNotificationProvider>
          </AdminAuthProvider>
        </ThemeProvider>
      </InstallPromptProvider>
    </Router>
  );
}
