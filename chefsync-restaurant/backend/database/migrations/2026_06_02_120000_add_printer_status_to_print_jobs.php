<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('print_jobs', function (Blueprint $table) {
            $table->boolean('printer_status_verified')->nullable()->after('error_message');
            $table->string('printer_status', 32)->nullable()->after('printer_status_verified');
            $table->string('printer_status_detail', 255)->nullable()->after('printer_status');
        });
    }

    public function down(): void
    {
        Schema::table('print_jobs', function (Blueprint $table) {
            $table->dropColumn(['printer_status_verified', 'printer_status', 'printer_status_detail']);
        });
    }
};
