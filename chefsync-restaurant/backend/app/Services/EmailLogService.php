<?php

namespace App\Services;

use App\Models\EmailLog;

class EmailLogService
{
    public static function log(
        string $toEmail,
        string $type,
        string $subject,
        ?int $customerId = null,
        string $status = 'sent',
        ?string $error = null,
        ?array $metadata = null
    ): EmailLog {
        return EmailLog::create([
            'to_email' => $toEmail,
            'customer_id' => $customerId,
            'type' => $type,
            'subject' => $subject,
            'status' => $status,
            'error' => $error,
            'metadata' => $metadata,
        ]);
    }
}
