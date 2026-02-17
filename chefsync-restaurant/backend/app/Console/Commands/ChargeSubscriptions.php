<?php

namespace App\Console\Commands;

use App\Mail\PaymentFailedMail;
use App\Mail\PaymentSuccessMail;
use App\Mail\SubscriptionSuspendedMail;
use App\Models\Restaurant;
use App\Models\RestaurantPayment;
use App\Models\RestaurantSubscription;
use App\Models\SystemSetting;
use App\Models\User;
use App\Services\HypPaymentService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class ChargeSubscriptions extends Command
{
    protected $signature = 'billing:charge-subscriptions {--dry-run : הצגת מה יחויב ללא חיוב בפועל}';

    protected $description = 'חיוב אוטומטי של מנויים פעילים שהגיע מועד החיוב שלהם';

    public function handle(HypPaymentService $hypService): int
    {
        $isDryRun = $this->option('dry-run');

        // Feature flag: ניתן לכבות חיוב מנויים לחלוטין דרך קונפיג/ENV
        if (!config('payment.subscription_billing_enabled')) {
            $this->warn('חיוב מנויים (B2B) כבוי לפי SUBSCRIPTION_BILLING_ENABLED – דילוג.');
            Log::info('billing:charge-subscriptions skipped: subscription_billing_enabled=false');
            return 0;
        }

        if (!$hypService->isConfigured()) {
            $this->warn('HYP לא מוגדר – דילוג על חיוב אוטומטי.');
            Log::warning('billing:charge-subscriptions: HYP not configured, skipping.');
            return 0;
        }

        // שלב 1: חיוב מסעדות שהגיע מועד next_charge_at
        $subscriptions = RestaurantSubscription::with('restaurant')
            ->where('status', 'active')
            ->where('next_charge_at', '<=', now())
            ->get();

        $this->info("נמצאו {$subscriptions->count()} מנויים לחיוב.");
        $charged = 0;
        $failed = 0;
        $skipped = 0;

        foreach ($subscriptions as $subscription) {
            $restaurant = $subscription->restaurant;

            if (!$restaurant) {
                $this->warn("מנוי #{$subscription->id}: מסעדה לא נמצאה – דילוג.");
                $skipped++;
                continue;
            }

            if (empty($restaurant->hyp_card_token)) {
                $this->warn("מסעדה #{$restaurant->id} ({$restaurant->name}): אין טוקן כרטיס – דילוג.");
                Log::info('billing:charge-subscriptions: no card token', ['restaurant_id' => $restaurant->id]);
                $skipped++;
                continue;
            }

            $amount = (float) $subscription->monthly_fee;

            if ($amount <= 0) {
                $this->warn("מסעדה #{$restaurant->id}: monthly_fee = 0 – דילוג.");
                $skipped++;
                continue;
            }

            if ($isDryRun) {
                $this->line("  [DRY RUN] מסעדה #{$restaurant->id} ({$restaurant->name}) – ₪{$amount}");
                continue;
            }

            // חיוב
            $result = $hypService->chargeSoft(
                $amount,
                $restaurant->hyp_card_token,
                $restaurant->hyp_card_expiry ?? '',
                "TakeEat מנוי חודשי - {$restaurant->name}",
                ['name' => $restaurant->name]
            );

            if ($result['success']) {
                $this->handleChargeSuccess($restaurant, $subscription, $amount, $result['transaction_id']);
                $charged++;
                $this->info("  מסעדה #{$restaurant->id} ({$restaurant->name}) – חויב ₪{$amount} בהצלחה.");
            } else {
                $this->handleChargeFailure($restaurant, $subscription, $result['error'] ?? 'Unknown error');
                $failed++;
                $this->error("  מסעדה #{$restaurant->id} ({$restaurant->name}) – חיוב נכשל: {$result['error']}");
            }
        }

        // שלב 2: השעיית מסעדות שעבר grace period
        $this->suspendExpiredGracePeriod();

        $this->info("סיכום: חויבו {$charged}, נכשלו {$failed}, דולגו {$skipped}.");
        Log::info('billing:charge-subscriptions completed', compact('charged', 'failed', 'skipped'));

        return 0;
    }

    private function handleChargeSuccess(Restaurant $restaurant, RestaurantSubscription $subscription, float $amount, string $transactionId): void
    {
        $periodStart = now()->startOfDay();
        $periodEnd = $periodStart->copy()->addMonth();

        RestaurantPayment::create([
            'restaurant_id' => $restaurant->id,
            'amount'        => $amount,
            'currency'      => 'ILS',
            'period_start'  => $periodStart,
            'period_end'    => $periodEnd,
            'paid_at'       => now(),
            'method'        => 'hyp_recurring',
            'reference'     => $transactionId,
            'status'        => 'paid',
        ]);

        $subscription->update([
            'next_charge_at' => $periodEnd,
            'last_paid_at'   => now(),
        ]);

        $restaurant->update([
            'subscription_ends_at'  => $periodEnd,
            'last_payment_at'       => now(),
            'next_payment_at'       => $periodEnd,
            'payment_failed_at'     => null,
            'payment_failure_count' => 0,
        ]);

        // שליחת מייל
        $owner = User::where('restaurant_id', $restaurant->id)->first();
        if ($owner?->email) {
            try {
                Mail::to($owner->email)->send(new PaymentSuccessMail(
                    $restaurant,
                    $amount,
                    $restaurant->hyp_card_last4 ?? '****',
                    $periodEnd,
                ));
            } catch (\Exception $e) {
                Log::error('PaymentSuccessMail failed', ['restaurant_id' => $restaurant->id, 'error' => $e->getMessage()]);
            }
        }
    }

    private function handleChargeFailure(Restaurant $restaurant, RestaurantSubscription $subscription, string $reason): void
    {
        $failureCount = ($restaurant->payment_failure_count ?? 0) + 1;
        $failedAt = $restaurant->payment_failed_at ?? now();

        $restaurant->update([
            'payment_failed_at'     => $failedAt,
            'payment_failure_count' => $failureCount,
        ]);

        Log::warning('billing:charge-subscriptions: charge failed', [
            'restaurant_id' => $restaurant->id,
            'failure_count' => $failureCount,
            'reason'        => $reason,
        ]);

        $graceDays = (int) SystemSetting::get('grace_period_days', 3);
        $daysLeft = max(0, $graceDays - (int) now()->diffInDays($failedAt));

        $owner = User::where('restaurant_id', $restaurant->id)->first();
        if ($owner?->email) {
            try {
                Mail::to($owner->email)->send(new PaymentFailedMail(
                    $restaurant,
                    $reason,
                    $daysLeft,
                ));
            } catch (\Exception $e) {
                Log::error('PaymentFailedMail failed', ['restaurant_id' => $restaurant->id, 'error' => $e->getMessage()]);
            }
        }
    }

    private function suspendExpiredGracePeriod(): void
    {
        $graceDays = (int) SystemSetting::get('grace_period_days', 3);

        $expiredRestaurants = Restaurant::withoutGlobalScope('tenant')
            ->whereNotNull('payment_failed_at')
            ->where('payment_failed_at', '<=', now()->subDays($graceDays))
            ->where('subscription_status', 'active')
            ->get();

        foreach ($expiredRestaurants as $restaurant) {
            $restaurant->update([
                'subscription_status' => 'suspended',
            ]);

            $subscription = $restaurant->subscription;
            if ($subscription) {
                $subscription->update(['status' => 'suspended']);
            }

            Log::warning('billing:charge-subscriptions: restaurant suspended', [
                'restaurant_id' => $restaurant->id,
                'failed_at'     => $restaurant->payment_failed_at,
            ]);

            $owner = User::where('restaurant_id', $restaurant->id)->first();
            if ($owner?->email) {
                try {
                    Mail::to($owner->email)->send(new SubscriptionSuspendedMail($restaurant));
                } catch (\Exception $e) {
                    Log::error('SubscriptionSuspendedMail failed', ['restaurant_id' => $restaurant->id, 'error' => $e->getMessage()]);
                }
            }

            $this->warn("  מסעדה #{$restaurant->id} ({$restaurant->name}) – הושעתה (grace period עבר).");
        }

        if ($expiredRestaurants->count() > 0) {
            $this->info("הושעו {$expiredRestaurants->count()} מסעדות.");
        }
    }
}
