<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE restaurants MODIFY tier ENUM('basic','pro','enterprise') NOT NULL DEFAULT 'pro'");

        if (! Schema::hasColumn('restaurants', 'feature_overrides')) {
            Schema::table('restaurants', function (Blueprint $table) {
                $table->json('feature_overrides')->nullable()->after('tier');
            });
        }
    }

    public function down(): void
    {
        // Revert restaurants with enterprise tier back to pro before shrinking enum
        DB::table('restaurants')->where('tier', 'enterprise')->update(['tier' => 'pro']);
        DB::statement("ALTER TABLE restaurants MODIFY tier ENUM('basic','pro') NOT NULL DEFAULT 'pro'");

        Schema::table('restaurants', function (Blueprint $table) {
            $table->dropColumn('feature_overrides');
        });
    }
};
