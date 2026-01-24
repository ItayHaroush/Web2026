<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // שינוי ENUM מ-annual ל-yearly
        DB::statement("ALTER TABLE restaurant_subscriptions MODIFY COLUMN plan_type ENUM('monthly', 'yearly') NOT NULL DEFAULT 'monthly'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement("ALTER TABLE restaurant_subscriptions MODIFY COLUMN plan_type ENUM('monthly', 'annual') NOT NULL DEFAULT 'monthly'");
    }
};
