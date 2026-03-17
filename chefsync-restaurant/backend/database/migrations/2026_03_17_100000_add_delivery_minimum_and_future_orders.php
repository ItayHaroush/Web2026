<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // מינימום הזמנה למשלוח + הזמנה עתידית
        Schema::table('restaurants', function (Blueprint $table) {
            $table->decimal('delivery_minimum', 8, 2)->default(0)->after('has_delivery');
            $table->boolean('allow_future_orders')->default(false)->after('delivery_minimum');
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->timestamp('scheduled_for')->nullable()->after('eta_minutes');
            $table->boolean('is_future_order')->default(false)->after('scheduled_for');
        });
    }

    public function down(): void
    {
        Schema::table('restaurants', function (Blueprint $table) {
            $table->dropColumn(['delivery_minimum', 'allow_future_orders']);
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['scheduled_for', 'is_future_order']);
        });
    }
};
