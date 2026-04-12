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

    /** ESC ! — כפול גובה בלבד (רוחב רגיל) כדי שלא יישברו שורות מול line_width */
    private const MODE_DOUBLE_HEIGHT = 0x10;

    private const MODE_NORMAL = 0x00;

    // Inline formatting markers
    private const MARKER_BIG     = '{{BIG}}';
    private const MARKER_NOBIG   = '{{/BIG}}';
    private const MARKER_CENTER  = '{{CENTER}}';
    private const MARKER_NOCENTER = '{{/CENTER}}';
    private const MARKER_BOLD    = '{{BOLD}}';
    private const MARKER_NOBOLD  = '{{/BOLD}}';

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
            $hasMarkers = str_contains($payload, self::MARKER_BIG)
                || str_contains($payload, self::MARKER_CENTER)
                || str_contains($payload, self::MARKER_BOLD);

            // Strip markers before CP862 encoding (encoder doesn't know about them)
            $textForEncoding = $this->stripMarkers($payload);
            $binary = $this->hebrewEncoder->encodeUtf8ToCp862($textForEncoding, true, $lineWidth);

            $escposSuffix = $config['escpos_binary_suffix'] ?? '';
            if (! is_string($escposSuffix)) {
                $escposSuffix = '';
            }

            fwrite($socket, "\x1B\x40");
            fwrite($socket, "\x1B\x74" . chr(self::ESC_POS_CODE_PAGE_HEBREW));
            fwrite($socket, "\x1B\x20\x00");

            if ($hasMarkers) {
                // Inline marker mode: encode the raw payload with markers,
                // then process line-by-line with ESC/POS commands
                $encodedWithMarkers = $this->hebrewEncoder->encodeUtf8ToCp862($payload, true, $lineWidth);
                $this->writeWithInlineMarkers($socket, $encodedWithMarkers, $doubleHeight);
            } else {
                // Legacy mode: global double-height flag
                if ($doubleHeight) {
                    fwrite($socket, "\x1B\x21" . chr(self::MODE_DOUBLE_HEIGHT));
                }
                fwrite($socket, $binary);
                fwrite($socket, "\x1B\x21" . chr(self::MODE_NORMAL));
            }

            if ($escposSuffix !== '') {
                fwrite($socket, $escposSuffix);
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
     * Process {{BIG}}, {{CENTER}}, {{BOLD}} markers per line — switch ESC/POS modes accordingly.
     * Marker lines are consumed (not printed).
     *
     * @param  resource  $socket
     */
    private function writeWithInlineMarkers($socket, string $encoded, bool $defaultDoubleHeight): void
    {
        $isBig = false;
        $isBold = false;
        $isCenter = false;

        foreach (explode("\n", $encoded) as $line) {
            $trimmed = trim($line);

            // Check for marker lines (consume them, don't print)
            if ($trimmed === self::MARKER_BIG || $trimmed === $this->encodeMarker(self::MARKER_BIG)) {
                $isBig = true;
                continue;
            }
            if ($trimmed === self::MARKER_NOBIG || $trimmed === $this->encodeMarker(self::MARKER_NOBIG)) {
                $isBig = false;
                fwrite($socket, "\x1B\x21" . chr(self::MODE_NORMAL));
                continue;
            }
            if ($trimmed === self::MARKER_CENTER || $trimmed === $this->encodeMarker(self::MARKER_CENTER)) {
                $isCenter = true;
                fwrite($socket, "\x1B\x61\x01"); // ESC a 1 — center alignment
                continue;
            }
            if ($trimmed === self::MARKER_NOCENTER || $trimmed === $this->encodeMarker(self::MARKER_NOCENTER)) {
                $isCenter = false;
                fwrite($socket, "\x1B\x61\x00"); // ESC a 0 — left alignment
                continue;
            }
            if ($trimmed === self::MARKER_BOLD || $trimmed === $this->encodeMarker(self::MARKER_BOLD)) {
                $isBold = true;
                fwrite($socket, "\x1B\x45\x01"); // ESC E 1 — bold on
                continue;
            }
            if ($trimmed === self::MARKER_NOBOLD || $trimmed === $this->encodeMarker(self::MARKER_NOBOLD)) {
                $isBold = false;
                fwrite($socket, "\x1B\x45\x00"); // ESC E 0 — bold off
                continue;
            }

            // Set font mode for this line
            fwrite($socket, "\x1B\x21" . chr($isBig ? self::MODE_DOUBLE_HEIGHT : self::MODE_NORMAL));

            fwrite($socket, $line . "\n");
        }

        // Reset all modes
        fwrite($socket, "\x1B\x21" . chr(self::MODE_NORMAL));
        fwrite($socket, "\x1B\x61\x00");
        fwrite($socket, "\x1B\x45\x00");
    }

    /**
     * Strip all formatting markers from text.
     */
    private function stripMarkers(string $text): string
    {
        return str_replace(
            [self::MARKER_BIG, self::MARKER_NOBIG, self::MARKER_CENTER, self::MARKER_NOCENTER, self::MARKER_BOLD, self::MARKER_NOBOLD],
            '',
            $text
        );
    }

    /**
     * Try to match marker after CP862 encoding (markers are ASCII so they survive iconv).
     */
    private function encodeMarker(string $marker): string
    {
        return $marker; // Markers are pure ASCII — unchanged by CP862
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
