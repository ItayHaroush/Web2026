<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * תחילת תקפת ניסיון — לאחוז מונה ימים (נותר / סה״כ) לפי חלון אמיתי בין התאריכים.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('restaurants', function (Blueprint $table) {
            $table->timestamp('trial_started_at')->nullable()->after('trial_ends_at');
        });

        // הערכה לרשומות קיימות: תחילה בערך בשעת ההרשמה
        if (Schema::hasColumn('restaurants', 'trial_started_at')) {
            DB::statement('UPDATE restaurants SET trial_started_at = created_at WHERE trial_ends_at IS NOT NULL AND trial_started_at IS NULL');
        }
    }

    public function down(): void
    {
        Schema::table('restaurants', function (Blueprint $table) {
            $table->dropColumn('trial_started_at');
        });
    }
};
