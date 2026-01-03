<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Restaurant;
use App\Models\Category;
use App\Models\MenuItem;

class RestaurantSeeder extends Seeder
{
    public function run(): void
    {
        // מסעדה 1: פיצה פאלאס - תל אביב
        $restaurant1 = Restaurant::create([
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
        ]);

        $pizzaCategory = Category::create([
            'restaurant_id' => $restaurant1->id,
            'tenant_id' => 'pizza-palace',
            'name' => 'פיצה',
            'description' => 'פיצות בטעמים שונים',
        ]);

        $drinksCategory = Category::create([
            'restaurant_id' => $restaurant1->id,
            'tenant_id' => 'pizza-palace',
            'name' => 'משקאות',
            'description' => 'משקאות קרים וחמים',
        ]);

        MenuItem::create([
            'restaurant_id' => $restaurant1->id,
            'category_id' => $pizzaCategory->id,
            'tenant_id' => 'pizza-palace',
            'name' => 'פיצה מרגריטה',
            'description' => 'פיצה קלאסית עם עגבניות, מוצרלה ובזיליקום',
            'price' => 45.00,
            'is_available' => true,
        ]);

        MenuItem::create([
            'restaurant_id' => $restaurant1->id,
            'category_id' => $pizzaCategory->id,
            'tenant_id' => 'pizza-palace',
            'name' => 'פיצה ברנד',
            'description' => 'פיצה עם גבינה כפולה, בקון וגריבלים',
            'price' => 55.00,
            'is_available' => true,
        ]);

        MenuItem::create([
            'restaurant_id' => $restaurant1->id,
            'category_id' => $drinksCategory->id,
            'tenant_id' => 'pizza-palace',
            'name' => 'קולה',
            'description' => 'קולה קרה בגודל 330 מל',
            'price' => 12.00,
            'is_available' => true,
        ]);

        // מסעדה 2: המבורגר סנטרל - ירושלים
        $restaurant2 = Restaurant::create([
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
        ]);

        $burgerCategory = Category::create([
            'restaurant_id' => $restaurant2->id,
            'tenant_id' => 'burger-central',
            'name' => 'המבורגרים',
            'description' => 'המבורגרים טריים ועסיסיים',
        ]);

        MenuItem::create([
            'restaurant_id' => $restaurant2->id,
            'category_id' => $burgerCategory->id,
            'tenant_id' => 'burger-central',
            'name' => 'המבורגר קלאסי',
            'description' => 'המבורגר 200 גרם עם ירקות טריים',
            'price' => 48.00,
            'is_available' => true,
        ]);

        MenuItem::create([
            'restaurant_id' => $restaurant2->id,
            'category_id' => $burgerCategory->id,
            'tenant_id' => 'burger-central',
            'name' => 'צ\'יזבורגר',
            'description' => 'המבורגר עם גבינת צ\'דר מותכת',
            'price' => 52.00,
            'is_available' => true,
        ]);

        // מסעדה 3: סושי בר - חיפה
        $restaurant3 = Restaurant::create([
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
        ]);

        $sushiCategory = Category::create([
            'restaurant_id' => $restaurant3->id,
            'tenant_id' => 'sushi-bar',
            'name' => 'סושי',
            'description' => 'מגוון סושי טרי',
        ]);

        MenuItem::create([
            'restaurant_id' => $restaurant3->id,
            'category_id' => $sushiCategory->id,
            'tenant_id' => 'sushi-bar',
            'name' => 'סלמון נגירי',
            'description' => '8 יחידות סלמון טרי',
            'price' => 65.00,
            'is_available' => true,
        ]);

        // מסעדה 4: פלאפל הדקל - באר שבע
        $restaurant4 = Restaurant::create([
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
        ]);

        $falafelCategory = Category::create([
            'restaurant_id' => $restaurant4->id,
            'tenant_id' => 'falafel-hadekel',
            'name' => 'מנות עיקריות',
            'description' => 'מנות פלאפל ושווארמה',
        ]);

        MenuItem::create([
            'restaurant_id' => $restaurant4->id,
            'category_id' => $falafelCategory->id,
            'tenant_id' => 'falafel-hadekel',
            'name' => 'פלאפל בפיתה',
            'description' => 'פלאפל עם סלטים ללא הגבלה',
            'price' => 22.00,
            'is_available' => true,
        ]);

        // מסעדה 5: פסטה פרטה - נתניה
        $restaurant5 = Restaurant::create([
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
        ]);

        $pastaCategory = Category::create([
            'restaurant_id' => $restaurant5->id,
            'tenant_id' => 'pasta-preta',
            'name' => 'פסטה',
            'description' => 'מנות פסטה טריות',
        ]);

        MenuItem::create([
            'restaurant_id' => $restaurant5->id,
            'category_id' => $pastaCategory->id,
            'tenant_id' => 'pasta-preta',
            'name' => 'קרבונרה',
            'description' => 'פסטה עם רוטב שמנת ובייקון',
            'price' => 58.00,
            'is_available' => true,
        ]);
    }
}
