import apiClient from './apiClient';
import { IS_NATIVE_APP } from '../constants/api';

/** מזהה את פלטפורמת הריצה: 'android' | 'ios' | 'web'. */
function detectPlatform() {
    try {
        return window?.Capacitor?.getPlatform?.() ?? 'web';
    } catch {
        return 'web';
    }
}

/**
 * קורא את גרסת האפליקציה הנייטיב (versionName + versionCode) דרך @capacitor/app.
 * מחזיר null באתר web או אם הפלאגין לא זמין.
 */
export async function getNativeAppInfo() {
    if (!IS_NATIVE_APP) return null;
    try {
        const { App } = await import('@capacitor/app');
        const info = await App.getInfo();
        return {
            versionName: info?.version ?? null,
            versionCode: parseInt(info?.build ?? '', 10) || 0,
        };
    } catch {
        return null;
    }
}

/** מביא מהשרת את הגרסה האחרונה/המינימלית עבור הפלטפורמה. */
export async function fetchServerAppVersion(platform) {
    const res = await apiClient.get('/app/version', { params: { platform } });
    return res.data;
}

/**
 * משווה את גרסת האפליקציה מול השרת.
 * מחזיר: { status: 'required' | 'recommended' | 'ok', updateUrl, latestVersionName }
 */
export async function checkForAppUpdate() {
    const platform = detectPlatform();
    if (platform !== 'android' && platform !== 'ios') {
        return { status: 'ok' };
    }

    const info = await getNativeAppInfo();
    if (!info) return { status: 'ok' };

    let server;
    try {
        server = await fetchServerAppVersion(platform);
    } catch {
        return { status: 'ok' };
    }
    if (!server?.success) return { status: 'ok' };

    const current = info.versionCode;
    const min = Number(server.min_version_code) || 0;
    const latest = Number(server.latest_version_code) || 0;

    let status = 'ok';
    if (current > 0 && current < min) {
        status = 'required';
    } else if (current > 0 && current < latest) {
        status = 'recommended';
    }

    return {
        status,
        updateUrl: server.update_url,
        latestVersionName: server.latest_version_name,
        currentVersionName: info.versionName,
    };
}

/** פותח את כתובת העדכון (חנות / APK) בדפדפן המערכת. */
export function openUpdateUrl(url) {
    if (!url) return;
    try {
        window.open(url, '_system');
    } catch {
        window.location.href = url;
    }
}
