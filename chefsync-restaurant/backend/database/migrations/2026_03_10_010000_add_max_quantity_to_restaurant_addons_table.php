<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('restaurant_addons', function (Blueprint $table) {
            $table->unsignedTinyInteger('max_quantity')->default(1)->after('selection_weight');
        });
    }

    public function down(): void
    {
        Schema::table('restaurant_addons', function (Blueprint $table) {
            $table->dropColumn('max_quantity');
        });
    }
};
