<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (!Schema::hasColumn('orders', 'delivery_zone_id')) {
                $table->unsignedBigInteger('delivery_zone_id')->nullable()->after('delivery_notes');
                $table->index('delivery_zone_id');
            }
            if (!Schema::hasColumn('orders', 'delivery_fee')) {
                $table->decimal('delivery_fee', 8, 2)->default(0)->after('delivery_zone_id');
            }
            if (!Schema::hasColumn('orders', 'delivery_distance_km')) {
                $table->decimal('delivery_distance_km', 6, 2)->nullable()->after('delivery_fee');
            }
            if (!Schema::hasColumn('orders', 'delivery_lat')) {
                $table->decimal('delivery_lat', 10, 7)->nullable()->after('delivery_distance_km');
            }
            if (!Schema::hasColumn('orders', 'delivery_lng')) {
                $table->decimal('delivery_lng', 10, 7)->nullable()->after('delivery_lat');
            }
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (Schema::hasColumn('orders', 'delivery_lng')) {
                $table->dropColumn('delivery_lng');
            }
            if (Schema::hasColumn('orders', 'delivery_lat')) {
                $table->dropColumn('delivery_lat');
            }
            if (Schema::hasColumn('orders', 'delivery_distance_km')) {
                $table->dropColumn('delivery_distance_km');
            }
            if (Schema::hasColumn('orders', 'delivery_fee')) {
                $table->dropColumn('delivery_fee');
            }
            if (Schema::hasColumn('orders', 'delivery_zone_id')) {
                $table->dropIndex(['delivery_zone_id']);
                $table->dropColumn('delivery_zone_id');
            }
        });
    }
};
