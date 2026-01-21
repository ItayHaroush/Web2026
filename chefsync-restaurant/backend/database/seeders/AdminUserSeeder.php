<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Restaurant;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        $restaurants = Restaurant::all();

        foreach ($restaurants as $restaurant) {
            User::updateOrCreate(
                [
                    'email' => strtolower(str_replace(' ', '', $restaurant->name)) . '@admin.com',
                ],
                [
                    'name' => 'Admin ' . $restaurant->name,
                    'password' => Hash::make('password'),
                    'restaurant_id' => $restaurant->id,
                    'role' => 'manager',
                ]
            );
        }

        // משתמש סופר אדמין
        User::updateOrCreate(
            ['email' => 'admin@chefsync.com'],
            [
                'name' => 'Super Admin',
                'password' => Hash::make('admin123'),
                'restaurant_id' => null,
                'role' => 'owner',
                'is_super_admin' => true,
            ]
        );

        $this->command->info('✅ נוצרו משתמשי מנהל למסעדות');
        $this->command->info('📧 Super Admin: admin@chefsync.com / admin123');
    }
}
