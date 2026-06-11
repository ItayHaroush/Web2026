<?php

namespace App\Console\Commands;

use App\Models\MenuItem;
use App\Models\Restaurant;
use App\Models\RestaurantAddon;
use App\Models\RestaurantAddonGroup;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class BackfillWoltAddonGroups extends Command
{
    protected $signature = 'wolt:backfill-addon-groups {restaurant_id : Target restaurant ID}';

    protected $description = 'Backfill restaurant addon groups/addons from menu_item_addon_groups for previously imported Wolt menus';

    public function handle(): int
    {
        $restaurantId = (int) $this->argument('restaurant_id');

        /** @var Restaurant|null $restaurant */
        $restaurant = Restaurant::withoutGlobalScopes()->find($restaurantId);
        if (! $restaurant) {
            $this->error("Restaurant not found: {$restaurantId}");
            return self::FAILURE;
        }

        $this->info("Backfilling restaurant #{$restaurant->id} ({$restaurant->tenant_id})");

        $rows = DB::table('menu_item_addon_groups as mig')
            ->join('menu_items as mi', 'mi.id', '=', 'mig.menu_item_id')
            ->leftJoin('menu_item_addons as mia', 'mia.addon_group_id', '=', 'mig.id')
            ->where('mi.restaurant_id', $restaurant->id)
            ->select([
                'mi.id as menu_item_id',
                'mig.id as item_group_id',
                'mig.name as group_name',
                'mig.selection_type',
                'mig.min_selections',
                'mig.max_selections',
                'mig.is_required',
                'mig.sort_order as group_sort_order',
                'mia.name as addon_name',
                'mia.price_delta as addon_price_delta',
                'mia.sort_order as addon_sort_order',
            ])
            ->orderBy('mi.id')
            ->orderBy('mig.sort_order')
            ->orderBy('mia.sort_order')
            ->get();

        if ($rows->isEmpty()) {
            $this->warn('No item-level addon groups found for this restaurant.');
            return self::SUCCESS;
        }

        $createdGroups = 0;
        $updatedGroups = 0;
        $createdAddons = 0;
        $updatedAddons = 0;
        $updatedItems = 0;

        DB::transaction(function () use (
            $restaurant,
            $rows,
            &$createdGroups,
            &$updatedGroups,
            &$createdAddons,
            &$updatedAddons,
            &$updatedItems
        ) {
            $groupByName = [];
            $itemScopes = [];

            foreach ($rows as $row) {
                if (empty($row->group_name)) {
                    continue;
                }

                $groupKey = mb_strtolower(trim((string) $row->group_name));
                if ($groupKey === '') {
                    continue;
                }

                if (! isset($groupByName[$groupKey])) {
                    $payload = [
                        'tenant_id' => $restaurant->tenant_id,
                        'name' => (string) $row->group_name,
                        'selection_type' => in_array($row->selection_type, ['single', 'multiple'], true) ? $row->selection_type : 'multiple',
                        'min_selections' => max(0, (int) ($row->min_selections ?? 0)),
                        'max_selections' => $row->max_selections !== null ? max(0, (int) $row->max_selections) : null,
                        'is_required' => (bool) ($row->is_required ?? false),
                        'is_active' => true,
                        'sort_order' => (int) ($row->group_sort_order ?? 0),
                    ];

                    $existingGroup = RestaurantAddonGroup::withoutGlobalScopes()
                        ->where('restaurant_id', $restaurant->id)
                        ->where('name', $row->group_name)
                        ->first();

                    if ($existingGroup) {
                        $existingGroup->update($payload);
                        $groupByName[$groupKey] = $existingGroup->refresh();
                        $updatedGroups++;
                    } else {
                        $groupByName[$groupKey] = RestaurantAddonGroup::create([
                            'restaurant_id' => $restaurant->id,
                            ...$payload,
                        ]);
                        $createdGroups++;
                    }
                }

                $restaurantGroup = $groupByName[$groupKey];

                $itemScopes[(int) $row->menu_item_id][] = (int) $restaurantGroup->id;

                $addonName = trim((string) ($row->addon_name ?? ''));
                if ($addonName === '') {
                    continue;
                }

                $addonPayload = [
                    'tenant_id' => $restaurant->tenant_id,
                    'name' => $addonName,
                    'price_delta' => is_numeric($row->addon_price_delta) ? round((float) $row->addon_price_delta, 2) : 0,
                    'selection_weight' => 1,
                    'max_quantity' => 1,
                    'is_active' => true,
                    'sort_order' => (int) ($row->addon_sort_order ?? 0),
                ];

                $existingAddon = RestaurantAddon::withoutGlobalScopes()
                    ->where('restaurant_id', $restaurant->id)
                    ->where('addon_group_id', $restaurantGroup->id)
                    ->where('name', $addonName)
                    ->first();

                if ($existingAddon) {
                    $existingAddon->update($addonPayload);
                    $updatedAddons++;
                } else {
                    RestaurantAddon::create([
                        'restaurant_id' => $restaurant->id,
                        'addon_group_id' => $restaurantGroup->id,
                        ...$addonPayload,
                    ]);
                    $createdAddons++;
                }
            }

            foreach ($itemScopes as $menuItemId => $groupIds) {
                $normalized = array_values(array_unique(array_map('intval', $groupIds)));
                if (empty($normalized)) {
                    continue;
                }

                MenuItem::withoutGlobalScopes()
                    ->where('id', $menuItemId)
                    ->where('restaurant_id', $restaurant->id)
                    ->update([
                        'use_addons' => true,
                        'addons_group_scope' => json_encode($normalized),
                    ]);

                $updatedItems++;
            }
        });

        $this->info('Backfill completed successfully.');
        $this->line("Groups created: {$createdGroups}");
        $this->line("Groups updated: {$updatedGroups}");
        $this->line("Addons created: {$createdAddons}");
        $this->line("Addons updated: {$updatedAddons}");
        $this->line("Menu items linked: {$updatedItems}");

        return self::SUCCESS;
    }
}
