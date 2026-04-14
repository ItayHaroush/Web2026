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
let lastPlayTime = 0; // dedup: prevent double-play from onMessage + SW postMessage
let globalMuteUntil = 0; // timestamp — block ALL play() until this time passes

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
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
            const ctx = new AudioCtx();
            const buf = ctx.createBuffer(1, 1, 22050);
            const src = ctx.createBufferSource();
            src.buffer = buf;
            src.connect(ctx.destination);
            src.start(0);
            if (ctx.state === 'suspended') {
                ctx.resume().then(() => { unlocked = true; ctx.close().catch(() => { }); }).catch(() => { });
            } else {
                unlocked = true;
                ctx.close().catch(() => { });
            }
        }
    } catch (_) { /* ignore */ }
}

/**
 * השמע צלצול הזמנה
 */
function play() {
    if (!isEnabled()) return;
    // global mute: חוסם כל צלצול בזמן אתחול (מניעת false-positive אחרי ריענון)
    if (Date.now() < globalMuteUntil) return;
    // dedup: אם צלצול כבר הושמע ב-2 שניות האחרונות, דלג (onMessage + SW postMessage)
    const now = Date.now();
    if (now - lastPlayTime < 2000) return;
    lastPlayTime = now;
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
 * ממשיך לנסות בכל לחיצה עד שהנעילה מצליחה
 */
/**
 * חסום כל צלצולים עד timestamp מסוים (למניעת צלצולי שווא בזמן אתחול)
 */
function setMuteUntil(ts) {
    globalMuteUntil = ts;
}

function setupAutoUnlock() {
    if (unlocked) return;
    const remove = () => {
        document.removeEventListener('click', handler, true);
        document.removeEventListener('touchstart', handler, true);
    };
    const handler = () => {
        if (unlocked) { remove(); return; }
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                const ctx = new AudioCtx();
                const buf = ctx.createBuffer(1, 1, 22050);
                const src = ctx.createBufferSource();
                src.buffer = buf;
                src.connect(ctx.destination);
                src.start(0);
                if (ctx.state === 'suspended') {
                    ctx.resume().then(() => { unlocked = true; ctx.close().catch(() => { }); remove(); }).catch(() => { });
                } else {
                    unlocked = true;
                    ctx.close().catch(() => { });
                    remove();
                }
            }
        } catch (_) { /* ignore */ }
    };
    document.addEventListener('click', handler, true);
    document.addEventListener('touchstart', handler, true);
}

/**
 * הרשם ל-postMessage מ-Service Worker
 * מטפל בשני סוגי הודעות:
 * - fcm_push: מ-push event ישיר (הכי אמין, גם ב-PWA)
 * - fcm_message: מ-onBackgroundMessage של Firebase (fallback)
 */
function listenServiceWorkerMessages(onNewOrder) {
    if (!navigator.serviceWorker) return () => { };

    const handler = (event) => {
        let dataType = null;
        let payload = null;

        if (event.data?.type === 'fcm_push') {
            // push ישיר — data מגיע ישירות
            dataType = event.data?.data?.type;
            payload = { data: event.data.data };
        } else if (event.data?.type === 'fcm_message') {
            // onBackgroundMessage של Firebase
            dataType = event.data?.payload?.data?.type;
            payload = event.data.payload;
        }

        if (dataType === 'new_order') {
            play();
            if (onNewOrder) onNewOrder(payload);
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
    setMuteUntil,
    setupAutoUnlock,
    listenServiceWorkerMessages,
};

export default SoundManager;
