import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext';
import { RestaurantStatusProvider } from './context/RestaurantStatusContext';
import { CartProvider } from './context/CartContext';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import DevModeBanner from './components/DevModeBanner';
import CookieConsent from './components/CookieConsent';
import FacebookInAppWarning from './components/FacebookInAppWarning';
import HomePage from './pages/HomePage';
import MenuPage from './pages/MenuPage';
import CartPage from './pages/CartPage';
import OrderStatusPage from './pages/OrderStatusPage';
import NotFoundPage from './pages/NotFoundPage';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminOrders from './pages/admin/AdminOrders';
import AdminMenu from './pages/admin/AdminMenu';
import AdminBases from './pages/admin/AdminBases';
import AdminSalads from './pages/admin/AdminSalads';
import AdminCategories from './pages/admin/AdminCategories';
import AdminEmployees from './pages/admin/AdminEmployees';
import AdminRestaurant from './pages/admin/AdminRestaurant';
import AdminMenuPreview from './pages/admin/AdminMenuPreview';
import AdminCartPreview from './pages/admin/AdminCartPreview';
import AdminOrderStatusPreview from './pages/admin/AdminOrderStatusPreview';
import AdminTerminal from './pages/admin/AdminTerminal';
import AdminPaywall from './pages/admin/AdminPaywall';
import PaymentDemo from './pages/admin/PaymentDemo';
import AdminDeliveryZones from './pages/admin/AdminDeliveryZones';
import AdminCoupons from './pages/admin/AdminCoupons';
import AdminPrinters from './pages/admin/AdminPrinters';
import AdminSimulator from './pages/admin/AdminSimulator';
import AdminQrCode from './pages/admin/AdminQrCode';
import AdminDisplayScreens from './pages/admin/AdminDisplayScreens';
import ScreenViewer from './pages/ScreenViewer';
import KioskViewer from './pages/KioskViewer';
import AdminKiosks from './pages/admin/AdminKiosks';
import AdminReports from './pages/admin/AdminReports';
import AdminPaymentSettings from './pages/admin/AdminPaymentSettings';
import AdminAuthDebug from './pages/admin/AdminAuthDebug';
import SuperAdminDashboard from './pages/super-admin/SuperAdminDashboard';
import SuperAdminNotifications from './pages/super-admin/SuperAdminNotifications';
import SuperAdminReports from './pages/super-admin/SuperAdminReports';
import SuperAdminSettings from './pages/super-admin/SuperAdminSettings';
import DebugAuth from './pages/super-admin/DebugAuth';
import SuperAdminSmsDebug from './pages/super-admin/SuperAdminSmsDebug';
import DebugAPI from './pages/DebugAPI';
import RegisterRestaurant from './pages/RegisterRestaurant';
import LandingPage from './pages/LandingPage';
import RestaurantSharePage from './pages/RestaurantSharePage';
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
  const { isAuthenticated, loading, user } = useAdminAuth();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">טוען...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  // אם זה Super Admin, החזר ל-Super Admin dashboard
  if (user?.is_super_admin) {
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
  console.log("Tenant ID:", tenantId);
  return (
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
        path="/admin/menu"
        element={
          <AdminRoute>
            <AdminMenu />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/menu/bases"
        element={
          <AdminRoute>
            <AdminBases />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/menu/salads"
        element={
          <AdminRoute>
            <AdminSalads />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/categories"
        element={
          <AdminRoute>
            <AdminCategories />
          </AdminRoute>
        }
      />
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
        path="/admin/printers"
        element={
          <AdminRoute>
            <AdminPrinters />
          </AdminRoute>
        }
      />
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
      <Route
        path="/admin/display-screens"
        element={
          <AdminRoute>
            <AdminDisplayScreens />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/kiosks"
        element={
          <AdminRoute>
            <AdminKiosks />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/reports"
        element={
          <AdminRoute>
            <AdminReports />
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
        path="/super-admin/notifications"
        element={
          <SuperAdminRoute>
            <SuperAdminNotifications />
          </SuperAdminRoute>
        }
      />
      <Route
        path="/super-admin/reports"
        element={
          <SuperAdminRoute>
            <SuperAdminReports />
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
        path="/super-admin/debug"
        element={
          <SuperAdminRoute>
            <DebugAuth />
          </SuperAdminRoute>
        }
      />
      <Route
        path="/super-admin/sms-debug"
        element={
          <SuperAdminRoute>
            <SuperAdminSmsDebug />
          </SuperAdminRoute>
        }
      />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Router>
      <ThemeProvider>
        <AdminAuthProvider>
          <RestaurantStatusProvider>
            <AuthProvider>
              <ToastProvider>
                <CartProvider>
                  <AppRoutes />
                  <Toaster position="bottom-right" />
                  <FacebookInAppWarning />
                  <DevModeBanner />
                  <CookieConsent />
                </CartProvider>
              </ToastProvider>
            </AuthProvider>
          </RestaurantStatusProvider>
        </AdminAuthProvider>
      </ThemeProvider>
    </Router>
  );
}
