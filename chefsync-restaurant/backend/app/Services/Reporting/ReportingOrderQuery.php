<?php

namespace App\Services\Reporting;

use App\Models\Order;
use App\Models\Restaurant;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;

/**
 * שאילתת הזמנות לאותה תצוגת דיווח כמו דוח יומי (לא test, נראות למסעדה, forOwnerReporting).
 */
final class ReportingOrderQuery
{
    /**
     * @return Collection<int, Order>
     */
    public static function ordersBetween(Restaurant $restaurant, Carbon $start, Carbon $end): Collection
    {
        return Order::withoutGlobalScopes()
            ->where('restaurant_id', $restaurant->id)
            ->where('is_test', false)
            ->visibleToRestaurant()
            ->forOwnerReporting($restaurant)
            ->whereBetween('created_at', [$start, $end])
            ->orderBy('id')
            ->get();
    }
}
