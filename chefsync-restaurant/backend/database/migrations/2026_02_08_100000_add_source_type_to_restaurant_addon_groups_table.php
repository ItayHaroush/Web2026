<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('restaurant_addon_groups', function (Blueprint $table) {
            $table->enum('source_type', ['manual', 'category'])->default('manual')->after('placement');
            $table->unsignedBigInteger('source_category_id')->nullable()->after('source_type');

            $table->foreign('source_category_id')
                ->references('id')
                ->on('categories')
                ->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::table('restaurant_addon_groups', function (Blueprint $table) {
            $table->dropForeign(['source_category_id']);
            $table->dropColumn(['source_type', 'source_category_id']);
        });
    }
};
