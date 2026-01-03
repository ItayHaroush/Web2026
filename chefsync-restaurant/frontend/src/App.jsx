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
import './App.css';

/**
 * ממשק ראשי של האפליקציה
 * ניתוב בין עמודי לקוח וממשק מנהל
 */

function AdminRoute({ children }) {
  const { isAuthenticated, loading } = useAdminAuth();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">טוען...</div>;
  }

  return isAuthenticated ? children : <Navigate to="/admin/login" replace />;
}

function AppRoutes() {
  const { tenantId, isLoading } = useAuth();
  const { isAuthenticated: isAdmin } = useAdminAuth();

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">טוען...</div>;
  }

  return (
    <Routes>
      {/* לקוחות */}
      <Route path="/" element={<HomePage />} />
      <Route path="/menu" element={tenantId ? <MenuPage /> : <Navigate to="/" />} />
      <Route path="/cart" element={tenantId ? <CartPage /> : <Navigate to="/" />} />
      <Route path="/order-status/:orderId" element={tenantId ? <OrderStatusPage /> : <Navigate to="/" />} />

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
              </CartProvider>
            </ToastProvider>
          </AuthProvider>
        </RestaurantStatusProvider>
      </AdminAuthProvider>
    </Router>
  );
}
