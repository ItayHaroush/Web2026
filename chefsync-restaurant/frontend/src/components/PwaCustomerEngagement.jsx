import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useCustomer } from '../context/CustomerContext';
import apiClient, { getPublicTenantId } from '../services/apiClient';
import {
    pingCustomerPwa,
    registerCustomerPush,
    savePendingFcmRegistration,
} from '../services/customerPwaApi';
import { requestCustomerFcmToken } from '../services/fcm';
import { FaBell } from 'react-icons/fa';

const ONBOARDING_KEY = 'pwa_customer_onboarding_v1_done';

function isStandalone() {
    try {
        return window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
    } catch {
        return false;
    }
}

function shouldShowEngagement(pathname) {
    const RESERVED = new Set(['admin', 'super-admin']);
    const m = pathname.match(/^\/([^/]+)\/(menu|cart|order-status)/);
    if (m && !RESERVED.has(m[1].toLowerCase())) return true;
    if (pathname === '/menu' || pathname === '/cart') return true;
    if (pathname.startsWith('/order-status')) return true;
    return false;
}

/** מסך onboarding ראשוני ב-PWA + ping לשרת */
export default function PwaCustomerEngagement() {
    const location = useLocation();
    const { customerToken, openUserModal } = useCustomer();
    const [showModal, setShowModal] = useState(false);
    const [busy, setBusy] = useState(false);

    const tenantId = getPublicTenantId();

    // heartbeat: פתיחת אפליקציה + הרשאות (כשמחובר)
    useEffect(() => {
        if (!shouldShowEngagement(location.pathname)) return;
        const standalone = isStandalone();
        if (!standalone || !tenantId) return;
        let perm = 'default';
        try {
            if ('Notification' in window) {
                if (Notification.permission === 'granted') perm = 'granted';
                else if (Notification.permission === 'denied') perm = 'denied';
            }
        } catch {
            /* */
        }
        pingCustomerPwa(apiClient, {
            tenantId,
            standalone: true,
            pushPermission: perm,
            customerToken: customerToken || undefined,
        });
    }, [location.pathname, tenantId, customerToken]);

    // הצגת מודל חד-פעמי
    useEffect(() => {
        if (!shouldShowEngagement(location.pathname)) return;
        if (!isStandalone() || !tenantId) return;
        try {
            if (localStorage.getItem(ONBOARDING_KEY)) return;
        } catch {
            /* */
        }
        setShowModal(true);
    }, [location.pathname, tenantId]);

    const dismiss = (markDone = true) => {
        if (markDone) {
            try {
                localStorage.setItem(ONBOARDING_KEY, '1');
            } catch {
                /* */
            }
        }
        setShowModal(false);
    };

    const onAllowNotifications = async () => {
        setBusy(true);
        try {
            const token = await requestCustomerFcmToken();
            const tid = getPublicTenantId();
            let perm = 'default';
            try {
                if ('Notification' in window) {
                    if (Notification.permission === 'granted') perm = 'granted';
                    else if (Notification.permission === 'denied') perm = 'denied';
                }
            } catch {
                /* */
            }
            await pingCustomerPwa(apiClient, {
                tenantId: tid,
                standalone: true,
                pushPermission: perm,
                customerToken: customerToken || undefined,
            });
            if (token && tid && customerToken) {
                await registerCustomerPush(apiClient, { tenantId: tid, customerToken, token });
            } else if (token && tid) {
                savePendingFcmRegistration(tid, token);
            }
        } catch (e) {
            console.warn('[PWA customer] notifications setup', e);
        }
        setBusy(false);
        dismiss(true);
    };

    if (!showModal || !isStandalone() || !tenantId) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm" dir="rtl">
            <div className="bg-white dark:bg-neutral-900 text-gray-900 dark:text-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl p-6 space-y-4 border border-gray-100 dark:border-neutral-800">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-orange-500 text-white flex items-center justify-center shadow-lg">
                        <FaBell size={22} />
                    </div>
                    <div>
                        <h2 className="text-lg font-black">קבלו עדכונים מהמסעדה</h2>
                        <p className="text-xs text-gray-500 dark:text-neutral-400 font-bold mt-0.5">
                            מבצעים, סטטוס הזמנה ותזכורות — ישירות למכשיר
                        </p>
                    </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-neutral-300 leading-relaxed">
                    אפשר התראות דחיפה (Push) כדי לא לפספס הזמנות, מבצעים וסלי קניות. ניתן להפעיל או לכבות בכל עת דרך{' '}
                    <strong>פרופיל המשתמש</strong> — מתג «התראות דחיפה».
                </p>
                <div className="flex flex-col gap-2">
                    <button
                        type="button"
                        disabled={busy}
                        onClick={onAllowNotifications}
                        className="w-full py-3.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-black text-sm transition"
                    >
                        {busy ? 'מאשר…' : 'אשר התראות'}
                    </button>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                            dismiss(true);
                            openUserModal();
                        }}
                        className="w-full py-3 rounded-xl bg-white dark:bg-neutral-800 border-2 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300 font-bold text-sm"
                    >
                        פתח פרופיל — התראות
                    </button>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => dismiss(true)}
                        className="w-full py-3 rounded-xl bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-200 font-bold text-sm"
                    >
                        לא עכשיו
                    </button>
                </div>
            </div>
        </div>
    );
}
