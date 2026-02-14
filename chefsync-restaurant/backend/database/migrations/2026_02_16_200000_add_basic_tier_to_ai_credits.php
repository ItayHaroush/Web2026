<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE `ai_credits` MODIFY COLUMN `tier` ENUM('free', 'basic', 'pro', 'enterprise') NOT NULL DEFAULT 'free'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE `ai_credits` MODIFY COLUMN `tier` ENUM('free', 'pro', 'enterprise') NOT NULL DEFAULT 'free'");
    }
};
