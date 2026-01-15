<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use App\Services\Otp\OtpProviderInterface;
use App\Services\Otp\Sms019OtpService;
use App\Services\Otp\TwilioOtpProvider;

class SmsService
{
    public static function sendVerificationCode($phone, $code)
    {
        return self::sendOtp((string) $phone, (string) $code);
    }

    public static function sendOtp(string $phone, string $code): bool
    {
        return self::provider()->sendOtp($phone, $code);
    }

    public static function verifyOtp(string $phone, string $code): bool
    {
        return self::provider()->verifyOtp($phone, $code);
    }

    private static function provider(): OtpProviderInterface
    {
        $pilot = filter_var(config('sms.pilot', false), FILTER_VALIDATE_BOOLEAN);
        $provider = $pilot ? 'twilio' : 'sms019';

        return match ($provider) {
            'sms019', '019sms', '019' => new Sms019OtpService(),
            'twilio' => new TwilioOtpProvider(),
            default => tap(new TwilioOtpProvider(), function () use ($provider) {
                Log::warning('Unknown SMS provider, falling back to twilio', ['provider' => $provider]);
            }),
        };
    }
}
