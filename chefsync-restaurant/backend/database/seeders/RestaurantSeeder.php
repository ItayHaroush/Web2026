<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Restaurant;
use App\Models\Category;
use App\Models\MenuItem;
use Illuminate\Support\Arr;

class RestaurantSeeder extends Seeder
{
    public function run(): void
    {
        $createCategory = function (Restaurant $restaurant, array $data) {
            return Category::withoutGlobalScopes()->updateOrCreate(
                [
                    'tenant_id' => $restaurant->tenant_id,
                    'name' => $data['name'],
                ],
                array_merge(
                    [
                        'restaurant_id' => $restaurant->id,
                        'description' => $data['description'] ?? null,
                        'icon' => $data['icon'] ?? '🍽️',
                        'sort_order' => $data['sort_order'] ?? 1,
                        'is_active' => $data['is_active'] ?? true,
                    ],
                    Arr::only($data, ['sort_order', 'icon', 'is_active'])
                )
            );
        };

        $createItem = function (Restaurant $restaurant, array $data) {
            return MenuItem::withoutGlobalScopes()->updateOrCreate(
                [
                    'tenant_id' => $restaurant->tenant_id,
                    'name' => $data['name'],
                ],
                [
                    'restaurant_id' => $restaurant->id,
                    'category_id' => $data['category_id'],
                    'description' => $data['description'] ?? null,
                    'price' => $data['price'],
                    'image_url' => $data['image_url'] ?? null,
                    'is_available' => $data['is_available'] ?? true,
                    'sort_order' => $data['sort_order'] ?? 1,
                ]
            );
        };

        // מסעדה 1: פיצה פאלאס - תל אביב
        $restaurant1 = Restaurant::withoutGlobalScopes()->updateOrCreate(
            ['tenant_id' => 'pizza-palace'],
            [
                'name' => 'Pizza Palace',
                'slug' => 'pizza-palace',
                'phone' => '03-1234567',
                'address' => 'רחוב דיזנגוף 100, תל אביב',
                'city' => 'תל אביב',
                'description' => 'פיצריה איטלקית אותנטית עם תנור אבן',
                'logo_url' => 'https://api.dicebear.com/7.x/shapes/svg?seed=pizza&backgroundColor=ff6b6b',
                'cuisine_type' => 'איטלקי',
                'latitude' => 32.0853,
                'longitude' => 34.7818,
                'is_open' => true,
            ]
        );

        $pizzaCategory = $createCategory($restaurant1, [
            'name' => 'פיצות קלאסיות',
            'description' => 'תנור אבן, גבינה מוקרמת ורוטב סאן מרזאנו',
            'icon' => '🍕',
            'sort_order' => 1,
        ]);

        $specialCategory = $createCategory($restaurant1, [
            'name' => 'פיצות ספיישל',
            'description' => 'קומבינציות שף משתנות',
            'icon' => '⭐',
            'sort_order' => 2,
        ]);

        $drinksCategory = $createCategory($restaurant1, [
            'name' => 'משקאות',
            'description' => 'שתיה קלה ובקבוקי בוטיק',
            'icon' => '🥤',
            'sort_order' => 3,
        ]);

        // פריטי תפריט
        $createItem($restaurant1, [
            'category_id' => $pizzaCategory->id,
            'name' => 'פיצה מרגריטה',
            'description' => 'רוטב עגבניות סאן מרזאנו, מוצרלה טרייה ובזיליקום',
            'price' => 45.00,
            'image_url' => 'https://images.unsplash.com/photo-1548365328-5b76c2f9f911?auto=format&fit=crop&w=800&q=80',
            'sort_order' => 1,
        ]);

        $createItem($restaurant1, [
            'category_id' => $pizzaCategory->id,
            'name' => 'פיצה פפרוני',
            'description' => 'פפרוני מעושן, מוצרלה וגבינת פרמזן',
            'price' => 52.00,
            'image_url' => 'https://images.unsplash.com/photo-1604382355076-af4b0eb60143?auto=format&fit=crop&w=800&q=80',
            'sort_order' => 2,
        ]);

        $createItem($restaurant1, [
            'category_id' => $specialCategory->id,
            'name' => 'פיצה ארטישוק וגבינת עיזים',
            'description' => 'בזיליקום טרי, ארטישוק, מוצרלה וגבינת עיזים קרמית',
            'price' => 59.00,
            'image_url' => 'https://images.unsplash.com/photo-1475090169767-40ed8d18f67d?auto=format&fit=crop&w=800&q=80',
            'sort_order' => 1,
        ]);

        $createItem($restaurant1, [
            'category_id' => $drinksCategory->id,
            'name' => 'קולה קרה',
            'description' => 'בקבוק 330 מ"ל',
            'price' => 12.00,
            'image_url' => 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80',
            'sort_order' => 1,
        ]);

        $createItem($restaurant1, [
            'category_id' => $drinksCategory->id,
            'name' => 'בירה איטלקית',
            'description' => 'לאגר קראפט צוננת',
            'price' => 24.00,
            'image_url' => 'https://images.unsplash.com/photo-1514361892635-6e122620e4d1?auto=format&fit=crop&w=800&q=80',
            'sort_order' => 2,
        ]);

        // מסעדה 2: המבורגר סנטרל - ירושלים
        $restaurant2 = Restaurant::withoutGlobalScopes()->updateOrCreate(
            ['tenant_id' => 'burger-central'],
            [
                'name' => 'Burger Central',
                'slug' => 'burger-central',
                'phone' => '02-9876543',
                'address' => 'רחוב יפו 45, ירושלים',
                'city' => 'ירושלים',
                'description' => 'המבורגרים מהטובים בעיר',
                'logo_url' => 'https://api.dicebear.com/7.x/shapes/svg?seed=burger&backgroundColor=f4a261',
                'cuisine_type' => 'אמריקאי',
                'latitude' => 31.7683,
                'longitude' => 35.2137,
                'is_open' => true,
            ]
        );

        $burgerCategory = $createCategory($restaurant2, [
            'name' => 'המבורגרים',
            'description' => 'המבורגרים טריים ועסיסיים',
            'icon' => '🍔',
            'sort_order' => 1,
        ]);

        $sidesCategory = $createCategory($restaurant2, [
            'name' => 'תוספות',
            'description' => 'צ\'יפס, טבעות בצל ודיפים',
            'icon' => '🍟',
            'sort_order' => 2,
        ]);

        $createItem($restaurant2, [
            'category_id' => $burgerCategory->id,
            'name' => 'המבורגר קלאסי 200 גרם',
            'description' => 'בשר בקר טרי, חסה, עגבניה, בצל סגול ורוטב הבית',
            'price' => 48.00,
            'image_url' => 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=800&q=80',
            'sort_order' => 1,
        ]);

        $createItem($restaurant2, [
            'category_id' => $burgerCategory->id,
            'name' => 'צ\'יזבורגר כפול',
            'description' => 'שני קציצות, גבינת צ\'דר כפולה ובייקון מעושן',
            'price' => 62.00,
            'image_url' => 'https://images.unsplash.com/photo-1551782450-a2132b4ba21d?auto=format&fit=crop&w=800&q=80',
            'sort_order' => 2,
        ]);

        $createItem($restaurant2, [
            'category_id' => $sidesCategory->id,
            'name' => 'צ\'יפס כפול',
            'description' => 'צ\'יפס עבה עם מלח ים',
            'price' => 18.00,
            'image_url' => 'https://images.unsplash.com/photo-1541599540903-216a46ca1dc0?auto=format&fit=crop&w=800&q=80',
            'sort_order' => 1,
        ]);

        // מסעדה 3: סושי בר - חיפה
        $restaurant3 = Restaurant::withoutGlobalScopes()->updateOrCreate(
            ['tenant_id' => 'sushi-bar'],
            [
                'name' => 'Sushi Bar',
                'slug' => 'sushi-bar',
                'phone' => '04-5551234',
                'address' => 'שדרות בן גוריון 20, חיפה',
                'city' => 'חיפה',
                'description' => 'סושי טרי מדי יום',
                'logo_url' => 'https://api.dicebear.com/7.x/shapes/svg?seed=sushi&backgroundColor=2a9d8f',
                'cuisine_type' => 'יפני',
                'latitude' => 32.7940,
                'longitude' => 34.9896,
                'is_open' => true,
            ]
        );

        $sushiCategory = $createCategory($restaurant3, [
            'name' => 'רולים',
            'description' => 'רולים קלאסיים ומשודרגים',
            'icon' => '🍣',
            'sort_order' => 1,
        ]);

        $sashimiCategory = $createCategory($restaurant3, [
            'name' => 'סשימי וניגירי',
            'description' => 'דגים טריים במנות אישיות',
            'icon' => '🐟',
            'sort_order' => 2,
        ]);

        $createItem($restaurant3, [
            'category_id' => $sushiCategory->id,
            'name' => 'רול סלמון אבוקדו',
            'description' => '8 יחידות עם סלמון טרי ואבוקדו',
            'price' => 54.00,
            'image_url' => 'https://images.unsplash.com/photo-1544378730-8b5104b1da6e?auto=format&fit=crop&w=800&q=80',
            'sort_order' => 1,
        ]);

        $createItem($restaurant3, [
            'category_id' => $sushiCategory->id,
            'name' => 'רול טמפורה שרימפס',
            'description' => '8 יחידות עם שרימפס טמפורה ומיונז יפני',
            'price' => 62.00,
            'image_url' => 'https://images.unsplash.com/photo-1604908177225-2f53b59a29e1?auto=format&fit=crop&w=800&q=80',
            'sort_order' => 2,
        ]);

        $createItem($restaurant3, [
            'category_id' => $sashimiCategory->id,
            'name' => 'ניגירי סלמון',
            'description' => '6 יחידות סלמון נורווגי',
            'price' => 68.00,
            'image_url' => 'https://images.unsplash.com/photo-1580828343064-fde4fc206bc6?auto=format&fit=crop&w=800&q=80',
            'sort_order' => 1,
        ]);

        // מסעדה 4: פלאפל הדקל - באר שבע
        $restaurant4 = Restaurant::withoutGlobalScopes()->updateOrCreate(
            ['tenant_id' => 'falafel-hadekel'],
            [
                'name' => 'פלאפל הדקל',
                'slug' => 'falafel-hadekel',
                'phone' => '08-6667788',
                'address' => 'רחוב הרצל 15, באר שבע',
                'city' => 'באר שבע',
                'description' => 'הפלאפל הכי טרי בדרום',
                'logo_url' => 'https://api.dicebear.com/7.x/shapes/svg?seed=falafel&backgroundColor=e9c46a',
                'cuisine_type' => 'מזרח תיכוני',
                'latitude' => 31.2530,
                'longitude' => 34.7915,
                'is_open' => true,
            ]
        );

        $falafelCategory = $createCategory($restaurant4, [
            'name' => 'מנות פלאפל',
            'description' => 'פלאפל, כדורים טריים וציפוי פריך',
            'icon' => '🥙',
            'sort_order' => 1,
        ]);

        $shawarmaCategory = $createCategory($restaurant4, [
            'name' => 'שווארמה ובשרים',
            'description' => 'פיתה/לאפה עם תוספות ביתיות',
            'icon' => '🍖',
            'sort_order' => 2,
        ]);

        $createItem($restaurant4, [
            'category_id' => $falafelCategory->id,
            'name' => 'פלאפל בפיתה',
            'description' => '6 כדורי פלאפל חמים, סלטים חופשי וטחינה',
            'price' => 22.00,
            'image_url' => 'https://images.unsplash.com/photo-1608136760559-3a3e5e4a3c8b?auto=format&fit=crop&w=800&q=80',
            'sort_order' => 1,
        ]);

        $createItem($restaurant4, [
            'category_id' => $shawarmaCategory->id,
            'name' => 'שווארמה בפיתה',
            'description' => 'פרגיות מתובלות, עגבניות, חמוצים וצ\'יפס',
            'price' => 34.00,
            'image_url' => 'https://images.unsplash.com/photo-1604908177453-74629501c6ab?auto=format&fit=crop&w=800&q=80',
            'sort_order' => 1,
        ]);

        // מסעדה 5: פסטה פרטה - נתניה
        $restaurant5 = Restaurant::withoutGlobalScopes()->updateOrCreate(
            ['tenant_id' => 'pasta-preta'],
            [
                'name' => 'Pasta Preta',
                'slug' => 'pasta-preta',
                'phone' => '09-8881122',
                'address' => 'רחוב הרצל 88, נתניה',
                'city' => 'נתניה',
                'description' => 'פסטה איטלקית ביתית',
                'logo_url' => 'https://api.dicebear.com/7.x/shapes/svg?seed=pasta&backgroundColor=e76f51',
                'cuisine_type' => 'איטלקי',
                'latitude' => 32.3215,
                'longitude' => 34.8532,
                'is_open' => true,
            ]
        );

        $pastaCategory = $createCategory($restaurant5, [
            'name' => 'פסטות טריות',
            'description' => 'פסטה יומית עם רטבים קלאסיים',
            'icon' => '🍝',
            'sort_order' => 1,
        ]);

        $saladsCategory = $createCategory($restaurant5, [
            'name' => 'סלטים',
            'description' => 'סלטי שוק טריים',
            'icon' => '🥗',
            'sort_order' => 2,
        ]);

        $createItem($restaurant5, [
            'category_id' => $pastaCategory->id,
            'name' => 'פסטה קרבונרה',
            'description' => 'פנצ\'טה פריכה, חלמון ופקורינו רומנו',
            'price' => 58.00,
            'image_url' => 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=800&q=80',
            'sort_order' => 1,
        ]);

        $createItem($restaurant5, [
            'category_id' => $pastaCategory->id,
            'name' => 'פסטה פסטו',
            'description' => 'פסטו בזיליקום טרי, צנוברים ופרמזן',
            'price' => 54.00,
            'image_url' => 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=800&q=80',
            'sort_order' => 2,
        ]);

        $createItem($restaurant5, [
            'category_id' => $saladsCategory->id,
            'name' => 'סלט קפרזה',
            'description' => 'מוצרלה בופאלו, עגבניות שרי ובזיליקום',
            'price' => 38.00,
            'image_url' => 'https://images.unsplash.com/photo-1546793665-c74683f339c1?auto=format&fit=crop&w=800&q=80',
            'sort_order' => 1,
        ]);
    }
}
