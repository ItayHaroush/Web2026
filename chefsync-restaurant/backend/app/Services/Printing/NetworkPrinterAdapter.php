<?php

namespace App\Services\Printing;

use Illuminate\Support\Facades\Log;

/**
 * שליחת ESC/POS דרך TCP (פורט 9100).
 *
 * SNBC BTP-S80: CP862 + ESC t 10 (0x0A). מדפסת LTR — עברית עוברת דרך ThermalHebrewEscPosEncoder.
 */
class NetworkPrinterAdapter implements PrinterAdapter
{
    /** ESC t n — Hebrew code page על BTP-S80 (CP:10) */
    private const ESC_POS_CODE_PAGE_HEBREW = 10;

    /** ESC ! — כפול רוחב + גובה (פחות "צר" על נייר 80מ״מ) */
    private const MODE_DOUBLE_WIDTH_HEIGHT = 0x30;

    private const MODE_NORMAL = 0x00;

    public function __construct(
        private ?ThermalHebrewEscPosEncoder $hebrewEncoder = null,
    ) {
        $this->hebrewEncoder ??= new ThermalHebrewEscPosEncoder;
    }

    /**
     * שליחת ESC/POS דרך TCP socket
     */
    public function print(string $payload, array $config): bool
    {
        $ip = $config['ip_address'] ?? null;
        $port = $config['port'] ?? 9100;
        $timeout = $config['timeout'] ?? 5;
        $doubleHeight = $config['double_height'] ?? true;
        $lineWidth = isset($config['line_width']) ? (int) $config['line_width'] : null;

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
            $binary = $this->hebrewEncoder->encodeUtf8ToCp862($payload, true, $lineWidth);

            fwrite($socket, "\x1B\x40");
            fwrite($socket, "\x1B\x74".chr(self::ESC_POS_CODE_PAGE_HEBREW));
            fwrite($socket, "\x1B\x20\x00");

            if ($doubleHeight) {
                fwrite($socket, "\x1B\x21".chr(self::MODE_DOUBLE_WIDTH_HEIGHT));
            }

            fwrite($socket, $binary);

            if ($doubleHeight) {
                fwrite($socket, "\x1B\x21".chr(self::MODE_NORMAL));
            }

            fwrite($socket, "\n\n\n\n");
            // GS V 1 — חיתוך חלקי (חצי); 0 = מלא
            fwrite($socket, "\x1D\x56\x01");

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
