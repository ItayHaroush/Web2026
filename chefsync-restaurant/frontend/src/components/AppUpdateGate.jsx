import { useEffect, useState } from 'react';
import { IS_NATIVE_APP } from '../constants/api';
import { checkForAppUpdate, openUpdateUrl } from '../services/appVersion';

const DISMISS_KEY = 'takeeat_update_dismissed_version';

/**
 * AppUpdateGate — רכיב נייטיב בלבד שבודק בהפעלה אם קיימת גרסה חדשה.
 *   required    → חוסם את האפליקציה עד לעדכון.
 *   recommended → באנר עליון ניתן לסגירה.
 */
export default function AppUpdateGate() {
    const [check, setCheck] = useState(null);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        if (!IS_NATIVE_APP) return;
        let cancelled = false;
        (async () => {
            const result = await checkForAppUpdate();
            if (cancelled) return;
            setCheck(result);

            if (result.status === 'recommended') {
                try {
                    const prev = localStorage.getItem(DISMISS_KEY);
                    if (prev && prev === String(result.latestVersionName)) {
                        setDismissed(true);
                    }
                } catch { /* ignore */ }
            }
        })();
        return () => { cancelled = true; };
    }, []);

    if (!IS_NATIVE_APP || !check || check.status === 'ok') return null;

    const update = () => openUpdateUrl(check.updateUrl);

    if (check.status === 'required') {
        return (
            <div
                dir="rtl"
                style={{
                    position: 'fixed', inset: 0, zIndex: 2147483000,
                    background: 'linear-gradient(160deg,#0f172a 0%,#1e293b 100%)',
                    color: '#fff', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center',
                }}
            >
                <div style={{ fontSize: 56, marginBottom: 16 }}>⬆️</div>
                <h1 style={{ fontSize: 24, fontWeight: 900, margin: '0 0 12px' }}>נדרש עדכון</h1>
                <p style={{ fontSize: 15, lineHeight: 1.5, maxWidth: 340, opacity: 0.9, margin: '0 0 28px' }}>
                    גרסה זו של TakeEat Restaurant אינה נתמכת עוד. כדי להמשיך לקבל הזמנות והתראות,
                    יש לעדכן לגרסה האחרונה{check.latestVersionName ? ` (${check.latestVersionName})` : ''}.
                </p>
                <button
                    onClick={update}
                    style={{
                        background: '#f97316', color: '#fff', border: 'none', borderRadius: 14,
                        padding: '14px 40px', fontWeight: 900, fontSize: 16, cursor: 'pointer',
                        boxShadow: '0 8px 24px rgba(249,115,22,0.4)',
                    }}
                >
                    עדכן עכשיו
                </button>
            </div>
        );
    }

    // recommended
    if (dismissed) return null;

    const dismiss = () => {
        setDismissed(true);
        try { localStorage.setItem(DISMISS_KEY, String(check.latestVersionName)); } catch { /* ignore */ }
    };

    return (
        <div
            dir="rtl"
            style={{
                position: 'fixed', top: 0, left: 0, right: 0, zIndex: 2147482000,
                background: 'linear-gradient(135deg,#ea580c 0%,#f97316 100%)',
                color: '#fff', padding: '10px 16px', display: 'flex',
                alignItems: 'center', gap: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
            }}
        >
            <span style={{ fontSize: 20 }}>⬆️</span>
            <div style={{ flex: 1, fontSize: 13, lineHeight: 1.35 }}>
                <strong>גרסה חדשה זמינה{check.latestVersionName ? ` (${check.latestVersionName})` : ''}.</strong> מומלץ לעדכן לחוויה הטובה ביותר.
            </div>
            <button
                onClick={update}
                style={{
                    background: '#fff', color: '#ea580c', border: 'none', borderRadius: 8,
                    padding: '7px 14px', fontWeight: 800, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
                }}
            >
                עדכן
            </button>
            <button
                onClick={dismiss}
                aria-label="סגור"
                style={{ background: 'transparent', color: '#fff', border: 'none', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}
            >
                ×
            </button>
        </div>
    );
}
