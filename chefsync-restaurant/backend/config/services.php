<?php

return [
    'twilio' => [
        'sid' => env('TWILIO_SID'),
        'token' => env('TWILIO_TOKEN'),
        'messaging_service_sid' => env('TWILIO_MESSAGING_SERVICE_SID'),
        'from' => env('TWILIO_FROM'),
    ],

    'zcredit' => [
        'terminal_number'   => env('ZCREDIT_TERMINAL_NUMBER', '0882016016'),
        'terminal_password' => env('ZCREDIT_TERMINAL_PASSWORD', 'Z0882016016'),
        'api_key'           => env('ZCREDIT_API_KEY', 'c0863aa14e77ec032effda671797c295d8a2ab154e49242871a197d158fa3f30'),
        // רק מספר (למשל 11002) – הקוד מוסיף אוטומטית את ה־prefix PINPAD
        'pinpad_id'         => env('ZCREDIT_PINPAD_ID', '11002'),
    ],
];
