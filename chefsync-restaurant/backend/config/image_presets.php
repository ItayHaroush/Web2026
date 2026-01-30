<?php

/*
|--------------------------------------------------------------------------
| Image Enhancement Presets - Quick Config
|--------------------------------------------------------------------------
| הוסף את זה ל-backend/config/ai.php אחרי השורה עם 'stability' => [...]
*/

return [
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

        // 🥙 שווארמה
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

        // 🥤 משקאות
        'drink_glass' => [
            'strength' => 0.50,
            'prompt' => 'beverage in clear glass, condensation droplets, ice cubes visible, clean background',
            'negative' => 'food, plate, pizza, burger, bottle, mug',
        ],

        // ⚪ Fallback
        'generic_food' => [
            'strength' => 0.65,
            'prompt' => 'professional food photography, dish on plate or in bowl, clean presentation, natural lighting',
            'negative' => 'cartoon, illustration, text, watermark, logo',
        ],
    ],

    'base_negative' => 'blurry, low quality, amateur photo, text overlay, watermark, logo, cartoon, illustration, 3d render, artificial, plastic food',

    'dish_translations' => [
        'מרגריטה' => 'margherita',
        'פפרוני' => 'pepperoni',
        'טלה' => 'lamb',
        'עוף' => 'chicken',
        'בקר' => 'beef',
        'חריף' => 'spicy',
    ],

    'ingredient_keywords' => [
        'מוצרלה' => 'mozzarella',
        'עגבניות' => 'tomatoes',
        'בצל' => 'onions',
        'זיתים' => 'olives',
        'טחינה' => 'tahini',
        'חומוס' => 'hummus',
    ],
];
