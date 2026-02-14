<?php

namespace App\Services;

use App\Models\MonthlyInvoice;
use App\Models\Restaurant;
use App\Models\RestaurantSubscription;
use App\Models\Order;
use App\Models\AiUsageLog;
use App\Models\AiCredit;
use App\Models\MenuItem;
use App\Models\Category;
use App\Models\DisplayScreen;
use App\Models\Kiosk;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;
use Mpdf\Mpdf;

class InvoicePdfService
{
    private const HEBREW_MONTHS = [
        '01' => 'ינואר',
        '02' => 'פברואר',
        '03' => 'מרץ',
        '04' => 'אפריל',
        '05' => 'מאי',
        '06' => 'יוני',
        '07' => 'יולי',
        '08' => 'אוגוסט',
        '09' => 'ספטמבר',
        '10' => 'אוקטובר',
        '11' => 'נובמבר',
        '12' => 'דצמבר',
    ];

    private const STATUS_LABELS = [
        'draft' => 'טיוטה',
        'pending' => 'ממתינה לתשלום',
        'paid' => 'שולמה',
        'overdue' => 'באיחור',
    ];

    private const ORDER_STATUS_LABELS = [
        'pending' => 'ממתינה',
        'received' => 'התקבלה',
        'preparing' => 'בהכנה',
        'ready' => 'מוכנה',
        'delivering' => 'במשלוח',
        'delivered' => 'נמסרה',
        'cancelled' => 'בוטלה',
    ];

    private const PAYMENT_METHOD_LABELS = [
        'credit' => 'אשראי',
        'credit_card' => 'אשראי',
        'cash' => 'מזומן',
        'bit' => 'ביט',
        'paybox' => 'פייבוקס',
    ];

    private const BILLING_MODEL_LABELS = [
        'flat' => 'קבוע',
        'percentage' => 'אחוזים',
        'hybrid' => 'משולב',
    ];

    private const SUBSCRIPTION_STATUS_LABELS = [
        'active' => 'פעיל',
        'trial' => 'ניסיון',
        'suspended' => 'מושהה',
        'cancelled' => 'מבוטל',
        'expired' => 'פג תוקף',
    ];

    private const SOURCE_LABELS = [
        'web' => 'אתר / קישור',
        'kiosk' => 'קיוסק',
    ];

    public function generatePdf(MonthlyInvoice $invoice): Mpdf
    {
        $invoice->loadMissing('restaurant');
        $restaurant = $invoice->restaurant;

        $logoPath = storage_path('app/public/email-logo.png');
        if (!file_exists($logoPath)) {
            $logoPath = storage_path('app/public/logo.png');
        }
        $logoBase64 = file_exists($logoPath)
            ? base64_encode(file_get_contents($logoPath))
            : null;

        $monthParts = explode('-', $invoice->month);
        $year = $monthParts[0] ?? '';
        $monthNum = $monthParts[1] ?? '';
        $monthHebrew = (self::HEBREW_MONTHS[$monthNum] ?? $monthNum) . ' ' . $year;

        // Period dates for queries
        $periodStart = Carbon::parse($invoice->month . '-01')->startOfMonth();
        $periodEnd = (clone $periodStart)->endOfMonth();

        // Subscription info
        $subscription = RestaurantSubscription::where('restaurant_id', $restaurant->id)->first();
        $tierLabel = $restaurant->tier === 'pro' ? 'פרו' : 'בסיסי';

        // Orders for the month
        $orders = Order::where('restaurant_id', $restaurant->id)
            ->whereBetween('created_at', [$periodStart, $periodEnd])
            ->where('is_test', false)
            ->get();

        $activeOrders = $orders->where('status', '!=', 'cancelled');
        $cancelledOrders = $orders->where('status', 'cancelled');
        $totalOrdersAll = $orders->count();
        $totalOrders = $activeOrders->count();
        $cancelledCount = $cancelledOrders->count();
        $cancelledRevenue = $cancelledOrders->sum('total_amount');
        $totalRevenue = $activeOrders->sum('total_amount');
        $avgOrderValue = $totalOrders > 0
            ? round($totalRevenue / $totalOrders, 2)
            : 0;

        // Orders by status
        $ordersByStatus = $orders->groupBy('status')
            ->map(fn($g) => ['count' => $g->count(), 'revenue' => $g->sum('total_amount')])
            ->toArray();

        // Orders by payment method
        $ordersByPayment = $activeOrders->groupBy('payment_method')
            ->map(fn($g) => ['count' => $g->count(), 'total' => $g->sum('total_amount')])
            ->toArray();

        // Orders by source (web / kiosk)
        $ordersBySource = $activeOrders->groupBy(fn($o) => $o->source ?? 'web')
            ->map(fn($g) => ['count' => $g->count(), 'total' => $g->sum('total_amount')])
            ->toArray();

        // AI usage
        $aiUsage = [];
        try {
            $aiUsage = AiUsageLog::where('restaurant_id', $restaurant->id)
                ->whereBetween('created_at', [$periodStart, $periodEnd])
                ->selectRaw("feature, COUNT(*) as total, COALESCE(SUM(credits_used), 0) as credits")
                ->groupBy('feature')
                ->get()
                ->keyBy('feature')
                ->toArray();
        } catch (\Exception $e) {
            // AiUsageLog table might not exist
        }

        $totalAiCreditsUsed = collect($aiUsage)->sum('credits');
        $aiCreditsMonthly = $restaurant->ai_credits_monthly ?? 0;

        // Feature counts
        $menuItemsCount = MenuItem::where('restaurant_id', $restaurant->id)->count();
        $categoriesCount = Category::where('restaurant_id', $restaurant->id)->count();
        $displayScreensCount = DisplayScreen::where('restaurant_id', $restaurant->id)->count();
        $kiosksCount = Kiosk::where('restaurant_id', $restaurant->id)->count();

        $data = [
            'invoice' => $invoice,
            'restaurant' => $restaurant,
            'logoBase64' => $logoBase64,
            'invoiceNumber' => sprintf('INV-%d-%s', $restaurant->id, $invoice->month),
            'monthHebrew' => $monthHebrew,
            'issueDate' => $invoice->created_at?->format('d/m/Y') ?? now()->format('d/m/Y'),
            'statusLabels' => self::STATUS_LABELS,
            // Subscription
            'tierLabel' => $tierLabel,
            'subscription' => $subscription,
            'billingModelLabels' => self::BILLING_MODEL_LABELS,
            'subscriptionStatusLabels' => self::SUBSCRIPTION_STATUS_LABELS,
            // Orders
            'totalOrders' => $totalOrders,
            'totalOrdersAll' => $totalOrdersAll,
            'totalRevenue' => $totalRevenue,
            'avgOrderValue' => $avgOrderValue,
            'cancelledCount' => $cancelledCount,
            'cancelledRevenue' => $cancelledRevenue,
            'ordersByStatus' => $ordersByStatus,
            'ordersByPayment' => $ordersByPayment,
            'ordersBySource' => $ordersBySource,
            'orderStatusLabels' => self::ORDER_STATUS_LABELS,
            'paymentMethodLabels' => self::PAYMENT_METHOD_LABELS,
            'sourceLabels' => self::SOURCE_LABELS,
            // AI & Features
            'aiUsage' => $aiUsage,
            'totalAiCreditsUsed' => $totalAiCreditsUsed,
            'aiCreditsMonthly' => $aiCreditsMonthly,
            'menuItemsCount' => $menuItemsCount,
            'categoriesCount' => $categoriesCount,
            'displayScreensCount' => $displayScreensCount,
            'kiosksCount' => $kiosksCount,
        ];

        $html = view('invoices.monthly', $data)->render();

        $mpdf = new Mpdf([
            'mode' => 'utf-8',
            'format' => 'A4',
            'directionality' => 'rtl',
            'autoScriptToLang' => true,
            'autoLangToFont' => true,
            'biDirectional' => true,
            'default_font' => 'dejavusans',
            'tempDir' => storage_path('app/mpdf-temp'),
            'margin_bottom' => 25,
        ]);

        // Footer on all pages
        $mpdf->SetHTMLFooter('
            <div style="border-top: 1px solid #e5e7eb; padding-top: 6px; text-align: center; color: #9ca3af; font-size: 9px; direction: rtl;">
                <strong>TakeEat Platform</strong><br>
                חשבונית זו הופקה אוטומטית ואינה דורשת חתימה | לשאלות ובירורים: billing@takeeat.co.il
            </div>
        ');

        $mpdf->WriteHTML($html);

        return $mpdf;
    }

    public function streamPdf(MonthlyInvoice $invoice)
    {
        $mpdf = $this->generatePdf($invoice);
        $invoice->loadMissing('restaurant');
        $filename = sprintf('TakeEat-Invoice-%s-%s.pdf', $invoice->restaurant->tenant_id ?? $invoice->restaurant_id, $invoice->month);

        return response($mpdf->Output($filename, \Mpdf\Output\Destination::STRING_RETURN), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="' . $filename . '"',
        ]);
    }

    public function downloadPdf(MonthlyInvoice $invoice)
    {
        $mpdf = $this->generatePdf($invoice);
        $invoice->loadMissing('restaurant');
        $filename = sprintf('TakeEat-Invoice-%s-%s.pdf', $invoice->restaurant->tenant_id ?? $invoice->restaurant_id, $invoice->month);

        return response($mpdf->Output($filename, \Mpdf\Output\Destination::STRING_RETURN), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ]);
    }

    public function getPdfContent(MonthlyInvoice $invoice): string
    {
        $mpdf = $this->generatePdf($invoice);
        return $mpdf->Output('', \Mpdf\Output\Destination::STRING_RETURN);
    }

    public function getOwnerEmail(Restaurant $restaurant): ?string
    {
        $owner = User::where('restaurant_id', $restaurant->id)
            ->where('role', 'owner')
            ->first();

        return $owner?->email;
    }
}
