<?php

namespace App\Services\Printing;

/**
 * QR Code (Model 2) עבור מדפסות תואמות Epson ESC/POS (GS ( k …)).
 */
final class EscPosQrHelper
{
    /**
     * רצף פקודות: יישור מרכז, הגדרת QR, שמירת נתונים, הדפסה, יישור שמאל.
     */
    public static function centeredQrCode(string $data): string
    {
        if ($data === '') {
            return '';
        }

        $len = strlen($data);
        if ($len > 2048) {
            $data = substr($data, 0, 2048);
            $len = strlen($data);
        }

        $out = '';
        $out .= "\x1B\x61\x01";

        $out .= "\x1D\x28\x6B\x04\x00\x31\x41\x32\x00";
        $out .= "\x1D\x28\x6B\x03\x00\x31\x43\x06";
        $out .= "\x1D\x28\x6B\x03\x00\x31\x45\x31";

        $storeLen = 3 + $len;
        $out .= "\x1D\x28\x6B".chr($storeLen & 0xFF).chr(($storeLen >> 8) & 0xFF)."\x31\x50\x30".$data;
        $out .= "\x1D\x28\x6B\x03\x00\x31\x51\x30";

        $out .= "\x1B\x61\x00";

        return $out;
    }
}
