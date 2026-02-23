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

        $middleware->validateCsrfTokens(except: [
            'custom-invoice',
            'custom-invoice/*',
        ]);

        $middleware->alias([
            'tenant' => \App\Http\Middleware\EnsureTenantId::class,
            'super_admin' => \App\Http\Middleware\EnsureSuperAdmin::class,
            'pos_session' => \App\Http\Middleware\VerifyPosSession::class,
            'device_token' => \App\Http\Middleware\VerifyDeviceToken::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();
