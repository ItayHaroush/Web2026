<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // הרחבת enum של status להוסיף trial
        DB::statement("ALTER TABLE restaurant_subscriptions MODIFY COLUMN status ENUM('active','suspended','cancelled','trial') NOT NULL DEFAULT 'active'");
    }

    public function down(): void
    {
        // החזרה ללא trial
        DB::statement("ALTER TABLE restaurant_subscriptions MODIFY COLUMN status ENUM('active','suspended','cancelled') NOT NULL DEFAULT 'active'");
    }
};
