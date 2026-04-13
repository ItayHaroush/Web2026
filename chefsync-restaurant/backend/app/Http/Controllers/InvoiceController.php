<?php

namespace App\Http\Controllers;

use App\Models\Order;

/**
 * InvoiceController — צפייה בחשבונית EZcount (PDF ישיר)
 */
class InvoiceController extends Controller
{
    /**
     * GET /orders/{id}/invoice
     * מפנה ל-PDF חשבונית EZcount
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

        // PDF ישיר מ-EZcount
        if (!empty($order->invoice_pdf_url)) {
            return redirect()->away($order->invoice_pdf_url);
        }

        return response()->json([
            'success' => false,
            'message' => 'לינק PDF לא זמין. מספר חשבונית: ' . $order->invoice_number,
        ], 404);
    }
}
