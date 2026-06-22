<?php

return [
    'existing_domain' => [
        'price' => (float) env('DOMAIN_CONNECT_PRICE', 390),
        'label' => 'חיבור דומיין קיים',
        'payment_type' => 'domain_connect',
    ],
    'full_service' => [
        'price' => (float) env('DOMAIN_FULL_SERVICE_PRICE', 890),
        'label' => 'TakeEat מטפלת בהכל',
        'payment_type' => 'domain_full_service',
    ],

    'platform_hosts' => array_filter(array_map(
        'trim',
        explode(',', env('PLATFORM_HOSTS', 'takeeat.co.il,chefsync.co.il,localhost,127.0.0.1'))
    )),

    // חסימת subdomains של הפלטפורמה (pizza.takeeat.co.il וכו')
    'platform_root_domains' => array_filter(array_map(
        'trim',
        explode(',', env('PLATFORM_ROOT_DOMAINS', 'takeeat.co.il,chefsync.co.il'))
    )),
];
