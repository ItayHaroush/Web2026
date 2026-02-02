import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

alert('🟢 STEP 4: main.jsx loaded');

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

const isFB = isFacebookBrowser();
alert('🟢 STEP 5: SW check - isFB=' + isFB + ', hasSW=' + ('serviceWorker' in navigator));

if ('serviceWorker' in navigator && !isFB) {
  alert('🟢 STEP 6: Registering Service Worker');
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

alert('🟢 STEP 7: Creating React root');

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

alert('🟢 STEP 8: React rendered successfully!');
