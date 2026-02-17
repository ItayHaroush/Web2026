<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Models\PaymentSession;
use App\Models\Restaurant;
use App\Services\RestaurantPaymentService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

/**
 * Reconciliation — סנכרון תשלומים שאושרו ב-HYP אבל לא חזרו ב-redirect
 *
 * HYP עובד redirect-based בלבד (אין webhooks).
 * אם הלקוח שילם, HYP אישר, אבל הלקוח סגר דפדפן לפני ה-redirect back —
 * ה-session נשאר pending/expired והזמנה לא מתעדכנת.
 *
 * הפקודה הזו מוצאת sessions כאלה ובודקת מול HYP עם getTransList
 * אם יש טרנזקציה מאושרת שלא סומנה — משלימה ידנית.
 */
class ReconcilePayments extends Command
{
    protected $signature = 'payments:reconcile
                            {--dry-run : הדפסת מה היה קורה בלי לעדכן}
                            {--hours=2 : כמה שעות אחורה לבדוק}';

    protected $description = 'סנכרון תשלומים שאושרו ב-HYP אבל לא חזרו ב-redirect';

    public function __construct(
        private RestaurantPaymentService $paymentService,
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        $dryRun = $this->option('dry-run');
        $hours = (int) $this->option('hours');

        $this->info($dryRun ? '[DRY RUN] Reconciliation check...' : 'Starting payment reconciliation...');

        $reconciled = $this->reconcileB2COrders($hours, $dryRun);

        $this->info("Reconciliation complete. Synced: {$reconciled}");
        Log::info('Payments reconciliation completed', ['synced' => $reconciled, 'dry_run' => $dryRun]);

        return self::SUCCESS;
    }

    /**
     * B2C: חיפוש PaymentSessions שנשארו pending/expired
     * ובדיקה מול HYP אם בכל זאת יש טרנזקציה מאושרת
     */
    private function reconcileB2COrders(int $hours, bool $dryRun): int
    {
        $cutoff = now()->subHours($hours);
        $today = now()->format('d/m/Y');
        $fromDate = now()->subHours($hours + 1)->format('d/m/Y');

        // מצא sessions שנשארו pending / expired (לא completed ולא failed)
        $pendingSessions = PaymentSession::whereIn('status', ['pending', 'expired'])
            ->where('created_at', '>=', $cutoff)
            ->with(['restaurant', 'order'])
            ->get();

        if ($pendingSessions->isEmpty()) {
            $this->info('No pending B2C sessions found to reconcile.');
            return 0;
        }

        $this->info("Found {$pendingSessions->count()} pending session(s) to check.");

        // קבץ sessions לפי מסעדה — כדי לעשות קריאת API אחת לכל מסעדה
        $byRestaurant = $pendingSessions->groupBy('restaurant_id');
        $reconciled = 0;

        foreach ($byRestaurant as $restaurantId => $sessions) {
            $restaurant = $sessions->first()->restaurant;

            if (!$restaurant || empty($restaurant->hyp_terminal_id) || empty($restaurant->hyp_terminal_password)) {
                $this->warn("Restaurant #{$restaurantId}: missing HYP credentials, skipping.");
                continue;
            }

            // קריאה אחת ל-HYP — שליפת כל העסקאות מהיום
            $result = $this->paymentService->getTransList($restaurant, $fromDate, $today);

            if (!$result['success']) {
                $this->warn("Restaurant #{$restaurantId}: getTransList failed — {$result['error']}");
                continue;
            }

            $hypTransactions = $result['transactions'];

            if (empty($hypTransactions)) {
                $this->line("Restaurant #{$restaurantId}: no HYP transactions found.");
                continue;
            }

            // עבור כל session — חפש טרנזקציה תואמת ב-HYP
            foreach ($sessions as $session) {
                $match = $this->findMatchingTransaction($session, $hypTransactions);

                if (!$match) {
                    $this->line("  Session #{$session->id} (order #{$session->order_id}): no matching HYP transaction.");
                    continue;
                }

                $hypCCode = (int) ($match['CCode'] ?? -1);
                $hypTransId = $match['Id'] ?? '';
                $hypAmount = (float) ($match['Amount'] ?? 0);

                // רק CCode=0 = עסקה מאושרת
                if ($hypCCode !== 0) {
                    $this->line("  Session #{$session->id}: HYP transaction {$hypTransId} CCode={$hypCCode} (not approved).");
                    continue;
                }

                // בדיקת התאמת סכום
                $expectedAmount = (float) $session->amount;
                if ($hypAmount > 0 && abs($hypAmount - $expectedAmount) > 0.01) {
                    $this->warn("  Session #{$session->id}: amount mismatch (HYP={$hypAmount}, session={$expectedAmount}). Skipping.");
                    Log::warning('Reconciliation: amount mismatch', [
                        'session_id' => $session->id,
                        'hyp_amount' => $hypAmount,
                        'expected'   => $expectedAmount,
                    ]);
                    continue;
                }

                $this->info("  Session #{$session->id} (order #{$session->order_id}): MATCH found — HYP trans {$hypTransId}, amount {$hypAmount}");

                if ($dryRun) {
                    $this->info("  [DRY RUN] Would mark session completed and order paid.");
                    $reconciled++;
                    continue;
                }

                // עדכון session
                $session->update([
                    'status'             => 'completed',
                    'hyp_transaction_id' => $hypTransId,
                    'completed_at'       => now(),
                ]);

                // עדכון order
                $order = $session->order;
                if ($order && $order->payment_status !== Order::PAYMENT_PAID) {
                    $order->update([
                        'payment_status'         => Order::PAYMENT_PAID,
                        'payment_transaction_id' => $hypTransId,
                        'payment_amount'         => $expectedAmount,
                        'paid_at'                => now(),
                    ]);
                }

                Log::info('Reconciliation: session synced from HYP', [
                    'session_id'     => $session->id,
                    'order_id'       => $session->order_id,
                    'transaction_id' => $hypTransId,
                    'amount'         => $expectedAmount,
                ]);

                $reconciled++;
            }
        }

        return $reconciled;
    }

    /**
     * מחפש טרנזקציה תואמת ב-HYP לפי session_token (Fild1) או order_id (Fild3)
     */
    private function findMatchingTransaction(PaymentSession $session, array $transactions): ?array
    {
        foreach ($transactions as $tx) {
            // התאמה לפי Fild1 = session_token
            if (!empty($tx['Fild1']) && $tx['Fild1'] === $session->session_token) {
                return $tx;
            }

            // התאמה לפי Fild3 = order_id
            if (!empty($tx['Fild3']) && (string) $tx['Fild3'] === (string) $session->order_id) {
                return $tx;
            }
        }

        return null;
    }
}
