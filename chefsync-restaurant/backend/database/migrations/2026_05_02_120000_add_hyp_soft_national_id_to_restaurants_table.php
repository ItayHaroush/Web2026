<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * תעודת זהות לשדה HYP UserId — חיובי Soft/מנוי דורשים לעיתים ערך תקף ולא 000000000.
     */
    public function up(): void
    {
        Schema::table('restaurants', function (Blueprint $table) {
            $table->string('hyp_soft_national_id', 9)->nullable()->after('hyp_card_last4');
        });
    }

    public function down(): void
    {
        Schema::table('restaurants', function (Blueprint $table) {
            $table->dropColumn('hyp_soft_national_id');
        });
    }
};
