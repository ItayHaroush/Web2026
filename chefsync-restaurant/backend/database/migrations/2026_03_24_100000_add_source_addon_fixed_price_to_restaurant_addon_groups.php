<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('restaurant_addon_groups', function (Blueprint $table) {
            $table->decimal('source_addon_fixed_price', 8, 2)->nullable()->after('source_include_prices');
        });
    }

    public function down(): void
    {
        Schema::table('restaurant_addon_groups', function (Blueprint $table) {
            $table->dropColumn('source_addon_fixed_price');
        });
    }
};
