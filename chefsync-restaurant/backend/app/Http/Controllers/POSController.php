<?php

namespace App\Http\Controllers;

use App\Models\CashMovement;
use App\Models\CashRegisterShift;
use App\Models\EmployeeTimeLog;
use App\Models\FcmToken;
use App\Models\MonitoringAlert;
use App\Models\NotificationLog;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PosSession;
use App\Models\Printer;
use App\Models\Restaurant;
use App\Models\TableTab;
use App\Models\User;
use App\Services\FcmService;
use App\Services\PosPaymentService;
use App\Services\PrintService;
use App\Services\ZCreditService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class POSController extends Controller
{
    // ─── PIN & Session ───

    public function setPin(Request $request)
    {
        $request->validate(['pin' => 'required|string|size:4']);

        $request->user()->update([
            'pos_pin_hash' => Hash::make($request->pin),
        ]);

        return response()->json(['success' => true, 'message' => 'PIN updated']);
    }

    public function verifyPin(Request $request)
    {
        $request->validate(['pin' => 'required|string|size:4']);

        $user = $request->user();

        if (!$user->pos_pin_hash || !Hash::check($request->pin, $user->pos_pin_hash)) {
            return response()->json(['success' => false, 'message' => 'קוד PIN שגוי'], 422);
        }

        PosSession::where('user_id', $user->id)->delete();

        $token = Str::random(64);
        $session = PosSession::create([
            'user_id' => $user->id,
            'restaurant_id' => $user->restaurant_id,
            'token' => $token,
            'expires_at' => Carbon::now()->addHours(8),
        ]);

        return response()->json([
            'success' => true,
            'token' => $token,
            'expires_at' => $session->expires_at->toISOString(),
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'role' => $user->role,
            ],
        ]);
    }

    public function lockSession(Request $request)
    {
        $token = $request->header('X-POS-Session');
        if (!$token) {
            return response()->json(['success' => false, 'message' => 'Missing POS session token'], 400);
        }

        $session = PosSession::where('token', $token)
            ->where('expires_at', '>', now())
            ->first();

        if (!$session) {
            return response()->json(['success' => false, 'message' => 'Session not found or expired'], 400);
        }

        $session->update(['locked_at' => Carbon::now()]);

        return response()->json(['success' => true]);
    }

    public function unlockSession(Request $request)
    {
        $request->validate(['pin' => 'required|string|size:4']);

        $user = $request->user();

        if (!Hash::check($request->pin, $user->pos_pin_hash)) {
            return response()->json(['success' => false, 'message' => 'קוד PIN שגוי'], 422);
        }

        $session = PosSession::where('user_id', $user->id)
            ->where('expires_at', '>', now())
            ->latest()
            ->first();

        if ($session) {
            $session->update(['locked_at' => null]);
        }

        return response()->json(['success' => true]);
    }

    public function getSession(Request $request)
    {
        $session = $request->pos_session;

        return response()->json([
            'success' => true,
            'session' => [
                'expires_at' => $session->expires_at->toISOString(),
                'user' => $session->user->only('id', 'name', 'role'),
            ],
        ]);
    }

    // ─── Shift Management ───

    public function openShift(Request $request)
    {
        $request->validate([
            'opening_balance' => 'required|numeric|min:0',
        ]);

        $user = $request->user();
        $restaurantId = $user->restaurant_id;

        $existing = CashRegisterShift::where('restaurant_id', $restaurantId)
            ->whereNull('closed_at')
            ->first();

        if ($existing) {
            return response()->json([
                'success' => false,
                'message' => 'כבר יש משמרת פתוחה',
                'shift' => $this->formatShift($existing),
            ], 409);
        }

        $shift = CashRegisterShift::create([
            'restaurant_id' => $restaurantId,
            'user_id' => $user->id,
            'opened_at' => Carbon::now(),
            'opening_balance' => $request->opening_balance,
        ]);

        return response()->json([
            'success' => true,
            'shift' => $this->formatShift($shift),
        ]);
    }

    public function closeShift(Request $request)
    {
        $request->validate([
            'closing_balance' => 'required|numeric|min:0',
            'notes' => 'nullable|string|max:500',
        ]);

        $user = $request->user();

        if (!$user->isManager()) {
            return response()->json(['success' => false, 'message' => 'רק מנהל יכול לסגור משמרת'], 403);
        }

        $shift = CashRegisterShift::where('restaurant_id', $user->restaurant_id)
            ->whereNull('closed_at')
            ->firstOrFail();

        // בדוק שאין הזמנות ממתינות לתשלום
        $pendingCount = Order::withoutGlobalScopes()
            ->where('restaurant_id', $user->restaurant_id)
            ->whereNotIn('payment_status', ['paid', 'refunded'])
            ->where('status', '!=', 'cancelled')
            ->whereDate('created_at', '>=', Carbon::today())
            ->count();

        if ($pendingCount > 0) {
            return response()->json([
                'success' => false,
                'message' => "לא ניתן לסגור משמרת — {$pendingCount} הזמנות ממתינות לתשלום",
                'pending_count' => $pendingCount,
            ], 422);
        }

        $expectedBalance = $this->calculateExpectedBalance($shift);

        $shift->update([
            'closed_at' => Carbon::now(),
            'closing_balance' => $request->closing_balance,
            'expected_balance' => $expectedBalance,
            'notes' => $request->notes,
        ]);

        $clockedIn = EmployeeTimeLog::where('restaurant_id', $user->restaurant_id)
            ->whereNull('clock_out')
            ->with('user:id,name,role')
            ->get()
            ->map(fn($log) => [
                'name' => $log->user->name ?? '—',
                'clock_in' => $log->clock_in->format('H:i'),
            ]);

        return response()->json([
            'success' => true,
            'z_report' => $this->buildZReport($shift->fresh()),
            'clocked_in_employees' => $clockedIn->toArray(),
        ]);
    }

    public function shiftHistory(Request $request)
    {
        $user = $request->user();
        $shifts = CashRegisterShift::where('restaurant_id', $user->restaurant_id)
            ->whereNotNull('closed_at')
            ->orderBy('closed_at', 'desc')
            ->limit(60)
            ->get()
            ->map(fn($s) => [
                'id' => $s->id,
                'cashier' => $s->user->name ?? '—',
                'opened_at' => $s->opened_at->format('d/m/Y H:i'),
                'closed_at' => $s->closed_at->format('d/m/Y H:i'),
                'opening_balance' => (float) $s->opening_balance,
                'closing_balance' => (float) $s->closing_balance,
                'expected_balance' => (float) $s->expected_balance,
                'variance' => round((float) $s->closing_balance - (float) $s->expected_balance, 2),
                'notes' => $s->notes,
            ]);

        return response()->json(['success' => true, 'shifts' => $shifts]);
    }

    public function shiftReport(Request $request, $id)
    {
        $user = $request->user();
        $shift = CashRegisterShift::where('restaurant_id', $user->restaurant_id)
            ->findOrFail($id);

        return response()->json([
            'success' => true,
            'z_report' => $this->buildZReport($shift),
        ]);
    }

    public function currentShift(Request $request)
    {
        $user = $request->user();
        $shift = CashRegisterShift::where('restaurant_id', $user->restaurant_id)
            ->whereNull('closed_at')
            ->first();

        if (!$shift) {
            return response()->json(['success' => true, 'shift' => null]);
        }

        return response()->json([
            'success' => true,
            'shift' => $this->formatShift($shift),
        ]);
    }

    public function cashMovement(Request $request)
    {
        $request->validate([
            'type' => 'required|in:cash_in,cash_out',
            'amount' => 'required|numeric|min:0.01',
            'description' => 'nullable|string|max:255',
        ]);

        $user = $request->user();

        if (!$user->isManager()) {
            return response()->json(['success' => false, 'message' => 'רק מנהל יכול לבצע תנועות מזומן'], 403);
        }

        $shift = CashRegisterShift::where('restaurant_id', $user->restaurant_id)
            ->whereNull('closed_at')
            ->firstOrFail();

        $movement = CashMovement::create([
            'shift_id' => $shift->id,
            'user_id' => $user->id,
            'type' => $request->type,
            'payment_method' => 'cash',
            'amount' => $request->amount,
            'description' => $request->description,
        ]);

        return response()->json([
            'success' => true,
            'movement' => $movement,
            'shift' => $this->formatShift($shift->fresh()),
        ]);
    }

    public function shiftSummary(Request $request)
    {
        $user = $request->user();
        $shift = CashRegisterShift::where('restaurant_id', $user->restaurant_id)
            ->whereNull('closed_at')
            ->first();

        if (!$shift) {
            return response()->json(['success' => true, 'summary' => null]);
        }

        $movements = $shift->movements()->get();

        $cashPayments = $movements->where('type', 'payment')->where('payment_method', 'cash')->sum('amount');
        $creditPayments = $movements->where('type', 'payment')->where('payment_method', 'credit')->sum('amount');
        $cashIn = $movements->where('type', 'cash_in')->sum('amount');
        $cashOut = $movements->where('type', 'cash_out')->sum('amount');
        $refunds = $movements->where('type', 'refund')->sum('amount');

        return response()->json([
            'success' => true,
            'summary' => [
                'shift_id' => $shift->id,
                'opened_at' => $shift->opened_at->format('H:i'),
                'cashier' => $shift->user->name ?? '—',
                'opening_balance' => (float) $shift->opening_balance,
                'cash_payments' => round($cashPayments, 2),
                'credit_payments' => round($creditPayments, 2),
                'cash_in' => round($cashIn, 2),
                'cash_out' => round($cashOut, 2),
                'refunds' => round($refunds, 2),
                'expected_in_register' => round(
                    (float) $shift->opening_balance + $cashPayments + $cashIn - $cashOut - $refunds,
                    2
                ),
                'total_sales' => round($cashPayments + $creditPayments, 2),
                'order_count' => $movements->where('type', 'payment')->count(),
                'movements' => $movements->map(fn($m) => [
                    'id' => $m->id,
                    'type' => $m->type,
                    'payment_method' => $m->payment_method,
                    'amount' => (float) $m->amount,
                    'description' => $m->description,
                    'time' => $m->created_at->format('H:i'),
                ])->values(),
            ],
        ]);
    }

    public function getClockedInEmployees(Request $request)
    {
        $user = $request->user();
        $restaurantId = $user->restaurant_id;

        $logs = EmployeeTimeLog::where('restaurant_id', $restaurantId)
            ->whereNull('clock_out')
            ->with('user:id,name,role')
            ->orderBy('clock_in', 'desc')
            ->get()
            ->map(fn($log) => [
                'id' => $log->id,
                'user_id' => $log->user_id,
                'employee_name' => $log->user->name ?? '—',
                'role' => $log->user->role ?? '—',
                'clock_in' => $log->clock_in->format('H:i'),
                'minutes_active' => (int) $log->clock_in->diffInMinutes(Carbon::now()),
            ]);

        return response()->json(['success' => true, 'employees' => $logs]);
    }

    // ─── POS Orders ───

    public function getOrders(Request $request)
    {
        $user = $request->user();
        $restaurantId = $user->restaurant_id;

        $orders = Order::withoutGlobalScopes()
            ->where('restaurant_id', $restaurantId)
            ->whereDate('created_at', Carbon::today())
            ->orderBy('created_at', 'desc')
            ->with('items.menuItem')
            ->limit(100)
            ->get()
            ->map(fn($o) => $this->formatOrder($o));

        return response()->json(['success' => true, 'orders' => $orders]);
    }

    public function createOrder(Request $request)
    {
        $request->validate([
            'items' => 'required|array|min:1',
            'items.*.menu_item_id' => 'required|integer',
            'items.*.name' => 'required|string',
            'items.*.price' => 'required|numeric|min:0',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.variant_name' => 'nullable|string',
            'items.*.addons' => 'nullable|array',
            'payment_method' => 'required|in:cash,credit,hold',
            'amount_tendered' => 'nullable|numeric|min:0',
            'customer_name' => 'nullable|string|max:100',
            'notes' => 'nullable|string|max:500',
            'discount_type' => 'nullable|in:percentage,fixed',
            'discount_value' => 'nullable|numeric|min:0',
            'discount_reason' => 'nullable|string|max:255',
        ]);

        $user = $request->user();
        $restaurantId = $user->restaurant_id;
        $restaurant = Restaurant::find($restaurantId);
        $tenantId = $restaurant?->tenant_id;

        $totalAmount = 0;
        foreach ($request->items as $item) {
            $totalAmount += $item['price'] * $item['quantity'];
            if (!empty($item['addons'])) {
                foreach ($item['addons'] as $addon) {
                    $totalAmount += ($addon['price'] ?? 0) * ($item['quantity'] ?? 1);
                }
            }
        }

        // הנחה
        $discountAmount = 0;
        if ($request->discount_type && $request->discount_value > 0) {
            if ($request->discount_type === 'percentage') {
                $discountAmount = round($totalAmount * ($request->discount_value / 100), 2);
            } else {
                $discountAmount = min($request->discount_value, $totalAmount);
            }
            $totalAmount = round($totalAmount - $discountAmount, 2);
        }

        $isHold = $request->payment_method === 'hold';
        $paymentMethod = $isHold ? 'cash' : ($request->payment_method === 'credit' ? 'credit_card' : 'cash');
        $paymentStatus = $isHold ? 'pending' : ($request->payment_method === 'cash' ? 'paid' : 'pending');

        $order = Order::create([
            'restaurant_id' => $restaurantId,
            'tenant_id' => $tenantId,
            'correlation_id' => Str::uuid()->toString(),
            'customer_name' => $request->customer_name ?: 'POS',
            'customer_phone' => '0000000000',
            'delivery_method' => 'pickup',
            'payment_method' => $paymentMethod,
            'payment_status' => $paymentStatus,
            'status' => 'received',
            'total_amount' => $totalAmount,
            'source' => 'pos',
            'notes' => $request->notes,
            'discount_type' => $request->discount_type,
            'discount_value' => $request->discount_value,
            'discount_reason' => $request->discount_reason,
            'promotion_discount' => $discountAmount,
        ]);

        foreach ($request->items as $item) {
            $addonTotal = 0;
            $addonsArray = [];
            if (!empty($item['addons'])) {
                foreach ($item['addons'] as $a) {
                    $addonTotal += ($a['price'] ?? 0);
                    $addonsArray[] = [
                        'name' => $a['name'] ?? '',
                        'price' => $a['price'] ?? 0,
                    ];
                }
            }
            $order->items()->create([
                'menu_item_id' => $item['menu_item_id'],
                'quantity' => $item['quantity'],
                'price_at_order' => $item['price'],
                'variant_name' => $item['variant_name'] ?? null,
                'addons' => !empty($addonsArray) ? $addonsArray : null,
                'addons_total' => $addonTotal,
            ]);
        }

        if ($request->payment_method === 'cash' && !$isHold) {
            $shift = CashRegisterShift::where('restaurant_id', $restaurantId)
                ->whereNull('closed_at')
                ->first();

            if ($shift) {
                CashMovement::create([
                    'shift_id' => $shift->id,
                    'order_id' => $order->id,
                    'user_id' => $user->id,
                    'type' => 'payment',
                    'payment_method' => 'cash',
                    'amount' => $totalAmount,
                    'description' => "הזמנה #{$order->id}",
                ]);
            }
        }

        $change = null;
        if ($request->payment_method === 'cash' && $request->amount_tendered) {
            $change = round($request->amount_tendered - $totalAmount, 2);
        }

        $printResults = ['kitchen' => 0, 'receipt' => 0];
        try {
            $printService = app(PrintService::class);
            $freshOrder = $order->fresh()->load('items.menuItem.category', 'restaurant');
            $printResults['kitchen'] = $printService->printOrder($freshOrder);
            $printResults['receipt'] = $printService->printReceipt($freshOrder, [
                'change' => $change,
            ]);
        } catch (\Exception $e) {
            Log::error('POS print failed: ' . $e->getMessage());
        }

        $this->notifyPosOrder($order, $tenantId, $restaurantId, $paymentMethod);

        return response()->json([
            'success' => true,
            'order' => $this->formatOrder($order->fresh()->load('items.menuItem')),
            'change' => $change,
            'print_jobs' => $printResults,
        ]);
    }

    public function getPendingPrintJobs(Request $request)
    {
        $user = $request->user();
        try {
            $printService = app(PrintService::class);
            $jobs = $printService->getPendingBrowserJobs($user->restaurant_id);
            return response()->json(['success' => true, 'jobs' => $jobs]);
        } catch (\Exception $e) {
            return response()->json(['success' => true, 'jobs' => []]);
        }
    }

    public function printReceipt(Request $request, $orderId)
    {
        try {
            $user = $request->user();
            $restaurantId = $user->restaurant_id;

            if (!$restaurantId) {
                return response()->json([
                    'success' => false,
                    'message' => 'לא משויכת מסעדה למשתמש — לא ניתן להדפיס',
                ], 400);
            }

            $receiptPrinters = Printer::where('restaurant_id', $restaurantId)
                ->where('is_active', true)
                ->whereIn('role', ['receipt', 'general'])
                ->count();

            if ($receiptPrinters === 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'אין מדפסת קבלות מוגדרת. הגדר מדפסת בהגדרות לפני הדפסה.',
                ], 422);
            }

            $order = Order::withoutGlobalScopes()
                ->where('restaurant_id', $restaurantId)
                ->with('items.menuItem', 'restaurant')
                ->findOrFail($orderId);

            $printService = app(PrintService::class);
            $jobs = $printService->printReceipt($order);

            return response()->json([
                'success' => true,
                'message' => $jobs > 0 ? "נשלחו {$jobs} הדפסות" : 'המדפסת מוגדרת אך ההדפסה לא נשלחה',
                'jobs' => $jobs,
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'ההזמנה לא נמצאה',
            ], 404);
        } catch (\Exception $e) {
            Log::error('Receipt print failed: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'שגיאה בהדפסת קבלה: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function printKitchenTicket(Request $request, $orderId)
    {
        try {
            $user = $request->user();
            $restaurantId = $user->restaurant_id;

            if (!$restaurantId) {
                return response()->json([
                    'success' => false,
                    'message' => 'לא משויכת מסעדה למשתמש — לא ניתן להדפיס',
                ], 400);
            }

            $kitchenPrinters = Printer::where('restaurant_id', $restaurantId)
                ->where('is_active', true)
                ->whereIn('role', ['kitchen', 'general'])
                ->count();

            if ($kitchenPrinters === 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'אין מדפסת מטבח מוגדרת. הגדר מדפסת בהגדרות לפני הדפסה.',
                ], 422);
            }

            $order = Order::withoutGlobalScopes()
                ->where('restaurant_id', $restaurantId)
                ->with('items.menuItem.category', 'restaurant')
                ->findOrFail($orderId);

            $printService = app(PrintService::class);
            $jobs = $printService->printOrder($order);

            return response()->json([
                'success' => true,
                'message' => $jobs > 0 ? "נשלחו {$jobs} הדפסות למטבח" : 'המדפסת מוגדרת אך ההדפסה לא נשלחה',
                'jobs' => $jobs,
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'ההזמנה לא נמצאה',
            ], 404);
        } catch (\Exception $e) {
            Log::error('Kitchen print failed: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'שגיאה בהדפסה למטבח: ' . $e->getMessage(),
            ], 500);
        }
    }

    // ─── Credit Card Payment (PinPad) ───

    /**
     * יצירת הזמנה חדשה + חיוב אשראי דרך PinPad
     */
    public function createOrderCredit(Request $request)
    {
        $request->validate([
            'items' => 'required|array|min:1',
            'items.*.menu_item_id' => 'required|integer',
            'items.*.name' => 'required|string',
            'items.*.price' => 'required|numeric|min:0',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.variant_name' => 'nullable|string',
            'items.*.addons' => 'nullable|array',
            'customer_name' => 'nullable|string|max:100',
            'notes' => 'nullable|string|max:500',
        ]);

        $user = $request->user();
        $restaurantId = $user->restaurant_id;
        $restaurant = Restaurant::find($restaurantId);
        $tenantId = $restaurant?->tenant_id ?? '';

        $zcredit = $restaurant ? ZCreditService::forRestaurant($restaurant) : app(ZCreditService::class);
        $paymentService = new PosPaymentService($zcredit);

        $result = $paymentService->createOrderAndCharge(
            $request->only(['items', 'customer_name', 'notes']),
            $restaurantId,
            $tenantId,
            $user->id
        );

        if ($result['success']) {
            // הדפסה
            $printResults = ['kitchen' => 0, 'receipt' => 0];
            try {
                $order = Order::withoutGlobalScopes()
                    ->where('restaurant_id', $restaurantId)
                    ->with('items.menuItem.category', 'restaurant')
                    ->find($result['order_id']);

                if ($order) {
                    $printService = app(PrintService::class);
                    $printResults['kitchen'] = $printService->printOrder($order);
                    $printResults['receipt'] = $printService->printReceipt($order);
                }
            } catch (\Exception $e) {
                Log::error('POS credit print failed: ' . $e->getMessage());
            }

            $order = Order::withoutGlobalScopes()
                ->where('restaurant_id', $restaurantId)
                ->with('items.menuItem')
                ->find($result['order_id']);

            $this->notifyPosOrder($order, $tenantId, $restaurantId, 'credit_card');

            return response()->json([
                'success'    => true,
                'message'    => 'התשלום אושר',
                'order'      => $order ? $this->formatOrder($order) : null,
                'payment'    => $result['payment'],
                'print_jobs' => $printResults,
            ]);
        }

        // תשלום נדחה — ההזמנה נוצרה אך נשארת בסטטוס pending
        return response()->json([
            'success' => false,
            'message' => $result['message'] ?? 'העסקה נדחתה',
            'order_id' => $result['order_id'] ?? null,
            'payment' => $result['payment'] ?? null,
        ], 422);
    }

    /**
     * חיוב הזמנה קיימת באשראי דרך PinPad
     */
    public function chargeOrderCredit(Request $request, $orderId, PosPaymentService $paymentService)
    {
        $user = $request->user();
        $restaurantId = $user->restaurant_id;

        $order = Order::withoutGlobalScopes()
            ->where('restaurant_id', $restaurantId)
            ->findOrFail($orderId);

        $result = $paymentService->chargeOrderCredit(
            $order->id,
            (float) $order->total_amount,
            $restaurantId,
            $user->id
        );

        $statusCode = $result['success'] ? 200 : 422;

        return response()->json($result, $statusCode);
    }

    // ─── Pending Payment Orders ───

    public function getPendingPaymentOrders(Request $request)
    {
        $user = $request->user();
        $restaurantId = $user->restaurant_id;

        $orders = Order::withoutGlobalScopes()
            ->where('restaurant_id', $restaurantId)
            ->whereNotIn('payment_status', ['paid', 'refunded'])
            ->where('status', '!=', 'cancelled')
            ->whereDate('created_at', '>=', Carbon::today()->subDays(3))
            ->orderBy('created_at', 'desc')
            ->with('items.menuItem')
            ->limit(50)
            ->get()
            ->map(fn($o) => array_merge($this->formatOrder($o), [
                'table_number' => $o->table_number,
                'order_type' => $o->order_type,
                'delivery_method' => $o->delivery_method,
            ]));

        return response()->json(['success' => true, 'orders' => $orders]);
    }

    // ─── Pay Pending Order Cash ───

    public function payPendingOrderCash(Request $request, $orderId)
    {
        $request->validate([
            'amount_tendered' => 'required|numeric|min:0',
        ]);

        $user = $request->user();
        $restaurantId = $user->restaurant_id;

        $order = Order::withoutGlobalScopes()
            ->where('restaurant_id', $restaurantId)
            ->findOrFail($orderId);

        if ($order->payment_status === 'paid') {
            return response()->json(['success' => false, 'message' => 'ההזמנה כבר שולמה'], 422);
        }

        $total = (float) $order->total_amount;
        $amountTendered = (float) $request->amount_tendered;

        if ($amountTendered < $total) {
            return response()->json(['success' => false, 'message' => 'סכום לא מספיק'], 422);
        }

        $change = round($amountTendered - $total, 2);

        // סמן כשולם
        $order->update([
            'payment_status' => 'paid',
            'payment_method' => 'cash',
        ]);

        // צור תנועת קופה
        $shift = CashRegisterShift::where('restaurant_id', $restaurantId)
            ->whereNull('closed_at')
            ->first();

        if ($shift) {
            CashMovement::create([
                'shift_id'       => $shift->id,
                'order_id'       => $order->id,
                'user_id'        => $user->id,
                'type'           => 'payment',
                'payment_method' => 'cash',
                'amount'         => $total,
                'description'    => "הזמנה #{$order->id} — תשלום מזומן",
            ]);
        }

        // הדפס קבלה
        $printResult = 0;
        try {
            $printService = app(PrintService::class);
            $freshOrder = $order->fresh()->load('items.menuItem.category', 'restaurant');
            $printResult = $printService->printReceipt($freshOrder, ['change' => $change]);
        } catch (\Exception $e) {
            Log::error('Print receipt failed for pending order cash payment: ' . $e->getMessage());
        }

        // בדוק אם יש שולחן פתוח מחובר להזמנה וסגור אותו
        $closedTab = null;
        if ($order->table_number) {
            $tab = TableTab::where('restaurant_id', $restaurantId)
                ->where('order_id', $order->id)
                ->where('status', 'open')
                ->first();

            if ($tab) {
                $tab->update([
                    'status'    => 'closed',
                    'closed_at' => Carbon::now(),
                ]);
                $closedTab = [
                    'id'           => $tab->id,
                    'table_number' => $tab->table_number,
                ];
            }
        }

        return response()->json([
            'success'    => true,
            'message'    => 'שולם בהצלחה',
            'order_id'   => $order->id,
            'change'     => $change,
            'total'      => $total,
            'closed_tab' => $closedTab,
            'print_jobs' => $printResult,
        ]);
    }

    // ─── Split Payment ───

    public function splitPayment(Request $request, $orderId, PosPaymentService $paymentService)
    {
        $request->validate([
            'cash_amount' => 'required|numeric|min:0',
            'credit_amount' => 'required|numeric|min:0',
        ]);

        $user = $request->user();
        $restaurantId = $user->restaurant_id;

        $order = Order::withoutGlobalScopes()
            ->where('restaurant_id', $restaurantId)
            ->findOrFail($orderId);

        if ($order->payment_status === 'paid') {
            return response()->json(['success' => false, 'message' => 'ההזמנה כבר שולמה'], 422);
        }

        $cashAmount = (float) $request->cash_amount;
        $creditAmount = (float) $request->credit_amount;
        $total = (float) $order->total_amount;

        if (round($cashAmount + $creditAmount, 2) < round($total, 2)) {
            return response()->json(['success' => false, 'message' => 'סכום התשלום נמוך מסכום ההזמנה'], 422);
        }

        // חיוב אשראי אם יש
        $paymentResult = null;
        if ($creditAmount > 0) {
            $restaurant = Restaurant::find($restaurantId);
            $zcredit = $restaurant ? ZCreditService::forRestaurant($restaurant) : app(ZCreditService::class);
            $result = $zcredit->chargePinPad($creditAmount, 'split_' . $order->id);

            if (!$result['success']) {
                return response()->json([
                    'success' => false,
                    'message' => $result['data']['error_message'] ?? 'העסקה נדחתה',
                ], 422);
            }

            $paymentResult = $result['data'];
        }

        DB::transaction(function () use ($order, $cashAmount, $creditAmount, $paymentResult, $restaurantId, $user) {
            // רישום חלק האשראי
            if ($creditAmount > 0 && $paymentResult) {
                Payment::create([
                    'order_id'          => $order->id,
                    'restaurant_id'     => $restaurantId,
                    'provider'          => 'zcredit',
                    'amount'            => $creditAmount,
                    'currency'          => 'ILS',
                    'status'            => 'approved',
                    'transaction_id'    => $paymentResult['transaction_id'],
                    'approval_code'     => $paymentResult['approval_code'],
                    'voucher_number'    => $paymentResult['voucher_number'],
                    'provider_response' => $paymentResult['full_response'],
                ]);
            }

            // עדכון ההזמנה
            $order->update([
                'payment_method'         => $creditAmount > 0 ? 'credit_card' : 'cash',
                'payment_status'         => 'paid',
                'payment_transaction_id' => $paymentResult['transaction_id'] ?? null,
                'paid_at'                => now(),
            ]);

            // רישום בקופה
            $shift = CashRegisterShift::where('restaurant_id', $restaurantId)
                ->whereNull('closed_at')
                ->first();

            if ($shift) {
                if ($cashAmount > 0) {
                    CashMovement::create([
                        'shift_id'       => $shift->id,
                        'order_id'       => $order->id,
                        'user_id'        => $user->id,
                        'type'           => 'payment',
                        'payment_method' => 'cash',
                        'amount'         => $cashAmount,
                        'description'    => "הזמנה #{$order->id} — מזומן (מפוצל)",
                    ]);
                }
                if ($creditAmount > 0) {
                    CashMovement::create([
                        'shift_id'       => $shift->id,
                        'order_id'       => $order->id,
                        'user_id'        => $user->id,
                        'type'           => 'payment',
                        'payment_method' => 'credit',
                        'amount'         => $creditAmount,
                        'description'    => "הזמנה #{$order->id} — אשראי (מפוצל)",
                    ]);
                }
            }
        });

        return response()->json([
            'success' => true,
            'message' => 'התשלום המפוצל אושר',
            'payment' => $paymentResult ? [
                'transaction_id' => $paymentResult['transaction_id'],
                'approval_code'  => $paymentResult['approval_code'],
                'card_last4'     => $paymentResult['card_last4'] ?? null,
            ] : null,
        ]);
    }

    // ─── Refund ───

    public function refundOrder(Request $request, $orderId)
    {
        $user = $request->user();
        $restaurantId = $user->restaurant_id;

        $order = Order::withoutGlobalScopes()
            ->where('restaurant_id', $restaurantId)
            ->findOrFail($orderId);

        if ($order->payment_status !== 'paid') {
            return response()->json(['success' => false, 'message' => 'ההזמנה לא שולמה — לא ניתן לבצע החזר'], 422);
        }

        // מציאת עסקת האשראי
        $payment = Payment::where('order_id', $order->id)
            ->where('status', 'approved')
            ->latest()
            ->first();

        $referenceNumber = $payment?->transaction_id ?? $order->payment_transaction_id;

        if ($order->payment_method === 'credit_card' && $referenceNumber) {
            // החזר דרך ZCredit
            $restaurant = Restaurant::find($restaurantId);
            $zcredit = $restaurant ? ZCreditService::forRestaurant($restaurant) : app(ZCreditService::class);
            $result = $zcredit->refundTransaction($referenceNumber, (float) $order->total_amount);

            if (!$result['success']) {
                return response()->json([
                    'success' => false,
                    'message' => $result['data']['error_message'] ?? 'שגיאה בביצוע ההחזר',
                ], 422);
            }

            if ($payment) {
                $payment->update([
                    'status'            => 'refunded',
                    'provider_response' => $result['data']['full_response'],
                ]);
            }
        }

        DB::transaction(function () use ($order, $restaurantId, $user) {
            $order->update([
                'payment_status' => 'refunded',
            ]);

            $shift = CashRegisterShift::where('restaurant_id', $restaurantId)
                ->whereNull('closed_at')
                ->first();

            if ($shift) {
                CashMovement::create([
                    'shift_id'       => $shift->id,
                    'order_id'       => $order->id,
                    'user_id'        => $user->id,
                    'type'           => 'refund',
                    'payment_method' => $order->payment_method === 'credit_card' ? 'credit' : 'cash',
                    'amount'         => (float) $order->total_amount,
                    'description'    => "החזר הזמנה #{$order->id}",
                ]);
            }
        });

        // --- Refund notifications ---
        try {
            $restaurant = Restaurant::find($restaurantId);
            $tenantId = $restaurant?->tenant_id;
            if ($tenantId) {
                MonitoringAlert::create([
                    'tenant_id'     => $tenantId,
                    'restaurant_id' => $restaurantId,
                    'alert_type'    => 'order_refunded',
                    'title'         => "החזר כספי — הזמנה #{$order->id}",
                    'body'          => "בוצע החזר כספי בסך ₪{$order->total_amount} עבור הזמנה #{$order->id} ({$order->customer_name}) על ידי {$user->name}.",
                    'severity'      => 'warning',
                    'metadata'      => ['order_id' => $order->id, 'amount' => $order->total_amount, 'refunded_by' => $user->name],
                    'is_read'       => false,
                ]);
                NotificationLog::create([
                    'channel'               => 'system',
                    'type'                  => 'order_alert',
                    'title'                 => "החזר POS: " . ($restaurant->name ?? '') . " — #{$order->id}",
                    'body'                  => "החזר ₪{$order->total_amount} בוצע להזמנה #{$order->id} ({$order->customer_name}) על ידי {$user->name}.",
                    'sender_id'             => null,
                    'target_restaurant_ids' => [$restaurantId],
                    'tokens_targeted'       => 0,
                    'sent_ok'               => 0,
                    'metadata'              => ['action' => 'pos_refund', 'order_id' => $order->id, 'amount' => $order->total_amount],
                ]);
            }
        } catch (\Throwable $e) {
            Log::warning('Failed to create refund notification', ['error' => $e->getMessage()]);
        }

        return response()->json([
            'success' => true,
            'message' => 'ההחזר בוצע בהצלחה',
        ]);
    }

    // ─── Table Tabs ───

    public function openTab(Request $request)
    {
        $request->validate([
            'table_number' => 'required|string|max:20',
            'items' => 'nullable|array',
            'items.*.menu_item_id' => 'required_with:items|integer',
            'items.*.name' => 'required_with:items|string',
            'items.*.price' => 'required_with:items|numeric|min:0',
            'items.*.quantity' => 'required_with:items|integer|min:1',
            'items.*.variant_name' => 'nullable|string',
            'items.*.addons' => 'nullable|array',
        ]);

        $user = $request->user();
        $restaurantId = $user->restaurant_id;
        $restaurant = Restaurant::find($restaurantId);
        $tenantId = $restaurant?->tenant_id ?? '';

        // בדיקה אם יש טאב פתוח לשולחן זה
        $existingTab = TableTab::where('restaurant_id', $restaurantId)
            ->where('table_number', $request->table_number)
            ->where('status', 'open')
            ->first();

        if ($existingTab) {
            return response()->json([
                'success' => false,
                'message' => "כבר יש חשבון פתוח לשולחן {$request->table_number}",
                'tab' => $this->formatTab($existingTab->load('order.items.menuItem')),
            ], 409);
        }

        // חישוב סכום פריטים ראשוניים
        $totalAmount = 0;
        $items = $request->items ?? [];
        foreach ($items as $item) {
            $totalAmount += $item['price'] * $item['quantity'];
            if (!empty($item['addons'])) {
                foreach ($item['addons'] as $addon) {
                    $totalAmount += ($addon['price'] ?? 0) * ($item['quantity'] ?? 1);
                }
            }
        }

        $order = Order::create([
            'restaurant_id'  => $restaurantId,
            'tenant_id'      => $tenantId,
            'correlation_id' => Str::uuid()->toString(),
            'customer_name'  => "שולחן {$request->table_number}",
            'customer_phone' => '0000000000',
            'delivery_method' => 'pickup',
            'payment_method' => 'cash',
            'payment_status' => 'pending',
            'status'         => 'received',
            'total_amount'   => $totalAmount,
            'source'         => 'pos',
            'order_type'     => 'dine_in',
            'table_number'   => $request->table_number,
        ]);

        // פריטים ראשוניים
        foreach ($items as $item) {
            $addonTotal = 0;
            $addonsArray = [];
            if (!empty($item['addons'])) {
                foreach ($item['addons'] as $a) {
                    $addonTotal += ($a['price'] ?? 0);
                    $addonsArray[] = ['name' => $a['name'] ?? '', 'price' => $a['price'] ?? 0];
                }
            }
            $order->items()->create([
                'menu_item_id'  => $item['menu_item_id'],
                'quantity'      => $item['quantity'],
                'price_at_order' => $item['price'],
                'variant_name'  => $item['variant_name'] ?? null,
                'addons'        => !empty($addonsArray) ? $addonsArray : null,
                'addons_total'  => $addonTotal,
            ]);
        }

        $tab = TableTab::create([
            'restaurant_id' => $restaurantId,
            'table_number'  => $request->table_number,
            'order_id'      => $order->id,
            'status'        => 'open',
            'opened_by'     => $user->id,
            'opened_at'     => Carbon::now(),
        ]);

        // הדפסת מטבח אם יש פריטים
        if (count($items) > 0) {
            try {
                $printService = app(PrintService::class);
                $freshOrder = $order->fresh()->load('items.menuItem.category', 'restaurant');
                $printService->printOrder($freshOrder);
            } catch (\Exception $e) {
                Log::error('Tab kitchen print failed: ' . $e->getMessage());
            }
        }

        return response()->json([
            'success' => true,
            'tab' => $this->formatTab($tab->load('order.items.menuItem')),
        ]);
    }

    public function getOpenTabs(Request $request)
    {
        $user = $request->user();
        $restaurantId = $user->restaurant_id;

        $tabs = TableTab::where('restaurant_id', $restaurantId)
            ->where('status', 'open')
            ->with(['order.items.menuItem', 'openedBy:id,name'])
            ->orderBy('opened_at', 'desc')
            ->get()
            ->map(fn($tab) => $this->formatTab($tab));

        return response()->json(['success' => true, 'tabs' => $tabs]);
    }

    public function getTab(Request $request, $id)
    {
        $user = $request->user();
        $restaurantId = $user->restaurant_id;

        $tab = TableTab::where('restaurant_id', $restaurantId)
            ->with(['order.items.menuItem', 'openedBy:id,name'])
            ->findOrFail($id);

        return response()->json(['success' => true, 'tab' => $this->formatTab($tab)]);
    }

    public function addItemsToTab(Request $request, $id)
    {
        $request->validate([
            'items' => 'required|array|min:1',
            'items.*.menu_item_id' => 'required|integer',
            'items.*.name' => 'required|string',
            'items.*.price' => 'required|numeric|min:0',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.variant_name' => 'nullable|string',
            'items.*.addons' => 'nullable|array',
        ]);

        $user = $request->user();
        $restaurantId = $user->restaurant_id;

        $tab = TableTab::where('restaurant_id', $restaurantId)
            ->where('status', 'open')
            ->findOrFail($id);

        $order = Order::withoutGlobalScopes()->findOrFail($tab->order_id);

        $addedAmount = 0;
        foreach ($request->items as $item) {
            $addonTotal = 0;
            $addonsArray = [];
            if (!empty($item['addons'])) {
                foreach ($item['addons'] as $a) {
                    $addonTotal += ($a['price'] ?? 0);
                    $addonsArray[] = ['name' => $a['name'] ?? '', 'price' => $a['price'] ?? 0];
                }
            }

            $itemTotal = ($item['price'] + $addonTotal) * $item['quantity'];
            $addedAmount += $itemTotal;

            $order->items()->create([
                'menu_item_id'  => $item['menu_item_id'],
                'quantity'      => $item['quantity'],
                'price_at_order' => $item['price'],
                'variant_name'  => $item['variant_name'] ?? null,
                'addons'        => !empty($addonsArray) ? $addonsArray : null,
                'addons_total'  => $addonTotal,
            ]);
        }

        $order->update([
            'total_amount' => (float) $order->total_amount + $addedAmount,
        ]);

        // הדפסת מטבח לפריטים חדשים
        try {
            $printService = app(PrintService::class);
            $freshOrder = $order->fresh()->load('items.menuItem.category', 'restaurant');
            $printService->printOrder($freshOrder);
        } catch (\Exception $e) {
            Log::error('Tab add items kitchen print failed: ' . $e->getMessage());
        }

        return response()->json([
            'success' => true,
            'tab' => $this->formatTab($tab->fresh()->load('order.items.menuItem')),
        ]);
    }

    public function closeTab(Request $request, $id)
    {
        $user = $request->user();
        $restaurantId = $user->restaurant_id;

        $tab = TableTab::where('restaurant_id', $restaurantId)
            ->where('status', 'open')
            ->findOrFail($id);

        $tab->update([
            'status'    => 'closed',
            'closed_at' => Carbon::now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => "שולחן {$tab->table_number} נסגר",
            'order_id' => $tab->order_id,
            'total' => (float) $tab->order?->total_amount,
        ]);
    }

    // ─── Manager PIN verification (no session creation) ───

    public function verifyManagerPin(Request $request)
    {
        $request->validate(['pin' => 'required|string|size:4']);

        $user = $request->user();

        if (!$user->pos_pin_hash || !Hash::check($request->pin, $user->pos_pin_hash)) {
            return response()->json(['success' => false, 'message' => 'קוד מנהל שגוי'], 422);
        }

        return response()->json(['success' => true, 'message' => 'אומת בהצלחה']);
    }

    // ─── Remove item from tab ───

    public function removeTabItem(Request $request, $tabId, $itemId)
    {
        $user = $request->user();
        $restaurantId = $user->restaurant_id;

        $tab = TableTab::where('restaurant_id', $restaurantId)
            ->where('status', 'open')
            ->findOrFail($tabId);

        $order = Order::withoutGlobalScopes()->findOrFail($tab->order_id);

        $item = $order->items()->findOrFail($itemId);

        $itemTotal = (float) $item->price_at_order * (int) $item->quantity;
        if ($item->addons_total) {
            $itemTotal += (float) $item->addons_total * (int) $item->quantity;
        }

        $item->delete();

        $order->update([
            'total_amount' => max(0, (float) $order->total_amount - $itemTotal),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'הפריט הוסר',
            'tab' => $this->formatTab($tab->fresh()->load('order.items.menuItem')),
        ]);
    }

    // ─── Helpers ───

    private function buildZReport(CashRegisterShift $shift): array
    {
        $movements = $shift->movements()->with('order')->get();

        $cashPayments = $movements->where('type', 'payment')->where('payment_method', 'cash')->sum('amount');
        $creditPayments = $movements->where('type', 'payment')->where('payment_method', 'credit')->sum('amount');
        $cashIn = $movements->where('type', 'cash_in')->sum('amount');
        $cashOut = $movements->where('type', 'cash_out')->sum('amount');
        $refunds = $movements->where('type', 'refund')->sum('amount');
        $cashRefunds = $movements->where('type', 'refund')->where('payment_method', 'cash')->sum('amount');

        $paymentCount = $movements->where('type', 'payment')->count();
        $cashPaymentCount = $movements->where('type', 'payment')->where('payment_method', 'cash')->count();
        $creditPaymentCount = $movements->where('type', 'payment')->where('payment_method', 'credit')->count();
        $refundCount = $movements->where('type', 'refund')->count();

        $expectedBalance = round(
            (float) $shift->opening_balance + $cashPayments + $cashIn - $cashOut - $cashRefunds,
            2
        );

        $variance = $shift->closing_balance !== null
            ? round((float) $shift->closing_balance - $expectedBalance, 2)
            : null;

        $endTime = $shift->closed_at ?? Carbon::now();
        $shiftOrders = Order::withoutGlobalScopes()
            ->where('restaurant_id', $shift->restaurant_id)
            ->where('created_at', '>=', $shift->opened_at)
            ->where('created_at', '<=', $endTime)
            ->orderBy('id')
            ->get();

        $trackedOrderIds = $movements->where('type', 'payment')->pluck('order_id')->filter()->toArray();

        $ordersForReport = $shiftOrders->map(fn($o) => [
            'id' => $o->id,
            'customer_name' => $o->customer_name,
            'total' => (float) $o->total_amount,
            'payment_method' => $o->payment_method === 'credit_card' ? 'אשראי' : 'מזומן',
            'payment_status' => $o->payment_status === 'paid' ? 'שולם' : ($o->payment_status === 'cancelled' ? 'בוטל' : 'ממתין'),
            'status' => $o->status,
            'source' => $o->source ?? 'website',
            'time' => $o->created_at->format('H:i'),
            'tracked' => in_array($o->id, $trackedOrderIds),
        ])->toArray();

        $untrackedCash = collect($ordersForReport)
            ->filter(fn($o) => !$o['tracked'] && $o['payment_method'] === 'מזומן' && $o['payment_status'] === 'שולם' && $o['status'] !== 'cancelled')
            ->values();

        return [
            'shift_id' => $shift->id,
            'cashier' => $shift->user->name ?? '—',
            'opened_at' => $shift->opened_at->format('d/m/Y H:i'),
            'closed_at' => $shift->closed_at?->format('d/m/Y H:i'),
            'duration_minutes' => (int) ($shift->closed_at
                ? $shift->opened_at->diffInMinutes($shift->closed_at)
                : $shift->opened_at->diffInMinutes(Carbon::now())),

            'opening_balance' => (float) $shift->opening_balance,
            'closing_balance' => $shift->closing_balance !== null ? (float) $shift->closing_balance : null,
            'expected_balance' => $expectedBalance,
            'variance' => $variance,

            'total_sales' => round($cashPayments + $creditPayments, 2),
            'cash_payments' => round($cashPayments, 2),
            'cash_payment_count' => $cashPaymentCount,
            'credit_payments' => round($creditPayments, 2),
            'credit_payment_count' => $creditPaymentCount,
            'total_payment_count' => $paymentCount,

            'cash_in' => round($cashIn, 2),
            'cash_out' => round($cashOut, 2),
            'refunds' => round($refunds, 2),
            'refund_count' => $refundCount,

            'movements' => $movements->map(fn($m) => [
                'id' => $m->id,
                'type' => $m->type,
                'payment_method' => $m->payment_method,
                'amount' => (float) $m->amount,
                'description' => $m->description,
                'order_id' => $m->order_id,
                'time' => $m->created_at->format('H:i'),
            ])->values()->toArray(),

            'orders' => $ordersForReport,
            'untracked_cash_orders' => $untrackedCash->toArray(),
        ];
    }

    private function calculateExpectedBalance(CashRegisterShift $shift): float
    {
        $movements = $shift->movements()->get();
        $cashPayments = $movements->where('type', 'payment')->where('payment_method', 'cash')->sum('amount');
        $cashIn = $movements->where('type', 'cash_in')->sum('amount');
        $cashOut = $movements->where('type', 'cash_out')->sum('amount');
        $refunds = $movements->where('type', 'refund')->where('payment_method', 'cash')->sum('amount');

        return round((float) $shift->opening_balance + $cashPayments + $cashIn - $cashOut - $refunds, 2);
    }

    private function formatShift(CashRegisterShift $shift): array
    {
        $expected = $this->calculateExpectedBalance($shift);

        return [
            'id' => $shift->id,
            'cashier' => $shift->user->name ?? '—',
            'opened_at' => $shift->opened_at->format('Y-m-d H:i'),
            'closed_at' => $shift->closed_at?->format('Y-m-d H:i'),
            'opening_balance' => (float) $shift->opening_balance,
            'closing_balance' => $shift->closing_balance ? (float) $shift->closing_balance : null,
            'expected_balance' => $expected,
            'is_open' => $shift->isOpen(),
            'notes' => $shift->notes,
        ];
    }

    private function formatOrder(Order $order): array
    {
        return [
            'id' => $order->id,
            'customer_name' => $order->customer_name,
            'status' => $order->status,
            'delivery_method' => $order->delivery_method ?? 'pickup',
            'payment_method' => $order->payment_method,
            'payment_status' => $order->payment_status,
            'total_price' => (float) $order->total_amount,
            'source' => $order->source ?? 'website',
            'notes' => $order->notes,
            'table_number' => $order->table_number,
            'created_at' => $order->created_at->format('H:i'),
            'discount_type' => $order->discount_type,
            'discount_value' => $order->discount_value ? (float) $order->discount_value : null,
            'discount_reason' => $order->discount_reason,
            'promotion_discount' => (float) ($order->promotion_discount ?? 0),
            'items' => $order->items->map(fn($i) => [
                'id' => $i->id,
                'name' => $i->name,
                'quantity' => (int) $i->quantity,
                'unit_price' => (float) $i->price_at_order,
                'variant_name' => $i->variant_name,
                'addons_text' => $i->addons
                    ? collect($i->addons)->map(function ($a) {
                        $name = $a['name'] ?? '';
                        $qty = (int) ($a['quantity'] ?? 1);
                        return $qty > 1 ? "{$name} ×{$qty}" : $name;
                    })->filter()->join(', ')
                    : null,
            ])->toArray(),
        ];
    }

    private function formatTab(TableTab $tab): array
    {
        $order = $tab->order;
        return [
            'id'            => $tab->id,
            'table_number'  => $tab->table_number,
            'status'        => $tab->status,
            'opened_by'     => $tab->openedBy?->name ?? '—',
            'opened_at'     => $tab->opened_at->format('H:i'),
            'closed_at'     => $tab->closed_at?->format('H:i'),
            'minutes_open'  => (int) $tab->opened_at->diffInMinutes(Carbon::now()),
            'order_id'      => $tab->order_id,
            'total'         => $order ? (float) $order->total_amount : 0,
            'item_count'    => $order ? $order->items->sum('quantity') : 0,
            'payment_status' => $order?->payment_status ?? 'pending',
            'items'         => $order ? $order->items->map(fn($i) => [
                'id'         => $i->id,
                'name'       => $i->menuItem?->name ?? $i->name ?? 'פריט',
                'quantity'   => (int) $i->quantity,
                'unit_price' => (float) $i->price_at_order,
                'variant_name' => $i->variant_name,
                'addons_text' => $i->addons
                    ? collect($i->addons)->map(fn($a) => $a['name'] ?? '')->filter()->join(', ')
                    : null,
            ])->toArray() : [],
        ];
    }

    /**
     * רישום התראות עבור הזמנת POS חדשה
     */
    private function notifyPosOrder(?Order $order, string $tenantId, int $restaurantId, string $paymentMethod): void
    {
        if (!$order || !$tenantId) return;

        try {
            $methodLabel = $paymentMethod === 'credit_card' ? 'אשראי' : 'מזומן';
            $restaurant = Restaurant::find($restaurantId);

            MonitoringAlert::create([
                'tenant_id'     => $tenantId,
                'restaurant_id' => $restaurantId,
                'alert_type'    => 'new_order',
                'title'         => "הזמנת POS #{$order->id}",
                'body'          => "{$order->customer_name} — ₪{$order->total_amount} ({$methodLabel})",
                'severity'      => 'info',
                'metadata'      => ['order_id' => $order->id, 'source' => 'pos', 'payment_method' => $paymentMethod],
                'is_read'       => false,
            ]);

            NotificationLog::create([
                'channel'               => 'system',
                'type'                  => 'order_alert',
                'title'                 => "הזמנת POS: " . ($restaurant->name ?? '') . " — #{$order->id}",
                'body'                  => "{$order->customer_name} — ₪{$order->total_amount} ({$methodLabel})",
                'sender_id'             => null,
                'target_restaurant_ids' => [$restaurantId],
                'tokens_targeted'       => 0,
                'sent_ok'               => 0,
                'metadata'              => ['action' => 'pos_order', 'order_id' => $order->id, 'source' => 'pos', 'payment_method' => $paymentMethod],
            ]);

            // FCM push לסופר אדמין
            $superAdmins = User::where('is_super_admin', true)->pluck('id');
            if ($superAdmins->isNotEmpty()) {
                $tokens = FcmToken::withoutGlobalScopes()
                    ->where('tenant_id', '__super_admin__')
                    ->whereIn('user_id', $superAdmins)
                    ->pluck('token');

                if ($tokens->isNotEmpty()) {
                    $fcm = app(FcmService::class);
                    foreach ($tokens as $token) {
                        $fcm->sendToToken($token, "הזמנת POS — " . ($restaurant->name ?? ''), "{$order->customer_name} — ₪{$order->total_amount}", [
                            'type'    => 'super_admin_order_alert',
                            'orderId' => (string) $order->id,
                            'tenantId' => $tenantId,
                        ]);
                    }
                }
            }
        } catch (\Throwable $e) {
            Log::warning('Failed to create POS order notification', ['order_id' => $order->id, 'error' => $e->getMessage()]);
        }
    }
}
