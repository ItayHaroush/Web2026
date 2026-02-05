<?php

namespace App\Http\Controllers;

use App\Models\MenuItem;
use App\Models\Category;
use App\Models\Restaurant;
use Illuminate\Http\Request;

/**
 * MenuController - ניהול תפריט המסעדה
 */
class MenuController extends Controller
{
    private const DEFAULT_SALAD_GROUP_NAME = 'סלטים קבועים';
    private const DEFAULT_HOT_GROUP_NAME = 'תוספות חמות';
    /**
     * קבל את כל התפריט של המסעדה הנוכחית (Tenant)
     * כולל קטגוריות ופריטים זמינים בלבד
     */
    public function getMenu(Request $request)
    {
        try {
            $tenantId = app('tenant_id');
            
            // בדיקת אישור - אבל לא במצב preview (מסעדן מתנסה)
            $isPreviewMode = $request->header('X-Preview-Mode') === 'true';

            // ✅ אימות אבטחה: במצב preview, וודא שהמשתמש הוא הבעלים של המסעדה
            if ($isPreviewMode) {
                $user = $request->user('sanctum');
                if (!$user || !$user->restaurant || $user->restaurant->tenant_id !== $tenantId) {
                    \Log::warning('Preview mode security violation', [
                        'requested_tenant' => $tenantId,
                        'user_tenant' => $user?->restaurant?->tenant_id ?? 'none',
                        'user_id' => $user?->id ?? 'none',
                    ]);
                    return response()->json([
                        'success' => false,
                        'message' => 'אין לך הרשאה לצפות בתפריט של מסעדה זו',
                        'error' => 'unauthorized_preview',
                    ], 403);
                }
            }

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

            if (!$restaurant || (!$restaurant->is_approved && !$isPreviewMode)) {
                return response()->json([
                    'success' => false,
                    'message' => 'המסעדה ממתינה לאישור מנהל מערכת ואינה זמינה עדיין להזמנות',
                    'error' => 'restaurant_not_approved',
                ], 403);
            }

            $restaurantVariants = $restaurant?->variants ?? collect();
            $restaurantAddonGroups = $restaurant?->addonGroups ?? collect();

            // קבל קטגוריות - במצב preview הצג הכל, אחרת רק פעילות
            $categoriesQuery = Category::where('tenant_id', $tenantId);
            
            if (!$isPreviewMode) {
                $categoriesQuery->where('is_active', true);
            }
            
            $categories = $categoriesQuery
                ->orderBy('sort_order')
                ->with([
                    'items' => function ($query) use ($isPreviewMode) {
                        if (!$isPreviewMode) {
                            $query->where('is_available', true);
                        }
                        $query->orderBy('name')
                            ->with([
                                'variants' => function ($variantQuery) use ($isPreviewMode) {
                                    if (!$isPreviewMode) {
                                        $variantQuery->where('is_active', true);
                                    }
                                    $variantQuery->orderBy('sort_order');
                                },
                                'addonGroups' => function ($groupQuery) use ($isPreviewMode) {
                                    if (!$isPreviewMode) {
                                        $groupQuery->where('is_active', true);
                                    }
                                    $groupQuery->orderBy('sort_order')
                                        ->with([
                                            'addons' => function ($addonQuery) use ($isPreviewMode) {
                                                if (!$isPreviewMode) {
                                                    $addonQuery->where('is_active', true);
                                                }
                                                $addonQuery->orderBy('sort_order');
                                            }
                                        ]);
                                }
                            ]);
                    }
                ])
                ->get()
                ->map(function ($category) use ($restaurantVariants, $restaurantAddonGroups) {
                    return [
                        'id' => $category->id,
                        'name' => $category->name,
                        'description' => $category->description,
                        'icon' => $category->icon,
                        'items' => $category->items->map(function ($item) use ($restaurantVariants, $restaurantAddonGroups) {
                            $variants = $item->use_variants
                                ? $restaurantVariants->map(function ($variant) {
                                    return [
                                        'id' => $variant->id,
                                        'name' => $variant->name,
                                        'price_delta' => (float) $variant->price_delta,
                                        'is_default' => (bool) $variant->is_default,
                                    ];
                                })->values()->toArray()
                                : $item->variants->map(function ($variant) {
                                    return [
                                        'id' => $variant->id,
                                        'name' => $variant->name,
                                        'price_delta' => (float) $variant->price_delta,
                                        'is_default' => (bool) $variant->is_default,
                                    ];
                                })->values()->toArray();

                            $addonGroups = $item->use_addons
                                ? $this->filterAddonGroupsByScope($restaurantAddonGroups, $item, $item->category_id)
                                ->map(function ($group) use ($item) {
                                    $maxSelect = $group->max_selections;
                                    // אם אין הגבלה בקבוצה, נשתמש במקסימום מהמנה (רק אם לא בחרו כמה קבוצות)
                                    if ($maxSelect === null && $item->max_addons) {
                                        $scope = $item->addons_group_scope;
                                        $groupIds = json_decode($scope, true);
                                        // אם זה array עם קבוצה אחת בלבד, או פורמט ישן שאינו 'both'
                                        if ((is_array($groupIds) && count($groupIds) === 1) ||
                                            (!is_array($groupIds) && $scope !== 'both')
                                        ) {
                                            $maxSelect = $item->max_addons;
                                        }
                                    }
                                    return [
                                        'id' => $group->id,
                                        'name' => $group->name,
                                        'selection_type' => $group->selection_type,
                                        'min_select' => $group->min_selections,
                                        'max_select' => $maxSelect,
                                        'is_required' => (bool) $group->is_required,
                                        'placement' => $group->placement ?? 'inside',
                                        'addons' => $group->addons->map(function ($addon) {
                                            return [
                                                'id' => $addon->id,
                                                'name' => $addon->name,
                                                'price_delta' => (float) $addon->price_delta,
                                                'selection_weight' => (int) ($addon->selection_weight ?? 1),
                                                'is_default' => false,
                                            ];
                                        })->values()->toArray(),
                                    ];
                                })->values()->toArray()
                                : $item->addonGroups->map(function ($group) {
                                    return [
                                        'id' => $group->id,
                                        'name' => $group->name,
                                        'selection_type' => $group->selection_type,
                                        'min_select' => $group->min_selections,
                                        'max_select' => $group->max_selections,
                                        'is_required' => (bool) $group->is_required,
                                        'placement' => $group->placement ?? 'inside',
                                        'addons' => $group->addons->map(function ($addon) {
                                            return [
                                                'id' => $addon->id,
                                                'name' => $addon->name,
                                                'price_delta' => (float) $addon->price_delta,
                                                'selection_weight' => (int) ($addon->selection_weight ?? 1),
                                                'is_default' => (bool) $addon->is_default,
                                            ];
                                        })->values()->toArray(),
                                    ];
                                })->values()->toArray();

                            return [
                                'id' => $item->id,
                                'name' => $item->name,
                                'description' => $item->description,
                                'price' => (float) $item->price,
                                'image_url' => $item->image_url,
                                'variants' => $variants,
                                'addon_groups' => $addonGroups,
                            ];
                        })->values()->toArray(),
                    ];
                })->values();

            return response()->json([
                'success' => true,
                'data' => $categories,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'שגיאה בטעינת התפריט',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * עדכן זמינות של פריט תפריט (דרוש אימות)
     */
    public function updateItemAvailability(Request $request, $id)
    {
        try {
            $validated = $request->validate([
                'is_available' => 'required|boolean',
            ]);

            $tenantId = app('tenant_id');
            $item = MenuItem::where('tenant_id', $tenantId)
                ->findOrFail($id);

            $item->update(['is_available' => $validated['is_available']]);

            return response()->json([
                'success' => true,
                'message' => 'עדכון הצליח',
                'data' => $item,
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'שגיאה בתקינות הנתונים',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'שגיאה בעדכון הפריט',
                'error' => $e->getMessage(),
            ], 500);
        }
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
            });
        } else {
            // תאימות לאחור - ערכים ישנים: 'salads', 'hot', 'both'
            if ($scope === 'both') {
                $filteredGroups = $groups;
            } elseif ($scope === 'salads') {
                $filteredGroups = $groups->filter(fn($g) => $g->name === 'סלטים קבועים');
            } elseif ($scope === 'hot') {
                $filteredGroups = $groups->filter(fn($g) => $g->name === 'תוספות חמות');
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
}
