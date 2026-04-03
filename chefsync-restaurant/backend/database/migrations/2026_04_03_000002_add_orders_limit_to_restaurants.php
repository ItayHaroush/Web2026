<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('restaurants', 'orders_limit')) {
            Schema::table('restaurants', function (Blueprint $table) {
                $table->unsignedInteger('orders_limit')->nullable()->after('feature_overrides');
            });
        }
    }

    public function down(): void
    {
        Schema::table('restaurants', function (Blueprint $table) {
            $table->dropColumn('orders_limit');
        });
    }
};
