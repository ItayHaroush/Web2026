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
        // ערך מלא ל־Track2: PINPAD11002 (או רק 11002 – הקוד יוסיף PINPAD)
        'pinpad_id'         => env('ZCREDIT_PINPAD_ID', '11002'),
        /**
         * עתידי: נתיבי בדיקה (כרטיס מלא וכו') — לא מפעילים עד שימומשו במתודה נפרדת.
         * chargePinPad נשאר ברירת המחדל למסופון אמיתי (CommitFullTransaction + Track2).
         */
        'test_mode_enabled' => env('ZCREDIT_TEST_MODE', false),
        /** POST /api/zcredit/test-pinpad-charge — רק ב-local או כש־true (מסוכן: חשוף בלי auth) */
        'allow_test_pinpad_route' => filter_var(env('ZCREDIT_ALLOW_TEST_ROUTE', false), FILTER_VALIDATE_BOOLEAN),
    ],
];
