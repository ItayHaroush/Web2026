# Phase B - City Search Service Plan

Status: Draft (approved for implementation sequencing)
Owner: Backend + Frontend
Scope policy: Do not modify Phase A hotfix behavior unless a direct regression is found.

## Goal
Establish a single city search pipeline that is DB-first with OSM fallback, prevents duplicate city records, and is reusable across UI flows.

## Non-Goals
- No HomePage integration in this phase (can be separate follow-up task).
- No removal of legacy restaurant city string in this phase.
- No changes to unrelated dirty files.

## Backend

### B1 - Migration (`cities` hardening)
Add columns:
- `source` (string, nullable) - e.g. `seed`, `osm`, `manual`, `import_israel`
- `osm_id` (string, nullable)
- `last_verified_at` (timestamp, nullable)
- `normalized_name` (string, nullable)

Indexes:
- index on `normalized_name`
- index on `osm_id`

Notes:
- Keep migration backward-compatible.
- Do not break existing reads from `name` / `hebrew_name`.

### B2 - `CitySearchService`
Single responsibility:
- `CitySearchService::search(string $query): Collection`

Flow:
1. Normalize input query.
2. Search DB (`cities`) by normalized and display names.
3. If matches found: return DB results.
4. If no matches: query OSM.
5. Normalize OSM results.
6. Upsert into `cities` using dedup keys.
7. Return DB-backed results.

Technical constraints:
- Encapsulate all city creation/upsert logic in this service.
- Avoid direct city creation in controllers (future cleanup target from Phase A TODO).
- Add timeout + graceful fallback for OSM failures.

### B3 - Endpoint
Route:
- `GET /api/cities/search?q=...`

Response shape:
```json
[
  {
    "id": 12,
    "name": "קריית עקרון",
    "lat": 31.86,
    "lng": 34.82
  }
]
```

Behavior:
- Minimum query length policy (recommended: 2 chars).
- Rate-limit friendly.
- Returns deterministic, deduplicated results.

### B4 - Normalizer
Create dedicated normalizer utility (service/helper) to unify variants into one canonical key.

Examples mapped to same canonical key:
- `קרית עקרון`
- `קריית עקרון`
- `קרית-עקרון`

Normalization rules (initial):
- Trim whitespace.
- Replace hyphen variants with single space.
- Collapse multiple spaces.
- Unicode normalization.
- Optional: unify common Hebrew variants (`י`/`יי` patterns) with conservative rules.

Dedup strategy:
- Primary: `osm_id` when available.
- Secondary: `normalized_name` + geographic proximity threshold.

## Frontend

### F1 - Reusable Autocomplete component
Create one reusable component:
- `CityAutocomplete`

Target future consumers:
- Registration
- Restaurant edit
- Super admin city edit
- HomePage search

Requirements:
- Debounced API calls.
- Keyboard navigation.
- Loading and empty states.
- Receives/returns selected city object (not plain text only).

### F2 - Registration update
Replace static city select with async autocomplete.

Submit contract:
```json
{
  "city_id": 123
}
```

Important:
- Prefer city identity (`city_id`) over free text city name.
- Keep temporary compatibility if backend still accepts old `city` field during migration window.

## QA

### Q1 - Prefix search
Input:
- `קרי`

Expected to include:
- `קריית עקרון`
- `קריית גת`
- `קריית מלאכי`

### Q2 - DB miss fallback
Input:
- `שלומי` (when not in DB)

Expected:
- Pulled from OSM.
- Persisted to `cities`.

### Q3 - Second query cache hit
Input:
- `שלומי` (second run)

Expected:
- Served from DB.
- No OSM call.

## Bootstrap Data (recommended now)
Do not wait for periodic sync.

Add one-time command:
- `php artisan cities:import-israel`

Purpose:
- Preload Israel city dataset once.
- Improve registration/homepage responsiveness from day 1.
- Keep OSM mainly as fallback.

## Suggested execution order
1. B1 migration
2. B4 normalizer
3. B2 service + OSM client abstraction
4. B3 endpoint
5. Q1-Q3 backend validation
6. F1 reusable component
7. F2 registration integration
8. Final regression check against Phase A hotfix flow

## Definition of Done (Phase B)
- `GET /api/cities/search` works as DB-first + OSM fallback.
- Duplicate variants are normalized and not duplicated.
- Registration submits `city_id` successfully.
- Bootstrap command imports Israeli cities successfully.
- No regression in existing super-admin hotfix flow.
