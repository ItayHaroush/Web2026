<?php

namespace App\Http\Controllers;

use App\Services\CitySearchService;
use Illuminate\Http\Request;

class CityController extends Controller
{
    public function search(Request $request, CitySearchService $citySearchService)
    {
        $query = (string) $request->query('q', '');

        $rows = $citySearchService->search($query, 10);

        $response = $rows->map(function ($city) {
            return [
                'id' => $city->id,
                'name' => $city->hebrew_name ?: $city->name,
                'lat' => $city->latitude !== null ? (float) $city->latitude : null,
                'lng' => $city->longitude !== null ? (float) $city->longitude : null,
            ];
        })->values();

        return response()->json($response);
    }
}
