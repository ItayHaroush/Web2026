<?php

namespace App\Console\Commands;

use App\Models\DailyReport;
use App\Models\Restaurant;
use App\Services\Reporting\OrderPeriodMetricsService;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class GenerateDailyReportsJob extends Command
{
    protected $signature = 'reports:generate-daily {--restaurant= : Restaurant ID ספציפי} {--date= : תאריך ספציפי (YYYY-MM-DD)}';

    protected $description = 'יצירת דוחות יומיים לכל המסעדות הפעילות';

    public function handle(): int
    {
        $date = $this->option('date')
            ? Carbon::parse($this->option('date'))->setTimezone('Asia/Jerusalem')
            : Carbon::now('Asia/Jerusalem')->subDay();

        $dateStr = $date->toDateString();
        $startOfDay = $date->copy()->startOfDay();
        $endOfDay = $date->copy()->endOfDay();

        $restaurantId = $this->option('restaurant');

        $query = Restaurant::where('is_approved', true);
        if ($restaurantId) {
            $query->where('id', $restaurantId);
        }
        $restaurants = $query->get();

        $generated = 0;

        foreach ($restaurants as $restaurant) {
            try {
                $report = $this->generateForRestaurant($restaurant, $dateStr, $startOfDay, $endOfDay);
                if ($report) {
                    $generated++;
                }
            } catch (\Throwable $e) {
                Log::error("GenerateDailyReport failed for restaurant {$restaurant->id}", [
                    'error' => $e->getMessage(),
                ]);
                $this->error("שגיאה במסעדה {$restaurant->name}: {$e->getMessage()}");
            }
        }

        $this->info("נוצרו {$generated} דוחות יומיים עבור {$dateStr}");
        Log::info("GenerateDailyReportsJob: {$generated} reports generated for {$dateStr}");

        return self::SUCCESS;
    }

    public static function generateForRestaurant(Restaurant $restaurant, string $dateStr, Carbon $startOfDay, Carbon $endOfDay): ?DailyReport
    {
        $attributes = OrderPeriodMetricsService::buildDailyReportAttributes($restaurant, $startOfDay, $endOfDay);

        if ($attributes === null) {
            return null;
        }

        return DailyReport::updateOrCreate(
            [
                'restaurant_id' => $restaurant->id,
                'date' => $dateStr,
            ],
            $attributes
        );
    }
}
