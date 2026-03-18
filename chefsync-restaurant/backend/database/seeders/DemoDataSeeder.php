<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Restaurant;
use App\Models\Category;
use App\Models\MenuItem;
use App\Models\City;
use App\Models\DeliveryZone;
use App\Models\Promotion;
use App\Models\PromotionRule;
use App\Models\PromotionReward;
use App\Models\RestaurantAddonGroup;
use App\Models\RestaurantAddon;
use Carbon\Carbon;

/**
 * DemoDataSeeder — מייצר נתוני דמו מלאים לכל 5 המסעדות:
 * שעות פעילות, אזורי משלוח, קבוצות תוספות, מבצעים עם כללים ותגמולים.
 * רץ אחרי RestaurantSeeder (תלוי במסעדות, קטגוריות ופריטים קיימים).
 */
class DemoDataSeeder extends Seeder
{
    public function run(): void
    {
        $this->command->info('🚀 DemoDataSeeder — מתחיל ליצור נתוני דמו מלאים...');

        $restaurants = Restaurant::withoutGlobalScopes()->whereIn('slug', [
            'pizza-palace', 'burger-central', 'sushi-bar', 'falafel-hadekel', 'pasta-preta',
        ])->get()->keyBy('slug');

        if ($restaurants->isEmpty()) {
            $this->command->warn('⚠️ לא נמצאו מסעדות דמו — הרץ RestaurantSeeder קודם.');
            return;
        }

        // ---- Phase 1: שעות פעילות + הגדרות מסעדה ----
        $this->seedRestaurantSettings($restaurants);

        // ---- Phase 2: אזורי משלוח ----
        $this->seedDeliveryZones($restaurants);

        // ---- Phase 3: קבוצות תוספות ----
        $this->seedAddonGroups($restaurants);

        // ---- Phase 4: מבצעים ----
        $this->seedPromotions($restaurants);

        $this->command->info('✅ DemoDataSeeder — הושלם בהצלחה!');
    }

    // =========================================================================
    //  Phase 1 — הגדרות מסעדה + שעות פעילות
    // =========================================================================
    private function seedRestaurantSettings($restaurants): void
    {
        $this->command->info('  📋 מעדכן הגדרות מסעדה ושעות פעילות...');

        $settings = [
            'pizza-palace' => [
                'is_demo' => true,
                'has_delivery' => true,
                'has_pickup' => true,
                'delivery_minimum' => 60,
                'delivery_time_minutes' => 40,
                'delivery_time_note' => '35-45 דקות',
                'pickup_time_minutes' => 20,
                'pickup_time_note' => '15-25 דקות',
                'accepted_payment_methods' => ['cash', 'credit_card'],
                'hyp_terminal_verified' => true,
                'operating_days' => [
                    'ראשון' => true, 'שני' => true, 'שלישי' => true,
                    'רביעי' => true, 'חמישי' => true, 'שישי' => true, 'שבת' => true,
                ],
                'operating_hours' => [
                    'default' => ['open' => '11:00', 'close' => '23:00'],
                    'days' => [
                        'ראשון'   => ['closed' => false, 'open' => '11:00', 'close' => '23:00'],
                        'שני'     => ['closed' => false, 'open' => '11:00', 'close' => '23:00'],
                        'שלישי'   => ['closed' => false, 'open' => '11:00', 'close' => '23:00'],
                        'רביעי'   => ['closed' => false, 'open' => '11:00', 'close' => '23:00'],
                        'חמישי'   => ['closed' => false, 'open' => '11:00', 'close' => '23:00'],
                        'שישי'    => ['closed' => false, 'open' => '11:00', 'close' => '15:00'],
                        'שבת'     => ['closed' => false, 'open' => '19:00', 'close' => '23:00'],
                    ],
                ],
            ],
            'burger-central' => [
                'is_demo' => true,
                'has_delivery' => true,
                'has_pickup' => true,
                'delivery_minimum' => 50,
                'delivery_time_minutes' => 35,
                'delivery_time_note' => '30-40 דקות',
                'pickup_time_minutes' => 15,
                'pickup_time_note' => '10-20 דקות',
                'operating_days' => [
                    'ראשון' => true, 'שני' => true, 'שלישי' => true,
                    'רביעי' => true, 'חמישי' => true, 'שישי' => true, 'שבת' => true,
                ],
                'operating_hours' => [
                    'default' => ['open' => '12:00', 'close' => '00:00'],
                    'days' => [
                        'ראשון'   => ['closed' => false, 'open' => '12:00', 'close' => '00:00'],
                        'שני'     => ['closed' => false, 'open' => '12:00', 'close' => '00:00'],
                        'שלישי'   => ['closed' => false, 'open' => '12:00', 'close' => '00:00'],
                        'רביעי'   => ['closed' => false, 'open' => '12:00', 'close' => '00:00'],
                        'חמישי'   => ['closed' => false, 'open' => '12:00', 'close' => '00:00'],
                        'שישי'    => ['closed' => false, 'open' => '12:00', 'close' => '15:00'],
                        'שבת'     => ['closed' => false, 'open' => '20:00', 'close' => '01:00'],
                    ],
                ],
            ],
            'sushi-bar' => [
                'is_demo' => true,
                'has_delivery' => true,
                'has_pickup' => true,
                'delivery_minimum' => 80,
                'delivery_time_minutes' => 45,
                'delivery_time_note' => '40-50 דקות',
                'pickup_time_minutes' => 25,
                'pickup_time_note' => '20-30 דקות',
                'operating_days' => [
                    'ראשון' => true, 'שני' => true, 'שלישי' => true,
                    'רביעי' => true, 'חמישי' => true, 'שישי' => true, 'שבת' => false,
                ],
                'operating_hours' => [
                    'default' => ['open' => '11:30', 'close' => '22:30'],
                    'days' => [
                        'ראשון'   => ['closed' => false, 'open' => '11:30', 'close' => '22:30'],
                        'שני'     => ['closed' => false, 'open' => '11:30', 'close' => '22:30'],
                        'שלישי'   => ['closed' => false, 'open' => '11:30', 'close' => '22:30'],
                        'רביעי'   => ['closed' => false, 'open' => '11:30', 'close' => '22:30'],
                        'חמישי'   => ['closed' => false, 'open' => '11:30', 'close' => '22:30'],
                        'שישי'    => ['closed' => false, 'open' => '11:30', 'close' => '14:30'],
                        'שבת'     => ['closed' => true],
                    ],
                ],
            ],
            'falafel-hadekel' => [
                'is_demo' => true,
                'has_delivery' => true,
                'has_pickup' => true,
                'delivery_minimum' => 30,
                'delivery_time_minutes' => 25,
                'delivery_time_note' => '20-30 דקות',
                'pickup_time_minutes' => 10,
                'pickup_time_note' => '5-15 דקות',
                'operating_days' => [
                    'ראשון' => true, 'שני' => true, 'שלישי' => true,
                    'רביעי' => true, 'חמישי' => true, 'שישי' => true, 'שבת' => false,
                ],
                'operating_hours' => [
                    'default' => ['open' => '08:00', 'close' => '22:00'],
                    'days' => [
                        'ראשון'   => ['closed' => false, 'open' => '08:00', 'close' => '22:00'],
                        'שני'     => ['closed' => false, 'open' => '08:00', 'close' => '22:00'],
                        'שלישי'   => ['closed' => false, 'open' => '08:00', 'close' => '22:00'],
                        'רביעי'   => ['closed' => false, 'open' => '08:00', 'close' => '22:00'],
                        'חמישי'   => ['closed' => false, 'open' => '08:00', 'close' => '22:00'],
                        'שישי'    => ['closed' => false, 'open' => '08:00', 'close' => '14:00'],
                        'שבת'     => ['closed' => true],
                    ],
                ],
            ],
            'pasta-preta' => [
                'is_demo' => true,
                'has_delivery' => true,
                'has_pickup' => true,
                'delivery_minimum' => 70,
                'delivery_time_minutes' => 40,
                'delivery_time_note' => '35-45 דקות',
                'pickup_time_minutes' => 20,
                'pickup_time_note' => '15-25 דקות',
                'operating_days' => [
                    'ראשון' => true, 'שני' => true, 'שלישי' => true,
                    'רביעי' => true, 'חמישי' => true, 'שישי' => true, 'שבת' => true,
                ],
                'operating_hours' => [
                    'default' => ['open' => '12:00', 'close' => '23:00'],
                    'days' => [
                        'ראשון'   => ['closed' => false, 'open' => '12:00', 'close' => '23:00'],
                        'שני'     => ['closed' => false, 'open' => '12:00', 'close' => '23:00'],
                        'שלישי'   => ['closed' => false, 'open' => '12:00', 'close' => '23:00'],
                        'רביעי'   => ['closed' => false, 'open' => '12:00', 'close' => '23:00'],
                        'חמישי'   => ['closed' => false, 'open' => '12:00', 'close' => '23:00'],
                        'שישי'    => ['closed' => false, 'open' => '12:00', 'close' => '15:00'],
                        'שבת'     => ['closed' => false, 'open' => '19:00', 'close' => '23:00'],
                    ],
                ],
            ],
        ];

        foreach ($settings as $slug => $data) {
            if ($r = $restaurants->get($slug)) {
                $r->update($data);
            }
        }
    }

    // =========================================================================
    //  Phase 2 — אזורי משלוח
    // =========================================================================
    private function seedDeliveryZones($restaurants): void
    {
        $this->command->info('  🚚 יוצר אזורי משלוח...');

        $cityMap = City::pluck('id', 'name')->all(); // 'Tel Aviv' => 8, etc.

        $zones = [
            'pizza-palace' => [
                ['name' => 'מרכז תל אביב', 'city' => 'Tel Aviv', 'pricing_type' => 'fixed', 'fixed_fee' => 15, 'city_radius' => 3],
                ['name' => 'גוש דן הרחב', 'city' => 'Tel Aviv', 'pricing_type' => 'per_km', 'per_km_fee' => 3, 'city_radius' => 8],
                ['name' => 'הרצליה - רמת גן', 'city' => 'Tel Aviv', 'pricing_type' => 'tiered', 'tiered_fees' => [
                    ['upto_km' => 3, 'fee' => 15],
                    ['upto_km' => 6, 'fee' => 25],
                    ['upto_km' => 10, 'fee' => 40],
                ], 'city_radius' => 10],
            ],
            'burger-central' => [
                ['name' => 'מרכז ירושלים', 'city' => 'Jerusalem', 'pricing_type' => 'fixed', 'fixed_fee' => 12, 'city_radius' => 2],
                ['name' => 'שכונות ירושלים', 'city' => 'Jerusalem', 'pricing_type' => 'per_km', 'per_km_fee' => 4, 'city_radius' => 6],
            ],
            'sushi-bar' => [
                ['name' => 'כרמל מרכז', 'city' => 'Haifa', 'pricing_type' => 'fixed', 'fixed_fee' => 18, 'city_radius' => 2.5],
                ['name' => 'קריות והסביבה', 'city' => 'Haifa', 'pricing_type' => 'per_km', 'per_km_fee' => 3.5, 'city_radius' => 10],
            ],
            'falafel-hadekel' => [
                ['name' => 'מרכז באר שבע', 'city' => 'Beer Sheva', 'pricing_type' => 'fixed', 'fixed_fee' => 10, 'city_radius' => 4],
                ['name' => 'אזור תעשייה ושכונות', 'city' => 'Beer Sheva', 'pricing_type' => 'fixed', 'fixed_fee' => 20, 'city_radius' => 7],
            ],
            'pasta-preta' => [
                ['name' => 'מרכז נתניה', 'city' => 'Netanya', 'pricing_type' => 'fixed', 'fixed_fee' => 14, 'city_radius' => 3],
                ['name' => 'חוף נתניה והסביבה', 'city' => 'Netanya', 'pricing_type' => 'per_km', 'per_km_fee' => 3, 'city_radius' => 6],
            ],
        ];

        foreach ($zones as $slug => $restaurantZones) {
            $restaurant = $restaurants->get($slug);
            if (!$restaurant) continue;

            foreach ($restaurantZones as $i => $zone) {
                $cityId = $cityMap[$zone['city']] ?? null;

                // Netanya might not exist in cities seeder – skip if not found
                if (!$cityId && $zone['city'] !== 'Netanya') {
                    $this->command->warn("  ⚠️ עיר {$zone['city']} לא נמצאה בטבלת cities");
                }

                DeliveryZone::withoutGlobalScopes()->updateOrCreate(
                    [
                        'tenant_id' => $restaurant->tenant_id,
                        'name' => $zone['name'],
                    ],
                    [
                        'restaurant_id' => $restaurant->id,
                        'city_id' => $cityId,
                        'pricing_type' => $zone['pricing_type'],
                        'fixed_fee' => $zone['fixed_fee'] ?? 0,
                        'per_km_fee' => $zone['per_km_fee'] ?? null,
                        'tiered_fees' => $zone['tiered_fees'] ?? null,
                        'city_radius' => $zone['city_radius'] ?? null,
                        'is_active' => true,
                        'sort_order' => $i + 1,
                    ]
                );
            }
        }
    }

    // =========================================================================
    //  Phase 3 — קבוצות תוספות
    // =========================================================================
    private function seedAddonGroups($restaurants): void
    {
        $this->command->info('  🧩 יוצר קבוצות תוספות...');

        // ---- Pizza Palace ----
        $this->seedPizzaAddons($restaurants->get('pizza-palace'));

        // ---- Burger Central ----
        $this->seedBurgerAddons($restaurants->get('burger-central'));

        // ---- Sushi Bar ----
        $this->seedSushiAddons($restaurants->get('sushi-bar'));

        // ---- Falafel Hadekel ----
        $this->seedFalafelAddons($restaurants->get('falafel-hadekel'));

        // ---- Pasta Preta ----
        $this->seedPastaAddons($restaurants->get('pasta-preta'));

        // סמן use_addons=true על כל הפריטים של כל 5 המסעדות
        $this->enableAddonsOnItems($restaurants);
    }

    private function createAddonGroup(Restaurant $r, array $data): RestaurantAddonGroup
    {
        return RestaurantAddonGroup::withoutGlobalScopes()->updateOrCreate(
            [
                'tenant_id' => $r->tenant_id,
                'name' => $data['name'],
            ],
            [
                'restaurant_id' => $r->id,
                'selection_type' => 'multiple',
                'min_selections' => $data['min'] ?? 0,
                'max_selections' => $data['max'] ?? null,
                'is_required' => ($data['min'] ?? 0) > 0,
                'is_active' => true,
                'sort_order' => $data['sort'] ?? 1,
                'placement' => $data['placement'] ?? 'inside',
                'source_type' => 'manual',
            ]
        );
    }

    private function createAddon(RestaurantAddonGroup $group, Restaurant $r, array $data): RestaurantAddon
    {
        return RestaurantAddon::withoutGlobalScopes()->updateOrCreate(
            [
                'tenant_id' => $r->tenant_id,
                'addon_group_id' => $group->id,
                'name' => $data['name'],
            ],
            [
                'restaurant_id' => $r->id,
                'price_delta' => $data['price'] ?? 0,
                'is_active' => true,
                'sort_order' => $data['sort'] ?? 1,
                'category_ids' => $data['category_ids'] ?? null,
            ]
        );
    }

    // ---------- Pizza Palace ----------
    private function seedPizzaAddons(?Restaurant $r): void
    {
        if (!$r) return;

        $pizzaCats = $this->getCategoryIds($r, ['פיצות קלאסיות', 'פיצות ספיישל']);

        // גודל פיצה (חובה, בחירה אחת)
        $sizeGroup = $this->createAddonGroup($r, ['name' => 'גודל פיצה', 'min' => 1, 'max' => 1, 'sort' => 1]);
        foreach ([
            ['name' => 'S - אישית', 'price' => 0, 'sort' => 1],
            ['name' => 'M - זוגית', 'price' => 8, 'sort' => 2],
            ['name' => 'L - משפחתית', 'price' => 12, 'sort' => 3],
            ['name' => 'XL - מסיבה', 'price' => 18, 'sort' => 4],
        ] as $addon) {
            $this->createAddon($sizeGroup, $r, array_merge($addon, ['category_ids' => $pizzaCats]));
        }

        // תוספות לפיצה (אופציונלי, עד 5)
        $toppingsGroup = $this->createAddonGroup($r, ['name' => 'תוספות לפיצה', 'min' => 0, 'max' => 5, 'sort' => 2]);
        foreach ([
            ['name' => 'זיתים שחורים', 'price' => 4, 'sort' => 1],
            ['name' => 'פטריות', 'price' => 4, 'sort' => 2],
            ['name' => 'בצל מקורמל', 'price' => 3, 'sort' => 3],
            ['name' => 'פפרוני', 'price' => 6, 'sort' => 4],
            ['name' => 'אנשובי', 'price' => 5, 'sort' => 5],
            ['name' => 'תירס', 'price' => 3, 'sort' => 6],
            ['name' => 'רוקט', 'price' => 4, 'sort' => 7],
            ['name' => 'גבינת עיזים', 'price' => 6, 'sort' => 8],
        ] as $addon) {
            $this->createAddon($toppingsGroup, $r, array_merge($addon, ['category_ids' => $pizzaCats]));
        }

        // רוטב נוסף (אופציונלי, אחד)
        $sauceGroup = $this->createAddonGroup($r, ['name' => 'רוטב נוסף', 'min' => 0, 'max' => 1, 'sort' => 3]);
        foreach ([
            ['name' => 'רוטב שום', 'price' => 3, 'sort' => 1],
            ['name' => 'רוטב פסטו', 'price' => 4, 'sort' => 2],
            ['name' => 'רוטב צ\'ילי', 'price' => 3, 'sort' => 3],
            ['name' => 'שמן כמהין', 'price' => 5, 'sort' => 4],
        ] as $addon) {
            $this->createAddon($sauceGroup, $r, array_merge($addon, ['category_ids' => $pizzaCats]));
        }

        // משקה לקומבו (אופציונלי, אחד, מופיע על פיצות)
        $drinkGroup = $this->createAddonGroup($r, ['name' => 'הוסף משקה לקומבו', 'min' => 0, 'max' => 1, 'sort' => 4]);
        foreach ([
            ['name' => 'קולה 330 מ"ל', 'price' => 8, 'sort' => 1],
            ['name' => 'ספרייט 330 מ"ל', 'price' => 8, 'sort' => 2],
            ['name' => 'מים מינרלים', 'price' => 5, 'sort' => 3],
        ] as $addon) {
            $this->createAddon($drinkGroup, $r, array_merge($addon, ['category_ids' => $pizzaCats]));
        }
    }

    // ---------- Burger Central ----------
    private function seedBurgerAddons(?Restaurant $r): void
    {
        if (!$r) return;

        $burgerCats = $this->getCategoryIds($r, ['המבורגרים']);

        // גודל קציצה (חובה, אחת)
        $pattyGroup = $this->createAddonGroup($r, ['name' => 'גודל קציצה', 'min' => 1, 'max' => 1, 'sort' => 1]);
        foreach ([
            ['name' => '150 גרם', 'price' => 0, 'sort' => 1],
            ['name' => '200 גרם', 'price' => 8, 'sort' => 2],
            ['name' => '300 גרם', 'price' => 16, 'sort' => 3],
        ] as $addon) {
            $this->createAddon($pattyGroup, $r, array_merge($addon, ['category_ids' => $burgerCats]));
        }

        // סוג לחמניה (חובה, אחת)
        $bunGroup = $this->createAddonGroup($r, ['name' => 'סוג לחמניה', 'min' => 1, 'max' => 1, 'sort' => 2]);
        foreach ([
            ['name' => 'לחמניה רגילה', 'price' => 0, 'sort' => 1],
            ['name' => 'בריוש', 'price' => 4, 'sort' => 2],
            ['name' => 'ללא לחם (בקערה)', 'price' => 0, 'sort' => 3],
        ] as $addon) {
            $this->createAddon($bunGroup, $r, array_merge($addon, ['category_ids' => $burgerCats]));
        }

        // תוספות להמבורגר (אופציונלי, עד 4)
        $extrasGroup = $this->createAddonGroup($r, ['name' => 'תוספות להמבורגר', 'min' => 0, 'max' => 4, 'sort' => 3]);
        foreach ([
            ['name' => 'צ\'דר', 'price' => 5, 'sort' => 1],
            ['name' => 'ביצת עין', 'price' => 4, 'sort' => 2],
            ['name' => 'בייקון מעושן', 'price' => 7, 'sort' => 3],
            ['name' => 'ג\'לפניו', 'price' => 3, 'sort' => 4],
            ['name' => 'אבוקדו', 'price' => 6, 'sort' => 5],
            ['name' => 'פטריות מוקפצות', 'price' => 4, 'sort' => 6],
        ] as $addon) {
            $this->createAddon($extrasGroup, $r, array_merge($addon, ['category_ids' => $burgerCats]));
        }

        // רטבים (אופציונלי, עד 2)
        $sauceGroup = $this->createAddonGroup($r, ['name' => 'רטבים', 'min' => 0, 'max' => 2, 'sort' => 4]);
        foreach ([
            ['name' => 'קטשופ', 'price' => 0, 'sort' => 1],
            ['name' => 'חרדל', 'price' => 0, 'sort' => 2],
            ['name' => 'ברביקיו', 'price' => 0, 'sort' => 3],
            ['name' => 'שום', 'price' => 0, 'sort' => 4],
            ['name' => 'צ\'ילי חריף', 'price' => 2, 'sort' => 5],
        ] as $addon) {
            $this->createAddon($sauceGroup, $r, $addon); // כל הקטגוריות
        }
    }

    // ---------- Sushi Bar ----------
    private function seedSushiAddons(?Restaurant $r): void
    {
        if (!$r) return;

        $rollCats = $this->getCategoryIds($r, ['רולים']);
        $sashimiCats = $this->getCategoryIds($r, ['סשימי וניגירי']);

        // סויה/וואסאבי (אופציונלי, חופשי)
        $dipGroup = $this->createAddonGroup($r, ['name' => 'רטבים ודיפים', 'min' => 0, 'max' => null, 'sort' => 1]);
        foreach ([
            ['name' => 'סויה', 'price' => 0, 'sort' => 1],
            ['name' => 'וואסאבי', 'price' => 0, 'sort' => 2],
            ['name' => 'ג\'ינג\'ר כבוש', 'price' => 0, 'sort' => 3],
            ['name' => 'מיונז יפני', 'price' => 3, 'sort' => 4],
            ['name' => 'רוטב אונאגי', 'price' => 3, 'sort' => 5],
        ] as $addon) {
            $this->createAddon($dipGroup, $r, $addon);
        }

        // תוספות לרול (אופציונלי, עד 3)
        $rollExtras = $this->createAddonGroup($r, ['name' => 'תוספות לרול', 'min' => 0, 'max' => 3, 'sort' => 2]);
        foreach ([
            ['name' => 'אבוקדו אקסטרה', 'price' => 5, 'sort' => 1],
            ['name' => 'סלמון אקסטרה', 'price' => 8, 'sort' => 2],
            ['name' => 'קראנצ\' טמפורה', 'price' => 3, 'sort' => 3],
            ['name' => 'שומשום', 'price' => 2, 'sort' => 4],
            ['name' => 'גבינת פילדלפיה', 'price' => 4, 'sort' => 5],
        ] as $addon) {
            $this->createAddon($rollExtras, $r, array_merge($addon, ['category_ids' => $rollCats]));
        }

        // רמת חריפות (אופציונלי, אחד)
        $spiceGroup = $this->createAddonGroup($r, ['name' => 'רמת חריפות', 'min' => 0, 'max' => 1, 'sort' => 3]);
        foreach ([
            ['name' => 'רגיל (לא חריף)', 'price' => 0, 'sort' => 1],
            ['name' => 'חריף', 'price' => 0, 'sort' => 2],
            ['name' => 'אקסטרה חריף 🌶️', 'price' => 0, 'sort' => 3],
        ] as $addon) {
            $this->createAddon($spiceGroup, $r, $addon);
        }
    }

    // ---------- Falafel Hadekel ----------
    private function seedFalafelAddons(?Restaurant $r): void
    {
        if (!$r) return;

        $mainCats = $this->getCategoryIds($r, ['מנות פלאפל', 'שווארמה ובשרים']);

        // סוג עטיפה (חובה, אחת)
        $wrapGroup = $this->createAddonGroup($r, ['name' => 'סוג עטיפה', 'min' => 1, 'max' => 1, 'sort' => 1]);
        foreach ([
            ['name' => 'פיתה', 'price' => 0, 'sort' => 1],
            ['name' => 'לאפה', 'price' => 3, 'sort' => 2],
            ['name' => 'צלחת', 'price' => 5, 'sort' => 3],
        ] as $addon) {
            $this->createAddon($wrapGroup, $r, array_merge($addon, ['category_ids' => $mainCats]));
        }

        // סלטים לבחירה (אופציונלי, עד 6)
        $saladsGroup = $this->createAddonGroup($r, ['name' => 'סלטים לבחירה', 'min' => 0, 'max' => 6, 'sort' => 2]);
        foreach ([
            ['name' => 'חומוס', 'price' => 0, 'sort' => 1],
            ['name' => 'טחינה', 'price' => 0, 'sort' => 2],
            ['name' => 'חצילים', 'price' => 0, 'sort' => 3],
            ['name' => 'כרוב סגול', 'price' => 0, 'sort' => 4],
            ['name' => 'חמוצים', 'price' => 0, 'sort' => 5],
            ['name' => 'סלט ירקות', 'price' => 0, 'sort' => 6],
            ['name' => 'שום חריף', 'price' => 0, 'sort' => 7],
            ['name' => 'אמבה', 'price' => 0, 'sort' => 8],
        ] as $addon) {
            $this->createAddon($saladsGroup, $r, array_merge($addon, ['category_ids' => $mainCats]));
        }

        // הוספה/הסרה (אופציונלי)
        $customGroup = $this->createAddonGroup($r, ['name' => 'התאמה אישית', 'min' => 0, 'max' => null, 'sort' => 3]);
        foreach ([
            ['name' => 'בלי חריף', 'price' => 0, 'sort' => 1],
            ['name' => 'הרבה טחינה', 'price' => 0, 'sort' => 2],
            ['name' => 'ללא בצל', 'price' => 0, 'sort' => 3],
            ['name' => 'תוספת צ\'יפס', 'price' => 5, 'sort' => 4],
            ['name' => 'תוספת חומוס', 'price' => 4, 'sort' => 5],
            ['name' => 'תוספת פלאפל (3 כדורים)', 'price' => 4, 'sort' => 6],
        ] as $addon) {
            $this->createAddon($customGroup, $r, array_merge($addon, ['category_ids' => $mainCats]));
        }
    }

    // ---------- Pasta Preta ----------
    private function seedPastaAddons(?Restaurant $r): void
    {
        if (!$r) return;

        $pastaCats = $this->getCategoryIds($r, ['פסטות טריות']);

        // סוג פסטה (חובה, אחת)
        $typeGroup = $this->createAddonGroup($r, ['name' => 'סוג פסטה', 'min' => 1, 'max' => 1, 'sort' => 1]);
        foreach ([
            ['name' => 'ספגטי', 'price' => 0, 'sort' => 1],
            ['name' => 'פנה', 'price' => 0, 'sort' => 2],
            ['name' => 'טליאטלה', 'price' => 4, 'sort' => 3],
            ['name' => 'ניוקי', 'price' => 6, 'sort' => 4],
        ] as $addon) {
            $this->createAddon($typeGroup, $r, array_merge($addon, ['category_ids' => $pastaCats]));
        }

        // גודל (חובה, אחד)
        $sizeGroup = $this->createAddonGroup($r, ['name' => 'גודל מנה', 'min' => 1, 'max' => 1, 'sort' => 2]);
        foreach ([
            ['name' => 'רגיל', 'price' => 0, 'sort' => 1],
            ['name' => 'גדול', 'price' => 12, 'sort' => 2],
        ] as $addon) {
            $this->createAddon($sizeGroup, $r, array_merge($addon, ['category_ids' => $pastaCats]));
        }

        // תוספות לפסטה (אופציונלי)
        $extrasGroup = $this->createAddonGroup($r, ['name' => 'תוספות לפסטה', 'min' => 0, 'max' => null, 'sort' => 3]);
        foreach ([
            ['name' => 'פרמזן מגורד', 'price' => 4, 'sort' => 1],
            ['name' => 'שמנת טרייה', 'price' => 5, 'sort' => 2],
            ['name' => 'פטריות יער', 'price' => 5, 'sort' => 3],
            ['name' => 'חזה עוף', 'price' => 8, 'sort' => 4],
            ['name' => 'שרימפס', 'price' => 12, 'sort' => 5],
            ['name' => 'שמן כמהין', 'price' => 6, 'sort' => 6],
        ] as $addon) {
            $this->createAddon($extrasGroup, $r, array_merge($addon, ['category_ids' => $pastaCats]));
        }

        // סלט לצד (אופציונלי, אחד)
        $saladCats = $this->getCategoryIds($r, ['סלטים']);
        $sideGroup = $this->createAddonGroup($r, ['name' => 'הוסף סלט', 'min' => 0, 'max' => 1, 'sort' => 4]);
        foreach ([
            ['name' => 'סלט ירוק קטן', 'price' => 12, 'sort' => 1],
            ['name' => 'סלט קפרזה קטן', 'price' => 16, 'sort' => 2],
        ] as $addon) {
            $this->createAddon($sideGroup, $r, array_merge($addon, ['category_ids' => $pastaCats]));
        }
    }

    /**
     * enable use_addons on all menu items of the 5 demo restaurants
     */
    private function enableAddonsOnItems($restaurants): void
    {
        $restaurantIds = $restaurants->pluck('id')->all();
        MenuItem::withoutGlobalScopes()
            ->whereIn('restaurant_id', $restaurantIds)
            ->update(['use_addons' => true]);
    }

    /**
     * get category IDs by name for a restaurant
     */
    private function getCategoryIds(Restaurant $r, array $names): array
    {
        return Category::withoutGlobalScopes()
            ->where('restaurant_id', $r->id)
            ->whereIn('name', $names)
            ->pluck('id')
            ->all();
    }

    // =========================================================================
    //  Phase 4 — מבצעים
    // =========================================================================
    private function seedPromotions($restaurants): void
    {
        $this->command->info('  🎁 יוצר מבצעים...');

        $this->seedPizzaPromotions($restaurants->get('pizza-palace'));
        $this->seedBurgerPromotions($restaurants->get('burger-central'));
        $this->seedSushiPromotions($restaurants->get('sushi-bar'));
        $this->seedFalafelPromotions($restaurants->get('falafel-hadekel'));
        $this->seedPastaPromotions($restaurants->get('pasta-preta'));
    }

    private function createPromotion(Restaurant $r, array $data): Promotion
    {
        return Promotion::withoutGlobalScopes()->updateOrCreate(
            [
                'tenant_id' => $r->tenant_id,
                'name' => $data['name'],
            ],
            [
                'restaurant_id' => $r->id,
                'description' => $data['description'] ?? null,
                'image_url' => $data['image_url'] ?? null,
                'start_at' => $data['start_at'] ?? Carbon::now()->subDay(),
                'end_at' => $data['end_at'] ?? Carbon::now()->addYear(),
                'active_hours_start' => $data['active_hours_start'] ?? null,
                'active_hours_end' => $data['active_hours_end'] ?? null,
                'active_days' => $data['active_days'] ?? [0, 1, 2, 3, 4, 5, 6],
                'is_active' => true,
                'priority' => $data['priority'] ?? 1,
                'auto_apply' => $data['auto_apply'] ?? true,
                'gift_required' => $data['gift_required'] ?? false,
                'stackable' => $data['stackable'] ?? false,
            ]
        );
    }

    // ---------- Pizza Palace ----------
    private function seedPizzaPromotions(?Restaurant $r): void
    {
        if (!$r) return;

        $pizzaCat = Category::withoutGlobalScopes()->where('restaurant_id', $r->id)->where('name', 'פיצות קלאסיות')->first();
        $specialCat = Category::withoutGlobalScopes()->where('restaurant_id', $r->id)->where('name', 'פיצות ספיישל')->first();
        $drinksCat = Category::withoutGlobalScopes()->where('restaurant_id', $r->id)->where('name', 'משקאות')->first();
        $beer = MenuItem::withoutGlobalScopes()->where('restaurant_id', $r->id)->where('name', 'בירה איטלקית')->first();

        // מבצע 1: 2 פיצות = 10% הנחה
        $promo1 = $this->createPromotion($r, [
            'name' => '2 פיצות - 10% הנחה!',
            'description' => 'הזמינו 2 פיצות קלאסיות וקבלו 10% הנחה על ההזמנה',
            'image_url' => 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=800&q=80',
            'active_days' => [0, 1, 2, 3, 4],
            'priority' => 1,
        ]);
        $promo1->rules()->delete();
        $promo1->rewards()->delete();
        if ($pizzaCat) {
            PromotionRule::create(['promotion_id' => $promo1->id, 'required_category_id' => $pizzaCat->id, 'min_quantity' => 2]);
        }
        PromotionReward::create(['promotion_id' => $promo1->id, 'reward_type' => 'discount_percent', 'reward_value' => 10]);

        // מבצע 2: פיצה ספיישל = בירה חינם (Happy Hour 17:00-20:00)
        $promo2 = $this->createPromotion($r, [
            'name' => 'Happy Hour — בירה חינם!',
            'description' => 'בירה איטלקית חינם על כל הזמנה של פיצה ספיישל, בין 17:00 ל-20:00',
            'image_url' => 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80',
            'active_hours_start' => '17:00',
            'active_hours_end' => '20:00',
            'priority' => 2,
            'gift_required' => true,
        ]);
        $promo2->rules()->delete();
        $promo2->rewards()->delete();
        if ($specialCat) {
            PromotionRule::create(['promotion_id' => $promo2->id, 'required_category_id' => $specialCat->id, 'min_quantity' => 1]);
        }
        PromotionReward::create([
            'promotion_id' => $promo2->id,
            'reward_type' => 'free_item',
            'reward_category_id' => $drinksCat?->id,
            'reward_menu_item_id' => $beer?->id,
            'max_selectable' => 1,
        ]);
    }

    // ---------- Burger Central ----------
    private function seedBurgerPromotions(?Restaurant $r): void
    {
        if (!$r) return;

        $burgerCat = Category::withoutGlobalScopes()->where('restaurant_id', $r->id)->where('name', 'המבורגרים')->first();
        $sidesCat = Category::withoutGlobalScopes()->where('restaurant_id', $r->id)->where('name', 'תוספות')->first();

        // מבצע 1: ארוחת המבורגר — המבורגר + 20% הנחה
        $promo1 = $this->createPromotion($r, [
            'name' => 'ארוחת המבורגר — 20% הנחה!',
            'description' => 'הזמינו המבורגר כלשהו וקבלו 20% הנחה על כל ההזמנה',
            'image_url' => 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=800&q=80',
            'priority' => 1,
        ]);
        $promo1->rules()->delete();
        $promo1->rewards()->delete();
        if ($burgerCat) {
            PromotionRule::create(['promotion_id' => $promo1->id, 'required_category_id' => $burgerCat->id, 'min_quantity' => 1]);
        }
        PromotionReward::create(['promotion_id' => $promo1->id, 'reward_type' => 'discount_percent', 'reward_value' => 20]);

        // מבצע 2: יום שלישי — צ'יפס חינם
        $chipItem = MenuItem::withoutGlobalScopes()->where('restaurant_id', $r->id)->where('name', 'like', '%צ\'יפס%')->first();
        $promo2 = $this->createPromotion($r, [
            'name' => 'שלישי = צ\'יפס חינם!',
            'description' => 'בכל יום שלישי, קבלו צ\'יפס כפול חינם עם כל המבורגר',
            'image_url' => 'https://images.unsplash.com/photo-1541599540903-216a46ca1dc0?auto=format&fit=crop&w=800&q=80',
            'active_days' => [2], // Tuesday
            'priority' => 2,
            'gift_required' => true,
        ]);
        $promo2->rules()->delete();
        $promo2->rewards()->delete();
        if ($burgerCat) {
            PromotionRule::create(['promotion_id' => $promo2->id, 'required_category_id' => $burgerCat->id, 'min_quantity' => 1]);
        }
        PromotionReward::create([
            'promotion_id' => $promo2->id,
            'reward_type' => 'free_item',
            'reward_category_id' => $sidesCat?->id,
            'reward_menu_item_id' => $chipItem?->id,
            'max_selectable' => 1,
        ]);
    }

    // ---------- Sushi Bar ----------
    private function seedSushiPromotions(?Restaurant $r): void
    {
        if (!$r) return;

        $rollCat = Category::withoutGlobalScopes()->where('restaurant_id', $r->id)->where('name', 'רולים')->first();
        $sashimiCat = Category::withoutGlobalScopes()->where('restaurant_id', $r->id)->where('name', 'סשימי וניגירי')->first();
        $appetizerCat = Category::withoutGlobalScopes()->where('restaurant_id', $r->id)->where('name', 'מנות פתיחה')->first();

        // מבצע 1: 3 רולים = הנחה 15%
        $promo1 = $this->createPromotion($r, [
            'name' => '3 רולים — 15% הנחה!',
            'description' => 'הזמינו 3 רולים ומעלה וקבלו 15% הנחה',
            'image_url' => 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=800&q=80',
            'priority' => 1,
        ]);
        $promo1->rules()->delete();
        $promo1->rewards()->delete();
        if ($rollCat) {
            PromotionRule::create(['promotion_id' => $promo1->id, 'required_category_id' => $rollCat->id, 'min_quantity' => 3]);
        }
        PromotionReward::create(['promotion_id' => $promo1->id, 'reward_type' => 'discount_percent', 'reward_value' => 15]);

        // מבצע 2: סשימי = מנת פתיחה חינם
        $edamame = MenuItem::withoutGlobalScopes()->where('restaurant_id', $r->id)->where('name', 'like', '%אדממה%')->first();
        $promo2 = $this->createPromotion($r, [
            'name' => 'סשימי + אדממה חינם',
            'description' => 'הזמינו מנת סשימי וקבלו אדממה ים חינם',
            'image_url' => 'https://images.unsplash.com/photo-1580828343064-fde4fc206bc6?auto=format&fit=crop&w=800&q=80',
            'priority' => 2,
            'gift_required' => true,
        ]);
        $promo2->rules()->delete();
        $promo2->rewards()->delete();
        if ($sashimiCat) {
            PromotionRule::create(['promotion_id' => $promo2->id, 'required_category_id' => $sashimiCat->id, 'min_quantity' => 1]);
        }
        PromotionReward::create([
            'promotion_id' => $promo2->id,
            'reward_type' => 'free_item',
            'reward_category_id' => $appetizerCat?->id,
            'reward_menu_item_id' => $edamame?->id,
            'max_selectable' => 1,
        ]);
    }

    // ---------- Falafel Hadekel ----------
    private function seedFalafelPromotions(?Restaurant $r): void
    {
        if (!$r) return;

        $falafelCat = Category::withoutGlobalScopes()->where('restaurant_id', $r->id)->where('name', 'מנות פלאפל')->first();
        $shawarmaCat = Category::withoutGlobalScopes()->where('restaurant_id', $r->id)->where('name', 'שווארמה ובשרים')->first();
        $drinkCat = Category::withoutGlobalScopes()->where('restaurant_id', $r->id)->where('name', 'משקאות')->first();
        $lemonade = MenuItem::withoutGlobalScopes()->where('restaurant_id', $r->id)->where('name', 'like', '%לימונדה%')->first();

        // מבצע 1: פלאפל + לימונדה חינם
        $promo1 = $this->createPromotion($r, [
            'name' => 'פלאפל + לימונדה חינם!',
            'description' => 'על כל מנת פלאפל, קבלו לימונדה נענע חינם!',
            'image_url' => 'https://images.unsplash.com/photo-1608136760559-3a3e5e4a3c8b?auto=format&fit=crop&w=800&q=80',
            'priority' => 1,
            'gift_required' => true,
        ]);
        $promo1->rules()->delete();
        $promo1->rewards()->delete();
        if ($falafelCat) {
            PromotionRule::create(['promotion_id' => $promo1->id, 'required_category_id' => $falafelCat->id, 'min_quantity' => 1]);
        }
        PromotionReward::create([
            'promotion_id' => $promo1->id,
            'reward_type' => 'free_item',
            'reward_category_id' => $drinkCat?->id,
            'reward_menu_item_id' => $lemonade?->id,
            'max_selectable' => 1,
        ]);

        // מבצע 2: 3 מנות בשריות = 15% הנחה
        $promo2 = $this->createPromotion($r, [
            'name' => 'משפחתי — 15% הנחה!',
            'description' => 'הזמינו 3 מנות שווארמה/בשרים ומעלה וקבלו 15% הנחה',
            'image_url' => 'https://images.unsplash.com/photo-1604908177453-74629501c6ab?auto=format&fit=crop&w=800&q=80',
            'priority' => 2,
        ]);
        $promo2->rules()->delete();
        $promo2->rewards()->delete();
        if ($shawarmaCat) {
            PromotionRule::create(['promotion_id' => $promo2->id, 'required_category_id' => $shawarmaCat->id, 'min_quantity' => 3]);
        }
        PromotionReward::create(['promotion_id' => $promo2->id, 'reward_type' => 'discount_percent', 'reward_value' => 15]);
    }

    // ---------- Pasta Preta ----------
    private function seedPastaPromotions(?Restaurant $r): void
    {
        if (!$r) return;

        $pastaCat = Category::withoutGlobalScopes()->where('restaurant_id', $r->id)->where('name', 'פסטות טריות')->first();
        $appetizerCat = Category::withoutGlobalScopes()->where('restaurant_id', $r->id)->where('name', 'מנות פתיחה')->first();
        $garlicBread = MenuItem::withoutGlobalScopes()->where('restaurant_id', $r->id)->where('name', 'like', '%לחם שום%')->first();

        // מבצע 1: 2 פסטות = 10% הנחה
        $promo1 = $this->createPromotion($r, [
            'name' => '2 פסטות — 10% הנחה!',
            'description' => 'הזמינו 2 מנות פסטה וקבלו 10% הנחה על ההזמנה',
            'image_url' => 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=800&q=80',
            'priority' => 1,
        ]);
        $promo1->rules()->delete();
        $promo1->rewards()->delete();
        if ($pastaCat) {
            PromotionRule::create(['promotion_id' => $promo1->id, 'required_category_id' => $pastaCat->id, 'min_quantity' => 2]);
        }
        PromotionReward::create(['promotion_id' => $promo1->id, 'reward_type' => 'discount_percent', 'reward_value' => 10]);

        // מבצע 2: פסטה = לחם שום חינם
        $promo2 = $this->createPromotion($r, [
            'name' => 'לחם שום במתנה!',
            'description' => 'על כל מנת פסטה, קבלו לחם שום ביתי חינם',
            'image_url' => 'https://images.unsplash.com/photo-1481391032119-d89fee407e44?auto=format&fit=crop&w=800&q=80',
            'priority' => 2,
            'gift_required' => true,
        ]);
        $promo2->rules()->delete();
        $promo2->rewards()->delete();
        if ($pastaCat) {
            PromotionRule::create(['promotion_id' => $promo2->id, 'required_category_id' => $pastaCat->id, 'min_quantity' => 1]);
        }
        PromotionReward::create([
            'promotion_id' => $promo2->id,
            'reward_type' => 'free_item',
            'reward_category_id' => $appetizerCat?->id,
            'reward_menu_item_id' => $garlicBread?->id,
            'max_selectable' => 1,
        ]);
    }
}
