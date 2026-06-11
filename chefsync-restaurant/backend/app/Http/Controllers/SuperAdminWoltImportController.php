<?php

namespace App\Http\Controllers;

use App\Models\Restaurant;
use App\Models\WoltImportRequest;
use App\Services\WoltMenuImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class SuperAdminWoltImportController extends Controller
{
    public function preview(Request $request, int $restaurantId): JsonResponse
    {
        $validated = $request->validate([
            'wolt_url' => 'required|string|max:500',
        ]);

        $restaurant = Restaurant::findOrFail($restaurantId);

        try {
            $preview = app(WoltMenuImportService::class)->previewFromUrl($validated['wolt_url']);

            return response()->json([
                'success' => true,
                'data' => [
                    'restaurant' => [
                        'id' => $restaurant->id,
                        'name' => $restaurant->name,
                        'tenant_id' => $restaurant->tenant_id,
                    ],
                    'wolt_url' => $validated['wolt_url'],
                    'slug' => $preview['slug'],
                    'summary' => $preview['summary'],
                    'restaurant_meta' => $preview['restaurant_meta'] ?? [],
                    'categories' => $preview['categories'],
                ],
            ]);
        } catch (\Throwable $e) {
            Log::warning('Super admin wolt preview failed', [
                'restaurant_id' => $restaurant->id,
                'tenant_id' => $restaurant->tenant_id,
                'wolt_url' => $validated['wolt_url'],
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    public function apply(Request $request, int $restaurantId): JsonResponse
    {
        $validated = $request->validate([
            'wolt_url' => 'nullable|string|max:500',
            'request_id' => 'nullable|integer|exists:wolt_import_requests,id',
            'categories' => 'required|array|min:1',
            'categories.*.name' => 'required|string|max:255',
            'categories.*.items' => 'required|array|min:1',
            'categories.*.items.*.name' => 'required|string|max:255',
            'categories.*.items.*.description' => 'nullable|string|max:1000',
            'categories.*.items.*.price' => 'required|numeric|min:0|max:100000',
            'categories.*.items.*.image_url' => 'nullable|string|max:2000',
                'categories.*.items.*.wolt_external_id' => 'nullable|string|max:255',
                'categories.*.items.*.option_groups' => 'nullable|array',
                'categories.*.items.*.option_groups.*.name' => 'required|string|max:255',
                'categories.*.items.*.option_groups.*.wolt_option_group_id' => 'nullable|string|max:255',
                'categories.*.items.*.option_groups.*.selection_type' => 'nullable|in:single,multiple',
                'categories.*.items.*.option_groups.*.min_selections' => 'nullable|integer|min:0',
                'categories.*.items.*.option_groups.*.max_selections' => 'nullable|integer|min:0',
                'categories.*.items.*.option_groups.*.is_required' => 'nullable|boolean',
                'categories.*.items.*.option_groups.*.sort_order' => 'nullable|integer|min:0',
                'categories.*.items.*.option_groups.*.addons' => 'required|array|min:1',
                'categories.*.items.*.option_groups.*.addons.*.name' => 'required|string|max:255',
                'categories.*.items.*.option_groups.*.addons.*.wolt_option_id' => 'nullable|string|max:255',
                'categories.*.items.*.option_groups.*.addons.*.price_delta' => 'nullable|numeric|min:0',
                'categories.*.items.*.option_groups.*.addons.*.is_default' => 'nullable|boolean',
                'categories.*.items.*.option_groups.*.addons.*.sort_order' => 'nullable|integer|min:0',
            'restaurant_meta' => 'nullable|array',
            'restaurant_meta.name' => 'nullable|string|max:255',
            'restaurant_meta.hero_image_url' => 'nullable|string|max:2000',
            'restaurant_meta.logo_url' => 'nullable|string|max:2000',
            'restaurant_meta.phone' => 'nullable|string|max:64',
            'restaurant_meta.email' => 'nullable|string|max:255',
            'restaurant_meta.address' => 'nullable|string|max:500',
            'restaurant_meta.city' => 'nullable|string|max:120',
            'restaurant_meta.description' => 'nullable|string|max:2000',
            'restaurant_meta.kosher_type' => 'nullable|string|max:120',
            'restaurant_meta.kashrut_text' => 'nullable|string|max:2000',
            'restaurant_meta.kosher_notes' => 'nullable|string|max:2000',
            'restaurant_meta.kashrut_level' => 'nullable|string|max:255',
            'restaurant_meta.operating_days' => 'nullable|array',
            'restaurant_meta.operating_hours' => 'nullable|array',
            'restaurant_meta.delivery_zones' => 'nullable|array',
            'restaurant_meta.delivery_zones.*.name' => 'required_with:restaurant_meta.delivery_zones|string|max:255',
            'restaurant_meta.delivery_zones.*.fee' => 'nullable|numeric|min:0',
            'restaurant_meta.delivery_zones.*.min_order' => 'nullable|numeric|min:0',
            'restaurant_meta.delivery_zones.*.max_distance_km' => 'nullable|numeric|min:0',
        ]);

        $restaurant = Restaurant::findOrFail($restaurantId);

        try {
            $result = app(WoltMenuImportService::class)
                ->importFromEditedCategoriesForRestaurant(
                    $restaurant,
                    $validated['categories'],
                    $validated['restaurant_meta'] ?? []
                );

            // אם הייבוא בוצע מתוך בקשת ייבוא של בעל המסעדה — מסמנים אותה כמאושרת.
            if (! empty($validated['request_id'])) {
                WoltImportRequest::where('id', $validated['request_id'])
                    ->where('restaurant_id', $restaurant->id)
                    ->update(['status' => 'approved', 'applied_at' => now()]);
            }

            return response()->json([
                'success' => true,
                'message' => 'ייבוא התפריט נשמר בהצלחה',
                'data' => [
                    'restaurant_id' => $restaurant->id,
                    'tenant_id' => $restaurant->tenant_id,
                    'wolt_url' => $validated['wolt_url'] ?? null,
                    'import_result' => $result,
                ],
            ]);
        } catch (\Throwable $e) {
            Log::warning('Super admin wolt apply failed', [
                'restaurant_id' => $restaurant->id,
                'tenant_id' => $restaurant->tenant_id,
                'wolt_url' => $validated['wolt_url'] ?? null,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * דחיית בקשת ייבוא מוולט שהוגשה בהרשמה.
     */
    public function rejectRequest(int $requestId): JsonResponse
    {
        $importRequest = WoltImportRequest::findOrFail($requestId);

        if ($importRequest->status !== 'pending') {
            return response()->json([
                'success' => false,
                'message' => 'הבקשה כבר טופלה',
            ], 422);
        }

        $importRequest->update(['status' => 'rejected']);

        return response()->json([
            'success' => true,
            'message' => 'בקשת הייבוא נדחתה',
        ]);
    }
}
