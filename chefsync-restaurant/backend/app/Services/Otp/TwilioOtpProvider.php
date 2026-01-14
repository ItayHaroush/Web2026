<?php

namespace App\Services\Otp;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class TwilioOtpProvider implements OtpProviderInterface
{
    public function sendOtp(string $phone, string $code): bool
    {
        $sid = config('sms.providers.twilio.sid');
        $token = config('sms.providers.twilio.token');
        $messagingServiceSid = config('sms.providers.twilio.messaging_service_sid');
        $from = config('sms.providers.twilio.from');

        if (!$sid || !$token) {
            Log::warning('Twilio config missing', [
                'sid' => (bool) $sid,
                'token' => (bool) $token,
                'messagingServiceSid' => (bool) $messagingServiceSid,
                'from' => (bool) $from,
            ]);
            return false;
        }

        if (!$messagingServiceSid && !$from) {
            Log::warning('Twilio destination missing (MessagingServiceSid/From)');
            return false;
        }

        $twilioUrl = "https://api.twilio.com/2010-04-01/Accounts/{$sid}/Messages.json";
        $body = "קוד האימות שלך הוא: {$code}";

        $payload = [
            'To' => $phone,
            'Body' => $body,
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
                Log::error('Twilio SMS failed', [
                    'status' => $response->status(),
                    'response' => $response->body(),
                ]);
            }

            return $response->successful();
        } catch (\Throwable $e) {
            Log::error('Twilio SMS exception', ['message' => $e->getMessage()]);
            return false;
        }
    }

    public function verifyOtp(string $phone, string $code): bool
    {
        return true;
    }
}
