<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Services\PrintService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

/**
 * ניסיון חוזר להדפסת הזמנות שנכשלו — רץ כל 2 דקות.
 */
class RetryFailedPrints extends Command
{
    protected $signature = 'orders:retry-failed-prints';
    protected $description = 'Retry printing for orders where the initial print failed';

    public function handle(): int
    {
        $orders = Order::withoutGlobalScopes()
            ->whereNotNull('print_failed_at')
            ->whereIn('status', [Order::STATUS_RECEIVED, Order::STATUS_PREPARING])
            ->get();

        if ($orders->isEmpty()) {
            $this->line('No failed prints to retry.');
            return self::SUCCESS;
        }

        $this->info("Retrying {$orders->count()} failed print(s)...");

        foreach ($orders as $order) {
            try {
                app(PrintService::class)->printOrder($order);
                $order->update(['print_failed_at' => null]);
                $this->line("  Order #{$order->id} printed OK");
            } catch (\Throwable $e) {
                Log::warning("Print retry failed for order #{$order->id}", [
                    'error' => $e->getMessage(),
                ]);
                $this->warn("  Order #{$order->id}: {$e->getMessage()}");
            }
        }

        return self::SUCCESS;
    }
}
