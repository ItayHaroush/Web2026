<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class EnsureManager
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();

        if (!$user || !$user->isManager()) {
            return response()->json([
                'success' => false,
                'message' => 'אין לך הרשאה לגשת לאזור זה',
            ], 403);
        }

        return $next($request);
    }
}
