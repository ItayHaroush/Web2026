<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Restaurant;
use App\Models\Category;
use App\Models\MenuItem;
use App\Models\RestaurantAddonGroup;
use App\Models\RestaurantAddon;

/**
 * BurgerCentralAddonSeeder — סקריפט תוספות מלא למסעדת Burger Central
 *
 * הרצה:
 *   php artisan db:seed --class=BurgerCentralAddonSeeder
 */
class BurgerCentralAddonSeeder extends Seeder
{
    public function run(): void
    {
        $r = Restaurant::withoutGlobalScopes()->where('slug', 'burger-central')->first();

        if (!$r) {
            $this->command->error('❌ מסעדת burger-central לא נמצאה — הרץ RestaurantSeeder קודם.');
            return;
        }

        $this->command->info('🍔 Burger Central — מייצר תוספות למנות...');

        // ---- קטגוריות ----
        $burgerCats     = $this->catIds($r, ['המבורגרים']);
        $sidesCats      = $this->catIds($r, ['תוספות']);
        $appetizerCats  = $this->catIds($r, ['מנות פתיחה']);
        $drinksCats     = $this->catIds($r, ['משקאות']);
        $allFoodCats    = array_merge($burgerCats, $sidesCats, $appetizerCats);

        // ==============================================================
        //  1. גודל קציצה — חובה, בחירה אחת (המבורגרים בלבד)
        // ==============================================================
        $pattyGroup = $this->group($r, [
            'name' => 'גודל קציצה',
            'min' => 1, 'max' => 1,
            'sort' => 1,
        ]);
        $this->addons($pattyGroup, $r, [
            ['name' => '150 גרם',  'price' => 0,  'sort' => 1],
            ['name' => '200 גרם',  'price' => 8,  'sort' => 2],
            ['name' => '300 גרם',  'price' => 16, 'sort' => 3],
        ], $burgerCats);

        // ==============================================================
        //  2. סוג לחמניה — חובה, בחירה אחת (המבורגרים בלבד)
        // ==============================================================
        $bunGroup = $this->group($r, [
            'name' => 'סוג לחמניה',
            'min' => 1, 'max' => 1,
            'sort' => 2,
        ]);
        $this->addons($bunGroup, $r, [
            ['name' => 'לחמניה רגילה',     'price' => 0, 'sort' => 1],
            ['name' => 'בריוש',             'price' => 4, 'sort' => 2],
            ['name' => 'לחם שיפון',         'price' => 5, 'sort' => 3],
            ['name' => 'ללא לחם (בקערה)',   'price' => 0, 'sort' => 4],
        ], $burgerCats);

        // ==============================================================
        //  3. רמת עשייה — אופציונלי, בחירה אחת (המבורגרים בלבד)
        // ==============================================================
        $donenessGroup = $this->group($r, [
            'name' => 'רמת עשייה',
            'min' => 0, 'max' => 1,
            'sort' => 3,
        ]);
        $this->addons($donenessGroup, $r, [
            ['name' => 'Medium Rare',  'price' => 0, 'sort' => 1],
            ['name' => 'Medium',       'price' => 0, 'sort' => 2],
            ['name' => 'Medium Well',  'price' => 0, 'sort' => 3],
            ['name' => 'Well Done',    'price' => 0, 'sort' => 4],
        ], $burgerCats);

        // ==============================================================
        //  4. תוספות להמבורגר — אופציונלי, עד 5 (המבורגרים בלבד)
        // ==============================================================
        $extrasGroup = $this->group($r, [
            'name' => 'תוספות להמבורגר',
            'min' => 0, 'max' => 5,
            'sort' => 4,
        ]);
        $this->addons($extrasGroup, $r, [
            ['name' => 'צ\'דר',                'price' => 5,  'sort' => 1],
            ['name' => 'גבינה שווייצרית',      'price' => 6,  'sort' => 2],
            ['name' => 'ביצת עין',             'price' => 4,  'sort' => 3],
            ['name' => 'בייקון מעושן',          'price' => 7,  'sort' => 4],
            ['name' => 'פטריות מוקפצות',       'price' => 4,  'sort' => 5],
            ['name' => 'בצל מקורמל',           'price' => 3,  'sort' => 6],
            ['name' => 'אבוקדו',               'price' => 6,  'sort' => 7],
            ['name' => 'ג\'לפניו',              'price' => 3,  'sort' => 8],
            ['name' => 'חסה וטומאטו',          'price' => 0,  'sort' => 9],
            ['name' => 'מלפפון חמוץ',          'price' => 0,  'sort' => 10],
        ], $burgerCats);

        // ==============================================================
        //  5. רטבים — אופציונלי, עד 2 (כל מנות האוכל)
        // ==============================================================
        $sauceGroup = $this->group($r, [
            'name' => 'רטבים',
            'min' => 0, 'max' => 2,
            'sort' => 5,
        ]);
        $this->addons($sauceGroup, $r, [
            ['name' => 'קטשופ',           'price' => 0, 'sort' => 1],
            ['name' => 'חרדל',            'price' => 0, 'sort' => 2],
            ['name' => 'מיונז',           'price' => 0, 'sort' => 3],
            ['name' => 'ברביקיו',         'price' => 0, 'sort' => 4],
            ['name' => 'שום',             'price' => 0, 'sort' => 5],
            ['name' => 'צ\'ילי חריף',     'price' => 2, 'sort' => 6],
            ['name' => 'רוטב הבית',       'price' => 0, 'sort' => 7],
            ['name' => 'טרטר',            'price' => 3, 'sort' => 8],
        ], $allFoodCats);

        // ==============================================================
        //  6. תוספת צד — אופציונלי, עד 2 (המבורגרים + מנות פתיחה)
        // ==============================================================
        $sideGroup = $this->group($r, [
            'name' => 'תוספת צד',
            'min' => 0, 'max' => 2,
            'sort' => 6,
            'placement' => 'side',
        ]);
        $this->addons($sideGroup, $r, [
            ['name' => 'צ\'יפס',              'price' => 8,  'sort' => 1],
            ['name' => 'צ\'יפס בטטה',         'price' => 12, 'sort' => 2],
            ['name' => 'טבעות בצל',           'price' => 10, 'sort' => 3],
            ['name' => 'סלט ירוק',            'price' => 9,  'sort' => 4],
            ['name' => 'קולסלו',              'price' => 7,  'sort' => 5],
            ['name' => 'תירס בגריל',          'price' => 8,  'sort' => 6],
        ], array_merge($burgerCats, $appetizerCats));

        // ==============================================================
        //  7. רמת חריפות — אופציונלי, אחד (כנפיים + המבורגרים)
        // ==============================================================
        $spiceGroup = $this->group($r, [
            'name' => 'רמת חריפות',
            'min' => 0, 'max' => 1,
            'sort' => 7,
        ]);
        $this->addons($spiceGroup, $r, [
            ['name' => 'לא חריף',              'price' => 0, 'sort' => 1],
            ['name' => 'חריף בינוני',           'price' => 0, 'sort' => 2],
            ['name' => 'חריף',                 'price' => 0, 'sort' => 3],
            ['name' => 'אקסטרה חריף 🔥',       'price' => 0, 'sort' => 4],
        ], array_merge($burgerCats, $appetizerCats));

        // ==============================================================
        //  8. גודל צ'יפס — אופציונלי, אחד (תוספות בלבד)
        // ==============================================================
        $chipsSizeGroup = $this->group($r, [
            'name' => 'גודל צ\'יפס',
            'min' => 0, 'max' => 1,
            'sort' => 8,
        ]);
        $this->addons($chipsSizeGroup, $r, [
            ['name' => 'רגיל',        'price' => 0,  'sort' => 1],
            ['name' => 'גדול',        'price' => 6,  'sort' => 2],
            ['name' => 'ענק למשפחה',  'price' => 12, 'sort' => 3],
        ], $sidesCats);

        // ==============================================================
        //  9. הוסף משקה — אופציונלי, אחד (המבורגרים + מנות פתיחה)
        // ==============================================================
        $drinkGroup = $this->group($r, [
            'name' => 'הוסף משקה',
            'min' => 0, 'max' => 1,
            'sort' => 9,
            'placement' => 'side',
        ]);
        $this->addons($drinkGroup, $r, [
            ['name' => 'קולה 330 מ"ל',       'price' => 10, 'sort' => 1],
            ['name' => 'קולה זירו 330 מ"ל',   'price' => 10, 'sort' => 2],
            ['name' => 'ספרייט 330 מ"ל',      'price' => 10, 'sort' => 3],
            ['name' => 'מים מינרלים',          'price' => 6,  'sort' => 4],
            ['name' => 'בירה בוטיק',          'price' => 18, 'sort' => 5],
        ], array_merge($burgerCats, $appetizerCats));

        // ==============================================================
        //  10. הערות — טקסט חופשי (כל מנות האוכל)
        // ==============================================================
        // לא תוספות — הערות מטופלות בדרך אחרת בזרימת ההזמנה

        // ---- סמן use_addons על כל פריטי burger-central ----
        MenuItem::withoutGlobalScopes()
            ->where('restaurant_id', $r->id)
            ->update(['use_addons' => true]);

        $this->command->info('✅ Burger Central — תוספות נוצרו בהצלחה!');
    }

    // =========================================================================
    //  Helpers
    // =========================================================================

    private function group(Restaurant $r, array $data): RestaurantAddonGroup
    {
        return RestaurantAddonGroup::withoutGlobalScopes()->updateOrCreate(
            ['tenant_id' => $r->tenant_id, 'name' => $data['name']],
            [
                'restaurant_id'  => $r->id,
                'selection_type' => 'multiple',
                'min_selections' => $data['min'] ?? 0,
                'max_selections' => $data['max'] ?? null,
                'is_required'    => ($data['min'] ?? 0) > 0,
                'is_active'      => true,
                'sort_order'     => $data['sort'] ?? 1,
                'placement'      => $data['placement'] ?? 'inside',
                'source_type'    => 'manual',
            ]
        );
    }

    private function addons(RestaurantAddonGroup $group, Restaurant $r, array $items, array $categoryIds = []): void
    {
        foreach ($items as $item) {
            RestaurantAddon::withoutGlobalScopes()->updateOrCreate(
                [
                    'tenant_id'      => $r->tenant_id,
                    'addon_group_id' => $group->id,
                    'name'           => $item['name'],
                ],
                [
                    'restaurant_id' => $r->id,
                    'price_delta'   => $item['price'] ?? 0,
                    'is_active'     => true,
                    'sort_order'    => $item['sort'] ?? 1,
                    'category_ids'  => !empty($categoryIds) ? $categoryIds : null,
                ]
            );
        }
    }

    private function catIds(Restaurant $r, array $names): array
    {
        return Category::withoutGlobalScopes()
            ->where('restaurant_id', $r->id)
            ->whereIn('name', $names)
            ->pluck('id')
            ->all();
    }
}
