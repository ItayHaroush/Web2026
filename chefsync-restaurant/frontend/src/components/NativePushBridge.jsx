import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ensureNativeNotificationChannel,
    getNativePushPermissionState,
    isNativePushPlatform,
    listenNativeNotificationTaps,
    openAppNotificationSettings,
    requestNativePushPermission,
} from '../services/nativePush';

const PROMPTED_KEY = 'takeeat_push_prompted';

/**
 * NativePushBridge — רכיב שרץ רק באפליקציה הנייטיב (Capacitor).
 *
 * אחראי על:
 * 1. יצירת ערוץ ההתראות "orders" (חובה כדי שהתראות יוצגו כשהאפליקציה ברקע/סגורה).
 * 2. בקשת הרשאת התראות בהפעלה הראשונה.
 * 3. טיפול בלחיצה על התראה (background/terminated) וניווט למסך ההזמנות.
 * 4. הצגת הסבר + כפתור פתיחת הגדרות כשההרשאה נדחתה.
 */
export default function NativePushBridge() {
    const navigate = useNavigate();
    const [permission, setPermission] = useState('granted');
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        if (!isNativePushPlatform()) return undefined;

        let cancelled = false;

        (async () => {
            await ensureNativeNotificationChannel();

            // בקשת הרשאה בהפעלה הראשונה בלבד; אחר כך רק קוראים את המצב.
            let state;
            const alreadyPrompted = (() => {
                try { return localStorage.getItem(PROMPTED_KEY) === '1'; } catch { return false; }
            })();

            if (alreadyPrompted) {
                state = await getNativePushPermissionState();
            } else {
                state = await requestNativePushPermission();
                try { localStorage.setItem(PROMPTED_KEY, '1'); } catch { /* ignore */ }
            }

            if (!cancelled) setPermission(state);
        })();

        const unsub = listenNativeNotificationTaps((data) => {
            const url = data?.url;
            if (url && typeof url === 'string' && url.startsWith('/')) {
                navigate(url);
            } else if (data?.orderId) {
                navigate('/admin/orders');
            } else {
                navigate('/admin/dashboard');
            }
        });

        return () => {
            cancelled = true;
            unsub();
        };
    }, [navigate]);

    if (permission !== 'denied' || dismissed) {
        return null;
    }

    return (
        <div
            dir="rtl"
            style={{
                position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100000,
                background: 'linear-gradient(135deg,#7c2d12 0%,#9a3412 100%)',
                color: '#fff', padding: '10px 16px', display: 'flex',
                alignItems: 'center', gap: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
            }}
        >
            <span style={{ fontSize: 20 }}>🔕</span>
            <div style={{ flex: 1, fontSize: 13, lineHeight: 1.35 }}>
                <strong>ההתראות כבויות.</strong> לא תקבלו התראה על הזמנות חדשות.
                כדי להפעיל — פתחו את ההגדרות ואשרו התראות.
            </div>
            <button
                onClick={openAppNotificationSettings}
                style={{
                    background: '#fff', color: '#9a3412', border: 'none', borderRadius: 8,
                    padding: '7px 14px', fontWeight: 800, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
                }}
            >
                פתח הגדרות
            </button>
            <button
                onClick={() => setDismissed(true)}
                aria-label="סגור"
                style={{ background: 'transparent', color: '#fff', border: 'none', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}
            >
                ×
            </button>
        </div>
    );
}
