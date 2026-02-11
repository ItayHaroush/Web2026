<?php

return [
    /*
    |--------------------------------------------------------------------------
    | דגל גלובלי להפעלת תשלום באשראי
    |--------------------------------------------------------------------------
    | כאשר false - אף מסעדה לא תוכל לקבל אשראי, גם אם הגדירה מסוף
    | הפעל רק אחרי שחיבור HYP מוכן לייצור
    */
    'credit_card_enabled' => env('CREDIT_CARD_ENABLED', false),

    /*
    |--------------------------------------------------------------------------
    | HYP Integration (Phase 2)
    |--------------------------------------------------------------------------
    | TODO Phase 2:
    | - iframe_url: כתובת iframe לסליקה
    | - webhook_secret: סוד לאימות webhook מ-HYP
    | - session_timeout_minutes: timeout לסשן תשלום
    */
    'hyp' => [
        'iframe_url' => env('HYP_IFRAME_URL', 'https://icom.yaad.net/p/'),
        'webhook_secret' => env('HYP_WEBHOOK_SECRET', ''),
        'session_timeout_minutes' => env('HYP_SESSION_TIMEOUT', 15),
    ],
];
