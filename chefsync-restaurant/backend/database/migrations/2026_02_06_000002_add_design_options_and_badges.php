<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * הרחבת מסכי תצוגה - design_options + badges
     */
    public function up(): void
    {
        Schema::table('display_screens', function (Blueprint $table) {
            $table->json('design_options')->nullable()->default(null)->after('design_preset');
        });

        Schema::table('display_screen_items', function (Blueprint $table) {
            $table->json('badge')->nullable()->default(null)->after('sort_order');
        });
    }

    public function down(): void
    {
        Schema::table('display_screens', function (Blueprint $table) {
            $table->dropColumn('design_options');
        });

        Schema::table('display_screen_items', function (Blueprint $table) {
            $table->dropColumn('badge');
        });
    }
};
