<?php

namespace App\Support;

/**
 * mPDF דורש תיקיית temp כתיבה; בפרודקשן ברירת המחדל של החבילה עלולה להיכשל (Permission denied).
 */
final class MpdfWritableConfig
{
    public static function tempDir(): string
    {
        $dir = storage_path('app/mpdf-temp');
        if (! is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        return $dir;
    }

    /**
     * @param  array<string, mixed>  $config
     * @return array<string, mixed>
     */
    public static function merge(array $config): array
    {
        return array_merge(['tempDir' => self::tempDir()], $config);
    }
}
