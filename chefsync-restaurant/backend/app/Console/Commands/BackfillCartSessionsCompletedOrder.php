<?php

namespace App\Console\Commands;

use App\Models\CartSession;
use App\Models\Order;
use Illuminate\Console\Command;

/**
 * מריץ מחדש את לוגיקת קישור סל נטוש להזמנה (כמו ביצירת הזמנה) על היסטוריה —
 * מתאים אחרי תיקון ב-markCompletedForB2COrder או נתונים שלא סומנו בזמן אמת.
 */
class BackfillCartSessionsCompletedOrder extends Command
{
    protected $signature = 'cart-sessions:backfill-completed-order
        {--dry-run : הצגת מה יעודכן בלי לכתוב ל-DB}
        {--from-id= : התחל מהזמנות ממזהה id זה ומעלה (כולל)}';

    protected $description = 'קישור רטרואקטיבי של cart_sessions.completed_order_id להזמנות B2C תקפות';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $fromId = $this->option('from-id');
        $fromIdInt = $fromId !== null && $fromId !== '' ? (int) $fromId : null;

        $query = Order::query()
            ->where('is_test', false)
            ->where('status', '!=', Order::STATUS_CANCELLED)
            ->where(function ($q) {
                $q->where('payment_method', '!=', 'credit_card')
                    ->orWhere('payment_status', Order::PAYMENT_PAID);
            })
            ->orderBy('id');

        if ($fromIdInt !== null && $fromIdInt > 0) {
            $query->where('id', '>=', $fromIdInt);
        }

        $ordersCount = (clone $query)->count();
        $this->info("הזמנות לעיבוד: {$ordersCount}".($dryRun ? ' (dry-run)' : ''));

        $linkedSessions = 0;
        $ordersTouched = 0;
        /** @var array<int, int> סשן => הזמנה (רק dry-run — מדמה סדר כרונולוגי בלי לכתוב ל-DB) */
        $simulatedAssigned = [];

        $query->chunkById(200, function ($orders) use ($dryRun, &$linkedSessions, &$ordersTouched, &$simulatedAssigned) {
            foreach ($orders as $order) {
                $ids = CartSession::openSessionIdsMatchingOrder($order);
                if ($dryRun) {
                    $ids = array_values(array_filter($ids, fn (int $id) => ! isset($simulatedAssigned[$id])));
                }
                if ($ids === []) {
                    continue;
                }
                $ordersTouched++;
                $linkedSessions += count($ids);
                if ($dryRun) {
                    foreach ($ids as $id) {
                        $simulatedAssigned[$id] = $order->id;
                    }
                    $this->line("  Order #{$order->id}: cart_session ids [".implode(', ', $ids).'] → completed_order_id='.$order->id);
                } else {
                    CartSession::whereIn('id', $ids)->update(['completed_order_id' => $order->id]);
                }
            }
        });

        if ($dryRun) {
            $this->info("סיכום dry-run: {$ordersTouched} הזמנות היו מקשרות סה\"כ {$linkedSessions} סשנים (ייחודיים).");
        } else {
            $this->info("בוצע: עודכנו {$linkedSessions} קישורי סשן מתוך {$ordersTouched} הזמנות עם התאמות.");
        }

        return self::SUCCESS;
    }
}
