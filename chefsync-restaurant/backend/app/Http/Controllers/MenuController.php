<?php

namespace App\Http\Controllers;

use App\Models\MenuItem;
use App\Models\Category;
use Illuminate\Http\Request;

/**
 * MenuController - ניהול תפריט המסעדה
 */
class MenuController extends Controller
{
    /**
     * קבל את כל התפריט של המסעדה הנוכחית (Tenant)
     * כולל קטגוריות ופריטים זמינים בלבד
     */
    public function getMenu(Request $request)
    {
        try {
            $tenantId = app('tenant_id');

            // קבל קטגוריות עם פריטים זמינים בלבד
            $categories = Category::where('tenant_id', $tenantId)
                ->orderBy('display_order')
                ->with([
                    'items' => function ($query) {
                        $query->where('is_available', true)
                            ->orderBy('name');
                    }
                ])
                ->get()
                ->map(fn($category) => [
                    'id' => $category->id,
                    'name' => $category->name,
                    'description' => $category->description,
                    'items' => $category->items,
                ]);

            return response()->json([
                'success' => true,
                'data' => $categories,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'שגיאה בטעינת התפריט',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * עדכן זמינות של פריט תפריט (דרוש אימות)
     */
    public function updateItemAvailability(Request $request, $id)
    {
        try {
            $validated = $request->validate([
                'is_available' => 'required|boolean',
            ]);

            $tenantId = app('tenant_id');
            $item = MenuItem::where('tenant_id', $tenantId)
                ->findOrFail($id);

            $item->update(['is_available' => $validated['is_available']]);

            return response()->json([
                'success' => true,
                'message' => 'עדכון הצליח',
                'data' => $item,
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
                'message' => 'שגיאה בעדכון הפריט',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}
