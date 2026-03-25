<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('page_visits', function (Blueprint $table) {
            $table->string('restaurant_name', 255)->nullable()->after('restaurant_id');
            $table->string('visitor_display_hint', 120)->nullable()->after('visitor_kind');
        });
    }

    public function down(): void
    {
        Schema::table('page_visits', function (Blueprint $table) {
            $table->dropColumn(['restaurant_name', 'visitor_display_hint']);
        });
    }
};
