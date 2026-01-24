<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Application Name
    |--------------------------------------------------------------------------
    */

    'name' => env('APP_NAME', 'ChefSync IL'),

    /*
    |--------------------------------------------------------------------------
    | Application Environment
    |--------------------------------------------------------------------------
    */

    'env' => env('APP_ENV', 'production'),

    /*
    |--------------------------------------------------------------------------
    | Application Debug Mode
    |--------------------------------------------------------------------------
    */

    'debug' => (bool) env('APP_DEBUG', false),

    /*
    |--------------------------------------------------------------------------
    | Application URL
    |--------------------------------------------------------------------------
    */

    'url' => env('APP_URL', 'http://localhost'),

    /*
    |--------------------------------------------------------------------------
    | Application Timezone
    |--------------------------------------------------------------------------
    */

    'timezone' => 'Asia/Jerusalem',

    /*
    |--------------------------------------------------------------------------
    | Application Locale Configuration
    |--------------------------------------------------------------------------
    */

    'locale' => 'he',

    'fallback_locale' => 'en',

    'faker_locale' => 'he_IL',

    /*
    |--------------------------------------------------------------------------
    | Encryption Key
    |--------------------------------------------------------------------------
    */

    'cipher' => 'AES-256-CBC',

    'key' => env('APP_KEY'),

    'previous_keys' => [
        ...array_filter(
            explode(',', env('APP_PREVIOUS_KEYS', ''))
        ),
    ],

    /*
    |--------------------------------------------------------------------------
    | Development Mode (Testing/Staging Only)
    |--------------------------------------------------------------------------
    | When enabled, bypasses billing checks, subscription validation,
    | and AI credit limits. MUST only be used in local/staging environments.
    | Will abort with 403 if enabled in production.
    */

    'dev_mode' => (function () {
        $devMode = env('DEV_MODE', false);
        $environment = env('APP_ENV', 'production');

        // Security: Prevent dev mode in production
        if ($devMode && $environment === 'production') {
            abort(403, 'DEV_MODE cannot be enabled in production environment');
        }

        return (bool) $devMode;
    })(),

    /*
    |--------------------------------------------------------------------------
    | Maintenance Mode Driver
    |--------------------------------------------------------------------------
    */

    'maintenance' => [
        'driver' => env('APP_MAINTENANCE_DRIVER', 'file'),
        'store' => env('APP_MAINTENANCE_STORE', 'database'),
    ],

];
