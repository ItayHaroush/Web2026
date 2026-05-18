import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import GlobalErrorBoundary from './GlobalErrorBoundary.jsx'
import { getFirebaseMessagingSwUrl } from './utils/deployVersion.js'

// #region agent log
try {
  const ua = typeof navigator !== 'undefined' ? String(navigator.userAgent || '').slice(0, 240) : ''
  fetch('http://127.0.0.1:7917/ingest/8df4a825-2af7-44b5-b28d-f1fe14cba861',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0d5f3e'},body:JSON.stringify({sessionId:'0d5f3e',location:'main.jsx:after-imports',runId:'preload',hypothesisId:'H-A',message:'main_bundle_executed',data:{fbUa:/FBAN|FBAV|Instagram/i.test(ua),uaSnippet:ua},timestamp:Date.now()})}).catch(()=>{});
} catch (_) {}
// #endregion agent log

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
