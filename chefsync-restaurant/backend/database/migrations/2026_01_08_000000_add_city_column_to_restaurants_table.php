<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('restaurants', function (Blueprint $table) {
            // הוסף עמודת עיר אם היא לא קיימת
            if (!Schema::hasColumn('restaurants', 'city')) {
                $table->string('city')->nullable()->after('address');
            }
        });
    }

    public function down(): void
    {
        Schema::table('restaurants', function (Blueprint $table) {
            // הסר את העמודה כשחוזרים לאחור
            if (Schema::hasColumn('restaurants', 'city')) {
                $table->dropColumn('city');
            }
        });
    }
};
