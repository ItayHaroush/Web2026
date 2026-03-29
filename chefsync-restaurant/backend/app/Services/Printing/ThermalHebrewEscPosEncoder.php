<?php

namespace App\Services\Printing;

use Illuminate\Support\Facades\Log;

/**
 * UTF-8 → הכנת RTL למדפסת תרמית LTR → CP862 (IBM862).
 * מחירים/מספרים: בלי היפוך תווים. אופציונלי: מרכוז שורות עבריות קצרות אחרי RTL.
 */
final class ThermalHebrewEscPosEncoder
{
    /**
     * @param  bool  $applyRtl  כבה לבדיקות
     * @param  int|null  $lineWidth  רוחב שורה (תווים) למרכוז שורות עבריות קצרות; null = בלי מרכוז נוסף
     */
    public function encodeUtf8ToCp862(string $utf8, bool $applyRtl = true, ?int $lineWidth = null): string
    {
        if ($utf8 === '') {
            return '';
        }

        $normalized = $this->normalizeNewlinesForPrinter($utf8);
        $normalized = $this->normalizeUnicodeForCp862($normalized);
        if ($applyRtl) {
            $normalized = $this->prepareThermalRtlPayload($normalized);
        }
        if ($lineWidth !== null && $lineWidth > 0) {
            $normalized = $this->applySelectiveCentering($normalized, $lineWidth);
        }

        $converted = @iconv('UTF-8', 'CP862//IGNORE', $normalized);
        if ($converted !== false && $converted !== '') {
            return $this->normalizeNewlinesForPrinter($converted);
        }

        $converted = @iconv('UTF-8', 'IBM862//IGNORE', $normalized);
        if ($converted !== false && $converted !== '') {
            return $this->normalizeNewlinesForPrinter($converted);
        }

        Log::warning('ThermalHebrewEscPosEncoder: CP862 iconv failed, using ASCII-safe fallback');

        return $this->normalizeNewlinesForPrinter(preg_replace('/[^\x09\x0A\x0D\x20-\x7E]/', '?', $normalized) ?? '');
    }

    /**
     * מרכוז אחרי RTL לשורות עבריות קצרות בלבד (לא מפרידים, לא שורות מלאות, לא תוספות, לא IP/תאריך).
     */
    private function applySelectiveCentering(string $text, int $width): string
    {
        $lines = explode("\n", $text);

        return implode("\n", array_map(function (string $line) use ($width) {
            if (! $this->shouldCenterLineAfterRtl($line, $width)) {
                return $line;
            }

            $trimmed = ltrim($line, ' ');
            $len = mb_strlen($trimmed, 'UTF-8');
            if ($len >= $width) {
                return $trimmed;
            }
            $pad = (int) (($width - $len) / 2);

            return str_repeat(' ', $pad).$trimmed;
        }, $lines));
    }

    private function shouldCenterLineAfterRtl(string $line, int $width): bool
    {
        if ($line === '') {
            return false;
        }
        if (mb_strlen($line, 'UTF-8') >= $width) {
            return false;
        }

        $trimmed = ltrim($line, ' ');
        if ($trimmed === '') {
            return false;
        }

        if (preg_match('/^\s{2,}\+/u', $line)) {
            return false;
        }

        if (preg_match('/^IP:/iu', $trimmed)) {
            return false;
        }

        if (preg_match('/\d{1,2}\.\d{1,2}\.\d{2,4}\s*\|\s*\d{1,2}:\d{2}/u', $trimmed)) {
            return false;
        }

        if (preg_match('/^\d{1,2}\.\d{1,2}\.\d{2,4}\s+\d{1,2}:\d{2}$/u', $trimmed)) {
            return false;
        }

        return (bool) preg_match('/\p{Hebrew}/u', $trimmed);
    }

    private function prepareThermalRtlPayload(string $utf8): string
    {
        if ($utf8 === '') {
            return '';
        }

        $lines = explode("\n", $utf8);

        return implode("\n", array_map(fn (string $line) => $this->smartReverseHebrewLine($line), $lines));
    }

    private function smartReverseHebrewLine(string $line): string
    {
        if ($line === '') {
            return $line;
        }

        if (! preg_match('/^(?<lead>\s*)(?<rest>.*)$/us', $line, $m)) {
            return $line;
        }

        $leading = $m['lead'];
        $rest = $m['rest'];

        if ($rest === '' || ! preg_match('/\p{Hebrew}/u', $rest)) {
            return $line;
        }

        $words = preg_split('/\s+/u', $rest, -1, PREG_SPLIT_NO_EMPTY);
        if ($words === false || $words === []) {
            return $line;
        }

        $mapped = array_map(function (string $word) {
            $word = $this->transformPriceShekelToken($word);

            if ($this->shouldSkipCharReverseForToken($word)) {
                return $word;
            }

            return preg_match('/\p{Hebrew}/u', $word)
                ? $this->reverseUtf8String($word)
                : $word;
        }, $words);

        return $leading.implode(' ', array_reverse($mapped));
    }

    /**
     * מספר + ש"ח (מרווח או צמוד): המספר ללא היפוך; ש"ח מופיע כהיפוך תווים לבד.
     */
    private function transformPriceShekelToken(string $word): string
    {
        if (preg_match('/^([\d.,]+)\s*ש"ח$/u', $word, $m)) {
            return $m[1].' '.$this->reverseUtf8String('ש"ח');
        }

        if (preg_match('/^([\d.,]+)ש"ח$/u', $word, $m)) {
            return $m[1].' '.$this->reverseUtf8String('ש"ח');
        }

        if (preg_match('/^ש"ח\s*([\d.,]+)$/u', $word, $m)) {
            return $m[1].' '.$this->reverseUtf8String('ש"ח');
        }

        if (preg_match('/^ש"ח([\d.,]+)$/u', $word, $m)) {
            return $m[1].' '.$this->reverseUtf8String('ש"ח');
        }

        return $word;
    }

    /**
     * מספרים טהורים / כמות — בלי היפוך. ש"ח מטופל ב-transformPriceShekelToken או בהיפוך עברית רגיל.
     */
    private function shouldSkipCharReverseForToken(string $word): bool
    {
        if (preg_match('/^[\d]+([.,][\d]+)?$/u', $word)) {
            return true;
        }

        if (preg_match('/^#\d+$/u', $word)) {
            return true;
        }

        if (preg_match('/^\d+x$/iu', $word)) {
            return true;
        }

        if (preg_match('/^₪\s*[\d]+([.,][\d]+)?$/u', $word)) {
            return true;
        }

        if (preg_match('/^[\d.,]+\s+\X+$/u', $word) && preg_match('/\p{Hebrew}/u', $word)) {
            return true;
        }

        return false;
    }

    private function reverseUtf8String(string $s): string
    {
        if ($s === '') {
            return '';
        }

        $chars = mb_str_split($s, 1, 'UTF-8');

        return implode('', array_reverse($chars));
    }

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
}
