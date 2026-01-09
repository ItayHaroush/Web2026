import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext';
import { RestaurantStatusProvider } from './context/RestaurantStatusContext';
import { CartProvider } from './context/CartContext';
import { ToastProvider } from './context/ToastContext';
import HomePage from './pages/HomePage';
import MenuPage from './pages/MenuPage';
import CartPage from './pages/CartPage';
import OrderStatusPage from './pages/OrderStatusPage';
import NotFoundPage from './pages/NotFoundPage';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminOrders from './pages/admin/AdminOrders';
import AdminMenu from './pages/admin/AdminMenu';
import AdminCategories from './pages/admin/AdminCategories';
import AdminEmployees from './pages/admin/AdminEmployees';
import AdminRestaurant from './pages/admin/AdminRestaurant';
import AdminTerminal from './pages/admin/AdminTerminal';
import SuperAdminDashboard from './pages/super-admin/SuperAdminDashboard';
import SuperAdminNotifications from './pages/super-admin/SuperAdminNotifications';
import SuperAdminReports from './pages/super-admin/SuperAdminReports';
import SuperAdminSettings from './pages/super-admin/SuperAdminSettings';
import DebugAuth from './pages/super-admin/DebugAuth';
import DebugAPI from './pages/DebugAPI';
import RegisterRestaurant from './pages/RegisterRestaurant';
import LandingPage from './pages/LandingPage';
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
        path="/admin/terminal"
        element={
          <AdminRoute>
            <AdminTerminal />
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

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Router>
      <AdminAuthProvider>
        <RestaurantStatusProvider>
          <AuthProvider>
            <ToastProvider>
              <CartProvider>
                <AppRoutes />
                <Toaster position="bottom-right" />
              </CartProvider>
            </ToastProvider>
          </AuthProvider>
        </RestaurantStatusProvider>
      </AdminAuthProvider>
    </Router>
  );
}
