<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->timestamp('refund_pending_at')->nullable()->after('marked_paid_at');
            $table->timestamp('refund_waived_at')->nullable()->after('refund_pending_at');
            $table->foreignId('refund_waived_by_user_id')->nullable()->after('refund_waived_at')->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropForeign(['refund_waived_by_user_id']);
            $table->dropColumn(['refund_pending_at', 'refund_waived_at', 'refund_waived_by_user_id']);
        });
    }
};
