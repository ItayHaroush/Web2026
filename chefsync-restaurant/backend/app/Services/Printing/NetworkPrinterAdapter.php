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
    private const MARKER_QR      = '{{QR}}';

    // Enhanced template markers
    private const MARKER_HEADING    = '{{HEADING}}';
    private const MARKER_NOHEADING  = '{{/HEADING}}';
    private const MARKER_CENTER_HW  = '{{CENTER_HW}}';
    private const MARKER_NOCENTER_HW = '{{/CENTER_HW}}';

    /** ESC ! 0x38 = double-height + double-width + bold */
    private const MODE_HEADING = 0x38;

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

        // PROTECTION: Limit payload size to prevent memory exhaustion (RTL Hebrew encoding amplification)
        $maxPayloadSize = 50000; // ~50KB limit
        if (strlen($payload) > $maxPayloadSize) {
            Log::error('NetworkPrinterAdapter: Payload exceeds size limit', [
                'size' => strlen($payload),
                'limit' => $maxPayloadSize,
            ]);

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

        // PROTECTION: Set stream timeout to prevent fwrite blocking indefinitely
        stream_set_timeout($socket, $timeout);
        stream_set_blocking($socket, false);

        // CRITICAL FIX: Ensure socket is always closed (prevent resource leak)
        try {
            $hasMarkers = str_contains($payload, self::MARKER_BIG)
                || str_contains($payload, self::MARKER_CENTER)
                || str_contains($payload, self::MARKER_BOLD)
                || str_contains($payload, self::MARKER_QR)
                || str_contains($payload, self::MARKER_HEADING)
                || str_contains($payload, self::MARKER_CENTER_HW);

            // OPTIMIZATION: Encode once; reuse for both marker and non-marker modes
            if ($hasMarkers) {
                $encoded = $this->hebrewEncoder->encodeUtf8ToCp862($payload, true, null);
            } else {
                $textForEncoding = $this->stripMarkers($payload);
                $encoded = $this->hebrewEncoder->encodeUtf8ToCp862($textForEncoding, true, null);
            }

            // CRITICAL FIX: Decode QR binary from base64 before sending (raw binary, not text)
            $qrBinary = '';
            $escposRawBinary = $config['escpos_binary_suffix'] ?? '';
            if (is_string($escposRawBinary) && $escposRawBinary !== '') {
                $decoded = base64_decode($escposRawBinary, true);
                if ($decoded !== false) {
                    $qrBinary = $decoded;
                }
            }

            fwrite($socket, "\x1B\x40");
            fwrite($socket, "\x1B\x74" . chr(self::ESC_POS_CODE_PAGE_HEBREW));
            fwrite($socket, "\x1B\x20\x00");

            if ($hasMarkers) {
                // Inline marker mode: process line-by-line with ESC/POS commands
                $qrInserted = $this->writeWithInlineMarkers($socket, $encoded, $doubleHeight, $qrBinary);

                // Only append suffix at end if {{QR}} was not found (suffix already inserted at QR position)
                if (! $qrInserted && $qrBinary !== '') {
                    fwrite($socket, $qrBinary);
                }
            } else {
                // Legacy mode: global double-height flag
                if ($doubleHeight) {
                    fwrite($socket, "\x1B\x21" . chr(self::MODE_DOUBLE_HEIGHT));
                }
                fwrite($socket, $encoded);
                fwrite($socket, "\x1B\x21" . chr(self::MODE_NORMAL));

                if ($qrBinary !== '') {
                    fwrite($socket, $qrBinary);
                }
            }

            fwrite($socket, "\n\n\n\n");
            // GS V 1 — חיתוך חלקי (חצי); 0 = מלא
            fwrite($socket, "\x1D\x56\x01");

            return true;
        } catch (\Exception $e) {
            Log::error("NetworkPrinterAdapter: Print failed to {$ip}:{$port}", [
                'error' => $e->getMessage(),
            ]);

            return false;
        } finally {
            // CRITICAL: Always close socket, even on exception (prevent resource leak)
            if (is_resource($socket)) {
                @fclose($socket);
            }
        }
    }

    /**
     * Process {{BIG}}, {{CENTER}}, {{BOLD}}, {{QR}} markers per line — switch ESC/POS modes accordingly.
     * Marker lines are consumed (not printed). {{QR}} inserts QR binary at that position.
     * CRITICAL FIX: Exact marker matching (no trim) to prevent RTL/Hebrew corruption and phantom loops
     *
     * @param  resource  $socket
     * @return bool  Whether {{QR}} was found and QR binary was inserted
     */
    private function writeWithInlineMarkers($socket, string $encoded, bool $defaultDoubleHeight, string $qrBinary = ''): bool
    {
        $isBig = false;
        $isBold = false;
        $isCenter = false;
        $isHeading = false;
        $qrInserted = false;

        foreach (explode("\n", $encoded) as $line) {
            // CRITICAL: No trim() — exact match only to prevent RTL marker corruption
            // Hebrew markers must match exactly; trim could break RTL detection
            $isMarkerLine = false;

            // Check for marker lines (consume them, don't print)
            if ($line === self::MARKER_BIG) {
                $isBig = true;
                $isMarkerLine = true;
            } elseif ($line === self::MARKER_NOBIG) {
                $isBig = false;
                fwrite($socket, "\x1B\x21" . chr(self::MODE_NORMAL));
                $isMarkerLine = true;
            } elseif ($line === self::MARKER_CENTER) {
                $isCenter = true;
                fwrite($socket, "\x1B\x61\x01"); // ESC a 1 — center alignment
                $isMarkerLine = true;
            } elseif ($line === self::MARKER_NOCENTER) {
                $isCenter = false;
                fwrite($socket, "\x1B\x61\x00"); // ESC a 0 — left alignment
                $isMarkerLine = true;
            } elseif ($line === self::MARKER_BOLD) {
                $isBold = true;
                fwrite($socket, "\x1B\x45\x01"); // ESC E 1 — bold on
                $isMarkerLine = true;
            } elseif ($line === self::MARKER_NOBOLD) {
                $isBold = false;
                fwrite($socket, "\x1B\x45\x00"); // ESC E 0 — bold off
                $isMarkerLine = true;
            } elseif ($line === self::MARKER_HEADING) {
                $isHeading = true;
                $isMarkerLine = true;
            } elseif ($line === self::MARKER_NOHEADING) {
                $isHeading = false;
                fwrite($socket, "\x1B\x21" . chr(self::MODE_NORMAL));
                $isMarkerLine = true;
            } elseif ($line === self::MARKER_CENTER_HW) {
                fwrite($socket, "\x1B\x61\x01"); // ESC a 1 — hardware center
                $isMarkerLine = true;
            } elseif ($line === self::MARKER_NOCENTER_HW) {
                fwrite($socket, "\x1B\x61\x00"); // ESC a 0 — left
                $isMarkerLine = true;
            } elseif ($line === self::MARKER_QR) {
                if ($qrBinary !== '') {
                    fwrite($socket, $qrBinary);
                    $qrInserted = true;
                }
                $isMarkerLine = true;
            }

            // Skip marker lines entirely (don't send to printer)
            if ($isMarkerLine) {
                continue;
            }

            // Set font mode for this line — heading takes priority over big
            if ($isHeading) {
                fwrite($socket, "\x1B\x21" . chr(self::MODE_HEADING));
            } else {
                fwrite($socket, "\x1B\x21" . chr($isBig ? self::MODE_DOUBLE_HEIGHT : self::MODE_NORMAL));
            }

            fwrite($socket, $line . "\n");
        }

        // Reset all modes
        fwrite($socket, "\x1B\x21" . chr(self::MODE_NORMAL));
        fwrite($socket, "\x1B\x61\x00");
        fwrite($socket, "\x1B\x45\x00");

        return $qrInserted;
    }

    /**
     * Strip all formatting markers from text.
     */
    private function stripMarkers(string $text): string
    {
        return str_replace(
            [self::MARKER_BIG, self::MARKER_NOBIG, self::MARKER_CENTER, self::MARKER_NOCENTER, self::MARKER_BOLD, self::MARKER_NOBOLD, self::MARKER_QR, self::MARKER_HEADING, self::MARKER_NOHEADING, self::MARKER_CENTER_HW, self::MARKER_NOCENTER_HW],
            '',
            $text
        );
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
