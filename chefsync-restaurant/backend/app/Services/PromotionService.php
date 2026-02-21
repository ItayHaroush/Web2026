<?php

namespace App\Services;

use App\Models\Promotion;
use App\Models\PromotionUsage;
use App\Models\MenuItem;
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
                    ->orWhereJsonContains('active_days', $currentDay);
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
                                $totalDiscount += (float) $giftMenuItem->price;
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

                            $totalDiscount += (float) $giftMenuItem->price;
                            $validGifts++;
                        }
                    }
                } elseif ($reward->reward_type === 'discount_percent') {
                    $itemsTotal = array_sum(array_map(
                        fn($li) => round((float) $li['price_at_order'] * (int) ($li['quantity'] ?? 1), 2),
                        $lineItems
                    ));
                    $totalDiscount += round($itemsTotal * ((float) $reward->reward_value / 100), 2) * $timesQualified;
                } elseif ($reward->reward_type === 'discount_fixed') {
                    $totalDiscount += (float) $reward->reward_value * $timesQualified;
                }
            }

            if (!$promotion->stackable) {
                $appliedNonStackable = true;
            }
        }

        return [
            'promotion_discount' => round($totalDiscount, 2),
            'gift_items' => $giftItems,
        ];
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
