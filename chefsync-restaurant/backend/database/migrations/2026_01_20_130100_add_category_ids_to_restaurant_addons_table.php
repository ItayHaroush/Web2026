<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('restaurant_addons', 'category_ids')) {
            Schema::table('restaurant_addons', function (Blueprint $table) {
                $table->json('category_ids')->nullable()->after('is_active');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('restaurant_addons', 'category_ids')) {
            Schema::table('restaurant_addons', function (Blueprint $table) {
                $table->dropColumn('category_ids');
            });
        }
    }
};
