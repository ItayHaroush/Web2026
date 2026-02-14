<?php

namespace App\Http\Controllers;

use App\Models\Kiosk;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Restaurant;
use App\Models\FcmToken;
use App\Services\FcmService;
use App\Services\PromotionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class KioskController extends Controller
{
    // ============================================
    // Admin Endpoints (auth:sanctum + tenant)
    // ============================================

    public function index(Request $request)
    {
        $user = $request->user();
        $restaurant = Restaurant::withoutGlobalScopes()->find($user->restaurant_id);
        $tier = $restaurant->tier ?? 'basic';

        $kiosks = Kiosk::where('restaurant_id', $user->restaurant_id)
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($kiosk) {
                return array_merge($kiosk->toArray(), [
                    'is_connected' => $kiosk->is_connected,
                    'view_url' => url("/kiosk/{$kiosk->token}"),
                ]);
            });

        return response()->json([
            'success' => true,
            'data' => [
                'kiosks' => $kiosks,
                'tier' => $tier,
                'limits' => [
                    'max_kiosks' => $tier === 'pro' ? 10 : 1,
                    'custom_design_allowed' => $tier === 'pro',
                ],
            ],
        ]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:100',
            'design_options' => 'nullable|array',
            'require_name' => 'nullable|boolean',
        ]);

        $user = $request->user();
        $restaurant = Restaurant::withoutGlobalScopes()->find($user->restaurant_id);
        $tier = $restaurant->tier ?? 'basic';

        $maxKiosks = $tier === 'pro' ? 10 : 1;
        $currentCount = Kiosk::where('restaurant_id', $user->restaurant_id)->count();
        if ($currentCount >= $maxKiosks) {
            return response()->json([
                'success' => false,
                'message' => "הגעתם למגבלת הקיוסקים ({$maxKiosks}). שדרגו לתוכנית Pro לעוד קיוסקים.",
            ], 403);
        }

        $designOptions = $request->input('design_options', null);
        if ($tier === 'basic' && $designOptions) {
            $designOptions = null;
        }

        $kiosk = Kiosk::create([
            'tenant_id' => $restaurant->tenant_id,
            'restaurant_id' => $restaurant->id,
            'name' => $request->name,
            'design_options' => $designOptions,
            'require_name' => $request->input('require_name', false),
            'is_active' => true,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'הקיוסק נוצר בהצלחה!',
            'data' => array_merge($kiosk->toArray(), [
                'is_connected' => false,
                'view_url' => url("/kiosk/{$kiosk->token}"),
            ]),
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $request->validate([
            'name' => 'sometimes|string|max:100',
            'design_options' => 'sometimes|nullable|array',
            'require_name' => 'sometimes|boolean',
        ]);

        $user = $request->user();
        $kiosk = Kiosk::where('restaurant_id', $user->restaurant_id)->findOrFail($id);
        $restaurant = Restaurant::withoutGlobalScopes()->find($user->restaurant_id);
        $tier = $restaurant->tier ?? 'basic';

        $updateData = $request->only(['name', 'design_options', 'require_name']);

        if ($tier === 'basic' && isset($updateData['design_options'])) {
            $updateData['design_options'] = null;
        }

        $kiosk->update($updateData);

        return response()->json([
            'success' => true,
            'message' => 'הקיוסק עודכן בהצלחה!',
            'data' => array_merge($kiosk->fresh()->toArray(), [
                'is_connected' => $kiosk->is_connected,
                'view_url' => url("/kiosk/{$kiosk->token}"),
            ]),
        ]);
    }

    public function destroy(Request $request, $id)
    {
        $user = $request->user();
        $kiosk = Kiosk::where('restaurant_id', $user->restaurant_id)->findOrFail($id);
        $kiosk->delete();

        return response()->json([
            'success' => true,
            'message' => 'הקיוסק נמחק בהצלחה.',
        ]);
    }

    public function toggle(Request $request, $id)
    {
        $user = $request->user();
        $kiosk = Kiosk::where('restaurant_id', $user->restaurant_id)->findOrFail($id);
        $kiosk->update(['is_active' => !$kiosk->is_active]);

        return response()->json([
            'success' => true,
            'message' => $kiosk->is_active ? 'הקיוסק הופעל.' : 'הקיוסק הושבת.',
            'data' => ['is_active' => $kiosk->is_active],
        ]);
    }

    public function regenerateToken(Request $request, $id)
    {
        $user = $request->user();
        $kiosk = Kiosk::where('restaurant_id', $user->restaurant_id)->findOrFail($id);
        $kiosk->update(['token' => (string) Str::uuid()]);

        return response()->json([
            'success' => true,
            'message' => 'הקישור חודש בהצלחה!',
            'data' => [
                'token' => $kiosk->token,
                'view_url' => url("/kiosk/{$kiosk->token}"),
            ],
        ]);
    }

    // ============================================
    // Public Endpoints (no auth, no tenant)
    // ============================================

    public function menu($token)
    {
        $kiosk = Kiosk::withoutGlobalScopes()
            ->where('token', $token)
            ->where('is_active', true)
            ->first();

        if (!$kiosk) {
            return response()->json([
                'success' => false,
                'message' => 'קיוסק לא נמצא או לא פעיל',
            ], 404);
        }

        $kiosk->update(['last_seen_at' => now()]);

        $restaurant = Restaurant::withoutGlobalScopes()->find($kiosk->restaurant_id);

        if (!$restaurant) {
            return response()->json([
                'success' => false,
                'message' => 'מסעדה לא נמצאה',
            ], 404);
        }

        $items = MenuItem::withoutGlobalScopes()
            ->where('restaurant_id', $kiosk->restaurant_id)
            ->where('is_available', true)
            ->whereHas('category', function ($q) {
                $q->where('is_active', true);
            })
            ->with([
                'category:id,name,sort_order,dine_in_adjustment',
                'variants' => function ($q) {
                    $q->where('is_active', true)->orderBy('sort_order');
                },
                'addonGroups' => function ($q) {
                    $q->where('is_active', true)
                        ->orderBy('sort_order')
                        ->with(['addons' => function ($q2) {
                            $q2->where('is_active', true)->orderBy('sort_order');
                        }]);
                },
            ])
            ->get()
            ->sortBy('name')
            ->sortBy(fn($item) => $item->category?->sort_order ?? 0)
            ->values()
            ->map(function ($item) use ($restaurant) {
                $useVariants = $item->use_variants;
                $variants = [];

                if ($useVariants) {
                    $restaurantVariants = $restaurant->variants()
                        ->where('is_active', true)
                        ->orderBy('sort_order')
                        ->get();
                    $variants = $restaurantVariants->map(fn($v) => [
                        'id' => $v->id,
                        'name' => $v->name,
                        'price_delta' => (float) $v->price_delta,
                    ])->toArray();
                } else {
                    $variants = $item->variants->map(fn($v) => [
                        'id' => $v->id,
                        'name' => $v->name,
                        'price_delta' => (float) $v->price_delta,
                    ])->toArray();
                }

                $addonGroups = [];
                if ($item->use_addons) {
                    $restaurantAddonGroups = $restaurant->addonGroups()
                        ->where('is_active', true)
                        ->orderBy('sort_order')
                        ->with(['addons' => function ($q) {
                            $q->where('is_active', true)->orderBy('sort_order');
                        }])
                        ->get();

                    $scope = $item->addons_group_scope;
                    $groupIds = json_decode($scope, true);

                    if (is_array($groupIds) && !empty($groupIds)) {
                        $filtered = $restaurantAddonGroups->filter(fn($g) => in_array($g->id, $groupIds, true));
                    } else {
                        $filtered = $restaurantAddonGroups;
                    }

                    $addonGroups = $filtered->values()->map(fn($g) => [
                        'id' => $g->id,
                        'name' => $g->name,
                        'is_required' => (bool) $g->is_required,
                        'min_selections' => $g->min_selections ?? 0,
                        'max_selections' => $g->max_selections,
                        'selection_type' => $g->selection_type ?? 'multiple',
                        'addons' => $g->addons->map(fn($a) => [
                            'id' => $a->id,
                            'name' => $a->name,
                            'price_delta' => (float) $a->price_delta,
                        ])->toArray(),
                    ])->toArray();
                } else {
                    $addonGroups = $item->addonGroups->map(fn($g) => [
                        'id' => $g->id,
                        'name' => $g->name,
                        'is_required' => (bool) $g->is_required,
                        'min_selections' => $g->min_selections ?? 0,
                        'max_selections' => $g->max_selections,
                        'selection_type' => $g->selection_type ?? 'multiple',
                        'addons' => $g->addons->map(fn($a) => [
                            'id' => $a->id,
                            'name' => $a->name,
                            'price_delta' => (float) $a->price_delta,
                        ])->toArray(),
                    ])->toArray();
                }

                return [
                    'id' => $item->id,
                    'name' => $item->name,
                    'description' => $item->description,
                    'price' => (float) $item->price,
                    'image_url' => $item->image_url,
                    'category_id' => $item->category_id,
                    'category_name' => $item->category?->name,
                    'category_sort_order' => $item->category?->sort_order ?? 0,
                    'use_variants' => (bool) $item->use_variants,
                    'use_addons' => (bool) $item->use_addons,
                    'max_addons' => $item->max_addons,
                    'dine_in_adjustment' => $item->getEffectiveDineInAdjustment(),
                    'variants' => $variants,
                    'addon_groups' => $addonGroups,
                ];
            });

        $categories = $items->groupBy('category_id')
            ->map(function ($groupedItems, $categoryId) {
                $first = $groupedItems->first();
                return [
                    'id' => $categoryId,
                    'name' => $first['category_name'] ?? '',
                    'sort_order' => $first['category_sort_order'] ?? 0,
                ];
            })
            ->sortBy('sort_order')
            ->values();

        return response()->json([
            'success' => true,
            'data' => [
                'kiosk' => [
                    'name' => $kiosk->name,
                    'design_options' => $kiosk->design_options,
                    'require_name' => $kiosk->require_name,
                ],
                'restaurant' => [
                    'name' => $restaurant->name ?? '',
                    'logo_url' => $restaurant->logo_url ?? null,
                    'is_open_now' => $restaurant->is_open_now ?? false,
                    'enable_dine_in_pricing' => (bool) ($restaurant->enable_dine_in_pricing ?? false),
                    'accepted_payment_methods' => $restaurant->getPublicPaymentMethods(),
                ],
                'categories' => $categories,
                'items' => $items->values(),
                'promotions' => $this->getKioskPromotions($restaurant->tenant_id),
            ],
        ]);
    }

    /**
     * קבלת מבצעים פעילים לקיוסק
     */
    private function getKioskPromotions($tenantId)
    {
        try {
            $promotionService = app(PromotionService::class);
            $promotions = $promotionService->getActivePromotions($tenantId);
            return $promotions->map(function ($promotion) {
                return [
                    'id' => $promotion->id,
                    'name' => $promotion->name,
                    'description' => $promotion->description,
                    'rules' => $promotion->rules->map(fn($rule) => [
                        'required_category_id' => $rule->required_category_id,
                        'category_name' => $rule->category?->name ?? '',
                        'min_quantity' => $rule->min_quantity,
                    ]),
                    'rewards' => $promotion->rewards->map(fn($reward) => [
                        'reward_type' => $reward->reward_type,
                        'reward_category_name' => $reward->rewardCategory?->name ?? '',
                        'reward_menu_item_name' => $reward->rewardMenuItem?->name ?? '',
                        'reward_value' => $reward->reward_value,
                    ]),
                ];
            })->values();
        } catch (\Exception $e) {
            return [];
        }
    }

    public function placeOrder(Request $request, $token)
    {
        try {
            $kiosk = Kiosk::withoutGlobalScopes()
                ->where('token', $token)
                ->where('is_active', true)
                ->first();

            if (!$kiosk) {
                return response()->json([
                    'success' => false,
                    'message' => 'קיוסק לא נמצא או לא פעיל',
                ], 404);
            }

            $restaurant = Restaurant::withoutGlobalScopes()
                ->with([
                    'variants' => function ($q) {
                        $q->where('is_active', true)->orderBy('sort_order');
                    },
                    'addonGroups' => function ($q) {
                        $q->where('is_active', true)
                            ->orderBy('sort_order')
                            ->with(['addons' => function ($q2) {
                                $q2->where('is_active', true)->orderBy('sort_order');
                            }]);
                    },
                ])
                ->find($kiosk->restaurant_id);

            if (!$restaurant) {
                return response()->json([
                    'success' => false,
                    'message' => 'מסעדה לא נמצאה',
                ], 404);
            }

            if (!($restaurant->is_open_now ?? false)) {
                return response()->json([
                    'success' => false,
                    'message' => 'המסעדה סגורה כרגע',
                ], 403);
            }

            $validated = $request->validate([
                'customer_name' => 'required|string|max:100',
                'order_type' => 'nullable|string|in:dine_in,takeaway',
                'table_number' => 'nullable|string|max:20',
                'payment_method' => 'nullable|string|in:cash,credit_card',
                'items' => 'required|array|min:1',
                'items.*.menu_item_id' => 'required|integer|exists:menu_items,id',
                'items.*.variant_id' => 'nullable|integer',
                'items.*.addons' => 'nullable|array',
                'items.*.addons.*.addon_id' => 'required',  // integer or 'cat_item_X' for category-based addons
                'items.*.addons.*.on_side' => 'nullable|boolean',
                'items.*.qty' => 'required|integer|min:1',
            ]);

            $tenantId = $restaurant->tenant_id;
            $restaurantVariants = $restaurant->variants ?? collect();
            $restaurantAddonGroups = $this->resolveAddonGroups($restaurant->addonGroups ?? collect());

            $lineItems = [];
            $totalAmount = 0;

            foreach ($validated['items'] as $index => $itemData) {
                $menuItem = MenuItem::withoutGlobalScopes()
                    ->where('restaurant_id', $restaurant->id)
                    ->where('is_available', true)
                    ->with([
                        'variants' => function ($q) {
                            $q->where('is_active', true)->orderBy('sort_order');
                        },
                        'addonGroups' => function ($q) {
                            $q->where('is_active', true)
                                ->orderBy('sort_order')
                                ->with(['addons' => function ($q2) {
                                    $q2->where('is_active', true)->orderBy('sort_order');
                                }]);
                        },
                        'category',
                    ])
                    ->find($itemData['menu_item_id']);

                if (!$menuItem) {
                    throw ValidationException::withMessages([
                        "items.$index.menu_item_id" => ['פריט לא זמין'],
                    ]);
                }

                $quantity = $itemData['qty'];

                $selectedVariant = null;
                $variantDelta = 0.0;
                $variantSourceIsRestaurant = $menuItem->use_variants;
                $availableVariants = $variantSourceIsRestaurant ? $restaurantVariants : $menuItem->variants;

                if (isset($itemData['variant_id']) && $itemData['variant_id'] !== null) {
                    $variantId = (int) $itemData['variant_id'];
                    $selectedVariant = $availableVariants->firstWhere('id', $variantId);
                    if (!$selectedVariant) {
                        throw ValidationException::withMessages([
                            "items.$index.variant_id" => ['וריאציה שנבחרה אינה זמינה'],
                        ]);
                    }
                    $variantDelta = round((float) $selectedVariant->price_delta, 2);
                }

                $addonEntries = collect($itemData['addons'] ?? [])
                    ->filter(fn($entry) => is_array($entry) && isset($entry['addon_id']))
                    ->unique('addon_id')
                    ->values();

                $availableAddonGroups = $menuItem->use_addons
                    ? $this->filterAddonGroupsByScope($restaurantAddonGroups, $menuItem)
                    : $this->resolveAddonGroups($menuItem->addonGroups);

                $addonsDetails = [];
                $addonsTotal = 0.0;

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
                            "items.$index.addons" => ['תוספת שנבחרה אינה זמינה'],
                        ]);
                    }

                    $addonPrice = round((float) $matchedAddon->price_delta, 2);
                    $addonsDetails[] = [
                        'id' => $matchedAddon->id,
                        'name' => $matchedAddon->name,
                        'price_delta' => $addonPrice,
                        'group_id' => $matchedGroup->id,
                        'group_name' => $matchedGroup->name,
                        'on_side' => $addonEntry['on_side'] ?? false,
                    ];
                    $addonsTotal += $addonPrice;
                }

                $addonsTotal = round($addonsTotal, 2);
                $basePrice = round((float) $menuItem->price, 2);

                // התאמת מחיר לישיבה
                $dineInAdjustment = 0.0;
                $orderType = $validated['order_type'] ?? 'takeaway';
                if ($orderType === 'dine_in' && ($restaurant->enable_dine_in_pricing ?? false)) {
                    $dineInAdjustment = round($menuItem->getEffectiveDineInAdjustment(), 2);
                }

                $unitPrice = round($basePrice + $variantDelta + $addonsTotal + $dineInAdjustment, 2);
                $lineTotal = round($unitPrice * $quantity, 2);
                $totalAmount = round($totalAmount + $lineTotal, 2);

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

            // קביעת אמצעי תשלום - ברירת מחדל: מזומן
            $paymentMethod = $validated['payment_method'] ?? 'cash';
            // ולידציה שהמסעדה תומכת באמצעי התשלום שנבחר
            if ($paymentMethod === 'credit_card' && !$restaurant->acceptsCreditCard()) {
                $paymentMethod = 'cash';
            }

            $order = Order::create([
                'tenant_id' => $tenantId,
                'restaurant_id' => $restaurant->id,
                'customer_name' => $validated['customer_name'] ?? 'לקוח קיוסק',
                'customer_phone' => '',
                'delivery_method' => 'pickup',
                'payment_method' => $paymentMethod,
                'payment_status' => Order::PAYMENT_PENDING,
                'source' => 'kiosk',
                'kiosk_id' => $kiosk->id,
                'order_type' => $validated['order_type'] ?? 'takeaway',
                'table_number' => $validated['table_number'] ?? null,
                'status' => Order::STATUS_PENDING,
                'total_amount' => $totalAmount,
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

            // Send FCM notification to tablets
            $tableInfo = $order->table_number ? " | שולחן {$order->table_number}" : '';
            $this->sendOrderNotification(
                tenantId: $tenantId,
                title: "הזמנת קיוסק חדשה #{$order->id}",
                body: "הזמנה מהקיוסק בסך ₪{$order->total_amount}{$tableInfo}",
                data: [
                    'orderId' => (string) $order->id,
                    'type' => 'new_order',
                    'source' => 'kiosk',
                    'url' => '/admin/orders',
                ]
            );

            return response()->json([
                'success' => true,
                'message' => 'ההזמנה נקלטה בהצלחה!',
                'data' => [
                    'order_id' => $order->id,
                    'total_amount' => (float) $order->total_amount,
                ],
            ], 201);
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'שגיאה בנתונים',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Throwable $e) {
            Log::error('Kiosk order creation failed', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'שגיאה ביצירת הזמנה',
            ], 500);
        }
    }

    // ============================================
    // Private Helpers
    // ============================================

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

    private function filterAddonGroupsByScope($groups, MenuItem $item)
    {
        if (empty($item->addons_group_scope)) {
            return $groups;
        }

        $scope = $item->addons_group_scope;
        $groupIds = json_decode($scope, true);

        if (is_array($groupIds) && !empty($groupIds)) {
            return $groups->filter(fn($g) => in_array($g->id, $groupIds, true))->values();
        }

        return $groups;
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
            Log::warning('Failed to send kiosk FCM notification', [
                'error' => $e->getMessage(),
            ]);
        }
    }
}
