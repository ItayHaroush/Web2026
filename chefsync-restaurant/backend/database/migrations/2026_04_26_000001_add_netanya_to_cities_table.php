<?php

use App\Models\City;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $row = [
            'name' => 'Netanya',
            'hebrew_name' => 'נתניה',
            'region' => 'מרכז',
            'latitude' => 32.3324,
            'longitude' => 34.8575,
        ];
        if (Schema::hasColumn('cities', 'list_order')) {
            $row['list_order'] = 100;
        }
        City::query()->updateOrCreate(
            ['name' => 'Netanya'],
            $row
        );
    }

    public function down(): void
    {
        City::query()->where('name', 'Netanya')->delete();
    }
};
