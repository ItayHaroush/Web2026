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

    public static function sendVerificationCodeDetailed($phone, $code): array
    {
        return self::sendOtpDetailed((string) $phone, (string) $code);
    }

    public static function sendOtp(string $phone, string $code): bool
    {
        if (app()->environment('local')) {
            Log::info('Local SMS bypass: OTP generated', [
                'phone' => $phone,
                'code' => $code,
            ]);
            return true;
        }

        return self::provider()->sendOtp($phone, $code);
    }

    public static function sendOtpDetailed(string $phone, string $code): array
    {
        if (app()->environment('local')) {
            Log::info('Local SMS bypass: OTP generated (detailed)', [
                'phone' => $phone,
                'code' => $code,
            ]);
            return [
                'sent' => true,
                'resolved_source' => 'local-bypass',
                'resolved_destination' => $phone,
                'used_username' => null,
                'token_tail' => null,
                'http_status' => 200,
                'provider_status' => 'local-bypass',
                'provider_message' => 'SMS bypassed in local environment',
                'code' => $code,
            ];
        }

        $provider = self::provider();

        if (is_callable([$provider, 'sendOtpDetailed'])) {
            /** @var array $result */
            $result = call_user_func([$provider, 'sendOtpDetailed'], $phone, $code);
            return $result;
        }

        $sent = $provider->sendOtp($phone, $code);

        return [
            'sent' => $sent,
            'resolved_source' => null,
            'resolved_destination' => null,
            'used_username' => null,
            'token_tail' => null,
            'http_status' => null,
            'provider_status' => null,
            'provider_message' => null,
        ];
    }

    public static function verifyOtp(string $phone, string $code): bool
    {
        return self::provider()->verifyOtp($phone, $code);
    }

    private static function provider(): OtpProviderInterface
    {
        $pilot = filter_var(config('sms.pilot', false), FILTER_VALIDATE_BOOLEAN);
        $provider = $pilot
            ? 'twilio'
            : (string) config('sms.provider', 'twilio');

        return match ($provider) {
            'sms019', '019sms', '019' => new Sms019OtpService(),
            'twilio' => new TwilioOtpProvider(),
            default => tap(new TwilioOtpProvider(), function () use ($provider) {
                Log::warning('Unknown SMS provider, falling back to twilio', ['provider' => $provider]);
            }),
        };
    }
}
