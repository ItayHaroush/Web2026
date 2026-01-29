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
            $table->enum('restaurant_type', ['pizza', 'shawarma', 'burger', 'bistro', 'catering', 'general'])
                ->default('general')
                ->after('slug')
                ->comment('סוג המסעדה - משפיע על prompts של AI');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('restaurants', function (Blueprint $table) {
            $table->dropColumn('restaurant_type');
        });
    }
};
