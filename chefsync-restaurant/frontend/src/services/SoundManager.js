/**
 * SoundManager — מנהל סאונד גלובלי לאפליקציה
 *
 * פותר את כל הבעיות של השמעת סאונד ב-PWA:
 * 1. טוען את האודיו פעם אחת ומשתמש שוב (לא new Audio כל פעם)
 * 2. "פותח נעילה" על המכשיר בלחיצה ראשונה של המשתמש
 * 3. מקשיב ל-postMessage מ-Service Worker (שהיה הולך לאיבוד)
 * 4. API אחיד לכל הקומפוננטות
 */

const SOUND_PATH = '/sounds/Order-up-bell-sound.mp3';
const STORAGE_KEY = 'admin_sound_enabled';

let audioElement = null;
let unlocked = false;

/**
 * טען/אתחל את ה-Audio element (פעם אחת)
 */
function getAudio() {
    if (!audioElement) {
        audioElement = new Audio(SOUND_PATH);
        audioElement.preload = 'auto';
        audioElement.volume = 0.8;
    }
    return audioElement;
}

/**
 * "פתיחת נעילה" — חובה להפעיל מתוך אינטראקציית משתמש (click/touch)
 * ברגע שזה קורה פעם אחת, play() יעבוד גם ללא אינטראקציה
 */
function unlock() {
    if (unlocked) return;
    try {
        const audio = getAudio();
        // play+pause מיידי — פותח את הנעילה של הדפדפן
        audio.volume = 0;
        const p = audio.play();
        if (p && p.then) {
            p.then(() => {
                audio.pause();
                audio.currentTime = 0;
                audio.volume = 0.8;
                unlocked = true;
            }).catch(() => { });
        }
    } catch (_) { /* ignore */ }
}

/**
 * השמע צלצול הזמנה
 */
function play() {
    if (!isEnabled()) return;
    try {
        const audio = getAudio();
        audio.volume = 0.8;
        audio.currentTime = 0;
        const p = audio.play();
        if (p && p.then) {
            p.catch((err) => {
                console.warn('[SoundManager] play blocked:', err.message);
            });
        }
    } catch (_) { /* ignore */ }
}

/**
 * השמע סאונד בדיקה (ווליום נמוך)
 */
function playTest() {
    try {
        const audio = getAudio();
        audio.volume = 0.4;
        audio.currentTime = 0;
        audio.play().catch(() => { });
        unlocked = true;
    } catch (_) { /* ignore */ }
}

/**
 * האם צלצול מופעל
 */
function isEnabled() {
    try {
        return localStorage.getItem(STORAGE_KEY) !== 'false';
    } catch {
        return true;
    }
}

/**
 * הפעל/כבה צלצול
 */
function setEnabled(value) {
    try {
        localStorage.setItem(STORAGE_KEY, value ? 'true' : 'false');
    } catch { /* ignore */ }
}

/**
 * הרשם לפתיחת נעילה אוטומטית על לחיצה ראשונה
 * קורא פעם אחת ב-mount של האפליקציה
 */
function setupAutoUnlock() {
    const handler = () => {
        unlock();
        document.removeEventListener('click', handler, true);
        document.removeEventListener('touchstart', handler, true);
    };
    document.addEventListener('click', handler, true);
    document.addEventListener('touchstart', handler, true);
}

/**
 * הרשם ל-postMessage מ-Service Worker (fcm_message)
 * פותר את הבאג שה-SW שולח הודעה אבל אף אחד לא מקשיב
 */
function listenServiceWorkerMessages(onNewOrder) {
    if (!navigator.serviceWorker) return () => { };

    const handler = (event) => {
        if (event.data?.type === 'fcm_message') {
            const dataType = event.data?.payload?.data?.type;
            if (dataType === 'new_order') {
                play();
                if (onNewOrder) onNewOrder(event.data.payload);
            }
        }
    };

    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
}

const SoundManager = {
    play,
    playTest,
    unlock,
    isEnabled,
    setEnabled,
    setupAutoUnlock,
    listenServiceWorkerMessages,
};

export default SoundManager;
