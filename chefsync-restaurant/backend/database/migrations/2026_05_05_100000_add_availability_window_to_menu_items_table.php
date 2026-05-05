<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * הוספת חלון זמינות לפריטי תפריט - שעות וימים שהפריט זמין בהם.
 * NULL בשדות אלו = הפריט זמין תמיד (כל שעות הפעילות, כל הימים).
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('menu_items', function (Blueprint $table) {
            // חלון זמני יומי
            $table->time('availability_start_time')->nullable()->after('is_available');
            $table->time('availability_end_time')->nullable()->after('availability_start_time');
            // ימים בשבוע: array של 0-6 (ראשון=0). NULL = כל הימים.
            $table->json('availability_days')->nullable()->after('availability_end_time');
        });
    }

    public function down(): void
    {
        Schema::table('menu_items', function (Blueprint $table) {
            $table->dropColumn(['availability_start_time', 'availability_end_time', 'availability_days']);
        });
    }
};
