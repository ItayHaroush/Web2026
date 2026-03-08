<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\DailyReport;
use App\Models\Restaurant;
use App\Models\User;
use App\Models\FcmToken;
use App\Models\MonitoringAlert;
use App\Services\FcmService;
use App\Mail\DailyReportMail;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class SendDailyReportNotificationsJob extends Command
{
    protected $signature = 'reports:send-notifications {--date= : תאריך הדוח (YYYY-MM-DD)}';
    protected $description = 'שליחת התראות על דוחות יומיים למסעדנים ולסופר אדמין';

    public function handle(): int
    {
        $date = $this->option('date')
            ? Carbon::parse($this->option('date'))->toDateString()
            : Carbon::now('Asia/Jerusalem')->subDay()->toDateString();

        $reports = DailyReport::withoutGlobalScopes()
            ->where('date', $date)
            ->with('restaurant')
            ->get();

        if ($reports->isEmpty()) {
            $this->info("אין דוחות לתאריך {$date}");
            return self::SUCCESS;
        }

        $fcm = app(FcmService::class);
        $sent = 0;
        $emailed = 0;
        $totalOrders = 0;
        $totalRevenue = 0;
        $activeRestaurants = 0;
        $failures = [];

        foreach ($reports as $report) {
            $restaurant = $report->restaurant;
            if (!$restaurant) continue;

            $activeRestaurants++;
            $totalOrders += $report->total_orders;
            $totalRevenue += (float) $report->total_revenue;

            // Push למסעדן
            $pushOk = $this->sendRestaurantPush($fcm, $restaurant, $report, $date);
            if ($pushOk) $sent++;
            else $failures[] = "Push failed: {$restaurant->name}";

            // Email למסעדן (אם מופעל)
            if ($restaurant->daily_report_email_enabled) {
                $emailOk = $this->sendRestaurantEmail($restaurant, $report);
                if ($emailOk) $emailed++;
                else $failures[] = "Email failed: {$restaurant->name}";
            }
        }

        // Push מסכם לסופר אדמין
        $this->sendSuperAdminSummary($fcm, $date, $activeRestaurants, $totalOrders, $totalRevenue);

        // התראה לסופר אדמין על תקלות
        if (!empty($failures)) {
            $this->notifySuperAdminFailures($date, $failures);
        }

        $this->info("נשלחו {$sent} התראות push, {$emailed} מיילים, וסיכום לסופר אדמין");
        Log::info("SendDailyReportNotifications: {$sent} push, {$emailed} emails for {$date}");

        return self::SUCCESS;
    }

    private function sendRestaurantPush(FcmService $fcm, Restaurant $restaurant, DailyReport $report, string $date): bool
    {
        try {
            $tokens = FcmToken::withoutGlobalScopes()
                ->where('tenant_id', $restaurant->tenant_id)
                ->pluck('token');

            if ($tokens->isEmpty()) return true; // no tokens = not a failure

            $title = "סיכום יומי - {$date}";
            $body = "{$report->total_orders} הזמנות | ₪" . number_format($report->total_revenue, 0)
                . " | איסוף: {$report->pickup_orders} | משלוח: {$report->delivery_orders}";

            foreach ($tokens as $token) {
                $fcm->sendToToken($token, $title, $body, [
                    'type' => 'daily_report',
                    'reportId' => (string) $report->id,
                    'date' => $date,
                ]);
            }
            return true;
        } catch (\Throwable $e) {
            Log::warning("Failed to send daily report push to {$restaurant->name}", ['error' => $e->getMessage()]);
            return false;
        }
    }

    private function sendRestaurantEmail(Restaurant $restaurant, DailyReport $report): bool
    {
        try {
            $email = $restaurant->daily_report_email ?: null;

            // fallback לבעל המסעדה
            if (!$email) {
                $owner = User::where('restaurant_id', $restaurant->id)
                    ->where('role', 'owner')
                    ->first();
                $email = $owner?->email;
            }

            if (!$email) return true; // no email configured = not a failure

            Mail::to($email)->send(new DailyReportMail($report));
            return true;
        } catch (\Throwable $e) {
            Log::warning("Failed to send daily report email to {$restaurant->name}", ['error' => $e->getMessage()]);
            return false;
        }
    }

    private function sendSuperAdminSummary(FcmService $fcm, string $date, int $restaurants, int $orders, float $revenue): void
    {
        try {
            $superAdmins = User::where('is_super_admin', true)->pluck('id');
            if ($superAdmins->isEmpty()) return;

            // אין tenant_id לסופר אדמין, מחפשים tokens לפי user
            $tokens = FcmToken::withoutGlobalScopes()
                ->whereIn('user_id', $superAdmins)
                ->pluck('token');

            // fallback: אם אין user_id בטוקנים, ננסה לפי tenant_id ריק
            if ($tokens->isEmpty()) {
                return;
            }

            $title = "דוח יומי מערכת - {$date}";
            $body = "{$restaurants} מסעדות פעילות | {$orders} הזמנות | ₪" . number_format($revenue, 0);

            foreach ($tokens as $token) {
                $fcm->sendToToken($token, $title, $body, [
                    'type' => 'system_daily_report',
                    'date' => $date,
                ]);
            }
        } catch (\Throwable $e) {
            Log::warning('Failed to send super admin daily summary', ['error' => $e->getMessage()]);
        }
    }

    private function notifySuperAdminFailures(string $date, array $failures): void
    {
        try {
            // יצירת התראה לסופר אדמין (ללא tenant — רשומה גלובלית)
            MonitoringAlert::withoutGlobalScopes()->create([
                'tenant_id' => '__system__',
                'restaurant_id' => 0,
                'alert_type' => 'daily_report_failure',
                'title' => "תקלה בשליחת דוחות יומיים — {$date}",
                'body' => count($failures) . " כשלונות:\n" . implode("\n", array_slice($failures, 0, 10)),
                'severity' => 'warning',
                'is_read' => false,
                'metadata' => ['date' => $date, 'failures' => $failures],
            ]);
        } catch (\Throwable $e) {
            Log::error('Failed to create super admin failure alert', ['error' => $e->getMessage()]);
        }
    }
}
