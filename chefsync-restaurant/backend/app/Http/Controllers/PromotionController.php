<?php

namespace App\Http\Controllers;

use App\Models\Promotion;
use App\Models\PromotionRule;
use App\Models\PromotionReward;
use App\Services\PromotionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * PromotionController - ניהול מבצעים
 */
class PromotionController extends Controller
{
    private PromotionService $promotionService;

    public function __construct(PromotionService $promotionService)
    {
        $this->promotionService = $promotionService;
    }

    /**
     * רשימת כל המבצעים (Admin)
     */
    public function index(Request $request)
    {
        try {
            $promotions = Promotion::with(['rules.category', 'rewards.rewardCategory', 'rewards.rewardMenuItem'])
                ->orderBy('priority', 'desc')
                ->orderBy('created_at', 'desc')
                ->get();

            return response()->json([
                'success' => true,
                'data' => $promotions,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'שגיאה בטעינת מבצעים',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * יצירת מבצע חדש (Admin)
     */
    public function store(Request $request)
    {
        try {
            $tenantId = app('tenant_id');
            $validated = $this->validatePromotionPayload($request, $tenantId, false);
            $validated = $this->mergeActiveDaysFromRequest($request, $validated);
            $restaurant = \App\Models\Restaurant::where('tenant_id', $tenantId)->first();

            if (!$restaurant) {
                return response()->json(['success' => false, 'message' => 'מסעדה לא נמצאה'], 404);
            }

            $imageUrl = null;
            if ($request->hasFile('image')) {
                $file = $request->file('image');
                $filename = Str::uuid() . '.' . $file->getClientOriginalExtension();
                $file->storeAs('public/promotions', $filename);
                $imageUrl = Storage::url('public/promotions/' . $filename);
            }

            $promotion = DB::transaction(function () use ($validated, $tenantId, $restaurant, $imageUrl) {
                $promotion = Promotion::create([
                    'tenant_id' => $tenantId,
                    'restaurant_id' => $restaurant->id,
                    'name' => $validated['name'],
                    'description' => $validated['description'] ?? null,
                    'image_url' => $imageUrl,
                    'start_at' => $validated['start_at'] ?? null,
                    'end_at' => $validated['end_at'] ?? null,
                    'active_hours_start' => $validated['active_hours_start'] ?? null,
                    'active_hours_end' => $validated['active_hours_end'] ?? null,
                    'active_days' => $validated['active_days'] ?? null,
                    'is_active' => $validated['is_active'] ?? true,
                    'priority' => $validated['priority'] ?? 0,
                    'auto_apply' => $validated['auto_apply'] ?? true,
                    'gift_required' => $validated['gift_required'] ?? false,
                    'stackable' => $validated['stackable'] ?? false,
                    'show_menu_banner' => $validated['show_menu_banner'] ?? true,
                    'show_entry_popup' => $validated['show_entry_popup'] ?? true,
                ]);

                foreach ($validated['rules'] as $rule) {
                    PromotionRule::create([
                        'promotion_id' => $promotion->id,
                        'required_category_id' => $rule['required_category_id'],
                        'min_quantity' => $rule['min_quantity'],
                    ]);
                }

                foreach ($validated['rewards'] as $reward) {
                    $nr = $this->normalizeRewardForPersistence($reward);
                    PromotionReward::create([
                        'promotion_id' => $promotion->id,
                        'reward_type' => $nr['reward_type'],
                        'reward_category_id' => $nr['reward_category_id'],
                        'reward_menu_item_id' => $nr['reward_menu_item_id'],
                        'reward_value' => $nr['reward_value'],
                        'max_selectable' => $nr['max_selectable'],
                        'discount_scope' => $nr['discount_scope'],
                        'discount_menu_item_ids' => $nr['discount_menu_item_ids'],
                    ]);
                }

                return $promotion;
            });

            return response()->json([
                'success' => true,
                'message' => 'מבצע נוצר בהצלחה',
                'data' => $promotion->load(['rules.category', 'rewards.rewardCategory', 'rewards.rewardMenuItem']),
            ], 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'שגיאה בתקינות הנתונים',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            Log::error('Promotion creation failed', ['error' => $e->getMessage()]);
            return response()->json([
                'success' => false,
                'message' => 'שגיאה ביצירת מבצע',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * מבצע בודד (Admin)
     */
    public function show(Request $request, $id)
    {
        try {
            $promotion = Promotion::with(['rules.category', 'rewards.rewardCategory', 'rewards.rewardMenuItem'])->findOrFail($id);

            return response()->json([
                'success' => true,
                'data' => $promotion,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'מבצע לא נמצא',
            ], 404);
        }
    }

    /**
     * עדכון מבצע (Admin)
     */
    public function update(Request $request, $id)
    {
        try {
            $tenantId = app('tenant_id');
            $validated = $this->validatePromotionPayload($request, $tenantId, true);
            $validated = $this->mergeActiveDaysFromRequest($request, $validated);

            $promotion = Promotion::findOrFail($id);

            $imageUrl = $promotion->image_url;
            if ($request->hasFile('image')) {
                // Delete old image
                if ($promotion->image_url) {
                    $oldPath = str_replace('/storage/', 'public/', $promotion->image_url);
                    Storage::delete($oldPath);
                }
                $file = $request->file('image');
                $filename = Str::uuid() . '.' . $file->getClientOriginalExtension();
                $file->storeAs('public/promotions', $filename);
                $imageUrl = Storage::url('public/promotions/' . $filename);
            } elseif ($this->shouldRemoveImage($request)) {
                if ($promotion->image_url) {
                    $oldPath = str_replace('/storage/', 'public/', $promotion->image_url);
                    Storage::delete($oldPath);
                }
                $imageUrl = null;
            }

            DB::transaction(function () use ($promotion, $validated, $imageUrl) {
                $updateData = [
                    'name' => $validated['name'],
                    'description' => $validated['description'] ?? null,
                    'image_url' => $imageUrl,
                    'start_at' => $validated['start_at'] ?? null,
                    'end_at' => $validated['end_at'] ?? null,
                    'active_hours_start' => $validated['active_hours_start'] ?? null,
                    'active_hours_end' => $validated['active_hours_end'] ?? null,
                    'is_active' => $validated['is_active'] ?? true,
                    'priority' => $validated['priority'] ?? 0,
                    'auto_apply' => $validated['auto_apply'] ?? true,
                    'gift_required' => $validated['gift_required'] ?? false,
                    'stackable' => $validated['stackable'] ?? false,
                    'show_menu_banner' => $validated['show_menu_banner'] ?? true,
                    'show_entry_popup' => $validated['show_entry_popup'] ?? true,
                ];
                // FormData ללא active_days כש"כל הימים" — לא לדרוס ערך שמור ב-DB
                if (array_key_exists('active_days', $validated)) {
                    $updateData['active_days'] = $validated['active_days'];
                }
                $promotion->update($updateData);

                // Sync rules
                $promotion->rules()->delete();
                foreach ($validated['rules'] as $rule) {
                    PromotionRule::create([
                        'promotion_id' => $promotion->id,
                        'required_category_id' => $rule['required_category_id'],
                        'min_quantity' => $rule['min_quantity'],
                    ]);
                }

                // Sync rewards
                $promotion->rewards()->delete();
                foreach ($validated['rewards'] as $reward) {
                    $nr = $this->normalizeRewardForPersistence($reward);
                    PromotionReward::create([
                        'promotion_id' => $promotion->id,
                        'reward_type' => $nr['reward_type'],
                        'reward_category_id' => $nr['reward_category_id'],
                        'reward_menu_item_id' => $nr['reward_menu_item_id'],
                        'reward_value' => $nr['reward_value'],
                        'max_selectable' => $nr['max_selectable'],
                        'discount_scope' => $nr['discount_scope'],
                        'discount_menu_item_ids' => $nr['discount_menu_item_ids'],
                    ]);
                }
            });

            return response()->json([
                'success' => true,
                'message' => 'מבצע עודכן בהצלחה',
                'data' => $promotion->load(['rules.category', 'rewards.rewardCategory', 'rewards.rewardMenuItem']),
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'שגיאה בתקינות הנתונים',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            Log::error('Promotion update failed', ['error' => $e->getMessage()]);
            return response()->json([
                'success' => false,
                'message' => 'שגיאה בעדכון מבצע',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * מחיקת מבצע (Admin)
     */
    public function destroy(Request $request, $id)
    {
        try {
            $promotion = Promotion::findOrFail($id);
            $promotion->delete();

            return response()->json([
                'success' => true,
                'message' => 'מבצע נמחק בהצלחה',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'שגיאה במחיקת מבצע',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * הפעלה/כיבוי מבצע (Admin)
     */
    public function toggle(Request $request, $id)
    {
        try {
            $promotion = Promotion::findOrFail($id);
            $promotion->update(['is_active' => !$promotion->is_active]);

            return response()->json([
                'success' => true,
                'message' => $promotion->is_active ? 'מבצע הופעל' : 'מבצע כובה',
                'data' => $promotion,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'שגיאה בעדכון סטטוס',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * מבצעים פעילים ללקוח (Public)
     */
    public function active(Request $request)
    {
        try {
            $tenantId = app('tenant_id');
            $promotions = $this->promotionService->getActivePromotions($tenantId);

            $data = $promotions->map(function ($promotion) {
                return [
                    'id' => $promotion->id,
                    'name' => $promotion->name,
                    'description' => $promotion->description,
                    'image_url' => $promotion->image_url,
                    'gift_required' => $promotion->gift_required,
                    'stackable' => $promotion->stackable,
                    'auto_apply' => $promotion->auto_apply,
                    'show_menu_banner' => $promotion->show_menu_banner ?? true,
                    'show_entry_popup' => $promotion->show_entry_popup ?? true,
                    'rules' => $promotion->rules->map(function ($rule) {
                        return [
                            'required_category_id' => $rule->required_category_id,
                            'category_name' => $rule->category?->name ?? '',
                            'min_quantity' => $rule->min_quantity,
                        ];
                    }),
                    'rewards' => $promotion->rewards->map(function ($reward) {
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
                    }),
                ];
            });

            return response()->json([
                'success' => true,
                'data' => $data,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'שגיאה בטעינת מבצעים',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * בדיקת זכאות לפי תוכן סל (Public)
     */
    public function check(Request $request)
    {
        try {
            $validated = $request->validate([
                'items' => 'required|array|min:1',
                'items.*.menu_item_id' => 'required|integer',
                'items.*.category_id' => 'nullable|integer',
                'items.*.qty' => 'required|integer|min:1',
            ]);

            $tenantId = app('tenant_id');
            $eligible = $this->promotionService->checkEligibility($validated['items'], $tenantId);

            return response()->json([
                'success' => true,
                'eligible' => $eligible,
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
                'message' => 'שגיאה בבדיקת זכאות',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function validatePromotionPayload(Request $request, string $tenantId, bool $isUpdate): array
    {
        $rules = [
            'name' => 'required|string|max:100',
            'description' => 'nullable|string|max:500',
            'start_at' => 'nullable|date',
            'end_at' => 'nullable|date|after_or_equal:start_at',
            'active_hours_start' => 'nullable|date_format:H:i',
            'active_hours_end' => 'nullable|date_format:H:i',
            'active_days' => 'nullable|array',
            'active_days.*' => 'integer|between:0,6',
            'is_active' => 'boolean',
            'priority' => 'nullable|integer|min:0',
            'auto_apply' => 'boolean',
            'gift_required' => 'boolean',
            'stackable' => 'boolean',
            'show_menu_banner' => 'sometimes|boolean',
            'show_entry_popup' => 'sometimes|boolean',
            'active_days_reset' => 'sometimes|boolean',
            'rules' => 'required|array|min:1',
            'rules.*.required_category_id' => ['required', 'integer', Rule::exists('categories', 'id')->where('tenant_id', $tenantId)],
            'rules.*.min_quantity' => 'required|integer|min:1',
            'rewards' => 'required|array|min:1',
            'rewards.*.reward_type' => 'required|in:free_item,discount_percent,discount_fixed,fixed_price',
            'rewards.*.reward_category_id' => ['nullable', 'integer', Rule::exists('categories', 'id')->where('tenant_id', $tenantId)],
            'rewards.*.reward_menu_item_id' => ['nullable', 'integer', Rule::exists('menu_items', 'id')->where('tenant_id', $tenantId)],
            'rewards.*.reward_value' => 'nullable|numeric|min:0',
            'rewards.*.max_selectable' => 'nullable|integer|min:1',
            'rewards.*.discount_scope' => 'nullable|in:whole_cart,selected_items',
            'rewards.*.discount_menu_item_ids' => 'nullable|array',
            'rewards.*.discount_menu_item_ids.*' => ['integer', Rule::exists('menu_items', 'id')->where('tenant_id', $tenantId)],
        ];
        // תמונה: nullable כדי שעדכون בלא תמונה או עם הסרה לא יגרום לשגיאה
        $rules['image'] = 'nullable|image|max:12288';
        if ($isUpdate) {
            // remove_image יכול להגיע כ-string ('0', '1', 'true', 'false') מ-FormData או כ-boolean
            $rules['remove_image'] = 'nullable|in:0,1,true,false';
        }

        $validator = Validator::make($request->all(), $rules);

        $validator->after(function ($validator) use ($request) {
            $rewards = $request->input('rewards', []);
            if (!is_array($rewards)) {
                return;
            }
            foreach ($rewards as $i => $reward) {
                if (!is_array($reward)) {
                    continue;
                }
                $type = $reward['reward_type'] ?? '';
                $scope = $reward['discount_scope'] ?? 'whole_cart';
                if (!in_array($type, ['discount_percent', 'discount_fixed'], true)) {
                    continue;
                }
                if ($scope !== 'selected_items') {
                    continue;
                }
                $ids = $reward['discount_menu_item_ids'] ?? [];
                if (!is_array($ids)) {
                    $validator->errors()->add("rewards.{$i}.discount_menu_item_ids", 'נא לבחור לפחות מוצר אחד להנחה על פריטים נבחרים.');

                    continue;
                }
                $nonEmpty = array_filter($ids, fn ($v) => $v !== '' && $v !== null);
                if (count($nonEmpty) === 0) {
                    $validator->errors()->add("rewards.{$i}.discount_menu_item_ids", 'נא לבחור לפחות מוצר אחד להנחה על פריטים נבחרים.');
                }
            }
        });

        return $validator->validate();
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return array<string, mixed>
     */
    private function mergeActiveDaysFromRequest(Request $request, array $validated): array
    {
        if ($request->boolean('active_days_reset')) {
            $validated['active_days'] = null;
        } elseif (array_key_exists('active_days', $validated)) {
            $validated['active_days'] = $this->normalizeActiveDaysPayload($validated['active_days']);
        }

        return $validated;
    }

    /**
     * @return list<int>|null
     */
    private function normalizeActiveDaysPayload(mixed $value): ?array
    {
        if ($value === null || $value === '') {
            return null;
        }
        if (! is_array($value)) {
            return null;
        }
        $nums = [];
        foreach ($value as $d) {
            if ($d === '' || $d === null) {
                continue;
            }
            $n = (int) $d;
            if ($n >= 0 && $n <= 6) {
                $nums[$n] = $n;
            }
        }
        $out = array_values($nums);
        sort($out, SORT_NUMERIC);

        return $out === [] ? null : $out;
    }

    /**
     * @param  array<string, mixed>  $reward
     * @return array{reward_type: string, reward_category_id: ?int, reward_menu_item_id: ?int, reward_value: mixed, max_selectable: int, discount_scope: string, discount_menu_item_ids: ?array}
     */
    private function normalizeRewardForPersistence(array $reward): array
    {
        $type = $reward['reward_type'];
        $discountScope = 'whole_cart';
        $discountMenuItemIds = null;
        if (in_array($type, ['discount_percent', 'discount_fixed'], true)) {
            $scope = $reward['discount_scope'] ?? 'whole_cart';
            $rawIds = $reward['discount_menu_item_ids'] ?? [];
            if ($scope === 'selected_items' && is_array($rawIds) && count($rawIds) > 0) {
                $discountScope = 'selected_items';
                $discountMenuItemIds = array_values(array_unique(array_map(
                    static fn ($v) => (int) $v,
                    array_filter($rawIds, static fn ($v) => $v !== '' && $v !== null)
                )));
                if ($discountMenuItemIds === []) {
                    $discountScope = 'whole_cart';
                    $discountMenuItemIds = null;
                }
            }
        }

        return [
            'reward_type' => $type,
            'reward_category_id' => isset($reward['reward_category_id']) && $reward['reward_category_id'] !== '' ? (int) $reward['reward_category_id'] : null,
            'reward_menu_item_id' => isset($reward['reward_menu_item_id']) && $reward['reward_menu_item_id'] !== '' ? (int) $reward['reward_menu_item_id'] : null,
            'reward_value' => $reward['reward_value'] ?? null,
            'max_selectable' => (int) ($reward['max_selectable'] ?? 1),
            'discount_scope' => $discountScope,
            'discount_menu_item_ids' => $discountMenuItemIds,
        ];
    }

    /**
     * בדוק אם צריך להסיר תמונה: קבל string '1', '0', 'true', 'false' מ-FormData
     */
    private function shouldRemoveImage(Request $request): bool
    {
        $removeImage = $request->input('remove_image');
        if ($removeImage === null || $removeImage === '') {
            return false;
        }
        // FormData ממיר boolean לstring — קבל '1', 'true', true, 1
        return in_array($removeImage, ['1', 'true', true, 1], true);
    }
}
