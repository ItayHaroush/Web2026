<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('print_jobs', function (Blueprint $table) {
            // Number of print attempts the agent made before this ACK (1..5)
            $table->unsignedInteger('retry_count')->default(0)->after('attempts');
            // Wall-clock duration of the decisive print attempt, reported by the agent
            $table->unsignedInteger('print_duration_ms')->nullable()->after('retry_count');
            // Human-readable printer/device name, resolved on ACK for the dashboard
            $table->string('printer_name', 120)->nullable()->after('target_port');
            // Set once when the restaurant has been alerted about a final failure (dedupe)
            $table->timestamp('failed_notified_at')->nullable()->after('print_duration_ms');
        });
    }

    public function down(): void
    {
        Schema::table('print_jobs', function (Blueprint $table) {
            $table->dropColumn(['retry_count', 'print_duration_ms', 'printer_name', 'failed_notified_at']);
        });
    }
};
