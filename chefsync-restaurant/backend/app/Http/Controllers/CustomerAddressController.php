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
            'house_number' => 'nullable|string|max:20',
            'apartment' => 'nullable|string|max:20',
            'floor' => 'nullable|string|max:10',
            'entrance' => 'nullable|string|max:20',
            'city' => 'required|string|max:255',
            'lat' => 'required|numeric|between:-90,90',
            'lng' => 'required|numeric|between:-180,180',
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
        $customer->refresh();
        $customer->syncDefaultDeliveryFromSavedAddresses();

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
            'house_number' => 'sometimes|nullable|string|max:20',
            'apartment' => 'nullable|string|max:20',
            'floor' => 'nullable|string|max:10',
            'entrance' => 'nullable|string|max:20',
            'city' => 'sometimes|string|max:255',
            'lat' => 'sometimes|nullable|numeric|between:-90,90',
            'lng' => 'sometimes|nullable|numeric|between:-180,180',
            'notes' => 'nullable|string|max:500',
            'is_default' => 'sometimes|boolean',
        ]);

        $mergedLat = array_key_exists('lat', $validated) ? $validated['lat'] : $address->lat;
        $mergedLng = array_key_exists('lng', $validated) ? $validated['lng'] : $address->lng;
        $hasStreet = ($validated['street'] ?? $address->street) !== '' && ($validated['street'] ?? $address->street) !== null;
        $hasCity = ($validated['city'] ?? $address->city) !== '' && ($validated['city'] ?? $address->city) !== null;
        if (($hasStreet || $hasCity) && ($mergedLat === null || $mergedLng === null)) {
            return response()->json([
                'success' => false,
                'message' => 'נא לאשר מיקום במפה (נדרשים lat ו־lng)',
            ], 422);
        }

        if (!empty($validated['is_default'])) {
            $request->customer->addresses()->where('id', '!=', $id)->update(['is_default' => false]);
        }

        $address->update($validated);
        $fresh = $address->fresh();
        if ($fresh && $fresh->is_default) {
            $request->customer->refresh();
            $request->customer->syncDefaultDeliveryFromSavedAddresses();
        }

        return response()->json([
            'success' => true,
            'message' => 'הכתובת עודכנה',
            'data' => $fresh,
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

        $request->customer->refresh();
        $request->customer->syncDefaultDeliveryFromSavedAddresses();

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

        if ($address->lat === null || $address->lng === null) {
            return response()->json([
                'success' => false,
                'message' => 'לא ניתן להגדיר כתובת ללא מיקום מפה כברירת מחדל',
            ], 422);
        }

        $request->customer->addresses()->update(['is_default' => false]);
        $address->update(['is_default' => true]);

        $request->customer->refresh();
        $request->customer->syncDefaultDeliveryFromSavedAddresses();

        return response()->json([
            'success' => true,
            'message' => 'כתובת ברירת מחדל עודכנה',
            'data' => $address->fresh(),
        ]);
    }
}
