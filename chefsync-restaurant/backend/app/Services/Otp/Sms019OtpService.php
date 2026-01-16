<?php

namespace App\Services\Otp;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class Sms019OtpService implements OtpProviderInterface
{
    public function sendOtp(string $phone, string $code): bool
    {
        $endpoint = (string) config('sms.providers.sms019.endpoint');
        $token = (string) config('sms.providers.sms019.token');
        $source = (string) config('sms.providers.sms019.source');
        $username = (string) config('sms.providers.sms019.username');
        $timeout = (int) config('sms.providers.sms019.timeout');

        if ($endpoint === '' || $token === '') {
            Log::warning('019sms config missing', [
                'endpoint' => (bool) $endpoint,
                'token' => (bool) $token,
            ]);
            return false;
        }

        if ($username === '') {
            Log::warning('019sms username missing');
            return false;
        }

        $normalizedPhone = $this->normalizeIsraeliPhoneTo972($phone);
        if ($normalizedPhone === null) {
            Log::warning('019sms invalid phone', ['phone' => $phone]);
            return false;
        }

        $message = "קוד האימות שלך הוא: {$code}";

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

            return $this->isSuccess($response);
        } catch (\Throwable $e) {
            Log::error('019sms exception', [
                'message' => $e->getMessage(),
                'endpoint' => $endpoint,
            ]);
            return false;
        }
    }

    /**
     * Detailed send used by Super Admin debug endpoint.
     *
     * NOTE:
     * - destinations.phone must be international digits without '+': ["9725XXXXXXXX"]
     * - source must NOT be normalized to 972 (can be 0-leading number or sender name)
     * - user.username must come from env/config (SMS_019_USERNAME)
     */
    public function sendOtpDetailed(string $phone, string $code): array
    {
        $endpoint = (string) config('sms.providers.sms019.endpoint');
        $token = (string) config('sms.providers.sms019.token');
        $source = (string) config('sms.providers.sms019.source');
        $username = (string) config('sms.providers.sms019.username');
        $timeout = (int) config('sms.providers.sms019.timeout');

        $tokenTail = $token === '' ? null : substr($token, -6);

        if ($endpoint === '' || $token === '' || $username === '') {
            return [
                'sent' => false,
                'resolved_source' => $source !== '' ? $source : null,
                'resolved_destination' => null,
                'used_username' => $username !== '' ? $username : null,
                'token_tail' => $tokenTail,
                'http_status' => null,
                'provider_status' => null,
                'provider_message' => '019sms config missing',
            ];
        }

        $normalizedPhone = $this->normalizeIsraeliPhoneTo972($phone);
        if ($normalizedPhone === null) {
            return [
                'sent' => false,
                'resolved_source' => $source,
                'resolved_destination' => null,
                'used_username' => $username,
                'token_tail' => $tokenTail,
                'http_status' => null,
                'provider_status' => null,
                'provider_message' => 'invalid destination phone',
            ];
        }

        $message = "קוד האימות שלך הוא: {$code}";

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
            $providerStatus = is_array($data) ? ($data['status'] ?? null) : null;
            $providerMessage = is_array($data)
                ? ($data['message'] ?? $data['statusDescription'] ?? $data['description'] ?? null)
                : null;

            $sent = $this->isSuccess($response);

            return [
                'sent' => $sent,
                'resolved_source' => $source,
                'resolved_destination' => $normalizedPhone,
                'used_username' => $username,
                'token_tail' => $tokenTail,
                'http_status' => $response->status(),
                'provider_status' => $providerStatus,
                'provider_message' => $providerMessage,
            ];
        } catch (\Throwable $e) {
            Log::error('019sms exception', [
                'message' => $e->getMessage(),
                'endpoint' => $endpoint,
            ]);

            return [
                'sent' => false,
                'resolved_source' => $source,
                'resolved_destination' => $normalizedPhone,
                'used_username' => $username,
                'token_tail' => $tokenTail,
                'http_status' => null,
                'provider_status' => null,
                'provider_message' => $e->getMessage(),
            ];
        }
    }

    public function verifyOtp(string $phone, string $code): bool
    {
        return true;
    }

    private function isSuccess(Response $response): bool
    {
        $data = $response->json();

        if (!is_array($data)) {
            Log::error('019sms unexpected response', [
                'http_status' => $response->status(),
                'response' => $response->body(),
            ]);
            return false;
        }

        $status = $data['status'] ?? null;
        if ((string) $status === '0' || $status === 0) {
            return true;
        }

        Log::error('019sms send failed', [
            'http_status' => $response->status(),
            'response' => $response->body(),
        ]);
        return false;
    }

    private function normalizeIsraeliPhoneTo972(string $raw): ?string
    {
        $digits = preg_replace('/\D+/', '', $raw);
        if ($digits === '' || $digits === null) {
            return null;
        }

        // 05XXXXXXXX -> 9725XXXXXXXX
        if (str_starts_with($digits, '05') && strlen($digits) === 10) {
            return '972' . substr($digits, 1);
        }

        // 5XXXXXXXXX -> 9725XXXXXXXXX
        if (str_starts_with($digits, '5') && strlen($digits) === 9) {
            return '972' . $digits;
        }

        // +9725XXXXXXXX or 9725XXXXXXXX -> 9725XXXXXXXX
        if (str_starts_with($digits, '972')) {
            $rest = substr($digits, 3);
            if ($rest !== '' && $rest[0] === '0') {
                $rest = substr($rest, 1);
            }
            if ($rest !== '' && $rest[0] === '5') {
                return '972' . $rest;
            }
        }

        // 0XXXXXXXXX (fallback) -> 972XXXXXXXXX
        if (str_starts_with($digits, '0') && strlen($digits) >= 9 && strlen($digits) <= 10) {
            $candidate = '972' . substr($digits, 1);
            if (strlen($candidate) >= 11 && str_starts_with(substr($candidate, 3), '5')) {
                return $candidate;
            }
        }

        return null;
    }
}
