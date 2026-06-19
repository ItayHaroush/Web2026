<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('restaurants', function (Blueprint $table) {
            if (! Schema::hasColumn('restaurants', 'deletion_requested_at')) {
                $table->timestamp('deletion_requested_at')->nullable()->after('payment_failure_count');
            }
            if (! Schema::hasColumn('restaurants', 'cancellation_reason')) {
                $table->string('cancellation_reason', 64)->nullable()->after('deletion_requested_at');
            }
            if (! Schema::hasColumn('restaurants', 'cancellation_note')) {
                $table->text('cancellation_note')->nullable()->after('cancellation_reason');
            }
            if (! Schema::hasColumn('restaurants', 'cancellation_effective_date')) {
                $table->date('cancellation_effective_date')->nullable()->after('cancellation_note');
            }
            if (! Schema::hasColumn('restaurants', 'cancellation_requested_by_user_id')) {
                $table->unsignedBigInteger('cancellation_requested_by_user_id')->nullable()->after('cancellation_effective_date');
            }
        });
    }

    public function down(): void
    {
        Schema::table('restaurants', function (Blueprint $table) {
            $cols = ['cancellation_requested_by_user_id', 'cancellation_effective_date', 'cancellation_note', 'cancellation_reason'];
            foreach ($cols as $col) {
                if (Schema::hasColumn('restaurants', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
