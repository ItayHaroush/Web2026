<?php

/*
|--------------------------------------------------------------------------
| App Version (mobile clients)
|--------------------------------------------------------------------------
| נצרך ע"י נקודת הקצה GET /api/app/version כדי שאפליקציות הנייטיב יבדקו
| בהפעלה אם קיימת גרסה חדשה.
|
|   latest_* — הגרסה האחרונה הזמינה (מתחת לזה → "עדכון מומלץ")
|   min_*    — הגרסה המינימלית הנתמכת (מתחת לזה → "עדכון נדרש", חוסם)
|
| יש לעדכן את הערכים בכל Release (או דרך משתני סביבה, ללא פריסת קוד).
*/

return [
    'android' => [
        'latest_version_code' => (int) env('ANDROID_LATEST_VERSION_CODE', 2),
        'latest_version_name' => env('ANDROID_LATEST_VERSION_NAME', '1.1.0'),
        'min_version_code' => (int) env('ANDROID_MIN_VERSION_CODE', 1),
        'min_version_name' => env('ANDROID_MIN_VERSION_NAME', '1.0'),
        'update_url' => env('ANDROID_UPDATE_URL', 'https://play.google.com/store/apps/details?id=com.chefsync.restaurant'),
    ],

    'ios' => [
        'latest_version_code' => (int) env('IOS_LATEST_VERSION_CODE', 1),
        'latest_version_name' => env('IOS_LATEST_VERSION_NAME', '1.0'),
        'min_version_code' => (int) env('IOS_MIN_VERSION_CODE', 1),
        'min_version_name' => env('IOS_MIN_VERSION_NAME', '1.0'),
        'update_url' => env('IOS_UPDATE_URL', 'https://apps.apple.com/app/id000000000'),
    ],
];
