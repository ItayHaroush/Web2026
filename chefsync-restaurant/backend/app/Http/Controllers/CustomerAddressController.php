<?php

namespace App\Http\Controllers;

use App\Models\CustomerAddress;
use Illuminate\Http\Request;

class CustomerAddressController extends Controller
{
    /**
     * רשימת כתובות הלקוח
     */
    public function index(Request $request)
    {
        $addresses = $request->customer->addresses()
            ->orderByDesc('is_default')
            ->orderByDesc('updated_at')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $addresses,
        ]);
    }

    /**
     * יצירת כתובת חדשה
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'label' => 'sometimes|string|max:50',
            'street' => 'required|string|max:255',
            'house_number' => 'required|string|max:20',
            'apartment' => 'nullable|string|max:20',
            'floor' => 'nullable|string|max:10',
            'entrance' => 'nullable|string|max:20',
            'city' => 'required|string|max:255',
            'lat' => 'nullable|numeric|between:-90,90',
            'lng' => 'nullable|numeric|between:-180,180',
            'notes' => 'nullable|string|max:500',
            'is_default' => 'sometimes|boolean',
        ]);

        $customer = $request->customer;

        // אם זו כתובת ברירת מחדל, בטל default מכתובות אחרות
        if (!empty($validated['is_default'])) {
            $customer->addresses()->update(['is_default' => false]);
        }

        // אם זו הכתובת הראשונה, הגדר כברירת מחדל
        if ($customer->addresses()->count() === 0) {
            $validated['is_default'] = true;
        }

        $address = $customer->addresses()->create($validated);

        return response()->json([
            'success' => true,
            'message' => 'הכתובת נשמרה בהצלחה',
            'data' => $address,
        ], 201);
    }

    /**
     * עדכון כתובת
     */
    public function update(Request $request, $id)
    {
        $address = $request->customer->addresses()->findOrFail($id);

        $validated = $request->validate([
            'label' => 'sometimes|string|max:50',
            'street' => 'sometimes|string|max:255',
            'house_number' => 'sometimes|string|max:20',
            'apartment' => 'nullable|string|max:20',
            'floor' => 'nullable|string|max:10',
            'entrance' => 'nullable|string|max:20',
            'city' => 'sometimes|string|max:255',
            'lat' => 'nullable|numeric|between:-90,90',
            'lng' => 'nullable|numeric|between:-180,180',
            'notes' => 'nullable|string|max:500',
            'is_default' => 'sometimes|boolean',
        ]);

        if (!empty($validated['is_default'])) {
            $request->customer->addresses()->where('id', '!=', $id)->update(['is_default' => false]);
        }

        $address->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'הכתובת עודכנה',
            'data' => $address->fresh(),
        ]);
    }

    /**
     * מחיקת כתובת
     */
    public function destroy(Request $request, $id)
    {
        $address = $request->customer->addresses()->findOrFail($id);
        $wasDefault = $address->is_default;
        $address->delete();

        // אם נמחקה כתובת ברירת מחדל, הגדר את הראשונה הנותרת
        if ($wasDefault) {
            $first = $request->customer->addresses()->first();
            if ($first) {
                $first->update(['is_default' => true]);
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'הכתובת נמחקה',
        ]);
    }

    /**
     * הגדרת כתובת כברירת מחדל
     */
    public function setDefault(Request $request, $id)
    {
        $address = $request->customer->addresses()->findOrFail($id);

        $request->customer->addresses()->update(['is_default' => false]);
        $address->update(['is_default' => true]);

        return response()->json([
            'success' => true,
            'message' => 'כתובת ברירת מחדל עודכנה',
            'data' => $address->fresh(),
        ]);
    }
}
