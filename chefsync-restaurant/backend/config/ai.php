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
            'strength' => 0.70, // 0-1: enhancement intensity (0.70 = 70% AI change, 30% preserve)
            'timeout' => 60,
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Image Enhancement Presets (קטגוריה × סגנון הגשה)
    |--------------------------------------------------------------------------
    | מערכת Presets נקייה: כל קומבינציה = פרומפט ספציפי + strength מותאם
    */
    'image_presets' => [

        // 🍕 פיצה
        'pizza_plate' => [
            'strength' => 0.65,
            'prompt' => 'whole pizza or pizza slices on white ceramic plate, restaurant presentation, melted cheese visible, tomato sauce, fresh toppings',
            'negative' => 'sandwich, burger, pita, wrap, meat, shawarma, falafel, hands holding, street food paper',
        ],
        'pizza_street_slice' => [
            'strength' => 0.70,
            'prompt' => 'single pizza slice held in hand with greasy paper napkin, street food style, cheese stretching, triangular slice',
            'negative' => 'whole pizza, plate, sandwich, burger, pita, box',
        ],
        'pizza_box' => [
            'strength' => 0.65,
            'prompt' => 'pizza in open cardboard delivery box, cheese stretching, casual presentation',
            'negative' => 'plate, hands, sandwich, burger, pita, closed box',
        ],

        // 🥙 שווארמה
        'shawarma_pita' => [
            'strength' => 0.80,
            'prompt' => 'shawarma meat wrapped inside fresh pita bread, Israeli street food style, tahini dripping, visible grilled meat slices',
            'negative' => 'pizza, burger, sandwich, baguette, plate with separate items, raw meat',
        ],
        'shawarma_baguette' => [
            'strength' => 0.80,
            'prompt' => 'shawarma meat stuffed in baguette bread, overflowing with toppings, street food style',
            'negative' => 'pizza, burger, pita, plate, raw meat',
        ],
        'shawarma_plate' => [
            'strength' => 0.75,
            'prompt' => 'shawarma meat served on plate with side salads, tahini sauce, hummus, Israeli restaurant style',
            'negative' => 'pizza, burger, sandwich wrap, pita wrap, raw meat',
        ],

        // 🍔 המבורגר
        'burger_street' => [
            'strength' => 0.70,
            'prompt' => 'burger wrapped in paper, held in hands, street food style, visible layers of bun, patty, lettuce, tomato',
            'negative' => 'pizza, shawarma, pita, plate, sandwich, raw meat',
        ],
        'burger_plate' => [
            'strength' => 0.70,
            'prompt' => 'burger on white plate with french fries side, restaurant presentation, visible bun and patty',
            'negative' => 'pizza, shawarma, pita, wrap, hands holding, paper wrap',
        ],
        'burger_closeup' => [
            'strength' => 0.75,
            'prompt' => 'extreme closeup of burger with bite taken, visible layers, cheese melting, juicy patty',
            'negative' => 'pizza, shawarma, whole burger, plate, hands, fries',
        ],

        // 🌯 פלאפל
        'falafel_pita' => [
            'strength' => 0.80,
            'prompt' => 'falafel balls wrapped in pita bread with tahini, Israeli street food, fried chickpea balls visible',
            'negative' => 'pizza, burger, shawarma meat, raw falafel, meatballs',
        ],
        'falafel_plate' => [
            'strength' => 0.75,
            'prompt' => 'falafel balls on plate with salads, tahini, hummus, Israeli style',
            'negative' => 'pizza, burger, pita wrap, meatballs',
        ],

        // 🥗 סלט
        'salad_bowl' => [
            'strength' => 0.60,
            'prompt' => 'fresh salad in white bowl, colorful vegetables, healthy presentation, clean background',
            'negative' => 'pizza, burger, meat, fried food, fast food',
        ],
        'salad_plate' => [
            'strength' => 0.60,
            'prompt' => 'fresh salad on white plate, restaurant presentation, colorful vegetables, garnish',
            'negative' => 'pizza, burger, meat, fried food',
        ],

        // 🍽️ ביסטרו
        'bistro_chef_plate' => [
            'strength' => 0.55,
            'prompt' => 'elegant chef plating on white ceramic plate, minimalist presentation, fine dining style, artistic garnish',
            'negative' => 'pizza, burger, street food, hands, paper, casual presentation',
        ],
        'bistro_rustic' => [
            'strength' => 0.60,
            'prompt' => 'rustic presentation on wooden table, warm ambient lighting, homestyle cooking, cozy atmosphere',
            'negative' => 'pizza, burger, street food, white background, clinical presentation',
        ],

        // 🧑‍🍳 קייטרינג
        'catering_tray' => [
            'strength' => 0.60,
            'prompt' => 'large serving tray with multiple portions, catering presentation, professional food service',
            'negative' => 'single portion, pizza, burger, hands, street food, plate',
        ],
        'catering_buffet' => [
            'strength' => 0.60,
            'prompt' => 'buffet table setup with serving dishes, event catering style, multiple items visible',
            'negative' => 'single portion, pizza, burger, hands, street food',
        ],
        'catering_portion_box' => [
            'strength' => 0.65,
            'prompt' => 'takeaway food container with divided portions, meal prep style, organized presentation',
            'negative' => 'pizza box, burger wrap, loose items, plate',
        ],

        // 🍟 תוספות
        'side_plate' => [
            'strength' => 0.60,
            'prompt' => 'side dish on small plate, restaurant presentation, garnish, clean background',
            'negative' => 'main course, pizza, burger, large portion',
        ],
        'side_bowl' => [
            'strength' => 0.60,
            'prompt' => 'side dish in small bowl, salad or fries, casual presentation',
            'negative' => 'main course, pizza, burger, plate',
        ],

        // 🥤 משקאות
        'drink_glass' => [
            'strength' => 0.50,
            'prompt' => 'beverage in clear glass, condensation droplets, ice cubes visible, clean background',
            'negative' => 'food, plate, pizza, burger, bottle, mug',
        ],
        'drink_bottle' => [
            'strength' => 0.45,
            'prompt' => 'beverage bottle with label visible, product photography style, clean background',
            'negative' => 'food, plate, pizza, burger, glass',
        ],

        // ⚪ Generic / Fallback
        'generic_food' => [
            'strength' => 0.65,
            'prompt' => 'professional food photography, dish on plate or in bowl, clean presentation, natural lighting',
            'negative' => 'cartoon, illustration, text, watermark, logo',
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Base Negative Prompt (נוסף לכל preset)
    |--------------------------------------------------------------------------
    */
    'base_negative' => 'blurry, low quality, amateur photo, text overlay, watermark, logo, cartoon, illustration, 3d render, artificial, plastic food',

    /*
    |--------------------------------------------------------------------------
    | Translation Dictionaries (מילונים לחילוץ אוטומטי)
    |--------------------------------------------------------------------------
    */
    'dish_translations' => [
        // פיצה
        'מרגריטה' => 'margherita',
        'פפרוני' => 'pepperoni',
        'ארבע גבינות' => 'quattro formaggi',
        'פטריות' => 'mushroom',
        'זיתים' => 'olive',
        'ביאנקה' => 'bianca',
        'חריפה' => 'spicy',
        
        // שווארמה
        'טלה' => 'lamb',
        'עוף' => 'chicken',
        'הודו' => 'turkey',
        'בשר' => 'meat',
        
        // המבורגר
        'בלאק אנגוס' => 'black angus',
        'בקר' => 'beef',
        'כבש' => 'lamb',
        
        // כללי
        'טבעוני' => 'vegan',
        'צמחוני' => 'vegetarian',
        'אורגני' => 'organic',
        'ביתי' => 'homemade',
        'מעושן' => 'smoked',
        'צלוי' => 'grilled',
        'מטוגן' => 'fried',
    ],

    'ingredient_keywords' => [
        // גבינות
        'מוצרלה' => 'mozzarella',
        'צ\'דר' => 'cheddar',
        'פרמזן' => 'parmesan',
        'גבינה כחולה' => 'blue cheese',
        'פטה' => 'feta',
        'גבינת עיזים' => 'goat cheese',
        'גבינה' => 'cheese',
        
        // ירקות
        'עגבניות' => 'tomatoes',
        'עגבנייה' => 'tomato',
        'בצל' => 'onions',
        'שום' => 'garlic',
        'זיתים' => 'olives',
        'פטריות' => 'mushrooms',
        'חסה' => 'lettuce',
        'מלפפון' => 'cucumber',
        'פלפל' => 'bell pepper',
        'תרד' => 'spinach',
        'בזיליקום' => 'basil',
        'פטרוזיליה' => 'parsley',
        'כוסברה' => 'cilantro',
        'רוקט' => 'arugula',
        
        // רטבים
        'טחינה' => 'tahini',
        'חומוס' => 'hummus',
        'מיונז' => 'mayonnaise',
        'קטשופ' => 'ketchup',
        'חרדל' => 'mustard',
        'ברביקיו' => 'bbq sauce',
        'רוטב עגבניות' => 'tomato sauce',
        'רוטב שום' => 'garlic sauce',
        'רוטב חריף' => 'hot sauce',
        
        // תוספות
        'זיתים' => 'olives',
        'מלפפון חמוץ' => 'pickles',
        'בצל מקורמל' => 'caramelized onions',
        'ביצה' => 'egg',
        'חביתה' => 'omelette',
        'אבוקדו' => 'avocado',
    ],

    /*
    |--------------------------------------------------------------------------
    | Image Enhancement Presets (Preset System)
    |--------------------------------------------------------------------------
    */
    'image_presets' => [
        'pizza_plate' => [
            'strength' => 0.65,
            'prompt' => 'whole pizza or pizza slices on white ceramic plate, restaurant presentation, melted cheese visible, tomato sauce, fresh toppings',
            'negative' => 'sandwich, burger, pita, wrap, meat, shawarma, falafel, hands holding, street food paper',
        ],
        'pizza_street_slice' => [
            'strength' => 0.70,
            'prompt' => 'single pizza slice held in hand with greasy paper napkin, street food style, cheese stretching, triangular slice',
            'negative' => 'whole pizza, plate, sandwich, burger, pita, box',
        ],
        'shawarma_pita' => [
            'strength' => 0.80,
            'prompt' => 'shawarma meat wrapped inside fresh pita bread, Israeli street food style, tahini dripping, visible grilled meat slices',
            'negative' => 'pizza, burger, sandwich, baguette, plate with separate items, raw meat',
        ],
        'shawarma_plate' => [
            'strength' => 0.75,
            'prompt' => 'shawarma meat served on plate with side salads, tahini sauce, hummus, Israeli restaurant style',
            'negative' => 'pizza, burger, sandwich wrap, pita wrap, raw meat',
        ],
        'burger_street' => [
            'strength' => 0.70,
            'prompt' => 'burger wrapped in paper, held in hands, street food style, visible layers of bun, patty, lettuce, tomato',
            'negative' => 'pizza, shawarma, pita, plate, sandwich, raw meat',
        ],
        'burger_plate' => [
            'strength' => 0.70,
            'prompt' => 'burger on white plate with french fries side, restaurant presentation, visible bun and patty',
            'negative' => 'pizza, shawarma, pita, wrap, hands holding, paper wrap',
        ],
        'drink_glass' => [
            'strength' => 0.50,
            'prompt' => 'beverage in clear glass, condensation droplets, ice cubes visible, clean background',
            'negative' => 'food, plate, pizza, burger, bottle, mug',
        ],
        'generic_food' => [
            'strength' => 0.65,
            'prompt' => 'professional food photography, dish on plate or in bowl, clean presentation, natural lighting',
            'negative' => 'cartoon, illustration, text, watermark, logo',
        ],
    ],

    'base_negative' => 'blurry, low quality, amateur photo, text overlay, watermark, logo, cartoon, illustration, 3d render, artificial, plastic food',
];
