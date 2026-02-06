<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Printer;
use App\Models\PrintJob;
use App\Services\Printing\PrinterAdapter;
use App\Services\Printing\NetworkPrinterAdapter;
use Illuminate\Support\Facades\Log;

class PrintService
{
    /**
     * הדפסת הזמנה לכל המדפסות הרלוונטיות
     * מחזיר את מספר ה-jobs שנוצרו
     */
    public function printOrder(Order $order): int
    {
        $order->loadMissing('items.menuItem.category', 'restaurant');

        $printers = Printer::where('restaurant_id', $order->restaurant_id)
            ->where('is_active', true)
            ->with('categories')
            ->get();

        if ($printers->isEmpty()) {
            Log::info("PrintService: No active printers for restaurant {$order->restaurant_id}");
            return 0;
        }

        $jobCount = 0;

        foreach ($printers as $printer) {
            $categoryIds = $printer->categories->pluck('id')->toArray();

            // סינון פריטים לפי קטגוריות המדפסת
            $relevantItems = $order->items->filter(function ($item) use ($categoryIds) {
                $categoryId = $item->menuItem?->category_id ?? $item->category_id ?? null;
                return empty($categoryIds) || in_array($categoryId, $categoryIds);
            });

            if ($relevantItems->isEmpty()) {
                continue;
            }

            $payload = $this->buildPayload($order, $relevantItems, $printer);

            $job = PrintJob::create([
                'tenant_id' => $order->tenant_id,
                'restaurant_id' => $order->restaurant_id,
                'printer_id' => $printer->id,
                'order_id' => $order->id,
                'status' => 'pending',
                'payload' => [
                    'text' => $payload,
                    'items_count' => $relevantItems->count(),
                ],
            ]);

            // ניסיון הדפסה (fire-and-forget)
            $this->executeJob($job, $printer, $payload);
            $jobCount++;
        }

        return $jobCount;
    }

    /**
     * הדפסת ניסיון
     */
    public function testPrint(Printer $printer): bool
    {
        $separator = str_repeat('=', $this->getLineWidth($printer));
        $dash = str_repeat('-', $this->getLineWidth($printer));

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
            "קטגוריות: " . ($printer->categories->pluck('name')->join(', ') ?: 'הכל'),
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
        ]);
    }

    /**
     * בניית תוכן ההדפסה
     */
    private function buildPayload(Order $order, $items, Printer $printer): string
    {
        $width = $this->getLineWidth($printer);
        $separator = str_repeat('=', $width);
        $dash = str_repeat('-', $width);

        $lines = [];

        // כותרת
        $lines[] = $separator;
        $lines[] = $this->centerText("הזמנה #{$order->id}", $printer);
        $lines[] = $separator;

        // תאריך ושעה
        $lines[] = $order->created_at->format('d.m.Y') . ' | ' . $order->created_at->format('H:i');

        // מקור ופרטים
        $orderInfo = [];

        if ($order->source === 'kiosk') {
            $typeLabel = $order->order_type === 'dine_in' ? 'לשבת' : 'לקחת';
            $orderInfo[] = $typeLabel;
            if ($order->table_number) {
                $orderInfo[] = "שולחן {$order->table_number}";
            }
        } elseif ($order->delivery_method === 'delivery') {
            $orderInfo[] = 'משלוח';
        } else {
            $orderInfo[] = 'איסוף עצמי';
        }

        $lines[] = implode(' | ', $orderInfo);

        // שם לקוח
        if ($order->customer_name) {
            $lines[] = $order->customer_name;
        }

        // טלפון
        if ($order->customer_phone) {
            $lines[] = $order->customer_phone;
        }

        // כתובת למשלוח
        if ($order->delivery_address) {
            $lines[] = "כתובת: {$order->delivery_address}";
        }

        $lines[] = $dash;

        // פריטים
        foreach ($items as $item) {
            $name = $item->menuItem?->name ?? $item->name ?? 'פריט';
            $qty = $item->quantity ?? 1;
            $price = number_format(($item->price_at_order ?? $item->menuItem?->price ?? 0) * $qty, 2);
            $lines[] = "{$qty}x {$name}              ₪{$price}";

            // וריאציה
            if (!empty($item->variant_name)) {
                $lines[] = "  סוג: {$item->variant_name}";
            }

            // תוספות
            $addons = is_array($item->addons) ? $item->addons : [];
            foreach ($addons as $addon) {
                $addonName = is_string($addon) ? $addon : ($addon['name'] ?? $addon['addon_name'] ?? '');
                $onSide = is_array($addon) && !empty($addon['on_side']);
                if ($addonName) {
                    $prefix = $onSide ? '  בצד:' : '  +';
                    $lines[] = "{$prefix} {$addonName}";
                }
            }

            // הערות לפריט
            if (!empty($item->notes)) {
                $lines[] = "  הערה: {$item->notes}";
            }
        }

        $lines[] = $dash;

        // הערות להזמנה
        if ($order->delivery_notes) {
            $lines[] = "הערות: {$order->delivery_notes}";
            $lines[] = $dash;
        }

        // דמי משלוח
        if ($order->delivery_fee > 0) {
            $lines[] = "דמי משלוח: ₪" . number_format($order->delivery_fee, 2);
        }

        // סה"כ
        $lines[] = "סה\"כ: ₪" . number_format($order->total_amount ?? 0, 2);
        $lines[] = $separator;

        // שם מסעדה בתחתית
        $restaurantName = $order->restaurant?->name ?? '';
        if ($restaurantName) {
            $lines[] = $this->centerText($restaurantName, $printer);
        }

        $lines[] = '';

        return implode("\n", $lines);
    }

    /**
     * ביצוע ההדפסה בפועל
     */
    private function executeJob(PrintJob $job, Printer $printer, string $payload): void
    {
        try {
            $adapter = $this->getAdapter($printer);
            $job->update(['status' => 'printing', 'attempts' => $job->attempts + 1]);

            $success = $adapter->print($payload, [
                'ip_address' => $printer->ip_address,
                'port' => $printer->port,
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
     * קבלת adapter מתאים לסוג המדפסת
     */
    private function getAdapter(Printer $printer): PrinterAdapter
    {
        return match ($printer->type) {
            'network' => new NetworkPrinterAdapter(),
            default => new NetworkPrinterAdapter(),
        };
    }

    /**
     * רוחב שורה לפי גודל נייר
     */
    private function getLineWidth(Printer $printer): int
    {
        return $printer->paper_width === '58mm' ? 32 : 42;
    }

    /**
     * מרכוז טקסט
     */
    private function centerText(string $text, Printer $printer): string
    {
        $width = $this->getLineWidth($printer);
        $textLen = mb_strlen($text);
        if ($textLen >= $width) {
            return $text;
        }
        $padding = (int) (($width - $textLen) / 2);
        return str_repeat(' ', $padding) . $text;
    }
}
