<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            $table->string('icon', 10)->default('📂')->after('description');
            $table->integer('sort_order')->default(0)->after('icon');
            $table->boolean('is_active')->default(true)->after('sort_order');
        });

        // שינוי שם עמודה
        DB::statement('ALTER TABLE categories CHANGE display_order old_display_order INT DEFAULT 0');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE categories CHANGE old_display_order display_order INT DEFAULT 0');

        Schema::table('categories', function (Blueprint $table) {
            $table->dropColumn(['icon', 'sort_order', 'is_active']);
        });
    }
};
