<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('restaurants', function (Blueprint $table) {
            // B2B: טוקן כרטיס בעל המסעדה לחיוב מנוי חוזר
            $table->text('hyp_card_token')->nullable()->after('hyp_terminal_verified_at');
            $table->string('hyp_card_expiry')->nullable()->after('hyp_card_token');
            $table->string('hyp_card_last4', 4)->nullable()->after('hyp_card_expiry');

            // מעקב כשלונות חיוב
            $table->timestamp('payment_failed_at')->nullable()->after('hyp_card_last4');
            $table->unsignedTinyInteger('payment_failure_count')->default(0)->after('payment_failed_at');
        });
    }

    public function down(): void
    {
        Schema::table('restaurants', function (Blueprint $table) {
            $table->dropColumn([
                'hyp_card_token',
                'hyp_card_expiry',
                'hyp_card_last4',
                'payment_failed_at',
                'payment_failure_count',
            ]);
        });
    }
};
