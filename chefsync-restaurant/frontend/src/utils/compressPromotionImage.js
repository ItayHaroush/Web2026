/**
 * מקטין תמונת מבצע לפני העלאה — מפחית סיכוי ל־413 (Payload Too Large) בפרוקסי/nginx.
 * מחזיר File (JPEG) או את הקובץ המקורי אם הוא כבר קטן מספיק.
 */
export async function compressPromotionImage(file, options = {}) {
    const maxBytes = options.maxBytes ?? 950 * 1024;
    const maxWidth = options.maxWidth ?? 1600;

    if (!file?.type?.startsWith('image/')) {
        return file;
    }
    if (file.size <= maxBytes) {
        return file;
    }

    const bitmap = await createImageBitmap(file).catch(() => null);
    if (!bitmap) {
        return file;
    }

    const baseName = (file.name && file.name.replace(/\.[^.]+$/, '')) || 'promotion';

    let w = bitmap.width;
    let h = bitmap.height;
    let scale = w > maxWidth ? maxWidth / w : 1;

    const tryEncode = async (cw, ch, quality) => {
        const canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(bitmap, 0, 0, cw, ch);
        return new Promise((resolve) => {
            canvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
        });
    };

    try {
        for (let attempt = 0; attempt < 8; attempt++) {
            const cw = Math.max(1, Math.round(w * scale));
            const ch = Math.max(1, Math.round(h * scale));
            for (let q = 0.9; q >= 0.42; q -= 0.06) {
                // eslint-disable-next-line no-await-in-loop
                const blob = await tryEncode(cw, ch, q);
                if (blob && blob.size <= maxBytes) {
                    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
                }
            }
            scale *= 0.82;
        }
    } finally {
        bitmap.close?.();
    }

    return file;
}
