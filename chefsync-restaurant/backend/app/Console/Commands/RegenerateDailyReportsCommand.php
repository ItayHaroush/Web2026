<?php

namespace App\Console\Commands;

use App\Models\DailyReport;
use App\Models\Restaurant;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class RegenerateDailyReportsCommand extends Command
{
    protected $signature = 'reports:regenerate-all
        {--restaurant= : Restaurant ID ספציפי}
        {--from= : תאריך התחלה (YYYY-MM-DD)}
        {--to= : תאריך סיום (YYYY-MM-DD)}
        {--dry-run : הצגת מה שיעודכן בלי לשנות}';

    protected $description = 'חישוב מחדש של דוחות יומיים קיימים (מעדכן עמודות חדשות)';

    public function handle(): int
    {
        $restaurantId = $this->option('restaurant');
        $from = $this->option('from');
        $to = $this->option('to');
        $dryRun = $this->option('dry-run');

        $query = DailyReport::withoutGlobalScopes()->with('restaurant');

        if ($restaurantId) {
            $query->where('restaurant_id', $restaurantId);
        }
        if ($from) {
            $query->where('date', '>=', $from);
        }
        if ($to) {
            $query->where('date', '<=', $to);
        }

        $reports = $query->orderBy('date')->get();

        if ($reports->isEmpty()) {
            $this->info('לא נמצאו דוחות לעדכון.');
            return self::SUCCESS;
        }

        $this->info("נמצאו {$reports->count()} דוחות לעדכון" . ($dryRun ? ' (dry-run)' : ''));

        $updated = 0;
        $skipped = 0;
        $errors = 0;

        $bar = $this->output->createProgressBar($reports->count());
        $bar->start();

        foreach ($reports as $report) {
            try {
                $restaurant = $report->restaurant;

                if (! $restaurant) {
                    $skipped++;
                    $bar->advance();
                    continue;
                }

                $dateStr = $report->date instanceof Carbon
                    ? $report->date->toDateString()
                    : $report->date;

                $startOfDay = Carbon::parse($dateStr, 'Asia/Jerusalem')->startOfDay();
                $endOfDay = Carbon::parse($dateStr, 'Asia/Jerusalem')->endOfDay();

                if ($dryRun) {
                    $this->line(" [dry-run] מסעדה {$restaurant->name} — {$dateStr}");
                    $updated++;
                    $bar->advance();
                    continue;
                }

                $result = GenerateDailyReportsJob::generateForRestaurant(
                    $restaurant,
                    $dateStr,
                    $startOfDay,
                    $endOfDay
                );

                if ($result) {
                    $updated++;
                } else {
                    $skipped++;
                }
            } catch (\Throwable $e) {
                $errors++;
                $this->error(" שגיאה בדוח {$report->id}: {$e->getMessage()}");
                Log::error('RegenerateDailyReports failed', [
                    'report_id' => $report->id,
                    'error' => $e->getMessage(),
                ]);
            }

            $bar->advance();
        }

        $bar->finish();
        $this->newLine(2);
        $this->info("סיום: {$updated} עודכנו, {$skipped} דולגו, {$errors} שגיאות");

        return $errors > 0 ? self::FAILURE : self::SUCCESS;
    }
}
