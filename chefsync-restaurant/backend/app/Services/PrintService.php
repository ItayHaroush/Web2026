<?php

namespace App\Services;

use App\Models\DailyReport;
use App\Models\Order;
use App\Models\PrintDevice;
use App\Models\Printer;
use App\Models\PrintJob;
use App\Services\Printing\NetworkPrinterAdapter;
use App\Services\Printing\PrinterAdapter;
use Illuminate\Support\Facades\Log;

class PrintService
{
    /**
     * Print order to kitchen printers (role=kitchen or role=general).
     * Routes by category: each printer only gets items from its assigned categories.
     */
    public function printOrder(Order $order): int
    {
        $order->loadMissing('items.menuItem.category', 'restaurant');

        $printers = Printer::where('restaurant_id', $order->restaurant_id)
            ->where('is_active', true)
            ->whereIn('role', ['kitchen', 'general'])
            ->with('categories')
            ->get();

        if ($printers->isEmpty()) {
            Log::info("PrintService: No active kitchen printers for restaurant {$order->restaurant_id}");

            return 0;
        }

        $jobCount = 0;

        foreach ($printers as $printer) {
            $categoryIds = $printer->categories->pluck('id')->toArray();

            $relevantItems = $order->items->filter(function ($item) use ($categoryIds) {
                $categoryId = $item->menuItem?->category_id ?? $item->category_id ?? null;

                return empty($categoryIds) || in_array($categoryId, $categoryIds);
            });

            if ($relevantItems->isEmpty()) {
                continue;
            }

            $payload = $this->buildKitchenTicket($order, $relevantItems, $printer);

            $job = PrintJob::create([
                'tenant_id' => $order->tenant_id,
                'restaurant_id' => $order->restaurant_id,
                'printer_id' => $printer->id,
                'order_id' => $order->id,
                'role' => 'kitchen',
                'status' => 'pending',
                'payload' => [
                    'text' => $payload,
                    'type' => 'kitchen_ticket',
                    'items_count' => $relevantItems->count(),
                ],
            ]);

            $this->executeJob($job, $printer, $payload);
            $jobCount++;
        }

        return $jobCount;
    }

    /**
     * Print receipt to POS/receipt printers (role=receipt or role=general).
     */
    public function printReceipt(Order $order, array $extraData = []): int
    {
        $order->loadMissing('items.menuItem.category', 'restaurant');

        $printers = Printer::where('restaurant_id', $order->restaurant_id)
            ->where('is_active', true)
            ->whereIn('role', ['receipt', 'general'])
            ->get();

        if ($printers->isEmpty()) {
            Log::info("PrintService: No active receipt printers for restaurant {$order->restaurant_id}");

            return 0;
        }

        $jobCount = 0;

        foreach ($printers as $printer) {
            $payload = $this->buildReceiptPayload($order, $printer, $extraData);

            $job = PrintJob::create([
                'tenant_id' => $order->tenant_id,
                'restaurant_id' => $order->restaurant_id,
                'printer_id' => $printer->id,
                'order_id' => $order->id,
                'role' => 'receipt',
                'status' => 'pending',
                'payload' => [
                    'text' => $payload,
                    'type' => 'receipt',
                ],
            ]);

            $this->executeJob($job, $printer, $payload);
            $jobCount++;
        }

        return $jobCount;
    }

    /**
     * Print a generic text payload to printers with a specific role.
     */
    public function printToRole(int $restaurantId, string $role, string $payload, ?string $tenantId = null): int
    {
        $printers = Printer::where('restaurant_id', $restaurantId)
            ->where('is_active', true)
            ->where(function ($q) use ($role) {
                $q->where('role', $role)->orWhere('role', 'general');
            })
            ->get();

        if ($printers->isEmpty()) {
            return 0;
        }

        $jobCount = 0;

        foreach ($printers as $printer) {
            $job = PrintJob::create([
                'tenant_id' => $tenantId,
                'restaurant_id' => $restaurantId,
                'printer_id' => $printer->id,
                'order_id' => null,
                'role' => $role,
                'status' => 'pending',
                'payload' => [
                    'text' => $payload,
                    'type' => 'custom',
                ],
            ]);

            $this->executeJob($job, $printer, $payload);
            $jobCount++;
        }

        return $jobCount;
    }

    /**
     * בון דוח יומי לקופה — מדפסות receipt/general בלבד (לא מטבח).
     */
    public function printDailyReportSlip(DailyReport $report): int
    {
        $report->loadMissing('restaurant');

        $printers = Printer::where('restaurant_id', $report->restaurant_id)
            ->where('is_active', true)
            ->whereIn('role', ['receipt', 'general'])
            ->get();

        if ($printers->isEmpty()) {
            Log::info("PrintService: No receipt printers for daily report slip, restaurant {$report->restaurant_id}");

            return 0;
        }

        $jobCount = 0;

        foreach ($printers as $printer) {
            $payload = $this->buildDailyReportSlipPayload($report, $printer);

            $job = PrintJob::create([
                'tenant_id' => $report->tenant_id,
                'restaurant_id' => $report->restaurant_id,
                'printer_id' => $printer->id,
                'order_id' => null,
                'role' => 'receipt',
                'status' => 'pending',
                'payload' => [
                    'text' => $payload,
                    'type' => 'daily_report_slip',
                ],
            ]);

            $this->executeJob($job, $printer, $payload);
            $jobCount++;
        }

        return $jobCount;
    }

    public function testPrint(Printer $printer): bool
    {
        $separator = str_repeat('=', $this->getLineWidth($printer));
        $dash = str_repeat('-', $this->getLineWidth($printer));

        $roleLabel = match ($printer->role) {
            'kitchen' => 'מטבח',
            'receipt' => 'קופה / קבלות',
            'general' => 'כללי',
            default => $printer->role,
        };

        $lines = [
            $separator,
            $this->centerText('הדפסת ניסיון', $printer),
            $separator,
            '',
            $this->centerText($printer->name, $printer),
            '',
            $dash,
            "IP: {$printer->ip_address}:{$printer->port}",
            "רוחב נייר: {$printer->paper_width}",
            "תפקיד: {$roleLabel}",
            'קטגוריות: '.($printer->categories->pluck('name')->join(', ') ?: 'הכל'),
            $dash,
            '',
            $this->centerText('המדפסת פועלת תקין!', $printer),
            '',
            $separator,
        ];

        $payload = implode("\n", $lines);
        $adapter = $this->getAdapter($printer);

        return $adapter->print($payload, [
            'ip_address' => $printer->ip_address,
            'port' => $printer->port,
            'line_width' => $this->getLineWidth($printer),
        ]);
    }

    /**
     * שורת שירות (איך הלקוח מקבל את ההזמנה) — נפרדת מאריזה ומסוג מנה (צלחת/כריך).
     */
    private function formatOrderServiceModeLabel(Order $order): string
    {
        if ($order->delivery_method === 'delivery') {
            return '🚗 שירות: משלוח';
        }
        if ($order->order_type === 'takeaway') {
            return '🥡 שירות: טייקאווי';
        }
        if ($order->order_type === 'dine_in') {
            return '🪑 שירות: ישיבה במקום';
        }
        if (($order->delivery_method ?? '') === 'pickup') {
            return '📦 שירות: איסוף עצמי';
        }

        return '';
    }

    /**
     * אריזה — רק כשיש לצאת החוצה (משלוח / טייקאווי). לא מסמן "צלחת" כאילו כל ההזמנה צלחת.
     */
    private function formatOrderPackagingLabel(Order $order): string
    {
        if ($order->delivery_method === 'delivery') {
            return '🍱 אריזה: חמגשית (משלוח)';
        }
        if ($order->order_type === 'takeaway') {
            return '🍱 אריזה: חמגשית';
        }

        return '';
    }

    /**
     * צלחת מול כריך לפי dish_type של קטגוריית הפריטים. פיתה/באגט נשארים ב־variant_name ליד הפריט.
     *
     * @param  \Illuminate\Support\Collection|\Illuminate\Database\Eloquent\Collection|iterable  $items
     */
    private function inferDishPresentationSummaryLine(iterable $items): ?string
    {
        $known = [];
        $missing = false;

        foreach ($items as $item) {
            $dt = $item->menuItem?->category?->dish_type;
            if (in_array($dt, ['plate', 'sandwich', 'both'], true)) {
                $known[$dt] = true;
            } else {
                $missing = true;
            }
        }

        if ($known === []) {
            return null;
        }

        if ($missing || count($known) > 1) {
            return '🍽🌯 סוג מנה (קטגוריות): מעורב';
        }

        $only = array_key_first($known);

        return match ($only) {
            'plate' => '🍽 סוג מנה (קטגוריות): צלחת',
            'sandwich' => '🌯 סוג מנה (קטגוריות): כריך',
            'both' => '🍽🌯 סוג מנה (קטגוריות): צלחת/כריך',
            default => null,
        };
    }

    // ─── Kitchen Ticket ───

    private function buildKitchenTicket(Order $order, $items, Printer $printer): string
    {
        $width = $this->getLineWidth($printer);
        $separator = str_repeat('=', $width);
        $dash = str_repeat('-', $width);

        $lines = [];

        $lines[] = $separator;
        $lines[] = $this->centerText("הזמנה #{$order->id}", $printer);
        $lines[] = $separator;

        $lines[] = $this->centerText(
            $order->created_at->format('d.m.Y').' | '.$order->created_at->format('H:i'),
            $printer
        );

        $orderInfo = [];
        if ($order->source === 'kiosk') {
            $typeLabel = $order->order_type === 'dine_in' ? 'לשבת' : 'לקחת';
            $orderInfo[] = $typeLabel;
            if ($order->table_number) {
                $orderInfo[] = "שולחן {$order->table_number}";
            }
        } elseif ($order->source === 'pos') {
            $orderInfo[] = 'קופה';
        } elseif ($order->delivery_method === 'delivery') {
            $orderInfo[] = 'משלוח';
        } else {
            $orderInfo[] = 'איסוף עצמי';
        }
        $lines[] = implode(' | ', $orderInfo);

        $packaging = $this->formatOrderPackagingLabel($order);
        if ($packaging !== '') {
            $lines[] = $this->centerText($packaging, $printer);
        }
        $dishSummary = $this->inferDishPresentationSummaryLine($items);
        if ($dishSummary !== null) {
            $lines[] = $this->centerText($dishSummary, $printer);
        }

        if ($order->customer_name) {
            $lines[] = $order->customer_name;
        }
        if ($order->customer_phone && $order->customer_phone !== '0000000000') {
            $lines[] = PhoneValidationService::formatIsraeliForDisplay($order->customer_phone);
        }
        if ($order->delivery_address) {
            $lines[] = "כתובת: {$order->delivery_address}";
        }

        $lines[] = $dash;

        $kitchenGroups = $this->groupOrderItemsByCategory($items);
        $kitchenItemTotal = 0;
        foreach ($kitchenGroups as $b) {
            $kitchenItemTotal += count($b);
        }
        $kitchenItemDone = 0;

        foreach ($kitchenGroups as $categoryLabel => $bucket) {
            $lines[] = $this->centerText("— {$categoryLabel} —", $printer);

            foreach ($bucket as $item) {
                $name = $item->menuItem?->name ?? $item->name ?? 'פריט';
                $qty = $item->quantity ?? 1;
                $lines[] = "{$qty}x {$name}";

                if (! empty($item->variant_name)) {
                    $lines[] = "  סוג: {$item->variant_name}";
                }

                $addons = is_array($item->addons) ? $item->addons : [];
                foreach ($addons as $addon) {
                    $addonName = is_string($addon) ? $addon : ($addon['name'] ?? $addon['addon_name'] ?? '');
                    $onSide = is_array($addon) && ! empty($addon['on_side']);
                    if ($addonName) {
                        $prefix = $onSide ? '  בצד:' : '  +';
                        $lines[] = "{$prefix} {$addonName}";
                    }
                }

                if (! empty($item->notes)) {
                    $lines[] = "  הערה: {$item->notes}";
                }

                $kitchenItemDone++;
                if ($kitchenItemDone < $kitchenItemTotal) {
                    $lines[] = '';
                }
            }
        }

        $lines[] = $dash;

        if ($order->delivery_notes) {
            $lines[] = "הערות: {$order->delivery_notes}";
            $lines[] = $dash;
        }
        if ($order->notes) {
            $lines[] = "הערות: {$order->notes}";
            $lines[] = $dash;
        }

        $lines[] = $separator;
        $restaurantName = $order->restaurant?->name ?? '';
        if ($restaurantName) {
            $lines[] = $this->centerText($restaurantName, $printer);
        }
        $lines[] = '';

        return implode("\n", $lines);
    }

    // ─── Receipt ───

    private function buildReceiptPayload(Order $order, Printer $printer, array $extraData = []): string
    {
        $width = $this->getLineWidth($printer);
        $separator = str_repeat('=', $width);
        $dash = str_repeat('-', $width);

        $lines = [];

        $restaurantName = $order->restaurant?->name ?? '';
        if ($restaurantName) {
            $lines[] = $this->centerText($restaurantName, $printer);
        }

        $lines[] = $separator;
        $lines[] = $this->centerText("קבלה — הזמנה #{$order->id}", $printer);
        $lines[] = $separator;
        $lines[] = $this->centerText($order->created_at->format('d.m.Y H:i'), $printer);

        $serviceLabel = $this->formatOrderServiceModeLabel($order);
        if ($serviceLabel !== '') {
            $lines[] = $this->centerText($serviceLabel, $printer);
        }
        $packagingLabel = $this->formatOrderPackagingLabel($order);
        if ($packagingLabel !== '') {
            $lines[] = $this->centerText($packagingLabel, $printer);
        }
        $dishSummary = $this->inferDishPresentationSummaryLine($order->items);
        if ($dishSummary !== null) {
            $lines[] = $this->centerText($dishSummary, $printer);
        }

        if ($order->customer_name && $order->customer_name !== 'POS') {
            $lines[] = $this->centerText("לקוח: {$order->customer_name}", $printer);
        }
        if ($order->customer_phone && $order->customer_phone !== '0000000000') {
            $lines[] = $this->centerText(
                'טלפון: '.PhoneValidationService::formatIsraeliForDisplay($order->customer_phone),
                $printer
            );
        }
        if ($order->delivery_address) {
            $lines[] = $this->centerText("כתובת: {$order->delivery_address}", $printer);
        }
        $lines[] = $dash;

        foreach ($order->items as $item) {
            $name = $item->menuItem?->name ?? $item->name ?? 'פריט';
            $qty = $item->quantity ?? 1;

            if (! empty($item->variant_name)) {
                $name .= " ({$item->variant_name})";
            }

            $lines[] = "{$qty}x {$name}";

            $addons = is_array($item->addons) ? $item->addons : [];
            foreach ($addons as $addon) {
                $addonName = is_string($addon) ? $addon : ($addon['name'] ?? '');
                $addonPrice = is_array($addon) ? (float) ($addon['price'] ?? 0) : 0.0;

                if ($addonName) {
                    $price = $addonPrice > 0 ? ' '.$this->formatShekelAmount($addonPrice) : '';
                    $lines[] = "  + {$addonName}{$price}";
                }
            }

            $lines[] = '';
        }

        $lines[] = $separator;

        if ($order->delivery_fee > 0) {
            $lines[] = $this->centerText(
                'דמי משלוח: '.$this->formatShekelAmount((float) $order->delivery_fee),
                $printer
            );
        }

        $totalAmount = $order->total_amount ?? 0;
        $lines[] = $this->receiptLineLabelAndAmount(
            'סה"כ:',
            $this->formatShekelAmount((float) $totalAmount),
            $width,
            12
        );

        $paymentLabel = match ($order->payment_method) {
            'cash' => 'מזומן',
            'credit_card' => 'אשראי',
            default => $order->payment_method ?? '—',
        };
        $lines[] = $this->centerText("תשלום: {$paymentLabel}", $printer);

        if (! empty($extraData['change']) && $extraData['change'] > 0) {
            $lines[] = $this->centerText(
                'עודף: '.$this->formatShekelAmount((float) $extraData['change']),
                $printer
            );
        }

        if (! empty($extraData['receipt_number'])) {
            $lines[] = $dash;
            $lines[] = "מס׳ קבלה: {$extraData['receipt_number']}";
        }

        $lines[] = $separator;
        $lines[] = $this->centerText('תודה שבחרתם בנו!', $printer);
        $lines[] = '';

        return implode("\n", $lines);
    }

    private function buildDailyReportSlipPayload(DailyReport $report, Printer $printer): string
    {
        $width = $this->getLineWidth($printer);
        $separator = str_repeat('=', $width);
        $dash = str_repeat('-', $width);

        $restaurantName = $report->restaurant?->name ?? '';
        $dateLabel = $report->date instanceof \Carbon\Carbon
            ? $report->date->format('d/m/Y')
            : (string) $report->date;

        $lines = [
            $separator,
            $this->centerText('דוח יומי — קופה', $printer),
            $separator,
        ];

        if ($restaurantName !== '') {
            $lines[] = $this->centerText($restaurantName, $printer);
        }
        $lines[] = $this->centerText($dateLabel, $printer);
        $lines[] = '';
        $lines[] = $dash;
        $lines[] = $this->receiptLineLabelAndAmount('הזמנות (פעילות):', (string) $report->total_orders, $width);
        $lines[] = $this->receiptLineLabelAndAmount('הכנסות:', $this->formatShekelAmount((float) $report->total_revenue), $width);
        $lines[] = $this->receiptLineLabelAndAmount('איסוף:', (string) $report->pickup_orders, $width);
        $lines[] = $this->receiptLineLabelAndAmount('משלוח:', (string) $report->delivery_orders, $width);
        $lines[] = $this->receiptLineLabelAndAmount('מזומן:', $this->formatShekelAmount((float) $report->cash_total), $width);
        $lines[] = $this->receiptLineLabelAndAmount('אשראי:', $this->formatShekelAmount((float) $report->credit_total), $width);
        $lines[] = $this->receiptLineLabelAndAmount('ביטולים:', (string) $report->cancelled_orders, $width);
        if ((float) $report->cancelled_total > 0) {
            $lines[] = $this->receiptLineLabelAndAmount('סה"כ ביטולים:', $this->formatShekelAmount((float) $report->cancelled_total), $width);
        }
        $lines[] = $dash;
        $lines[] = $this->centerText('דוח PDF מלא: ניהול > דוחות', $printer);
        $lines[] = $separator;
        $lines[] = '';

        return implode("\n", $lines);
    }

    // ─── Infrastructure ───

    private function executeJob(PrintJob $job, Printer $printer, string $payload): void
    {
        $role = $job->role ?? $printer->role ?? 'kitchen';

        $hasBridgeDevices = PrintDevice::withoutGlobalScopes()
            ->where('restaurant_id', $job->restaurant_id)
            ->where('is_active', true)
            ->where(function ($q) use ($role) {
                $q->where('role', $role)->orWhere('role', 'general');
            })
            ->exists();

        if ($hasBridgeDevices) {
            $job->update([
                'status' => 'pending_bridge',
                'attempts' => $job->attempts + 1,
            ]);

            return;
        }

        if ($printer->type === 'browser') {
            $job->update([
                'status' => 'pending_browser',
                'attempts' => $job->attempts + 1,
            ]);

            return;
        }

        try {
            $adapter = $this->getAdapter($printer);
            $job->update(['status' => 'printing', 'attempts' => $job->attempts + 1]);

            $success = $adapter->print($payload, [
                'ip_address' => $printer->ip_address,
                'port' => $printer->port,
                'line_width' => $this->getLineWidth($printer),
            ]);

            $job->update([
                'status' => $success ? 'done' : 'failed',
                'error_message' => $success ? null : 'Print failed - no response from printer',
            ]);
        } catch (\Exception $e) {
            Log::error('PrintService: Job execution failed', [
                'job_id' => $job->id,
                'printer_id' => $printer->id,
                'error' => $e->getMessage(),
            ]);

            $job->update([
                'status' => 'failed',
                'error_message' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Get pending browser print jobs for a restaurant and mark them as done.
     */
    public function getPendingBrowserJobs(int $restaurantId): array
    {
        $jobs = PrintJob::where('restaurant_id', $restaurantId)
            ->where('status', 'pending_browser')
            ->with('printer')
            ->orderBy('created_at', 'asc')
            ->limit(20)
            ->get();

        $result = [];

        foreach ($jobs as $job) {
            $result[] = [
                'id' => $job->id,
                'type' => $job->payload['type'] ?? 'custom',
                'role' => $job->role ?? $job->printer->role ?? 'kitchen',
                'text' => $job->payload['text'] ?? '',
                'order_id' => $job->order_id,
                'created_at' => $job->created_at->format('H:i'),
            ];
            $job->update(['status' => 'done']);
        }

        return $result;
    }

    /**
     * Reset stale "printing" bridge jobs back to pending_bridge (timeout fallback).
     * Should be called from a scheduled command every minute.
     */
    public function retryStaleJobs(int $timeoutMinutes = 2): int
    {
        return PrintJob::where('status', 'printing')
            ->whereNotNull('device_id')
            ->where('updated_at', '<', now()->subMinutes($timeoutMinutes))
            ->update([
                'status' => 'pending_bridge',
                'device_id' => null,
                'error_message' => 'Timeout — no ACK received, retrying',
            ]);
    }

    private function getAdapter(Printer $printer): PrinterAdapter
    {
        return match ($printer->type) {
            'network' => new NetworkPrinterAdapter,
            default => new NetworkPrinterAdapter,
        };
    }

    private function getLineWidth(Printer $printer): int
    {
        return $printer->paper_width === '58mm' ? 32 : 42;
    }

    private function centerText(string $text, Printer $printer): string
    {
        $width = $this->getLineWidth($printer);
        $textLen = mb_strlen($text, 'UTF-8');
        if ($textLen >= $width) {
            return $text;
        }
        $padding = (int) (($width - $textLen) / 2);

        return str_repeat(' ', $padding).$text;
    }

    /**
     * שורת קבלה בסגנון קופה: תווית משמאל (מילוי עד width−amountCols) + עמודת סכום מיושרת לשמאל (מילוי עד amountCols).
     * מבוסס על mb — עברית וש"ח נספרים נכון.
     */
    private function receiptLineLabelAndAmount(string $label, string $amount, int $width, int $amountColumns = 12): string
    {
        $amountColumns = max(1, $amountColumns);
        $labelWidth = max(0, $width - $amountColumns);

        return $this->mbStrPadRight($label, $labelWidth).$this->mbStrPadLeft($amount, $amountColumns);
    }

    private function mbStrPadLeft(string $string, int $length): string
    {
        $len = mb_strlen($string, 'UTF-8');
        if ($len >= $length) {
            return $string;
        }

        return str_repeat(' ', $length - $len).$string;
    }

    private function mbStrPadRight(string $string, int $length): string
    {
        $len = mb_strlen($string, 'UTF-8');
        if ($len >= $length) {
            return $string;
        }

        return $string.str_repeat(' ', $length - $len);
    }

    /**
     * טקסט קבלה לדוגמה (תצוגת ווב / בדיקה) — אותו מבנה כמו buildReceiptPayload, בלי הזמנה אמיתית.
     */
    public function sampleReceiptForWebPreview(Printer $printer): string
    {
        $width = $this->getLineWidth($printer);
        $separator = str_repeat('=', $width);
        $dash = str_repeat('-', $width);

        $lines = [
            $this->centerText("צ'יפס-טעים בכל ביס (דוגמה)", $printer),
            $separator,
            $this->centerText('קבלה — הזמנה #248', $printer),
            $separator,
            $this->centerText('29.03.2026 15:30', $printer),
            $this->centerText('🚗 שירות: משלוח', $printer),
            $this->centerText('🍱 אריזה: חמגשית (משלוח)', $printer),
            $this->centerText('🍽🌯 סוג מנה (קטגוריות): מעורב', $printer),
            $this->centerText('לקוח: איתי חרוש', $printer),
            $this->centerText('טלפון: '.PhoneValidationService::formatIsraeliForDisplay('0547466508'), $printer),
            $this->centerText('כתובת: רחוב הדוגמה 12, תל אביב', $printer),
            $dash,
            '1x חזה עוף (גריל)',
            '  + חומוס '.$this->formatShekelAmount(5.00),
            '',
            '2x צ׳יפס',
            '',
            $separator,
            $this->centerText('דמי משלוח: '.$this->formatShekelAmount(25.00), $printer),
            $this->receiptLineLabelAndAmount('סה"כ:', $this->formatShekelAmount(105.00), $width, 12),
            $this->centerText('תשלום: מזומן', $printer),
            $separator,
            $this->centerText('תודה שבחרתם בנו!', $printer),
            '',
        ];

        return implode("\n", $lines);
    }

    /**
     * סכום להדפסה: רווח בין המספר לבין ש"ח (בלי ₪ כדי שלא יידבק אחרי iconv).
     */
    private function formatShekelAmount(float $amount): string
    {
        return number_format($amount, 2, '.', '').' ש"ח';
    }

    /**
     * קיבוץ פריטים לפי קטגוריה (סדר הופעה ראשונה בהזמנה).
     *
     * @param  \Illuminate\Support\Collection|\Illuminate\Database\Eloquent\Collection|iterable  $items
     * @return array<string, array<int, mixed>>
     */
    private function groupOrderItemsByCategory(iterable $items): array
    {
        $groups = [];

        foreach ($items as $item) {
            $label = $item->category_name
                ?: $item->menuItem?->category?->name
                ?: 'ללא קטגוריה';

            if (! array_key_exists($label, $groups)) {
                $groups[$label] = [];
            }
            $groups[$label][] = $item;
        }

        return $groups;
    }
}
