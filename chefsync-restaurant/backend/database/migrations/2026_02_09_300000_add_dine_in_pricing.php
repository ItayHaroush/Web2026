<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('restaurants', function (Blueprint $table) {
            $table->boolean('enable_dine_in_pricing')->default(false)->after('pickup_time_note');
        });

        Schema::table('categories', function (Blueprint $table) {
            $table->decimal('dine_in_adjustment', 8, 2)->nullable()->default(null)->after('dish_type');
        });

        Schema::table('menu_items', function (Blueprint $table) {
            $table->decimal('dine_in_adjustment', 8, 2)->nullable()->default(null)->after('max_addons');
        });
    }

    public function down(): void
    {
        Schema::table('restaurants', function (Blueprint $table) {
            $table->dropColumn('enable_dine_in_pricing');
        });

        Schema::table('categories', function (Blueprint $table) {
            $table->dropColumn('dine_in_adjustment');
        });

        Schema::table('menu_items', function (Blueprint $table) {
            $table->dropColumn('dine_in_adjustment');
        });
    }
};
