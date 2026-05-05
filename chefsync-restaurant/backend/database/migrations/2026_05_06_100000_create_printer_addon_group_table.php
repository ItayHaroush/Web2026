<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Pivot table — קבוצות תוספות שיוסתרו מהדפסה במדפסת זו.
 * רק קבוצות מסוג "כללי" (לא מקושרות לקטגוריה) ניתנות לבחירה ע"י המשתמש.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('printer_addon_group', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('printer_id');
            $table->unsignedBigInteger('addon_group_id');

            $table->unique(['printer_id', 'addon_group_id']);
            $table->foreign('printer_id')->references('id')->on('printers')->onDelete('cascade');
            $table->foreign('addon_group_id')->references('id')->on('restaurant_addon_groups')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('printer_addon_group');
    }
};
