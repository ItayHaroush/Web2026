<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\FcmToken;
use App\Models\User;
use App\Models\Restaurant;
use App\Services\FcmService;

class NotificationsDiagnose extends Command
{
    protected $signature = 'notifications:diagnose
        {--test-send : שלח הודעת בדיקה למכשיר הראשון של סופר אדמין}';
    protected $description = 'אבחון מערכת ההתראות – FCM, טוקנים, מסעדות';

    public function handle(): int
    {
        $this->info('=== אבחון מערכת התראות ===');
        $this->newLine();

        // 1. FCM Config
        $this->section('הגדרות FCM');
        $projectId = config('fcm.project_id');
        $serviceAccountPath = config('fcm.service_account');
        $serviceAccountExists = $serviceAccountPath && file_exists($serviceAccountPath);

        $this->line("Project ID: <comment>{$projectId}</comment>");
        $this->line("Service account path: <comment>" . ($serviceAccountPath ?: '(לא הוגדר)') . "</comment>");
        $this->line("קובץ קיים: " . ($serviceAccountExists ? '<info>כן</info>' : '<error>לא</error>'));
        if (!$serviceAccountExists) {
            $this->error('יש להגדיר FCM_SERVICE_ACCOUNT ב-.env ולוודא שהקובץ קיים.');
        }
        $this->newLine();

        // 2. Super admin tokens
        $this->section('טוקני סופר אדמין');
        $superAdmins = User::where('is_super_admin', true)->get();
        $saTokens = FcmToken::withoutGlobalScopes()
            ->where('tenant_id', '__super_admin__')
            ->get();

        $this->line("סופר אדמינים: <comment>{$superAdmins->count()}</comment>");
        foreach ($superAdmins as $sa) {
            $userTokens = $saTokens->where('user_id', $sa->id);
            $this->line("  - {$sa->email} (id={$sa->id}): {$userTokens->count()} מכשירים");
        }
        $this->line("סה\"כ טוקנים סופר אדמין: <comment>{$saTokens->count()}</comment>");
        if ($saTokens->isEmpty()) {
            $this->warn('אין טוקנים רשומים. יש להיכנס לדשבורד סופר אדמין ולהפעיל התראות.');
        }
        $this->newLine();

        // 3. Restaurant tokens per tenant
        $this->section('טוקנים לפי מסעדות');
        $tenantCounts = FcmToken::withoutGlobalScopes()
            ->where('tenant_id', '!=', '__super_admin__')
            ->selectRaw('tenant_id, count(*) as cnt')
            ->groupBy('tenant_id')
            ->pluck('cnt', 'tenant_id');

        $totalRestaurantTokens = $tenantCounts->sum();
        $this->line("מסעדות עם טוקנים: <comment>{$tenantCounts->count()}</comment>");
        $this->line("סה\"כ טוקנים מסעדות: <comment>{$totalRestaurantTokens}</comment>");
        if ($tenantCounts->isNotEmpty()) {
            foreach ($tenantCounts->take(5) as $t => $c) {
                $this->line("  - {$t}: {$c}");
            }
            if ($tenantCounts->count() > 5) {
                $this->line("  ... ועוד " . ($tenantCounts->count() - 5));
            }
        }
        $this->newLine();

        // 4. Test send
        if ($this->option('test-send')) {
            $this->section('שליחת הודעת בדיקה');
            $firstToken = $saTokens->first();
            if (!$firstToken) {
                $this->error('אין טוקן לשליחה. יש להפעיל התראות בדשבורד סופר אדמין.');
                return self::FAILURE;
            }
            try {
                $fcm = app(FcmService::class);
                $ok = $fcm->sendToToken(
                    $firstToken->token,
                    'בדיקת התראות',
                    'זו הודעת בדיקה מפקודת php artisan notifications:diagnose --test-send',
                    ['type' => 'diagnose_test']
                );
                $this->line($ok ? '<info>ההודעה נשלחה בהצלחה.</info>' : '<error>שליחת ההודעה נכשלה. בדוק לוגים.</error>');
            } catch (\Throwable $e) {
                $this->error('שגיאה: ' . $e->getMessage());
            }
        } else {
            $this->line('לשליחת הודעת בדיקה: <comment>php artisan notifications:diagnose --test-send</comment>');
        }

        $this->newLine();
        $this->info('סיום אבחון.');
        return self::SUCCESS;
    }

    private function section(string $title): void
    {
        $this->line("<fg=bright-blue;options=bold>{$title}</>");
    }
}
