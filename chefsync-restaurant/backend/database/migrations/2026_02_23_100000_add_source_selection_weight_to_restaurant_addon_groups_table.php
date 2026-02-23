<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('restaurant_addon_groups', function (Blueprint $table) {
            $table->unsignedInteger('source_selection_weight')->default(1)->after('source_include_prices');
        });
    }

    public function down(): void
    {
        Schema::table('restaurant_addon_groups', function (Blueprint $table) {
            $table->dropColumn('source_selection_weight');
        });
    }
};
