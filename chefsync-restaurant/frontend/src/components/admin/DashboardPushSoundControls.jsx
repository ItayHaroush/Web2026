import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { FaBell, FaBellSlash, FaSpinner, FaVolumeMute, FaVolumeUp } from 'react-icons/fa';
import { useAdminAuth } from '../../context/AdminAuthContext';
import api from '../../services/apiClient';
import SoundManager from '../../services/SoundManager';
import {
    clearStoredFcmToken,
    disableFcm,
    getPushPlatform,
    getStoredFcmToken,
    isNativePushPlatform,
    requestFcmToken,
} from '../../services/fcm';
import { getNativePushPermissionState } from '../../services/nativePush';

const RESTAURANT_ROLES = ['owner', 'manager', 'employee', 'delivery'];

export default function DashboardPushSoundControls({ mode = 'auto' }) {
    const { getAuthHeaders, user, impersonating } = useAdminAuth();
    const [pushState, setPushState] = useState({ status: 'idle', message: '' });
    const [nativePushPerm, setNativePushPerm] = useState(null);
    const [soundEnabled, setSoundEnabled] = useState(() => SoundManager.isEnabled());

    const role = user?.role || '';
    const effectiveMode = mode === 'auto'
        ? (user?.is_super_admin === true && !impersonating ? 'super_admin' : 'restaurant')
        : mode;

    const isNativePush = effectiveMode === 'restaurant' && isNativePushPlatform();
    const webPermission = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
    const permission = isNativePush ? (nativePushPerm ?? 'prompt') : webPermission;
    const storedToken = useMemo(() => getStoredFcmToken(), [pushState.status]);
    const isPushEnabled = permission === 'granted' && !!storedToken;

    const shouldRender =
        effectiveMode === 'super_admin'
            ? user?.is_super_admin === true && !impersonating
            : RESTAURANT_ROLES.includes(role) && !(user?.is_super_admin && !impersonating);

    useEffect(() => {
        if (!isNativePush) return undefined;
        let alive = true;
        getNativePushPermissionState()
            .then((p) => { if (alive) setNativePushPerm(p); })
            .catch(() => {});
        return () => { alive = false; };
    }, [isNativePush, pushState.status]);

    useEffect(() => {
        if (pushState.status === 'success' || pushState.status === 'error') {
            if (pushState.message) {
                if (pushState.status === 'success') toast.success(pushState.message);
                else toast.error(pushState.message);
            }
        }
    }, [pushState.status, pushState.message]);

    if (!shouldRender) return null;

    const handleSoundToggle = (next) => {
        setSoundEnabled(next);
        SoundManager.setEnabled(next);
        if (next) SoundManager.playTest();
    };

    const enablePush = async () => {
        try {
            setPushState({ status: 'loading', message: 'מבקש הרשאה להתראות...' });
            const token = await requestFcmToken();
            if (!token) {
                const perm = isNativePush
                    ? await getNativePushPermissionState()
                    : (typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');
                setPushState({
                    status: 'error',
                    message: perm === 'denied'
                        ? (isNativePush
                            ? 'ההתראות חסומות במכשיר. פתחו הגדרות > האפליקציה > התראות ואשרו.'
                            : 'ההתראות חסומות בדפדפן. יש לאפשר דרך ההגדרות.')
                        : 'הרשאה נדחתה. יש לאשר התראות.',
                });
                return;
            }

            if (effectiveMode === 'super_admin') {
                await api.post(
                    '/super-admin/fcm/register',
                    { token, device_label: 'super_admin', platform: getPushPlatform() },
                    { headers: getAuthHeaders() },
                );
                setPushState({ status: 'success', message: 'התראות הופעלו למכשיר הזה.' });
            } else {
                await api.post(
                    '/fcm/register',
                    { token, device_label: 'tablet', platform: getPushPlatform() },
                    { headers: getAuthHeaders() },
                );
                setPushState({ status: 'success', message: 'התראות הופעלו לטאבלט הזה.' });
            }
        } catch (error) {
            console.error('Failed to enable push', error);
            setPushState({ status: 'error', message: 'שגיאה בהפעלת התראות. נסו שוב.' });
        }
    };

    const disablePush = async () => {
        try {
            setPushState({ status: 'loading', message: 'מכבה התראות...' });
            const token = getStoredFcmToken();
            if (token) {
                try {
                    const path = effectiveMode === 'super_admin' ? '/super-admin/fcm/unregister' : '/fcm/unregister';
                    await api.post(path, { token }, { headers: getAuthHeaders() });
                } catch (e) {
                    console.warn('[FCM] backend unregister failed', e);
                }
            }
            try {
                await disableFcm();
            } catch (e) {
                console.warn('[FCM] deleteToken failed', e);
                clearStoredFcmToken();
            }
            setPushState({
                status: 'success',
                message: effectiveMode === 'super_admin'
                    ? 'התראות כובו עבור המכשיר הזה.'
                    : 'התראות כובו עבור המכשיר הזה.',
            });
        } catch (error) {
            console.error('Failed to disable push', error);
            setPushState({ status: 'error', message: 'שגיאה בכיבוי התראות. נסו שוב.' });
        }
    };

    const pushDisabled =
        pushState.status === 'loading'
        || permission === 'denied'
        || (!isNativePush && permission === 'unsupported');

    const pushTitle =
        permission === 'denied' || permission === 'unsupported'
            ? 'התראות לא זמינות'
            : isPushEnabled
                ? 'התראות push פעילות — לחץ לכיבוי'
                : effectiveMode === 'super_admin'
                    ? 'הפעל התראות מערכת'
                    : 'הפעל התראות הזמנות';

    const soundTitle = soundEnabled ? 'צלצול הזמנות פעיל — לחץ לכיבוי' : 'הפעל צלצול הזמנות';

    return (
        <div className="inline-flex items-center gap-1 p-1 rounded-2xl bg-white border border-gray-100 shadow-sm">
            <button
                type="button"
                title={pushTitle}
                disabled={pushDisabled}
                onClick={() => (isPushEnabled ? disablePush() : enablePush())}
                className={`relative p-2 rounded-xl transition-all disabled:opacity-40 ${
                    isPushEnabled ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-400 hover:text-brand-primary'
                }`}
            >
                {pushState.status === 'loading' ? (
                    <FaSpinner className="animate-spin" size={14} />
                ) : isPushEnabled ? (
                    <FaBell size={14} />
                ) : (
                    <FaBellSlash size={14} />
                )}
                {isPushEnabled && (
                    <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-green-500 ring-1 ring-white" />
                )}
            </button>
            <button
                type="button"
                title={soundTitle}
                onClick={() => handleSoundToggle(!soundEnabled)}
                className={`p-2 rounded-xl transition-all ${
                    soundEnabled ? 'bg-orange-50 text-orange-500' : 'bg-gray-50 text-gray-400 hover:text-orange-500'
                }`}
            >
                {soundEnabled ? <FaVolumeUp size={14} /> : <FaVolumeMute size={14} />}
            </button>
        </div>
    );
}
