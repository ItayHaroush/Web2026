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
        $twilioUrl = "https://api.twilio.com/2010-04-01/Accounts/{$sid}/Messages.json";

        $body = "קוד האימות שלך ל-ChefSync: $code";

        $response = Http::asForm()
            ->withBasicAuth($sid, $token)
            ->post($twilioUrl, [
                'To' => $phone,
                'MessagingServiceSid' => $messagingServiceSid,
                'Body' => $body,
                // לא מציינים from
            ]);

        if (!$response->successful()) {
            Log::error('Twilio SMS failed', ['response' => $response->body()]);
        }
        return $response->successful();
    }
}
