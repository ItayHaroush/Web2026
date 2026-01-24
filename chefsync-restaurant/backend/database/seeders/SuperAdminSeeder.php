<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class SuperAdminSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // בדיקה אם כבר קיים Super Admin
        $existingSuperAdmin = User::where('is_super_admin', true)->first();

        if ($existingSuperAdmin) {
            $this->command->info('Super Admin already exists: ' . $existingSuperAdmin->email);
            return;
        }

        // יצירת Super Admin ראשון
        $superAdmin = User::create([
            'restaurant_id' => null, // Super Admin לא שייך למסעדה ספציפית
            'name' => 'Super Admin',
            'email' => 'admin@chefsync.com',
            'phone' => '0500000000',
            'password' => Hash::make('admin123'), // שנה סיסמה זו בסביבת ייצור!
            'role' => 'owner', // role לא רלוונטי ל-Super Admin
            'is_active' => true,
            'is_super_admin' => true,
            'ai_unlimited' => true, // Unlimited AI access for system owner
        ]);

        $this->command->info('Super Admin created successfully!');
        $this->command->info('Email: admin@chefsync.com');
        $this->command->info('Password: admin123');
        $this->command->info('AI Access: Unlimited (bypasses credit limits)');
        $this->command->warn('⚠️  Change this password in production!');
    }
}
