<?php

namespace App\Services;

use Illuminate\Support\Facades\URL;

class EmailMarketingUnsubscribeService
{
    public static function unsubscribeUrl(string $email): string
    {
        return URL::temporarySignedRoute(
            'email.marketing.unsubscribe',
            now()->addYears(10),
            ['email' => $email],
        );
    }

    public static function listUnsubscribeHeaderValue(string $email): string
    {
        return '<'.self::unsubscribeUrl($email).'>';
    }
}
