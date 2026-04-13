<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Restaurant;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * EZcountService — יצירת חשבוניות ישירות דרך EZcount API
 * ללא תלות ב-HYP SendHesh
 */
class EZcountService
{
    private string $apiUrl;

    public function __construct()
    {
        $this->apiUrl = rtrim(config('services.ezcount.url', 'https://api.ezcount.co.il'), '/');
    }

    /**
     * יצירת חשבונית מס קבלה (type 320) אחרי תשלום מוצלח
     *
     * @return array{success: bool, doc_number: ?string, pdf_link: ?string, error: ?string}
     */
    public function createInvoice(Restaurant $restaurant, Order $order, string $transactionId, array $ccInfo = []): array
    {
        $apiKey = $restaurant->ezcount_api_key;

        if (empty($apiKey)) {
            return ['success' => false, 'doc_number' => null, 'pdf_link' => null, 'error' => 'EZcount API key missing'];
        }

        $order->loadMissing('items.menuItem');

        $items = $this->buildItems($order);
        $payment = $this->buildPayment($order, $ccInfo);
        $total = (float) $order->total_amount;

        $data = [
            'api_key' => $apiKey,
            'developer_email' => config('services.ezcount.developer_email', 'dev@chefsync.co.il'),
            'type' => 320, // חשבונית מס קבלה
            'description' => "הזמנה #{$order->id} - {$restaurant->name}",
            'customer_name' => $order->customer_name ?: 'לקוח',
            'customer_email' => '',
            'customer_address' => $this->buildCustomerAddress($order),
            'item' => $items,
            'payment' => $payment,
            'price_total' => $total,
            'comment' => "הזמנה #{$order->id}",
            'transaction_id' => $transactionId,
            'auto_balance' => true,
        ];

        if ($order->customer_phone) {
            $data['customer_cell'] = $order->customer_phone;
        }

        try {
            $response = Http::timeout(30)
                ->post("{$this->apiUrl}/api/createDoc", $data);

            $body = $response->json();

            Log::info('EZcount createDoc response', [
                'order_id' => $order->id,
                'http_status' => $response->status(),
                'success' => $body['success'] ?? false,
                'doc_number' => $body['doc_number'] ?? null,
                'pdf_link' => $body['pdf_link'] ?? null,
            ]);

            if ($response->successful() && !empty($body['doc_number'])) {
                return [
                    'success' => true,
                    'doc_number' => (string) $body['doc_number'],
                    'pdf_link' => $body['pdf_link'] ?? null,
                    'error' => null,
                ];
            }

            return [
                'success' => false,
                'doc_number' => null,
                'pdf_link' => null,
                'error' => $body['errMsg'] ?? $body['error'] ?? 'Unknown EZcount error',
            ];
        } catch (\Throwable $e) {
            Log::error('EZcount createDoc failed', [
                'order_id' => $order->id,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'doc_number' => null,
                'pdf_link' => null,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * בניית פריטים לחשבונית
     */
    private function buildItems(Order $order): array
    {
        $items = [];

        foreach ($order->items as $item) {
            $name = $item->menuItem?->name ?? 'פריט';
            if ($item->variant_name) {
                $name .= " ({$item->variant_name})";
            }

            $unitPrice = (float) $item->price_at_order + (float) $item->addons_total;

            $items[] = [
                'catalog_number' => '0',
                'details' => $name,
                'amount' => $item->quantity,
                'price' => $unitPrice,
                'vat_type' => 'INC',
            ];
        }

        // דמי משלוח
        if ((float) $order->delivery_fee > 0) {
            $items[] = [
                'catalog_number' => '0',
                'details' => 'משלוח',
                'amount' => 1,
                'price' => (float) $order->delivery_fee,
                'vat_type' => 'INC',
            ];
        }

        // הנחה כפריט שלילי
        if ((float) $order->promotion_discount > 0) {
            $items[] = [
                'catalog_number' => '0',
                'details' => 'הנחה',
                'amount' => 1,
                'price' => -1 * (float) $order->promotion_discount,
                'vat_type' => 'INC',
            ];
        }

        return $items;
    }

    /**
     * בניית נתוני תשלום
     */
    private function buildPayment(Order $order, array $ccInfo = []): array
    {
        $paidAmount = (float) ($order->payment_amount ?: $order->total_amount);

        $payment = [
            'payment_type' => 3, // כרטיס אשראי
            'payment' => $paidAmount,
        ];

        if (!empty($ccInfo['last4'])) {
            $payment['cc_number'] = $ccInfo['last4'];
        }
        if (!empty($ccInfo['brand'])) {
            $payment['cc_type_name'] = $ccInfo['brand'];
        }

        $payment['cc_deal_type'] = 1; // תשלום רגיל

        return [$payment];
    }

    /**
     * כתובת לקוח להצגה בחשבונית
     */
    private function buildCustomerAddress(Order $order): string
    {
        if ($order->delivery_method === 'delivery') {
            return $order->delivery_address ?: trim("{$order->delivery_street} {$order->delivery_house_number}, {$order->delivery_city}");
        }

        return '';
    }
}
