<?php

use App\Models\City;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('cities', 'list_order')) {
            Schema::table('cities', function (Blueprint $table) {
                $table->unsignedSmallInteger('list_order')->default(100)->after('region');
            });
        }

        $cluster = [
            ['name' => 'Afula', 'list_order' => 10],
            ['name' => 'Nof Hagalil', 'list_order' => 11],
            ['name' => 'Migdal HaEmek', 'list_order' => 12],
            ['name' => 'Nazareth', 'list_order' => 13],
            ['name' => 'Kiryat Tivon', 'list_order' => 14],
            ['name' => 'Beit Shean', 'list_order' => 15],
        ];

        foreach ($cluster as $row) {
            if (DB::table('cities')->where('name', $row['name'])->exists()) {
                DB::table('cities')->where('name', $row['name'])->update(['list_order' => $row['list_order']]);
            }
        }

        $newCities = [
            [
                'name' => 'Beit Shean',
                'hebrew_name' => 'בית שאן',
                'region' => 'עמק ישראל',
                'latitude' => 32.4971,
                'longitude' => 35.5013,
                'list_order' => 15,
            ],
            [
                'name' => 'Migdal HaEmek',
                'hebrew_name' => 'מגדל העמק',
                'region' => 'עמק ישראל',
                'latitude' => 32.6790,
                'longitude' => 35.2403,
                'list_order' => 12,
            ],
            [
                'name' => 'Kiryat Tivon',
                'hebrew_name' => 'קרית טבעון',
                'region' => 'עמק ישראל',
                'latitude' => 32.7203,
                'longitude' => 35.1204,
                'list_order' => 14,
            ],
            [
                'name' => 'Nazareth',
                'hebrew_name' => 'נצרת',
                'region' => 'עמק ישראל',
                'latitude' => 32.7009,
                'longitude' => 35.2956,
                'list_order' => 13,
            ],
        ];

        foreach ($newCities as $c) {
            City::query()->updateOrCreate(
                ['name' => $c['name']],
                [
                    'hebrew_name' => $c['hebrew_name'],
                    'region' => $c['region'],
                    'latitude' => $c['latitude'],
                    'longitude' => $c['longitude'],
                    'list_order' => $c['list_order'],
                ]
            );
        }

        if (DB::table('cities')->where('name', 'Afula')->exists()) {
            DB::table('cities')->where('name', 'Afula')->update(['region' => 'עמק ישראל', 'list_order' => 10]);
        }
        if (DB::table('cities')->where('name', 'Nof Hagalil')->exists()) {
            DB::table('cities')->where('name', 'Nof Hagalil')->update(['region' => 'עמק ישראל', 'list_order' => 11]);
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('cities', 'list_order')) {
            Schema::table('cities', function (Blueprint $table) {
                $table->dropColumn('list_order');
            });
        }
    }
};
