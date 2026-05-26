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

        $session = PosSession::where('token', $token)->first();

        if (!$session) {
            return response()->json([
                'success' => false,
                'message' => 'הסשן לא נמצא — יש להתחבר מחדש',
                'code' => 'pos_session_invalid',
            ], 401);
        }

        if ($session->revoked_at) {
            $isReplaced = $session->revoked_reason === PosSession::REVOKED_REASON_REPLACED;
            return response()->json([
                'success' => false,
                'message' => $isReplaced
                    ? 'הוחלפת בקופה ממכשיר אחר — המשתמש נכנס לקופה במקום אחר'
                    : 'הסשן בוטל — יש להתחבר מחדש',
                'code' => $isReplaced ? 'pos_session_replaced' : 'pos_session_revoked',
                'reason' => $session->revoked_reason,
            ], 401);
        }

        if ($session->expires_at <= now()) {
            return response()->json([
                'success' => false,
                'message' => 'הסשן פג תוקף — יש להתחבר מחדש',
                'code' => 'pos_session_expired',
            ], 401);
        }

        if ($session->locked_at) {
            return response()->json([
                'success' => false,
                'message' => 'הקופה נעולה — נדרש PIN לפתיחה',
                'code' => 'pos_session_locked',
            ], 401);
        }

        $request->merge(['pos_session' => $session]);

        return $next($request);
    }
}
