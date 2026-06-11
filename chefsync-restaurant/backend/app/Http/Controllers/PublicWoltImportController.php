<?php

namespace App\Http\Controllers;

use App\Services\WoltMenuImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * תצוגה מקדימה ציבורית של תפריט וולט — לדף בחירת המוצרים בתהליך ההרשמה.
 * לא כותב כלום ל-DB, רק מושך וממפה את התפריט.
 */
class PublicWoltImportController extends Controller
{
    public function preview(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'wolt_url' => 'required|string|max:500',
        ]);

        try {
            $preview = app(WoltMenuImportService::class)->previewFromUrl($validated['wolt_url']);

            return response()->json([
                'success' => true,
                'data' => [
                    'wolt_url' => $validated['wolt_url'],
                    'slug' => $preview['slug'],
                    'summary' => $preview['summary'],
                    'restaurant_meta' => $preview['restaurant_meta'] ?? [],
                    'categories' => $preview['categories'],
                ],
            ]);
        } catch (\Throwable $e) {
            Log::warning('Public wolt preview failed', [
                'wolt_url' => $validated['wolt_url'],
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }
}
