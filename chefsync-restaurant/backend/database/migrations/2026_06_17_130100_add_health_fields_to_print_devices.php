<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('print_devices', function (Blueprint $table) {
            // Timestamp of the last job the agent successfully printed (for Printer Health screen)
            $table->timestamp('last_successful_print_at')->nullable()->after('printer_last_error');
            // Consecutive failed prints — drives Auto Recovery (discovery + super-admin alert at 3)
            $table->unsignedInteger('consecutive_failures')->default(0)->after('last_successful_print_at');
            // Last print attempt count reported by the agent
            $table->unsignedInteger('last_retry_count')->nullable()->after('consecutive_failures');
        });
    }

    public function down(): void
    {
        Schema::table('print_devices', function (Blueprint $table) {
            $table->dropColumn(['last_successful_print_at', 'consecutive_failures', 'last_retry_count']);
        });
    }
};
