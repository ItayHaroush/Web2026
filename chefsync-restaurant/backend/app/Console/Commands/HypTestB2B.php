<?php

namespace App\Console\Commands;

use App\Models\Restaurant;
use App\Services\HypPaymentService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;

class HypTestB2B extends Command
{
    protected $signature = 'hyp:test-b2b
        {restaurant_id : ID של מסעדה קיימת ב-DB}
        {--step=pay : שלב: pay | status | charge}
        {--amount=0.01 : סכום לחיוב (ברירת מחדל 0.01)}';

    protected $description = 'בדיקת תשלום B2B מול HYP: תשלום ראשוני -> שמירת טוקן -> חיוב חוזר';

    public function handle(HypPaymentService $hypService): int
    {
        $restaurantId = $this->argument('restaurant_id');
        $step = $this->option('step');
        $amount = (float) $this->option('amount');

        $restaurant = Restaurant::withoutGlobalScope('tenant')->find($restaurantId);

        if (!$restaurant) {
            $this->error("מסעדה #{$restaurantId} לא נמצאה ב-DB.");
            return 1;
        }

        if (!$hypService->isConfigured()) {
            $this->error('HYP לא מוגדר. וודא שהזנת ב-.env:');
            $this->line('  HYP_MASOF=<מספר מסוף>');
            $this->line('  HYP_PASSP=<סיסמת API>');
            $this->line('  HYP_API_KEY=<מפתח API>');
            return 1;
        }

        return match ($step) {
            'pay'    => $this->stepPay($restaurant, $amount),
            'status' => $this->stepStatus($restaurant),
            'charge' => $this->stepCharge($restaurant, $hypService, $amount),
            default  => $this->invalidStep($step),
        };
    }

    /**
     * שלב 1: יצירת session ב-cache + הדפסת URL לפתיחה בדפדפן
     */
    private function stepPay(Restaurant $restaurant, float $amount): int
    {
        $cacheKey = "hyp_session:{$restaurant->id}";

        Cache::put($cacheKey, [
            'tier'        => 'basic',
            'plan_type'   => 'monthly',
            'amount'      => $amount,
            'client_name' => 'Test User',
            'email'       => 'test@test.com',
            'phone'       => '',
        ], now()->addMinutes(15));

        $backendUrl = rtrim(config('app.url', 'http://localhost:8000'), '/');
        $url = "{$backendUrl}/pay/hyp/subscription/{$restaurant->id}";

        $this->newLine();
        $this->info('=== שלב 1: תשלום ראשוני ===');
        $this->line("מסעדה: #{$restaurant->id} ({$restaurant->name})");
        $this->line("סכום:   ₪{$amount}");
        $this->line("Cache:   {$cacheKey} (תוקף 15 דקות)");
        $this->newLine();
        $this->warn('פתח את הקישור הבא בדפדפן ובצע תשלום:');
        $this->newLine();
        $this->line("  {$url}");
        $this->newLine();
        $this->info('אחרי תשלום מוצלח, הרץ:');
        $this->line("  php artisan hyp:test-b2b {$restaurant->id} --step=status");
        $this->newLine();

        return 0;
    }

    /**
     * שלב 2: בדיקה שהטוקן נשמר
     */
    private function stepStatus(Restaurant $restaurant): int
    {
        $this->newLine();
        $this->info('=== שלב 2: בדיקת סטטוס ===');
        $this->line("מסעדה: #{$restaurant->id} ({$restaurant->name})");
        $this->newLine();

        $token  = $restaurant->hyp_card_token;
        $expiry = $restaurant->hyp_card_expiry;
        $last4  = $restaurant->hyp_card_last4;
        $status = $restaurant->subscription_status;

        if (empty($token)) {
            $this->error('אין טוקן כרטיס שמור. ודא שהתשלום הושלם בהצלחה.');
            $this->line('בדוק ב-storage/logs/laravel.log אם יש שגיאות callback.');
            return 1;
        }

        $this->line("טוקן:    {$token}");
        $this->line("תוקף:    {$expiry}");
        $this->line("4 ספרות: {$last4}");
        $this->line("סטטוס:   {$status}");
        $this->newLine();
        $this->info('טוקן נמצא! אפשר להמשיך לשלב 3:');
        $this->line("  php artisan hyp:test-b2b {$restaurant->id} --step=charge --amount=0.01");
        $this->newLine();

        return 0;
    }

    /**
     * שלב 3: חיוב חוזר (soft) עם הטוקן השמור
     */
    private function stepCharge(Restaurant $restaurant, HypPaymentService $hypService, float $amount): int
    {
        $this->newLine();
        $this->info('=== שלב 3: חיוב חוזר (Soft Protocol) ===');

        $token  = $restaurant->hyp_card_token;
        $expiry = $restaurant->hyp_card_expiry;

        if (empty($token)) {
            $this->error('אין טוקן כרטיס. הרץ קודם --step=pay ו---step=status.');
            return 1;
        }

        $this->line("מסעדה:  #{$restaurant->id} ({$restaurant->name})");
        $this->line("טוקן:   {$token}");
        $this->line("תוקף:   {$expiry}");
        $this->line("סכום:   ₪{$amount}");
        $this->newLine();

        if (!$this->confirm('להמשיך לחיוב?')) {
            $this->warn('בוטל.');
            return 0;
        }

        $result = $hypService->chargeSoft(
            $amount,
            $token,
            $expiry,
            "TakeEat B2B Test Charge - {$restaurant->name}",
            ['name' => $restaurant->name]
        );

        $this->newLine();

        if ($result['success']) {
            $this->info('חיוב הצליח!');
            $this->line("Transaction ID: {$result['transaction_id']}");
            $this->line("CCode: {$result['ccode']}");
        } else {
            $this->error('חיוב נכשל!');
            $this->line("CCode: {$result['ccode']}");
            $this->line("Error:  {$result['error']}");
        }

        $this->newLine();
        return $result['success'] ? 0 : 1;
    }

    private function invalidStep(string $step): int
    {
        $this->error("שלב לא מוכר: {$step}");
        $this->line('שלבים אפשריים: pay, status, charge');
        return 1;
    }
}
