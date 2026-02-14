<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\MenuItem;
use App\Models\Restaurant;
use App\Models\FcmToken;
use App\Models\DeliveryZone;
use App\Services\FcmService;
use App\Services\PhoneValidationService;
use App\Services\BasePriceService;
use App\Services\PromotionService;
use App\Services\OrderEventService;
use App\Models\SystemError;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

/**
 * OrderController - ניהול הזמנות
 */
class OrderController extends Controller
{
    private const DEFAULT_SALAD_GROUP_NAME = 'סלטים קבועים';
    private const DEFAULT_HOT_GROUP_NAME = 'תוספות חמות';
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
                'payment_method' => 'required|in:' . (config('payment.credit_card_enabled') ? 'cash,credit_card' : 'cash'),
                'delivery_address' => 'nullable|string|max:255',
                'delivery_notes' => 'nullable|string|max:500',
                'delivery_lat' => 'nullable|numeric|between:-90,90',
                'delivery_lng' => 'nullable|numeric|between:-180,180',
                'items' => 'required|array|min:1',
                'items.*.menu_item_id' => 'required|integer|exists:menu_items,id',
                'items.*.variant_id' => 'nullable|integer',
                'items.*.addons' => 'nullable|array',
                'items.*.addons.*.addon_id' => 'required',  // integer or 'cat_item_X' for category-based addons
                'items.*.addons.*.on_side' => 'nullable|boolean',
                'items.*.qty' => 'nullable|integer|min:1',
                'items.*.quantity' => 'nullable|integer|min:1',
                'is_test' => 'nullable|boolean',        // הזמנת בדיקה (מצב preview)
                'test_note' => 'nullable|string|max:255', // הערה להזמנת בדיקה
                'applied_promotions' => 'nullable|array',
                'applied_promotions.*.promotion_id' => 'required|integer',
                'applied_promotions.*.gift_items' => 'nullable|array',
                'applied_promotions.*.gift_items.*.menu_item_id' => 'required|integer|exists:menu_items,id',
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

            if ($validated['delivery_method'] === 'delivery' && (!isset($validated['delivery_lat']) || !isset($validated['delivery_lng']))) {
                return response()->json([
                    'success' => false,
                    'message' => 'נא לאשר מיקום למשלוח',
                ], 422);
            }

            $normalizedCustomerPhone = PhoneValidationService::normalizeIsraeliMobileE164($validated['customer_phone']);
            if (!$normalizedCustomerPhone) {
                return response()->json([
                    'success' => false,
                    'message' => 'מספר טלפון לא תקין (נייד ישראלי בלבד)',
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

            // בדיקת אישור - אבל לא במצב preview
            $isPreviewMode = $request->header('X-Preview-Mode') === 'true';
            $isTestOrder = $validated['is_test'] ?? false;

            if (!$restaurant->is_approved && !$isPreviewMode && !$isTestOrder) {
                return response()->json([
                    'success' => false,
                    'message' => 'המסעדה ממתינה לאישור מנהל מערכת ולא ניתן לבצע הזמנה',
                    'error' => 'restaurant_not_approved',
                ], 403);
            }

            if (!($restaurant->is_open_now ?? false)) {
                return response()->json([
                    'success' => false,
                    'message' => 'המסעדה סגורה כרגע ולא ניתן לבצע הזמנה',
                    'data' => [
                        'is_open_now' => false,
                        'is_override_status' => (bool) ($restaurant->is_override_status ?? false),
                    ],
                ], 403);
            }

            // ולידציה: אם בחרו אשראי, לוודא שהמסעדה תומכת (מסוף מאומת + שיטה מופעלת)
            if (($validated['payment_method'] ?? 'cash') === 'credit_card') {
                if (!$restaurant->acceptsCreditCard()) {
                    return response()->json([
                        'success' => false,
                        'message' => 'המסעדה אינה מקבלת תשלום באשראי כרגע',
                    ], 422);
                }
            }

            $restaurantId = $restaurant->id;
            $restaurantVariants = $restaurant->variants ?? collect();
            $restaurantAddonGroups = $this->resolveAddonGroups($restaurant->addonGroups ?? collect());

            $deliveryZone = null;
            $deliveryFee = 0.0;
            $deliveryDistanceKm = null;
            $deliveryLat = $validated['delivery_lat'] ?? null;
            $deliveryLng = $validated['delivery_lng'] ?? null;

            if ($validated['delivery_method'] === 'delivery') {
                // Validate delivery location and calculate fee
                $deliveryValidation = $this->validateDeliveryLocation(
                    $deliveryLat,
                    $deliveryLng,
                    $restaurantId,
                    $restaurant
                );

                if (!$deliveryValidation['success']) {
                    return response()->json([
                        'success' => false,
                        'message' => $deliveryValidation['message'],
                    ], 422);
                }

                $deliveryZone = $deliveryValidation['zone'];
                $deliveryDistanceKm = $deliveryValidation['distance_km'];
                $deliveryFee = $deliveryValidation['fee'];
            }

            $etaMinutes = null;
            $etaNote = null;
            if ($validated['delivery_method'] === 'delivery') {
                $etaMinutes = $restaurant->delivery_time_minutes ?? null;
                $etaNote = $restaurant->delivery_time_note ?? null;
            } else {
                $etaMinutes = $restaurant->pickup_time_minutes ?? null;
                $etaNote = $restaurant->pickup_time_note ?? null;
            }

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
                        'category',
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
                    $variantDelta = $variantSourceIsRestaurant
                        ? round((new BasePriceService())->calculateBasePrice($menuItem->id, $menuItem->category_id, $variantId), 2)
                        : round((float) $selectedVariant->price_delta, 2);
                }

                $addonEntries = collect($itemData['addons'] ?? [])
                    ->filter(fn($entry) => is_array($entry) && isset($entry['addon_id']))
                    ->unique('addon_id')
                    ->values();

                $availableAddonGroups = $menuItem->use_addons
                    ? $this->filterAddonGroupsByScope($restaurantAddonGroups, $menuItem, $menuItem->category_id)
                    : $this->resolveAddonGroups($menuItem->addonGroups);

                $selectedAddonsByGroup = [];
                foreach ($addonEntries as $addonEntry) {
                    $addonId = $addonEntry['addon_id']; // string or int (e.g. 5 or 'cat_item_5')
                    $matchedAddon = null;
                    $matchedGroup = null;

                    foreach ($availableAddonGroups as $group) {
                        $groupAddons = $group->addons ?? collect();
                        $matchedAddon = $groupAddons->first(fn($a) => (string) $a->id === (string) $addonId);
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
                        'on_side' => $addonEntry['on_side'] ?? false,
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
                    // אם אין הגבלה בקבוצה, נשתמש במקסימום מהמנה (רק אם לא בחרו כמה קבוצות)
                    if ($maxAllowed === null && $menuItem->use_addons && $menuItem->max_addons) {
                        $scope = $menuItem->addons_group_scope;
                        $groupIds = json_decode($scope, true);
                        // אם זה array עם קבוצה אחת בלבד, או פורמט ישן שאינו 'both'
                        if ((is_array($groupIds) && count($groupIds) === 1) ||
                            (!is_array($groupIds) && $scope !== 'both')
                        ) {
                            $maxAllowed = $menuItem->max_addons;
                        }
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
                            'on_side' => $selection['on_side'] ?? false,
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
                    'category_id' => $menuItem->category_id,
                    'category_name' => $menuItem->category?->name,
                    'quantity' => $quantity,
                    'variant_id' => $variantIdForDb,
                    'variant_name' => $selectedVariant?->name,
                    'variant_price_delta' => $variantDelta,
                    'addons' => array_values($addonsDetails),
                    'addons_total' => $addonsTotal,
                    'price_at_order' => $unitPrice,
                ];
            }

            // חישוב מבצעים (אם הלקוח שלח applied_promotions)
            $promotionDiscount = 0;
            $giftLineItems = [];
            $promotionService = null;
            if (!empty($validated['applied_promotions'])) {
                $promotionService = app(PromotionService::class);
                $result = $promotionService->validateAndApply($lineItems, $validated['applied_promotions'], $tenantId);
                $promotionDiscount = $result['promotion_discount'];
                $giftLineItems = $result['gift_items'];
            }

            // צור את ההזמנה עם סכום סופי
            // TODO Phase 2 - Payment Processing Integration:
            // 1. payment_sessions table: order_id, session_token, hyp_transaction_id, amount, status, expires_at
            // 2. אם payment_method=credit_card -> יצירת payment session -> הפניה ל-HYP iframe
            // 3. Webhook מ-HYP מעדכן payment_status ל-paid ושומר transaction_id
            // 4. Frontend polling ב-OrderStatusPage בודק שינוי ב-payment_status
            $order = Order::create([
                'tenant_id' => $tenantId,
                'restaurant_id' => $restaurantId,
                'correlation_id' => \Illuminate\Support\Str::uuid()->toString(),
                'customer_name' => $validated['customer_name'],
                'customer_phone' => $normalizedCustomerPhone,
                'delivery_method' => $validated['delivery_method'],
                'payment_method' => $validated['payment_method'],
                'payment_status' => Order::PAYMENT_PENDING, // תשלום נדרש - מזומן ייגבה בעת מסירה
                'delivery_address' => $validated['delivery_address'] ?? null,
                'delivery_notes' => $validated['delivery_notes'] ?? null,
                'delivery_zone_id' => $deliveryZone?->id,
                'delivery_fee' => $deliveryFee,
                'delivery_distance_km' => $deliveryDistanceKm,
                'delivery_lat' => $deliveryLat,
                'delivery_lng' => $deliveryLng,
                'eta_minutes' => $etaMinutes,
                'eta_note' => $etaNote,
                'eta_updated_at' => now(),
                'status' => Order::STATUS_PENDING,
                'is_test' => $validated['is_test'] ?? false,           // הזמנת בדיקה
                'test_note' => $validated['test_note'] ?? null,         // הערה להזמנת בדיקה
                'promotion_discount' => $promotionDiscount,
                'total_amount' => $totalAmount + $deliveryFee - $promotionDiscount,
            ]);

            foreach ($lineItems as $lineItem) {
                OrderItem::create([
                    'order_id' => $order->id,
                    'menu_item_id' => $lineItem['menu_item_id'],
                    'category_id' => $lineItem['category_id'],
                    'category_name' => $lineItem['category_name'],
                    'variant_id' => $lineItem['variant_id'],
                    'variant_name' => $lineItem['variant_name'],
                    'variant_price_delta' => $lineItem['variant_price_delta'],
                    'addons' => $lineItem['addons'],
                    'addons_total' => $lineItem['addons_total'],
                    'quantity' => $lineItem['quantity'],
                    'price_at_order' => $lineItem['price_at_order'],
                ]);
            }

            // יצירת פריטי מתנה מהמבצעים
            foreach ($giftLineItems as $gift) {
                OrderItem::create([
                    'order_id' => $order->id,
                    'menu_item_id' => $gift['menu_item_id'],
                    'category_id' => $gift['category_id'],
                    'category_name' => $gift['category_name'],
                    'quantity' => 1,
                    'price_at_order' => 0,
                    'variant_id' => null,
                    'variant_name' => null,
                    'variant_price_delta' => 0,
                    'addons' => [],
                    'addons_total' => 0,
                    'promotion_id' => $gift['promotion_id'],
                    'is_gift' => true,
                ]);
            }

            // שמירת שימוש במבצעים
            if ($promotionService && !empty($validated['applied_promotions'])) {
                foreach ($validated['applied_promotions'] as $ap) {
                    $promotionService->recordUsage($ap['promotion_id'], $order->id, $normalizedCustomerPhone);
                }
            }

            // שליחת פוש לטאבלטים של המסעדה (רק אם לא הזמנת test)
            if (!($validated['is_test'] ?? false)) {
                $notificationBody = "{$order->customer_name} - ₪{$order->total_amount}";

                $this->sendOrderNotification(
                    tenantId: $tenantId,
                    title: "הזמנה חדשה #{$order->id}",
                    body: $notificationBody,
                    data: [
                        'orderId' => (string) $order->id,
                        'type' => 'new_order',
                        'url' => '/admin/orders'
                    ]
                );
            }

            // Event Log - רישום אירוע יצירת הזמנה
            try {
                OrderEventService::log(
                    $order->id,
                    'order_created',
                    'customer',
                    null,
                    [
                        'delivery_method' => $validated['delivery_method'],
                        'payment_method' => $validated['payment_method'],
                        'total_amount' => $order->total_amount,
                        'items_count' => count($lineItems),
                        'has_promotions' => !empty($validated['applied_promotions']),
                    ],
                    $request
                );
            } catch (\Exception $e) {
                Log::warning('Failed to log order event', ['error' => $e->getMessage()]);
            }

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
     * Check if delivery is available for given location
     * 
     * POST /check-delivery-zone
     * Body: { delivery_lat: float, delivery_lng: float }
     * Returns: { available: bool, zone: object|null, fee: float, distance_km: float|null, message: string }
     */
    public function checkDeliveryZone(Request $request)
    {
        try {
            $validated = $request->validate([
                'delivery_lat' => 'required|numeric|between:-90,90',
                'delivery_lng' => 'required|numeric|between:-180,180',
            ]);

            $tenantId = app('tenant_id');
            $restaurant = Restaurant::where('tenant_id', $tenantId)->first();

            if (!$restaurant) {
                return response()->json([
                    'success' => false,
                    'available' => false,
                    'message' => 'מסעדה לא נמצאה',
                ], 404);
            }

            $validation = $this->validateDeliveryLocation(
                $validated['delivery_lat'],
                $validated['delivery_lng'],
                $restaurant->id,
                $restaurant
            );

            return response()->json([
                'success' => $validation['success'],
                'available' => $validation['success'],
                'zone' => $validation['zone'] ? [
                    'id' => $validation['zone']->id,
                    'name' => $validation['zone']->name,
                    'pricing_type' => $validation['zone']->pricing_type,
                ] : null,
                'fee' => $validation['fee'],
                'distance_km' => $validation['distance_km'],
                'message' => $validation['message'] ?? ($validation['success'] ? 'משלוח זמין' : null),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'available' => false,
                'message' => 'שגיאה בבדיקת אזור משלוח',
                'error' => $e->getMessage(),
            ], 500);
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

            // ולידציה: בדיקה שהמעבר מותר לפי transition map
            if (!$order->canTransitionTo($validated['status'])) {
                return response()->json([
                    'success' => false,
                    'message' => 'מעבר סטטוס לא מותר. ' .
                        ($order->delivery_method === 'pickup' && $validated['status'] === 'delivering'
                            ? 'הזמנות איסוף עצמי אינן דורשות סטטוס "במשלוח"'
                            : 'מעבר זה אינו אפשרי במצב הנוכחי'),
                    'current_status' => $order->status,
                    'attempted_status' => $validated['status'],
                    'allowed_statuses' => Order::getAllowedNextStatuses($order->status, $order->delivery_method),
                ], 422);
            }

            $oldStatus = $order->status;
            $order->update(['status' => $validated['status']]);

            // Event Log - רישום שינוי סטטוס
            try {
                OrderEventService::logStatusChange(
                    $order->id,
                    $oldStatus,
                    $validated['status'],
                    'admin',
                    $request->user()?->id,
                    $request
                );
            } catch (\Exception $e) {
                Log::warning('Failed to log order status change event', ['error' => $e->getMessage()]);
            }

            // הפעלת הדפסה למטבח כשהזמנה מאושרת
            if ($validated['status'] === 'preparing') {
                try {
                    app(\App\Services\PrintService::class)->printOrder($order);
                } catch (\Exception $e) {
                    Log::error('Print failed: ' . $e->getMessage());
                }
            }

            // שליחת התראת Push מותאמת לסוג המשלוח
            $this->sendStatusNotification($order, $validated['status']);

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

    /**
     * שליחת התראה מותאמת לפי סוג משלוח וסטטוס
     */
    private function sendStatusNotification(Order $order, string $status): void
    {
        $statusMessages = config('push.messages.status');

        // התאמת הודעה לסוג משלוח
        $messageKey = $status;
        if ($status === 'ready' || $status === 'delivered') {
            $messageKey = $order->delivery_method === 'pickup'
                ? $status . '_pickup'
                : $status . '_delivery';
        }

        // אם יש הודעה ספציפית - השתמש בה, אחרת נסה הודעה כללית
        $message = $statusMessages[$messageKey] ?? $statusMessages[$status] ?? null;

        if ($message) {
            $this->sendOrderNotification(
                tenantId: $order->tenant_id,
                title: $message['title'],
                body: $message['body'],
                data: ['orderId' => (string) $order->id, 'status' => $status]
            );
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

    /**
     * Validate delivery location and calculate delivery fee
     * 
     * @param float|null $lat Customer latitude
     * @param float|null $lng Customer longitude
     * @param int $restaurantId Restaurant ID
     * @param Restaurant $restaurant Restaurant model
     * @return array ['success' => bool, 'zone' => DeliveryZone|null, 'distance_km' => float|null, 'fee' => float, 'message' => string|null]
     */
    private function validateDeliveryLocation(?float $lat, ?float $lng, int $restaurantId, Restaurant $restaurant): array
    {
        if ($lat === null || $lng === null) {
            return [
                'success' => false,
                'message' => 'נא לאשר מיקום למשלוח',
                'zone' => null,
                'distance_km' => null,
                'fee' => 0.0,
            ];
        }

        // Get active delivery zones
        $zones = DeliveryZone::where('restaurant_id', $restaurantId)
            ->where('is_active', true)
            ->with('city')
            ->orderBy('sort_order')
            ->get();

        if ($zones->isEmpty()) {
            return [
                'success' => false,
                'message' => 'המסעדה לא הגדירה אזורי משלוח',
                'zone' => null,
                'distance_km' => null,
                'fee' => 0.0,
            ];
        }

        $matchedZone = null;

        // Try to match zone
        foreach ($zones as $zone) {
            // Check city-based zone with dynamic radius
            if ($zone->city_id && $zone->city) {
                $cityLat = (float) $zone->city->latitude;
                $cityLng = (float) $zone->city->longitude;
                $cityRadius = $zone->city_radius ?? 10; // ברירת מחדל 10 ק"מ אם לא מוגדר
                $distanceToCity = $this->calculateDistanceKm($lat, $lng, $cityLat, $cityLng);

                Log::info('City zone check', [
                    'zone_id' => $zone->id,
                    'zone_name' => $zone->name,
                    'city_radius' => $cityRadius,
                    'distance_to_city' => $distanceToCity,
                    'is_within' => $distanceToCity <= $cityRadius
                ]);

                if ($distanceToCity <= $cityRadius) {
                    $matchedZone = $zone;
                    break;
                }
            }

            // Check polygon-based zone
            $polygon = $zone->polygon ?? [];
            if (!empty($polygon) && $this->isPointInPolygon($lat, $lng, $polygon)) {
                $matchedZone = $zone;
                break;
            }
        }

        if (!$matchedZone) {
            return [
                'success' => false,
                'message' => 'הכתובת מחוץ לאזורי המשלוח של המסעדה',
                'zone' => null,
                'distance_km' => null,
                'fee' => 0.0,
            ];
        }

        // Calculate distance from restaurant
        $distanceKm = null;
        if ($restaurant->latitude !== null && $restaurant->longitude !== null) {
            $distanceKm = $this->calculateDistanceKm(
                (float) $restaurant->latitude,
                (float) $restaurant->longitude,
                $lat,
                $lng
            );
        }

        // Validate distance calculation for non-fixed pricing
        if ($matchedZone->pricing_type !== 'fixed' && $distanceKm === null) {
            return [
                'success' => false,
                'message' => 'לא ניתן לחשב דמי משלוח ללא מיקום מסעדה',
                'zone' => $matchedZone,
                'distance_km' => null,
                'fee' => 0.0,
            ];
        }

        // Calculate delivery fee
        $deliveryFee = $this->calculateDeliveryFee($matchedZone, $distanceKm);

        return [
            'success' => true,
            'message' => null,
            'zone' => $matchedZone,
            'distance_km' => $distanceKm,
            'fee' => $deliveryFee,
        ];
    }

    private function resolveDeliveryZone(int $restaurantId, ?float $lat, ?float $lng): ?DeliveryZone
    {
        if ($lat === null || $lng === null) {
            return null;
        }

        $zones = DeliveryZone::where('restaurant_id', $restaurantId)
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->get();

        foreach ($zones as $zone) {
            $polygon = $zone->polygon ?? [];
            if ($this->isPointInPolygon($lat, $lng, $polygon)) {
                return $zone;
            }
        }

        return null;
    }

    private function calculateDistanceKm(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earthRadius = 6371; // km
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;
        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));
        return round($earthRadius * $c, 2);
    }

    private function isPointInPolygon(float $lat, float $lng, array $polygon): bool
    {
        if (count($polygon) < 3) {
            return false;
        }

        $inside = false;
        $j = count($polygon) - 1;
        for ($i = 0; $i < count($polygon); $i++) {
            // X = longitude (אורך - ציר אופקי), Y = latitude (רוחב - ציר אנכי)
            $lngI = (float) ($polygon[$i]['lng'] ?? 0);
            $latI = (float) ($polygon[$i]['lat'] ?? 0);
            $lngJ = (float) ($polygon[$j]['lng'] ?? 0);
            $latJ = (float) ($polygon[$j]['lat'] ?? 0);

            $intersect = (($latI > $lat) !== ($latJ > $lat))
                && ($lng < ($lngJ - $lngI) * ($lat - $latI) / (($latJ - $latI) ?: 1e-9) + $lngI);

            if ($intersect) {
                $inside = !$inside;
            }
            $j = $i;
        }

        return $inside;
    }

    private function calculateDeliveryFee(DeliveryZone $zone, ?float $distanceKm): float
    {
        $pricingType = $zone->pricing_type ?? 'fixed';

        if ($pricingType === 'fixed') {
            return round((float) ($zone->fixed_fee ?? 0), 2);
        }

        if ($distanceKm === null) {
            return 0.0;
        }

        if ($pricingType === 'per_km') {
            $fee = (float) ($zone->per_km_fee ?? 0) * $distanceKm;
            return round($fee, 2);
        }

        if ($pricingType === 'tiered') {
            $tiers = $zone->tiered_fees ?? [];
            if (!is_array($tiers) || empty($tiers)) {
                return 0.0;
            }

            usort($tiers, fn($a, $b) => ($a['upto_km'] ?? 0) <=> ($b['upto_km'] ?? 0));
            foreach ($tiers as $tier) {
                $upto = (float) ($tier['upto_km'] ?? 0);
                $fee = (float) ($tier['fee'] ?? 0);
                if ($distanceKm <= $upto) {
                    return round($fee, 2);
                }
            }

            $last = end($tiers);
            return round((float) ($last['fee'] ?? 0), 2);
        }

        return 0.0;
    }

    /**
     * Resolve category-based addon groups by converting source-category menu items into synthetic addon objects.
     * Mirrors the logic in MenuController::resolveCategoryAddons().
     */
    private function resolveAddonGroups($groups)
    {
        return $groups->map(function ($group) {
            if (($group->source_type ?? null) !== 'category' || !($group->source_category_id ?? null)) {
                return $group;
            }

            $items = MenuItem::where('category_id', $group->source_category_id)
                ->where('is_available', true)
                ->orderBy('name')
                ->get();

            $includePrices = (bool) ($group->source_include_prices ?? true);

            $syntheticAddons = $items->map(function ($item) use ($includePrices) {
                $addon = new \stdClass();
                $addon->id = 'cat_item_' . $item->id;
                $addon->name = $item->name;
                $addon->price_delta = $includePrices ? (float) $item->price : 0;
                $addon->selection_weight = 1;
                $addon->is_default = false;
                return $addon;
            });

            $group->setRelation('addons', $syntheticAddons);
            return $group;
        });
    }

    private function filterAddonGroupsByScope($groups, MenuItem $item, ?int $categoryId)
    {
        $groups = $this->cloneAddonGroups($groups);

        // אם אין הגדרת scope - נציג את כל הקבוצות
        if (empty($item->addons_group_scope)) {
            return $this->filterAddonGroupsByCategory($groups, $categoryId);
        }

        $scope = $item->addons_group_scope;

        // ניסיון לפרסר כ-JSON (פורמט חדש - array של IDs)
        $groupIds = json_decode($scope, true);

        if (is_array($groupIds) && !empty($groupIds)) {
            // פורמט חדש - array של IDs
            $filteredGroups = $groups->filter(function ($group) use ($groupIds) {
                return in_array($group->id, $groupIds, true);
            })->values();
        } else {
            // תאימות לאחור - ערכים ישנים: 'salads', 'hot', 'both'
            if ($scope === 'both') {
                $filteredGroups = $groups;
            } elseif ($scope === 'salads') {
                $filteredGroups = $groups->filter(fn($g) => $g->name === self::DEFAULT_SALAD_GROUP_NAME)->values();
            } elseif ($scope === 'hot') {
                $filteredGroups = $groups->filter(fn($g) => $g->name === self::DEFAULT_HOT_GROUP_NAME)->values();
            } else {
                // אם זה לא ערך מוכר, נציג הכל
                $filteredGroups = $groups;
            }
        }

        // עכשיו נסנן גם לפי קטגוריות
        return $this->filterAddonGroupsByCategory($filteredGroups, $categoryId);
    }

    private function filterAddonGroupsByCategory($groups, ?int $categoryId)
    {
        if (!$categoryId) {
            return $groups;
        }

        return $groups
            ->map(function ($group) use ($categoryId) {
                $filteredAddons = ($group->addons ?? collect())
                    ->filter(function ($addon) use ($categoryId) {
                        $categoryIds = $addon->category_ids ?? null;
                        if (empty($categoryIds)) {
                            return true;
                        }

                        if (is_string($categoryIds)) {
                            $decoded = json_decode($categoryIds, true);
                            $categoryIds = is_array($decoded) ? $decoded : [$categoryIds];
                        }

                        $normalized = collect((array) $categoryIds)
                            ->map(fn($id) => (int) $id)
                            ->all();

                        return in_array((int) $categoryId, $normalized, true);
                    })
                    ->values();

                $group->setRelation('addons', $filteredAddons);
                return $group;
            })
            ->filter(fn($group) => ($group->addons ?? collect())->isNotEmpty())
            ->values();
    }

    private function cloneAddonGroups($groups)
    {
        return $groups->map(function ($group) {
            $clone = clone $group;
            $addons = ($group->addons ?? collect())->map(function ($addon) {
                return clone $addon;
            });
            $clone->setRelation('addons', $addons);
            return $clone;
        });
    }

    /**
     * שליחת דירוג וביקורת על הזמנה
     * 
     * @param Request $request
     * @param int $id - מזהה הזמנה
     * @return \Illuminate\Http\JsonResponse
     */
    public function submitReview(Request $request, $id)
    {
        try {
            $validated = $request->validate([
                'rating' => 'required|integer|between:1,5',
                'review_text' => 'nullable|string|max:500',
            ]);

            $tenantId = app('tenant_id');
            $order = Order::where('tenant_id', $tenantId)->findOrFail($id);

            // בדיקה שההזמנה הושלמה
            if ($order->status !== Order::STATUS_DELIVERED) {
                return response()->json([
                    'success' => false,
                    'message' => 'ניתן לדרג רק הזמנות שנמסרו',
                ], 422);
            }

            // בדיקה שעוד לא דורגה
            if ($order->rating !== null) {
                return response()->json([
                    'success' => false,
                    'message' => 'הזמנה זו כבר קיבלה דירוג',
                ], 422);
            }

            // עדכון ישיר עם save()
            $order->rating = $validated['rating'];
            $order->review_text = $validated['review_text'] ?? null;
            $order->reviewed_at = now();
            $saved = $order->save();

            Log::info('Rating saved', [
                'order_id' => $order->id,
                'rating' => $order->rating,
                'review_text' => $order->review_text,
                'saved' => $saved,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'תודה על הדירוג! בתאבון 🍕',
                'data' => [
                    'rating' => $order->rating,
                    'review_text' => $order->review_text,
                    'reviewed_at' => $order->reviewed_at,
                ],
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'נתונים לא תקינים',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            Log::error('Error submitting review', [
                'order_id' => $id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'שגיאה בשליחת הדירוג',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}
