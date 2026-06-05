<?php

namespace App\Services;

use App\Models\City;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class CitySearchService
{
    public function search(string $query, int $limit = 10): Collection
    {
        $cleanQuery = trim($query);
        if ($cleanQuery === '' || mb_strlen($cleanQuery) < 2) {
            return collect();
        }

        $normalizedQuery = $this->normalizeName($cleanQuery);
        $normalizedCompactQuery = $this->normalizeCompact($cleanQuery);

        $dbResults = City::query()
            ->where('approval_status', 'approved')
            ->where(function ($q) use ($cleanQuery, $normalizedQuery, $normalizedCompactQuery) {
                $q->where('hebrew_name', 'like', '%' . $cleanQuery . '%')
                    ->orWhere('name', 'like', '%' . $cleanQuery . '%')
                    ->orWhere('normalized_name', 'like', '%' . $normalizedQuery . '%')
                    ->orWhere('normalized_name', 'like', '%' . $normalizedCompactQuery . '%');
            })
            ->orderByRaw('(latitude IS NULL OR longitude IS NULL) ASC')
            ->orderBy('list_order')
            ->orderBy('hebrew_name')
            ->limit($limit)
            ->get();

        if ($dbResults->isNotEmpty()) {
            // If we already have matches, return quickly.
            // For rows without coordinates, try a best-effort enrichment in background path.
            $this->bestEffortEnrichMissingCoordinates($dbResults, $cleanQuery);

            return $dbResults->fresh();
        }

        $osmResults = $this->searchOsm($cleanQuery, $limit);
        if ($osmResults->isEmpty()) {
            return collect();
        }

        foreach ($osmResults as $row) {
            $this->upsertPendingCityFromOsm($row);
        }

        // Pending suggestions are for super-admin review only.
        return collect();
    }

    private function searchOsm(string $query, int $limit): Collection
    {
        $response = Http::timeout(7)
            ->withHeaders([
                'User-Agent' => config('app.name', 'TakeEat') . '/city-search',
            ])
            ->get('https://nominatim.openstreetmap.org/search', [
                'q' => $query,
                'countrycodes' => 'il',
                'format' => 'jsonv2',
                'addressdetails' => 1,
                'namedetails' => 1,
                'accept-language' => 'he,en',
                'limit' => max(1, min($limit, 15)),
            ]);

        if (! $response->ok()) {
            return collect();
        }

        $rows = collect($response->json());

        return $rows
            ->map(function (array $row) {
                $namedetails = $row['namedetails'] ?? [];
                $address = $row['address'] ?? [];

                // Prefer locality fields over POI names (e.g. cemetery/junction entries)
                $locality = $address['city']
                    ?? $address['town']
                    ?? $address['village']
                    ?? $address['municipality']
                    ?? $address['hamlet']
                    ?? $address['suburb']
                    ?? null;

                $hebrewName = $namedetails['name:he']
                    ?? $locality
                    ?? null;

                $englishName = $namedetails['name:en']
                    ?? $locality
                    ?? null;

                $cleanHebrewName = $this->cleanPlaceName($hebrewName);
                $cleanEnglishName = $this->cleanPlaceName($englishName);
                $displayName = trim((string) ($cleanHebrewName ?: $cleanEnglishName ?: ($row['display_name'] ?? '')));

                if ($displayName === '' || $this->isNoisyNonCityName($displayName)) {
                    return null;
                }

                $normalizedName = $this->normalizeName($cleanHebrewName ?: $cleanEnglishName ?: $displayName);
                if ($normalizedName === '') {
                    return null;
                }

                return [
                    'name' => $cleanEnglishName ?: $cleanHebrewName ?: $displayName,
                    'hebrew_name' => $cleanHebrewName,
                    'latitude' => isset($row['lat']) ? (float) $row['lat'] : null,
                    'longitude' => isset($row['lon']) ? (float) $row['lon'] : null,
                    'osm_id' => isset($row['osm_id']) ? (string) $row['osm_id'] : null,
                    'source' => 'osm',
                    'last_verified_at' => now(),
                    'normalized_name' => $normalizedName,
                ];
            })
                ->filter(fn ($row) => $row !== null && $row['latitude'] !== null && $row['longitude'] !== null && $row['normalized_name'] !== '')
            ->unique(fn ($row) => $row['osm_id'] ?: $row['normalized_name'])
            ->values();
    }

    private function upsertPendingCityFromOsm(array $row): void
    {
        $candidate = null;

        if (! empty($row['osm_id'])) {
            $candidate = City::query()->where('osm_id', $row['osm_id'])->first();
        }

        if (! $candidate && ! empty($row['normalized_name'])) {
            $candidate = City::query()->where('normalized_name', $row['normalized_name'])->first();
        }

        if (! $candidate) {
            $candidate = City::query()
                ->where('name', $row['name'])
                ->orWhere('hebrew_name', $row['hebrew_name'])
                ->first();
        }

        if ($candidate) {
            $candidate->update([
                'name' => $candidate->name ?: $row['name'],
                'hebrew_name' => $candidate->hebrew_name ?: $row['hebrew_name'],
                'latitude' => $candidate->latitude ?? $row['latitude'],
                'longitude' => $candidate->longitude ?? $row['longitude'],
                'osm_id' => $candidate->osm_id ?: $row['osm_id'],
                'normalized_name' => $candidate->normalized_name ?: $row['normalized_name'],
                'source' => $row['source'],
                'last_verified_at' => $row['last_verified_at'],
            ]);

            return;
        }

        City::create(array_merge($row, [
            'approval_status' => 'pending',
        ]));
    }

    private function bestEffortEnrichMissingCoordinates(Collection $cities, string $query): void
    {
        $missing = $cities->first(fn ($city) => $city->latitude === null || $city->longitude === null);
        if (! $missing) {
            return;
        }

        $osmResults = $this->searchOsm($query, 5);
        if ($osmResults->isEmpty()) {
            return;
        }

        $missingNormalized = $this->normalizeName((string) ($missing->hebrew_name ?: $missing->name));

        $matchingOsm = $osmResults->first(function (array $row) use ($missingNormalized) {
            return $row['normalized_name'] === $missingNormalized;
        });

        if (! $matchingOsm) {
            $matchingOsm = $osmResults->first(function (array $row) use ($missingNormalized) {
                return str_contains($row['normalized_name'], $missingNormalized)
                    || str_contains($missingNormalized, $row['normalized_name']);
            });
        }

        if (! $matchingOsm) {
            return;
        }

        $missing->update([
            'latitude' => $matchingOsm['latitude'],
            'longitude' => $matchingOsm['longitude'],
            'osm_id' => $missing->osm_id ?: $matchingOsm['osm_id'],
            'normalized_name' => $missing->normalized_name ?: $matchingOsm['normalized_name'],
            'source' => 'osm',
            'last_verified_at' => now(),
        ]);
    }

    private function normalizeName(string $value): string
    {
        $v = trim($value);
        $v = preg_replace('/[-_]+/u', ' ', $v) ?? $v;
        $v = preg_replace('/\s+/u', ' ', $v) ?? $v;
        $v = str_replace(['"', "'", '׳', '"', '״'], '', $v);
        $v = str_replace('קרית', 'קריית', $v);

        return Str::lower(trim($v));
    }

    private function normalizeCompact(string $value): string
    {
        return str_replace(' ', '', $this->normalizeName($value));
    }

    private function cleanPlaceName(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $v = trim($value);
        if ($v === '') {
            return null;
        }

        // Names like "מועצה אזורית עמק יזרעאל | יפעת" -> prefer the right-most locality segment.
        if (str_contains($v, '|')) {
            $parts = array_values(array_filter(array_map('trim', explode('|', $v))));
            if (! empty($parts)) {
                $v = end($parts);
            }
        }

        // Long admin labels with commas are usually not city names.
        if (str_contains($v, ',')) {
            $parts = array_values(array_filter(array_map('trim', explode(',', $v))));
            if (! empty($parts)) {
                $v = $parts[0];
            }
        }

        return trim($v);
    }

    private function isNoisyNonCityName(string $value): bool
    {
        $v = $this->normalizeName($value);

        if ($v === '') {
            return true;
        }

        return str_contains($v, 'מועצה אזורית')
            || str_contains($v, 'מחוז')
            || str_contains($v, 'נפה')
            || str_contains($v, 'regional council')
            || str_contains($v, 'district')
            || str_contains($v, 'region')
            || str_contains($v, 'nature reserve')
            || str_contains($v, 'פארק')
            || str_contains($v, 'reserve');
    }
}
