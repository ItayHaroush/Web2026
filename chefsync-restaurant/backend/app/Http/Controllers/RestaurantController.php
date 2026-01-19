<?php

namespace App\Http\Controllers;

use App\Models\Restaurant;
use App\Models\City;
use Illuminate\Http\Request;

/**
 * RestaurantController - ניהול פרטי המסעדה
 */
class RestaurantController extends Controller
{
    private function toPublicRestaurantPayload(Restaurant $restaurant): array
    {
        $latitude = $restaurant->latitude;
        $longitude = $restaurant->longitude;

        if (($latitude === null || $longitude === null) && !empty($restaurant->city)) {
            static $cityMap = null;
            if ($cityMap === null) {
                $cityMap = [];
                foreach (City::all(['name', 'hebrew_name', 'latitude', 'longitude']) as $city) {
                    if (!empty($city->name)) {
                        $cityMap[$city->name] = $city;
                    }
                    if (!empty($city->hebrew_name)) {
                        $cityMap[$city->hebrew_name] = $city;
                    }
                }
            }

            $cityData = $cityMap[$restaurant->city] ?? null;
            if ($cityData) {
                $latitude = $latitude ?? $cityData->latitude;
                $longitude = $longitude ?? $cityData->longitude;
            }
        }

        return [
            'id' => $restaurant->id,
            'tenant_id' => $restaurant->tenant_id,
            'slug' => $restaurant->slug,
            'name' => $restaurant->name,
            'cuisine_type' => $restaurant->cuisine_type ?? null,
            'logo_url' => $restaurant->logo_url,
            'phone' => $restaurant->phone,
            'address' => $restaurant->address,
            'city' => $restaurant->city,
            'latitude' => $latitude,
            'longitude' => $longitude,
            'is_approved' => (bool) ($restaurant->is_approved ?? false),
            'is_open' => (bool) $restaurant->is_open,
            'is_override_status' => (bool) ($restaurant->is_override_status ?? false),
            'is_open_now' => (bool) ($restaurant->is_open_now ?? false),
            'operating_days' => $restaurant->operating_days ?? [],
            'operating_hours' => $restaurant->operating_hours ?? [],
            'has_delivery' => $restaurant->has_delivery ?? true,
            'has_pickup' => $restaurant->has_pickup ?? true,
            'share_incentive_text' => $restaurant->share_incentive_text,
            'delivery_time_minutes' => $restaurant->delivery_time_minutes,
            'delivery_time_note' => $restaurant->delivery_time_note,
            'pickup_time_minutes' => $restaurant->pickup_time_minutes,
            'pickup_time_note' => $restaurant->pickup_time_note,
        ];
    }

    /**
     * קבל רשימת כל המסעדות (ללא צורך באימות)
     */
    public function index(Request $request)
    {
        try {
            $query = Restaurant::query()->where('is_approved', true);

            // סינון לפי עיר
            if ($request->has('city')) {
                $cityInput = $request->city;
                if (!empty($cityInput)) {
                    // מצא את העיר בטבלת הערים (עברית או אנגלית) והחזר את שתי האפשרויות לסינון
                    $cityModel = City::where('hebrew_name', $cityInput)
                        ->orWhere('name', $cityInput)
                        ->first();

                    if ($cityModel) {
                        $query->whereIn('city', [
                            $cityModel->hebrew_name ?? $cityInput,
                            $cityModel->name ?? $cityInput,
                        ]);
                    } else {
                        // אם לא נמצאה התאמה בטבלת הערים, בצע סינון ישיר
                        $query->where('city', $cityInput);
                    }
                }
            }

            // סינון לפי סוג מטבח
            if ($request->has('cuisine_type')) {
                $query->where('cuisine_type', $request->cuisine_type);
            }

            $restaurants = $query->orderBy('name')->get();

            // סנן בזמן אמת לפי שעות פתיחה (או כפייה, אם קיימת)
            $restaurants = $restaurants
                ->filter(fn($restaurant) => (bool) ($restaurant->is_open_now ?? false))
                ->values();

            return response()->json([
                'success' => true,
                'data' => $restaurants->map(fn(Restaurant $r) => $this->toPublicRestaurantPayload($r))->values(),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'שגיאה בטעינת המסעדות',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * קבל פרטי מסעדה לפי tenant/slug (ציבורי)
     * מיועד לעמודי תפריט ציבוריים: /:tenantId/menu
     * לא מסנן לפי is_open כדי שמשתמש חדש יראה את דף המסעדה המלא גם אם היא סגורה.
     */
    public function publicShowByTenant(Request $request, string $tenantId)
    {
        try {
            $restaurant = Restaurant::query()
                ->where('tenant_id', $tenantId)
                ->orWhere('slug', $tenantId)
                ->firstOrFail();

            if (!$restaurant->is_approved) {
                return response()->json([
                    'success' => false,
                    'message' => 'המסעדה ממתינה לאישור מנהל מערכת',
                    'error' => 'restaurant_not_approved',
                ], 403);
            }

            return response()->json([
                'success' => true,
                'data' => $this->toPublicRestaurantPayload($restaurant),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'המסעדה לא נמצאה',
                'error' => $e->getMessage(),
            ], 404);
        }
    }

    /**
     * קבל פרטי המסעדה (דרוש אימות)
     */
    public function show(Request $request)
    {
        try {
            $tenantId = app('tenant_id');
            $restaurant = Restaurant::where('tenant_id', $tenantId)
                ->firstOrFail();

            return response()->json([
                'success' => true,
                'data' => $restaurant,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'המסעדה לא נמצאה',
                'error' => $e->getMessage(),
            ], 404);
        }
    }

    /**
     * עדכן פרטי המסעדה (דרוש אימות)
     */
    public function update(Request $request)
    {
        try {
            $validated = $request->validate([
                'name' => 'sometimes|string|max:100',
                'phone' => 'sometimes|string|max:20',
                'address' => 'sometimes|string|max:255',
                'is_open' => 'sometimes|boolean',
                'description' => 'sometimes|string',
            ]);

            $tenantId = app('tenant_id');
            $restaurant = Restaurant::where('tenant_id', $tenantId)
                ->firstOrFail();

            $restaurant->update($validated);

            return response()->json([
                'success' => true,
                'message' => 'פרטי המסעדה עודכנו בהצלחה',
                'data' => $restaurant,
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
                'message' => 'שגיאה בעדכון פרטי המסעדה',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}
