<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Copy existing category_base_prices → price_rules (scope_type='category')
        $categoryPrices = DB::table('category_base_prices')->get();

        foreach ($categoryPrices as $cp) {
            DB::table('price_rules')->insert([
                'tenant_id'    => $cp->tenant_id,
                'target_type'  => 'base',
                'target_id'    => $cp->restaurant_variant_id,
                'scope_type'   => 'category',
                'scope_id'     => $cp->category_id,
                'price_delta'  => $cp->price_delta,
                'created_at'   => $cp->created_at,
                'updated_at'   => $cp->updated_at,
            ]);
        }

        // 2. For variants with price_delta != 0, create category rules for categories
        //    that don't already have an explicit category_base_prices entry
        $variants = DB::table('restaurant_variants')
            ->where('price_delta', '!=', 0)
            ->get();

        foreach ($variants as $variant) {
            // Get all categories for this restaurant's tenant
            $categories = DB::table('categories')
                ->where('tenant_id', $variant->tenant_id)
                ->pluck('id');

            // Get categories that already have a rule for this variant
            $existingCategoryIds = DB::table('price_rules')
                ->where('target_type', 'base')
                ->where('target_id', $variant->id)
                ->where('scope_type', 'category')
                ->pluck('scope_id');

            $missingCategoryIds = $categories->diff($existingCategoryIds);

            foreach ($missingCategoryIds as $categoryId) {
                DB::table('price_rules')->insert([
                    'tenant_id'    => $variant->tenant_id,
                    'target_type'  => 'base',
                    'target_id'    => $variant->id,
                    'scope_type'   => 'category',
                    'scope_id'     => $categoryId,
                    'price_delta'  => $variant->price_delta,
                    'created_at'   => now(),
                    'updated_at'   => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        // Don't delete price_rules data on rollback — the schema migration handles dropping the table
    }
};
