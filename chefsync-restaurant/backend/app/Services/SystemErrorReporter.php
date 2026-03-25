<?php

namespace App\Services;

use App\Models\SystemError;
use Illuminate\Support\Facades\Log;

class SystemErrorReporter
{
    /**
     * Persist a row in system_errors for super-admin monitoring. Never throws.
     */
    public static function report(
        string $errorType,
        string $message,
        string $severity = 'error',
        ?string $tenantId = null,
        ?int $orderId = null,
        ?string $correlationId = null,
        ?string $stackTrace = null,
        ?array $context = null
    ): void {
        try {
            SystemError::log(
                $errorType,
                $message,
                $severity,
                $tenantId,
                $orderId,
                $correlationId,
                $stackTrace,
                $context
            );
        } catch (\Throwable $e) {
            Log::error('SystemErrorReporter: failed to persist', [
                'error' => $e->getMessage(),
                'error_type' => $errorType,
            ]);
        }
    }
}
