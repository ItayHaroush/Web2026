<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SmsService
{
    public static function sendVerificationCode($phone, $code)
    {
        $sid = config('services.twilio.sid');
        $token = config('services.twilio.token');
        $messagingServiceSid = config('services.twilio.messaging_service_sid');
        $from = config('services.twilio.from');

        // Missing creds? אל תזרוק חריגה – רק לוג והחזר false
        if (!$sid || !$token) {
            Log::warning('Twilio config missing', [
                'sid' => (bool) $sid,
                'token' => (bool) $token,
                'messagingServiceSid' => (bool) $messagingServiceSid,
                'from' => (bool) $from,
            ]);
            return false;
        }

        // חייבים לפחות MessagingServiceSid או From
        if (!$messagingServiceSid && !$from) {
            Log::warning('Twilio destination missing (MessagingServiceSid/From)');
            return false;
        }

        $twilioUrl = "https://api.twilio.com/2010-04-01/Accounts/{$sid}/Messages.json";
        $body = "קוד האימות שלך ל-TakeEat: $code";

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
                Log::error('Twilio SMS failed', ['status' => $response->status(), 'response' => $response->body()]);
            }
            return $response->successful();
        } catch (\Throwable $e) {
            Log::error('Twilio SMS exception', ['message' => $e->getMessage()]);
            return false;
        }
    }
}
