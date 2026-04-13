<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('daily_reports', function (Blueprint $table) {
            $table->unsignedInteger('refund_count')->default(0)->after('credit_total');
            $table->decimal('refund_total', 10, 2)->default(0)->after('refund_count');
            $table->decimal('net_revenue', 10, 2)->default(0)->after('refund_total');
            $table->decimal('pos_credit_total', 10, 2)->default(0)->after('net_revenue');
            $table->decimal('online_credit_total', 10, 2)->default(0)->after('pos_credit_total');
            $table->decimal('kiosk_credit_total', 10, 2)->default(0)->after('online_credit_total');
            $table->unsignedInteger('waived_count')->default(0)->after('kiosk_credit_total');
            $table->decimal('waived_total', 10, 2)->default(0)->after('waived_count');
        });
    }

    public function down(): void
    {
        Schema::table('daily_reports', function (Blueprint $table) {
            $table->dropColumn([
                'refund_count',
                'refund_total',
                'net_revenue',
                'pos_credit_total',
                'online_credit_total',
                'kiosk_credit_total',
                'waived_count',
                'waived_total',
            ]);
        });
    }
};
