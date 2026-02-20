<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('restaurants', function (Blueprint $table) {
            $table->timestamp('paused_by_owner_at')->nullable()->after('payment_failure_count');
            $table->timestamp('deleted_at')->nullable()->after('paused_by_owner_at');
            $table->timestamp('deletion_requested_at')->nullable()->after('deleted_at');
        });
    }

    public function down(): void
    {
        Schema::table('restaurants', function (Blueprint $table) {
            $table->dropColumn(['paused_by_owner_at', 'deleted_at', 'deletion_requested_at']);
        });
    }
};
