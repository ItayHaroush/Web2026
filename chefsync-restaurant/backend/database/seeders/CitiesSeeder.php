<?php

namespace Database\Seeders;

use App\Models\City;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Schema;

class CitiesSeeder extends Seeder
{
    public function run(): void
    {
        $hasListOrder = Schema::hasColumn('cities', 'list_order');

        $cities = [
            // עמק ישראל / אזור עפולה — סדר תצוגה (list_order נמוך = מעלה ברשימה)
            ['name' => 'Afula', 'hebrew_name' => 'עפולה', 'region' => 'עמק ישראל', 'latitude' => 32.6070, 'longitude' => 35.2894, 'list_order' => 10],
            ['name' => 'Nof Hagalil', 'hebrew_name' => 'נוף הגליל', 'region' => 'עמק ישראל', 'latitude' => 32.6996, 'longitude' => 35.3035, 'list_order' => 11],
            ['name' => 'Migdal HaEmek', 'hebrew_name' => 'מגדל העמק', 'region' => 'עמק ישראל', 'latitude' => 32.6790, 'longitude' => 35.2403, 'list_order' => 12],
            ['name' => 'Nazareth', 'hebrew_name' => 'נצרת', 'region' => 'עמק ישראל', 'latitude' => 32.7009, 'longitude' => 35.2956, 'list_order' => 13],
            ['name' => 'Kiryat Tivon', 'hebrew_name' => 'קרית טבעון', 'region' => 'עמק ישראל', 'latitude' => 32.7203, 'longitude' => 35.1204, 'list_order' => 14],
            ['name' => 'Beit Shean', 'hebrew_name' => 'בית שאן', 'region' => 'עמק ישראל', 'latitude' => 32.4971, 'longitude' => 35.5013, 'list_order' => 15],

            // צפון
            ['name' => 'Haifa', 'hebrew_name' => 'חיפה', 'region' => 'צפון', 'latitude' => 32.8193, 'longitude' => 34.9901, 'list_order' => 100],
            ['name' => 'Akko', 'hebrew_name' => 'עכו', 'region' => 'צפון', 'latitude' => 32.9185, 'longitude' => 35.0679, 'list_order' => 100],
            ['name' => 'Nahariya', 'hebrew_name' => 'נהריה', 'region' => 'צפון', 'latitude' => 33.0066, 'longitude' => 35.0964, 'list_order' => 100],
            ['name' => 'Safed', 'hebrew_name' => 'צפת', 'region' => 'צפון', 'latitude' => 32.9614, 'longitude' => 35.4983, 'list_order' => 100],
            ['name' => 'Tiberias', 'hebrew_name' => 'טבריה', 'region' => 'צפון', 'latitude' => 32.7814, 'longitude' => 35.5305, 'list_order' => 100],

            // מרכז
            ['name' => 'Tel Aviv', 'hebrew_name' => 'תל אביב', 'region' => 'מרכז', 'latitude' => 32.0853, 'longitude' => 34.7818, 'list_order' => 100],
            ['name' => 'Ramat Gan', 'hebrew_name' => 'רמת גן', 'region' => 'מרכז', 'latitude' => 32.0856, 'longitude' => 34.8186, 'list_order' => 100],
            ['name' => 'Petah Tikva', 'hebrew_name' => 'פתח תקווה', 'region' => 'מרכז', 'latitude' => 32.0878, 'longitude' => 34.8573, 'list_order' => 100],
            ['name' => 'Hertzeliya', 'hebrew_name' => 'הרצליה', 'region' => 'מרכז', 'latitude' => 32.1702, 'longitude' => 34.7667, 'list_order' => 100],
            ['name' => 'Holon', 'hebrew_name' => 'חולון', 'region' => 'מרכז', 'latitude' => 31.9875, 'longitude' => 34.7620, 'list_order' => 100],
            ['name' => 'Bat Yam', 'hebrew_name' => 'בת ים', 'region' => 'מרכז', 'latitude' => 31.9556, 'longitude' => 34.7615, 'list_order' => 100],
            ['name' => 'Giv\'atayim', 'hebrew_name' => 'גבעתיים', 'region' => 'מרכז', 'latitude' => 32.0641, 'longitude' => 34.8080, 'list_order' => 100],
            ['name' => 'Rishon LeZion', 'hebrew_name' => 'ראשון לציון', 'region' => 'מרכז', 'latitude' => 31.9449, 'longitude' => 34.7932, 'list_order' => 100],
            ['name' => 'Modiin', 'hebrew_name' => 'מודיעין', 'region' => 'מרכז', 'latitude' => 31.8899, 'longitude' => 35.2047, 'list_order' => 100],

            // ירושלים
            ['name' => 'Jerusalem', 'hebrew_name' => 'ירושלים', 'region' => 'ירושלים', 'latitude' => 31.7683, 'longitude' => 35.2137, 'list_order' => 100],

            // דרום
            ['name' => 'Beer Sheva', 'hebrew_name' => 'באר שבע', 'region' => 'דרום', 'latitude' => 31.2507, 'longitude' => 34.7860, 'list_order' => 100],
            ['name' => 'Ashdod', 'hebrew_name' => 'אשדוד', 'region' => 'דרום', 'latitude' => 31.8073, 'longitude' => 34.6469, 'list_order' => 100],
            ['name' => 'Ashkelon', 'hebrew_name' => 'אשקלון', 'region' => 'דרום', 'latitude' => 31.6667, 'longitude' => 34.5650, 'list_order' => 100],
            ['name' => 'Sderot', 'hebrew_name' => 'שדרות', 'region' => 'דרום', 'latitude' => 31.5075, 'longitude' => 34.5901, 'list_order' => 100],
            ['name' => 'Eilat', 'hebrew_name' => 'אילת', 'region' => 'דרום', 'latitude' => 29.5581, 'longitude' => 34.9516, 'list_order' => 100],
        ];

        foreach ($cities as $city) {
            if (! $hasListOrder) {
                unset($city['list_order']);
            }
            City::updateOrCreate(
                ['name' => $city['name']],
                $city
            );
        }
    }
}
