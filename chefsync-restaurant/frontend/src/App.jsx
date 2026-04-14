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
import PwaCustomerEngagement from './components/PwaCustomerEngagement';
import HomePage from './pages/HomePage';
import MenuPage from './pages/MenuPage';
import CartPage from './pages/CartPage';
import OrderStatusPage from './pages/OrderStatusPage';
import CustomerOrderHistory from './pages/CustomerOrderHistory';
import NotFoundPage from './pages/NotFoundPage';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminOrders from './pages/admin/AdminOrders';
import AdminEmployees from './pages/admin/AdminEmployees';
import AdminRestaurant from './pages/admin/AdminRestaurant';
import AdminMenuPreview from './pages/admin/AdminMenuPreview';
import AdminCartPreview from './pages/admin/AdminCartPreview';
import AdminOrderStatusPreview from './pages/admin/AdminOrderStatusPreview';
import AdminTerminal from './pages/admin/AdminTerminal';
import AdminPaywall from './pages/admin/AdminPaywall';
import PaymentDemo from './pages/admin/PaymentDemo';
import PaymentSuccess from './pages/admin/PaymentSuccess';
import PaymentError from './pages/admin/PaymentError';
import AdminDeliveryZones from './pages/admin/AdminDeliveryZones';
import AdminCoupons from './pages/admin/AdminCoupons';
import AdminSimulator from './pages/admin/AdminSimulator';
import AdminQrCode from './pages/admin/AdminQrCode';
import ScreenViewer from './pages/ScreenViewer';
import KioskViewer from './pages/KioskViewer';
import POSLite from './features/pos/POSLite';
import AdminPaymentSettings from './pages/admin/AdminPaymentSettings';
import AdminUserSettings from './pages/admin/AdminUserSettings';
import PaymentCallback from './pages/PaymentCallback';
import AdminAuthDebug from './pages/admin/AdminAuthDebug';
import AdminMenuManagement from './pages/admin/AdminMenuManagement';
import AdminReportsCenter from './pages/admin/AdminReportsCenter';
import AdminMyHours from './pages/admin/AdminMyHours';
import AdminDevices from './pages/admin/AdminDevices';
import AdminSettingsHub from './pages/admin/AdminSettingsHub';
import AdminAbandonedCartReminders from './pages/admin/AdminAbandonedCartReminders';
import SuperAdminDashboard from './pages/super-admin/SuperAdminDashboard';
import SuperAdminReports from './pages/super-admin/SuperAdminReports';
import SuperAdminInvoices from './pages/super-admin/SuperAdminInvoices';
import SuperAdminManualBilling from './pages/super-admin/SuperAdminManualBilling';
import SuperAdminSettings from './pages/super-admin/SuperAdminSettings';
import SuperAdminOrderDebug from './pages/super-admin/SuperAdminOrderDebug';
import SuperAdminProfile from './pages/super-admin/SuperAdminProfile';
import RegionalSettings from './pages/super-admin/settings/RegionalSettings';
import BillingSettings from './pages/super-admin/settings/BillingSettings';
import SecuritySettings from './pages/super-admin/settings/SecuritySettings';
import NotificationSettings from './pages/super-admin/settings/NotificationSettings';
import PolicySettings from './pages/super-admin/settings/PolicySettings';
import DatabaseMaintenance from './pages/super-admin/settings/DatabaseMaintenance';
import DebugAuth from './pages/super-admin/DebugAuth';
import SuperAdminAbandonedCarts from './pages/super-admin/SuperAdminAbandonedCarts';
import SuperAdminAnalytics from './pages/super-admin/SuperAdminAnalytics';
import SuperAdminCustomers from './pages/super-admin/SuperAdminCustomers';
import SuperAdminCustomerDetail from './pages/super-admin/SuperAdminCustomerDetail';
import SuperAdminNotificationCenter from './pages/super-admin/SuperAdminNotificationCenter';
import SuperAdminEmailManagement from './pages/super-admin/SuperAdminEmailManagement';
import SuperAdminAnnouncements from './pages/super-admin/SuperAdminAnnouncements';
import SuperAdminHolidays from './pages/super-admin/SuperAdminHolidays';
import DebugAPI from './pages/DebugAPI';
import RegisterRestaurant from './pages/RegisterRestaurant';
import LandingPage from './pages/LandingPage';
import RestaurantSharePage from './pages/RestaurantSharePage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import TermsEndUser from './pages/legal/TermsEndUser';
import TermsRestaurant from './pages/legal/TermsRestaurant';
import PrivacyPolicy from './pages/legal/PrivacyPolicy';
import { Toaster } from 'react-hot-toast';
import './App.css';

/**
 * ממשק ראשי של האפליקציה
 * ניתוב בין עמודי לקוח וממשק מנהל
 */

function AdminRoute({ children }) {
  const { isAuthenticated, loading, user, impersonating } = useAdminAuth();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">טוען...</div>;
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
    return <div className="flex items-center justify-center min-h-screen">טוען...</div>;
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
    return <div className="flex items-center justify-center min-h-screen">טוען...</div>;
  }
  if (import.meta.env.DEV) {
    console.log('Tenant ID:', tenantId);
  }
  return (
    <>
      <AnalyticsPublicTracker />
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
        <Route
          path="/admin/payment/success"
          element={
            <AdminRoute>
              <PaymentSuccess />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/payment/error"
          element={
            <AdminRoute>
              <PaymentError />
            </AdminRoute>
          }
        />
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
          path="/admin/settings"
          element={
            <AdminRoute>
              <AdminUserSettings />
            </AdminRoute>
          }
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
      <PwaCustomerEngagement />
    </>
  );
}

export default function App() {
  return (
    <Router>
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
    </Router>
  );
}
