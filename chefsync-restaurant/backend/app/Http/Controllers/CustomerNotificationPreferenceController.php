<?php

namespace App\Http\Controllers;

use App\Models\CustomerRestaurantNotificationOptIn;
use App\Models\Order;
use App\Models\Restaurant;
use Illuminate\Http\Request;

class CustomerNotificationPreferenceController extends Controller
{
    /**
     * מסעדות שבהן היה ללקוח אינטראקציה — עם סטטוס מאשר התראות.
     */
    public function index(Request $request)
    {
        $customer = $request->customer;

        $tenantIds = Order::withoutGlobalScopes()
            ->where(function ($q) use ($customer) {
                $q->where('customer_id', $customer->id);
                if (!empty($customer->phone)) {
                    $q->orWhere('customer_phone', $customer->phone);
                }
            })
            ->whereNotNull('tenant_id')
            ->where('tenant_id', '!=', '')
            ->distinct()
            ->pluck('tenant_id')
            ->filter()
            ->values();

        if ($tenantIds->isEmpty()) {
            return response()->json(['success' => true, 'data' => []]);
        }

        $restaurants = Restaurant::query()
            ->whereIn('tenant_id', $tenantIds)
            ->orderBy('name')
            ->get(['tenant_id', 'name']);

        $optIns = CustomerRestaurantNotificationOptIn::query()
            ->where('customer_id', $customer->id)
            ->whereIn('tenant_id', $tenantIds)
            ->get()
            ->keyBy('tenant_id');

        $data = $tenantIds->map(function ($tid) use ($restaurants, $optIns) {
            $r = $restaurants->firstWhere('tenant_id', $tid);

            return [
                'tenant_id' => $tid,
                'name' => $r->name ?? $tid,
                'enabled' => $optIns->get($tid)?->enabled ?? false,
            ];
        })->values();

        return response()->json(['success' => true, 'data' => $data]);
    }

    public function update(Request $request)
    {
        $customer = $request->customer;

        $validated = $request->validate([
            'opt_ins' => 'required|array|max:100',
            'opt_ins.*.tenant_id' => 'required|string|max:255',
            'opt_ins.*.enabled' => 'required|boolean',
        ]);

        foreach ($validated['opt_ins'] as $row) {
            CustomerRestaurantNotificationOptIn::updateOrCreate(
                [
                    'customer_id' => $customer->id,
                    'tenant_id' => $row['tenant_id'],
                ],
                ['enabled' => $row['enabled']]
            );
        }

        return response()->json(['success' => true, 'message' => 'העדפות עודכנו']);
    }
}
