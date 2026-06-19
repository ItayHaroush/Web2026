import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import GlobalErrorBoundary from './GlobalErrorBoundary.jsx'
import { getFirebaseMessagingSwUrl } from './utils/deployVersion.js'
import { trackError } from './services/funnelTracker'

// ✅ Signal Init
window.REACT_LOADED = true;

// Health Check — לכידת שגיאות JS גלובליות (רק בהקשר לקוח; הסינון בתוך trackError)
try {
  window.addEventListener('error', (event) => {
    const msg = event?.error?.message || event?.message || '';
    // דלג על "Script error." חוצה-מקור ללא פרטים, ועל שגיאות טעינת משאבים (img/script)
    if (!msg || msg === 'Script error.' || (event?.target && event.target !== window)) return;
    const where = event?.filename ? `${event.filename}:${event.lineno || 0}` : undefined;
    trackError('js_error', msg, { payload: where ? { at: where } : undefined });
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason;
    const msg = reason?.message || (typeof reason === 'string' ? reason : '') || 'Unhandled promise rejection';
    trackError('unhandled_rejection', msg);
  });
} catch {
  /* noop */
}

// Hide the index.html "failed to load" safety-net banner now that the app booted.
try {
  const fbWarning = document.getElementById('fb-warning');
  if (fbWarning) fbWarning.style.display = 'none';
} catch {
  /* noop */
}

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
      .register(getFirebaseMessagingSwUrl())
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
