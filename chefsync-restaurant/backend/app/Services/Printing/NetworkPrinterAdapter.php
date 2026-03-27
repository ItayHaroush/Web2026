<?php

namespace App\Services\Printing;

use Illuminate\Support\Facades\Log;

/**
 * שליחת ESC/POS דרך TCP (פורט 9100).
 *
 * SNBC BTP-S80 (לפי מדריך): עברית = ESC t 8 + טקסט ב-Windows-1255, לא UTF-8 ולא CP862.
 */
class NetworkPrinterAdapter implements PrinterAdapter
{
    /** ESC t n — Hebrew לפי מדריך SNBC BTP-S80 (לא 36/PC862 של Epson) */
    private const ESC_POS_CODE_PAGE_HEBREW = 8;

    /** ESC ! — כפול גובה בלבד (קריא יותר, רוחב שורה לא משתנה) */
    private const MODE_DOUBLE_HEIGHT = 0x10;

    private const MODE_NORMAL = 0x00;

    /**
     * שליחת ESC/POS דרך TCP socket
     */
    public function print(string $payload, array $config): bool
    {
        $ip = $config['ip_address'] ?? null;
        $port = $config['port'] ?? 9100;
        $timeout = $config['timeout'] ?? 5;
        $doubleHeight = $config['double_height'] ?? true;

        if (! $ip) {
            Log::error('NetworkPrinterAdapter: Missing IP address');

            return false;
        }

        $socket = @fsockopen($ip, $port, $errno, $errstr, $timeout);

        if (! $socket) {
            Log::error("NetworkPrinterAdapter: Connection failed to {$ip}:{$port}", [
                'errno' => $errno,
                'errstr' => $errstr,
            ]);

            return false;
        }

        try {
            $binary = $this->encodePayloadForWindows1255Hebrew($payload);

            // ESC @ — אתחול (חובה לפני ESC t כדי לא להישאר על טבלה קודמת)
            fwrite($socket, "\x1B\x40");

            // ESC t 8 — Hebrew (SNBC BTP-S80)
            fwrite($socket, "\x1B\x74".chr(self::ESC_POS_CODE_PAGE_HEBREW));

            if ($doubleHeight) {
                fwrite($socket, "\x1B\x21".chr(self::MODE_DOUBLE_HEIGHT));
            }

            fwrite($socket, $binary);

            if ($doubleHeight) {
                fwrite($socket, "\x1B\x21".chr(self::MODE_NORMAL));
            }

            fwrite($socket, "\n\n\n\n");
            fwrite($socket, "\x1D\x56\x00"); // Full cut

            fclose($socket);

            return true;
        } catch (\Exception $e) {
            Log::error("NetworkPrinterAdapter: Print failed to {$ip}:{$port}", [
                'error' => $e->getMessage(),
            ]);

            if (is_resource($socket)) {
                fclose($socket);
            }

            return false;
        }
    }

    /**
     * המרת UTF-8 ל-Windows-1255 (עברית) לפני שליחה למדפסת.
     */
    private function encodePayloadForWindows1255Hebrew(string $utf8): string
    {
        if ($utf8 === '') {
            return '';
        }

        $normalized = $this->normalizeUnicodeForWindows1255($utf8);

        $converted = @iconv('UTF-8', 'WINDOWS-1255//IGNORE', $normalized);
        if ($converted !== false && $converted !== '') {
            return $this->normalizeNewlinesForPrinter($converted);
        }

        $converted = @iconv('UTF-8', 'CP1255//IGNORE', $normalized);
        if ($converted !== false && $converted !== '') {
            return $this->normalizeNewlinesForPrinter($converted);
        }

        Log::warning('NetworkPrinterAdapter: Windows-1255 iconv failed, using ASCII-safe fallback');

        return $this->normalizeNewlinesForPrinter(preg_replace('/[^\x09\x0A\x0D\x20-\x7E]/', '?', $normalized) ?? '');
    }

    /**
     * תווים שאין להם מקביל נוח ב-Windows-1255 — מחליפים לפני iconv.
     */
    private function normalizeUnicodeForWindows1255(string $s): string
    {
        $map = [
            '₪' => 'ש"ח',
            '־' => '-',
            '–' => '-',
            '—' => '-',
            '…' => '...',
            '"' => '"',
            '"' => '"',
            '„' => '"',
            '‟' => '"',
            "'" => "'",
            "'" => "'",
            '‚' => "'",
            '‛' => "'",
            '°' => ' ',
            '×' => 'x',
        ];

        return strtr($s, $map);
    }

    private function normalizeNewlinesForPrinter(string $s): string
    {
        return str_replace(["\r\n", "\r"], "\n", $s);
    }

    /**
     * בדיקת חיבור למדפסת
     */
    public function isAvailable(array $config): bool
    {
        $ip = $config['ip_address'] ?? null;
        $port = $config['port'] ?? 9100;

        if (! $ip) {
            return false;
        }

        $socket = @fsockopen($ip, $port, $errno, $errstr, 2);

        if ($socket) {
            fclose($socket);

            return true;
        }

        return false;
    }
}
