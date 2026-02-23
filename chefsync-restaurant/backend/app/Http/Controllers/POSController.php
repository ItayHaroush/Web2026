<?php

namespace App\Http\Controllers;

use App\Models\CashMovement;
use App\Models\CashRegisterShift;
use App\Models\EmployeeTimeLog;
use App\Models\Order;
use App\Models\PosSession;
use App\Models\Printer;
use App\Models\Restaurant;
use App\Models\User;
use App\Services\PrintService;
use Carbon\Carbon;
use Illuminate\Http\Request;
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
            // #region agent log
            Log::info('[DEBUG-3267aa] verifyPin FAILED', ['user_id' => $user->id, 'has_pin_hash' => !!$user->pos_pin_hash, 'returning' => 401]);
            file_put_contents('/Users/itaymac/הנדסאי תוכנה המכללה למנהל/Web2026/chefsync-restaurant/.cursor/debug-3267aa.log', json_encode(['sessionId'=>'3267aa','location'=>'POSController.php:verifyPin','message'=>'PIN check failed, returning 401','data'=>['user_id'=>$user->id,'has_pin_hash'=>!!$user->pos_pin_hash],'timestamp'=>round(microtime(true)*1000),'hypothesisId'=>'H1'])."\n", FILE_APPEND);
            // #endregion
            return response()->json(['success' => false, 'message' => 'קוד PIN שגוי'], 401);
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
        $session = $request->pos_session;
        $session->update(['locked_at' => Carbon::now()]);

        return response()->json(['success' => true]);
    }

    public function unlockSession(Request $request)
    {
        $request->validate(['pin' => 'required|string|size:4']);

        $user = $request->user();

        if (!Hash::check($request->pin, $user->pos_pin_hash)) {
            return response()->json(['success' => false, 'message' => 'קוד PIN שגוי'], 401);
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
            'payment_method' => 'required|in:cash,credit',
            'amount_tendered' => 'nullable|numeric|min:0',
            'customer_name' => 'nullable|string|max:100',
            'notes' => 'nullable|string|max:500',
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

        $order = Order::create([
            'restaurant_id' => $restaurantId,
            'tenant_id' => $tenantId,
            'correlation_id' => Str::uuid()->toString(),
            'customer_name' => $request->customer_name ?: 'POS',
            'customer_phone' => '0000000000',
            'delivery_method' => 'pickup',
            'payment_method' => $request->payment_method === 'credit' ? 'credit_card' : 'cash',
            'payment_status' => $request->payment_method === 'cash' ? 'paid' : 'pending',
            'status' => 'received',
            'total_amount' => $totalAmount,
            'source' => 'pos',
            'notes' => $request->notes,
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

        if ($request->payment_method === 'cash') {
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
            'payment_method' => $order->payment_method,
            'payment_status' => $order->payment_status,
            'total_price' => (float) $order->total_amount,
            'source' => $order->source ?? 'website',
            'notes' => $order->notes,
            'created_at' => $order->created_at->format('H:i'),
            'items' => $order->items->map(fn($i) => [
                'id' => $i->id,
                'name' => $i->name,
                'quantity' => (int) $i->quantity,
                'unit_price' => (float) $i->price_at_order,
                'variant_name' => $i->variant_name,
                'addons_text' => $i->addons
                    ? collect($i->addons)->pluck('name')->filter()->join(', ')
                    : null,
            ])->toArray(),
        ];
    }
}
