<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * שדות HYP לתשלומי אשראי במסעדות
     */
    public function up(): void
    {
        Schema::table('restaurants', function (Blueprint $table) {
            $table->string('hyp_terminal_id')->nullable()->after('tranzila_token');
            $table->text('hyp_terminal_password')->nullable()->after('hyp_terminal_id'); // stored encrypted via model cast
            $table->boolean('hyp_terminal_verified')->default(false)->after('hyp_terminal_password');
            $table->timestamp('hyp_terminal_verified_at')->nullable()->after('hyp_terminal_verified');
            $table->json('accepted_payment_methods')->default('["cash"]')->after('hyp_terminal_verified_at');
        });
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
