<?php

namespace App\Services\Reporting;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Restaurant;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * אגרגציית מדדים על טווח זמן — משמש דוח יומי (ושותף לוגיקה עם דוחות מבוססי הזמנות אחרים).
 */
final class OrderPeriodMetricsService
{
    /**
     * תכונות לעדכון DailyReport (ללא מפתחות ייחודיים restaurant_id / date).
     *
     * @return array<string, mixed>|null
     */
    public static function buildDailyReportAttributes(Restaurant $restaurant, Carbon $start, Carbon $end): ?array
    {
        $orders = ReportingOrderQuery::ordersBetween($restaurant, $start, $end);

        if ($orders->isEmpty()) {
            return null;
        }

        $activeOrders = $orders->where('status', '!=', 'cancelled');
        $cancelledOrders = $orders->where('status', 'cancelled');

        $waivedCancelled = $cancelledOrders->filter(fn(Order $o) => $o->refund_waived_at !== null
            && $o->payment_status === Order::PAYMENT_PAID);

        $refundedOrders = $cancelledOrders->filter(fn(Order $o) => $o->payment_status === Order::PAYMENT_REFUNDED);

        $revenueForWaived = static fn(Order $o): float => (float) ($o->payment_amount ?? $o->total_amount);
        $revenueForRefunded = static fn(Order $o): float => (float) $o->effectiveChargedAmount();

        $refundCount = $refundedOrders->count();
        $refundTotal = (float) $refundedOrders->sum($revenueForRefunded);

        $waivedCount = $waivedCancelled->count();
        $waivedTotal = (float) $waivedCancelled->sum($revenueForWaived);

        $totalOrders = $activeOrders->count();

        // total_revenue = ברוטו (כולל סכומים שהוחזרו כדי שנראה את התמונה המלאה)
        $totalRevenue = (float) $activeOrders->sum('total_amount')
            + $waivedTotal
            + $refundTotal;

        $netRevenue = $totalRevenue - $refundTotal;

        $pickupOrders = $activeOrders->where('delivery_method', 'pickup')->count();
        $deliveryOrders = $activeOrders->where('delivery_method', 'delivery')->count();

        // --- אמצעי תשלום: מזומן / אשראי כולל ---
        $cashTotal = (float) $activeOrders
            ->filter(fn(Order $o) => $o->effectiveCollectedPaymentMethod() === 'cash')
            ->sum('total_amount')
            + (float) $waivedCancelled
                ->filter(fn(Order $o) => $o->effectiveCollectedPaymentMethod() === 'cash')
                ->sum($revenueForWaived);
        $creditTotal = (float) $activeOrders
            ->filter(fn(Order $o) => $o->effectiveCollectedPaymentMethod() === 'credit_card')
            ->sum('total_amount')
            + (float) $waivedCancelled
                ->filter(fn(Order $o) => $o->effectiveCollectedPaymentMethod() === 'credit_card')
                ->sum($revenueForWaived);

        // --- פירוט אשראי לפי מקור ---
        $creditActiveOrders = $activeOrders->filter(fn(Order $o) => $o->effectiveCollectedPaymentMethod() === 'credit_card');
        $creditWaivedOrders = $waivedCancelled->filter(fn(Order $o) => $o->effectiveCollectedPaymentMethod() === 'credit_card');

        $posCreditTotal = (float) $creditActiveOrders->where('source', 'pos')->sum('total_amount')
            + (float) $creditWaivedOrders->where('source', 'pos')->sum($revenueForWaived);
        $onlineCreditTotal = (float) $creditActiveOrders->filter(fn($o) => in_array($o->source, ['web', null, '']))->sum('total_amount')
            + (float) $creditWaivedOrders->filter(fn($o) => in_array($o->source, ['web', null, '']))->sum($revenueForWaived);
        $kioskCreditTotal = (float) $creditActiveOrders->where('source', 'kiosk')->sum('total_amount')
            + (float) $creditWaivedOrders->where('source', 'kiosk')->sum($revenueForWaived);

        // --- מקור הזמנות ---
        $webOrders = $activeOrders->filter(fn($o) => in_array($o->source, ['web', null, '']))->count();
        $webRevenue = (float) $activeOrders->filter(fn($o) => in_array($o->source, ['web', null, '']))->sum('total_amount')
            + (float) $waivedCancelled->filter(fn($o) => in_array($o->source, ['web', null, '']))->sum($revenueForWaived);
        $kioskOrders = $activeOrders->where('source', 'kiosk')->count();
        $kioskRevenue = (float) $activeOrders->where('source', 'kiosk')->sum('total_amount')
            + (float) $waivedCancelled->where('source', 'kiosk')->sum($revenueForWaived);
        $posOrders = $activeOrders->where('source', 'pos')->count();
        $posRevenue = (float) $activeOrders->where('source', 'pos')->sum('total_amount')
            + (float) $waivedCancelled->where('source', 'pos')->sum($revenueForWaived);

        $dineInOrders = $activeOrders->where('order_type', 'dine_in')->count();
        $takeawayOrders = $activeOrders->where('order_type', 'takeaway')->count();

        $cancelledCount = $cancelledOrders->count();
        $cancelledTotal = (float) $cancelledOrders->sum('total_amount');
        $avgOrderValue = $totalOrders > 0 ? round($netRevenue / $totalOrders, 2) : 0;

        // --- transactions for report_json ---
        $allReportOrders = $activeOrders->merge($refundedOrders);

        $transactions = $allReportOrders->map(function (Order $order) {
            return [
                'order_id' => $order->id,
                'time' => Carbon::parse($order->created_at)->setTimezone('Asia/Jerusalem')->format('H:i'),
                'type' => $order->delivery_method ?? 'pickup',
                'source' => $order->source ?? 'web',
                'order_type' => $order->order_type,
                'payment_method' => $order->effectiveCollectedPaymentMethod(),
                'payment_method_ordered' => $order->payment_method ?? 'cash',
                'amount' => (float) $order->total_amount,
                'status' => $order->payment_status === Order::PAYMENT_REFUNDED ? 'refunded' : $order->status,
                'items_count' => $order->items()->count(),
            ];
        })->values()->toArray();

        $hourlyBreakdown = [];
        foreach ($activeOrders as $order) {
            $hour = Carbon::parse($order->created_at)->setTimezone('Asia/Jerusalem')->format('H');
            if (! isset($hourlyBreakdown[$hour])) {
                $hourlyBreakdown[$hour] = ['orders' => 0, 'revenue' => 0];
            }
            $hourlyBreakdown[$hour]['orders']++;
            $hourlyBreakdown[$hour]['revenue'] += (float) $order->total_amount;
        }
        ksort($hourlyBreakdown);

        $orderIds = $activeOrders->pluck('id');
        $topItems = OrderItem::whereIn('order_items.order_id', $orderIds)
            ->join('menu_items', 'order_items.menu_item_id', '=', 'menu_items.id')
            ->select('menu_items.name as item_name', DB::raw('SUM(order_items.quantity) as total_qty'), DB::raw('SUM(order_items.price_at_order * order_items.quantity) as total_revenue'))
            ->groupBy('menu_items.name')
            ->orderByDesc('total_qty')
            ->limit(15)
            ->get()
            ->map(fn($item) => [
                'name' => $item->item_name ?? 'לא ידוע',
                'quantity' => (int) $item->total_qty,
                'revenue' => (float) $item->total_revenue,
            ])
            ->toArray();

        $reportJson = [
            'transactions' => $transactions,
            'hourly_breakdown' => $hourlyBreakdown,
            'top_items' => $topItems,
        ];

        return [
            'tenant_id' => $restaurant->tenant_id,
            'total_orders' => $totalOrders,
            'total_revenue' => $totalRevenue,
            'pickup_orders' => $pickupOrders,
            'delivery_orders' => $deliveryOrders,
            'web_orders' => $webOrders,
            'web_revenue' => $webRevenue,
            'kiosk_orders' => $kioskOrders,
            'kiosk_revenue' => $kioskRevenue,
            'pos_orders' => $posOrders,
            'pos_revenue' => $posRevenue,
            'dine_in_orders' => $dineInOrders,
            'takeaway_orders' => $takeawayOrders,
            'cash_total' => $cashTotal,
            'credit_total' => $creditTotal,
            'refund_count' => $refundCount,
            'refund_total' => $refundTotal,
            'net_revenue' => $netRevenue,
            'pos_credit_total' => $posCreditTotal,
            'online_credit_total' => $onlineCreditTotal,
            'kiosk_credit_total' => $kioskCreditTotal,
            'waived_count' => $waivedCount,
            'waived_total' => $waivedTotal,
            'cancelled_orders' => $cancelledCount,
            'cancelled_total' => $cancelledTotal,
            'avg_order_value' => $avgOrderValue,
            'report_json' => $reportJson,
        ];
    }
}
