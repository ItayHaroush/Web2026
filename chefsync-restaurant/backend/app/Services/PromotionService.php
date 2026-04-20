<?php

namespace App\Services;

use App\Models\MenuItem;
use App\Models\Promotion;
use App\Models\PromotionReward;
use App\Models\PromotionUsage;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

/**
 * PromotionService - מנוע מבצעים
 * מטפל בשליפה, בדיקת זכאות, ולידציה ושמירת שימוש
 */
class PromotionService
{
    /**
     * שליפת מבצעים פעילים לפי tenant
     * מסנן לפי: is_active, טווח תאריכים, שעות פעילות, ימי שבוע
     */
    public function getActivePromotions(string $tenantId): Collection
    {
        $now = now();
        $currentDay = (int) $now->dayOfWeek; // 0=Sunday...6=Saturday
        $currentTime = $now->format('H:i:s');

        return Promotion::where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->where(function ($q) use ($now) {
                $q->whereNull('start_at')->orWhere('start_at', '<=', $now);
            })
            ->where(function ($q) use ($now) {
                $q->whereNull('end_at')->orWhere('end_at', '>=', $now);
            })
            ->where(function ($q) use ($currentTime) {
                $q->where(function ($inner) {
                    // אין הגבלת שעות
                    $inner->whereNull('active_hours_start')->orWhereNull('active_hours_end');
                })->orWhere(function ($inner) use ($currentTime) {
                    // שעות רגילות (לא חוצות חצות)
                    $inner->whereColumn('active_hours_start', '<=', 'active_hours_end')
                        ->where('active_hours_start', '<=', $currentTime)
                        ->where('active_hours_end', '>=', $currentTime);
                })->orWhere(function ($inner) use ($currentTime) {
                    // שעות חוצות חצות (22:00-02:00)
                    $inner->whereColumn('active_hours_start', '>', 'active_hours_end')
                        ->where(function ($midnight) use ($currentTime) {
                            $midnight->where('active_hours_start', '<=', $currentTime)
                                ->orWhere('active_hours_end', '>=', $currentTime);
                        });
                });
            })
            ->where(function ($q) use ($currentDay) {
                $q->whereNull('active_days')
                    ->orWhereJsonContains('active_days', $currentDay)
                    ->orWhereJsonContains('active_days', (string) $currentDay);
            })
            ->with(['rules.category', 'rewards.rewardCategory', 'rewards.rewardMenuItem'])
            ->orderBy('priority', 'desc')
            ->get();
    }

    /**
     * בדיקת זכאות - אילו מבצעים הסל מקיים
     *
     * @param array $cartItems [{menu_item_id, category_id, qty}]
     * @param string $tenantId
     * @return array
     */
    public function checkEligibility(array $cartItems, string $tenantId): array
    {
        $activePromotions = $this->getActivePromotions($tenantId);

        if ($activePromotions->isEmpty()) {
            return [];
        }

        // resolve missing category_id from menu_items table
        $missingCategoryItemIds = [];
        foreach ($cartItems as $i => $item) {
            $catId = (int) ($item['category_id'] ?? 0);
            if ($catId <= 0 && !empty($item['menu_item_id'])) {
                $missingCategoryItemIds[(int) $item['menu_item_id']] = $i;
            }
        }
        if (!empty($missingCategoryItemIds)) {
            $resolvedCategories = MenuItem::whereIn('id', array_keys($missingCategoryItemIds))
                ->where('tenant_id', $tenantId)
                ->pluck('category_id', 'id');
            foreach ($resolvedCategories as $menuItemId => $categoryId) {
                $idx = $missingCategoryItemIds[$menuItemId];
                $cartItems[$idx]['category_id'] = $categoryId;
            }
        }

        // מיפוי כמויות לפי קטגוריה
        $categoryQuantities = [];
        foreach ($cartItems as $item) {
            $categoryId = (int) ($item['category_id'] ?? 0);
            if ($categoryId > 0) {
                $qty = (int) ($item['qty'] ?? $item['quantity'] ?? 1);
                $categoryQuantities[$categoryId] = ($categoryQuantities[$categoryId] ?? 0) + $qty;
            }
        }

        $eligible = [];

        foreach ($activePromotions as $promotion) {
            $rules = $promotion->rules ?? collect();
            $rulesProgress = [];
            $allMet = true;
            $timesQualified = PHP_INT_MAX;

            foreach ($rules as $rule) {
                $requiredCategoryId = $rule->required_category_id;
                $required = $rule->min_quantity;
                $current = $categoryQuantities[$requiredCategoryId] ?? 0;
                $met = $current >= $required;

                if (!$met) {
                    $allMet = false;
                    $timesQualified = 0;
                } else {
                    $timesQualified = min($timesQualified, intdiv($current, $required));
                }

                $rulesProgress[] = [
                    'category_id' => $requiredCategoryId,
                    'category_name' => $rule->category?->name ?? '',
                    'required' => $required,
                    'current' => $current,
                ];
            }

            if ($rules->isEmpty()) {
                $timesQualified = 1;
            }

            $rewards = ($promotion->rewards ?? collect())->map(function ($reward) {
                return [
                    'id' => $reward->id,
                    'reward_type' => $reward->reward_type,
                    'reward_category_id' => $reward->reward_category_id,
                    'reward_category_name' => $reward->rewardCategory?->name ?? '',
                    'reward_menu_item_id' => $reward->reward_menu_item_id,
                    'reward_menu_item_name' => $reward->rewardMenuItem?->name ?? '',
                    'reward_value' => $reward->reward_value,
                    'max_selectable' => $reward->max_selectable,
                    'discount_scope' => $reward->discount_scope ?? 'whole_cart',
                    'discount_menu_item_ids' => $reward->discount_menu_item_ids ?? [],
                ];
            })->toArray();

            $eligible[] = [
                'promotion_id' => $promotion->id,
                'name' => $promotion->name,
                'description' => $promotion->description,
                'gift_required' => $promotion->gift_required,
                'stackable' => $promotion->stackable,
                'priority' => $promotion->priority,
                'rewards' => $rewards,
                'progress' => [
                    'met' => $allMet,
                    'times_qualified' => $allMet ? $timesQualified : 0,
                    'rules' => $rulesProgress,
                ],
            ];
        }

        return $eligible;
    }

    /**
     * ולידציה והחלת מבצעים בזמן checkout
     *
     * @param array $lineItems פריטי ההזמנה (מחושבים מ-OrderController)
     * @param array $appliedPromotions [{promotion_id, gift_items: [{menu_item_id}]}]
     * @param string $tenantId
     * @return array {promotion_discount, gift_items}
     */
    public function validateAndApply(array $lineItems, array $appliedPromotions, string $tenantId): array
    {
        $activePromotions = $this->getActivePromotions($tenantId);
        $activePromotionsById = $activePromotions->keyBy('id');

        // מיפוי כמויות לפי קטגוריה מתוך line items
        $categoryQuantities = [];
        foreach ($lineItems as $item) {
            $categoryId = (int) ($item['category_id'] ?? 0);
            if ($categoryId > 0) {
                $qty = (int) ($item['quantity'] ?? 1);
                $categoryQuantities[$categoryId] = ($categoryQuantities[$categoryId] ?? 0) + $qty;
            }
        }

        $totalDiscount = 0;
        $giftItems = [];
        $appliedNonStackable = false;

        foreach ($appliedPromotions as $applied) {
            $promotionId = (int) $applied['promotion_id'];
            $promotion = $activePromotionsById->get($promotionId);

            if (!$promotion) {
                Log::warning('Promotion not found or inactive at checkout', ['promotion_id' => $promotionId]);
                continue;
            }

            // בדיקת stackable
            if ($appliedNonStackable && !$promotion->stackable) {
                Log::warning('Non-stackable promotion already applied', ['promotion_id' => $promotionId]);
                continue;
            }

            // ולידציה שהתנאים עדיין מתקיימים + חישוב כמה פעמים עומד בתנאים
            $allMet = true;
            $timesQualified = PHP_INT_MAX;
            foreach ($promotion->rules as $rule) {
                $current = $categoryQuantities[$rule->required_category_id] ?? 0;
                if ($current < $rule->min_quantity) {
                    $allMet = false;
                    break;
                }
                $timesQualified = min($timesQualified, intdiv($current, $rule->min_quantity));
            }

            if (!$allMet) {
                Log::warning('Promotion conditions not met at checkout', ['promotion_id' => $promotionId]);
                continue;
            }

            if ($promotion->rules->isEmpty()) {
                $timesQualified = 1;
            }

            // עיבוד פרסים — כפל לפי מספר הפעמים שעומד בתנאים
            foreach ($promotion->rewards as $reward) {
                if ($reward->reward_type === 'free_item') {
                    $effectiveMax = ($reward->max_selectable ?? 1) * $timesQualified;

                    if ($reward->reward_menu_item_id) {
                        $giftMenuItem = MenuItem::where('tenant_id', $tenantId)
                            ->where('id', $reward->reward_menu_item_id)
                            ->where('is_available', true)
                            ->with('category')
                            ->first();

                        if ($giftMenuItem) {
                            for ($i = 0; $i < $effectiveMax; $i++) {
                                $giftItems[] = [
                                    'menu_item_id' => $giftMenuItem->id,
                                    'category_id' => $giftMenuItem->category_id,
                                    'category_name' => $giftMenuItem->category?->name ?? '',
                                    'promotion_id' => $promotionId,
                                ];
                                // פריט מתנה נוסף להזמנה עם price_at_order=0,
                                // אין צורך להוסיף את מחירו ל-totalDiscount כי הוא לא חלק מסכום הפריטים
                            }
                        } else {
                            Log::warning('Specific gift item not found or unavailable', ['menu_item_id' => $reward->reward_menu_item_id]);
                        }
                    } else {
                        // בחירה מקטגוריה - הלקוח בוחר
                        $requestedGifts = $applied['gift_items'] ?? [];
                        $validGifts = 0;

                        foreach ($requestedGifts as $giftReq) {
                            if ($validGifts >= $effectiveMax) {
                                break;
                            }

                            $menuItemId = (int) $giftReq['menu_item_id'];
                            $giftMenuItem = MenuItem::where('tenant_id', $tenantId)
                                ->where('id', $menuItemId)
                                ->where('is_available', true)
                                ->with('category')
                                ->first();

                            if (!$giftMenuItem) {
                                Log::warning('Gift item not found', ['menu_item_id' => $menuItemId]);
                                continue;
                            }

                            if ($reward->reward_category_id && $giftMenuItem->category_id !== $reward->reward_category_id) {
                                Log::warning('Gift item not in reward category', [
                                    'menu_item_id' => $menuItemId,
                                    'item_category' => $giftMenuItem->category_id,
                                    'reward_category' => $reward->reward_category_id,
                                ]);
                                continue;
                            }

                            $giftItems[] = [
                                'menu_item_id' => $giftMenuItem->id,
                                'category_id' => $giftMenuItem->category_id,
                                'category_name' => $giftMenuItem->category?->name ?? '',
                                'promotion_id' => $promotionId,
                            ];

                            // פריט מתנה נוסף להזמנה עם price_at_order=0,
                            // אין צורך להוסיף את מחירו ל-totalDiscount כי הוא לא חלק מסכום הפריטים
                            $validGifts++;
                        }
                    }
                } elseif ($reward->reward_type === 'discount_percent') {
                    $itemsTotal = $this->discountableItemsSubtotal($lineItems, $reward);
                    $scope = $reward->discount_scope ?? 'whole_cart';
                    // whole_cart: אחוז הנחה פעם אחת על כל הסל (לא מוכפל)
                    // selected_items: אחוז הנחה על הפריטים הרלוונטיים (כבר מחושב לפי כמויות)
                    $discountMultiplier = $scope === 'whole_cart' ? 1 : $timesQualified;
                    $totalDiscount += round($itemsTotal * ((float) $reward->reward_value / 100), 2) * $discountMultiplier;
                } elseif ($reward->reward_type === 'discount_fixed') {
                    $scope = $reward->discount_scope ?? 'whole_cart';
                    $ids = $reward->discount_menu_item_ids ?? [];
                    if ($scope === 'selected_items' && is_array($ids) && count($ids) > 0) {
                        $totalDiscount += $this->fixedDiscountSelectedItems(
                            $lineItems,
                            $ids,
                            (float) $reward->reward_value,
                            $timesQualified
                        );
                    } else {
                        $totalDiscount += (float) $reward->reward_value * $timesQualified;
                    }
                }
            }

            // מחיר קבוע לחבילה: סכום יחידות לפי כללי הקטגוריות פחות (reward_value × פעמים שעומד)
            $fixedPriceRewards = $promotion->rewards->filter(fn ($r) => $r->reward_type === 'fixed_price');
            if ($fixedPriceRewards->isNotEmpty() && $promotion->rules->isNotEmpty()) {
                $targetTotal = 0.0;
                foreach ($fixedPriceRewards as $fr) {
                    $targetTotal += round((float) $fr->reward_value * $timesQualified, 2);
                }
                $allocated = $this->bundleAllocatedSubtotalForPromotionRules($promotion, $lineItems, $timesQualified);
                $totalDiscount += max(0, round($allocated - $targetTotal, 2));
            }

            if (!$promotion->stackable) {
                $appliedNonStackable = true;
            }
        }

        Log::info('PromotionService::validateAndApply result', [
            'promotion_discount' => round($totalDiscount, 2),
            'gift_items_count' => count($giftItems),
            'applied_promotions_count' => count($appliedPromotions),
        ]);

        return [
            'promotion_discount' => round($totalDiscount, 2),
            'gift_items' => $giftItems,
        ];
    }

    /**
     * סכום שורות רלוונטיות להנחה באחוזים / בסיס משותף
     *
     * @param  array<int, array<string, mixed>>  $lineItems
     */
    private function discountableItemsSubtotal(array $lineItems, PromotionReward $reward): float
    {
        $scope = $reward->discount_scope ?? 'whole_cart';
        $ids = $reward->discount_menu_item_ids ?? [];
        if ($scope === 'selected_items' && is_array($ids) && count($ids) > 0) {
            return $this->itemsSubtotalForMenuItemIds($lineItems, $ids);
        }

        return round(array_sum(array_map(
            fn ($li) => $this->lineSubtotal($li),
            $lineItems
        )), 2);
    }

    /**
     * @param  array<string, mixed>  $li
     */
    private function lineSubtotal(array $li): float
    {
        return round((float) ($li['price_at_order'] ?? 0) * (int) ($li['quantity'] ?? 1), 2);
    }

    /**
     * @param  array<int, array<string, mixed>>  $lineItems
     * @param  array<int, int|string>  $menuItemIds
     */
    private function itemsSubtotalForMenuItemIds(array $lineItems, array $menuItemIds): float
    {
        $idSet = array_flip(array_map(static fn ($id) => (int) $id, $menuItemIds));
        $sum = 0.0;
        foreach ($lineItems as $li) {
            $mid = (int) ($li['menu_item_id'] ?? 0);
            if ($mid > 0 && isset($idSet[$mid])) {
                $sum += $this->lineSubtotal($li);
            }
        }

        return round($sum, 2);
    }

    /**
     * הנחה קבועה ליחידה על מוצרים נבחרים: לכל שורה min(סכום_שורה, reward_value × כמות), מוכפל ב-timesQualified
     *
     * @param  array<int, array<string, mixed>>  $lineItems
     * @param  array<int, int|string>  $menuItemIds
     */
    private function fixedDiscountSelectedItems(array $lineItems, array $menuItemIds, float $perUnit, int $timesQualified): float
    {
        $idSet = array_flip(array_map(static fn ($id) => (int) $id, $menuItemIds));
        $perApplication = 0.0;
        foreach ($lineItems as $li) {
            $mid = (int) ($li['menu_item_id'] ?? 0);
            if ($mid <= 0 || !isset($idSet[$mid])) {
                continue;
            }
            $qty = (int) ($li['quantity'] ?? 1);
            $lineTotal = $this->lineSubtotal($li);
            $perApplication += min($perUnit * $qty, $lineTotal);
        }

        return round($perApplication * $timesQualified, 2);
    }

    /**
     * סכום מחירון של היחידות שנספרות לתנאי המבצע (למחיר קבוע לחבילה)
     *
     * @param  array<int, array<string, mixed>>  $lineItems
     */
    private function bundleAllocatedSubtotalForPromotionRules(Promotion $promotion, array $lineItems, int $timesQualified): float
    {
        if ($timesQualified < 1 || $promotion->rules->isEmpty()) {
            return 0.0;
        }

        $remainingByIndex = [];
        foreach ($lineItems as $idx => $li) {
            $remainingByIndex[$idx] = (int) ($li['quantity'] ?? 1);
        }

        $allocated = 0.0;
        foreach ($promotion->rules as $rule) {
            $catId = (int) $rule->required_category_id;
            $need = (int) $rule->min_quantity * $timesQualified;
            $allocated += $this->takeSubtotalFromCategoryLines($lineItems, $remainingByIndex, $catId, $need);
        }

        return round($allocated, 2);
    }

    /**
     * @param  array<int, array<string, mixed>>  $lineItems
     * @param  array<int, int>  $remainingByIndex
     */
    private function takeSubtotalFromCategoryLines(array $lineItems, array &$remainingByIndex, int $categoryId, int $unitsNeeded): float
    {
        if ($unitsNeeded <= 0) {
            return 0.0;
        }

        $remaining = $unitsNeeded;
        $sum = 0.0;
        foreach ($lineItems as $idx => $line) {
            if ($remaining <= 0) {
                break;
            }
            if ((int) ($line['category_id'] ?? 0) !== $categoryId) {
                continue;
            }
            $avail = (int) ($remainingByIndex[$idx] ?? 0);
            if ($avail <= 0) {
                continue;
            }
            $qLine = max(1, (int) ($line['quantity'] ?? 1));
            $lineSub = $this->lineSubtotal($line);
            $take = min($remaining, $avail);
            $sum += ($lineSub / $qLine) * $take;
            $remainingByIndex[$idx] = $avail - $take;
            $remaining -= $take;
        }

        return round($sum, 2);
    }

    /**
     * שמירת שימוש במבצע
     */
    public function recordUsage(int $promotionId, int $orderId, ?string $phone): void
    {
        PromotionUsage::create([
            'promotion_id' => $promotionId,
            'order_id' => $orderId,
            'customer_phone' => $phone,
            'used_at' => now(),
        ]);
    }
}
