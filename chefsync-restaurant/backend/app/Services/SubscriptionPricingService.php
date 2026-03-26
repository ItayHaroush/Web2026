<?php

namespace App\Services;

use App\Http\Controllers\SuperAdminSettingsController;
use App\Models\Restaurant;

class SubscriptionPricingService
{
    /**
     * @return array{amount: float, catalog_amount: float, has_negotiated_rate: bool, monthly_fee_for_tracking: float}
     */
    public function resolve(Restaurant $restaurant, string $tier, string $planType): array
    {
        $planType = $planType === 'yearly' ? 'yearly' : 'monthly';
        $prices = SuperAdminSettingsController::getPricingArray();
        $catalogKey = $planType === 'yearly' ? 'yearly' : 'monthly';
        $catalogAmount = (float) ($prices[$tier][$catalogKey] ?? 0);

        $restaurantTier = $restaurant->tier ?: 'basic';
        $restaurantPlan = $this->normalizePlanType($restaurant->subscription_plan);

        $matchesDeal = ($tier === $restaurantTier && $planType === $restaurantPlan);

        $storedAmount = $planType === 'yearly'
            ? (float) ($restaurant->yearly_price ?? 0)
            : (float) ($restaurant->monthly_price ?? 0);

        $amount = $catalogAmount;
        $hasNegotiated = false;

        if ($matchesDeal && $storedAmount > 0.009) {
            if (abs($storedAmount - $catalogAmount) > 0.01) {
                $hasNegotiated = true;
                $amount = $storedAmount;
            }
        }

        $amount = round($amount, 2);
        $catalogAmount = round($catalogAmount, 2);

        $monthlyFeeForTracking = $planType === 'yearly'
            ? round($amount / 12, 2)
            : $amount;

        return [
            'amount' => $amount,
            'catalog_amount' => $catalogAmount,
            'has_negotiated_rate' => $hasNegotiated,
            'monthly_fee_for_tracking' => $monthlyFeeForTracking,
        ];
    }

    /**
     * @param  array<string, mixed>|null  $prices  from getPricingArray(); omit to load fresh
     * @return array<string, mixed>
     */
    public function subscriptionPricingPayload(Restaurant $restaurant, ?array $prices = null): array
    {
        $prices = $prices ?? SuperAdminSettingsController::getPricingArray();
        $restaurantTier = $restaurant->tier ?: 'basic';
        $restaurantPlan = $this->normalizePlanType($restaurant->subscription_plan);

        $catalogMonthly = (float) ($prices[$restaurantTier]['monthly'] ?? 0);
        $catalogYearly = (float) ($prices[$restaurantTier]['yearly'] ?? 0);
        $yourMonthly = (float) ($restaurant->monthly_price ?? 0);
        $yourYearly = (float) ($restaurant->yearly_price ?? 0);

        $resolved = $this->resolve($restaurant, $restaurantTier, $restaurantPlan);

        return [
            'restaurant_tier' => $restaurantTier,
            'restaurant_plan' => $restaurantPlan,
            'catalog_monthly' => round($catalogMonthly, 2),
            'catalog_yearly' => round($catalogYearly, 2),
            'your_monthly' => round($yourMonthly, 2),
            'your_yearly' => round($yourYearly, 2),
            'has_negotiated_rate' => $resolved['has_negotiated_rate'],
        ];
    }

    private function normalizePlanType(?string $plan): string
    {
        $plan = strtolower((string) ($plan ?: 'monthly'));
        if (str_contains($plan, 'year') || $plan === 'annual') {
            return 'yearly';
        }

        return 'monthly';
    }
}
