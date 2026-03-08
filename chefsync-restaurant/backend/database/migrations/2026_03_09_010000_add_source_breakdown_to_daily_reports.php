<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('daily_reports', function (Blueprint $table) {
            $table->unsignedInteger('web_orders')->default(0)->after('delivery_orders');
            $table->decimal('web_revenue', 10, 2)->default(0)->after('web_orders');
            $table->unsignedInteger('kiosk_orders')->default(0)->after('web_revenue');
            $table->decimal('kiosk_revenue', 10, 2)->default(0)->after('kiosk_orders');
            $table->unsignedInteger('pos_orders')->default(0)->after('kiosk_revenue');
            $table->decimal('pos_revenue', 10, 2)->default(0)->after('pos_orders');
            $table->unsignedInteger('dine_in_orders')->default(0)->after('pos_revenue');
            $table->unsignedInteger('takeaway_orders')->default(0)->after('dine_in_orders');
        });
    }

    public function down(): void
    {
        Schema::table('daily_reports', function (Blueprint $table) {
            $table->dropColumn([
                'web_orders',
                'web_revenue',
                'kiosk_orders',
                'kiosk_revenue',
                'pos_orders',
                'pos_revenue',
                'dine_in_orders',
                'takeaway_orders',
            ]);
        });
    }
};
