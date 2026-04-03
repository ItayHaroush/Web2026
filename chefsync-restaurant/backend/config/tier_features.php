<?php

/**
 * Feature flags per subscription tier.
 *
 * 'full'  – unrestricted access
 * 'demo'  – limited / read-only (frontend shows locked 🔒 with upgrade prompt)
 *
 * עיקרון: אין false — הכל 'demo' (נעול עם upgrade prompt, לא מוסתר!)
 */
return [
    'basic' => [
        // FULL — תכונות ליבה
        'menu_management'       => 'full',
        'orders'                => 'full',
        'delivery_zones'        => 'full',
        'coupons'               => 'full',
        'qr_code'               => 'full',
        'restaurant_settings'   => 'full',

        // DEMO — נעול, רואים, שדרג
        'reports'               => 'demo',
        'employees'             => 'demo',
        'printers'              => 'demo',
        'pos'                   => 'demo',
        'kiosks'                => 'demo',
        'display_screens'       => 'demo',
        'time_reports'          => 'demo',
        'ai_insights'           => 'demo',
        'ai_descriptions'       => 'demo',
        'ai_price_suggestions'  => 'demo',
        'advanced_reports'      => 'demo',
        'priority_support'      => 'demo',
    ],

    'pro' => [
        // FULL — ליבה + pro features
        'menu_management'       => 'full',
        'orders'                => 'full',
        'delivery_zones'        => 'full',
        'coupons'               => 'full',
        'qr_code'               => 'full',
        'restaurant_settings'   => 'full',
        'printers'              => 'full',
        'reports'               => 'full',
        'employees'             => 'full',
        'ai_insights'           => 'full',
        'ai_descriptions'       => 'full',
        'ai_price_suggestions'  => 'full',
        'advanced_reports'      => 'full',
        'priority_support'      => 'full',

        // DEMO — enterprise features נעולים
        'pos'                   => 'demo',
        'kiosks'                => 'demo',
        'display_screens'       => 'demo',
        'time_reports'          => 'demo',
    ],

    'enterprise' => [
        'menu_management'       => 'full',
        'orders'                => 'full',
        'delivery_zones'        => 'full',
        'coupons'               => 'full',
        'qr_code'               => 'full',
        'restaurant_settings'   => 'full',
        'printers'              => 'full',
        'reports'               => 'full',
        'employees'             => 'full',
        'ai_insights'           => 'full',
        'ai_descriptions'       => 'full',
        'ai_price_suggestions'  => 'full',
        'advanced_reports'      => 'full',
        'priority_support'      => 'full',
        'pos'                   => 'full',
        'kiosks'                => 'full',
        'display_screens'       => 'full',
        'time_reports'          => 'full',
    ],

    // Minimum tier required per feature (for upgrade prompt text)
    'feature_required_tier' => [
        'menu_management'       => 'basic',
        'orders'                => 'basic',
        'delivery_zones'        => 'basic',
        'coupons'               => 'basic',
        'qr_code'               => 'basic',
        'restaurant_settings'   => 'basic',
        'reports'               => 'basic',
        'printers'              => 'pro',
        'employees'             => 'pro',
        'ai_insights'           => 'pro',
        'ai_descriptions'       => 'pro',
        'ai_price_suggestions'  => 'pro',
        'advanced_reports'      => 'pro',
        'priority_support'      => 'pro',
        'pos'                   => 'enterprise',
        'kiosks'                => 'enterprise',
        'display_screens'       => 'enterprise',
        'time_reports'          => 'enterprise',
    ],

    // Quantitative limits per tier
    'tier_limits' => [
        'basic'      => ['orders_limit' => 100, 'orders_limit_trial' => 50, 'max_employees' => 0, 'max_kiosks' => 0, 'max_screens' => 0, 'max_printers' => 0],
        'pro'        => ['orders_limit' => null, 'max_employees' => 5, 'max_kiosks' => 1, 'max_screens' => 2, 'max_printers' => 1],
        'enterprise' => ['orders_limit' => null, 'max_employees' => 10, 'max_kiosks' => 5, 'max_screens' => 10, 'max_printers' => 5],
    ],
];
