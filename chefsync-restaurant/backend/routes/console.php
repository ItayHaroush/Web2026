<?php

use Illuminate\Support\Facades\Schedule;

Schedule::command('monitor:stale-orders')->everyFiveMinutes();
Schedule::command('orders:process-future')->everyMinute();
Schedule::command('orders:retry-failed-prints')->everyTwoMinutes();

// בטיחות תור הדפסה: עבודות שתקועות ב-"printing" (הסוכן קרס/אבד ACK) חוזרות לתור.
// שומר על הכלל "אף הזמנה לא הולכת לאיבוד". סף 3 דק' > חלון הניסיונות החוזרים של הסוכן (~70ש').
Schedule::call(function () {
    app(\App\Services\PrintService::class)->retryStaleJobs(3);
})->everyMinute()->name('retry-stale-print-jobs')->withoutOverlapping();
Schedule::command('orders:notify-pending-customer')->everyFiveMinutes();
Schedule::command('orders:expire-awaiting-payment')->everyTenMinutes();
Schedule::command('monitor:daily-summary')->dailyAt('22:00');
// חיוב מנויי מסעדות (B2B) – רץ רק אם הדגל הגלובלי פעיל
if (config('payment.subscription_billing_enabled')) {
    Schedule::command('billing:charge-subscriptions')->dailyAt('06:00');
}
Schedule::command('payments:reconcile')->everyTenMinutes();
Schedule::command('emails:trial')->dailyAt('09:00');
Schedule::command('reminders:abandoned-cart')->everyTenMinutes();
Schedule::command('emails:abandoned-cart-reports')->monthlyOn(5, '09:00');
Schedule::command('emails:monthly-report')->monthlyOn(1, '08:00');
Schedule::command('reports:generate-daily')->dailyAt('02:00');
Schedule::command('reports:send-notifications')->dailyAt('02:15');

Schedule::command('domains:sync-status')->everyFifteenMinutes();

// SEO audit — ביקורת ביצועים שבועית על דפי המסעדות
if (env('PAGESPEED_API_KEY')) {
    Schedule::command('seo:audit --limit=20 --strategy=mobile')
        ->weeklyOn(1, '03:00'); // יום ב' 03:00
}
