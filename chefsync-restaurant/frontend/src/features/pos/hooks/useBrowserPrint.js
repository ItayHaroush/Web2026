import { useEffect, useRef } from 'react';
import posApi from '../api/posApi';

function textToHtml(text, type, role) {
    const title = type === 'receipt' ? 'קבלה' : type === 'kitchen_ticket' ? 'הזמנה למטבח' : 'הדפסה';

    const escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Courier New', monospace;
    max-width: ${role === 'receipt' ? '300px' : '400px'};
    margin: 0 auto;
    padding: 15px;
    font-size: 12px;
    color: #000;
    white-space: pre-wrap;
    line-height: 1.4;
  }
  @media print {
    body { padding: 0; margin: 0; }
    @page { margin: 5mm; size: ${role === 'receipt' ? '80mm' : '80mm'} auto; }
  }
</style>
</head>
<body>${escaped}
<script>window.onload = function() { window.print(); }</script>
</body>
</html>`;
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
                    if (job.text) {
                        const html = textToHtml(job.text, job.type, job.role);
                        const win = window.open('', '_blank', 'width=450,height=600');
                        if (win) {
                            win.document.write(html);
                            win.document.close();
                        }
                    }
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
