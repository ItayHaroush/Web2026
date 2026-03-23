<?php

namespace App\Console\Commands;

use App\Mail\TrialExpiringMail;
use App\Mail\TrialInfoMail;
use App\Models\EmailMarketingSuppression;
use App\Models\Order;
use App\Models\Restaurant;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class SendTrialEmails extends Command
{
    protected $signature = 'emails:trial {--dry-run : הצגת מה ישלח בלי לשלוח בפועל}';

    protected $description = 'שליחת מיילי ניסיון (מידע + תזכורות) למסעדות בתקופת ניסיון';

    public function handle(): int
    {
        $dryRun = $this->option('dry-run');
        $sent = 0;
        $skipped = 0;
        $failed = 0;

        $trialRestaurants = Restaurant::where('subscription_status', 'trial')
            ->whereNotNull('trial_ends_at')
            ->get();

        $this->info("נמצאו {$trialRestaurants->count()} מסעדות בניסיון");

        $delaySeconds = max(0, (int) config('mail.bulk_delay_seconds', 2));
        $priorSendAttempt = false;

        foreach ($trialRestaurants as $restaurant) {
            $owner = User::where('restaurant_id', $restaurant->id)
                ->where('role', 'owner')
                ->first();

            if (! $owner || ! $owner->email) {
                $this->warn("  [{$restaurant->name}] אין בעלים / אימייל — דילוג");
                $skipped++;

                continue;
            }

            if (EmailMarketingSuppression::isSuppressed($owner->email)) {
                $this->warn("  [{$restaurant->name}] אימייל ביטל שיווק — דילוג");
                $skipped++;

                continue;
            }

            $daysSinceCreation = (int) $restaurant->created_at->diffInDays(now());
            $daysUntilExpiry = max(0, (int) now()->diffInDays($restaurant->trial_ends_at, false));

            $mailable = null;
            $emailType = null;

            // יום 3 — מידע ראשוני
            if ($daysSinceCreation === 3) {
                $stats = $this->getRestaurantStats($restaurant);
                $mailable = new TrialInfoMail($restaurant, 3, $stats, $owner->email);
                $emailType = 'trial_info_day3';
            }
            // יום 7 — מידע משלים
            elseif ($daysSinceCreation === 7) {
                $stats = $this->getRestaurantStats($restaurant);
                $mailable = new TrialInfoMail($restaurant, 7, $stats, $owner->email);
                $emailType = 'trial_info_day7';
            }
            // 3 ימים לפני סיום
            elseif ($daysUntilExpiry === 3) {
                $usageSummary = $this->getUsageSummary($restaurant);
                $mailable = new TrialExpiringMail($restaurant, 3, $usageSummary, $owner->email);
                $emailType = 'trial_expiring_3days';
            }
            // יום לפני סיום
            elseif ($daysUntilExpiry === 1) {
                $usageSummary = $this->getUsageSummary($restaurant);
                $mailable = new TrialExpiringMail($restaurant, 1, $usageSummary, $owner->email);
                $emailType = 'trial_expiring_1day';
            }

            if ($mailable === null) {
                continue;
            }

            if ($dryRun) {
                $this->info("  [DRY-RUN] {$restaurant->name} → {$owner->email} ({$emailType})");
                $sent++;

                continue;
            }

            try {
                if ($priorSendAttempt && $delaySeconds > 0) {
                    usleep($delaySeconds * 1_000_000);
                }

                Mail::to($owner->email)->send($mailable);
                $this->info("  [{$restaurant->name}] → {$owner->email} ({$emailType}) ✓");
                $sent++;
            } catch (\Exception $e) {
                $this->error("  [{$restaurant->name}] → {$owner->email} — שגיאה: {$e->getMessage()}");
                Log::error('Trial email failed', [
                    'restaurant_id' => $restaurant->id,
                    'email' => $owner->email,
                    'type' => $emailType,
                    'error' => $e->getMessage(),
                ]);
                $failed++;
            }
            $priorSendAttempt = true;
        }

        $this->newLine();
        $prefixLabel = $dryRun ? '[DRY-RUN] ' : '';
        $this->info("{$prefixLabel}סיכום: נשלחו {$sent}, דולגו {$skipped}, נכשלו {$failed}");

        return self::SUCCESS;
    }

    private function getRestaurantStats(Restaurant $restaurant): array
    {
        $ordersQuery = Order::where('restaurant_id', $restaurant->id)->where('is_test', false);

        return [
            'categories' => $restaurant->categories()->count(),
            'menu_items' => $restaurant->menuItems()->count(),
            'orders' => (clone $ordersQuery)->count(),
            'web_orders' => (clone $ordersQuery)->where('source', 'web')->count(),
            'kiosk_orders' => (clone $ordersQuery)->where('source', 'kiosk')->count(),
        ];
    }

    private function getUsageSummary(Restaurant $restaurant): array
    {
        $ordersQuery = Order::where('restaurant_id', $restaurant->id)->where('is_test', false);

        return [
            'orders' => (clone $ordersQuery)->count(),
            'web_orders' => (clone $ordersQuery)->where('source', 'web')->count(),
            'kiosk_orders' => (clone $ordersQuery)->where('source', 'kiosk')->count(),
            'menu_items' => $restaurant->menuItems()->count(),
        ];
    }
}
