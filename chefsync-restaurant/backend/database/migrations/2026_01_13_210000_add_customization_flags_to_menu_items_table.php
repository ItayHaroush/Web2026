<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('menu_items', function (Blueprint $table) {
            $table->boolean('use_variants')->default(false)->after('is_available');
            $table->boolean('use_addons')->default(false)->after('use_variants');
            $table->unsignedTinyInteger('max_addons')->nullable()->after('use_addons');
        });
    }

    public function down(): void
    {
        Schema::table('menu_items', function (Blueprint $table) {
            $table->dropColumn(['use_variants', 'use_addons', 'max_addons']);
        });
    }
};
