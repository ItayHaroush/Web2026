<?php

namespace App\Console\Commands;

use App\Models\RestaurantAddon;
use App\Models\RestaurantAddonGroup;
use Illuminate\Console\Command;

/**
 * ייבוא תוספות (restaurant_addons) לקבוצת תוספות קיימת — שימושי להעתקה מסביבות או מאגר JSON.
 */
class ImportRestaurantAddonGroupItems extends Command
{
    protected $signature = 'addons:import-group-items
                            {--group=52 : מזהה restaurant_addon_groups.id}
                            {--dry-run : רק הצגה ללא כתיבה}';

    protected $description = 'יוצר תוספות ברירת מחדל בקבוצת תוספות (אם השם כבר קיים בקבוצה — מדלג)';

    /** @var array<int, array{name: string, price_delta: float}> */
    private const DEFAULT_ROWS = [
        ['name' => 'תוספת גבינה', 'price_delta' => 0],
        ['name' => 'תירס', 'price_delta' => 7],
        ['name' => 'זיתים ירוקים', 'price_delta' => 7],
        ['name' => 'בטטה', 'price_delta' => 7],
        ['name' => 'עגבניות', 'price_delta' => 7],
        ['name' => 'בצל', 'price_delta' => 7],
        ['name' => 'פלפל חריף', 'price_delta' => 7],
        ['name' => 'בולגרית', 'price_delta' => 7],
        ['name' => 'טונה', 'price_delta' => 7],
        ['name' => 'פרמזן', 'price_delta' => 7],
        ['name' => 'פלפל ירוק', 'price_delta' => 7],
        ['name' => 'פטריות טריות', 'price_delta' => 7],
        ['name' => 'זיתי קלמטה', 'price_delta' => 7],
    ];

    public function handle(): int
    {
        $groupId = (int) $this->option('group');
        $dryRun = (bool) $this->option('dry-run');

        $group = RestaurantAddonGroup::withoutGlobalScopes()->find($groupId);
        if (! $group) {
            $this->error("לא נמצאה קבוצת תוספות id={$groupId} (RestaurantAddonGroup).");

            return self::FAILURE;
        }

        $this->info("מסעדה #{$group->restaurant_id} · tenant {$group->tenant_id} · קבוצה «{$group->name}» (id={$group->id})");

        $maxOrder = (int) (RestaurantAddon::withoutGlobalScopes()
            ->where('addon_group_id', $group->id)
            ->max('sort_order') ?? 0);

        $created = 0;
        $skipped = 0;

        foreach (self::DEFAULT_ROWS as $row) {
            $exists = RestaurantAddon::withoutGlobalScopes()
                ->where('addon_group_id', $group->id)
                ->where('name', $row['name'])
                ->exists();

            if ($exists) {
                $this->line("  דילוג (כבר קיים): {$row['name']}");
                $skipped++;

                continue;
            }

            $maxOrder++;
            $this->line(sprintf('  %s ₪%s', $row['name'], number_format($row['price_delta'], 2)));

            if ($dryRun) {
                $created++;

                continue;
            }

            RestaurantAddon::withoutGlobalScopes()->create([
                'addon_group_id' => $group->id,
                'restaurant_id' => $group->restaurant_id,
                'tenant_id' => $group->tenant_id,
                'name' => $row['name'],
                'price_delta' => $row['price_delta'],
                'selection_weight' => 1,
                'max_quantity' => 1,
                'is_active' => true,
                'category_ids' => null,
                'sort_order' => $maxOrder,
            ]);
            $created++;
        }

        if ($dryRun) {
            $this->warn('מצב dry-run: לא נשמר כלום בבסיס הנתונים.');
        }

        $this->info("סיום: נוצרו {$created}, דולגו {$skipped}.");

        return self::SUCCESS;
    }
}
