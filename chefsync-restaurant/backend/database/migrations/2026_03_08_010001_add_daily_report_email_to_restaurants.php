<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('restaurants', function (Blueprint $table) {
            $table->boolean('daily_report_email_enabled')->default(false)->after('share_incentive_text');
            $table->string('daily_report_email')->nullable()->after('daily_report_email_enabled');
        });
    }

    public function down(): void
    {
        Schema::table('restaurants', function (Blueprint $table) {
            $table->dropColumn(['daily_report_email_enabled', 'daily_report_email']);
        });
    }
};
