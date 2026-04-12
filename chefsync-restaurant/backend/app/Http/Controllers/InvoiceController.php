<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\Restaurant;
use App\Services\RestaurantPaymentService;
use Illuminate\Support\Facades\Log;

/**
 * InvoiceController — צפייה בחשבונית EZcount דרך HYP PrintHesh
 */
class InvoiceController extends Controller
{
    public function __construct(
        private RestaurantPaymentService $paymentService,
    ) {}

    /**
     * GET /orders/{id}/invoice
     * מפנה ל-URL חתום של חשבונית EZcount ב-HYP
     */
    public function show(int $id)
    {
        $order = Order::withoutGlobalScope('tenant')->find($id);

        if (!$order) {
            return response()->json(['success' => false, 'message' => 'הזמנה לא נמצאה'], 404);
        }

        if (empty($order->invoice_number)) {
            return response()->json(['success' => false, 'message' => 'לא הופקה חשבונית להזמנה זו'], 404);
        }

        if (empty($order->payment_transaction_id)) {
            return response()->json(['success' => false, 'message' => 'חסר מזהה עסקה'], 404);
        }

        $restaurant = Restaurant::withoutGlobalScope('tenant')->find($order->restaurant_id);

        if (!$restaurant) {
            return response()->json(['success' => false, 'message' => 'מסעדה לא נמצאה'], 404);
        }

        $result = $this->paymentService->getInvoiceUrl($restaurant, $order->payment_transaction_id);

        if (!$result['success']) {
            Log::warning('Invoice URL generation failed', [
                'order_id' => $order->id,
                'error' => $result['error'],
            ]);
            return response()->json([
                'success' => false,
                'message' => 'שגיאה בטעינת החשבונית. נסו שוב מאוחר יותר.',
            ], 500);
        }

        return redirect()->away($result['url']);
    }
}
