<?php

namespace App\Http\Controllers;

use App\Models\IsraeliHoliday;
use App\Models\Restaurant;
use App\Models\RestaurantHolidayHour;
use Illuminate\Http\Request;

/**
 * ניהול שעות חג למסעדה — Admin (מנהל מסעדה)
 */
class HolidayScheduleController extends Controller
{
    /**
     * חגים קרובים + תגובת המסעדה הנוכחית (אם קיימת)
     */
    public function upcoming(Request $request)
    {
        $tenantId = app('tenant_id');
        $restaurant = Restaurant::where('tenant_id', $tenantId)->first();

        if (!$restaurant) {
            return response()->json(['success' => false, 'message' => 'מסעדה לא נמצאה'], 404);
        }

        $holidays = IsraeliHoliday::upcoming()
            ->orderBy('start_date')
            ->get();

        // צירוף תגובת המסעדה לכל חג
        $holidayIds = $holidays->pluck('id');
        $responses = RestaurantHolidayHour::where('restaurant_id', $restaurant->id)
            ->whereIn('holiday_id', $holidayIds)
            ->get()
            ->keyBy('holiday_id');

        $data = $holidays->map(function ($holiday) use ($responses) {
            $response = $responses->get($holiday->id);
            return [
                'id' => $holiday->id,
                'name' => $holiday->name,
                'hebrew_date_info' => $holiday->hebrew_date_info,
                'start_date' => $holiday->start_date->toDateString(),
                'end_date' => $holiday->end_date->toDateString(),
                'type' => $holiday->type,
                'description' => $holiday->description,
                'response' => $response ? [
                    'status' => $response->status,
                    'open_time' => $response->open_time,
                    'close_time' => $response->close_time,
                    'note' => $response->note,
                    'responded_at' => $response->responded_at,
                ] : null,
            ];
        });

        return response()->json(['success' => true, 'data' => $data]);
    }

    /**
     * שמירת/עדכון תגובה לחג
     */
    public function respond(Request $request, int $holidayId)
    {
        $tenantId = app('tenant_id');
        $restaurant = Restaurant::where('tenant_id', $tenantId)->first();

        if (!$restaurant) {
            return response()->json(['success' => false, 'message' => 'מסעדה לא נמצאה'], 404);
        }

        $holiday = IsraeliHoliday::findOrFail($holidayId);

        $validated = $request->validate([
            'status' => 'required|in:open,closed,special_hours',
            'open_time' => 'nullable|required_if:status,special_hours|date_format:H:i',
            'close_time' => 'nullable|required_if:status,special_hours|date_format:H:i',
            'note' => 'nullable|string|max:500',
        ]);

        $response = RestaurantHolidayHour::updateOrCreate(
            [
                'restaurant_id' => $restaurant->id,
                'holiday_id' => $holiday->id,
            ],
            [
                'status' => $validated['status'],
                'open_time' => $validated['status'] === 'special_hours' ? $validated['open_time'] : null,
                'close_time' => $validated['status'] === 'special_hours' ? $validated['close_time'] : null,
                'note' => $validated['note'] ?? null,
                'responded_at' => now(),
            ]
        );

        return response()->json([
            'success' => true,
            'message' => 'תגובה לחג נשמרה בהצלחה',
            'data' => $response,
        ]);
    }
}
