<?php

namespace App\Http\Middleware;

use App\Models\PrintDevice;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VerifyDeviceToken
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();

        if (!$token) {
            return response()->json([
                'success' => false,
                'message' => 'Device token required',
            ], 401);
        }

        $device = PrintDevice::withoutGlobalScopes()
            ->where('device_token', $token)
            ->where('is_active', true)
            ->first();

        if (!$device) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid or inactive device token',
            ], 401);
        }

        $request->merge(['print_device' => $device]);

        return $next($request);
    }
}
