<?php

namespace App\Http\Middleware;

use App\Models\PosSession;
use Closure;
use Illuminate\Http\Request;

class VerifyPosSession
{
    public function handle(Request $request, Closure $next)
    {
        $token = $request->header('X-POS-Session');

        if (!$token) {
            return response()->json([
                'success' => false,
                'message' => 'POS session token required',
                'code' => 'pos_session_required',
            ], 401);
        }

        $session = PosSession::where('token', $token)
            ->where('expires_at', '>', now())
            ->whereNull('locked_at')
            ->first();

        if (!$session) {
            return response()->json([
                'success' => false,
                'message' => 'POS session expired or locked',
                'code' => 'pos_session_invalid',
            ], 401);
        }

        $request->merge(['pos_session' => $session]);

        return $next($request);
    }
}
