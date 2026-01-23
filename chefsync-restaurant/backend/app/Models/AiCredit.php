<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Carbon\Carbon;

class AiCredit extends Model
{
    protected $fillable = [
        'tenant_id',
        'restaurant_id',
        'tier',
        'monthly_limit',
        'credits_used',
        'credits_remaining',
        'billing_cycle_start',
        'billing_cycle_end',
        'last_reset_at',
        'requests_this_minute',
        'minute_window_start',
        'total_credits_used',
        'total_requests',
    ];

    protected $casts = [
        'monthly_limit' => 'integer',
        'credits_used' => 'integer',
        'credits_remaining' => 'integer',
        'requests_this_minute' => 'integer',
        'total_credits_used' => 'integer',
        'total_requests' => 'integer',
        'billing_cycle_start' => 'date',
        'billing_cycle_end' => 'date',
        'last_reset_at' => 'datetime',
        'minute_window_start' => 'datetime',
    ];

    /**
     * Get the restaurant that owns these credits
     */
    public function restaurant(): BelongsTo
    {
        return $this->belongsTo(Restaurant::class);
    }

    /**
     * Check if credits are available
     */
    public function hasCredits(int $amount = 1): bool
    {
        return $this->credits_remaining >= $amount;
    }

    /**
     * Check if within rate limit
     */
    public function isWithinRateLimit(): bool
    {
        $maxPerMinute = config('copilot.rate_limit.per_minute', 10);

        // Reset minute window if needed
        if (
            $this->minute_window_start === null ||
            Carbon::parse($this->minute_window_start)->addMinute()->isPast()
        ) {
            $this->resetMinuteWindow();
            return true;
        }

        return $this->requests_this_minute < $maxPerMinute;
    }

    /**
     * Use credits
     */
    public function useCredits(int $amount = 1): bool
    {
        if (!$this->hasCredits($amount)) {
            return false;
        }

        $this->increment('credits_used', $amount);
        $this->decrement('credits_remaining', $amount);
        $this->increment('total_credits_used', $amount);
        $this->increment('total_requests');
        $this->increment('requests_this_minute');

        // Initialize minute window if needed
        if ($this->minute_window_start === null) {
            $this->minute_window_start = now();
            $this->save();
        }

        return true;
    }

    /**
     * Reset minute window for rate limiting
     */
    public function resetMinuteWindow(): void
    {
        $this->update([
            'requests_this_minute' => 0,
            'minute_window_start' => now(),
        ]);
    }

    /**
     * Reset monthly credits
     */
    public function resetMonthlyCredits(): void
    {
        $tier = $this->tier;
        $monthlyLimit = config("copilot.credits.{$tier}_tier", 20);

        $this->update([
            'credits_used' => 0,
            'credits_remaining' => $monthlyLimit,
            'monthly_limit' => $monthlyLimit,
            'billing_cycle_start' => now()->startOfMonth(),
            'billing_cycle_end' => now()->endOfMonth(),
            'last_reset_at' => now(),
        ]);
    }

    /**
     * Check if billing cycle has ended and reset if needed
     */
    public function checkAndResetIfNeeded(): void
    {
        if (Carbon::parse($this->billing_cycle_end)->isPast()) {
            $this->resetMonthlyCredits();
        }
    }

    /**
     * Scope to find by tenant
     */
    public function scopeTenant($query, string $tenantId)
    {
        return $query->where('tenant_id', $tenantId);
    }

    /**
     * Get or create credits for a restaurant
     */
    public static function getOrCreateForRestaurant(Restaurant $restaurant): self
    {
        return self::firstOrCreate(
            [
                'tenant_id' => $restaurant->tenant_id,
                'restaurant_id' => $restaurant->id,
            ],
            [
                'tier' => 'free', // Default tier
                'monthly_limit' => config('copilot.credits.free_tier', 20),
                'credits_used' => 0,
                'credits_remaining' => config('copilot.credits.free_tier', 20),
                'billing_cycle_start' => now()->startOfMonth(),
                'billing_cycle_end' => now()->endOfMonth(),
                'total_credits_used' => 0,
                'total_requests' => 0,
            ]
        );
    }
}
