<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * שדות HYP לתשלומי אשראי במסעדות
     */
    public function up(): void
    {
        Schema::table('restaurants', function (Blueprint $table) {
            if (!Schema::hasColumn('restaurants', 'hyp_terminal_id')) {
                $table->string('hyp_terminal_id')->nullable()->after('tranzila_token');
            }
            if (!Schema::hasColumn('restaurants', 'hyp_terminal_password')) {
                $table->text('hyp_terminal_password')->nullable()->after('hyp_terminal_id');
            }
            if (!Schema::hasColumn('restaurants', 'hyp_terminal_verified')) {
                $table->boolean('hyp_terminal_verified')->default(false)->after('hyp_terminal_password');
            }
            if (!Schema::hasColumn('restaurants', 'hyp_terminal_verified_at')) {
                $table->timestamp('hyp_terminal_verified_at')->nullable()->after('hyp_terminal_verified');
            }
            if (!Schema::hasColumn('restaurants', 'accepted_payment_methods')) {
                $table->json('accepted_payment_methods')->nullable()->after('hyp_terminal_verified_at');
            }
        });

        // Set default value for existing rows
        DB::statement("UPDATE restaurants SET accepted_payment_methods = '[\"cash\"]' WHERE accepted_payment_methods IS NULL");
    }

    public function down(): void
    {
        Schema::table('restaurants', function (Blueprint $table) {
            $table->dropColumn([
                'hyp_terminal_id',
                'hyp_terminal_password',
                'hyp_terminal_verified',
                'hyp_terminal_verified_at',
                'accepted_payment_methods',
            ]);
        });
    }
};
