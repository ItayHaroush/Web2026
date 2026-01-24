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
        Schema::table('ai_usage_logs', function (Blueprint $table) {
            // הסר foreign key קודם
            $table->dropForeign(['restaurant_id']);

            // שנה את העמודה ל-nullable
            $table->unsignedBigInteger('restaurant_id')->nullable()->change();

            // הוסף foreign key מחדש
            $table->foreign('restaurant_id')->references('id')->on('restaurants')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('ai_usage_logs', function (Blueprint $table) {
            $table->dropForeign(['restaurant_id']);
            $table->unsignedBigInteger('restaurant_id')->nullable(false)->change();
            $table->foreign('restaurant_id')->references('id')->on('restaurants')->onDelete('cascade');
        });
    }
};
