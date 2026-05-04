<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('restaurant_addon_groups', function (Blueprint $table) {
            $table->boolean('allow_half_placement')->default(false)->after('first_addon_unit_free');
        });

        Schema::table('menu_item_addon_groups', function (Blueprint $table) {
            $table->boolean('allow_half_placement')->default(false)->after('first_addon_unit_free');
        });
    }

    public function down(): void
    {
        Schema::table('restaurant_addon_groups', function (Blueprint $table) {
            $table->dropColumn('allow_half_placement');
        });

        Schema::table('menu_item_addon_groups', function (Blueprint $table) {
            $table->dropColumn('allow_half_placement');
        });
    }
};
