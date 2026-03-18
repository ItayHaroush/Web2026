<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\EmailLog;
use App\Models\Order;
use Illuminate\Http\Request;

class SuperAdminCustomerController extends Controller
{
    public function index(Request $request)
    {
        $query = Customer::query();

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

        $sortField = $request->input('sort', 'created_at');
        $sortDir = $request->input('dir', 'desc');
        $allowed = ['name', 'phone', 'email', 'total_orders', 'last_order_at', 'created_at'];
        if (!in_array($sortField, $allowed)) $sortField = 'created_at';

        $customers = $query->orderBy($sortField, $sortDir === 'asc' ? 'asc' : 'desc')
            ->paginate($request->input('per_page', 25));

        return response()->json(['success' => true, 'data' => $customers]);
    }

    public function show($id)
    {
        $customer = Customer::with(['addresses'])->findOrFail($id);

        $orders = Order::withoutGlobalScope('tenant')
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

        return response()->json([
            'success' => true,
            'data' => compact('total', 'registered', 'withOrders', 'newThisWeek', 'newThisMonth'),
        ]);
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
