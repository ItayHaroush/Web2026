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

    /*
    |--------------------------------------------------------------------------
    | Image Enhancement Configuration
    |--------------------------------------------------------------------------
    | אופציות לשיפור תמונות AI - רקעים, זוויות, והגדרות
    */
    'image_enhancement' => [
        'enabled' => true,
        'cost_credits' => 1, // קרדיט אחד לשיפור תמונה (Stability AI)
        'max_file_size' => 5120, // KB (5MB)
        'allowed_formats' => ['jpg', 'jpeg', 'png', 'webp'],
        'output_format' => 'jpeg',
        'variations_count' => 1, // וריאציה אחת (img2img enhancement)
        'provider' => 'stability', // 'stability' or 'mock'

        // Stability AI Configuration
        'stability' => [
            'api_key' => env('STABILITY_API_KEY', ''),
            'api_url' => env('STABILITY_API_URL', 'https://api.stability.ai/v2beta/stable-image/generate/sd3'),
            'model' => 'sd3-medium',
            'strength' => 0.35, // 0-1: enhancement intensity (0.35 = preserve 65% original)
            'timeout' => 60,
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Prompt Rules (Rule-Based Closed System)
    |--------------------------------------------------------------------------
    | טבלת חוקים סגורה לבניית פרומפטים - אין אלתורים!
    */
    'prompt_rules' => [
        
        // שלד קבוע (תמיד נוסף)
        'base' => [
            'positive' => 'professional food photography, realistic, high detail, natural lighting, 45 degree angle',
            'negative' => 'cartoon, illustration, fake food, text, logo, watermark',
        ],

        // קטגוריה (drink vs food)
        'categories' => [
            'drink' => [
                'add' => 'glass, cup, bottle',
                'negative' => 'food, plate',
            ],
            'food' => [
                'add' => 'dish, sandwich, bowl',
                'negative' => 'drink, glass',
            ],
        ],

        // תת-סוג (SubType)
        'subTypes' => [
            'soda' => [
                'add' => 'clear carbonated water, transparent liquid',
                'negative' => 'cola, coke, pepsi, alcohol',
                'strength' => 0.25,
            ],
            'cola' => [
                'add' => 'dark carbonated drink',
                'negative' => 'soda water, transparent liquid',
                'strength' => 0.30,
            ],
            'beer' => [
                'add' => 'golden beer, foam',
                'negative' => 'soda, soft drink',
                'strength' => 0.35,
            ],
            'shawarma' => [
                'add' => 'grilled meat, sliced shawarma',
                'negative' => 'burger, steak',
                'strength' => 0.40,
            ],
            'pizza' => [
                'add' => 'pizza slice or whole pizza',
                'negative' => 'sandwich, pita',
                'strength' => 0.40,
            ],
            'burger' => [
                'add' => 'burger patty, bun, layers',
                'negative' => 'pizza, sandwich wrap',
                'strength' => 0.40,
            ],
            'falafel' => [
                'add' => 'falafel balls, fried chickpea',
                'negative' => 'meatballs, burger',
                'strength' => 0.40,
            ],
        ],

        // צורת הגשה (Serving Style)
        'serving' => [
            'glass' => [
                'add' => 'simple clear glass',
                'negative' => 'mug, bottle',
            ],
            'bottle' => [
                'add' => 'beverage bottle',
                'negative' => 'glass',
            ],
            'pita' => [
                'add' => 'pita bread',
                'negative' => 'baguette, plate',
            ],
            'baguette' => [
                'add' => 'baguette bread',
                'negative' => 'pita',
            ],
            'plate' => [
                'add' => 'served on plate',
                'negative' => 'sandwich wrap',
            ],
            'bowl' => [
                'add' => 'served in bowl',
                'negative' => 'plate',
            ],
        ],

        // רמת מסעדה (Restaurant Level)
        'levels' => [
            'street' => [
                'add' => 'street food style, authentic, simple',
            ],
            'casual' => [
                'add' => 'casual restaurant, clean look',
            ],
            'boutique' => [
                'add' => 'fine dining, elegant plating',
            ],
            'premium' => [
                'add' => 'high-end food photography, dramatic lighting',
            ],
        ],

        // רקע (Background)
        'backgrounds' => [
            'kitchen' => [
                'add' => 'stainless kitchen background',
            ],
            'table' => [
                'add' => 'wooden table',
            ],
            'dark' => [
                'add' => 'dark restaurant background',
            ],
            'white' => [
                'add' => 'clean white background',
            ],
        ],
    ],
];
