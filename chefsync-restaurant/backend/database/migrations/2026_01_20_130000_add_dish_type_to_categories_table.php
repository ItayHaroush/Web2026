<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('categories', 'dish_type')) {
            Schema::table('categories', function (Blueprint $table) {
                $table->enum('dish_type', ['plate', 'sandwich', 'both'])
                    ->default('both')
                    ->after('is_active');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('categories', 'dish_type')) {
            Schema::table('categories', function (Blueprint $table) {
                $table->dropColumn('dish_type');
            });
        }
    }
};
