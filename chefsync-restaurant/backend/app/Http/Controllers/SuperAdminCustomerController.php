<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\CustomerRestaurantNotificationOptIn;
use App\Models\EmailLog;
use App\Models\NotificationLog;
use App\Models\Order;
use App\Services\FcmService;
use App\Services\SmsService;
use Illuminate\Http\Request;

class SuperAdminCustomerController extends Controller
{
    /**
     * אם צוינה מסעדה — שולחים פוש רק אם הלקוח אישר התראות מהמסעדה הזו.
     */
    private function customerAllowsPushForTenant(Customer $customer, ?string $tenantId): bool
    {
        if ($tenantId === null || trim((string) $tenantId) === '') {
            return true;
        }

        return CustomerRestaurantNotificationOptIn::query()
            ->where('customer_id', $customer->id)
            ->where('tenant_id', $tenantId)
            ->where('enabled', true)
            ->exists();
    }

    public function index(Request $request)
    {
        $query = Customer::query()->withCount('pushTokens');

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('phone', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }

        if ($request->boolean('registered_only')) {
            $query->where('is_registered', true);
        }

        if ($request->boolean('has_orders')) {
            $query->where('total_orders', '>', 0);
        }

        if ($request->boolean('has_email')) {
            $query->whereNotNull('email')->where('email', '!=', '');
        }

        if ($request->boolean('guest_with_orders')) {
            $query->where('is_registered', false)->where('total_orders', '>', 0);
        }

        if ($request->boolean('has_pwa')) {
            $query->whereNotNull('pwa_installed_at');
        }

        if ($request->boolean('pwa_no_push')) {
            $query->whereNotNull('pwa_installed_at')->whereDoesntHave('pushTokens');
        }

        $inactiveDays = (int) $request->input('inactive_days', 0);
        if ($inactiveDays > 0) {
            $cutoff = now()->subDays($inactiveDays);
            $query->where(function ($q) use ($cutoff) {
                $q->where(function ($q2) use ($cutoff) {
                    $q2->whereNotNull('last_order_at')->where('last_order_at', '<', $cutoff);
                })->orWhere(function ($q2) use ($cutoff) {
                    $q2->whereNull('last_order_at')->where('created_at', '<', $cutoff);
                });
            });
        }

        $sortField = $request->input('sort', 'created_at');
        $sortDir = $request->input('dir', 'desc');
        $allowed = ['name', 'phone', 'email', 'total_orders', 'last_order_at', 'created_at', 'pwa_installed_at', 'last_app_open_at'];
        if (!in_array($sortField, $allowed)) {
            $sortField = 'created_at';
        }

        $customers = $query->orderBy($sortField, $sortDir === 'asc' ? 'asc' : 'desc')
            ->paginate($request->input('per_page', 25));

        return response()->json(['success' => true, 'data' => $customers]);
    }

    public function show($id)
    {
        $customer = Customer::with(['addresses', 'pushTokens'])->findOrFail($id);

        $orders = Order::withoutGlobalScope('tenant')
            ->with(['items.menuItem'])
            ->withCount('items')
            ->where(function ($q) use ($customer) {
                $q->where('customer_id', $customer->id);
                if (!empty($customer->phone)) {
                    $q->orWhere('customer_phone', $customer->phone);
                }
            })
            ->orderBy('created_at', 'desc')
            ->take(50)
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'customer' => $customer,
                'orders' => $orders,
            ],
        ]);
    }

    public function update(Request $request, $id)
    {
        $customer = Customer::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:100',
            'email' => 'sometimes|nullable|email|max:200',
            'phone' => 'sometimes|string|max:15',
        ]);

        $customer->update($validated);

        return response()->json([
            'success' => true,
            'data' => $customer->fresh(),
        ]);
    }

    public function destroy($id)
    {
        $customer = Customer::findOrFail($id);
        $customer->tokens()->delete();
        $customer->delete();

        return response()->json(['success' => true, 'message' => 'לקוח נמחק']);
    }

    public function stats()
    {
        $total = Customer::count();
        $registered = Customer::where('is_registered', true)->count();
        $withOrders = Customer::where('total_orders', '>', 0)->count();
        $newThisWeek = Customer::where('created_at', '>=', now()->subWeek())->count();
        $newThisMonth = Customer::where('created_at', '>=', now()->subMonth())->count();
        $withPwa = Customer::whereNotNull('pwa_installed_at')->count();
        $withPushTokens = Customer::has('pushTokens')->count();
        $pwaNoPush = Customer::whereNotNull('pwa_installed_at')->whereDoesntHave('pushTokens')->count();
        $guestWithOrders = Customer::where('is_registered', false)->where('total_orders', '>', 0)->count();

        return response()->json([
            'success' => true,
            'data' => compact(
                'total',
                'registered',
                'withOrders',
                'newThisWeek',
                'newThisMonth',
                'withPwa',
                'withPushTokens',
                'pwaNoPush',
                'guestWithOrders'
            ),
        ]);
    }

    public function sendCustomerPush(Request $request, int $id)
    {
        $customer = Customer::with('pushTokens')->findOrFail($id);
        $validated = $request->validate([
            'title' => 'required|string|max:120',
            'body' => 'required|string|max:500',
            'for_tenant_id' => 'nullable|string|max:255',
        ]);

        if ($customer->pushTokens->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'אין טוקני פוש רשומים ללקוח זה',
            ], 422);
        }

        $forTenant = $validated['for_tenant_id'] ?? null;
        if (!$this->customerAllowsPushForTenant($customer, $forTenant)) {
            return response()->json([
                'success' => false,
                'message' => 'הלקוח לא אישר התראות מהמסעדה שצוינה',
            ], 422);
        }

        $fcm = app(FcmService::class);
        $ok = 0;
        $targeted = 0;
        foreach ($customer->pushTokens as $row) {
            $targeted++;
            if ($fcm->sendToToken($row->token, $validated['title'], $validated['body'], ['customer_id' => (string) $customer->id])) {
                $ok++;
            }
        }

        NotificationLog::create([
            'channel' => 'push',
            'type' => 'super_admin_customer_push',
            'title' => $validated['title'],
            'body' => $validated['body'],
            'sender_id' => $request->user()->id,
            'tokens_targeted' => $targeted,
            'sent_ok' => $ok,
            'metadata' => [
                'customer_id' => $customer->id,
                'for_tenant_id' => $forTenant,
            ],
        ]);

        return response()->json([
            'success' => true,
            'data' => ['sent_ok' => $ok, 'targeted' => $targeted],
        ]);
    }

    public function sendCustomerSms(Request $request, int $id)
    {
        $customer = Customer::findOrFail($id);
        $validated = $request->validate([
            'message' => 'required|string|max:500',
        ]);

        $sent = SmsService::sendPlainText($customer->phone, $validated['message']);

        NotificationLog::create([
            'channel' => 'sms',
            'type' => 'super_admin_customer_sms',
            'title' => 'SMS ללקוח',
            'body' => $validated['message'],
            'sender_id' => $request->user()->id,
            'tokens_targeted' => 1,
            'sent_ok' => $sent ? 1 : 0,
            'metadata' => [
                'customer_id' => $customer->id,
                'phone' => $customer->phone,
            ],
        ]);

        if (!$sent) {
            return response()->json([
                'success' => false,
                'message' => 'שליחת SMS נכשלה (בדוק יעד או הגדרות ספק)',
            ], 422);
        }

        return response()->json(['success' => true, 'data' => ['sent' => true]]);
    }

    public function broadcast(Request $request)
    {
        $validated = $request->validate([
            'customer_ids' => 'required|array|min:1|max:200',
            'customer_ids.*' => 'integer|exists:customers,id',
            'channel' => 'required|string|in:push,sms,both',
            'title' => 'required_unless:channel,sms|nullable|string|max:120',
            'message' => 'required|string|max:1600',
            'for_tenant_id' => 'nullable|string|max:255',
        ]);

        $forTenant = $validated['for_tenant_id'] ?? null;

        $customers = Customer::with('pushTokens')
            ->whereIn('id', $validated['customer_ids'])
            ->get();

        $fcm = app(FcmService::class);
        $pushTargeted = 0;
        $pushOk = 0;
        $smsOk = 0;
        $smsAttempted = 0;
        $perCustomer = [];

        foreach ($customers as $customer) {
            $perCustomer[$customer->id] = ['push' => null, 'sms' => null];
        }

        foreach ($customers as $customer) {
            if (in_array($validated['channel'], ['push', 'both'], true)) {
                if ($customer->pushTokens->isEmpty()) {
                    $perCustomer[$customer->id]['push'] = 'no_tokens';
                } elseif (!$this->customerAllowsPushForTenant($customer, $forTenant)) {
                    $perCustomer[$customer->id]['push'] = 'opt_out';
                } else {
                    foreach ($customer->pushTokens as $row) {
                        $pushTargeted++;
                        $t = $validated['title'] ?: 'עדכון';
                        $ok = $fcm->sendToToken($row->token, $t, $validated['message'], ['customer_id' => (string) $customer->id]);
                        if ($ok) {
                            $pushOk++;
                        }
                    }
                }
            }

            if (in_array($validated['channel'], ['sms', 'both'], true)) {
                $smsAttempted++;
                $ok = SmsService::sendPlainText($customer->phone, $validated['message']);
                $perCustomer[$customer->id]['sms'] = $ok ? 'sent' : 'failed';
                if ($ok) {
                    $smsOk++;
                }
            }
        }

        NotificationLog::create([
            'channel' => $validated['channel'] === 'both' ? 'mixed' : $validated['channel'],
            'type' => 'customer_broadcast',
            'title' => $validated['title'] ?? 'שידור לקוחות',
            'body' => $validated['message'],
            'sender_id' => $request->user()->id,
            'tokens_targeted' => $pushTargeted + $smsAttempted,
            'sent_ok' => $pushOk + $smsOk,
            'metadata' => [
                'customer_ids' => $validated['customer_ids'],
                'channel' => $validated['channel'],
                'for_tenant_id' => $forTenant,
                'push_targeted' => $pushTargeted,
                'push_ok' => $pushOk,
                'sms_attempted' => $smsAttempted,
                'sms_ok' => $smsOk,
                'per_customer' => $perCustomer,
            ],
        ]);

        return response()->json([
            'success' => true,
            'data' => [
                'push_targeted' => $pushTargeted,
                'push_ok' => $pushOk,
                'sms_attempted' => $smsAttempted,
                'sms_ok' => $smsOk,
                'per_customer' => $perCustomer,
            ],
        ]);
    }

    public function broadcastsIndex(Request $request)
    {
        $logs = NotificationLog::query()
            ->whereIn('type', ['customer_broadcast', 'super_admin_customer_push', 'super_admin_customer_sms'])
            ->with('sender:id,name')
            ->orderBy('created_at', 'desc')
            ->paginate($request->input('per_page', 25));

        return response()->json(['success' => true, 'data' => $logs]);
    }

    public function emailLog(Request $request)
    {
        $query = EmailLog::query();

        if ($type = $request->input('type')) {
            $query->where('type', $type);
        }

        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }

        if ($customerId = $request->input('customer_id')) {
            $query->where('customer_id', $customerId);
        }

        if ($dateFrom = $request->input('date_from')) {
            $query->whereDate('created_at', '>=', $dateFrom);
        }

        if ($dateTo = $request->input('date_to')) {
            $query->whereDate('created_at', '<=', $dateTo);
        }

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('to_email', 'like', "%{$search}%")
                  ->orWhere('subject', 'like', "%{$search}%");
            });
        }

        $logs = $query->with('customer:id,name,phone')
            ->orderBy('created_at', 'desc')
            ->paginate($request->input('per_page', 30));

        return response()->json(['success' => true, 'data' => $logs]);
    }
}
