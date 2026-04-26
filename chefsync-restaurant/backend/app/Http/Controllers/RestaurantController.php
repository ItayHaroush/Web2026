<?php

namespace App\Http\Controllers;

use App\Models\Restaurant;
use App\Models\City;
use App\Models\MenuItem;
use App\Models\IsraeliHoliday;
use App\Models\RestaurantHolidayHour;
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
            'description' => $restaurant->description ?? null,
            'cuisine_type' => $restaurant->cuisine_type ?? null,
            'restaurant_type' => $restaurant->restaurant_type ?? null,
            'logo_url' => $restaurant->logo_url,
            'phone' => $restaurant->phone,
            'address' => $restaurant->address,
            'city' => $restaurant->city,
            'latitude' => $latitude,
            'longitude' => $longitude,
            'is_approved' => (bool) ($restaurant->is_approved ?? false),
            'is_demo' => (bool) ($restaurant->is_demo ?? false),
            'is_open' => (bool) $restaurant->is_open,
            'is_override_status' => (bool) ($restaurant->is_override_status ?? false),
            'is_open_now' => (bool) ($restaurant->is_open_now ?? false),
            'operating_days' => $restaurant->operating_days ?? [],
            'operating_hours' => $restaurant->operating_hours ?? [],
            'has_delivery' => $restaurant->relationLoaded('deliveryZones') ? $restaurant->deliveryZones->isNotEmpty() : false,
            'has_pickup' => $restaurant->has_pickup ?? true,
            'share_incentive_text' => $restaurant->share_incentive_text,
            'delivery_time_minutes' => $restaurant->delivery_time_minutes,
            'delivery_time_note' => $restaurant->delivery_time_note,
            'pickup_time_minutes' => $restaurant->pickup_time_minutes,
            'pickup_time_note' => $restaurant->pickup_time_note,
            'kosher_type' => $restaurant->kosher_type ?? null,
            'kosher_certificate' => $restaurant->kosher_certificate ?? null,
            'kosher_notes' => $restaurant->kosher_notes ?? null,
            'common_allergens' => $restaurant->common_allergens ?? [],
            'allergen_notes' => $restaurant->allergen_notes ?? null,
            'available_payment_methods' => $restaurant->getPublicPaymentMethods(),
            'accepts_credit_card' => $restaurant->acceptsCreditCard(),
            'delivery_minimum' => $restaurant->delivery_minimum ?? 0,
            'allow_future_orders' => (bool) ($restaurant->allow_future_orders ?? false),
            'holiday_closures' => $this->getHolidayClosures($restaurant),
        ];
    }

    /**
     * חגים שהמסעדה סגורה בהם (או שעות מיוחדות) — ל-30 יום הקרובים
     */
    private function getHolidayClosures(Restaurant $restaurant): array
    {
        $today = now('Asia/Jerusalem')->toDateString();
        $endDate = now('Asia/Jerusalem')->addDays(30)->toDateString();

        $holidays = IsraeliHoliday::where('end_date', '>=', $today)
            ->where('start_date', '<=', $endDate)
            ->get();

        if ($holidays->isEmpty()) {
            return [];
        }

        $responses = RestaurantHolidayHour::where('restaurant_id', $restaurant->id)
            ->whereIn('holiday_id', $holidays->pluck('id'))
            ->get()
            ->keyBy('holiday_id');

        $closures = [];
        foreach ($holidays as $holiday) {
            $response = $responses->get($holiday->id);
            if (!$response) continue; // אין תגובה — שעות רגילות

            $closures[] = [
                'name' => $holiday->name,
                'start_date' => \Carbon\Carbon::parse($holiday->start_date)->format('Y-m-d'),
                'end_date' => \Carbon\Carbon::parse($holiday->end_date)->format('Y-m-d'),
                'status' => $response->status,
                'open_time' => $response->status === 'special_hours' ? $response->open_time : null,
                'close_time' => $response->status === 'special_hours' ? $response->close_time : null,
            ];
        }

        return $closures;
    }

    /**
     * קבל רשימת כל המסעדות (ללא צורך באימות)
     */
    public function index(Request $request)
    {
        try {
            $query = Restaurant::query()->where('is_approved', true)->with('deliveryZones');

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

            // מיון: פתוחות קודם, בתוך כל קבוצה - הזמנה מראש קודם
            $restaurants = $restaurants
                ->sort(function ($a, $b) {
                    $aOpen = (bool) ($a->is_open_now ?? false);
                    $bOpen = (bool) ($b->is_open_now ?? false);
                    if ($aOpen !== $bOpen) return $bOpen <=> $aOpen;
                    $aFuture = (bool) ($a->allow_future_orders ?? false);
                    $bFuture = (bool) ($b->allow_future_orders ?? false);
                    return $bFuture <=> $aFuture;
                })
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

    /**     * חיפוש מנות בתפריטים של מסעדות מאושרות (לפי עיר)
     */
    public function searchMenuItems(Request $request)
    {
        try {
            $q = trim($request->input('q', ''));
            if (mb_strlen($q) < 2) {
                return response()->json(['success' => true, 'data' => []]);
            }

            // מצא מסעדות מאושרות בעיר הנבחרת
            $restaurantQuery = Restaurant::where('is_approved', true);
            if ($request->filled('city')) {
                $cityInput = $request->city;
                $cityModel = City::where('hebrew_name', $cityInput)
                    ->orWhere('name', $cityInput)->first();
                if ($cityModel) {
                    $restaurantQuery->whereIn('city', [
                        $cityModel->hebrew_name ?? $cityInput,
                        $cityModel->name ?? $cityInput,
                    ]);
                } else {
                    $restaurantQuery->where('city', $cityInput);
                }
            }
            $restaurantIds = $restaurantQuery->pluck('id');

            // חפש מנות פעילות — ללא global scope של tenant
            $items = MenuItem::withoutGlobalScope('tenant')
                ->whereIn('restaurant_id', $restaurantIds)
                ->where('is_active', true)
                ->where('is_available', true)
                ->where(function ($query) use ($q) {
                    $query->where('name', 'LIKE', "%{$q}%")
                          ->orWhere('description', 'LIKE', "%{$q}%");
                })
                ->with('restaurant:id,name,tenant_id,logo_url,city,is_open,is_override_status,is_demo,operating_hours')
                ->select('id', 'restaurant_id', 'name', 'description', 'price', 'image_url')
                ->limit(30)
                ->get();

            return response()->json([
                'success' => true,
                'data' => $items->map(fn(MenuItem $item) => [
                    'id' => $item->id,
                    'name' => $item->name,
                    'description' => $item->description,
                    'price' => (float) $item->price,
                    'image_url' => $item->image_url,
                    'restaurant_name' => $item->restaurant?->name,
                    'restaurant_tenant_id' => $item->restaurant?->tenant_id,
                    'restaurant_logo' => $item->restaurant?->logo_url,
                    'is_open_now' => (bool) ($item->restaurant?->is_open_now ?? false),
                    'is_demo' => (bool) ($item->restaurant?->is_demo ?? false),
                ]),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'שגיאה בחיפוש',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**     * קבל פרטי מסעדה לפי tenant/slug (ציבורי)
     * מיועד לעמודי תפריט ציבוריים: /:tenantId/menu
     * לא מסנן לפי is_open כדי שמשתמש חדש יראה את דף המסעדה המלא גם אם היא סגורה.
     */
    public function publicShowByTenant(Request $request, string $tenantId)
    {
        try {
            $tenantId = trim($tenantId);
            $restaurant = Restaurant::withoutGlobalScopes()
                ->where(function ($q) use ($tenantId) {
                    $q->where('tenant_id', $tenantId)->orWhere('slug', $tenantId);
                })
                ->with('deliveryZones')
                ->firstOrFail();

            // דמו ציבורי נחסם; מסעדה חדשה לפני אישור עדיין נגישה לבעלים/שיתוף (ללא אינדוקס ב-SEO).
            $isPreviewMode = $request->header('X-Preview-Mode') === 'true';

            if (!$isPreviewMode && ($restaurant->is_demo ?? false)) {
                return response()->json([
                    'success' => false,
                    'message' => 'המסעדה לא זמינה',
                    'error' => 'restaurant_not_available',
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
