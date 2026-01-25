<?php

namespace App\Services;

use App\Models\Restaurant;
use App\Models\AiCredit;
use App\Models\AiUsageLog;
use Carbon\Carbon;

/**
 * Base AI Service with shared functionality for all AI providers
 */
abstract class BaseAiService
{
    /**
     * Get credit status for a restaurant (shared across all providers)
     */
    public static function getCreditsStatus(Restaurant $restaurant): array
    {
        $credits = AiCredit::getOrCreateForRestaurant($restaurant);
        $credits->checkAndResetIfNeeded();

        return [
            'tier' => $credits->tier,
            'monthly_limit' => $credits->monthly_limit,
            'credits_used' => $credits->credits_used,
            'credits_remaining' => $credits->credits_remaining,
            'billing_cycle_start' => $credits->billing_cycle_start->format('Y-m-d'),
            'billing_cycle_end' => $credits->billing_cycle_end->format('Y-m-d'),
            'total_requests' => $credits->total_requests,
        ];
    }

    /**
     * Get usage statistics for a restaurant (shared across all providers)
     */
    public static function getUsageStats(Restaurant $restaurant, $startDate = null, $endDate = null): array
    {
        // Convert strings to Carbon if needed
        if (is_string($startDate)) {
            $startDate = Carbon::parse($startDate);
        }
        if (is_string($endDate)) {
            $endDate = Carbon::parse($endDate);
        }

        $startDate = $startDate ?? now()->startOfMonth();
        $endDate = $endDate ?? now()->endOfMonth();

        $logs = AiUsageLog::where('restaurant_id', $restaurant->id)
            ->whereBetween('created_at', [$startDate, $endDate])
            ->get();

        return [
            'total_requests' => $logs->count(),
            'successful_requests' => $logs->where('status', 'success')->count(),
            'failed_requests' => $logs->where('status', 'error')->count(),
            'cached_requests' => $logs->where('cached', true)->count(),
            'cache_hit_rate' => $logs->count() > 0
                ? round($logs->where('cached', true)->count() / $logs->count() * 100, 1)
                : 0,
            'total_credits_used' => $logs->sum('credits_used'),
            'avg_response_time_ms' => $logs->avg('response_time_ms'),
            'by_feature' => $logs->groupBy('feature')->map(function ($items, $feature) {
                return [
                    'count' => $items->count(),
                    'success_rate' => $items->count() > 0
                        ? round($items->where('status', 'success')->count() / $items->count() * 100, 1)
                        : 0,
                ];
            }),
        ];
    }

    /**
     * Validate AI feature access and deduct credits
     * Shared validation logic for all providers
     */
    protected function validateAccess(string $feature, Restaurant $restaurant, $user): void
    {
        // Bypass 1: Dev Mode
        if (config('app.dev_mode')) {
            $this->logUsage(
                $feature,
                'validate',
                0,
                0,
                false,
                null,
                'success',
                null,
                null,
                ['bypass_reason' => 'dev_mode']
            );
            return;
        }

        // Bypass 2: Unlimited AI Users (super admin)
        if ($user && $user->ai_unlimited) {
            $this->logUsage(
                $feature,
                'validate',
                0,
                0,
                false,
                null,
                'success',
                null,
                null,
                ['bypass_reason' => 'ai_unlimited']
            );
            return;
        }

        // Normal validation
        $credits = AiCredit::getOrCreateForRestaurant($restaurant);
        $credits->checkAndResetIfNeeded();

        $costCredits = config("ai.features.{$feature}.cost_credits", 1);

        if (!$credits->hasCredits($costCredits)) {
            throw new \Exception("אין מספיק קרדיטים. נותרו {$credits->credits_remaining} קרדיטים.");
        }

        if (!$credits->isWithinRateLimit()) {
            throw new \Exception('חרגת ממגבלת השימוש לדקה. נסה שוב בעוד מעט.');
        }

        // Deduct credits
        $credits->useCredits($costCredits);
    }

    /**
     * Log AI usage to database
     * Shared logging logic for all providers
     */
    protected function logUsage(
        string $feature,
        string $action,
        int $creditsUsed,
        int $tokensUsed,
        bool $cached,
        ?string $cacheKey,
        string $status,
        ?string $errorMessage,
        ?int $responseTimeMs,
        ?array $metadata = null
    ): void {
        $tenantId = property_exists($this, 'tenantId') ? $this->{'tenantId'} : null;
        $restaurantId = property_exists($this, 'restaurant') ? $this->{'restaurant'}?->id : null;
        $userId = property_exists($this, 'user') ? $this->{'user'}?->id : null;

        AiUsageLog::create([
            'tenant_id' => $tenantId,
            'restaurant_id' => $restaurantId,
            'user_id' => $userId,
            'feature' => $feature,
            'action' => $action,
            'credits_used' => $creditsUsed,
            'tokens_used' => $tokensUsed,
            'cached' => $cached,
            'cache_key' => $cacheKey,
            'status' => $status,
            'error_message' => $errorMessage,
            'response_time_ms' => $responseTimeMs,
            'metadata' => $metadata ? json_encode($metadata) : null,
        ]);
    }
}
