<?php

namespace App\Services;

use App\Console\Commands\GenerateDailyReportsJob;
use App\Models\DailyReport;
use App\Models\Order;
use App\Models\Restaurant;
use Carbon\Carbon;

class DailyReportBackfillService
{
    /**
     * @return list<string> תאריכי ימים (Asia/Jerusalem) שיש בהם הזמנות אך אין דוח
     */
    public static function missingDatesForRestaurant(int $restaurantId, ?string $fromDate, ?string $toDate): array
    {
        $tz = 'Asia/Jerusalem';

        $ordersQuery = Order::withoutGlobalScopes()
            ->where('restaurant_id', $restaurantId)
            ->where('is_test', false);

        if ($fromDate) {
            $ordersQuery->where('created_at', '>=', Carbon::parse($fromDate, $tz)->startOfDay());
        }
        if ($toDate) {
            $ordersQuery->where('created_at', '<=', Carbon::parse($toDate, $tz)->endOfDay());
        }

        $dateStrings = $ordersQuery
            ->pluck('created_at')
            ->map(fn ($c) => Carbon::parse($c)->timezone($tz)->toDateString())
            ->unique()
            ->sort()
            ->values();

        $missing = [];
        foreach ($dateStrings as $dateStr) {
            if (! DailyReport::withoutGlobalScopes()
                ->where('restaurant_id', $restaurantId)
                ->whereDate('date', $dateStr)
                ->exists()) {
                $missing[] = $dateStr;
            }
        }

        return $missing;
    }

    public static function backfillRestaurant(Restaurant $restaurant, ?string $fromDate, ?string $toDate): int
    {
        $tz = 'Asia/Jerusalem';
        $missing = self::missingDatesForRestaurant($restaurant->id, $fromDate, $toDate);
        $generated = 0;

        foreach ($missing as $dateStr) {
            $day = Carbon::parse($dateStr, $tz);
            $report = GenerateDailyReportsJob::generateForRestaurant(
                $restaurant,
                $dateStr,
                $day->copy()->startOfDay(),
                $day->copy()->endOfDay()
            );
            if ($report) {
                $generated++;
            }
        }

        return $generated;
    }

    /**
     * @param  list<int>|null  $restaurantIds  null = כל המאושרות
     * @return array{total: int, by_restaurant: array<int, int>}
     */
    public static function backfillAll(?array $restaurantIds, ?string $fromDate, ?string $toDate): array
    {
        $q = Restaurant::query()->where('is_approved', true);
        if ($restaurantIds !== null && $restaurantIds !== []) {
            $q->whereIn('id', $restaurantIds);
        }

        $byRestaurant = [];
        $total = 0;

        foreach ($q->cursor() as $restaurant) {
            $n = self::backfillRestaurant($restaurant, $fromDate, $toDate);
            if ($n > 0) {
                $byRestaurant[$restaurant->id] = $n;
                $total += $n;
            }
        }

        return ['total' => $total, 'by_restaurant' => $byRestaurant];
    }
}
