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
    /**
     * קבל רשימת כל המסעדות (ללא צורך באימות)
     */
    public function index(Request $request)
    {
        try {
            $query = Restaurant::where('is_open', true);

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

            return response()->json([
                'success' => true,
                'data' => $restaurants,
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
