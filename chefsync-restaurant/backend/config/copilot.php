<?php

return [
    /*
    |--------------------------------------------------------------------------
    | GitHub Copilot SDK Configuration
    |--------------------------------------------------------------------------
    |
    | Configuration for GitHub Copilot SDK integration
    | Manages AI features, rate limiting, caching, and cost tracking
    |
    */

    // Enable/disable Copilot SDK
    'enabled' => env('COPILOT_ENABLED', false),

    // Operation mode: 'mock' (development) or 'real' (production)
    'mode' => env('COPILOT_MODE', 'mock'),

    // Path to Copilot CLI executable
    'cli_path' => env('COPILOT_CLI_PATH', null),

    /*
    |--------------------------------------------------------------------------
    | Caching Configuration
    |--------------------------------------------------------------------------
    */
    'cache' => [
        'enabled' => env('COPILOT_CACHE_ENABLED', true),
        'ttl' => env('COPILOT_CACHE_TTL', 86400), // 24 hours
        'prefix' => 'copilot:',
    ],

    /*
    |--------------------------------------------------------------------------
    | Rate Limiting (Credits System)
    |--------------------------------------------------------------------------
    */
    'credits' => [
        'free_tier' => env('AI_FREE_TIER_CREDITS', 20), // 20 requests/month
        'pro_tier' => env('AI_PRO_TIER_CREDITS', 300),  // 300 requests/month
        'enterprise_tier' => 0, // Unlimited
    ],

    'rate_limit' => [
        'per_minute' => env('AI_RATE_LIMIT_PER_MINUTE', 10),
        'per_hour' => 50,
        'per_day' => 200,
    ],

    /*
    |--------------------------------------------------------------------------
    | Feature-Specific Configurations
    |--------------------------------------------------------------------------
    */
    'features' => [
        'description_generator' => [
            'enabled' => true,
            'cost_credits' => 1, // Cost 1 credit per generation
            'cache_enabled' => true,
            'cache_ttl' => 604800, // 7 days for descriptions
            'max_retries' => 2,
        ],
        'menu_recommendations' => [
            'enabled' => false, // Not implemented yet
            'cost_credits' => 1,
            'cache_enabled' => true,
            'cache_ttl' => 3600, // 1 hour
        ],
        'order_assistant' => [
            'enabled' => false, // Not implemented yet
            'cost_credits' => 1,
            'cache_enabled' => false,
        ],
        'dashboard_insights' => [
            'enabled' => true, // ✅ Enabled for restaurant analytics
            'cost_credits' => 5, // Higher cost for complex analysis
            'cache_enabled' => true,
            'cache_ttl' => 86400, // 1 day
        ],
        'price_recommendations' => [
            'enabled' => true, // ✅ Enabled for price suggestions
            'cost_credits' => 3,
            'cache_enabled' => true,
            'cache_ttl' => 3600, // 1 hour
        ],
        'restaurant_chat' => [
            'enabled' => true, // ✅ Enabled for restaurant chat assistant
            'cost_credits' => 1,
            'cache_enabled' => false, // Chat should not be cached
        ],
        'dine_in_recommendation' => [
            'enabled' => true,
            'cost_credits' => 5,
            'cache_enabled' => true,
            'cache_ttl' => 3600, // 1 hour
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Logging & Monitoring
    |--------------------------------------------------------------------------
    */
    'logging' => [
        'enabled' => env('AI_LOG_USAGE', true),
        'channel' => 'daily', // Use Laravel's daily log
        'detailed' => env('APP_DEBUG', false), // Full prompt/response logging in debug
    ],

    /*
    |--------------------------------------------------------------------------
    | Hebrew Language Configuration
    |--------------------------------------------------------------------------
    */
    'language' => [
        'default' => 'he', // Hebrew
        'fallback' => 'he', // No English fallback
        'rtl' => true,

        // Common food terms glossary for better AI understanding
        'glossary' => [
            'שווארמה' => 'shawarma',
            'לאפה' => 'laffa bread',
            'פיתה' => 'pita bread',
            'בגט' => 'baguette',
            'חומוס' => 'hummus',
            'טחינה' => 'tahini',
            'עמבה' => 'amba (pickled mango sauce)',
            'חריף' => 'spicy',
            'סלט ישראלי' => 'Israeli salad',
            'כבש' => 'lamb',
            'עוף' => 'chicken',
            'בקר' => 'beef',
            'טורקי' => 'turkey',
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Model Configuration
    |--------------------------------------------------------------------------
    */
    'model' => [
        'default' => 'gpt-4o', // Use GPT-4 for best Hebrew quality
        'fallback' => 'gpt-4o-mini',
        'temperature' => 0.7, // Balance creativity and consistency
        'max_tokens' => 500, // Sufficient for descriptions
    ],

    /*
    |--------------------------------------------------------------------------
    | Multi-Tenant Safety
    |--------------------------------------------------------------------------
    */
    'multi_tenant' => [
        'enforce_tenant_id' => true,
        'audit_logging' => true,
        'isolate_cache' => true, // Cache per tenant
    ],
];
