<?php

namespace App\Http\Middleware;

use App\Models\Restaurant;
use Closure;
use Illuminate\Http\Request;

/**
 * Middleware בדיקת Tenant ID
 * מוודא שלכל בקשה API יש Tenant ID תקף
 */
class EnsureTenantId
{
    public function handle(Request $request, Closure $next)
    {
        // קבל Tenant ID מ-Header או Parameter
        $tenantId = $request->header('X-Tenant-ID') ??
            $request->query('tenant_id') ??
            $request->route('tenant_id');

        // עבור נתיבי אימות קופה (verify-pin, unlock) - fallback מ-restaurant של המשתמש
        if (!$tenantId && $request->user()?->restaurant) {
            $tenantId = $request->user()->restaurant->tenant_id;
        }

        // אותו מסלול כמו CheckRestaurantAccess: משתמש עם restaurant_id בלי כותרת tenant
        // (למשל localStorage נוקה / קשר restaurant לא נטען) — טען tenant ישירות מהטבלה בלי scope
        if (!$tenantId && $request->user()?->restaurant_id) {
            $restaurant = Restaurant::withoutGlobalScopes()->find($request->user()->restaurant_id);
            $tenantId = $restaurant?->tenant_id;
        }

        if (!$tenantId) {
            return response()->json([
                'message' => 'חובה לציין Tenant ID',
                'error' => 'missing_tenant_id'
            ], 400);
        }

        // שמור את Tenant ID בContext לשימוש בכל האפליקציה
        app()['tenant_id'] = $tenantId;
        $request->merge(['tenant_id' => $tenantId]);

        return $next($request);
    }
}
