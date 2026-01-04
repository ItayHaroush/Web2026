<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * הוסף שדות שעות פתיחה ולחי פעילות ליום בשבוע
     */
    public function up(): void
    {
        Schema::table('restaurants', function (Blueprint $table) {
            // ימי פתיחה בשבוע (JSON: {"Sunday": true, "Monday": true, ...})
            $table->json('operating_days')->nullable();

            // שעות פתיחה (JSON: {"open": "09:00", "close": "23:00"})
            $table->json('operating_hours')->nullable();

            // URL לוגו (אם לא קיים)
            if (!Schema::hasColumn('restaurants', 'logo_url')) {
                $table->string('logo_url')->nullable();
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('restaurants', function (Blueprint $table) {
            $table->dropColumn(['operating_days', 'operating_hours']);
            if (Schema::hasColumn('restaurants', 'logo_url')) {
                $table->dropColumn('logo_url');
            }
        });
    }
};
