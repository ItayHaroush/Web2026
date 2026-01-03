import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { ToastProvider } from './context/ToastContext';
import HomePage from './pages/HomePage';
import MenuPage from './pages/MenuPage';
import CartPage from './pages/CartPage';
import OrderStatusPage from './pages/OrderStatusPage';
import NotFoundPage from './pages/NotFoundPage';
import './App.css';

/**
 * ממשק ראשי של האפליקציה
 * ניתוב בין עמודי לקוח וממשק מנהל
 */

function AppRoutes() {
  const { tenantId, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">טוען...</div>;
  }

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/menu" element={tenantId ? <MenuPage /> : <Navigate to="/" />} />
      <Route path="/cart" element={tenantId ? <CartPage /> : <Navigate to="/" />} />
      <Route path="/order-status/:orderId" element={tenantId ? <OrderStatusPage /> : <Navigate to="/" />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <ToastProvider>
          <CartProvider>
            <AppRoutes />
          </CartProvider>
        </ToastProvider>
      </AuthProvider>
    </Router>
  );
}
