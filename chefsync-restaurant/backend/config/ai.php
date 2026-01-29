<?php

return [
    /*
    |--------------------------------------------------------------------------
    | AI Provider Configuration
    |--------------------------------------------------------------------------
    |
    | Unified AI service configuration
    | Supports multiple providers: Copilot (local) and OpenAI (production)
    |
    */

    // AI Provider: 'copilot' (local dev) or 'openai' (production)
    'provider' => env('AI_PROVIDER', 'copilot'),

    /*
    |--------------------------------------------------------------------------
    | GitHub Copilot Configuration (Local Development)
    |--------------------------------------------------------------------------
    */
    'copilot' => [
        'enabled' => env('COPILOT_ENABLED', false),
        'mode' => env('COPILOT_MODE', 'mock'), // 'mock' or 'real'
        'cli_path' => env('COPILOT_CLI_PATH', null),
    ],

    /*
    |--------------------------------------------------------------------------
    | OpenAI Configuration (Production)
    |--------------------------------------------------------------------------
    */
    'openai' => [
        'api_key' => env('OPENAI_API_KEY', ''),
        'model' => env('OPENAI_MODEL', 'gpt-4o-mini'),
        'base_url' => env('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
        'timeout' => env('OPENAI_TIMEOUT', 30),
        'mock' => env('OPENAI_MOCK', false), // Mock mode for testing without API costs
    ],

    /*
    |--------------------------------------------------------------------------
    | Features Configuration
    |--------------------------------------------------------------------------
    */
    'features' => [
        'description_generator' => [
            'enabled' => true,
            'cost_credits' => 1,
            'cache_enabled' => true,
            'cache_ttl' => 172800, // 2 days (shorter than Copilot for production freshness)
        ],
        'price_recommendation' => [
            'enabled' => true,
            'cost_credits' => 1,
            'cache_enabled' => true,
            'cache_ttl' => 86400, // 1 day
        ],
        'dashboard_insights' => [
            'enabled' => true,
            'cost_credits' => 2,
            'cache_enabled' => true,
            'cache_ttl' => 3600, // 1 hour (dynamic data)
        ],
        'restaurant_chat' => [
            'enabled' => true,
            'cost_credits' => 1,
            'cache_enabled' => false, // No caching for chat
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Credits System
    |--------------------------------------------------------------------------
    */
    'credits' => [
        'free_tier' => env('AI_FREE_TIER_CREDITS', 20),
        'basic_tier' => env('AI_BASIC_TIER_CREDITS', 0),
        'pro_tier' => env('AI_PRO_TIER_CREDITS', 500),
    ],

    /*
    |--------------------------------------------------------------------------
    | Rate Limiting
    |--------------------------------------------------------------------------
    */
    'rate_limit' => [
        'per_minute' => env('AI_RATE_LIMIT_PER_MINUTE', 10),
        'per_hour' => 50,
        'per_day' => 200,
    ],

    /*
    |--------------------------------------------------------------------------
    | Language Configuration (Hebrew Support)
    |--------------------------------------------------------------------------
    */
    'language' => [
        'default' => 'he',
        'rtl' => true,
        'glossary' => [
            // Hebrew food terms with English equivalents
            'שווארמה' => 'shawarma',
            'פלאפל' => 'falafel',
            'חומוס' => 'hummus',
            'פיתה' => 'pita',
            'סלט' => 'salad',
            'צ\'יפס' => 'fries',
            'המבורגר' => 'hamburger',
            'פיצה' => 'pizza',
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Restaurant Type Prompt Configuration
    |--------------------------------------------------------------------------
    | Maps restaurant types to their specific prompt files and metadata
    */
    'restaurant_types' => [
        'pizza' => [
            'label_he' => 'פיצרייה',
            'label_en' => 'Pizzeria',
            'prompt_file' => 'pizza.txt',
            'keywords' => ['בצק', 'גבינה', 'תוספות', 'קריספי'],
        ],
        'shawarma' => [
            'label_he' => 'שווארמה / פלאפל',
            'label_en' => 'Shawarma / Falafel',
            'prompt_file' => 'shawarma.txt',
            'keywords' => ['טריות', 'מהירות', 'סלטים', 'פיתה'],
        ],
        'burger' => [
            'label_he' => 'המבורגר',
            'label_en' => 'Burger',
            'prompt_file' => 'burger.txt',
            'keywords' => ['פרימיום', 'עסיסי', 'גריל', 'בשר'],
        ],
        'bistro' => [
            'label_he' => 'ביסטרו / שף',
            'label_en' => 'Bistro / Chef',
            'prompt_file' => 'bistro.txt',
            'keywords' => ['אסתטיקה', 'דיוק', 'טכניקה', 'מובחר'],
        ],
        'catering' => [
            'label_he' => 'קייטרינג',
            'label_en' => 'Catering',
            'prompt_file' => 'catering.txt',
            'keywords' => ['כמות', 'סדר', 'אירוע', 'מנות גדולות'],
        ],
        'general' => [
            'label_he' => 'כללי',
            'label_en' => 'General',
            'prompt_file' => 'general.txt',
            'keywords' => ['טרי', 'איכותי'],
        ],
    ],
];
