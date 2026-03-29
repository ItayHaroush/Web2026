<?php

namespace App\Services\Printing;

use Illuminate\Support\Facades\Log;

/**
 * UTF-8 → הכנת RTL למדפסת תרמית LTR → CP862 (IBM862).
 * אותה לוגיקה כמו ב־php -r גולמי, אבל עם היפוך חכם כדי שהעברית לא תודפס הפוכה.
 */
final class ThermalHebrewEscPosEncoder
{
    /**
     * @param  bool  $applyRtl  כבה לבדיקות (כמו one-liner גולמי)
     */
    public function encodeUtf8ToCp862(string $utf8, bool $applyRtl = true): string
    {
        if ($utf8 === '') {
            return '';
        }

        $normalized = $this->normalizeNewlinesForPrinter($utf8);
        $normalized = $this->normalizeUnicodeForCp862($normalized);
        if ($applyRtl) {
            $normalized = $this->prepareThermalRtlPayload($normalized);
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
     * שורה-שורה: מילים עם עברית מתהפכות תו-תו, ואז סדר המילים מתהפך.
     * ריווח מוביל (למשל מרכוז) נשמר ולא נכנס לפיצול מילים.
     */
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
            return preg_match('/\p{Hebrew}/u', $word)
                ? $this->reverseUtf8String($word)
                : $word;
        }, $words);

        return $leading.implode(' ', array_reverse($mapped));
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
