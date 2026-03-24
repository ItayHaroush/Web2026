/**
 * תאריך דוח יומי מה-API: עמודת DATE ב-DB היא יום קלנדרי.
 * אם השרת שולח ISO ב-UTC, split('T')[0] עלול להציג יום אחד לפני בישראל.
 */
export function formatDailyReportCalendarDate(value) {
    if (value == null || value === '') return '';
    const s = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Jerusalem',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(d);
    }
    const cut = s.split('T')[0];
    return cut.length >= 10 ? cut.slice(0, 10) : s;
}
