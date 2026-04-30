<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('restaurant_addon_groups', function (Blueprint $table) {
            $table->boolean('first_addon_unit_free')->default(false);
        });

        Schema::table('menu_item_addon_groups', function (Blueprint $table) {
            $table->boolean('first_addon_unit_free')->default(false);
        });
    }

    public function down(): void
    {
        Schema::table('restaurant_addon_groups', function (Blueprint $table) {
            $table->dropColumn('first_addon_unit_free');
        });

        Schema::table('menu_item_addon_groups', function (Blueprint $table) {
            $table->dropColumn('first_addon_unit_free');
        });
    }
};
