<?php

namespace App\Http\Middleware;

use App\Models\CustomerToken;
use Closure;
use Illuminate\Http\Request;

class CustomerAuth
{
    public function handle(Request $request, Closure $next)
    {
        $token = $request->bearerToken();
        if (!$token) {
            return response()->json([
                'success' => false,
                'message' => 'לא מחובר',
            ], 401);
        }

        $hash = hash('sha256', $token);

        // Check without expiry first to distinguish expired vs wrong token
        $record = CustomerToken::where('token_hash', $hash)->first();

        if (!$record) {
            return response()->json([
                'success' => false,
                'message' => 'טוקן לא תקין',
                'reason' => 'invalid_token',
            ], 401);
        }

        if ($record->expires_at <= now()) {
            // Token expired — renew it automatically (sliding expiration)
            $record->update([
                'expires_at' => now()->addDays(90),
                'last_used_at' => now(),
            ]);
        } else {
            // Sliding expiration: extend if within 30 days of expiry
            $updates = ['last_used_at' => now()];
            if ($record->expires_at <= now()->addDays(30)) {
                $updates['expires_at'] = now()->addDays(90);
            }
            $record->update($updates);
        }

        $request->merge(['customer' => $record->customer]);

        return $next($request);
    }
}
