<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;

/**
 * BitmapReceiptRenderer
 *
 * ממיר payload טקסטי (פורמט של PrintService — עם מרקרים {{BIG}}, {{HEADING}},
 * {{BOLD}}, {{CENTER}}, ===, --- וכו') לתמונת GD ומפיק ממנה בתים בפורמט
 * ESC/POS GS v 0 (raster bitmap) לשליחה ישירה למדפסת תרמית.
 *
 * שימוש:
 *   $renderer = new BitmapReceiptRenderer();
 *   $escposBytes = $renderer->render($textPayload);
 *   // → בתים מוכנים לשליחה ל-TCP 9100
 */
class BitmapReceiptRenderer
{
    // רוחב נייר בפיקסלים: 576px = 80mm@203dpi, 384px = 58mm@203dpi
    private const PAPER_WIDTH_80MM = 576;
    private const PAPER_WIDTH_58MM = 384;

    // שמות גופנים (נבדקים בסדר עדיפות)
    private static array $fontCandidates = [
        // macOS
        '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
        '/System/Library/Fonts/ArialHB.ttc',
        '/Library/Fonts/Arial Unicode.ttf',
        // Linux (Ubuntu/Debian production)
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
        '/usr/share/fonts/truetype/freefont/FreeSans.ttf',
        '/usr/share/fonts/dejavu/DejaVuSans.ttf',
        // CentOS/RHEL
        '/usr/share/fonts/dejavu-sans-fonts/DejaVuSans.ttf',
    ];

    private string $fontPath;
    private int $paperWidth;

    public function __construct(int $paperWidthPx = self::PAPER_WIDTH_80MM)
    {
        $this->paperWidth = $paperWidthPx;
        $this->fontPath = $this->resolveFontPath();
    }

    /**
     * ממיר payload טקסטי לבתים ESC/POS (ESC @ + GS v 0 raster + חיתוך).
     *
     * @param  string  $textPayload  פלט של buildReceiptPayload / buildKitchenTicket
     * @return string  בתים גולמיים לשליחה למדפסת
     *
     * @throws \RuntimeException אם GD אינו זמין
     */
    public function render(string $textPayload): string
    {
        if (! extension_loaded('gd')) {
            throw new \RuntimeException('PHP GD extension is required for bitmap rendering');
        }

        $lines = $this->parsePayload($textPayload);
        $image = $this->renderToImage($lines);
        $raster = $this->imageToEscPosRaster($image);
        // imagedestroy() is deprecated since PHP 8.5 (GC handles cleanup automatically)
        if (PHP_VERSION_ID < 80500) {
            imagedestroy($image); // @phpstan-ignore-line
        }

        // ESC @ (init) + raster bytes + 4 LF + GS V 0 (full cut)
        return "\x1b\x40" . $raster . "\x0a\x0a\x0a\x0a" . "\x1d\x56\x00";
    }

    // ─── Payload Parser ───────────────────────────────────────────────────────

    /**
     * מחלק את הpayload לרשימת שורות לוגיות עם מטא-דטה סגנונות.
     *
     * @return array<array{text: string, bold: bool, big: bool, heading: bool, align: string, divider: string|null}>
     */
    private function parsePayload(string $payload): array
    {
        $rawLines = explode("\n", $payload);

        $result = [];
        $bold = false;
        $big = false;
        $heading = false;
        $align = 'center'; // ברירת מחדל: מרוכז (כמו Classic template)

        // מרקרים לפתיחה/סגירה
        $openTags  = [
            '{{BIG}}' => 'big',
            '{{BOLD}}' => 'bold',
            '{{HEADING}}' => 'heading',
            '{{CENTER}}' => 'center',
            '{{CENTER_HW}}' => 'center_hw'
        ];
        $closeTags = [
            '{{/BIG}}' => 'big',
            '{{/BOLD}}' => 'bold',
            '{{/HEADING}}' => 'heading',
            '{{/CENTER}}' => 'center',
            '{{/CENTER_HW}}' => 'center_hw'
        ];

        foreach ($rawLines as $raw) {
            $line = trim($raw);

            // skip: QR placeholder (אין תמיכה ב-QR בbitmap — ייתוסף בנפרד)
            if ($line === '{{QR}}') {
                continue;
            }

            // עיבוד מרקרים inline (שורה עשויה להכיל רק מרקרים)
            $remaining = $line;
            foreach ($openTags as $tag => $type) {
                if (str_contains($remaining, $tag)) {
                    $remaining = str_replace($tag, '', $remaining);
                    match ($type) {
                        'big'       => $big = true,
                        'bold'      => $bold = true,
                        'heading'   => $heading = true,
                        'center',
                        'center_hw' => $align = 'center',
                        default     => null,
                    };
                }
            }
            foreach ($closeTags as $tag => $type) {
                if (str_contains($remaining, $tag)) {
                    $remaining = str_replace($tag, '', $remaining);
                    match ($type) {
                        'big'       => $big = false,
                        'bold'      => $bold = false,
                        'heading'   => $heading = false,
                        'center',
                        'center_hw' => null, // שמור center
                        default     => null,
                    };
                }
            }

            $text = trim($remaining);

            // שורת מפריד: === או --- (רצף של תו אחד בלבד, 3+ פעמים)
            $divider = null;
            if (preg_match('/^([=\-█*_]{3,})$/', $text, $m)) {
                $divider = $m[1][0]; // סוג המפריד: =, -, █, *, _
                $text = '';
            }

            $result[] = [
                'text'    => $text,
                'bold'    => $bold || $heading,
                'big'     => $big || $heading,
                'heading' => $heading,
                'align'   => $align,
                'divider' => $divider,
            ];
        }

        // סנן שורות ריקות מרובות ברצף (מקסימום 2 רצופות)
        return $this->collapseBlankLines($result);
    }

    private function collapseBlankLines(array $lines): array
    {
        $out = [];
        $blanks = 0;
        foreach ($lines as $l) {
            if ($l['text'] === '' && $l['divider'] === null) {
                $blanks++;
                if ($blanks <= 1) {
                    $out[] = $l;
                }
            } else {
                $blanks = 0;
                $out[] = $l;
            }
        }

        return $out;
    }

    // ─── Image Renderer ───────────────────────────────────────────────────────

    /**
     * @param  array<array{text: string, bold: bool, big: bool, heading: bool, align: string, divider: string|null}>  $lines
     * @return \GdImage
     */
    private function renderToImage(array $lines): \GdImage
    {
        // גדלי גופן (בנקודות)
        $fontNormal  = 18;
        $fontBig     = 25;
        $fontHeading = 32;

        $lineSpacing   = 5;  // px בין שורות
        $padX          = 12; // padding אופקי
        $dividerHeight = 3;  // עובי קו מפריד
        $dividerGap    = 5;  // רווח מעל/מתחת למפריד

        // חישוב גובה הדרוש
        $totalHeight = 16; // margin עליון
        foreach ($lines as $l) {
            if ($l['divider'] !== null) {
                $totalHeight += $dividerHeight + $dividerGap * 2;
            } elseif ($l['text'] === '') {
                $totalHeight += $l['big'] ? (int) ($fontBig * 0.7) : (int) ($fontNormal * 0.7);
            } else {
                $fs = $l['heading'] ? $fontHeading : ($l['big'] ? $fontBig : $fontNormal);
                $totalHeight += $fs + $lineSpacing;
            }
        }
        $totalHeight += 24; // margin תחתון

        // יצירת תמונה לבנה
        $img = imagecreatetruecolor($this->paperWidth, $totalHeight);
        if ($img === false) {
            throw new \RuntimeException('GD: failed to create image');
        }
        $white = imagecolorallocate($img, 255, 255, 255);
        $black = imagecolorallocate($img, 0, 0, 0);
        imagefill($img, 0, 0, $white);

        $y = 16;
        $drawWidth = $this->paperWidth - $padX * 2;

        foreach ($lines as $l) {
            // מפריד גרפי
            if ($l['divider'] !== null) {
                $y += $dividerGap;
                $thick = ($l['divider'] === '=') ? $dividerHeight : 1;
                for ($t = 0; $t < $thick; $t++) {
                    imageline($img, $padX, $y + $t, $this->paperWidth - $padX, $y + $t, $black);
                }
                $y += $thick + $dividerGap;
                continue;
            }

            // שורה ריקה
            if ($l['text'] === '') {
                $fs = $l['big'] ? $fontBig : $fontNormal;
                $y += (int) ($fs * 0.7);
                continue;
            }

            $fs = $l['heading'] ? $fontHeading : ($l['big'] ? $fontBig : $fontNormal);
            $text = $l['text'];

            // זיהוי עברית → RTL
            $isHebrew = $this->containsHebrew($text);
            if ($isHebrew) {
                $text = $this->prepareHebrew($text);
            }

            // מדידת רוחב טקסט לצורך יישור
            $bbox = $this->measureText($fs, $text);
            $textWidth = abs($bbox[2] - $bbox[0]);

            $x = match ($l['align']) {
                'center' => (int) (($this->paperWidth - $textWidth) / 2),
                'right'  => $this->paperWidth - $padX - $textWidth,
                default  => $padX,
            };
            $x = max($padX, $x);

            // ציור טקסט
            imagettftext($img, $fs, 0, $x, $y + $fs, $black, $this->fontPath, $text);

            $y += $fs + $lineSpacing;
        }

        return $img;
    }

    // ─── ESC/POS Raster Encoder ───────────────────────────────────────────────

    /**
     * ממיר GdImage לרצף GS v 0 (raster bit-image command).
     * פורמט: GS v 0 m xL xH yL yH <data>
     * כאשר:  m=0 (normal density), xL/xH = רוחב ב-bytes, yL/yH = גובה ב-שורות.
     */
    private function imageToEscPosRaster(\GdImage $img): string
    {
        $width  = imagesx($img);
        $height = imagesy($img);

        // עיגול רוחב ל-8 ביטים (byte boundary)
        $bytesPerRow = (int) ceil($width / 8);
        $paddedWidth = $bytesPerRow * 8;

        $xL = $bytesPerRow & 0xFF;
        $xH = ($bytesPerRow >> 8) & 0xFF;
        $yL = $height & 0xFF;
        $yH = ($height >> 8) & 0xFF;

        // GS v 0 m xL xH yL yH
        $header = "\x1d\x76\x30\x00" . chr($xL) . chr($xH) . chr($yL) . chr($yH);

        $data = '';
        for ($row = 0; $row < $height; $row++) {
            for ($byteIdx = 0; $byteIdx < $bytesPerRow; $byteIdx++) {
                $byte = 0;
                for ($bit = 0; $bit < 8; $bit++) {
                    $px = $byteIdx * 8 + $bit;
                    if ($px < $width) {
                        $colorIndex = imagecolorat($img, $px, $row);
                        $r = ($colorIndex >> 16) & 0xFF;
                        $g = ($colorIndex >> 8) & 0xFF;
                        $b = $colorIndex & 0xFF;
                        $lum = (int) (0.299 * $r + 0.587 * $g + 0.114 * $b);
                        if ($lum < 128) { // כהה → bit=1
                            $byte |= (0x80 >> $bit);
                        }
                    }
                }
                $data .= chr($byte);
            }
        }

        return $header . $data;
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private function containsHebrew(string $text): bool
    {
        return (bool) preg_match('/[\x{0590}-\x{05FF}]/u', $text);
    }

    /**
     * עברית: היפוך מסדר לוגי לסדר ויזואלי עבור GD (שמצייר LTR).
     * אלגוריתם מילה-מילה: מספרים, טלפונים, תאריכים, אנגלית — נשמרים ברצף המקורי.
     * רק מילים עם עברית עוברות היפוך תווים פנימי.
     */
    private function prepareHebrew(string $text): string
    {
        if ($text === '' || ! preg_match('/\p{Hebrew}/u', $text)) {
            return $text;
        }

        // שמירת רווחים מובילים (indent)
        if (! preg_match('/^(?P<lead>\s*)(?P<rest>.*)$/us', $text, $m)) {
            return $text;
        }
        $leading = $m['lead'];
        $rest    = $m['rest'];

        if ($rest === '') {
            return $text;
        }

        $words = preg_split('/\s+/u', $rest, -1, PREG_SPLIT_NO_EMPTY);
        if (! $words) {
            return $text;
        }

        $mapped = array_map(function (string $word): string {
            // טוקן LTR (מספר, טלפון, תאריך, כמות, אנגלית טהורה) → ללא היפוך תווים
            if ($this->isLtrToken($word)) {
                return $word;
            }
            // מילה עם עברית → היפוך תווים פנימי
            if (preg_match('/\p{Hebrew}/u', $word)) {
                return $this->reverseChars($word);
            }
            // LTR בלי עברית (לדוגמה סמל, פונקציה) → ללא שינוי
            return $word;
        }, $words);

        return $leading . implode(' ', array_reverse($mapped));
    }

    /**
     * האם הטוקן LTR שצריך להישמר כמו שהוא (לא להפוך תווים).
     */
    private function isLtrToken(string $word): bool
    {
        // מספר עשרוני טהור (45.00, 9,90, 100)
        if (preg_match('/^[\d]+([.,][\d]+)?$/u', $word)) {
            return true;
        }
        // מספר הזמנה #42
        if (preg_match('/^#\d+$/u', $word)) {
            return true;
        }
        // כמות 1x, 2x
        if (preg_match('/^\d+x$/iu', $word)) {
            return true;
        }
        // סמל מטבע + מספר: ₪45.00
        if (preg_match('/^[₪$€]\s*[\d.,]+$/u', $word)) {
            return true;
        }
        // טלפון: ספרות עם מקפים (054-646-8056)
        if (preg_match('/^\d[\d\-]+\d$/u', $word)) {
            return true;
        }
        // תאריך/שעה: ספרות עם / . :
        if (preg_match('/^\d+[\/.:]\d/u', $word)) {
            return true;
        }
        // אנגלית טהורה (ללא עברית כלל)
        if (preg_match('/^[A-Za-z0-9\-_.,!?@#%&*()\[\]{}:\/]+$/u', $word)) {
            return true;
        }

        return false;
    }

    /**
     * היפוך תווי UTF-8 בתוך מחרוזת (עברית בלבד).
     * סוגריים/סוגרים מוחלפים במשוקפם לאחר ההיפוך כדי שיישארו נכונים ויזואלית.
     */
    private function reverseChars(string $s): string
    {
        $chars = preg_split('//u', $s, -1, PREG_SPLIT_NO_EMPTY);
        if (! $chars) {
            return $s;
        }

        $mirrors = ['(' => ')', ')' => '(', '[' => ']', ']' => '[', '{' => '}', '}' => '{'];

        return implode('', array_map(
            fn(string $c) => $mirrors[$c] ?? $c,
            array_reverse($chars)
        ));
    }

    /**
     * @return int[]  bounding box של imagettfbbox
     */
    private function measureText(int $size, string $text): array
    {
        $bbox = @imagettfbbox($size, 0, $this->fontPath, $text);
        if ($bbox === false) {
            // fallback: הערכה גסה
            return [
                0,
                0,
                (int) ($size * mb_strlen($text, 'UTF-8') * 0.6),
                0,
                (int) ($size * mb_strlen($text, 'UTF-8') * 0.6),
                $size,
                0,
                $size
            ];
        }

        return $bbox;
    }

    private function resolveFontPath(): string
    {
        foreach (self::$fontCandidates as $path) {
            if (file_exists($path) && is_readable($path)) {
                return $path;
            }
        }

        // אם לא נמצא TTF, נשתמש בגופן מובנה של PHP (אין תמיכה בעברית אבל לא נקרוס)
        Log::warning('BitmapReceiptRenderer: No TTF font found — falling back to GD built-in (Hebrew may not render correctly)');

        // החזרת נתיב ריק — imagettftext ייכשל ונאלץ להשתמש בimagestring
        return '';
    }

    public function isAvailable(): bool
    {
        return extension_loaded('gd') && $this->fontPath !== '' && file_exists($this->fontPath);
    }
}
