<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
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

    public static function sendApprovalMessage(string $phone, string $restaurantName): bool
    {
        $message = sprintf('המסעדה "%s" אושרה. ניתן להתחבר ולפתוח את המסעדה.', $restaurantName);
        return self::sendPlainText($phone, $message);
    }

    public static function sendPlainText(string $phone, string $message): bool
    {
        if (app()->environment('local')) {
            Log::info('Local SMS bypass: plain text', [
                'phone' => $phone,
                'message' => $message,
            ]);
            return true;
        }

        $provider = self::resolveProvider();

        return match ($provider) {
            'sms019', '019sms', '019' => self::sendPlainTextVia019($phone, $message),
            default => self::sendPlainTextViaTwilio($phone, $message),
        };
    }

    private static function sendPlainTextViaTwilio(string $phone, string $message): bool
    {
        $sid = config('sms.providers.twilio.sid');
        $token = config('sms.providers.twilio.token');
        $messagingServiceSid = config('sms.providers.twilio.messaging_service_sid');
        $from = config('sms.providers.twilio.from');

        if (!$sid || !$token) {
            Log::warning('Twilio config missing for plain SMS', [
                'sid' => (bool) $sid,
                'token' => (bool) $token,
                'messagingServiceSid' => (bool) $messagingServiceSid,
                'from' => (bool) $from,
            ]);
            return false;
        }

        if (!$messagingServiceSid && !$from) {
            Log::warning('Twilio destination missing (MessagingServiceSid/From) for plain SMS');
            return false;
        }

        $twilioUrl = "https://api.twilio.com/2010-04-01/Accounts/{$sid}/Messages.json";

        $payload = [
            'To' => $phone,
            'Body' => $message,
        ];

        if ($messagingServiceSid) {
            $payload['MessagingServiceSid'] = $messagingServiceSid;
        } else {
            $payload['From'] = $from;
        }

        try {
            $response = Http::asForm()
                ->withBasicAuth($sid, $token)
                ->post($twilioUrl, $payload);

            if (!$response->successful()) {
                Log::error('Twilio SMS failed (plain)', [
                    'status' => $response->status(),
                    'response' => $response->body(),
                ]);
            }

            return $response->successful();
        } catch (\Throwable $e) {
            Log::error('Twilio SMS exception (plain)', ['message' => $e->getMessage()]);
            return false;
        }
    }

    private static function sendPlainTextVia019(string $phone, string $message): bool
    {
        $endpoint = (string) config('sms.providers.sms019.endpoint');
        $token = (string) config('sms.providers.sms019.token');
        $source = (string) config('sms.providers.sms019.source');
        $username = (string) config('sms.providers.sms019.username');
        $timeout = (int) config('sms.providers.sms019.timeout');

        if ($endpoint === '' || $token === '') {
            Log::warning('019sms config missing for plain SMS', [
                'endpoint' => (bool) $endpoint,
                'token' => (bool) $token,
            ]);
            return false;
        }

        if ($username === '') {
            Log::warning('019sms username missing for plain SMS');
            return false;
        }

        $normalizedPhone = self::normalizeIsraeliPhoneTo972($phone);
        if ($normalizedPhone === null) {
            Log::warning('019sms invalid phone for plain SMS', ['phone' => $phone]);
            return false;
        }

        $payload = [
            'sms' => [
                'user' => [
                    'username' => $username,
                ],
                'source' => $source,
                'destinations' => [
                    'phone' => [$normalizedPhone],
                ],
                'message' => $message,
            ],
        ];

        try {
            $response = Http::timeout($timeout)
                ->withHeaders([
                    'Authorization' => "Bearer {$token}",
                    'Accept' => 'application/json',
                ])
                ->asJson()
                ->post($endpoint, $payload);

            $data = $response->json();
            $status = is_array($data) ? ($data['status'] ?? null) : null;
            $isSuccess = (string) $status === '0' || $status === 0;

            if (!$isSuccess) {
                Log::error('019sms send failed (plain)', [
                    'http_status' => $response->status(),
                    'response' => $response->body(),
                ]);
            }

            return $isSuccess;
        } catch (\Throwable $e) {
            Log::error('019sms exception (plain)', [
                'message' => $e->getMessage(),
                'endpoint' => $endpoint,
            ]);
            return false;
        }
    }

    private static function resolveProvider(): string
    {
        $pilot = filter_var(config('sms.pilot', false), FILTER_VALIDATE_BOOLEAN);
        return $pilot ? 'twilio' : (string) config('sms.provider', 'twilio');
    }

    private static function normalizeIsraeliPhoneTo972(string $raw): ?string
    {
        $digits = preg_replace('/\D+/', '', $raw);
        if ($digits === '' || $digits === null) {
            return null;
        }

        if (str_starts_with($digits, '05') && strlen($digits) === 10) {
            return '972' . substr($digits, 1);
        }

        if (str_starts_with($digits, '5') && strlen($digits) === 9) {
            return '972' . $digits;
        }

        if (str_starts_with($digits, '972')) {
            $rest = substr($digits, 3);
            if ($rest !== '' && $rest[0] === '0') {
                $rest = substr($rest, 1);
            }
            if ($rest !== '' && $rest[0] === '5') {
                return '972' . $rest;
            }
        }

        if (str_starts_with($digits, '0') && strlen($digits) >= 9 && strlen($digits) <= 10) {
            $candidate = '972' . substr($digits, 1);
            if (strlen($candidate) >= 11 && str_starts_with(substr($candidate, 3), '5')) {
                return $candidate;
            }
        }

        return null;
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
