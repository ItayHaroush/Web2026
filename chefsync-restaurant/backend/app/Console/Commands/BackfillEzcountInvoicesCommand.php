<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Models\Restaurant;
use App\Services\EZcountService;
use Illuminate\Console\Command;

/**
 * Backfill חד-פעמי — חשבוניות EZcount להזמנות קיימות.
 * רק הזמנות HYP אמיתיות (אתר) — לא קופה/POS שסומנו ידנית כאשראי.
 *
 * סינון: payment_transaction_id קיים (= עבר דרך HYP),
 *         source לא pos/kiosk, לא סומן ידנית (marked_paid_by).
 *
 * php artisan ezcount:backfill-invoices --dry-run
 * php artisan ezcount:backfill-invoices --restaurant=5
 * php artisan ezcount:backfill-invoices --limit=10
 */
class BackfillEzcountInvoicesCommand extends Command
{
    protected $signature = 'ezcount:backfill-invoices
                            {--restaurant= : ID של מסעדה ספציפית}
                            {--dry-run : הצגה בלבד ללא יצירת חשבוניות}
                            {--limit=0 : הגבלת מספר הזמנות לעיבוד}';

    protected $description = 'יצירת חשבוניות EZcount להזמנות קיימות ששולמו באשראי ועדיין אין להן חשבונית';

    public function handle(EZcountService $ezcountService): int
    {
        $dryRun = $this->option('dry-run');
        $restaurantId = $this->option('restaurant');
        $limit = (int) $this->option('limit');

        // מצא מסעדות שמפעילות EZcount ויש להן API key
        $restaurantQuery = Restaurant::withoutGlobalScope('tenant')
            ->where('ezcount_invoices_enabled', true)
            ->whereNotNull('ezcount_api_key')
            ->where('ezcount_api_key', '!=', '');

        if ($restaurantId) {
            $restaurantQuery->where('id', $restaurantId);
        }

        $restaurants = $restaurantQuery->get();

        if ($restaurants->isEmpty()) {
            $this->warn('לא נמצאו מסעדות עם EZcount מופעל ומפתח API.');
            return 0;
        }

        $this->info("נמצאו {$restaurants->count()} מסעדות עם EZcount מופעל.");

        $totalProcessed = 0;
        $totalSuccess = 0;
        $totalFailed = 0;
        $totalSkipped = 0;

        foreach ($restaurants as $restaurant) {
            $this->newLine();
            $this->info("=== מסעדה: {$restaurant->name} (ID: {$restaurant->id}) ===");

            // הזמנות HYP אמיתיות בלבד — לא קופה/POS/kiosk, לא סימון ידני
            $ordersQuery = Order::withoutGlobalScope('tenant')
                ->where('restaurant_id', $restaurant->id)
                ->where('payment_status', Order::PAYMENT_PAID)
                ->where('payment_method', 'credit_card')
                ->whereNull('invoice_number')
                // רק עסקאות HYP אמיתיות — יש transaction ID
                ->whereNotNull('payment_transaction_id')
                ->where('payment_transaction_id', '!=', '')
                // לא קופה / kiosk — אשראי מדומה
                ->where(function ($q) {
                    $q->whereNull('source')
                      ->orWhereNotIn('source', ['pos', 'kiosk']);
                })
                // לא סומן ידנית כשולם ע"י עובד קופה
                ->whereNull('marked_paid_by')
                ->orderBy('id');

            if ($limit > 0) {
                $ordersQuery->limit($limit - $totalProcessed);
            }

            $orders = $ordersQuery->get();

            if ($orders->isEmpty()) {
                $this->line("  אין הזמנות לעיבוד.");
                continue;
            }

            $this->line("  נמצאו {$orders->count()} הזמנות ללא חשבונית.");

            foreach ($orders as $order) {
                $totalProcessed++;

                if ($dryRun) {
                    $this->line("  [DRY-RUN] הזמנה #{$order->id} | ₪{$order->total_amount} | Trans: {$order->payment_transaction_id}");
                    continue;
                }

                // בדיקה שוב שאין חשבונית (למניעת כפילויות בריצה מקבילית)
                $order->refresh();
                if ($order->invoice_number) {
                    $totalSkipped++;
                    $this->line("  [SKIP] הזמנה #{$order->id} — כבר יש חשבונית: {$order->invoice_number}");
                    continue;
                }

                $result = $ezcountService->createInvoice(
                    $restaurant,
                    $order,
                    $order->payment_transaction_id,
                );

                if ($result['success']) {
                    $order->update([
                        'invoice_number' => $result['doc_number'],
                        'invoice_pdf_url' => $result['pdf_link'],
                        'invoice_generated_at' => now(),
                    ]);
                    $totalSuccess++;
                    $this->line("  [OK] הזמנה #{$order->id} → חשבונית {$result['doc_number']}");
                } else {
                    $totalFailed++;
                    $this->error("  [FAIL] הזמנה #{$order->id} → {$result['error']}");
                }

                // השהייה קצרה למניעת rate limit
                usleep(300_000); // 300ms

                if ($limit > 0 && $totalProcessed >= $limit) {
                    $this->warn("הגעת למגבלת הזמנות ({$limit}).");
                    break 2;
                }
            }
        }

        $this->newLine();
        $this->info("=== סיכום ===");
        $this->line("עובדו: {$totalProcessed}");
        if (!$dryRun) {
            $this->line("הצליחו: {$totalSuccess}");
            $this->line("נכשלו: {$totalFailed}");
            $this->line("דולגו: {$totalSkipped}");
        }

        return $totalFailed > 0 ? 1 : 0;
    }
}
