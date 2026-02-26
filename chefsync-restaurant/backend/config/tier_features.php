<?php

/**
 * Feature flags per subscription tier.
 *
 * 'full'  – unrestricted access
 * 'demo'  – limited / read-only (frontend shows upgrade prompt)
 * false   – completely hidden / blocked
 */
return [
    'basic' => [
        'menu_management'       => 'full',
        'orders'                => 'full',
        'employees'             => 'full',
        'delivery_zones'        => 'full',
        'coupons'               => 'full',
        'qr_code'               => 'full',
        'restaurant_settings'   => 'full',

        'pos'                   => 'demo',
        'reports'               => 'demo',
        'time_reports'          => 'demo',
        'display_screens'       => 'demo',
        'kiosks'                => 'demo',
        'printers'              => 'demo',

        'ai_insights'           => false,
        'ai_descriptions'       => false,
        'ai_price_suggestions'  => false,
        'advanced_reports'      => false,
        'priority_support'      => false,
    ],

    'pro' => [
        'menu_management'       => 'full',
        'orders'                => 'full',
        'employees'             => 'full',
        'delivery_zones'        => 'full',
        'coupons'               => 'full',
        'qr_code'               => 'full',
        'restaurant_settings'   => 'full',

        'pos'                   => 'full',
        'reports'               => 'full',
        'time_reports'          => 'full',
        'display_screens'       => 'full',
        'kiosks'                => 'full',
        'printers'              => 'full',

        'ai_insights'           => 'full',
        'ai_descriptions'       => 'full',
        'ai_price_suggestions'  => 'full',
        'advanced_reports'      => 'full',
        'priority_support'      => 'full',
    ],
];
