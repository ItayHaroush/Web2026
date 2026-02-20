<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__ . '/../routes/web.php',
        api: __DIR__ . '/../routes/api.php',
        commands: __DIR__ . '/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->api(prepend: [
            \Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful::class,
        ]);

        $middleware->alias([
            'tenant' => \App\Http\Middleware\EnsureTenantId::class,
            'super_admin' => \App\Http\Middleware\EnsureSuperAdmin::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // #region agent log
        $exceptions->renderable(function (\Illuminate\Session\TokenMismatchException $e, $request) {
            $logPath = base_path('../.cursor/debug.log');
            $logData = json_encode(['location' => 'bootstrap/app.php:TokenMismatchException', 'message' => '419 CSRF token mismatch caught', 'data' => ['url' => $request->fullUrl(), 'method' => $request->method(), 'has_token' => $request->has('_token'), 'session_id' => session()->getId(), 'has_session_cookie' => $request->hasCookie(config('session.cookie')), 'cookie_name' => config('session.cookie'), 'origin' => $request->header('Origin'), 'referer' => $request->header('Referer'), 'sec_fetch_site' => $request->header('Sec-Fetch-Site')], 'timestamp' => round(microtime(true) * 1000), 'hypothesisId' => 'H1_419']);
            file_put_contents($logPath, $logData . "\n", FILE_APPEND);
        });
        // #endregion
    })->create();
