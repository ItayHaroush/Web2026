<?php

namespace App\Console\Commands;

use App\Models\City;
use App\Services\CitySearchService;
use Illuminate\Console\Command;

class BackfillMissingCityCoordinates extends Command
{
    protected $signature = 'cities:backfill-missing-coordinates
        {--limit=0 : Max number of city rows to process (0 = all)}
        {--dry-run : Show what would be processed without saving}
    ';

    protected $description = 'Backfill missing latitude/longitude for existing cities using CitySearchService (DB first + OSM fallback).';

    public function handle(CitySearchService $citySearchService): int
    {
        $limit = (int) $this->option('limit');
        $dryRun = (bool) $this->option('dry-run');

        $baseQuery = City::query()
            ->where(function ($q) {
                $q->whereNull('latitude')
                    ->orWhereNull('longitude');
            })
            ->orderBy('id');

        if ($limit > 0) {
            $baseQuery->limit($limit);
        }

        $cities = $baseQuery->get(['id', 'name', 'hebrew_name', 'latitude', 'longitude']);

        if ($cities->isEmpty()) {
            $this->info('No cities with missing coordinates were found.');

            return self::SUCCESS;
        }

        $this->info('Found ' . $cities->count() . ' cities with missing coordinates.');

        $updated = 0;
        $stillMissing = 0;

        foreach ($cities as $city) {
            $query = trim((string) ($city->hebrew_name ?: $city->name));
            if ($query === '') {
                $stillMissing++;
                $this->warn("[{$city->id}] skipped: empty city name");
                continue;
            }

            if ($dryRun) {
                $this->line("[{$city->id}] would search: {$query}");
                continue;
            }

            $citySearchService->search($query, 5);

            $city->refresh();

            if ($city->latitude !== null && $city->longitude !== null) {
                $updated++;
                $this->info("[{$city->id}] updated: {$query} -> {$city->latitude},{$city->longitude}");
            } else {
                $stillMissing++;
                $this->warn("[{$city->id}] still missing after search: {$query}");
            }
        }

        if ($dryRun) {
            $this->info('Dry-run complete. No changes were made.');

            return self::SUCCESS;
        }

        $remaining = City::query()
            ->where(function ($q) {
                $q->whereNull('latitude')
                    ->orWhereNull('longitude');
            })
            ->count();

        $this->newLine();
        $this->info('Backfill complete.');
        $this->line('Updated in this run: ' . $updated);
        $this->line('Still missing from processed set: ' . $stillMissing);
        $this->line('Total remaining missing coordinates: ' . $remaining);

        return self::SUCCESS;
    }
}
