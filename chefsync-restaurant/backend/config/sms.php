<?php

return [
    'provider' => env('SMS_PROVIDER', 'twilio'),

    'providers' => [
        'twilio' => [
            'sid' => env('TWILIO_SID'),
            'token' => env('TWILIO_TOKEN'),
            'messaging_service_sid' => env('TWILIO_MESSAGING_SERVICE_SID'),
            'from' => env('TWILIO_FROM'),
        ],

        'sms019' => [
            'endpoint' => env('SMS_019_ENDPOINT', 'https://019sms.co.il/api'),
            'token' => env('SMS_019_TOKEN'),
            'username' => env('SMS_019_USERNAME'),
            'source' => env('SMS_019_SOURCE', 'ChefSync'),
            'timeout' => (int) env('SMS_019_TIMEOUT', 10),
        ],
    ],
];
