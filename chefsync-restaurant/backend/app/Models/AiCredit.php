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
        if ($this->monthly_limit === 0 && $this->tier === 'enterprise') {
            return true;
        }

        return $this->credits_remaining >= $amount;
    }

    /**
     * Backward compatibility alias
     */
    public function hasCreditsRemaining(int $amount = 1): bool
    {
        return $this->hasCredits($amount);
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
        // שמור את המגבלה החודשית הקיימת - לא לקחת מ-config!
        $monthlyLimit = $this->monthly_limit;

        // אם monthly_limit לא הוגדר, אז ננסה מהמסעדה או מה-config
        if ($monthlyLimit === null || $monthlyLimit <= 0) {
            $tier = $this->tier ?? 'free';
            $monthlyLimit = config("copilot.credits.{$tier}_tier", 20);
        }

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
    public static function getOrCreateForRestaurant(?Restaurant $restaurant): self
    {
        if (!$restaurant) {
            return self::firstOrCreate(
                [
                    'tenant_id' => 'super-admin',
                    'restaurant_id' => null,
                ],
                [
                    'tier' => 'enterprise',
                    'monthly_limit' => 0,
                    'credits_used' => 0,
                    'credits_remaining' => 0,
                    'billing_cycle_start' => now()->startOfMonth(),
                    'billing_cycle_end' => now()->endOfMonth(),
                    'total_credits_used' => 0,
                    'total_requests' => 0,
                ]
            );
        }

        // קביעת tier ו-limit לפי מנוי המסעדה
        $tier = $restaurant->tier ?? 'basic';
        $monthlyLimit = $restaurant->ai_credits_monthly;

        // במידה ולא הוגדר ai_credits_monthly, נשתמש בערכי ברירת מחדל
        if ($monthlyLimit === null || $monthlyLimit <= 0) {
            $normalizedTier = match ($tier) {
                'basic', 'free' => 'free',
                'pro' => 'pro',
                'enterprise' => 'enterprise',
                default => 'free',
            };

            $monthlyLimit = match ($normalizedTier) {
                'pro' => (int) config('copilot.credits.pro_tier', 300),
                'enterprise' => 0,
                default => (int) config('copilot.credits.free_tier', 20),
            };
            $tier = $normalizedTier;
        }

        // בדוק אם כבר קיים
        $existing = self::where('tenant_id', $restaurant->tenant_id)
            ->where('restaurant_id', $restaurant->id)
            ->first();

        if ($existing) {
            // עדכן רק tier ו-monthly_limit, אבל שמור את credits_remaining הנוכחי
            $existing->update([
                'tier' => $tier,
                'monthly_limit' => $monthlyLimit,
            ]);
            return $existing;
        }

        // אם לא קיים - צור חדש
        return self::create([
            'tenant_id' => $restaurant->tenant_id,
            'restaurant_id' => $restaurant->id,
            'tier' => $tier,
            'monthly_limit' => $monthlyLimit,
            'credits_used' => 0,
            'credits_remaining' => $monthlyLimit,
            'billing_cycle_start' => now()->startOfMonth(),
            'billing_cycle_end' => now()->endOfMonth(),
            'total_credits_used' => 0,
            'total_requests' => 0,
        ]);
    }
}
