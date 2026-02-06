<?php

namespace App\Services\Printing;

interface PrinterAdapter
{
    /**
     * שליחת נתונים למדפסת
     */
    public function print(string $payload, array $config): bool;

    /**
     * בדיקה אם המדפסת זמינה
     */
    public function isAvailable(array $config): bool;
}
