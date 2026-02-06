<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('source', 20)->default('web')->after('payment_method');
            $table->unsignedBigInteger('kiosk_id')->nullable()->after('source');

            $table->index('source', 'idx_orders_source');
            $table->index('kiosk_id', 'idx_orders_kiosk');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex('idx_orders_source');
            $table->dropIndex('idx_orders_kiosk');
            $table->dropColumn(['source', 'kiosk_id']);
        });
    }
};
