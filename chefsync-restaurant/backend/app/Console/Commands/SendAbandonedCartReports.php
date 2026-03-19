<?php

namespace App\Console\Commands;

use App\Mail\AbandonedCartReportMail;
use App\Models\CartSession;
use App\Models\Restaurant;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class SendAbandonedCartReports extends Command
{
    protected $signature = 'emails:abandoned-cart-reports
        {--month= : חודש (YYYY-MM), ברירת מחדל: חודש קודם}
        {--dry-run : הצגת מה ישלח בלי לשלוח}';

    protected $description = 'שליחת דוחות חודשיים על תזכורות סל נטוש והזמנות שנצלו לבעלי מסעדות';

    public function handle(): int
    {
        $monthOpt = $this->option('month');
        $dryRun = $this->option('dry-run');

        $month = $monthOpt
            ? Carbon::createFromFormat('Y-m', $monthOpt)->startOfMonth()
            : now()->subMonth()->startOfMonth();

        $monthEnd = $month->copy()->endOfMonth();
        $monthLabel = $month->format('F Y'); // e.g. "March 2025" — we can localize
        $monthLabelHe = $this->monthLabelHebrew($month);

        $this->info("דוחות תזכורות סל נטוש — חודש {$monthLabel} ({$month->format('Y-m')})");

        $restaurants = Restaurant::where('abandoned_cart_reminders_enabled', true)->get();

        $sent = 0;
        $skipped = 0;

        foreach ($restaurants as $restaurant) {
            $remindersSent = CartSession::where('restaurant_id', $restaurant->id)
                ->whereNotNull('reminded_at')
                ->whereBetween('reminded_at', [$month, $monthEnd])
                ->count();

            $savedSessions = CartSession::where('restaurant_id', $restaurant->id)
                ->whereNotNull('reminded_at')
                ->whereNotNull('completed_order_id')
                ->whereBetween('reminded_at', [$month, $monthEnd])
                ->with('order:id,total_amount')
                ->get();

            $savedOrders = $savedSessions->count();
            $savedRevenue = $savedSessions->sum(fn ($s) => (float) ($s->order?->total_amount ?? 0));

            // שליחה רק אם יש פעילות משמעותית (לפחות תזכורת אחת או הזמנה שנצלה)
            if ($remindersSent === 0 && $savedOrders === 0) {
                $skipped++;
                continue;
            }

            $owner = User::where('restaurant_id', $restaurant->id)
                ->where('role', 'owner')
                ->first();

            if (!$owner || !$owner->email) {
                $this->warn("  [SKIP] {$restaurant->name} — אין בעל/מייל");
                $skipped++;
                continue;
            }

            if ($dryRun) {
                $this->line("  [DRY-RUN] {$restaurant->name} → {$owner->email}: reminders={$remindersSent}, saved={$savedOrders}, revenue=₪" . number_format($savedRevenue, 0));
                $sent++;
                continue;
            }

            try {
                Mail::to($owner->email)->send(new AbandonedCartReportMail(
                    $restaurant,
                    $monthLabelHe,
                    $remindersSent,
                    $savedOrders,
                    $savedRevenue,
                ));
                $this->info("  [OK] {$restaurant->name} → {$owner->email}");
                $sent++;
            } catch (\Throwable $e) {
                Log::warning("Failed to send abandoned cart report to {$restaurant->name}", ['error' => $e->getMessage()]);
                $this->error("  [FAIL] {$restaurant->name} — {$e->getMessage()}");
            }
        }

        $this->info("נשלחו: {$sent}, דולגו: {$skipped}");
        return 0;
    }

    private function monthLabelHebrew(Carbon $month): string
    {
        $months = [
            1 => 'ינואר', 2 => 'פברואר', 3 => 'מרץ', 4 => 'אפריל',
            5 => 'מאי', 6 => 'יוני', 7 => 'יולי', 8 => 'אוגוסט',
            9 => 'ספטמבר', 10 => 'אוקטובר', 11 => 'נובמבר', 12 => 'דצמבר',
        ];
        $m = (int) $month->format('n');
        return ($months[$m] ?? $month->format('F')) . ' ' . $month->format('Y');
    }
}
