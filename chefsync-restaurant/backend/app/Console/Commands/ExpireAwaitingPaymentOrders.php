<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Models\PaymentSession;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * הזמנות B2C באשראי שנשארו ב-awaiting_payment לאחר פקיעת חלון התשלום — ביטול אוטומטי.
 */
class ExpireAwaitingPaymentOrders extends Command
{
    protected $signature = 'orders:expire-awaiting-payment {--dry-run : הצגה בלבד}';

    protected $description = 'ביטול הזמנות awaiting_payment שלא שולמו לאחר timeout';

    public function handle(): int
    {
        $timeoutMin = (int) config('payment.order_payment.session_timeout_minutes', 15);
        $graceMinutes = max(10, $timeoutMin + 10);
        $cutoff = now()->subMinutes($graceMinutes);
        $dryRun = $this->option('dry-run');

        $query = Order::withoutGlobalScopes()
            ->where('status', Order::STATUS_AWAITING_PAYMENT)
            ->where('payment_method', 'credit_card')
            ->where('payment_status', Order::PAYMENT_PENDING)
            ->where('created_at', '<=', $cutoff);

        $cancelled = 0;

        $query->orderBy('id')->chunkById(100, function ($orders) use ($dryRun, &$cancelled) {
            foreach ($orders as $order) {
                if (!$this->shouldExpire($order, $graceMinutes)) {
                    continue;
                }
                if ($dryRun) {
                    $this->line("Would cancel order #{$order->id}");
                    $cancelled++;
                    continue;
                }
                try {
                    DB::transaction(function () use ($order) {
                        PaymentSession::where('order_id', $order->id)
                            ->where('status', 'pending')
                            ->update(['status' => 'expired']);

                        $order->update([
                            'status' => Order::STATUS_CANCELLED,
                            'payment_status' => Order::PAYMENT_CANCELLED,
                            'cancellation_reason' => 'תשלום לא הושלם בזמן (בוטל אוטומטית)',
                        ]);
                    });
                    $cancelled++;
                } catch (\Throwable $e) {
                    Log::warning('ExpireAwaitingPaymentOrders failed', [
                        'order_id' => $order->id,
                        'error' => $e->getMessage(),
                    ]);
                }
            }
        });

        $this->info("Cancelled awaiting-payment orders: {$cancelled}" . ($dryRun ? ' (dry-run)' : ''));
        Log::info('ExpireAwaitingPaymentOrders', ['count' => $cancelled, 'dry_run' => $dryRun]);

        return self::SUCCESS;
    }

    private function shouldExpire(Order $order, int $graceMinutes): bool
    {
        $latest = PaymentSession::where('order_id', $order->id)->latest('id')->first();

        if ($latest && $latest->status === 'completed') {
            return false;
        }

        if ($latest && $latest->status === 'pending' && $latest->expires_at && $latest->expires_at->isFuture()) {
            return false;
        }

        return $order->created_at->lte(now()->subMinutes($graceMinutes));
    }
}
