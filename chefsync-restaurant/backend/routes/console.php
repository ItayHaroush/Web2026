<?php

use Illuminate\Support\Facades\Schedule;

Schedule::command('monitor:stale-orders')->everyFiveMinutes();
Schedule::command('monitor:daily-summary')->dailyAt('22:00');
// חיוב מנויי מסעדות (B2B) – רץ רק אם הדגל הגלובלי פעיל
if (config('payment.subscription_billing_enabled')) {
    Schedule::command('billing:charge-subscriptions')->dailyAt('06:00');
}
Schedule::command('payments:reconcile')->everyTenMinutes();
Schedule::command('emails:trial')->dailyAt('09:00');
Schedule::command('emails:monthly-report')->monthlyOn(1, '08:00');
