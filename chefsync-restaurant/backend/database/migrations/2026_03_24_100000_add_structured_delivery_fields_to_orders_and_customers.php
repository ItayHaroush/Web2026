<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (!Schema::hasColumn('orders', 'delivery_city')) {
                $table->string('delivery_city', 120)->nullable()->after('delivery_address');
            }
            if (!Schema::hasColumn('orders', 'delivery_street')) {
                $table->string('delivery_street', 255)->nullable()->after('delivery_city');
            }
            if (!Schema::hasColumn('orders', 'delivery_house_number')) {
                $table->string('delivery_house_number', 32)->nullable()->after('delivery_street');
            }
        });

        Schema::table('customers', function (Blueprint $table) {
            if (!Schema::hasColumn('customers', 'default_delivery_city')) {
                $table->string('default_delivery_city', 120)->nullable()->after('default_delivery_address');
            }
            if (!Schema::hasColumn('customers', 'default_delivery_street')) {
                $table->string('default_delivery_street', 255)->nullable()->after('default_delivery_city');
            }
            if (!Schema::hasColumn('customers', 'default_delivery_house_number')) {
                $table->string('default_delivery_house_number', 32)->nullable()->after('default_delivery_street');
            }
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            foreach (['delivery_house_number', 'delivery_street', 'delivery_city'] as $col) {
                if (Schema::hasColumn('orders', $col)) {
                    $table->dropColumn($col);
                }
            }
        });

        Schema::table('customers', function (Blueprint $table) {
            foreach (['default_delivery_house_number', 'default_delivery_street', 'default_delivery_city'] as $col) {
                if (Schema::hasColumn('customers', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
