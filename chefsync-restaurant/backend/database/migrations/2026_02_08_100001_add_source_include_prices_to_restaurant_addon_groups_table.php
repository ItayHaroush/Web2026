<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('restaurant_addon_groups', function (Blueprint $table) {
            $table->boolean('source_include_prices')->default(true)->after('source_category_id');
        });
    }

    public function down(): void
    {
        Schema::table('restaurant_addon_groups', function (Blueprint $table) {
            $table->dropColumn('source_include_prices');
        });
    }
};
