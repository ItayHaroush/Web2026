<?php

namespace App\Services;

use App\Models\PriceRule;
use Illuminate\Support\Collection;

class BasePriceService
{
    /**
     * Calculate the price for a single base in context of a specific item and category.
     * Additive stacking: category rule + item rule.
     */
    public function calculateBasePrice(int $itemId, int $categoryId, int $baseId): float
    {
        $price = 0.0;

        // Layer 1: Category rule
        $categoryRule = PriceRule::where('target_type', 'base')
            ->where('target_id', $baseId)
            ->where('scope_type', 'category')
            ->where('scope_id', $categoryId)
            ->first();

        if ($categoryRule) {
            $price += (float) $categoryRule->price_delta;
        }

        // Layer 2: Item rule (stacks on top of category)
        $itemRule = PriceRule::where('target_type', 'base')
            ->where('target_id', $baseId)
            ->where('scope_type', 'item')
            ->where('scope_id', $itemId)
            ->first();

        if ($itemRule) {
            $price += (float) $itemRule->price_delta;
        }

        return round($price, 2);
    }

    /**
     * Calculate prices for all bases in context of a specific item.
     * Returns array of [base_id => calculated_price].
     */
    public function calculateBasePricesForItem(int $itemId, int $categoryId, Collection $bases): array
    {
        // Batch-load all relevant rules to avoid N+1
        $baseIds = $bases->pluck('id')->toArray();

        $categoryRules = PriceRule::where('target_type', 'base')
            ->whereIn('target_id', $baseIds)
            ->where('scope_type', 'category')
            ->where('scope_id', $categoryId)
            ->get()
            ->keyBy('target_id');

        $itemRules = PriceRule::where('target_type', 'base')
            ->whereIn('target_id', $baseIds)
            ->where('scope_type', 'item')
            ->where('scope_id', $itemId)
            ->get()
            ->keyBy('target_id');

        $prices = [];
        foreach ($bases as $base) {
            $price = 0.0;

            if ($categoryRules->has($base->id)) {
                $price += (float) $categoryRules->get($base->id)->price_delta;
            }

            if ($itemRules->has($base->id)) {
                $price += (float) $itemRules->get($base->id)->price_delta;
            }

            $prices[$base->id] = round($price, 2);
        }

        return $prices;
    }

    /**
     * Get category-level price rules for a specific category.
     * Returns array of [base_id => price_delta].
     */
    public function getCategoryPrices(int $categoryId): array
    {
        return PriceRule::where('target_type', 'base')
            ->where('scope_type', 'category')
            ->where('scope_id', $categoryId)
            ->pluck('price_delta', 'target_id')
            ->map(fn($v) => (float) $v)
            ->toArray();
    }

    /**
     * Get item-level adjustments for a specific menu item.
     * Returns array of [base_id => price_delta].
     */
    public function getItemAdjustments(int $itemId): array
    {
        return PriceRule::where('target_type', 'base')
            ->where('scope_type', 'item')
            ->where('scope_id', $itemId)
            ->pluck('price_delta', 'target_id')
            ->map(fn($v) => (float) $v)
            ->toArray();
    }
}
