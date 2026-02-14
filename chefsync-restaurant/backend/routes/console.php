<?php

use Illuminate\Support\Facades\Schedule;

Schedule::command('monitor:stale-orders')->everyFiveMinutes();
Schedule::command('monitor:daily-summary')->dailyAt('22:00');
Schedule::command('billing:charge-subscriptions')->dailyAt('06:00');
Schedule::command('payments:reconcile')->everyTenMinutes();
Schedule::command('emails:trial')->dailyAt('09:00');
