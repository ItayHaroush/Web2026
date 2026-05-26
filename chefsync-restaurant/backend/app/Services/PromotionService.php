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

        // resolve missing category_id and unit price from menu_items table
        $missingCategoryItemIds = [];
        $cartMenuItemIds = [];
        foreach ($cartItems as $i => $item) {
            $catId = (int) ($item['category_id'] ?? 0);
            if ($catId <= 0 && !empty($item['menu_item_id'])) {
                $missingCategoryItemIds[(int) $item['menu_item_id']] = $i;
            }
            if (!empty($item['menu_item_id'])) {
                $cartMenuItemIds[] = (int) $item['menu_item_id'];
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

        // מחירי בסיס למוצרים — לחישוב תוספת שדרוג (price diff)
        $menuItemPriceMap = [];
        if (!empty($cartMenuItemIds)) {
            $menuItemPriceMap = MenuItem::whereIn('id', array_unique($cartMenuItemIds))
                ->where('tenant_id', $tenantId)
                ->pluck('price', 'id')
                ->map(fn($p) => (float) $p)
                ->toArray();
        }

        // מיפוי כמויות לפי קטגוריה
        $categoryQuantities = [];
        // מיפוי כמויות לפי קטגוריה+מוצר (לחישוב תוספת שדרוג)
        $categoryItemQuantities = []; // [catId][menuItemId] => qty
        foreach ($cartItems as $item) {
            $categoryId = (int) ($item['category_id'] ?? 0);
            if ($categoryId > 0) {
                $qty = (int) ($item['qty'] ?? $item['quantity'] ?? 1);
                $categoryQuantities[$categoryId] = ($categoryQuantities[$categoryId] ?? 0) + $qty;
                $mid = (int) ($item['menu_item_id'] ?? 0);
                if ($mid > 0) {
                    $categoryItemQuantities[$categoryId][$mid] =
                        ($categoryItemQuantities[$categoryId][$mid] ?? 0) + $qty;
                }
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
                    'required_menu_item_ids' => $rule->required_menu_item_ids ?? [],
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
                // תוספת שדרוג מחושבת תמיד כאשר יש פריטי-עוגן בכלל,
                // גם עבור "מחיר קבוע" — המחיר הקבוע יחול רק על העוגן,
                // ופריטים אחרים מהקטגוריה ישלמו את ההפרש מעוגן המחיר.
                'upgrade_surcharge' => $allMet && !$this->promotionHasFixedPriceReward($promotion)
                    ? $this->computeUpgradeSurchargeForRules(
                        $rules,
                        $categoryItemQuantities,
                        $menuItemPriceMap,
                        $timesQualified
                    )
                    : 0.0,
                // עבור מבצעי "מחיר קבוע" — bundle_savings כבר מחשב נטו
                // (allocated − target − non_anchor_surcharge) כדי לכלול את ההפרש בעוגן.
                'bundle_savings' => $allMet && $this->promotionHasFixedPriceReward($promotion)
                    ? $this->computeBundleSavingsForEligibility(
                        $promotion,
                        $categoryItemQuantities,
                        $menuItemPriceMap,
                        $timesQualified
                    )
                    : 0.0,
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
        $categoryItemQuantities = []; // [catId][menuItemId] => qty
        $menuItemPriceMap = []; // [menuItemId] => unit base price (price_at_order - addons_total)
        foreach ($lineItems as $item) {
            $categoryId = (int) ($item['category_id'] ?? 0);
            if ($categoryId > 0) {
                $qty = (int) ($item['quantity'] ?? 1);
                $categoryQuantities[$categoryId] = ($categoryQuantities[$categoryId] ?? 0) + $qty;
                $mid = (int) ($item['menu_item_id'] ?? 0);
                if ($mid > 0) {
                    $categoryItemQuantities[$categoryId][$mid] =
                        ($categoryItemQuantities[$categoryId][$mid] ?? 0) + $qty;
                    if (!isset($menuItemPriceMap[$mid])) {
                        $addons = (float) ($item['addons_total'] ?? 0);
                        $menuItemPriceMap[$mid] = max(0.0, (float) ($item['price_at_order'] ?? 0) - $addons);
                    }
                }
            }
        }

        $totalDiscount = 0;
        $totalUpgradeSurcharge = 0.0;
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

            // תוספת שדרוג — כשתנאי מעוגן למוצרים ספציפיים, מוצרים אחרים מהקטגוריה
            // משלמים הפרש מעוגן המחיר. רלוונטי גם ל-"מחיר קבוע":
            // המחיר הקבוע ניתן רק על מוצר העוגן, ולפריטים אחרים מהקטגוריה מתווסף ההפרש.
            $promotionUpgrade = $this->computeUpgradeSurchargeForRules(
                $promotion->rules,
                $categoryItemQuantities,
                $menuItemPriceMap,
                $timesQualified
            );
            $totalUpgradeSurcharge += $promotionUpgrade;

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
            $fixedPriceRewards = $promotion->rewards->filter(fn($r) => $r->reward_type === 'fixed_price');
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
            'upgrade_surcharge' => round($totalUpgradeSurcharge, 2),
            'gift_items_count' => count($giftItems),
            'applied_promotions_count' => count($appliedPromotions),
        ]);

        // תוספת השדרוג מקטינה את ההנחה הנטו (ללא ירידה מתחת ל-0)
        $netDiscount = max(0.0, round($totalDiscount - $totalUpgradeSurcharge, 2));

        // הגנה: ההנחה לעולם לא תעלה על סכום הפריטים בסל (מונע מחיר סופי שלילי)
        $cartTotal = round(array_sum(array_map(fn($li) => $this->lineSubtotal($li), $lineItems)), 2);
        if ($netDiscount > $cartTotal) {
            Log::warning('Promotion discount capped to cart total', [
                'raw_discount' => $netDiscount,
                'cart_total' => $cartTotal,
            ]);
            $netDiscount = $cartTotal;
        }

        return [
            'promotion_discount' => $netDiscount,
            'upgrade_surcharge' => round($totalUpgradeSurcharge, 2),
            'gross_discount' => round($totalDiscount, 2),
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
            fn($li) => $this->lineSubtotal($li),
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
        $idSet = array_flip(array_map(static fn($id) => (int) $id, $menuItemIds));
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
        $idSet = array_flip(array_map(static fn($id) => (int) $id, $menuItemIds));
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
            // מחיר קבוע מחליף רק את מחיר הבסיס (+ וריאציה); תוספות בתשלום מתווספות על גביו ולא נכללות בהקצאת החבילה
            $addonsPerUnit = (float) ($line['addons_total'] ?? 0);
            $baseUnitPrice = max(0.0, (float) ($line['price_at_order'] ?? 0) - $addonsPerUnit);
            $take = min($remaining, $avail);
            $sum += $baseUnitPrice * $take;
            $remainingByIndex[$idx] = $avail - $take;
            $remaining -= $take;
        }

        return round($sum, 2);
    }

    /**
     * האם המבצע כולל פרס מסוג "מחיר קבוע" — אם כן, לא צריך תוספת שדרוג
     * כיוון שהמחיר הקבוע כבר מתמחר את החבילה כולה.
     */
    private function promotionHasFixedPriceReward($promotion): bool
    {
        $rewards = $promotion->rewards ?? collect();
        foreach ($rewards as $r) {
            if (($r->reward_type ?? '') === 'fixed_price') {
                return true;
            }
        }
        return false;
    }

    /**
     * חישוב חיסכון מבצע "מחיר חבילה" עבור תצוגת זכאות.
     * חיסכון = סכום מחירי בסיס (DB) של היחידות שמוקצות לתנאי − סך המחיר הקבוע × times.
     *
     * @param  array<int, array<int, int>>  $categoryItemQuantities  [catId][menuItemId] => qty
     * @param  array<int, float>  $menuItemPriceMap  [menuItemId] => base price
     */
    private function computeBundleSavingsForEligibility(
        Promotion $promotion,
        array $categoryItemQuantities,
        array $menuItemPriceMap,
        int $timesQualified
    ): float {
        if ($timesQualified < 1 || $promotion->rules->isEmpty()) {
            return 0.0;
        }

        // עותק כמויות לכל קטגוריה כדי לעקוב אחרי ההקצאה
        $remaining = [];
        foreach ($categoryItemQuantities as $catId => $items) {
            $remaining[$catId] = $items;
        }

        $allocated = 0.0;
        foreach ($promotion->rules as $rule) {
            $catId = (int) $rule->required_category_id;
            $need = (int) $rule->min_quantity * $timesQualified;
            if ($need <= 0 || empty($remaining[$catId])) {
                continue;
            }
            // הקצה את הזולים תחילה — תואם לחישוב הצרכן (פחות אגרסיבי)
            $items = $remaining[$catId];
            $sortable = [];
            foreach ($items as $mid => $qty) {
                if ($qty > 0) {
                    $sortable[] = ['mid' => (int) $mid, 'qty' => (int) $qty, 'price' => (float) ($menuItemPriceMap[$mid] ?? 0)];
                }
            }
            usort($sortable, fn($a, $b) => $a['price'] <=> $b['price']);
            $left = $need;
            foreach ($sortable as $row) {
                if ($left <= 0) break;
                $take = min($left, $row['qty']);
                $allocated += $row['price'] * $take;
                $remaining[$catId][$row['mid']] = $row['qty'] - $take;
                $left -= $take;
            }
        }

        $target = 0.0;
        foreach ($promotion->rewards as $reward) {
            if (($reward->reward_type ?? '') === 'fixed_price') {
                $target += (float) $reward->reward_value * $timesQualified;
            }
        }

        // המחיר הקבוע ניתן רק על מוצר העוגן; פריטים אחרים מהקטגוריה משלמים את ההפרש
        // מעוגן המחיר על גבי המחיר הקבוע. נחסיר זאת מהחיסכון המוצג.
        $nonAnchorSurcharge = $this->computeUpgradeSurchargeForRules(
            $promotion->rules,
            $categoryItemQuantities,
            $menuItemPriceMap,
            $timesQualified
        );

        return max(0.0, round($allocated - $target - $nonAnchorSurcharge, 2));
    }

    /**
     * חישוב תוספת שדרוג: כאשר התנאי מציין מוצרים ספציפיים ועוגן מחיר,
     * מוצרים אחרים מאותה קטגוריה שמוקצים לתנאי משלמים את ההפרש מעוגן המחיר.
     *
     * אסטרטגיית הקצאה: קודם פריטי-עוגן הספציפיים (ללא הפרש), ואחר כך פריטים אחרים
     * מהקטגוריה (חיוב = max(0, מחיר_פריט - מחיר_עוגן) ליחידה).
     *
     * @param  iterable  $rules  PromotionRule collection
     * @param  array<int, array<int, int>>  $categoryItemQuantities  [catId][menuItemId] => qty
     * @param  array<int, float>  $menuItemPriceMap  [menuItemId] => unit base price
     */
    private function computeUpgradeSurchargeForRules(
        iterable $rules,
        array $categoryItemQuantities,
        array $menuItemPriceMap,
        int $timesQualified
    ): float {
        if ($timesQualified < 1) {
            return 0.0;
        }
        $totalSurcharge = 0.0;

        foreach ($rules as $rule) {
            $required = $rule->required_menu_item_ids ?? [];
            if (!is_array($required) || count($required) === 0) {
                continue;
            }
            $catId = (int) $rule->required_category_id;
            $unitsNeeded = (int) $rule->min_quantity * $timesQualified;
            if ($unitsNeeded <= 0) {
                continue;
            }

            $itemQtys = $categoryItemQuantities[$catId] ?? [];
            if (empty($itemQtys)) {
                continue;
            }

            $anchorId = (int) $required[0];
            $anchorPrice = (float) ($menuItemPriceMap[$anchorId] ?? 0);
            $requiredSet = array_flip(array_map('intval', $required));

            $remaining = $unitsNeeded;

            // שלב 1: ספיגה ע"י פריטי-עוגן/דרישה (ללא הפרש)
            foreach ($requiredSet as $rid => $_) {
                if ($remaining <= 0) {
                    break 1;
                }
                $avail = (int) ($itemQtys[$rid] ?? 0);
                if ($avail <= 0) {
                    continue;
                }
                $take = min($avail, $remaining);
                $itemQtys[$rid] = $avail - $take;
                $remaining -= $take;
            }

            if ($remaining <= 0) {
                continue;
            }

            // שלב 2: שאר היחידות מגיעות מפריטים אחרים בקטגוריה — חיוב הפרש (אם יש).
            // נמיין מהזול ליקר כדי לא "להעניש" את הלקוח יותר מהנדרש.
            $others = [];
            foreach ($itemQtys as $mid => $qty) {
                if ($qty <= 0 || isset($requiredSet[(int) $mid])) {
                    continue;
                }
                $others[] = [
                    'menu_item_id' => (int) $mid,
                    'qty' => (int) $qty,
                    'price' => (float) ($menuItemPriceMap[(int) $mid] ?? $anchorPrice),
                ];
            }
            usort($others, fn($a, $b) => $a['price'] <=> $b['price']);

            foreach ($others as $row) {
                if ($remaining <= 0) {
                    break;
                }
                $take = min($row['qty'], $remaining);
                $diff = max(0.0, $row['price'] - $anchorPrice);
                $totalSurcharge += $diff * $take;
                $remaining -= $take;
            }
        }

        return round($totalSurcharge, 2);
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
