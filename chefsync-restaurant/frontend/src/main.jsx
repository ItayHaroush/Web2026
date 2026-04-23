import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import GlobalErrorBoundary from './GlobalErrorBoundary.jsx'

// ✅ Signal Init
window.REACT_LOADED = true;

// Pre-register the Firebase messaging service worker on the frontend domain
// ⚠️ CRITICAL: Skip Service Worker in Facebook/Instagram in-app browsers
const isFacebookBrowser = () => {
  try {
    const ua = navigator.userAgent || navigator.vendor || window.opera || '';
    return /FBAN|FBAV|Instagram/i.test(ua);
  } catch {
    return false;
  }
};

if ('serviceWorker' in navigator && !isFacebookBrowser()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/firebase-messaging-sw.js')
      .then((reg) => {
        const url = reg?.active?.scriptURL || reg?.installing?.scriptURL || reg?.waiting?.scriptURL;
        console.log('[SW] registered', url || '(no scriptURL yet)');
      })
      .catch((err) => {
        console.error('[SW] register failed', err);
      });
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  </StrictMode>,
)
