<?php

namespace App\Http\Controllers;

use App\Models\Promotion;
use App\Models\PromotionRule;
use App\Models\PromotionReward;
use App\Services\PromotionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

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
            $validated = $request->validate([
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
                'rules' => 'required|array|min:1',
                'rules.*.required_category_id' => 'required|integer|exists:categories,id',
                'rules.*.min_quantity' => 'required|integer|min:1',
                'rewards' => 'required|array|min:1',
                'rewards.*.reward_type' => 'required|in:free_item,discount_percent,discount_fixed,fixed_price',
                'rewards.*.reward_category_id' => 'nullable|integer|exists:categories,id',
                'rewards.*.reward_menu_item_id' => 'nullable|integer|exists:menu_items,id',
                'rewards.*.reward_value' => 'nullable|numeric|min:0',
                'rewards.*.max_selectable' => 'nullable|integer|min:1',
            ]);

            $tenantId = app('tenant_id');
            $restaurant = \App\Models\Restaurant::where('tenant_id', $tenantId)->first();

            if (!$restaurant) {
                return response()->json(['success' => false, 'message' => 'מסעדה לא נמצאה'], 404);
            }

            $promotion = DB::transaction(function () use ($validated, $tenantId, $restaurant) {
                $promotion = Promotion::create([
                    'tenant_id' => $tenantId,
                    'restaurant_id' => $restaurant->id,
                    'name' => $validated['name'],
                    'description' => $validated['description'] ?? null,
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
                ]);

                foreach ($validated['rules'] as $rule) {
                    PromotionRule::create([
                        'promotion_id' => $promotion->id,
                        'required_category_id' => $rule['required_category_id'],
                        'min_quantity' => $rule['min_quantity'],
                    ]);
                }

                foreach ($validated['rewards'] as $reward) {
                    PromotionReward::create([
                        'promotion_id' => $promotion->id,
                        'reward_type' => $reward['reward_type'],
                        'reward_category_id' => $reward['reward_category_id'] ?? null,
                        'reward_menu_item_id' => $reward['reward_menu_item_id'] ?? null,
                        'reward_value' => $reward['reward_value'] ?? null,
                        'max_selectable' => $reward['max_selectable'] ?? 1,
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
            $validated = $request->validate([
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
                'rules' => 'required|array|min:1',
                'rules.*.required_category_id' => 'required|integer|exists:categories,id',
                'rules.*.min_quantity' => 'required|integer|min:1',
                'rewards' => 'required|array|min:1',
                'rewards.*.reward_type' => 'required|in:free_item,discount_percent,discount_fixed,fixed_price',
                'rewards.*.reward_category_id' => 'nullable|integer|exists:categories,id',
                'rewards.*.reward_menu_item_id' => 'nullable|integer|exists:menu_items,id',
                'rewards.*.reward_value' => 'nullable|numeric|min:0',
                'rewards.*.max_selectable' => 'nullable|integer|min:1',
            ]);

            $promotion = Promotion::findOrFail($id);

            DB::transaction(function () use ($promotion, $validated) {
                $promotion->update([
                    'name' => $validated['name'],
                    'description' => $validated['description'] ?? null,
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
                ]);

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
                    PromotionReward::create([
                        'promotion_id' => $promotion->id,
                        'reward_type' => $reward['reward_type'],
                        'reward_category_id' => $reward['reward_category_id'] ?? null,
                        'reward_menu_item_id' => $reward['reward_menu_item_id'] ?? null,
                        'reward_value' => $reward['reward_value'] ?? null,
                        'max_selectable' => $reward['max_selectable'] ?? 1,
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
                    'gift_required' => $promotion->gift_required,
                    'stackable' => $promotion->stackable,
                    'auto_apply' => $promotion->auto_apply,
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
}
