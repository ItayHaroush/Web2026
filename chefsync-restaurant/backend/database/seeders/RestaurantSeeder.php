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
            ['slug' => 'pizza-palace'],
            [
                'tenant_id' => 'pizza-palace',
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
                'is_approved' => true,
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

        $appetizerCategory = $createCategory($restaurant1, [
            'name' => 'מנות פתיחה',
            'description' => 'פתיחות חמות לצד הפיצה',
            'icon' => '🥗',
            'sort_order' => 0,
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

        $createItem($restaurant1, [
            'category_id' => $appetizerCategory->id,
            'name' => 'פוקאצ\'ה שום ושמן זית',
            'description' => 'בצק מחמצת, שמן זית, שום ורוזמרין',
            'price' => 24.00,
            'image_url' => 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=800&q=80',
            'sort_order' => 1,
        ]);

        $createItem($restaurant1, [
            'category_id' => $appetizerCategory->id,
            'name' => 'ברוסקטה עגבניות',
            'description' => 'עגבניות שרי, בזיליקום, בלסמי ומוצרלה טרייה',
            'price' => 28.00,
            'image_url' => 'https://images.unsplash.com/photo-1604908554164-3c5b265b5c01?auto=format&fit=crop&w=800&q=80',
            'sort_order' => 2,
        ]);

        // מסעדה 2: המבורגר סנטרל - ירושלים
        $restaurant2 = Restaurant::withoutGlobalScopes()->updateOrCreate(
            ['slug' => 'burger-central'],
            [
                'tenant_id' => 'burger-central',
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
                'is_approved' => true,
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

        $burgerAppetizerCategory = $createCategory($restaurant2, [
            'name' => 'מנות פתיחה',
            'description' => 'נשנושים לפני ההמבורגר',
            'icon' => '🥨',
            'sort_order' => 3,
        ]);

        $burgerDrinksCategory = $createCategory($restaurant2, [
            'name' => 'משקאות',
            'description' => 'קולה, זירו ובירות בוטיק',
            'icon' => '🥤',
            'sort_order' => 4,
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

        $createItem($restaurant2, [
            'category_id' => $burgerAppetizerCategory->id,
            'name' => 'כנפיים ברביקיו',
            'description' => '6 כנפיים עם רוטב ברביקיו מעושן',
            'price' => 36.00,
            'image_url' => 'https://images.unsplash.com/photo-1608039829572-78524f79c5ac?auto=format&fit=crop&w=800&q=80',
            'sort_order' => 1,
        ]);

        $createItem($restaurant2, [
            'category_id' => $burgerAppetizerCategory->id,
            'name' => 'טבעות בצל',
            'description' => 'טבעות בצל פריכות עם רוטב שום',
            'price' => 28.00,
            'image_url' => 'https://images.unsplash.com/photo-1576107232684-1279f390859f?auto=format&fit=crop&w=800&q=80',
            'sort_order' => 2,
        ]);

        $createItem($restaurant2, [
            'category_id' => $burgerDrinksCategory->id,
            'name' => 'קולה זירו',
            'description' => 'בקבוק 330 מ"ל קר',
            'price' => 12.00,
            'image_url' => 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80',
            'sort_order' => 1,
        ]);

        $createItem($restaurant2, [
            'category_id' => $burgerDrinksCategory->id,
            'name' => 'בירה בוטיק',
            'description' => 'IPA מקומית מרעננת',
            'price' => 26.00,
            'image_url' => 'https://images.unsplash.com/photo-1514361892635-6e122620e4d1?auto=format&fit=crop&w=800&q=80',
            'sort_order' => 2,
        ]);

        // מסעדה 3: סושי בר - חיפה
        $restaurant3 = Restaurant::withoutGlobalScopes()->updateOrCreate(
            ['slug' => 'sushi-bar'],
            [
                'tenant_id' => 'sushi-bar',
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
                'is_approved' => true,
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

        $sushiAppetizerCategory = $createCategory($restaurant3, [
            'name' => 'מנות פתיחה',
            'description' => 'נשנושים יפניים לפתיחה',
            'icon' => '🥢',
            'sort_order' => 3,
        ]);

        $sushiDrinksCategory = $createCategory($restaurant3, [
            'name' => 'משקאות',
            'description' => 'תה, סאקה ומשקאות יפניים',
            'icon' => '🍵',
            'sort_order' => 4,
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

        $createItem($restaurant3, [
            'category_id' => $sushiAppetizerCategory->id,
            'name' => 'אדממה ים',
            'description' => 'פולי סויה מאודים עם מלח ים',
            'price' => 22.00,
            'image_url' => 'https://images.unsplash.com/photo-1591754053654-8b37e7cfd014?auto=format&fit=crop&w=800&q=80',
            'sort_order' => 1,
        ]);

        $createItem($restaurant3, [
            'category_id' => $sushiAppetizerCategory->id,
            'name' => 'סלט אצות וואקמה',
            'description' => 'אצות וואקמה, שומשום ורוטב סויה-ג\'ינג\'ר',
            'price' => 26.00,
            'image_url' => 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80',
            'sort_order' => 2,
        ]);

        $createItem($restaurant3, [
            'category_id' => $sushiDrinksCategory->id,
            'name' => 'תה ירוק יפני',
            'description' => 'חליטה חמה של מאצ\'ה עדין',
            'price' => 14.00,
            'image_url' => 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80',
            'sort_order' => 1,
        ]);

        $createItem($restaurant3, [
            'category_id' => $sushiDrinksCategory->id,
            'name' => 'סאקה קר',
            'description' => 'כוס סאקה צוננת',
            'price' => 24.00,
            'image_url' => 'https://images.unsplash.com/photo-1497534446932-c925b458314e?auto=format&fit=crop&w=800&q=80',
            'sort_order' => 2,
        ]);

        // מסעדה 4: פלאפל הדקל - באר שבע
        $restaurant4 = Restaurant::withoutGlobalScopes()->updateOrCreate(
            ['slug' => 'falafel-hadekel'],
            [
                'tenant_id' => 'falafel-hadekel',
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
                'is_approved' => true,
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

        $falafelDrinksCategory = $createCategory($restaurant4, [
            'name' => 'משקאות',
            'description' => 'לימונדה, קולה וזירו',
            'icon' => '🥤',
            'sort_order' => 3,
        ]);

        $falafelAppetizerCategory = $createCategory($restaurant4, [
            'name' => 'מנות פתיחה',
            'description' => 'צלחות חומוס וביצים קשות',
            'icon' => '🥚',
            'sort_order' => 0,
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

        $createItem($restaurant4, [
            'category_id' => $falafelAppetizerCategory->id,
            'name' => 'חומוס גרגרים',
            'description' => 'צלחת חומוס עם גרגרים חמים, שמן זית ופפריקה',
            'price' => 24.00,
            'image_url' => 'https://images.unsplash.com/photo-1604908177235-9f5700c41f6c?auto=format&fit=crop&w=800&q=80',
            'sort_order' => 1,
        ]);

        $createItem($restaurant4, [
            'category_id' => $falafelAppetizerCategory->id,
            'name' => 'ביצה קשה ומלפפון חמוץ',
            'description' => 'ביצה, חמוצים, חמאה ומלח גס',
            'price' => 12.00,
            'image_url' => 'https://images.unsplash.com/photo-1528323273322-d81458248d40?auto=format&fit=crop&w=800&q=80',
            'sort_order' => 2,
        ]);

        $createItem($restaurant4, [
            'category_id' => $falafelDrinksCategory->id,
            'name' => 'לימונדה נענע',
            'description' => 'לימונדה ביתית עם נענע טרייה',
            'price' => 14.00,
            'image_url' => 'https://images.unsplash.com/photo-1502741338009-cac2772e18bc?auto=format&fit=crop&w=800&q=80',
            'sort_order' => 1,
        ]);

        $createItem($restaurant4, [
            'category_id' => $falafelDrinksCategory->id,
            'name' => 'קולה זירו',
            'description' => 'בקבוק 330 מ"ל קר',
            'price' => 12.00,
            'image_url' => 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80',
            'sort_order' => 2,
        ]);

        // מסעדה 5: פסטה פרטה - נתניה
        $restaurant5 = Restaurant::withoutGlobalScopes()->updateOrCreate(
            ['slug' => 'pasta-preta'],
            [
                'tenant_id' => 'pasta-preta',
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
                'is_approved' => true,
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

        $pastaAppetizerCategory = $createCategory($restaurant5, [
            'name' => 'מנות פתיחה',
            'description' => 'לחמים, ברוסקטות ואנטיפסטי',
            'icon' => '🫓',
            'sort_order' => 0,
        ]);

        $pastaDrinksCategory = $createCategory($restaurant5, [
            'name' => 'משקאות',
            'description' => 'יינות וכוסות שתיה קלה',
            'icon' => '🍷',
            'sort_order' => 3,
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

        $createItem($restaurant5, [
            'category_id' => $pastaAppetizerCategory->id,
            'name' => 'לחם שום ביתי',
            'description' => 'לחם מחמצת, חמאת שום ופטרוזיליה',
            'price' => 18.00,
            'image_url' => 'https://images.unsplash.com/photo-1481391032119-d89fee407e44?auto=format&fit=crop&w=800&q=80',
            'sort_order' => 1,
        ]);

        $createItem($restaurant5, [
            'category_id' => $pastaAppetizerCategory->id,
            'name' => 'אנטיפסטי ירקות',
            'description' => 'קישוא, פלפל ובצל צלויים עם בלסמי',
            'price' => 26.00,
            'image_url' => 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80',
            'sort_order' => 2,
        ]);

        $createItem($restaurant5, [
            'category_id' => $pastaDrinksCategory->id,
            'name' => 'כוס יין אדום',
            'description' => 'יין אדום יבש מהמזקקה הביתית',
            'price' => 28.00,
            'image_url' => 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=800&q=80',
            'sort_order' => 1,
        ]);

        $createItem($restaurant5, [
            'category_id' => $pastaDrinksCategory->id,
            'name' => 'סודה/מים מוגזים',
            'description' => 'בקבוק מים מוגזים 330 מ"ל',
            'price' => 10.00,
            'image_url' => 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80',
            'sort_order' => 2,
        ]);
    }
}
