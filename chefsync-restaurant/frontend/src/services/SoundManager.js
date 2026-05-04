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
const STORAGE_VOLUME = 'admin_sound_volume';    // 0-1
const STORAGE_PATTERN = 'admin_sound_pattern';   // 'once' | 'double' | 'triple' | 'continuous'
const STORAGE_MODE = 'admin_sound_mode';      // 'timed' | 'acknowledge'
const STORAGE_DURATION = 'admin_sound_duration';  // seconds (for timed mode)

let audioElement = null;
let unlocked = false;
let lastPlayTime = 0; // dedup: prevent double-play from onMessage + SW postMessage
let globalMuteUntil = 0; // timestamp — block ALL play() until this time passes
let currentAlertStop = null; // stop function for active playAlert()

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

// ── הגדרות צלצול ────────────────────────────────────────────────

function getVolume() {
    try { const v = parseFloat(localStorage.getItem(STORAGE_VOLUME)); return isNaN(v) ? 0.8 : Math.max(0, Math.min(1, v)); } catch { return 0.8; }
}
function setVolume(v) {
    try { localStorage.setItem(STORAGE_VOLUME, String(Math.max(0, Math.min(1, v)))); } catch { /* ignore */ }
}

/** 'once' | 'double' | 'triple' | 'continuous' */
function getPattern() {
    try { return localStorage.getItem(STORAGE_PATTERN) || 'once'; } catch { return 'once'; }
}
function setPattern(p) {
    try { localStorage.setItem(STORAGE_PATTERN, p); } catch { /* ignore */ }
}

/** 'timed' | 'acknowledge' */
function getRingMode() {
    try { return localStorage.getItem(STORAGE_MODE) || 'timed'; } catch { return 'timed'; }
}
function setRingMode(m) {
    try { localStorage.setItem(STORAGE_MODE, m); } catch { /* ignore */ }
}

/** seconds for timed mode */
function getRingDuration() {
    try { const v = parseInt(localStorage.getItem(STORAGE_DURATION), 10); return isNaN(v) ? 10 : v; } catch { return 10; }
}
function setRingDuration(s) {
    try { localStorage.setItem(STORAGE_DURATION, String(s)); } catch { /* ignore */ }
}

// ── השמעה ──────────────────────────────────────────────────────

/**
 * פעם אחת — מחזיר Promise שמסתיים אחרי שהצליל נגמר
 */
function _playOnce(volume) {
    return new Promise((resolve) => {
        try {
            const audio = getAudio();
            audio.volume = Math.max(0, Math.min(1, volume));
            audio.currentTime = 0;
            audio.addEventListener('ended', resolve, { once: true });
            const p = audio.play();
            if (p && p.then) { p.catch(() => { resolve(); }); }
        } catch (_) { resolve(); }
    });
}

/**
 * השמע צלצול הזמנה (לשימוש חיצוני / dedup)
 * מחזיר stopFn (ניתן להתעלם)
 */
function play() {
    if (!isEnabled()) return () => { };
    if (Date.now() < globalMuteUntil) return () => { };
    const now = Date.now();
    if (now - lastPlayTime < 2000) return () => { };
    return playAlert();
}

/**
 * השמע צלצול מלא לפי כל ההגדרות (pattern, mode, duration/acknowledge)
 * מחזיר stopFn שאפשר לקרוא לו כדי להפסיק
 */
function playAlert() {
    if (!isEnabled()) return () => { };
    if (Date.now() < globalMuteUntil) return () => { };

    // עצור צלצול קודם אם קיים
    if (currentAlertStop) { currentAlertStop(); currentAlertStop = null; }

    lastPlayTime = Date.now();

    const volume = getVolume();
    const pattern = getPattern();
    const mode = getRingMode();
    const duration = getRingDuration();

    let stopped = false;
    let timedStopTimeout = null;
    let patternTimeout = null;

    const stopFn = () => {
        if (stopped) return;
        stopped = true;
        if (timedStopTimeout) { clearTimeout(timedStopTimeout); timedStopTimeout = null; }
        if (patternTimeout) { clearTimeout(patternTimeout); patternTimeout = null; }
        try { const a = getAudio(); a.pause(); a.currentTime = 0; } catch (_) { /* ignore */ }
        if (currentAlertStop === stopFn) currentAlertStop = null;
    };

    currentAlertStop = stopFn;

    const delay = (ms) => new Promise((resolve) => {
        patternTimeout = setTimeout(() => { patternTimeout = null; resolve(); }, ms);
    });

    const runCycle = async () => {
        if (stopped) return;
        if (pattern === 'double') {
            await _playOnce(volume);
            if (!stopped) { await delay(350); }
            if (!stopped) { await _playOnce(volume); }
        } else if (pattern === 'triple') {
            for (let i = 0; i < 3; i++) {
                if (stopped) break;
                await _playOnce(volume);
                if (i < 2 && !stopped) { await delay(350); }
            }
        } else {
            // once / continuous — נגן פעם אחת
            await _playOnce(volume);
        }

        // חזור על הצלצול אם מצב "עד קבלה"
        if (!stopped && mode === 'acknowledge') {
            await delay(1800);
            if (!stopped) runCycle();
        }
    };

    runCycle();

    // עצור אוטומטי לאחר duration (מצב "לפי זמן")
    if (mode === 'timed') {
        timedStopTimeout = setTimeout(stopFn, duration * 1000);
    }

    return stopFn;
}

/**
 * השמע סאונד בדיקה (ווליום נמוך, ללא הגדרות מצב)
 */
function playTest() {
    try {
        const audio = getAudio();
        audio.volume = Math.min(getVolume(), 0.6);
        audio.currentTime = 0;
        audio.play().catch(() => { });
        unlocked = true;
    } catch (_) { /* ignore */ }
}

/**
 * עצור את הצלצול הפעיל (אם קיים)
 */
function stopAlert() {
    if (currentAlertStop) { currentAlertStop(); currentAlertStop = null; }
}

/**
 * האם יש כרגע צלצול פעיל
 */
function isAlertActive() {
    return currentAlertStop !== null;
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
/**
 * @param {(payload: object) => void} [onNewOrder]
 * @param {{ shouldPlayOrderSound?: () => boolean }} [options] — אם מחזיר false, לא משמיעים (למשל תצוגה מקדימה / סופר־אדמין)
 */
function listenServiceWorkerMessages(onNewOrder, options = {}) {
    if (!navigator.serviceWorker) return () => { };
    const shouldPlayOrderSound = typeof options.shouldPlayOrderSound === 'function'
        ? options.shouldPlayOrderSound
        : () => true;

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
            if (shouldPlayOrderSound()) {
                play();
            }
            if (onNewOrder) onNewOrder(payload);
        }
    };

    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
}

const SoundManager = {
    play,
    playAlert,
    playTest,
    stopAlert,
    isAlertActive,
    unlock,
    isEnabled,
    setEnabled,
    setMuteUntil,
    setupAutoUnlock,
    listenServiceWorkerMessages,
    // הגדרות צלצול
    getVolume,
    setVolume,
    getPattern,
    setPattern,
    getRingMode,
    setRingMode,
    getRingDuration,
    setRingDuration,
};

export default SoundManager;
