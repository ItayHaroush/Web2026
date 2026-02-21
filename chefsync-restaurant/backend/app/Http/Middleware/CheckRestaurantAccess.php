<?php

namespace App\Http\Middleware;

use App\Models\Restaurant;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Middleware שמוודא שהמסעדה נמצאת בתקופת ניסיון או שיש לה מנוי פעיל.
 */
class CheckRestaurantAccess
{
    public function handle(Request $request, Closure $next)
    {
        $tenantId = app()->has('tenant_id')
            ? app('tenant_id')
            : ($request->header('X-Tenant-ID') ?? null);

        // עבור מסלולי Admin ללא Header השתמש ב-restaurant של המשתמש המחובר
        if (!$tenantId && $request->user() && $request->user()->restaurant) {
            $tenantId = $request->user()->restaurant->tenant_id;
            app()['tenant_id'] = $tenantId;
        }

        if (!$tenantId) {
            return response()->json([
                'success' => false,
                'message' => 'Tenant ID חסר. לא ניתן לקבוע למסעדה הרשאות.',
                'error' => 'missing_tenant_id',
            ], 400);
        }

        $restaurant = Restaurant::where('tenant_id', $tenantId)->first();

        if (!$restaurant) {
            if ($request->user() && $request->user()->is_super_admin) {
                return $next($request);
            }

            return response()->json([
                'success' => false,
                'message' => 'המסעדה לא נמצאה.',
                'error' => 'restaurant_not_found',
            ], 404);
        }

        // Bypass subscription check in dev mode
        if (config('app.dev_mode')) {
            Log::info('Dev Mode: Bypassing subscription check', [
                'tenant_id' => $tenantId,
                'restaurant_id' => $restaurant->id,
            ]);

            $request->attributes->set('restaurant', $restaurant);
            return $next($request);
        }

        // Bypass subscription check for super admin
        if ($request->user() && $request->user()->is_super_admin) {
            Log::info('Super Admin: Bypassing subscription check', [
                'user_id' => $request->user()->id,
                'tenant_id' => $tenantId,
                'restaurant_id' => $restaurant->id,
            ]);

            $request->attributes->set('restaurant', $restaurant);
            return $next($request);
        }

        if (!$restaurant->hasAccess()) {
            $reason = $restaurant->subscription_status === 'suspended'
                ? 'payment_failed'
                : 'subscription_inactive';

            $message = $reason === 'payment_failed'
                ? 'המנוי הושהה עקב כשלון תשלום. יש לעדכן אמצעי תשלום כדי להמשיך.'
                : 'פג תוקף תקופת הניסיון. יש להשלים תשלום כדי להמשיך להשתמש במערכת.';

            return response()->json([
                'success' => false,
                'message' => $message,
                'error' => $reason,
                'data' => [
                    'subscription_status' => $restaurant->subscription_status,
                    'trial_ends_at' => $restaurant->trial_ends_at,
                    'subscription_ends_at' => $restaurant->subscription_ends_at,
                ],
            ], 402);
        }

        // חשיפת המסעדה להמשך הבקשה
        $request->attributes->set('restaurant', $restaurant);

        return $next($request);
    }
}
