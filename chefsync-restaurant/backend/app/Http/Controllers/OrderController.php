<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\MenuItem;
use App\Models\Restaurant;
use App\Models\FcmToken;
use App\Services\FcmService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

/**
 * OrderController - ניהול הזמנות
 */
class OrderController extends Controller
{
    /**
     * צור הזמנה חדשה עם וריאציות ותוספות
     *
     * בקשה:
     * {
     *   "customer_name": "דוד כהן",
     *   "customer_phone": "050-1234567",
     *   "items": [
     *     {
     *       "menu_item_id": 1,
     *       "variant_id": 10,
     *       "addons": [{"addon_id": 5}, {"addon_id": 6}],
     *       "qty": 2
     *     }
     *   ]
     * }
     */
    public function store(Request $request)
    {
        try {
            $validated = $request->validate([
                'customer_name' => 'required|string|max:100',
                'customer_phone' => 'required|string|max:20',
                'delivery_method' => 'required|in:pickup,delivery',
                'payment_method' => 'required|in:cash',
                'delivery_address' => 'nullable|string|max:255',
                'delivery_notes' => 'nullable|string|max:500',
                'items' => 'required|array|min:1',
                'items.*.menu_item_id' => 'required|integer|exists:menu_items,id',
                'items.*.variant_id' => 'nullable|integer',
                'items.*.addons' => 'nullable|array',
                'items.*.addons.*.addon_id' => 'required|integer',
                'items.*.qty' => 'nullable|integer|min:1',
                'items.*.quantity' => 'nullable|integer|min:1',
            ]);

            Log::info('Order request received', [
                'delivery_method' => $validated['delivery_method'],
                'delivery_address' => $validated['delivery_address'] ?? null,
                'all_data' => $request->all()
            ]);

            if ($validated['delivery_method'] === 'delivery' && empty($validated['delivery_address'])) {
                return response()->json([
                    'success' => false,
                    'message' => 'נא להזין כתובת למשלוח',
                ], 422);
            }

            $tenantId = app('tenant_id');
            $restaurant = Restaurant::with([
                'variants' => function ($variantQuery) {
                    $variantQuery->where('is_active', true)->orderBy('sort_order');
                },
                'addonGroups' => function ($groupQuery) {
                    $groupQuery->where('is_active', true)
                        ->orderBy('sort_order')
                        ->with(['addons' => function ($addonQuery) {
                            $addonQuery->where('is_active', true)->orderBy('sort_order');
                        }]);
                },
            ])->where('tenant_id', $tenantId)->first();

            if (!$restaurant) {
                throw new \Exception('Restaurant not found for tenant');
            }

            $restaurantId = $restaurant->id;
            $restaurantVariants = $restaurant->variants ?? collect();
            $restaurantAddonGroups = $restaurant->addonGroups ?? collect();

            $lineItems = [];
            $totalAmount = 0;

            foreach ($validated['items'] as $index => $itemData) {
                $menuItem = MenuItem::where('tenant_id', $tenantId)
                    ->with([
                        'variants' => function ($variantQuery) {
                            $variantQuery->where('is_active', true)->orderBy('sort_order');
                        },
                        'addonGroups' => function ($groupQuery) {
                            $groupQuery->where('is_active', true)
                                ->orderBy('sort_order')
                                ->with([
                                    'addons' => function ($addonQuery) {
                                        $addonQuery->where('is_active', true)->orderBy('sort_order');
                                    }
                                ]);
                        },
                        'restaurant',
                    ])
                    ->findOrFail($itemData['menu_item_id']);

                $quantity = $itemData['qty'] ?? $itemData['quantity'] ?? null;
                if ($quantity === null) {
                    throw ValidationException::withMessages([
                        "items.$index.qty" => ['יש לבחור כמות לפריט'],
                    ]);
                }
                if ($quantity < 1) {
                    throw ValidationException::withMessages([
                        "items.$index.qty" => ['כמות חייבת להיות לפחות 1'],
                    ]);
                }

                $selectedVariant = null;
                $variantDelta = 0.0;
                $variantSourceIsRestaurant = $menuItem->use_variants;
                $availableVariants = $variantSourceIsRestaurant ? $restaurantVariants : $menuItem->variants;

                if (array_key_exists('variant_id', $itemData) && !is_null($itemData['variant_id'])) {
                    $variantId = (int) $itemData['variant_id'];
                    $selectedVariant = $availableVariants->firstWhere('id', $variantId);
                    if (!$selectedVariant) {
                        throw ValidationException::withMessages([
                            "items.$index.variant_id" => ['וריאציה שנבחרה אינה זמינה לפריט זה'],
                        ]);
                    }
                    $variantDelta = round((float) $selectedVariant->price_delta, 2);
                }

                $addonEntries = collect($itemData['addons'] ?? [])
                    ->filter(fn($entry) => is_array($entry) && isset($entry['addon_id']))
                    ->unique('addon_id')
                    ->values();

                $availableAddonGroups = $menuItem->use_addons ? $restaurantAddonGroups : $menuItem->addonGroups;

                $selectedAddonsByGroup = [];
                foreach ($addonEntries as $addonEntry) {
                    $addonId = (int) $addonEntry['addon_id'];
                    $matchedAddon = null;
                    $matchedGroup = null;

                    foreach ($availableAddonGroups as $group) {
                        $groupAddons = $group->addons ?? collect();
                        $matchedAddon = $groupAddons->firstWhere('id', $addonId);
                        if ($matchedAddon) {
                            $matchedGroup = $group;
                            break;
                        }
                    }

                    if (!$matchedAddon || !$matchedGroup) {
                        throw ValidationException::withMessages([
                            "items.$index.addons" => ['תוספת שנבחרה אינה זמינה עבור הפריט'],
                        ]);
                    }

                    $selectedAddonsByGroup[$matchedGroup->id][] = [
                        'addon' => $matchedAddon,
                        'group' => $matchedGroup,
                    ];
                }

                $addonsDetails = [];
                $addonsTotal = 0.0;

                foreach ($availableAddonGroups as $group) {
                    $selectedForGroup = collect($selectedAddonsByGroup[$group->id] ?? []);
                    $count = $selectedForGroup->count();

                    $minRequired = $group->min_selections ?? 0;
                    if ($group->is_required && $minRequired < 1) {
                        $minRequired = 1;
                    }
                    if ($count < $minRequired) {
                        throw ValidationException::withMessages([
                            "items.$index.addons" => [sprintf('יש לבחור לפחות %d תוספות בקבוצה "%s"', $minRequired, $group->name)],
                        ]);
                    }

                    $maxAllowed = $group->max_selections;
                    if ($menuItem->use_addons && $menuItem->max_addons) {
                        $maxAllowed = $menuItem->max_addons;
                    }
                    if ($maxAllowed !== null && $count > $maxAllowed) {
                        throw ValidationException::withMessages([
                            "items.$index.addons" => [sprintf('ניתן לבחור עד %d תוספות בקבוצה "%s"', $maxAllowed, $group->name)],
                        ]);
                    }

                    if ($group->selection_type === 'single' && $count > 1) {
                        throw ValidationException::withMessages([
                            "items.$index.addons" => [sprintf('ניתן לבחור תוספת אחת בלבד בקבוצה "%s"', $group->name)],
                        ]);
                    }

                    $selectedForGroup->each(function ($selection) use (&$addonsDetails, &$addonsTotal, $group) {
                        $addonModel = $selection['addon'];
                        $addonPrice = round((float) $addonModel->price_delta, 2);
                        $addonsDetails[] = [
                            'id' => $addonModel->id,
                            'name' => $addonModel->name,
                            'price_delta' => $addonPrice,
                            'group_id' => $group->id,
                            'group_name' => $group->name,
                        ];
                        $addonsTotal += $addonPrice;
                    });
                }

                $addonsTotal = round($addonsTotal, 2);
                $basePrice = round((float) $menuItem->price, 2);
                $unitPrice = round($basePrice + $variantDelta + $addonsTotal, 2);
                $lineTotal = round($unitPrice * $quantity, 2);
                $totalAmount = round($totalAmount + $lineTotal, 2);

                // If variants are coming from restaurant-wide tables, they do not exist in menu_item_variants (FK target),
                // so we store the name/delta but keep variant_id null to satisfy FK constraint.
                $variantIdForDb = $variantSourceIsRestaurant ? null : ($selectedVariant?->id);

                $lineItems[] = [
                    'menu_item_id' => $menuItem->id,
                    'quantity' => $quantity,
                    'variant_id' => $variantIdForDb,
                    'variant_name' => $selectedVariant?->name,
                    'variant_price_delta' => $variantDelta,
                    'addons' => array_values($addonsDetails),
                    'addons_total' => $addonsTotal,
                    'price_at_order' => $unitPrice,
                ];
            }

            // צור את ההזמנה עם סכום סופי
            $order = Order::create([
                'tenant_id' => $tenantId,
                'restaurant_id' => $restaurantId,
                'customer_name' => $validated['customer_name'],
                'customer_phone' => $validated['customer_phone'],
                'delivery_method' => $validated['delivery_method'],
                'payment_method' => $validated['payment_method'],
                'delivery_address' => $validated['delivery_address'] ?? null,
                'delivery_notes' => $validated['delivery_notes'] ?? null,
                'status' => Order::STATUS_RECEIVED,
                'total_amount' => $totalAmount,
            ]);

            foreach ($lineItems as $lineItem) {
                OrderItem::create([
                    'order_id' => $order->id,
                    'menu_item_id' => $lineItem['menu_item_id'],
                    'variant_id' => $lineItem['variant_id'],
                    'variant_name' => $lineItem['variant_name'],
                    'variant_price_delta' => $lineItem['variant_price_delta'],
                    'addons' => $lineItem['addons'],
                    'addons_total' => $lineItem['addons_total'],
                    'quantity' => $lineItem['quantity'],
                    'price_at_order' => $lineItem['price_at_order'],
                ]);
            }

            // שליחת פוש לטאבלטים של המסעדה
            $this->sendOrderNotification(
                tenantId: $tenantId,
                title: config('push.messages.order_new.title'),
                body: config('push.messages.order_new.body'),
                data: ['orderId' => (string) $order->id]
            );

            return response()->json([
                'success' => true,
                'message' => 'הזמנה נקבלה בהצלחה',
                'data' => $order->load(['items.menuItem', 'items.variant']),
            ], 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            Log::warning('Order validation failed', [
                'errors' => $e->errors(),
                'payload' => $request->all(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'שגיאה בתקינות הנתונים',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Throwable $e) {
            Log::error('Order creation failed', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'payload' => $request->all(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'שגיאה ביצירת הזמנה',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * קבל פרטי הזמנה לפי ID
     */
    public function show($id)
    {
        try {
            $tenantId = app('tenant_id');
            $order = Order::where('tenant_id', $tenantId)
                ->with(['items.menuItem', 'items.variant'])
                ->findOrFail($id);

            return response()->json([
                'success' => true,
                'data' => $order,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'הזמנה לא נמצאה',
                'error' => $e->getMessage(),
            ], 404);
        }
    }

    /**
     * קבל הזמנות פעילות של המסעדה (לממשק מנהל)
     */
    public function restaurantIndex(Request $request)
    {
        try {
            $tenantId = app('tenant_id');
            $status = $request->query('status'); // סנן לפי סטטוס אם יש

            $query = Order::where('tenant_id', $tenantId)
                ->with(['items.menuItem', 'items.variant'])
                ->orderBy('created_at', 'desc');

            if ($status) {
                $query->where('status', $status);
            }

            $orders = $query->paginate(20);

            return response()->json([
                'success' => true,
                'data' => $orders,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'שגיאה בטעינת הזמנות',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * עדכן סטטוס הזמנה
     * 
     * בקשה:
     * {
     *   "status": "preparing" // received, preparing, ready, delivered
     * }
     */
    public function updateStatus(Request $request, $id)
    {
        try {
            $validated = $request->validate([
                'status' => 'required|in:' . implode(',', Order::validStatuses()),
            ]);

            $tenantId = app('tenant_id');
            $order = Order::where('tenant_id', $tenantId)->findOrFail($id);

            $order->update(['status' => $validated['status']]);

            $statusMessages = config('push.messages.status');
            if (isset($statusMessages[$validated['status']])) {
                $message = $statusMessages[$validated['status']];
                $this->sendOrderNotification(
                    tenantId: $tenantId,
                    title: $message['title'],
                    body: $message['body'],
                    data: ['orderId' => (string) $order->id, 'status' => $validated['status']]
                );
            }

            return response()->json([
                'success' => true,
                'message' => 'סטטוס עודכן בהצלחה',
                'data' => $order,
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'סטטוס לא תקף',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'שגיאה בעדכון הסטטוס',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    private function sendOrderNotification(string $tenantId, string $title, string $body, array $data = []): void
    {
        try {
            $tokens = FcmToken::where('tenant_id', $tenantId)->pluck('token');
            if ($tokens->isEmpty()) {
                return;
            }

            $fcm = app(FcmService::class);
            foreach ($tokens as $token) {
                $fcm->sendToToken($token, $title, $body, $data);
            }
        } catch (\Throwable $e) {
            Log::warning('Failed to send FCM notification', [
                'error' => $e->getMessage(),
            ]);
        }
    }
}
