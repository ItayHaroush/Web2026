<?php

namespace App\Services\Printing;

use Illuminate\Support\Facades\Log;

/**
 * שליחת ESC/POS דרך TCP (פורט 9100).
 *
 * SNBC BTP-S80: לפי מדריך «Hebrew» = ESC t 8. הטבלה ממופה ל־IBM862 (CP862), לא ל־Windows-1255 —
 * שליחת 1255 תחת אותה טבלה נראית כקירילית/ג'יבריש. UTF-8 מהאפליקציה מומר ל־CP862 לפני שליחה.
 */
class NetworkPrinterAdapter implements PrinterAdapter
{
    /** ESC t n — Hebrew במדריך SNBC BTP-S80 */
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
            $binary = $this->encodePayloadForCp862Hebrew($payload);

            // ESC @ — אתחול (חובה לפני ESC t כדי לא להישאר על טבלה קודמת)
            fwrite($socket, "\x1B\x40");

            // ESC t 8 — Hebrew (SNBC); הנתונים חייבים להיות CP862/IBM862
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
     * המרת UTF-8 ל-CP862 (עברית DOS) — תואם טבלת Hebrew של BTP-S80.
     */
    private function encodePayloadForCp862Hebrew(string $utf8): string
    {
        if ($utf8 === '') {
            return '';
        }

        $normalized = $this->normalizeUnicodeForCp862($utf8);

        $converted = @iconv('UTF-8', 'CP862//IGNORE', $normalized);
        if ($converted !== false && $converted !== '') {
            return $this->normalizeNewlinesForPrinter($converted);
        }

        $converted = @iconv('UTF-8', 'IBM862//IGNORE', $normalized);
        if ($converted !== false && $converted !== '') {
            return $this->normalizeNewlinesForPrinter($converted);
        }

        Log::warning('NetworkPrinterAdapter: CP862 iconv failed, using ASCII-safe fallback');

        return $this->normalizeNewlinesForPrinter(preg_replace('/[^\x09\x0A\x0D\x20-\x7E]/', '?', $normalized) ?? '');
    }

    /**
     * תווים שאין להם מקביל ב-CP862 — מחליפים לפני iconv.
     */
    private function normalizeUnicodeForCp862(string $s): string
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
