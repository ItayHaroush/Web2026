<?php

use Illuminate\Support\Facades\Schedule;

Schedule::command('monitor:stale-orders')->everyFiveMinutes();
Schedule::command('monitor:daily-summary')->dailyAt('22:00');
