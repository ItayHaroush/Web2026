<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\City;

class CitiesSeeder extends Seeder
{
    public function run(): void
    {
        $cities = [
            // צפון
            ['name' => 'Haifa', 'hebrew_name' => 'חיפה', 'region' => 'צפון', 'latitude' => 32.8193, 'longitude' => 34.9901],
            ['name' => 'Akko', 'hebrew_name' => 'עכו', 'region' => 'צפון', 'latitude' => 32.9185, 'longitude' => 35.0679],
            ['name' => 'Nahariya', 'hebrew_name' => 'נהריה', 'region' => 'צפון', 'latitude' => 33.0066, 'longitude' => 35.0964],
            ['name' => 'Safed', 'hebrew_name' => 'צפת', 'region' => 'צפון', 'latitude' => 32.9614, 'longitude' => 35.4983],
            ['name' => 'Tiberias', 'hebrew_name' => 'טבריה', 'region' => 'צפון', 'latitude' => 32.7814, 'longitude' => 35.5305],
            ['name' => 'Afula', 'hebrew_name' => 'עפולה', 'region' => 'צפון', 'latitude' => 32.6070, 'longitude' => 35.2894],

            // מרכז
            ['name' => 'Tel Aviv', 'hebrew_name' => 'תל אביב', 'region' => 'מרכז', 'latitude' => 32.0853, 'longitude' => 34.7818],
            ['name' => 'Ramat Gan', 'hebrew_name' => 'רמת גן', 'region' => 'מרכז', 'latitude' => 32.0856, 'longitude' => 34.8186],
            ['name' => 'Petah Tikva', 'hebrew_name' => 'פתח תקווה', 'region' => 'מרכז', 'latitude' => 32.0878, 'longitude' => 34.8573],
            ['name' => 'Hertzeliya', 'hebrew_name' => 'הרצליה', 'region' => 'מרכז', 'latitude' => 32.1702, 'longitude' => 34.7667],
            ['name' => 'Holon', 'hebrew_name' => 'חולון', 'region' => 'מרכז', 'latitude' => 31.9875, 'longitude' => 34.7620],
            ['name' => 'Bat Yam', 'hebrew_name' => 'בת ים', 'region' => 'מרכז', 'latitude' => 31.9556, 'longitude' => 34.7615],
            ['name' => 'Giv\'atayim', 'hebrew_name' => 'גבעתיים', 'region' => 'מרכז', 'latitude' => 32.0641, 'longitude' => 34.8080],
            ['name' => 'Rishon LeZion', 'hebrew_name' => 'ראשון לציון', 'region' => 'מרכז', 'latitude' => 31.9449, 'longitude' => 34.7932],
            ['name' => 'Modiin', 'hebrew_name' => 'מודיעין', 'region' => 'מרכז', 'latitude' => 31.8899, 'longitude' => 35.2047],

            // ירושלים
            ['name' => 'Jerusalem', 'hebrew_name' => 'ירושלים', 'region' => 'ירושלים', 'latitude' => 31.7683, 'longitude' => 35.2137],

            // דרום
            ['name' => 'Beer Sheva', 'hebrew_name' => 'באר שבע', 'region' => 'דרום', 'latitude' => 31.2507, 'longitude' => 34.7860],
            ['name' => 'Ashdod', 'hebrew_name' => 'אשדוד', 'region' => 'דרום', 'latitude' => 31.8073, 'longitude' => 34.6469],
            ['name' => 'Ashkelon', 'hebrew_name' => 'אשקלון', 'region' => 'דרום', 'latitude' => 31.6667, 'longitude' => 34.5650],
            ['name' => 'Sderot', 'hebrew_name' => 'שדרות', 'region' => 'דרום', 'latitude' => 31.5075, 'longitude' => 34.5901],
            ['name' => 'Eilat', 'hebrew_name' => 'אילת', 'region' => 'דרום', 'latitude' => 29.5581, 'longitude' => 34.9516],
        ];

        foreach ($cities as $city) {
            City::firstOrCreate(
                ['name' => $city['name']],
                $city
            );
        }
    }
}
