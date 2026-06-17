<?php

namespace App\Services;

use App\Models\FcmToken;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class FcmService
{
    /** Channel id created on the Android client — must match nativePush.js ORDERS_CHANNEL_ID */
    private const ANDROID_CHANNEL_ID = 'orders';

    /**
     * Send a notification to a single token.
     *
     * The payload is platform-aware:
     *  - Native (android/ios): includes a `notification` block + high-priority `android`
     *    channel config so the OS shows a tray notification even when the app is
     *    backgrounded or fully terminated.
     *  - Web / unknown: keeps the data-only + `webpush` envelope so the existing
     *    service worker keeps full control of display + sound (unchanged behaviour).
     *
     * @param string|null $platform 'android'|'ios'|'web'|null. When null it is resolved
     *                              from the fcm_tokens table by token.
     */
    public function sendToToken(string $token, string $title, string $body, array $data = [], ?string $platform = null): bool
    {
        $projectId = config('fcm.project_id');
        $accessToken = $this->getAccessToken();

        if ($platform === null) {
            $platform = FcmToken::withoutGlobalScopes()->where('token', $token)->value('platform');
        }
        $isNative = in_array(strtolower((string) $platform), ['android', 'ios'], true);

        // Keep title/body in data so the SW / foreground handler can always display + ring.
        $dataMap = ['title' => (string) $title, 'body' => (string) $body];
        foreach ($data as $key => $value) {
            $dataMap[(string) $key] = (string) $value; // FCM requires string key/value map
        }

        $message = [
            'token' => $token,
            'data' => $dataMap,
            'webpush' => [
                'headers' => [
                    'TTL' => '300',
                    'Urgency' => 'high',
                ],
            ],
        ];

        if ($isNative) {
            // A top-level notification block is required for background/terminated delivery
            // on native devices; the android block routes it to the high-importance channel.
            $message['notification'] = [
                'title' => (string) $title,
                'body' => (string) $body,
            ];
            $message['android'] = [
                'priority' => 'HIGH',
                'notification' => [
                    'channel_id' => self::ANDROID_CHANNEL_ID,
                    'sound' => 'default',
                    'default_sound' => true,
                    'notification_priority' => 'PRIORITY_HIGH',
                ],
            ];
        }

        $payload = [
            'message' => $message,
        ];

        $response = Http::withToken($accessToken)
            ->post("https://fcm.googleapis.com/v1/projects/{$projectId}/messages:send", $payload);

        if (!$response->successful()) {
            Log::warning('FCM send failed', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            return false;
        } else {
            Log::info('FCM send ok', [
                'name' => $response->json('name'),
            ]);
            return true;
        }
    }

    /**
     * Get OAuth access token using the service account JSON.
     */
    private function getAccessToken(): string
    {
        $serviceAccountPath = config('fcm.service_account');
        if (!$serviceAccountPath || !file_exists($serviceAccountPath)) {
            throw new \RuntimeException('FCM service account file not found');
        }

        $json = json_decode(file_get_contents($serviceAccountPath), true, 512, JSON_THROW_ON_ERROR);

        $clientEmail = $json['client_email'] ?? null;
        $privateKey = $json['private_key'] ?? null;
        if (!$clientEmail || !$privateKey) {
            throw new \RuntimeException('Invalid service account file');
        }

        $now = time();
        $jwtHeader = $this->base64UrlEncode(json_encode(['alg' => 'RS256', 'typ' => 'JWT'], JSON_THROW_ON_ERROR));
        $jwtClaimSet = $this->base64UrlEncode(json_encode([
            'iss' => $clientEmail,
            'scope' => 'https://www.googleapis.com/auth/firebase.messaging',
            'aud' => 'https://oauth2.googleapis.com/token',
            'iat' => $now,
            'exp' => $now + 3600,
        ], JSON_THROW_ON_ERROR));

        $unsigned = $jwtHeader . '.' . $jwtClaimSet;
        $privateKeyResource = openssl_get_privatekey($this->normalizePrivateKey($privateKey));
        if (!$privateKeyResource) {
            throw new \RuntimeException('Failed to parse private key');
        }

        $signature = '';
        $signed = openssl_sign($unsigned, $signature, $privateKeyResource, 'sha256');
        if (!$signed) {
            throw new \RuntimeException('Failed to sign JWT for FCM');
        }

        $jwt = $unsigned . '.' . $this->base64UrlEncode($signature);

        $response = Http::asForm()->post('https://oauth2.googleapis.com/token', [
            'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion' => $jwt,
        ]);

        if (!$response->successful()) {
            throw new \RuntimeException('Failed to fetch FCM access token: ' . $response->body());
        }

        return $response->json('access_token');
    }

    private function base64UrlEncode(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }

    private function normalizePrivateKey(string $key): string
    {
        return str_replace("\\n", "\n", $key);
    }
}
