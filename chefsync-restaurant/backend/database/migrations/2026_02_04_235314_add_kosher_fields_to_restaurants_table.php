<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('restaurants', function (Blueprint $table) {
            // הוסף את השדות החסרים שהקוד משתמש בהם
            if (!Schema::hasColumn('restaurants', 'kosher_type')) {
                $table->string('kosher_type')->nullable()->after('cuisine_type');
            }
            if (!Schema::hasColumn('restaurants', 'kosher_certificate')) {
                $table->string('kosher_certificate')->nullable()->after('kosher_type');
            }
            if (!Schema::hasColumn('restaurants', 'kosher_notes')) {
                $table->text('kosher_notes')->nullable()->after('kosher_certificate');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('restaurants', function (Blueprint $table) {
            $table->dropColumn(['kosher_type', 'kosher_certificate', 'kosher_notes']);
        });
    }
};
