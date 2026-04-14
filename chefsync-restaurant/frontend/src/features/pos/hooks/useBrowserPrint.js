import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import posApi from '../api/posApi';

/**
 * @param {string | null | undefined} qrDataUrl data:image/png;base64,... (מקומי — בלי רשת)
 */
function textToHtml(text, type, role, qrDataUrl) {
    const title = type === 'receipt' ? 'אישור' : type === 'kitchen_ticket' ? 'הזמנה למטבח' : type === 'share_qr_slip' ? 'QR שיתוף' : 'הדפסה';

    // Escape HTML first
    const escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Convert formatting markers (they use {{ }} so they survived HTML escaping)
    // {{QR}} is replaced with the QR image inline (positioned where the marker is)
    const qrBlock = qrDataUrl
        ? `<div style="text-align:center;margin:12px 0;"><img src="${qrDataUrl.replace(/"/g, '&quot;')}" alt="QR" width="200" height="200" style="image-rendering:pixelated;" /></div>`
        : '';

    const hasQrMarker = escaped.includes('{{QR}}');

    const formatted = escaped
        .replace(/\{\{BIG\}\}\n?/g, '<span class="big">')
        .replace(/\{\{\/BIG\}\}\n?/g, '</span>')
        .replace(/\{\{CENTER\}\}\n?/g, '<div class="center">')
        .replace(/\{\{\/CENTER\}\}\n?/g, '</div>')
        .replace(/\{\{BOLD\}\}\n?/g, '<span class="bold">')
        .replace(/\{\{\/BOLD\}\}\n?/g, '</span>')
        .replace(/\{\{HEADING\}\}\n?/g, '<span class="heading">')
        .replace(/\{\{\/HEADING\}\}\n?/g, '</span>')
        .replace(/\{\{CENTER_HW\}\}\n?/g, '<div class="center-hw">')
        .replace(/\{\{\/CENTER_HW\}\}\n?/g, '</div>')
        .replace(/\{\{QR\}\}\n?/g, qrBlock);

    // If no {{QR}} marker, append QR at the end (legacy behavior)
    const trailingQr = (!hasQrMarker && qrBlock) ? qrBlock : '';

    return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { background: #fff; color: #111; }
  body {
    font-family: 'Courier New', monospace;
    max-width: ${role === 'receipt' ? '300px' : '400px'};
    margin: 0 auto;
    padding: 15px;
    font-size: 12px;
    white-space: pre-wrap;
    line-height: 1.4;
  }
  .big { font-size: 1.6em; font-weight: bold; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .heading { font-size: 2em; font-weight: bold; }
  .center-hw { text-align: center; }
  @media print {
    body { padding: 0; margin: 0; background: #fff; }
    @page { margin: 5mm; size: 80mm auto; }
  }
</style>
</head>
<body>${formatted}${trailingQr}
</body>
</html>`;
}

async function qrUrlToDataUrl(url) {
    if (!url) return null;
    try {
        return await QRCode.toDataURL(url, {
            width: 200,
            margin: 2,
            errorCorrectionLevel: 'M',
            color: { dark: '#000000', light: '#ffffff' },
        });
    } catch {
        return null;
    }
}

function isAnyFullscreenActive() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement);
}

/** ניסיון לחזור למסך מלא אחרי הדפסה (אחרי סגירת דיאלוג). Safari: ללא אובייקט אופציות ב־webkit. */
function tryRestorePosFullscreen() {
    const el = document.documentElement;
    try {
        if (typeof el.requestFullscreen === 'function') {
            const p = el.requestFullscreen({ navigationUI: 'hide' });
            if (p && typeof p.catch === 'function') {
                p.catch(() => {
                    try {
                        el.webkitRequestFullscreen?.();
                    } catch {
                        /* ignore */
                    }
                });
            }
            return;
        }
    } catch {
        /* fall through */
    }
    try {
        el.webkitRequestFullscreen?.();
    } catch {
        /* ignore */
    }
    try {
        el.mozRequestFullScreen?.();
    } catch {
        /* ignore */
    }
}

/**
 * הדפסה דרך iframe נסתר; אחרי סיום — מחזירים פוקוס לעמוד הקופה ומנסים שוב fullscreen.
 */
function printHtmlInHiddenIframe(htmlString) {
    return new Promise((resolve) => {
        const iframe = document.createElement('iframe');
        iframe.setAttribute('aria-hidden', 'true');
        Object.assign(iframe.style, {
            position: 'fixed',
            right: '0',
            bottom: '0',
            width: '0',
            height: '0',
            border: '0',
            opacity: '0',
            pointerEvents: 'none',
        });
        document.body.appendChild(iframe);

        const doc = iframe.contentDocument;
        const win = iframe.contentWindow;
        if (!doc || !win) {
            iframe.remove();
            resolve();
            return;
        }

        let iframeRemoved = false;
        const removeIframe = () => {
            if (iframeRemoved) return;
            iframeRemoved = true;
            iframe.remove();
            resolve();
        };

        const invokePrintFlow = () => {
            const wasFullscreen = isAnyFullscreenActive();

            let printSettled = false;
            let fallbackTimer = null;

            const settleAfterPrint = () => {
                if (printSettled) return;
                printSettled = true;
                if (fallbackTimer !== null) {
                    clearTimeout(fallbackTimer);
                    fallbackTimer = null;
                }
                try {
                    win.removeEventListener('afterprint', onAfterPrint);
                } catch {
                    /* ignore */
                }

                removeIframe();

                queueMicrotask(() => {
                    try {
                        window.focus();
                    } catch {
                        /* ignore */
                    }

                    if (!wasFullscreen) return;

                    tryRestorePosFullscreen();

                    setTimeout(() => {
                        if (isAnyFullscreenActive()) return;
                        window.dispatchEvent(new CustomEvent('takeeat:pos-fullscreen-lost'));
                    }, 450);
                });
            };

            const onAfterPrint = () => {
                settleAfterPrint();
            };

            try {
                win.addEventListener('afterprint', onAfterPrint);
                win.focus();
                win.print();
            } catch {
                settleAfterPrint();
                return;
            }

            fallbackTimer = setTimeout(() => {
                settleAfterPrint();
            }, 3000);
        };

        const afterImagesReady = () => {
            let didPrint = false;
            let printTimer = null;

            const runPrintOnce = () => {
                if (didPrint) return;
                didPrint = true;
                if (printTimer !== null) {
                    clearTimeout(printTimer);
                    printTimer = null;
                }
                invokePrintFlow();
            };

            const imgs = Array.from(doc.images || []);
            const pending = imgs.filter((img) => !img.complete || !img.naturalHeight);
            if (pending.length === 0) {
                requestAnimationFrame(() => requestAnimationFrame(runPrintOnce));
                return;
            }
            let left = pending.length;
            const oneDone = () => {
                left -= 1;
                if (left <= 0) runPrintOnce();
            };
            for (const img of pending) {
                img.addEventListener('load', oneDone, { once: true });
                img.addEventListener('error', oneDone, { once: true });
            }
            printTimer = setTimeout(runPrintOnce, 4000);
        };

        doc.open();
        doc.write(htmlString);
        doc.close();

        if (doc.readyState === 'complete') {
            afterImagesReady();
        } else {
            win.addEventListener('load', afterImagesReady, { once: true });
        }
    });
}

export default function useBrowserPrint(headers, posToken, enabled = true) {
    const intervalRef = useRef(null);

    useEffect(() => {
        if (!enabled || !headers) return;

        const poll = async () => {
            try {
                const res = await posApi.getPendingPrintJobs(headers, posToken);
                const jobs = res.data.jobs || [];
                for (const job of jobs) {
                    if (!job.text) continue;
                    const qrDataUrl = await qrUrlToDataUrl(job.qr_url);
                    const html = textToHtml(job.text, job.type, job.role, qrDataUrl);
                    await printHtmlInHiddenIframe(html);
                }
            } catch {
                // silent
            }
        };

        intervalRef.current = setInterval(poll, 5000);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [headers, posToken, enabled]);
}
