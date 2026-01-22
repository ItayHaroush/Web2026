<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('delivery_zones', function (Blueprint $table) {
            $table->decimal('city_radius', 8, 2)->nullable()->after('city_id')->comment('רדיוס בק״מ למעגל סביב עיר (אם נבחרה עיר)');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('delivery_zones', function (Blueprint $table) {
            $table->dropColumn('city_radius');
        });
    }
};
