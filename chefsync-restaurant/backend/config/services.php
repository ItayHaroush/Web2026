<?php

return [
    'twilio' => [
        'sid' => env('TWILIO_SID'),
        'token' => env('TWILIO_TOKEN'),
        'messaging_service_sid' => env('TWILIO_MESSAGING_SERVICE_SID'),
        'from' => env('TWILIO_FROM'),
    ],

    'zcredit' => [
        /**
         * מסופון אמיתי מוגדר ב-DB (מסעדה / payment_terminals). משתנים אלה — אופציונליים לפיתוח/כלים.
         */
        'terminal_number' => env('ZCREDIT_TERMINAL_NUMBER'),
        'terminal_password' => env('ZCREDIT_TERMINAL_PASSWORD'),
        'api_key' => env('ZCREDIT_API_KEY'),
        'pinpad_id' => env('ZCREDIT_PINPAD_ID'),
        /**
         * true = חיוב/החזר מדומים בלי קריאה ל-Z-Credit (עד חיבור מסופון אמיתי במסעדה).
         * בייצור: false אחרי הגדרת מסופונים.
         */
        'mock' => filter_var(env('ZCREDIT_MOCK', true), FILTER_VALIDATE_BOOLEAN),
        'test_mode_enabled' => env('ZCREDIT_TEST_MODE', false),
        'allow_test_pinpad_route' => filter_var(env('ZCREDIT_ALLOW_TEST_ROUTE', false), FILTER_VALIDATE_BOOLEAN),
    ],
];
