<?php

namespace App\Console\Commands;

use App\Models\CartSession;
use App\Models\NotificationLog;
use App\Models\Restaurant;
use App\Services\SmsService;
use App\Services\PhoneValidationService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class SendAbandonedCartReminders extends Command
{
    protected $signature = 'reminders:abandoned-cart
        {--dry-run : הצגת מה ישלח בלי לשלוח}
        {--min-minutes=10 : דקות מינימום של חוסר פעילות (חלון התחלה)}
        {--max-minutes=20 : דקות מקסימום — לא שולח אחרי (לקוח אבוד)}';

    protected $description = 'שליחת תזכורת SMS אחת לסלי נטוש — חלון 10–20 דק׳, תנאים חכמים';

    private const MIN_SHEKEL = 50;
    private const MIN_ITEMS = 2;

    public function handle(): int
    {
        $dryRun = $this->option('dry-run');
        $minMinutes = (int) $this->option('min-minutes');
        $maxMinutes = (int) $this->option('max-minutes');

        $cutoffMin = now()->subMinutes($maxMinutes); // לא שלח אם עברו יותר מ־20 דק׳
        $cutoffMax = now()->subMinutes($minMinutes);  // לא שלח אם פחות מ־10 דק׳

        $sessions = CartSession::whereNull('reminded_at')
            ->whereNull('completed_order_id')
            ->where('updated_at', '>=', $cutoffMin)
            ->where('updated_at', '<=', $cutoffMax)
            ->where(function ($q) {
                $q->whereNotNull('customer_phone')->where('customer_phone', '!=', '')
                    ->orWhereNotNull('customer_id');
            })
            ->with([
                'restaurant:id,name,tenant_id,abandoned_cart_reminders_enabled,abandoned_cart_sms_balance,tier,is_approved,is_override_status,is_open,operating_days,operating_hours',
                'customer:id,phone',
            ])
            ->get();

        $sent = 0;
        $skipped = 0;
        $failed = 0;

        foreach ($sessions as $session) {
            $restaurant = $session->restaurant;
            if (!$restaurant || !$restaurant->abandoned_cart_reminders_enabled) {
                $skipped++;
                continue;
            }

            $balance = (int) ($restaurant->abandoned_cart_sms_balance ?? 0);
            if ($balance <= 0) {
                $skipped++;
                continue;
            }

            if (!($restaurant->is_open_now ?? false)) {
                $skipped++;
                continue;
            }

            $totalAmount = (float) ($session->total_amount ?? 0);
            if ($totalAmount < self::MIN_SHEKEL) {
                $skipped++;
                continue;
            }

            $cartData = $session->cart_data;
            $itemCount = is_array($cartData) ? count($cartData) : 0;
            if ($itemCount < self::MIN_ITEMS) {
                $skipped++;
                continue;
            }

            $phone = $session->customer_phone;
            if (!$phone && $session->customer_id) {
                $customer = $session->customer;
                $phone = $customer?->phone;
            }
            if (!$phone) {
                $skipped++;
                continue;
            }

            $normalized = PhoneValidationService::normalizeIsraeliMobileE164($phone);
            if (!$normalized) {
                $skipped++;
                continue;
            }

            $cartUrl = rtrim(config('app.frontend_url', 'https://www.takeeat.co.il'), '/')
                . '/' . $restaurant->tenant_id . '/cart';
            $message = "הסל שלך מחכה 🙂 {$restaurant->name} — 2 קליקים וזה אצלך: {$cartUrl}";

            if ($dryRun) {
                $this->info("  [DRY-RUN] {$restaurant->name} → {$phone} (₪{$totalAmount}, {$itemCount} פריטים)");
                $sent++;
                continue;
            }

            try {
                $ok = SmsService::sendPlainText($normalized, $message);
                if ($ok) {
                    $session->update(['reminded_at' => now()]);
                    $restaurant->decrement('abandoned_cart_sms_balance');
                    $phoneMasked = $this->maskPhone($phone);
                    NotificationLog::create([
                        'channel' => 'system',
                        'type' => 'abandoned_cart_sms',
                        'title' => "תזכורת סל נטוש — {$restaurant->name}",
                        'body' => "נשלחה ל־{$phoneMasked}, סל בשווי ₪" . number_format($totalAmount, 0),
                        'sender_id' => null,
                        'target_restaurant_ids' => [$restaurant->id],
                        'tokens_targeted' => 0,
                        'sent_ok' => 0,
                        'metadata' => [
                            'cart_session_id' => $session->id,
                            'phone_masked' => $phoneMasked,
                            'total_amount' => $totalAmount,
                            'item_count' => $itemCount,
                        ],
                    ]);
                    $sent++;
                } else {
                    $failed++;
                }
            } catch (\Throwable $e) {
                Log::error('Abandoned cart SMS failed', [
                    'session_id' => $session->id,
                    'error' => $e->getMessage(),
                ]);
                $failed++;
            }
        }

        $this->info("תזכורות סל נטוש: נשלחו {$sent}, דולגו {$skipped}, נכשלו {$failed}");
        return 0;
    }

    private function maskPhone(string $phone): string
    {
        $digits = preg_replace('/\D/', '', $phone);
        $len = strlen($digits);
        if ($len >= 4) {
            return '05x-***-**' . substr($digits, -4);
        }
        return '05x-***-****';
    }
}
