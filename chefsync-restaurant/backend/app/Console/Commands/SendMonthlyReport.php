<?php

namespace App\Console\Commands;

use App\Mail\MonthlyReportMail;
use App\Http\Controllers\SuperAdminEmailController;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;

class SendMonthlyReport extends Command
{
    protected $signature = 'emails:monthly-report
                            {--month= : חודש בפורמט YYYY-MM (ברירת מחדל: חודש קודם)}
                            {--email= : כתובת מייל ספציפית (ברירת מחדל: כל סופר אדמינים)}
                            {--dry-run : הצגת הדוח בלי לשלוח}';

    protected $description = 'שליחת דוח חודשי לסופר אדמינים';

    public function handle(): int
    {
        $month = $this->option('month') ?? now()->subMonth()->format('Y-m');
        $specificEmail = $this->option('email');
        $dryRun = $this->option('dry-run');

        $this->info("מכין דוח חודשי עבור: {$month}");

        // איסוף נתוני הדוח
        $controller = app(SuperAdminEmailController::class);
        $reportData = $controller->gatherMonthlyReportData($month);

        $this->info('נתוני הדוח:');
        $this->table(
            ['מדד', 'ערך'],
            [
                ['מסעדות סה״כ', $reportData['total_restaurants']],
                ['פעילות', $reportData['active_restaurants']],
                ['בניסיון', $reportData['trial_restaurants']],
                ['חדשות', $reportData['new_restaurants']],
                ['הזמנות סה״כ', number_format($reportData['total_orders'])],
                ['הזמנות אתר', number_format($reportData['web_orders'] ?? 0)],
                ['הזמנות קיוסק', number_format($reportData['kiosk_orders'] ?? 0)],
                ['הכנסות סה״כ', number_format($reportData['total_revenue'], 2) . ' ₪'],
                ['הכנסות אתר', number_format($reportData['web_revenue'] ?? 0, 2) . ' ₪'],
                ['הכנסות קיוסק', number_format($reportData['kiosk_revenue'] ?? 0, 2) . ' ₪'],
                ['קיוסקים פעילים', $reportData['active_kiosks'] ?? 0],
                ['MRR', number_format($reportData['mrr'], 2) . ' ₪'],
                ['חשבוניות', $reportData['invoices_sent']],
                ['שולמו', $reportData['invoices_paid']],
            ],
        );

        // רשימת נמענים
        $recipients = [];
        if ($specificEmail) {
            $recipients[] = $specificEmail;
        } else {
            $superAdmins = User::where('is_super_admin', true)->pluck('email')->toArray();
            $recipients = array_filter($superAdmins);
        }

        if (empty($recipients)) {
            $this->error('לא נמצאו נמענים (סופר אדמינים)');
            return self::FAILURE;
        }

        $this->info('נמענים: ' . implode(', ', $recipients));

        if ($dryRun) {
            $this->warn('[DRY-RUN] לא נשלח — סיום');
            return self::SUCCESS;
        }

        $mailable = new MonthlyReportMail($month, $reportData);
        $sent = 0;
        $failed = 0;

        foreach ($recipients as $email) {
            try {
                Mail::to($email)->send(clone $mailable);
                $this->info("  → {$email} ✓");
                $sent++;
            } catch (\Exception $e) {
                $this->error("  → {$email} — שגיאה: {$e->getMessage()}");
                Log::error('Monthly report email failed', [
                    'month' => $month,
                    'email' => $email,
                    'error' => $e->getMessage(),
                ]);
                $failed++;
            }
        }

        $this->newLine();
        $this->info("סיכום: נשלחו {$sent}, נכשלו {$failed}");

        return self::SUCCESS;
    }
}
