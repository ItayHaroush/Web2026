<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('print_jobs', function (Blueprint $table) {
            $table->string('role', 20)->nullable()->after('status');
            $table->unsignedBigInteger('device_id')->nullable()->after('role');
            $table->string('target_ip', 45)->nullable()->after('device_id');
            $table->integer('target_port')->nullable()->after('target_ip');

            $table->unsignedBigInteger('printer_id')->nullable()->change();

            $table->index(['restaurant_id', 'role', 'status'], 'idx_print_jobs_role_status');
            $table->foreign('device_id')->references('id')->on('print_devices')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::table('print_jobs', function (Blueprint $table) {
            $table->dropForeign(['device_id']);
            $table->dropIndex('idx_print_jobs_role_status');
            $table->dropColumn(['role', 'device_id', 'target_ip', 'target_port']);
        });
    }
};
