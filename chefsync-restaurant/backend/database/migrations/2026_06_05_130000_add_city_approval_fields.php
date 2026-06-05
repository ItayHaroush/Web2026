<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cities', function (Blueprint $table) {
            $table->string('approval_status', 20)->default('approved')->after('normalized_name');
            $table->unsignedBigInteger('reviewed_by_user_id')->nullable()->after('approval_status');
            $table->timestamp('reviewed_at')->nullable()->after('reviewed_by_user_id');
            $table->string('review_note', 255)->nullable()->after('reviewed_at');

            $table->index('approval_status');
        });

        DB::table('cities')
            ->whereNull('approval_status')
            ->update(['approval_status' => 'approved']);
    }

    public function down(): void
    {
        Schema::table('cities', function (Blueprint $table) {
            $table->dropIndex(['approval_status']);
            $table->dropColumn(['approval_status', 'reviewed_by_user_id', 'reviewed_at', 'review_note']);
        });
    }
};
