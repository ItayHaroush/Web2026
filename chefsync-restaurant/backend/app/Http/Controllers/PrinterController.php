<?php

namespace App\Http\Controllers;

use App\Models\Printer;
use App\Models\Order;
use App\Services\PrintService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class PrinterController extends Controller
{
    /**
     * רשימת מדפסות + קטגוריות
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $printers = Printer::where('restaurant_id', $user->restaurant_id)
            ->with('categories:id,name,icon')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'printers' => $printers,
        ]);
    }

    /**
     * יצירת מדפסת חדשה
     */
    public function store(Request $request)
    {
        $user = $request->user();

        if (!$user->isManager()) {
            return response()->json([
                'success' => false,
                'message' => 'אין לך הרשאה להוסיף מדפסות',
            ], 403);
        }

        $request->validate([
            'name' => 'required|string|max:100',
            'type' => 'required|in:network,usb,browser',
            'role' => 'sometimes|in:kitchen,receipt,general',
            'ip_address' => 'nullable|required_if:type,network|ip',
            'port' => 'nullable|integer|min:1|max:65535',
            'paper_width' => 'required|in:80mm,58mm',
            'category_ids' => 'nullable|array',
            'category_ids.*' => 'integer|exists:categories,id',
        ]);

        $restaurant = $user->restaurant;
        if (!$restaurant) {
            return response()->json([
                'success' => false,
                'message' => 'לא נמצאה מסעדה למשתמש',
            ], 404);
        }

        $printer = Printer::create([
            'tenant_id' => $restaurant->tenant_id,
            'restaurant_id' => $restaurant->id,
            'name' => $request->input('name'),
            'type' => $request->input('type'),
            'role' => $request->input('role', 'kitchen'),
            'ip_address' => $request->input('type') === 'network' ? $request->input('ip_address') : null,
            'port' => $request->input('type') === 'network' ? $request->input('port', 9100) : null,
            'paper_width' => $request->input('paper_width'),
            'is_active' => true,
        ]);

        if ($request->has('category_ids')) {
            $printer->categories()->sync($request->input('category_ids', []));
        }

        return response()->json([
            'success' => true,
            'message' => 'המדפסת נוספה בהצלחה!',
            'printer' => $printer->load('categories:id,name,icon'),
        ], 201);
    }

    /**
     * עדכון מדפסת
     */
    public function update(Request $request, $id)
    {
        $user = $request->user();

        if (!$user->isManager()) {
            return response()->json([
                'success' => false,
                'message' => 'אין לך הרשאה לעדכן מדפסות',
            ], 403);
        }

        $request->validate([
            'name' => 'sometimes|string|max:100',
            'type' => 'sometimes|in:network,usb,browser',
            'role' => 'sometimes|in:kitchen,receipt,general',
            'ip_address' => 'nullable|ip',
            'port' => 'nullable|integer|min:1|max:65535',
            'paper_width' => 'sometimes|in:80mm,58mm',
            'category_ids' => 'nullable|array',
            'category_ids.*' => 'integer|exists:categories,id',
        ]);

        $restaurant = $user->restaurant;
        if (!$restaurant) {
            return response()->json([
                'success' => false,
                'message' => 'לא נמצאה מסעדה למשתמש',
            ], 404);
        }

        $printer = Printer::where('restaurant_id', $restaurant->id)->findOrFail($id);

        // #region agent log
        $updateData = $request->only(['name', 'type', 'role', 'ip_address', 'port', 'paper_width']);
        Log::info('[DEBUG-3267aa] Printer update', ['id' => $id, 'updateData' => $updateData, 'role_sent' => $request->input('role'), 'all_input' => $request->all()]);
        file_put_contents('/Users/itaymac/הנדסאי תוכנה המכללה למנהל/Web2026/chefsync-restaurant/.cursor/debug-3267aa.log', json_encode(['sessionId'=>'3267aa','location'=>'PrinterController.php:update','message'=>'Printer update payload','data'=>['id'=>$id,'updateData'=>$updateData,'role_sent'=>$request->input('role')],'timestamp'=>round(microtime(true)*1000),'hypothesisId'=>'H3'])."\n", FILE_APPEND);
        // #endregion
        $printer->update($updateData);

        if ($request->has('category_ids')) {
            $printer->categories()->sync($request->input('category_ids', []));
        }

        return response()->json([
            'success' => true,
            'message' => 'המדפסת עודכנה בהצלחה!',
            'printer' => $printer->load('categories:id,name,icon'),
        ]);
    }

    /**
     * מחיקת מדפסת
     */
    public function destroy(Request $request, $id)
    {
        $user = $request->user();

        if (!$user->isManager()) {
            return response()->json([
                'success' => false,
                'message' => 'אין לך הרשאה למחוק מדפסות',
            ], 403);
        }

        $restaurant = $user->restaurant;
        if (!$restaurant) {
            return response()->json([
                'success' => false,
                'message' => 'לא נמצאה מסעדה למשתמש',
            ], 404);
        }

        $printer = Printer::where('restaurant_id', $restaurant->id)->findOrFail($id);
        $printer->categories()->detach();
        $printer->delete();

        return response()->json([
            'success' => true,
            'message' => 'המדפסת נמחקה בהצלחה!',
        ]);
    }

    /**
     * Toggle פעיל/כבוי
     */
    public function toggle(Request $request, $id)
    {
        $user = $request->user();

        if (!$user->isManager()) {
            return response()->json([
                'success' => false,
                'message' => 'אין לך הרשאה לשנות סטטוס מדפסת',
            ], 403);
        }

        $restaurant = $user->restaurant;
        if (!$restaurant) {
            return response()->json([
                'success' => false,
                'message' => 'לא נמצאה מסעדה למשתמש',
            ], 404);
        }

        $printer = Printer::where('restaurant_id', $restaurant->id)->findOrFail($id);
        $printer->is_active = !$printer->is_active;
        $printer->save();

        return response()->json([
            'success' => true,
            'message' => $printer->is_active ? 'המדפסת הופעלה!' : 'המדפסת כובתה',
            'printer' => $printer->load('categories:id,name,icon'),
        ]);
    }

    /**
     * הדפסת ניסיון
     */
    public function testPrint(Request $request, $id)
    {
        $user = $request->user();
        $restaurant = $user->restaurant;

        if (!$restaurant) {
            return response()->json([
                'success' => false,
                'message' => 'לא נמצאה מסעדה למשתמש',
            ], 404);
        }

        $printer = Printer::where('restaurant_id', $restaurant->id)->findOrFail($id);

        try {
            $printService = app(PrintService::class);
            $success = $printService->testPrint($printer);

            return response()->json([
                'success' => $success,
                'message' => $success ? 'הדפסת ניסיון נשלחה בהצלחה!' : 'שגיאה בהדפסת ניסיון',
            ]);
        } catch (\Exception $e) {
            Log::error('Test print failed', [
                'printer_id' => $printer->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'שגיאה בהדפסת ניסיון: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * הדפסה חוזרת של הזמנה
     */
    public function reprint(Request $request, $id)
    {
        $user = $request->user();
        $restaurant = $user->restaurant;

        if (!$restaurant) {
            return response()->json([
                'success' => false,
                'message' => 'לא נמצאה מסעדה למשתמש',
            ], 404);
        }

        $order = Order::where('restaurant_id', $restaurant->id)
            ->with('items.menuItem.category')
            ->findOrFail($id);

        try {
            $printService = app(PrintService::class);
            $jobCount = $printService->printOrder($order);

            return response()->json([
                'success' => true,
                'message' => $jobCount > 0
                    ? "נשלחו {$jobCount} הדפסות בהצלחה!"
                    : 'אין מדפסות פעילות עם קטגוריות תואמות',
                'jobs_created' => $jobCount,
            ]);
        } catch (\Exception $e) {
            Log::error('Reprint failed', [
                'order_id' => $order->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'שגיאה בהדפסה חוזרת: ' . $e->getMessage(),
            ], 500);
        }
    }
}
