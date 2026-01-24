<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('ai_usage_logs', function (Blueprint $table) {
            $table->string('prompt_type', 50)->nullable()->after('action')->comment('chat|insight|sms_draft');
            $table->string('bypass_reason', 50)->nullable()->after('prompt_type')->comment('dev_mode|ai_unlimited|null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('ai_usage_logs', function (Blueprint $table) {
            $table->dropColumn(['prompt_type', 'bypass_reason']);
        });
    }
};
